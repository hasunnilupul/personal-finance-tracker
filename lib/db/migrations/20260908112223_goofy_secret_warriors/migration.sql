CREATE TABLE "savings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "savings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"categoryId" integer,
	"amount" numeric(12,2) NOT NULL,
	"currency" varchar(3) DEFAULT 'LKR' NOT NULL,
	"baseAmount" numeric(12,2) NOT NULL,
	"exchangeRate" numeric(20,10) DEFAULT '1' NOT NULL,
	"description" varchar(255),
	"date" timestamp NOT NULL,
	"liquidity" varchar(10) DEFAULT 'liquid' NOT NULL,
	"recurringId" integer,
	"organizationId" text NOT NULL,
	"createdBy" text,
	"updatedBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "liquidity" varchar(10);--> statement-breakpoint
CREATE INDEX "savings_organizationId_date_idx" ON "savings" ("organizationId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_recurring_occurrence_key" ON "savings" ("organizationId","recurringId","date");--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_categoryId_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_recurringId_recurringTransactions_id_fkey" FOREIGN KEY ("recurringId") REFERENCES "recurringTransactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_updatedBy_user_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;