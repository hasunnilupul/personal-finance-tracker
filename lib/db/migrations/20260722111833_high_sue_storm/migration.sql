CREATE TABLE "income" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "income_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" text NOT NULL,
	"categoryId" integer NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"description" varchar(255),
	"date" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savingsGoals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "savingsGoals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"targetAmount" numeric(12,2) NOT NULL,
	"currentAmount" numeric(12,2) DEFAULT '0' NOT NULL,
	"deadline" timestamp,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurringTransactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recurringTransactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" text NOT NULL,
	"categoryId" integer NOT NULL,
	"type" varchar(10) NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"description" varchar(255),
	"frequency" varchar(20) NOT NULL,
	"nextDate" timestamp NOT NULL,
	"isActive" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" text NOT NULL,
	"categoryId" integer NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"description" varchar(255),
	"date" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" text NOT NULL,
	"name" varchar(50) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"color" varchar(7) NOT NULL,
	"type" varchar(10) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
