# Implementation plan

Working document for FinanceFlow. It records what is decided, what is done, and
what comes next, so work can resume without re-deciding anything.

**Update this file as part of the feature's own commit** — tick the boxes, move
the "Current position" marker, and add anything learned to Decisions or Gotchas.

---

## Current position

**Last completed:** Feature 1a — spaces + RBAC. Pushed to
`feat/spaces-and-rbac`, awaiting PR into `dev`.

**Next up:** Feature 1b — invitations and invite-only sign-up.

| Branch                 | State                                   |
| ---------------------- | --------------------------------------- |
| `main`                 | Production. Behind `dev`.               |
| `dev`                  | Integration branch. Has Feature 0.      |
| `feat/spaces-and-rbac` | Feature 1a, pushed, needs PR into `dev` |

---

## Product shape

A personal finance tracker for one family. Simple and efficient over
feature-rich.

- Every user has a **private personal space**, created at sign-up, that nobody
  else can ever see.
- Users can create any number of **shared spaces** for joint expenses. Only the
  creator of a shared space can invite people into it.
- Sign-up is **invite-only** for now, with a flag to open it up later.
- Amounts are **multi-currency with conversion**.

---

## Decisions

Locked in. Revisit only with a reason — and note the reason here.

| Decision                 | Choice                                   | Why                                                                                    |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Spaces implementation    | better-auth `organization` plugin        | Members, invitations and roles come tested; a space is an organization                 |
| Personal space           | Auto-created at sign-up, `isPersonal`    | Uniform model — everything belongs to a space, so there is no nullable branch anywhere |
| Shared-space edit rights | Any member may edit or delete any entry  | A household budget is only useful if everyone can correct it                           |
| Attribution              | `createdBy` / `updatedBy` on every row   | Preserves "who did what" without locking rows down                                     |
| Invite delivery          | Copyable link, with Resend email on top  | The link is the mechanism and needs no infrastructure; email is a convenience layer    |
| Data access              | Server Actions; route handlers as needed | Least boilerplate in Next 16                                                           |
| Validation               | Zod at the Server Action boundary        | Untrusted input is parsed once, at the edge                                            |
| Category deletion        | Refused while in use; FK is `SET NULL`   | Deleting a category must not silently destroy spending history                         |
| Package manager          | pnpm                                     |                                                                                        |

---

## Conventions

**Layering.** Pages and Server Actions call services. Services call
repositories. Only repositories touch `db`. No exceptions — it is what keeps
space scoping in one place.

**Authorization.** One entry point: `lib/auth/dal.ts`.

- `requireUser()` — must be signed in.
- `requireActiveSpace()` — resolves the space and re-checks membership against
  the database every call. The session's `activeOrganizationId` is a hint, not
  proof.
- `requirePermission({ resource: ["action"] })` — checks the RBAC policy in
  `lib/auth/permissions.ts`.

`proxy.ts` is an optimistic check for redirects only. It is **not** a security
boundary. Hiding a button is presentation, not protection.

**Space scoping.** Services take a `SpaceContext` (`organizationId` + `userId`)
and fill in `organizationId`, `createdBy` and `updatedBy` themselves. Callers
never supply them — see `UserInput<T>` in `lib/db/models/types.ts`.

**Migrations.** `pnpm db:generate` then review the SQL before applying.
drizzle-kit 1.0-rc asks for `--hints` on ambiguous rename-vs-create; pass
`{"type":"create",...}` for genuinely new columns. Never let `pnpm format`
touch `lib/db/migrations` (covered by `.prettierignore`).

**Definition of done.** `pnpm typecheck && pnpm lint && pnpm build` all pass,
plus the feature exercised against the real database — not just compiled.

---

## Roadmap

### Feature 0 — Foundation fixes ✅ merged (PR #6)

- [x] Export `budgets` from the schema barrel and generate its missing migration
- [x] Fix the `/dashboard` redirect loop and add the missing `/sign-up` page
- [x] Preserve the intended destination through sign-in, guarded against open redirect
- [x] Add `lib/auth/dal.ts`, zod, `server-only`
- [x] Drop dotenv from the app runtime
- [x] Fix the seed (truncated 5 of 10 tables; early return skipped seeding)
- [x] Format the shadcn components; add `lint:fix`, `format`, `typecheck` scripts
- [x] `.env.example` and a real README

### Feature 1a — Spaces and RBAC ✅ done, awaiting PR

- [x] `organization` / `member` / `invitation` tables, `session.activeOrganizationId`
- [x] Re-scope all six domain tables from `userId` to `organizationId`, with audit columns
- [x] RBAC policies in `lib/auth/permissions.ts` (`owner`, `member`)
- [x] Personal space auto-created at sign-up, seeded with default categories
- [x] `requireActiveSpace()` / `requirePermission()`
- [x] Space switcher and create-space form
- [x] Migration applied, seed rewritten
- [x] Verified: isolation, switching, and tampered `activeOrganizationId` falling back

### Feature 1b — Invitations and invite-only sign-up ⬅️ next

