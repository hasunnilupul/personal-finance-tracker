# FinanceFlow

A personal finance tracker for me and my family. Each member keeps a fully private
ledger, and can optionally create shared spaces for joint expenses.

## Stack

| Concern    | Choice                                     |
| ---------- | ------------------------------------------ |
| Framework  | Next.js 16 (App Router, Server Components) |
| UI         | Tailwind CSS 4 + shadcn/ui on Base UI      |
| Database   | Neon Postgres                              |
| ORM        | Drizzle ORM + drizzle-kit migrations       |
| Auth       | better-auth (email & password)             |
| Validation | Zod                                        |
| Hosting    | Vercel                                     |


## Demo

- URL: https://personal-finance-tracker-uicg-git-dev-hasun-nilupuls-projects.vercel.app
- email: demo@financeflow.com
- password: Password123!

## Getting started

```bash
pnpm install
cp .env.example .env   # then fill in the values
pnpm db:migrate        # apply migrations to your Neon branch
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

To load a demo user (`demo@financeflow.com` / `Password123!`) with sample
categories and expenses:

```bash
pnpm db:seed
```

> **Warning**: `db:seed` truncates every application table first. Never point it
> at the production database.

## Scripts

| Script             | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Start the dev server                                |
| `pnpm build`       | Production build                                    |
| `pnpm lint`        | ESLint (Prettier rules included)                    |
| `pnpm db:generate` | Generate a migration from schema changes            |
| `pnpm db:migrate`  | Apply pending migrations                            |
| `pnpm db:push`     | Push schema straight to the DB (local scratch only) |
| `pnpm db:seed`     | Reset and seed the database                         |

## Project layout

```
app/
  (auth)/        sign-in, sign-up
  (dashboard)/   authenticated app shell and pages
  actions/       server actions
  api/auth/      better-auth route handler
components/      UI components (ui/ holds shadcn primitives)
constants/       static app data, e.g. default categories
lib/
  auth/          better-auth server + client, the DAL, and RBAC policies
  db/            drizzle client, schema, models, migrations
  logger/        logger abstraction
  repositories/  data access, one per entity
  services/      business logic, called by pages and server actions
proxy.ts         route protection (optimistic session check only)
```

## Spaces

Every piece of financial data belongs to a **space**, never directly to a user.

- Each user gets a **personal space** automatically at sign-up. It is private
  and cannot be shared, left, or deleted.
- Any user can create **shared spaces** for joint expenses. Only the creator
  can invite people into one.
- Inside a shared space every member can add, edit and delete any entry —
  a household budget is only useful if everyone can correct it. Each row
  records `createdBy` and `updatedBy` so you can still see who did what.

Spaces are better-auth `organization` records, with `isPersonal` marking the
private one. The space in view is the session's `activeOrganizationId`.

### Joining

Sign-up is **invite only**. The owner of a shared space invites someone by
email from `/settings/members`, which produces a link to
`/accept-invitation/<id>`. If Resend is configured the link is also emailed;
either way it can be copied and sent by hand.

An email with no pending invitation cannot register at all — the check runs in
a database hook, so it covers every route into sign-up, not just the form. The
exception is the very first account in an empty database, which is allowed
through so a fresh deployment can be set up. Set `ALLOW_PUBLIC_SIGNUP=true` to
open registration to anyone.

### Money

Each space reports in a **base currency**, set at `/settings/space`. An entry
can be recorded in any supported currency; it stores what was actually spent
alongside what that was worth in the base currency **on the entry's own date**.
Totals sum the converted figure, so a later move in the exchange rate cannot
rewrite last month's spending.

Rates come from
[`@fawazahmed0/currency-api`](https://github.com/fawazahmed0/exchange-api) — no
API key, no quota, and it covers LKR, which the ECB-backed feeds do not. They
are cached per day in `exchangeRates`, refreshed by a daily cron and on demand
when a conversion misses. A row with `source = 'manual'` overrides the feed for
that day, which is the escape hatch when it is wrong or unavailable.

Amounts are Postgres `numeric`, not integer minor units — `numeric` is exact
decimal, so there is no floating-point error to work around.

### Roles

| Role     | Finance data | Invite / remove members | Delete space |
| -------- | ------------ | ----------------------- | ------------ |
| `owner`  | Full         | Yes                     | Yes          |
| `member` | Full         | No                      | No           |

Policies live in `lib/auth/permissions.ts`. Server Actions enforce them with
`requirePermission()`; hiding a button is presentation, not protection.

### Layering rules

Pages and Server Actions call **services**. Services call **repositories**.
Only repositories touch `db`.

Every query is scoped by `organizationId`, and that id comes from
`requireActiveSpace()` — which re-checks membership against the database on
every call — never from user input. `proxy.ts` is an optimistic check, not a
security boundary.

## Deployment

Pushes to `main` deploy to production on Vercel; every other branch gets a
preview deployment.

There are **two databases**. Production has its own; `main` is the only branch
that reaches it. Every other branch shares one development database with local
development.

Migrations follow from that. Against the development database you apply them
yourself with `pnpm db:migrate`, before the change is committed. Against
production nobody does — the production deploy does it, in its build:

```
pnpm run build:deploy   # scripts/migrate-on-deploy.ts, then next build
```

`vercel.json` points Vercel's build command at that script. It applies pending
migrations **only** when `VERCEL_ENV` is `production`, so a preview build never
migrates the database other branches are working against, and a failed
migration fails the build rather than promoting a deployment whose schema is
missing.

Production therefore needs **both** `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
in Vercel's Production environment, even though the running app only reads the
pooled one — drizzle-kit migrates over the direct connection. They must be the
two connections of the same endpoint; the check in `drizzle.config.ts` runs
inside the build and fails it if they are not.
