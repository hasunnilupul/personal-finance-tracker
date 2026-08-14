import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Push is a delivery layer over notifications that are already stored, so the
 * failure modes that matter are the quiet ones:
 *
 * - a failed send must not fail the caller, which has already written the row;
 * - a **gone** subscription must be pruned, because nothing else ever tells the
 *   server that somebody uninstalled the app;
 * - a **transient** failure must not be, or one bad afternoon at a push service
 *   would unsubscribe the whole household permanently.
 */

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
const listForUsers = vi.fn();
const deleteByEndpoints = vi.fn();

vi.mock("web-push", () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}));

vi.mock("@/lib/repositories/push-subscription.repository", () => ({
  pushSubscriptionRepository: {
    listForUsers: (...args: unknown[]) => listForUsers(...args),
    deleteByEndpoints: (...args: unknown[]) => deleteByEndpoints(...args),
    listForUser: vi.fn(),
    upsert: vi.fn(),
    deleteByEndpoint: vi.fn(),
  },
}));

const { pushService } = await import("@/lib/services/push.service");

const payload = { title: "Over budget", body: "Rs 12,000 against Rs 10,000", href: "/budgets" };

const subscription = (endpoint: string, userId = "user-me") => ({
  id: 1,
  userId,
  endpoint,
  p256dh: "key",
  auth: "auth",
  userAgent: null,
  createdAt: new Date(),
});

/** `statusCode` is how web-push reports the push service's answer. */
function pushError(statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(`push failed: ${statusCode}`), { statusCode });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.VAPID_PUBLIC_KEY = "public";
  process.env.VAPID_PRIVATE_KEY = "private";
  listForUsers.mockResolvedValue([]);
  deleteByEndpoints.mockResolvedValue(0);
  sendNotification.mockResolvedValue({ statusCode: 201 });
});

describe("sending", () => {
  it("pushes to every device the recipients have", async () => {
    listForUsers.mockResolvedValue([
      subscription("https://push.example/a"),
      subscription("https://push.example/b"),
    ]);

    await expect(pushService.sendToUsers(["user-me"], payload)).resolves.toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("does nothing, and asks nothing, for an empty recipient list", async () => {
    await expect(pushService.sendToUsers([], payload)).resolves.toBe(0);
    expect(listForUsers).not.toHaveBeenCalled();
  });
});

describe("a subscription the push service says is gone", () => {
  it.each([404, 410])("is pruned on %i", async (statusCode) => {
    listForUsers.mockResolvedValue([subscription("https://push.example/dead")]);
    sendNotification.mockRejectedValue(pushError(statusCode));

    await pushService.sendToUsers(["user-me"], payload);

    expect(deleteByEndpoints).toHaveBeenCalledWith(["https://push.example/dead"]);
  });

  it("leaves the working ones alone", async () => {
    listForUsers.mockResolvedValue([
      subscription("https://push.example/alive"),
      subscription("https://push.example/dead"),
    ]);
    sendNotification.mockImplementation(async (target: { endpoint: string }) => {
      if (target.endpoint.endsWith("dead")) {
        throw pushError(410);
      }

      return { statusCode: 201 };
    });

    await expect(pushService.sendToUsers(["user-me"], payload)).resolves.toBe(1);
    expect(deleteByEndpoints).toHaveBeenCalledWith(["https://push.example/dead"]);
  });
});

describe("a subscription that merely failed", () => {
  it.each([429, 500, 503])("survives a %i", async (statusCode) => {
    // A rate limit or an outage at Apple or Google is not consent being
    // withdrawn. Deleting here would be permanent, and silent.
    listForUsers.mockResolvedValue([subscription("https://push.example/busy")]);
    sendNotification.mockRejectedValue(pushError(statusCode));

    await pushService.sendToUsers(["user-me"], payload);

    expect(deleteByEndpoints).not.toHaveBeenCalled();
  });

  it("does not throw, whatever happens", async () => {
    // The notification row is already written; a missed pop-up is not worth
    // failing the expense that caused it.
    listForUsers.mockRejectedValue(new Error("database unreachable"));

    await expect(pushService.sendToUsers(["user-me"], payload)).resolves.toBe(0);
  });
});
