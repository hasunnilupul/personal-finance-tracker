import { spaceRepository } from "@/lib/repositories/space.repository";
import { invitationRepository } from "@/lib/repositories/invitation.repository";
import { expenseRepository } from "@/lib/repositories/expense.repository";
import { incomeRepository } from "@/lib/repositories/income.repository";
import {
  reconvertEntriesStatement,
  reconvertPersonalAmountsStatement,
} from "@/lib/repositories/transaction-query";
import { runBatch, statements } from "@/lib/db/batch";
// Aliased because `changeBaseCurrency` binds the fetched rows to `expenses`.
import { expenses as expenseTable } from "@/lib/db/schema/expenses";
import { income as incomeTable } from "@/lib/db/schema/income";
import { categoryService } from "@/lib/services/category.service";
import { budgetService } from "@/lib/services/budget.service";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { SpaceContext } from "@/lib/services/types";
import {
  Invitation,
  Member,
  Organization,
  Space,
  SpaceMember,
} from "@/lib/db/models/organization.model";
import { ServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

/**
 * What a base-currency change touched, counted by kind.
 *
 * Entries and budgets are reported separately because they are re-converted on
 * different rules — entries at their own date, budgets at today's.
 */
export interface ReconversionCount {
  entries: number;
  budgets: number;
}

/**
 * Builds a URL-safe slug, suffixed to stay unique across all spaces.
 */
export function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const suffix = crypto.randomUUID().slice(0, 8);

  return base ? `${base}-${suffix}` : suffix;
}

export class SpaceService {
  /**
   * Creates the private ledger a user gets at sign-up, and seeds it with the
   * default categories.
   *
   * Written directly rather than through better-auth's `createOrganization`
   * endpoint because it runs inside a database hook, before the user has a
   * session to authorise that call with.
   */
  async createPersonalSpace(user: { id: string; name?: string | null }): Promise<Organization> {
    const space = await spaceRepository.create({
      id: crypto.randomUUID(),
      name: "Personal",
      slug: toSlug(`personal-${user.name ?? user.id}`),
      isPersonal: true,
    });

    await spaceRepository.addMember({
      id: crypto.randomUUID(),
      organizationId: space.id,
      userId: user.id,
      role: "owner",
    });

    await categoryService.seedDefaultCategories({
      organizationId: space.id,
      userId: user.id,
      baseCurrency: space.baseCurrency,
      isPersonal: true,
    });

    logger.info("Personal space created", { userId: user.id, organizationId: space.id });

    return space;
  }

