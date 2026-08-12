CREATE TABLE "exchangeRates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exchangeRates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"baseCurrency" varchar(3) NOT NULL,
	"quoteCurrency" varchar(3) NOT NULL,
	"rate" numeric(20,10) NOT NULL,
	"asOf" date NOT NULL,
	"source" varchar(20) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "currency" varchar(3) DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "exchangeRate" numeric(20,10) DEFAULT '1' NOT NULL;--> statement-breakpoint
-- "baseAmount" is NOT NULL with no default, so it is added nullable, backfilled
-- and then constrained. Nothing is lost: every existing row predates
-- multi-currency, so it is already denominated in its space's base currency
-- and converts to itself at a rate of 1.
ALTER TABLE "expenses" ADD COLUMN "baseAmount" numeric(12,2);--> statement-breakpoint
UPDATE "expenses" SET "baseAmount" = "amount" WHERE "baseAmount" IS NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "baseAmount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "currency" varchar(3) DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "exchangeRate" numeric(20,10) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "baseAmount" numeric(12,2);--> statement-breakpoint
UPDATE "income" SET "baseAmount" = "amount" WHERE "baseAmount" IS NULL;--> statement-breakpoint
ALTER TABLE "income" ALTER COLUMN "baseAmount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "base_currency" varchar(3) DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "currency" varchar(3) DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exchangeRates_pair_asOf_source_uq" ON "exchangeRates" ("baseCurrency","quoteCurrency","asOf","source");