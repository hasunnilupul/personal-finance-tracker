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
preview deployment. Migrations are applied manually with `pnpm db:migrate`.
