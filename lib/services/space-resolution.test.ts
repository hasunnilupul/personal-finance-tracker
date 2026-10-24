import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `resolveActiveSpace` runs on every request, and the session's
 * `activeOrganizationId` it is handed is a hint, not proof. These pin the two
 * things that matter: a space the user is not a member of is never returned,
 * and finding the answer costs one query rather than a chain of them.
 */

const findForMember = vi.fn();
const findPersonalSpace = vi.fn();
const findMembership = vi.fn();
const findById = vi.fn();

vi.mock("@/lib/repositories/space.repository", () => ({
  spaceRepository: {
    findForMember: (...args: unknown[]) => findForMember(...args),
    findPersonalSpace: (...args: unknown[]) => findPersonalSpace(...args),
    findMembership: (...args: unknown[]) => findMembership(...args),
    findById: (...args: unknown[]) => findById(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { spaceService } = await import("@/lib/services/space.service");

const personal = { id: "org-personal", isPersonal: true, baseCurrency: "LKR" };
const shared = { id: "org-shared", isPersonal: false, baseCurrency: "LKR" };

describe("resolveActiveSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the active space and the caller's role from a single query", async () => {
    findForMember.mockResolvedValue({ space: shared, role: "member" });

    const result = await spaceService.resolveActiveSpace("user-1", "org-shared");

    expect(result).toEqual({ space: shared, role: "member" });
    expect(findForMember).toHaveBeenCalledWith("user-1", "org-shared");
    expect(findMembership).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
    expect(findPersonalSpace).not.toHaveBeenCalled();
  });

  // The refusal, not the happy path: a stale or tampered id must not reach
  // somebody else's space.
  it("falls back to the personal space when the user is not a member", async () => {
    findForMember.mockResolvedValue(undefined);
    findPersonalSpace.mockResolvedValue(personal);

    const result = await spaceService.resolveActiveSpace("user-1", "org-someone-elses");

    expect(result).toEqual({ space: personal, role: "owner" });
  });

  it("goes straight to the personal space when no space is active", async () => {
    findPersonalSpace.mockResolvedValue(personal);

    const result = await spaceService.resolveActiveSpace("user-1", null);

    expect(result).toEqual({ space: personal, role: "owner" });
    expect(findForMember).not.toHaveBeenCalled();
  });

  it("refuses when the personal space is missing too", async () => {
    findForMember.mockResolvedValue(undefined);
    findPersonalSpace.mockResolvedValue(undefined);

    await expect(spaceService.resolveActiveSpace("user-1", "org-gone")).rejects.toMatchObject({
      code: "SPACE_NOT_FOUND",
    });
  });
});
