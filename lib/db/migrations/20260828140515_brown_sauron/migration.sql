ALTER TABLE "expenses" ADD COLUMN "personalBaseAmount" numeric(12,2);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "personalExchangeRate" numeric(20,10);--> statement-breakpoint
CREATE INDEX "expenses_createdBy_date_idx" ON "expenses" ("createdBy","date");--> statement-breakpoint
-- Backfill `personalBaseAmount` for the shared-space expenses that need no
-- conversion: where the shared space and the creator's personal space already
-- report in the same currency, the figure is the one already computed.
--
-- Rows whose two spaces disagree are deliberately left null, because putting
-- the right number in them needs an exchange rate for the entry's own date and
-- SQL has no way to reach one. `scripts/backfill-personal-amounts.ts` finishes
-- those off; until it runs they read as their shared-space `baseAmount`, which
-- is the same behaviour they had before this migration.
UPDATE "expenses" e
SET "personalBaseAmount" = e."baseAmount",
    "personalExchangeRate" = e."exchangeRate"
FROM "organization" shared,
     "member" m,
     "organization" personal
WHERE e."organizationId" = shared."id"
  AND shared."is_personal" = false
  AND m."user_id" = e."createdBy"
  AND personal."id" = m."organization_id"
  AND personal."is_personal" = true
  AND personal."base_currency" = shared."base_currency";--> statement-breakpoint
-- Income belongs to a personal space and nowhere else.
--
-- **This is destructive and there is no way back from it.** Income recorded in
-- a shared space is deleted outright, along with the income categories and
-- recurring templates that only existed to feed it. It is what the repo owner
-- asked for over migrating the rows into their creators' personal ledgers;
-- `scripts/count-shared-income.ts` is what counted the cost beforehand.
--
-- Order matters. Entries go before the categories they point at, so no row is
-- silently de-categorised on the way past, and categories go last because
-- deleting one cascades to its budgets.
DELETE FROM "income"
WHERE "organizationId" IN (SELECT "id" FROM "organization" WHERE "is_personal" = false);--> statement-breakpoint
DELETE FROM "recurringTransactions"
WHERE "type" = 'income'
  AND "organizationId" IN (SELECT "id" FROM "organization" WHERE "is_personal" = false);--> statement-breakpoint
DELETE FROM "categories"
WHERE "type" = 'income'
  AND "organizationId" IN (SELECT "id" FROM "organization" WHERE "is_personal" = false);
