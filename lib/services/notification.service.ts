import { notificationRepository } from "@/lib/repositories/notification.repository";
import { spaceRepository } from "@/lib/repositories/space.repository";
import { Notification, NotificationInput } from "@/lib/db/models/notification.model";
import { SpaceContext } from "@/lib/services/types";
import { logger } from "@/lib/logger";

/** How many the bell shows. Older ones stay in the table, unread. */
export const NOTIFICATION_PAGE_SIZE = 20;

export class NotificationService {
  /**
   * Raises one notification for every member of a space.
   *
   * A household budget is shared, so an overspend is everyone's news — and a
   * recurring entry appearing is too. Each member gets their own row, because
   * read state belongs to the reader.
   *
   * **Never throws.** Every caller is a write that has already succeeded: an
   * expense was recorded, an occurrence was materialised. Failing to mention it
   * afterwards must not undo it or surface as an error on a form that worked,
   * so this logs and returns instead. The same reasoning as the invitation
   * email, which sends or skips without failing the invitation.
   */
  async notifySpace(
    organizationId: string,
    input: NotificationInput,
    options: { exceptUserId?: string } = {},
  ): Promise<Notification[]> {
    try {
      const members = await spaceRepository.listMembers(organizationId);

      const recipients = members
        .map((member) => member.userId)
        .filter((userId) => userId !== options.exceptUserId);

      if (recipients.length === 0) {
        return [];
      }

      return await notificationRepository.createManyIfAbsent(
        recipients.map((userId) => ({
          organizationId,
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href ?? null,
          dedupeKey: input.dedupeKey,
        })),
      );
    } catch (error) {
      logger.error("Failed to raise a notification", error, {
        organizationId,
        type: input.type,
        dedupeKey: input.dedupeKey,
      });

      return [];
    }
  }

  /**
   * Raises one notification for a single person, about their account rather
   * than about a space.
   *
   * For things that follow the reader between spaces — an invitation, which by
   * definition comes from a space they are not in yet. Same "never throws"
   * contract as {@link notifySpace}: the invitation is already created, and
   * failing to mention it must not undo it.
   */
  async notifyUser(userId: string, input: NotificationInput): Promise<Notification | undefined> {
    try {
      return await notificationRepository.createIfAbsent({
        organizationId: null,
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        dedupeKey: input.dedupeKey,
      });
    } catch (error) {
      logger.error("Failed to raise an account notification", error, {
        userId,
        type: input.type,
        dedupeKey: input.dedupeKey,
      });

      return undefined;
    }
  }

  async list(ctx: SpaceContext, limit = NOTIFICATION_PAGE_SIZE): Promise<Notification[]> {
    return notificationRepository.listForUser(ctx.organizationId, ctx.userId, limit);
  }

  async unreadCount(ctx: SpaceContext): Promise<number> {
    return notificationRepository.countUnread(ctx.organizationId, ctx.userId);
  }

  async markRead(ctx: SpaceContext, id: number): Promise<boolean> {
    return notificationRepository.markRead(id, ctx.organizationId, ctx.userId);
  }

  async markAllRead(ctx: SpaceContext): Promise<number> {
    return notificationRepository.markAllRead(ctx.organizationId, ctx.userId);
  }
}

export const notificationService = new NotificationService();
