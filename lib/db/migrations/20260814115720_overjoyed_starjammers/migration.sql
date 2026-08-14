CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"type" varchar(40) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" varchar(400) NOT NULL,
	"href" varchar(255),
	"dedupeKey" varchar(160) NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_userId_organizationId_createdAt_idx" ON "notifications" ("userId","organizationId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_organizationId_userId_dedupeKey_key" ON "notifications" ("organizationId","userId","dedupeKey");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_organization_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;