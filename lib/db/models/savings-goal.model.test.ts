import { describe, expect, it } from "vitest";

import { SavingsGoal, toGoalProgress } from "@/lib/db/models/savings-goal.model";

const NOW = new Date("2026-08-13T06:00:00.000Z");

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 1,
    name: "Trip",
    targetAmount: "100000.00",
    currentAmount: "0",
    deadline: null,
    priority: "medium",
    organizationId: "org",
    createdBy: "user",
    updatedBy: "user",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("toGoalProgress", () => {
  describe("progress against the target", () => {
    it("works out what is left and how far along it is", () => {
      const progress = toGoalProgress(goal({ currentAmount: "30000.00" }), NOW);

      expect(progress.remaining).toBe("70000.00");
      expect(progress.ratio).toBeCloseTo(0.3);
      expect(progress.reached).toBe(false);
    });

    it("reads as reached at exactly the target", () => {
      const progress = toGoalProgress(goal({ currentAmount: "100000.00" }), NOW);

      expect(progress.reached).toBe(true);
      expect(progress.remaining).toBe("0.00");
      expect(progress.ratio).toBe(1);
    });

    it("never reports a negative remainder or a bar past full", () => {
      const progress = toGoalProgress(goal({ currentAmount: "150000.00" }), NOW);

      expect(progress.remaining).toBe("0.00");
      expect(progress.ratio).toBe(1);
    });

    it("reads as complete when the target is lowered below the balance", () => {
      // Deciding a trip costs less than planned is a normal thing to do.
      const progress = toGoalProgress(
        goal({ currentAmount: "60000.00", targetAmount: "50000.00" }),
        NOW,
      );

      expect(progress.reached).toBe(true);
      expect(progress.remaining).toBe("0.00");
    });

    it("does not divide by a target of zero", () => {
      expect(toGoalProgress(goal({ targetAmount: "0" }), NOW).ratio).toBe(0);
    });
  });

  describe("deadlines", () => {
    it("counts whole days regardless of the time of day", () => {
      const progress = toGoalProgress(
        goal({ deadline: new Date("2026-11-13T12:00:00.000Z") }),
        NOW,
      );

      expect(progress.daysLeft).toBe(92);
    });

    it("reads a deadline today as zero days, not overdue", () => {
      const progress = toGoalProgress(
        goal({ deadline: new Date("2026-08-13T12:00:00.000Z") }),
        NOW,
      );

      expect(progress.daysLeft).toBe(0);
      expect(progress.overdue).toBe(false);
    });

    it("is overdue once the deadline has passed unreached", () => {
      const progress = toGoalProgress(
        goal({ deadline: new Date("2026-01-01T12:00:00.000Z") }),
        NOW,
      );

      expect(progress.daysLeft).toBeLessThan(0);
      expect(progress.overdue).toBe(true);
    });

    it("is not overdue if the target was reached, however late", () => {
      const progress = toGoalProgress(
        goal({
          currentAmount: "100000.00",
          deadline: new Date("2026-01-01T12:00:00.000Z"),
        }),
        NOW,
      );

      expect(progress.overdue).toBe(false);
    });

    it("has no days left without a deadline", () => {
      expect(toGoalProgress(goal(), NOW).daysLeft).toBeNull();
    });
  });

  describe("the monthly figure — the point of having a deadline", () => {
    it("divides the shortfall over the months remaining", () => {
      const progress = toGoalProgress(
        goal({ currentAmount: "30000.00", deadline: new Date("2026-11-13T12:00:00.000Z") }),
        NOW,
      );

      // 70,000 short with 92 days left — four months, rounded up.
      expect(progress.perMonth).toBe("17500.00");
    });

    it("treats a shortfall inside one month as this month's problem", () => {
      // Never less than one month, or 20 days left would read as two thirds of
      // the shortfall.
      const progress = toGoalProgress(
        goal({ currentAmount: "90000.00", deadline: new Date("2026-09-02T12:00:00.000Z") }),
        NOW,
      );

      expect(progress.perMonth).toBe("10000.00");
    });

    it.each([
      ["there is no deadline", {}],
      [
        "the goal is already reached",
        { currentAmount: "100000.00", deadline: new Date("2026-11-13T12:00:00.000Z") },
      ],
      ["the deadline has passed", { deadline: new Date("2026-01-01T12:00:00.000Z") }],
    ])("has no figure when %s", (_label, overrides) => {
      expect(toGoalProgress(goal(overrides), NOW).perMonth).toBeNull();
    });
  });
});
