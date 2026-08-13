import { describe, expect, it } from "vitest";

import { roleHasPermission } from "@/lib/auth/permissions";

/**
 * The RBAC policy.
 *
 * These are the rules the app's authorization rests on, so they are asserted
 * directly rather than through a service. The point of most of them is what is
 * **denied** — a policy test that only checks the happy path would pass just as
 * well against a policy that allowed everything.
 */
describe("roleHasPermission", () => {
  describe("both roles share the ledger", () => {
    // The decision on record: any member may edit or delete any entry, because
    // a household budget is only useful if everyone can correct it.
    const shared = [
      "transaction",
      "category",
      "budget",
      "savingsGoal",
      "recurringTransaction",
    ] as const;

    for (const resource of shared) {
      for (const action of ["create", "read", "update", "delete"] as const) {
        it(`lets a member ${action} a ${resource}`, () => {
          expect(roleHasPermission("member", { [resource]: [action] })).toBe(true);
        });

        it(`lets an owner ${action} a ${resource}`, () => {
          expect(roleHasPermission("owner", { [resource]: [action] })).toBe(true);
        });
      }
    }
  });

  describe("administration is the owner's alone", () => {
    it("does not let a member invite people", () => {
      expect(roleHasPermission("member", { invitation: ["create"] })).toBe(false);
    });

    it("does not let a member remove people", () => {
      expect(roleHasPermission("member", { member: ["delete"] })).toBe(false);
    });

    it("does not let a member delete the space", () => {
      expect(roleHasPermission("member", { organization: ["delete"] })).toBe(false);
    });

    it("does not let a member change the space's settings", () => {
      // This is what guards the base-currency change, which rewrites every
      // stored conversion in the space.
      expect(roleHasPermission("member", { organization: ["update"] })).toBe(false);
    });

    it("lets an owner invite, remove and delete", () => {
      expect(roleHasPermission("owner", { invitation: ["create"] })).toBe(true);
      expect(roleHasPermission("owner", { member: ["delete"] })).toBe(true);
      expect(roleHasPermission("owner", { organization: ["delete", "update"] })).toBe(true);
    });
  });

  describe("unknown roles are denied", () => {
    // A role that is not in the table has no permissions rather than defaulting
    // to any — a typo'd or tampered role must never widen access.
    it.each(["", "admin", "Owner", "superuser", "undefined"])("denies %o", (role) => {
      expect(roleHasPermission(role, { transaction: ["read"] })).toBe(false);
    });
  });

  describe("a request is granted only if every part of it is", () => {
    it("denies a mixed request where one resource is not permitted", () => {
      expect(
        roleHasPermission("member", {
          transaction: ["create"],
          organization: ["delete"],
        }),
      ).toBe(false);
    });

    it("allows a mixed request where every resource is permitted", () => {
      expect(
        roleHasPermission("member", {
          transaction: ["create", "delete"],
          budget: ["update"],
        }),
      ).toBe(true);
    });
  });
});
