import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";

/**
 * Notifications are secondary writes: every one of them follows a write that
 * has already succeeded. Two properties carry the feature, and neither is
 * visible on screen until it is wrong.
 *
 * 1. Raising one **cannot fail the thing that caused it**. An expense that was
 *    recorded stays recorded even if the notification blows up.
 * 2. Raising one twice **leaves one row**. Every caller can run twice — a
 *    budget is re-crossed by every later expense, and the recurring sweep races
 *    page loads — so the dedupe key is what stands between the household and a
 *    notification per purchase.
 */

const listMembers = vi.fn();
const createManyIfAbsent = vi.fn();
const countUnread = vi.fn();
const markRead = vi.fn();
const createIfAbsent = vi.fn();

vi.mock("@/lib/repositories/space.repository", () => ({
  spaceRepository: {
    listMembers: (...args: unknown[]) => listMembers(...args),
  },
}));

vi.mock("@/lib/repositories/notification.repository", () => ({
  notificationRepository: {
    createManyIfAbsent: (...args: unknown[]) => createManyIfAbsent(...args),
    countUnread: (...args: unknown[]) => countUnread(...args),
    markRead: (...args: unknown[]) => markRead(...args),
    listForUser: vi.fn(),
    markAllRead: vi.fn(),
    createIfAbsent: (...args: unknown[]) => createIfAbsent(...args),
  },
}));

const { notificationService } = await import("@/lib/services/notification.service");

const ctx: SpaceContext = {
  organizationId: "org-mine",
  userId: "user-me",
  baseCurrency: "LKR",
};

const input = {
  type: "budget_overspend" as const,
  title: "Over budget: August",
  body: "Rs 12,000.00 spent against a Rs 10,000.00 limit.",
  href: "/budgets",
  dedupeKey: "budget:7:2026-08-01",
};

beforeEach(() => {
  vi.resetAllMocks();
  listMembers.mockResolvedValue([{ userId: "user-me" }, { userId: "user-partner" }]);
  createManyIfAbsent.mockImplementation(async (rows: unknown[]) => rows);
});

describe("a notification reaches everyone in the space", () => {
  it("writes one row per member, each scoped to the space", async () => {
    await notificationService.notifySpace("org-mine", input);

    const [rows] = createManyIfAbsent.mock.calls[0] as [
      { userId: string; organizationId: string }[],
    ];

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.userId).sort()).toEqual(["user-me", "user-partner"]);
    expect(rows.every((row) => row.organizationId === "org-mine")).toBe(true);
  });

  it("carries the same dedupe key to every recipient", async () => {
    // Read state is per person, but the event is one event. Different keys per
    // member would let a second crossing notify whoever had already read the
    // first.
    await notificationService.notifySpace("org-mine", input);

    const [rows] = createManyIfAbsent.mock.calls[0] as [{ dedupeKey: string }[]];

    expect(new Set(rows.map((row) => row.dedupeKey))).toEqual(new Set(["budget:7:2026-08-01"]));
  });

  it("can leave out the member who caused it", async () => {
    await notificationService.notifySpace("org-mine", input, { exceptUserId: "user-me" });

    const [rows] = createManyIfAbsent.mock.calls[0] as [{ userId: string }[]];

    expect(rows.map((row) => row.userId)).toEqual(["user-partner"]);
  });

  it("writes nothing when that would leave no recipients", async () => {
    listMembers.mockResolvedValue([{ userId: "user-me" }]);

    await notificationService.notifySpace("org-mine", input, { exceptUserId: "user-me" });

    expect(createManyIfAbsent).not.toHaveBeenCalled();
  });
});

describe("raising one never fails the write that caused it", () => {
  it("swallows a repository failure", async () => {
    // The expense is already recorded. Throwing here would surface as a failed
    // form on a save that worked.
    createManyIfAbsent.mockRejectedValue(new Error("connection lost"));

    await expect(notificationService.notifySpace("org-mine", input)).resolves.toEqual([]);
  });

  it("swallows a failure to even find the members", async () => {
    listMembers.mockRejectedValue(new Error("connection lost"));

    await expect(notificationService.notifySpace("org-mine", input)).resolves.toEqual([]);
    expect(createManyIfAbsent).not.toHaveBeenCalled();
  });
});

describe("an invitation reaches somebody outside the space", () => {
  const invite = {
    type: "space_invitation" as const,
    title: "You have been invited to Household",
    body: "Nilupul invited you to share the Household ledger.",
    href: "/accept-invitation/inv-1",
    dedupeKey: "invitation:inv-1",
  };

  it("writes an account-level row, belonging to no space", async () => {
    // The recipient is not a member of the inviting space — that is what is
    // being offered — so a row scoped to it would be visible to nobody.
    createIfAbsent.mockImplementation(async (row: unknown) => row);

    await notificationService.notifyUser("user-invitee", invite);

    const [row] = createIfAbsent.mock.calls[0] as [{ organizationId: null; userId: string }];

    expect(row.organizationId).toBeNull();
    expect(row.userId).toBe("user-invitee");
  });

  it("keys on the invitation, so re-notifying is a no-op", async () => {
    createIfAbsent.mockImplementation(async (row: unknown) => row);

    await notificationService.notifyUser("user-invitee", invite);

    const [row] = createIfAbsent.mock.calls[0] as [{ dedupeKey: string }];

    expect(row.dedupeKey).toBe("invitation:inv-1");
  });

  it("never fails the invitation that caused it", async () => {
    createIfAbsent.mockRejectedValue(new Error("connection lost"));

    await expect(notificationService.notifyUser("user-invitee", invite)).resolves.toBeUndefined();
  });
});

describe("reading is scoped to the reader, not just the space", () => {
  it("counts only the acting user's unread", async () => {
    countUnread.mockResolvedValue(3);

    await expect(notificationService.unreadCount(ctx)).resolves.toBe(3);
    expect(countUnread).toHaveBeenCalledWith("org-mine", "user-me");
  });

  it("marks read against the acting user", async () => {
    // Otherwise one member reading a notification would clear it for the whole
    // household.
    markRead.mockResolvedValue(true);

    await notificationService.markRead(ctx, 42);

    expect(markRead).toHaveBeenCalledWith(42, "org-mine", "user-me");
  });
});
