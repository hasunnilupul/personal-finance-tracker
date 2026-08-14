-- Financial data moves from being owned by a user to being owned by a space.
-- There is no way to derive a space for rows that predate the change, and the
-- new "organizationId" is NOT NULL, so existing rows must go. This was checked
-- against the database before the migration was written: the only rows present
-- were the demo seed (1 user, 6 categories, 8 expenses). Re-create them with
-- `pnpm db:seed`.
DELETE FROM "expenses";--> statement-breakpoint
DELETE FROM "income";--> statement-breakpoint
DELETE FROM "budgets";--> statement-breakpoint
DELETE FROM "recurringTransactions";--> statement-breakpoint
DELETE FROM "savingsGoals";--> statement-breakpoint
DELETE FROM "categories";--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"metadata" text,
	"is_personal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "savingsGoals" ADD COLUMN "organizationId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "savingsGoals" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "savingsGoals" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "savingsGoals" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "income" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "recurringTransactions" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "savingsGoals" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "categoryId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "categoryId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "income" ALTER COLUMN "categoryId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ALTER COLUMN "categoryId" DROP NOT NULL;--> statement-breakpoint
-- Postgres has no implicit integer -> boolean cast, and the old `DEFAULT 1`
-- cannot survive the retype, so drop it, convert explicitly, then restore it.
ALTER TABLE "recurringTransactions" ALTER COLUMN "isActive" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ALTER COLUMN "isActive" SET DATA TYPE boolean USING ("isActive" <> 0);--> statement-breakpoint
ALTER TABLE "recurringTransactions" ALTER COLUMN "isActive" SET DEFAULT true;--> statement-breakpoint
CREATE INDEX "budgets_organizationId_idx" ON "budgets" ("organizationId");--> statement-breakpoint
CREATE INDEX "budgets_categoryId_idx" ON "budgets" ("categoryId");--> statement-breakpoint
CREATE INDEX "categories_organizationId_idx" ON "categories" ("organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_organizationId_name_type_uq" ON "categories" ("organizationId","name","type");--> statement-breakpoint
CREATE INDEX "expenses_organizationId_date_idx" ON "expenses" ("organizationId","date");--> statement-breakpoint
CREATE INDEX "expenses_categoryId_idx" ON "expenses" ("categoryId");--> statement-breakpoint
CREATE INDEX "income_organizationId_date_idx" ON "income" ("organizationId","date");--> statement-breakpoint
CREATE INDEX "income_categoryId_idx" ON "income" ("categoryId");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_organizationId_userId_uq" ON "member" ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "recurringTransactions_organizationId_idx" ON "recurringTransactions" ("organizationId");--> statement-breakpoint
CREATE INDEX "recurringTransactions_nextDate_idx" ON "recurringTransactions" ("nextDate");--> statement-breakpoint
CREATE INDEX "savingsGoals_organizationId_idx" ON "savingsGoals" ("organizationId");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_updatedBy_user_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_updatedBy_user_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updatedBy_user_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_categoryId_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_updatedBy_user_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD CONSTRAINT "recurringTransactions_categoryId_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD CONSTRAINT "recurringTransactions_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD CONSTRAINT "recurringTransactions_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "recurringTransactions" ADD CONSTRAINT "recurringTransactions_updatedBy_user_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "savingsGoals" ADD CONSTRAINT "savingsGoals_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "savingsGoals" ADD CONSTRAINT "savingsGoals_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "savingsGoals" ADD CONSTRAINT "savingsGoals_updatedBy_user_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON DELETE SET NULL;