import {
  recurringTransactionRepository,
  RecurringWithCategory,
} from "@/lib/repositories/recurring-transaction.repository";
import { categoryService } from "@/lib/services/category.service";
import { spaceRepository } from "@/lib/repositories/space.repository";
import { transactionService } from "@/lib/services/transaction.service";
import { RecurringTransaction } from "@/lib/db/models/recurring-transaction.model";
import { TransactionKind } from "@/lib/db/models/transaction.model";
import { SpaceContext } from "@/lib/services/types";
import { ServiceError } from "@/lib/services/errors";
import {
  dueOccurrences,
  Frequency,
  FREQUENCY_LABEL,
  occurrenceAt,
  todayAnchor,
} from "@/lib/recurring/schedule";
import { notificationService } from "@/lib/services/notification.service";
import { formatMoney } from "@/lib/currency/format";
import { logger } from "@/lib/logger";

/**
 * What a caller may set on a template.
 *
 * `nextDate` is not among them: it is where the series has got to, which the
 * service owns. Letting a client move it would be a way to re-materialise
 * occurrences that already exist, or to skip ones that should have been.
 */
export interface RecurringFields {
  type: TransactionKind;
  amount: string;
  currency: string;
  categoryId: number | null;
  description: string | null;
  frequency: Frequency;
  /** The first occurrence, and the anchor for every later one. */
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

/**
 * What one catch-up run did.
 */
export interface CatchUpResult {
  /** Entries actually written. Excludes occurrences that already existed. */
  created: number;
  /** Templates that had at least one occurrence due. */
  templates: number;
  /** True when a template hit the per-run cap and has more still to create. */
  more: boolean;
}

const EMPTY: CatchUpResult = { created: 0, templates: 0, more: false };

export class RecurringTransactionService {
  async getAll(ctx: SpaceContext): Promise<RecurringWithCategory[]> {
    return recurringTransactionRepository.findAllWithCategory(ctx.organizationId);
  }

  async getById(ctx: SpaceContext, id: number): Promise<RecurringTransaction | undefined> {
    return recurringTransactionRepository.findById(id, ctx.organizationId);
  }

