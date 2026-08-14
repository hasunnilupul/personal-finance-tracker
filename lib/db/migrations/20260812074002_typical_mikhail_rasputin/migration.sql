CREATE TABLE "budgets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "budgets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" text NOT NULL,
	"categoryId" integer NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"period" varchar(20) NOT NULL,
	"startDate" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