- [ ] `POST` invite from the space owner, producing a **copyable link** (`/accept-invitation/[id]`)
- [ ] Resend email as a layer on top: sends when `RESEND_FROM` is set, logs and skips when not
- [ ] `/settings/members` — list members, pending invites, revoke, remove, change role
- [ ] Accept-invitation page, handling signed-in, signed-out, and wrong-account cases
- [ ] **Close public sign-up**: reject registration without a valid pending invitation,
      behind `ALLOW_PUBLIC_SIGNUP` (default `false`)
- [ ] Leave-space flow, blocked for the personal space
- [ ] Verify: invited user joins the right space, sees its data, and cannot invite others

> Sign-up is currently **open** on the deployed app. This feature closes it.

### Feature 2 — Currency and money handling

- [ ] Currency per space, plus a per-entry currency
- [ ] `exchange_rates` table with a daily fetch and manual override
- [ ] Convert to the space's base currency for all totals and reports
- [ ] Money formatting helper; decide rounding rules and store minor units consistently
- [ ] Backfill existing rows to the space's base currency

Open question: rate source. Needs one covering LKR — ECB/Frankfurter does not.

### Feature 3 — Transactions (expenses + income)

- [ ] Expenses list with filters (date range, category, member) and pagination
- [ ] Add / edit / delete dialogs, zod-validated Server Actions
- [ ] Income as a sibling view
- [ ] Show `createdBy` in shared spaces
- [ ] Empty and loading states

### Feature 4 — Categories

- [ ] Manage categories per space, icon and colour pickers
- [ ] Income vs expense types
- [ ] Reassign entries before deleting a category

### Feature 5 — Budgets

- [ ] Monthly and yearly budgets per category
- [ ] Progress against actual spend; over-budget indicator
- [ ] Roll over period boundaries correctly

### Feature 6 — Dashboard and reports

- [ ] Dashboard: month totals, recent entries, budget health
- [ ] Reports: spend by category, trend over time, income vs expense
- [ ] Date-range picker

### Feature 7 — Savings goals and recurring transactions

- [ ] Savings goals with progress and deadlines
- [ ] Recurring templates materialised into real entries when due
- [ ] Decide the trigger: cron route vs on-read catch-up

---

## Environment

| Variable                | Needed for        | Notes                                          |
| ----------------------- | ----------------- | ---------------------------------------------- |
| `BETTER_AUTH_SECRET`    | Auth              | `openssl rand -base64 32`                      |
| `BETTER_AUTH_URL`       | Auth              | App base URL                                   |
| `DATABASE_URL`          | Runtime           | Pooled Neon connection                         |
| `DATABASE_URL_UNPOOLED` | Migrations        | Direct connection for drizzle-kit              |
| `RESEND_API_KEY`        | Invite email      | Set                                            |
| `RESEND_FROM`           | Invite email      | **Not set.** Needs a domain verified in Resend |
| `ALLOW_PUBLIC_SIGNUP`   | Sign-up gate (1b) | Defaults to `false`                            |

**On `RESEND_FROM`:** Resend only sends from a domain you have verified via DNS.
`onboarding@resend.dev` works with no setup but delivers **only** to the Resend
account's own address, so it cannot reach family members. A `*.vercel.app`
domain cannot be verified — you do not control its DNS. Until a real domain is
verified, invites work by copying the link.

---

## Gotchas

Things already hit, so they are not hit twice.

- **drizzle-kit 1.0-rc needs `--hints`** for ambiguous column changes, and
  exits 2 without them.
- **Postgres will not cast integer to boolean** with `::boolean`. Use
  `USING (col <> 0)`, and drop the old default first.
- **better-auth rejects requests with no `Origin` header** (`MISSING_OR_NULL_ORIGIN`).
  Testing endpoints with curl needs `-H "Origin: http://localhost:PORT"`.
- **`createOrganization` activates the new space** immediately.
- **The `neon_auth` schema in the database is not ours.** It is an unused Neon
  Auth integration sitting alongside `public`. Consider disabling it in Neon.
- **shadcn's CLI prompts to overwrite existing components** even with `--yes`.
  Add components one at a time and check `git status` afterwards.
- **`next dev` survives killing the pnpm wrapper.** If a port is stuck, kill the
  `next-server` PID directly.
- **The logger only emits warn/error in production.** Info and debug are
  suppressed there by design.

---

## Known follow-ups

Not blocking, but worth doing.

- [ ] `pnpm-lock.yaml` is git-ignored, so Vercel resolves dependencies fresh on
      every build. With `drizzle-orm` on a release candidate, an unpinned
      transitive bump can break a deploy with no code change. Commit the lockfile.
- [ ] GitHub reports 40 Dependabot vulnerabilities (19 high) on the default branch.
- [ ] `@better-auth/drizzle-adapter` declares a peer of `drizzle-orm@^0.45.2`
      against the installed `1.0.0-rc.4`. Works today; suspect it first if auth
      behaves oddly.
- [ ] No tests yet. Worth adding around permissions and space scoping first.
- [ ] Domain tables use camelCase column names while better-auth tables use
      snake_case. Consistent within each, inconsistent across.