  /**
   * Creates a template.
   *
   * `nextDate` starts at `startDate`, so a template dated in the past
   * materialises its history on the next catch-up rather than silently
   * beginning today — someone entering the rent they have been paying since
   * January means it to appear since January.
   */
  async create(ctx: SpaceContext, fields: RecurringFields): Promise<RecurringTransaction> {
    await this.assertUsableCategory(ctx, fields.categoryId, fields.type);
    this.assertUsableSchedule(fields);

    const created = await recurringTransactionRepository.create({
      ...fields,
      nextDate: fields.startDate,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    logger.info("Recurring template created", {
      organizationId: ctx.organizationId,
      id: created.id,
      frequency: fields.frequency,
    });

    return created;
  }

  /**
   * Edits a template.
   *
   * Moving `startDate` re-anchors the series, so `nextDate` is recomputed to
   * the first occurrence that has not already been materialised. Without that,
   * shifting rent from the 1st to the 15th would leave the series stepping from
   * a date no longer on it.
   *
   * Entries already generated are left alone. They are real money that was
   * really spent; rewriting history to match a template edited afterwards would
   * be worse than the inconsistency.
   */
  async update(
    ctx: SpaceContext,
    id: number,
    fields: RecurringFields,
  ): Promise<RecurringTransaction | undefined> {
    const current = await recurringTransactionRepository.findById(id, ctx.organizationId);

    if (!current) {
      return undefined;
    }

    await this.assertUsableCategory(ctx, fields.categoryId, fields.type);
    this.assertUsableSchedule(fields);

    const reanchored =
      current.startDate.getTime() !== fields.startDate.getTime() ||
      current.frequency !== fields.frequency;

    const nextDate = reanchored
      ? this.firstUncreated(fields.startDate, fields.frequency, current.nextDate)
      : current.nextDate;

    return recurringTransactionRepository.update(id, ctx.organizationId, {
      ...fields,
      nextDate,
      updatedBy: ctx.userId,
    });
  }

  async delete(ctx: SpaceContext, id: number): Promise<boolean> {
    const deleted = await recurringTransactionRepository.delete(id, ctx.organizationId);

    if (deleted) {
      logger.info("Recurring template deleted", { organizationId: ctx.organizationId, id });
    }

    return deleted;
  }

  /**
   * Materialises everything due in one space.
   *
   * **This is the guarantee, not the cron route.** `CRON_SECRET` is optional
   * and unset in this deployment, so a cron-only trigger would never fire; a
   * catch-up on page load always does. The cron sweep is an accelerator for
   * spaces nobody has opened.
   *
   * Guarded by a count first, so the usual case — nothing due — costs one
   * indexed query and no writes.
   */
  async catchUp(ctx: SpaceContext, now: Date = new Date()): Promise<CatchUpResult> {
    const on = todayAnchor(now);

    if ((await recurringTransactionRepository.countDue(ctx.organizationId, on)) === 0) {
      return EMPTY;
    }

    const due = await recurringTransactionRepository.findDue(ctx.organizationId, on);

    return this.materialiseAll(ctx, due, now);
  }

  /**
   * Materialises everything due across every space, for the cron sweep.
   *
   * Each space is caught up under its own context, because the conversion into
   * base currency depends on which space the entry belongs to. Attribution
   * falls to the template's `createdBy` — the cron has no user of its own, and
   * inventing one would put a name on the entry that never touched it.
   */
  async catchUpAllSpaces(now: Date = new Date()): Promise<CatchUpResult> {
    const on = todayAnchor(now);
    const due = await recurringTransactionRepository.findAllDue(on);

    if (due.length === 0) {
      return EMPTY;
    }

    const bySpace = new Map<string, RecurringTransaction[]>();

    for (const template of due) {
      const list = bySpace.get(template.organizationId) ?? [];

      list.push(template);
      bySpace.set(template.organizationId, list);
    }

    const totals = { created: 0, templates: 0, more: false };

    for (const [organizationId, templates] of bySpace) {
      const space = await spaceRepository.findById(organizationId);

      if (!space) {
        continue;
      }

      const ctx: SpaceContext = {
        organizationId,
        // The template's author owns what it generates; see the doc comment.
        userId: templates[0].createdBy ?? "",
        baseCurrency: space.baseCurrency,
      };

      const result = await this.materialiseAll(ctx, templates, now);

      totals.created += result.created;
      totals.templates += result.templates;
      totals.more = totals.more || result.more;
    }

    return totals;
  }

  /**
   * Turns a set of due templates into real entries.
   *
   * The order matters and is deliberate: **entries first, then `nextDate`.**
   * The HTTP driver has no interactive transactions, so the two writes cannot
   * be atomic. Advancing first would lose an occurrence outright if the insert
   * then failed — money silently missing from the ledger. Creating first can at
   * worst repeat, and repeating is exactly what the occurrence key makes into a
   * no-op. A failure part-way is therefore recoverable by simply running again.
   */
  private async materialiseAll(
    ctx: SpaceContext,
    templates: RecurringTransaction[],
    now: Date,
  ): Promise<CatchUpResult> {
    let created = 0;
    let touched = 0;
    let more = false;

    for (const template of templates) {
      const frequency = template.frequency as Frequency;

      const { dates, nextDate, finished } = dueOccurrences(
        {
          anchor: template.startDate,
          frequency,
          nextDate: template.nextDate,
          endDate: template.endDate,
        },
        now,
      );

      if (dates.length === 0) {
        // Nothing due, but a template past its end date should stop being asked.
        if (finished) {
          await recurringTransactionRepository.update(template.id, ctx.organizationId, {
            isActive: false,
          });
        }

        continue;
      }

      touched += 1;

      for (const date of dates) {
        const entry = await transactionService.create(
          ctx,
          template.type as TransactionKind,
          {
            amount: template.amount,
            currency: template.currency,
            date,
            categoryId: template.categoryId,
            description: template.description,
          },
          { recurringId: template.id, ifAbsent: true },
        );

        // `undefined` means the occurrence already existed — a previous run got
        // there first. That is a success, not a failure.
        if (entry) {
          created += 1;

          // Keyed to the occurrence, not to the run, so the cron sweep and a
          // page load racing each other still leave one notification — the
          // same guarantee the occurrence key gives the entry itself.
          const isExpense = template.type === "expense";
          const name =
            template.description ?? (isExpense ? "A recurring expense" : "Recurring income");

          await notificationService.notifySpace(ctx.organizationId, {
            type: "recurring_created",
            title: `${name} was recorded`,
            body: `${formatMoney(template.amount, template.currency)} ${
              isExpense ? "spent" : "received"
            }, from your ${FREQUENCY_LABEL[template.frequency as Frequency].toLowerCase()} schedule.`,
            href: isExpense ? "/expenses" : "/income",
            dedupeKey: `recurring:${template.id}:${date.toISOString().slice(0, 10)}`,
          });
        }
      }

      await recurringTransactionRepository.update(template.id, ctx.organizationId, {
        nextDate,
        ...(finished ? { isActive: false } : {}),
      });

      if (dates.length > 0 && nextDate.getTime() <= todayAnchor(now).getTime()) {
        more = true;
      }
    }

    if (created > 0) {
      logger.info("Recurring transactions materialised", {
        organizationId: ctx.organizationId,
        created,
        templates: touched,
      });
    }

    return { created, templates: touched, more };
  }

  /**
   * The first occurrence of a re-anchored series that has not been created yet.
   *
   * Walks forward from the new anchor until it passes where the old series had
   * got to, so re-anchoring never rewinds into occurrences that already exist.
   */
  private firstUncreated(anchor: Date, frequency: Frequency, previousNext: Date): Date {
    let n = 0;
    let candidate = occurrenceAt(anchor, frequency, 0);

    // Bounded so a pathological anchor cannot spin: 2000 periods is centuries
    // for anything but daily, and ~5 years of daily.
    while (candidate.getTime() < previousNext.getTime() && n < 2000) {
      n += 1;
      candidate = occurrenceAt(anchor, frequency, n);
    }

    return candidate;
  }

  /**
   * A template files into a category, so it has to be one that exists in this
   * space and matches the side it files under — an expense template pointing at
   * an income category would generate entries into a list that never offers it.
   */
  private async assertUsableCategory(
    ctx: SpaceContext,
    categoryId: number | null,
    type: TransactionKind,
  ): Promise<void> {
    return categoryService.assertUsable(ctx, categoryId, type);
  }

  private assertUsableSchedule(fields: RecurringFields): void {
    if (fields.endDate && fields.endDate.getTime() < fields.startDate.getTime()) {
      throw new ServiceError("VALIDATION_FAILED", "The end date comes before the first one.");
    }
  }
}

export const recurringTransactionService = new RecurringTransactionService();
