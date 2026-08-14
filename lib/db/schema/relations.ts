import { defineRelations } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export const relations = defineRelations(schema, (r) => ({
  user: {
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),

    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),

    memberships: r.many.member({
      from: r.user.id,
      to: r.member.userId,
    }),
  },

  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),

    activeOrganization: r.one.organization({
      from: r.session.activeOrganizationId,
      to: r.organization.id,
    }),
  },

  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },

  organization: {
    members: r.many.member({
      from: r.organization.id,
      to: r.member.organizationId,
    }),

    invitations: r.many.invitation({
      from: r.organization.id,
      to: r.invitation.organizationId,
    }),

    categories: r.many.categories({
      from: r.organization.id,
      to: r.categories.organizationId,
    }),

    expenses: r.many.expenses({
      from: r.organization.id,
      to: r.expenses.organizationId,
    }),

    income: r.many.income({
      from: r.organization.id,
      to: r.income.organizationId,
    }),

    budgets: r.many.budgets({
      from: r.organization.id,
      to: r.budgets.organizationId,
    }),

    savingsGoals: r.many.savingsGoals({
      from: r.organization.id,
      to: r.savingsGoals.organizationId,
    }),

    recurringTransactions: r.many.recurringTransactions({
      from: r.organization.id,
      to: r.recurringTransactions.organizationId,
    }),
  },

  member: {
    user: r.one.user({
      from: r.member.userId,
      to: r.user.id,
    }),

    organization: r.one.organization({
      from: r.member.organizationId,
      to: r.organization.id,
    }),
  },

  invitation: {
    organization: r.one.organization({
      from: r.invitation.organizationId,
      to: r.organization.id,
    }),

    inviter: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
    }),
  },

  categories: {
    organization: r.one.organization({
      from: r.categories.organizationId,
      to: r.organization.id,
    }),

    expenses: r.many.expenses({
      from: r.categories.id,
      to: r.expenses.categoryId,
    }),

    income: r.many.income({
      from: r.categories.id,
      to: r.income.categoryId,
    }),
  },

  expenses: {
    organization: r.one.organization({
      from: r.expenses.organizationId,
      to: r.organization.id,
    }),

    category: r.one.categories({
      from: r.expenses.categoryId,
      to: r.categories.id,
    }),

    createdByUser: r.one.user({
      from: r.expenses.createdBy,
      to: r.user.id,
    }),

    updatedByUser: r.one.user({
      from: r.expenses.updatedBy,
      to: r.user.id,
    }),
  },

  income: {
    organization: r.one.organization({
      from: r.income.organizationId,
      to: r.organization.id,
    }),

    category: r.one.categories({
      from: r.income.categoryId,
      to: r.categories.id,
    }),

    createdByUser: r.one.user({
      from: r.income.createdBy,
      to: r.user.id,
    }),

    updatedByUser: r.one.user({
      from: r.income.updatedBy,
      to: r.user.id,
    }),
  },

  budgets: {
    organization: r.one.organization({
      from: r.budgets.organizationId,
      to: r.organization.id,
    }),

    category: r.one.categories({
      from: r.budgets.categoryId,
      to: r.categories.id,
    }),
  },

  savingsGoals: {
    organization: r.one.organization({
      from: r.savingsGoals.organizationId,
      to: r.organization.id,
    }),
  },

  recurringTransactions: {
    organization: r.one.organization({
      from: r.recurringTransactions.organizationId,
      to: r.organization.id,
    }),

    category: r.one.categories({
      from: r.recurringTransactions.categoryId,
      to: r.categories.id,
    }),
  },
}));