  /**
   * Switches a space to a different reporting currency.
   *
   * Every entry keeps the amount that was actually spent and its own currency;
   * only the derived `baseAmount` is recomputed, at the rate for that entry's
   * date. Re-valuing history at today's rate would quietly rewrite what past
   * months cost.
   *
   * Budget limits are the exception: they hold no currency of their own, so they
   * are re-expressed in the new currency at today's rate. A limit is a
   * forward-looking intention rather than a record of what something cost, so
   * what it is worth now is the figure that matters.
   *
   * `ctx.baseCurrency` is the currency being left behind — the budgets are
   * converted out of it — and `ctx.userId` is stamped on the rows it touches.
   *
   * **Switching a personal space reaches outside it**, which is the one thing
   * here that is not obvious from the name. Its owner's expenses in shared
   * spaces each hold a second figure denominated in this currency, so those are
   * re-converted too — in the same transaction, since a personal ledger whose
   * space says one currency and whose shared entries are still in another adds
   * up to a number that is not in any currency at all. Switching a *shared*
   * space needs no equivalent: that second figure is derived from the entry's
   * own amount, not from the shared space's base.
   *
   * @returns How many entries and how many budgets were re-converted. Shared
   * entries touched on a personal switch are counted among the entries.
   */
  async changeBaseCurrency(ctx: SpaceContext, baseCurrency: string): Promise<ReconversionCount> {
    const organizationId = ctx.organizationId;

    const [expenses, incomeEntries, sharedExpenses] = await Promise.all([
      expenseRepository.findAll(organizationId),
      incomeRepository.findAll(organizationId),
      ctx.isPersonal ? expenseRepository.findSharedByCreator(ctx.userId) : Promise.resolve([]),
    ]);

    // Every conversion is computed before anything is written. A missing rate
    // throws here, with the space still on its old currency — rather than
    // halfway through, leaving converted and unconverted entries side by side.
    // The batch below cannot read a result and decide what to write next, so
    // all the rate lookups have to happen up here regardless.
    const convert = async (entry: {
      id: number;
      amount: string;
      currency: string;
      date: Date;
    }) => ({
      id: entry.id,
      ...(await exchangeRateService.convert(
        entry.amount,
        entry.currency,
        baseCurrency,
        entry.date,
      )),
    });

    const [expenseConversions, incomeConversions, sharedConversions, budgetReconversion] =
      await Promise.all([
        Promise.all(expenses.map(convert)),
        Promise.all(incomeEntries.map(convert)),
        Promise.all(sharedExpenses.map(convert)),
        budgetService.reconvertStatement(organizationId, ctx.userId, async (amount) => {
          const { baseAmount } = await exchangeRateService.convert(
            amount,
            ctx.baseCurrency,
            baseCurrency,
          );

          return baseAmount;
        }),
      ]);

    // One transaction, so the space's `baseCurrency` and every amount held in
    // it move together. Written as separate statements this was the worst of
    // the un-transacted writes in this codebase: a partial failure left the
    // space already switched, with some rows in the new currency and some in
    // the old, and nothing on screen saying which was which. Re-running to
    // recover would have converted the already-converted rows a second time.
    await runBatch(
      statements(
        spaceRepository.updateBaseCurrencyStatement(organizationId, baseCurrency),
        reconvertEntriesStatement(expenseTable, organizationId, expenseConversions),
        reconvertEntriesStatement(incomeTable, organizationId, incomeConversions),
        reconvertPersonalAmountsStatement(ctx.userId, sharedConversions),
        budgetReconversion.statement,
      ),
    );

    const budgetsReconverted = budgetReconversion.count;
    const entries = expenseConversions.length + incomeConversions.length + sharedConversions.length;

    logger.info("Base currency changed", {
      organizationId,
      baseCurrency,
      entries,
      budgets: budgetsReconverted,
    });

    return { entries, budgets: budgetsReconverted };
  }

  async listSpaces(userId: string): Promise<Space[]> {
    return spaceRepository.listForUser(userId);
  }

  async getPersonalSpace(userId: string): Promise<Organization | undefined> {
    return spaceRepository.findPersonalSpace(userId);
  }

  async getMembership(userId: string, organizationId: string): Promise<Member | undefined> {
    return spaceRepository.findMembership(userId, organizationId);
  }

  async listMembers(organizationId: string): Promise<Member[]> {
    return spaceRepository.listMembers(organizationId);
  }

  async listMembersWithUser(organizationId: string): Promise<SpaceMember[]> {
    return spaceRepository.listMembersWithUser(organizationId);
  }

  async listPendingInvitations(organizationId: string): Promise<Invitation[]> {
    return invitationRepository.listPending(organizationId);
  }

  /**
   * Resolves which space a request should act on.
   *
   * Prefers the session's active space, but only after confirming the user is
   * still a member of it — a stale or tampered `activeOrganizationId` must
   * never grant access. Falls back to the personal space.
   *
   * @throws {ServiceError} `SPACE_NOT_FOUND` if the user has no space at all,
   * which would mean the sign-up hook failed.
   */
  async resolveActiveSpace(
    userId: string,
    activeOrganizationId?: string | null,
  ): Promise<{ space: Organization; role: string }> {
    if (activeOrganizationId) {
      const membership = await spaceRepository.findMembership(userId, activeOrganizationId);

      if (membership) {
        const space = await spaceRepository.findById(activeOrganizationId);

        if (space) {
          return { space, role: membership.role };
        }
      }

      logger.warn("Active space is not accessible, falling back to personal", {
        userId,
        activeOrganizationId,
      });
    }

    const personal = await this.getPersonalSpace(userId);

    if (!personal) {
      throw new ServiceError(
        "SPACE_NOT_FOUND",
        "Your personal space is missing. Please sign out and back in.",
      );
    }

    return { space: personal, role: "owner" };
  }
}

export const spaceService = new SpaceService();
