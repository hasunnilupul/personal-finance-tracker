ALTER TABLE "expenses" ADD COLUMN "recurringId" integer;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "recurringId" integer;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "startDate" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "endDate" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_recurring_occurrence_key" ON "expenses" ("organizationId","recurringId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "income_recurring_occurrence_key" ON "income" ("organizationId","recurringId","date");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurringId_recurringTransactions_id_fkey" FOREIGN KEY ("recurringId") REFERENCES "recurringTransactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_recurringId_recurringTransactions_id_fkey" FOREIGN KEY ("recurringId") REFERENCES "recurringTransactions"("id") ON DELETE SET NULL;