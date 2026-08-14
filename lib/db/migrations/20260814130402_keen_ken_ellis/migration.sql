DROP INDEX "notifications_organizationId_userId_dedupeKey_key";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "organizationId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_userId_dedupeKey_key" UNIQUE NULLS NOT DISTINCT("organizationId","userId","dedupeKey");