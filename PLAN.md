# Implementation plan

Working document for FinanceFlow. It records what is decided, what is done, and
what comes next, so work can resume without re-deciding anything.

**Update this file as part of the feature's own commit** — tick the boxes, move
the "Current position" marker, and add anything learned to Decisions or Gotchas.

---

## Current position

**Last completed:** Feature 5 — budgets. Pushed to `feat/budgets`,
PR #14 open into `dev`, awaiting the repo owner's merge.

**Next up:** Feature 6 — dashboard and reports.

| Branch | State                                                   |
| ------ | ------------------------------------------------------- |
| `main` | Production. Behind `dev` by Features 0 up to 4.         |
| `dev`  | Integration branch. Has Features 0, 1a, 1b, 2, 3 and 4. |

---

## Workflow

One feature per branch, one PR per feature. Follow this exactly — do not skip
to the next feature with a branch still unmerged.

**1. Start** — branch from the latest `origin/dev`:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/<feature-name>
```

**2. Build it.** Commit as you go. Update this file — tick the boxes, move
"Current position", add any new gotchas — as part of the feature's own commits.

**3. Finish** — bring `dev` in and resolve conflicts on the branch, never in
the PR:

```bash
git pull origin dev
pnpm typecheck && pnpm lint && pnpm build
```

**4. Open the PR** into `dev`, **before** switching away from the branch.

**5. Stop and ask for approval.** The repo owner merges. Do not start the next
feature, and do not create the next branch, until the PR is merged.

**6. Next** — go back to step 1, branching from the freshly merged `origin/dev`.

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

| Decision                 | Choice                                    | Why                                                                                    |
| ------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Spaces implementation    | better-auth `organization` plugin         | Members, invitations and roles come tested; a space is an organization                 |
| Personal space           | Auto-created at sign-up, `isPersonal`     | Uniform model — everything belongs to a space, so there is no nullable branch anywhere |
| Shared-space edit rights | Any member may edit or delete any entry   | A household budget is only useful if everyone can correct it                           |
| Attribution              | `createdBy` / `updatedBy` on every row    | Preserves "who did what" without locking rows down                                     |
| Invite delivery          | Copyable link, with Resend email on top   | The link is the mechanism and needs no infrastructure; email is a convenience layer    |
| Data access              | Server Actions; route handlers as needed  | Least boilerplate in Next 16                                                           |
| Validation               | Zod at the Server Action boundary         | Untrusted input is parsed once, at the edge                                            |
| Category deletion        | Reassign, or refused while in use         | Deleting a category must not silently destroy spending history                         |
| Category `type`          | Fixed once created                        | Flipping it would strand every entry filed under it in a list that no longer offers it |
| Budget periods           | Calendar-aligned, nothing materialised    | Rollover becomes free — the window moves on its own, with no cron and no period rows   |
| Budget amounts           | Space base currency, no `currency` column | They are compared against `baseAmount` sums; anything else converts one side each time |
| Budget `startDate`       | Derived from the clock, never from input  | A client-supplied start is a way to backdate a limit over spending already recorded    |
| Package manager          | pnpm                                      |                                                                                        |

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

**Space scoping.** Services take a `SpaceContext` (`organizationId`, `userId`,
`baseCurrency`) and fill in `organizationId`, `createdBy`, `updatedBy`,
`baseAmount` and `exchangeRate` themselves. Callers never supply them — see
`UserInput<T>` in `lib/db/models/types.ts`. Accepting a converted amount from a
client would let it claim any exchange rate it liked.

**Migrations.** `pnpm db:generate` then review the SQL before applying.
drizzle-kit 1.0-rc asks for `--hints` on ambiguous rename-vs-create; pass
`{"type":"create",...}` for genuinely new columns. Never let `pnpm format`
touch `lib/db/migrations` (covered by `.prettierignore`).

**Dates.** A transaction date is a calendar day held in a `timestamp` column.
Everything that writes one anchors it to **midday UTC**, and range filters use
whole UTC days. Anchoring to local midnight puts an entry made in Colombo on
the previous UTC day, which silently drops it out of ranges that should
contain it — this was a real bug, caught by a filter returning the wrong rows.

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

### Feature 1a — Spaces and RBAC ✅ merged (PR #7)

- [x] `organization` / `member` / `invitation` tables, `session.activeOrganizationId`
- [x] Re-scope all six domain tables from `userId` to `organizationId`, with audit columns
- [x] RBAC policies in `lib/auth/permissions.ts` (`owner`, `member`)
- [x] Personal space auto-created at sign-up, seeded with default categories
- [x] `requireActiveSpace()` / `requirePermission()`
- [x] Space switcher and create-space form
- [x] Migration applied, seed rewritten
- [x] Verified: isolation, switching, and tampered `activeOrganizationId` falling back

### Feature 1b — Invitations and invite-only sign-up ✅ merged (PR #10)

- [x] Invite from the space owner, producing a **copyable link** (`/accept-invitation/[id]`)
- [x] Resend email as a layer on top: sends when `RESEND_FROM` is set, logs and skips when not
- [x] `/settings/members` — members, pending invites, withdraw, remove, leave
- [x] Accept-invitation page, handling signed-out, wrong-account, expired and used cases
- [x] **Public sign-up closed**: rejected without a pending invitation, behind
      `ALLOW_PUBLIC_SIGNUP`, with a first-user bootstrap so a fresh deployment works
- [x] Leave-space flow, blocked for the personal space
- [x] Verified: uninvited sign-up 403s and writes no row; invited address can register,
      accept, and see shared data; member cannot invite or remove

Deferred, not needed yet: changing a member's role. There are only two roles and
the owner is the creator, so there is nothing meaningful to change it to.

### Feature 2 — Currency and money handling ✅ merged (PR #11)

- [x] Base currency per space, plus a per-entry currency
- [x] `exchangeRates` table with on-demand fetch, daily cron, and manual override
- [x] Conversion at **write** time into `baseAmount`, so totals do not shift when rates move
- [x] `formatMoney` / `parseAmount`; amounts stay Postgres `numeric`, not integer minor units
- [x] Backfill: existing rows converted to themselves at rate 1, non-destructively
- [x] Changing a space's base currency re-converts history at each entry's own date

**Rate source decided:** `@fawazahmed0/currency-api` over jsDelivr, with its
`pages.dev` mirror as fallback. No API key, no quota (static JSON on a CDN),
338 currencies including LKR. ECB-backed feeds were ruled out — no LKR.
Swapping it is a one-file change behind `RateProvider`.

**Money storage decided:** stay on `numeric(12,2)`. Postgres `numeric` is exact
decimal, so there is no floating-point error to design around, and integer
minor units would have cost a destructive migration for no gain.

### Feature 3 — Transactions (expenses + income) ✅ merged (PR #12)

- [x] List with filters (date range, category, member) and pagination
- [x] Add / edit / delete, zod-validated Server Actions
- [x] Income as a sibling view, sharing every component via a `kind` prop
- [x] `createdBy` shown in shared spaces only
- [x] Empty, filtered-empty and loading states
- [x] Per-entry currency picker; foreign amounts show the original under the converted one
- [x] Default income categories, so the income picker is not empty

**Filters live in the URL**, so a filtered view can be bookmarked and the page
stays a Server Component. Junk query values are ignored rather than trusted.

**Expenses and income share one query, one form and one action set**, keyed by
`TransactionKind`. The tables are structurally identical, so duplicating would
mean fixing every future filter twice.

### Feature 4 — Categories ✅ merged (PR #13)

- [x] `/settings/categories` — manage categories per space, with icon and colour pickers
- [x] Income vs expense shown as two sections on one page, each with its own add button
- [x] Reassign entries before deleting a category, or refuse the delete
- [x] Usage counts per category, so a row says what deleting it would cost
- [x] Restore the defaults for a type whose list has been emptied
- [x] Verified against the database: usage counts, refusals, reassignment and cleanup

**Icons and colours are fixed grids**, not a searchable picker. A household
needs a couple of dozen recognisable symbols; a full emoji picker would be a
dependency and a lot of UI for no gain. The field still stores any string, so a
pasted emoji works.

**A category's `type` cannot be edited.** Switching an expense category to
income would strand every entry filed under it in a list that no longer offers
it. Delete-and-reassign is the supported path.

**Usage is counted across four tables**, not two. `budgets` and
`recurringTransactions` carry a `categoryId` as well, and budgets **cascade** —
deleting a category deletes its budgets outright rather than nulling them. The
delete dialog calls that out separately, because it is the part a reassignment
cannot save. `CategoryUsageRepository` holds the list of referencing tables so
a fifth one is added in one place.

**Counts are advisory, the service is authoritative.** The manage screen
renders counts from one grouped query per table, but `deleteCategory` re-checks
at write time. A count that goes stale between render and click cannot cost
anyone their history — the delete is refused and the dialog refreshes itself.

### Feature 5 — Budgets ✅ done, PR #14 open

- [x] Monthly and yearly budgets per category
- [x] Progress against actual spend; over-budget indicator
- [x] Roll over period boundaries correctly
- [x] `/budgets` — both period types as two sections, one set of month arrows
- [x] Changing a space's base currency re-expresses the limits too
- [x] Verified against the database: progress arithmetic, refusals, rollover and re-anchoring

**Periods are calendar-aligned, and nothing is materialised.** A monthly budget
runs the calendar month whatever day it was created, so rollover costs nothing
— no cron, no per-period rows. On the first of the month the window moves on
its own. A row is a standing limit; `startDate` records only the period it took
effect from, and the window being viewed supplies the rest.

**One grouped spend query per period type**, not one per budget, so thirty
budgets cost what three do. `sumBaseAmountByCategory` lives in
`transaction-query.ts` because the reports in Feature 6 will want the same
shape.

**A limit is held in the space's base currency**, with no `currency` column of
its own — it is compared against `baseAmount` sums, so anything else would mean
converting one side of every comparison. Changing the base currency re-expresses
the limits **at today's rate**, unlike entries, which are re-converted at their
own date. A limit is a forward-looking intention rather than a record of what
something cost, so what it is worth now is the figure that matters.

**`startDate` is the service's to set, never the client's.** Accepting one from
the form would be a way to backdate a limit over spending that already happened.
For the same reason a budget only applies from its own period onwards, and the
add button is hidden while a past window is on screen — a limit created there
would not appear on the screen that created it.

**The unique index is the real guard** against two limits on one category and
period; the service's check exists to produce a sentence rather than a
constraint error, and would otherwise lose a race.

### Feature 6 — Dashboard and reports ⬅️ next

- [ ] Dashboard: month totals, recent entries, budget health
- [ ] Reports: spend by category, trend over time, income vs expense
- [ ] Date-range picker

### Feature 7 — Savings goals and recurring transactions

- [ ] Savings goals with progress and deadlines
- [ ] Recurring templates materialised into real entries when due
- [ ] Decide the trigger: cron route vs on-read catch-up

---

## Environment

| Variable                | Needed for        | Notes                                           |
| ----------------------- | ----------------- | ----------------------------------------------- |
| `BETTER_AUTH_SECRET`    | Auth              | `openssl rand -base64 32`                       |
| `BETTER_AUTH_URL`       | Auth              | App base URL                                    |
| `DATABASE_URL`          | Runtime           | Pooled Neon connection                          |
| `DATABASE_URL_UNPOOLED` | Migrations        | Direct connection for drizzle-kit               |
| `RESEND_API_KEY`        | Invite email      | Set                                             |
| `RESEND_FROM`           | Invite email      | **Not set.** Needs a domain verified in Resend  |
| `ALLOW_PUBLIC_SIGNUP`   | Sign-up gate      | Defaults to `false`                             |
| `CRON_SECRET`           | Rate refresh cron | **Not set.** Endpoint refuses to run without it |

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
- **`import "server-only"` breaks the seed script.** Anything reachable from
  `lib/auth/auth.ts` is also imported by `scripts/seed.ts`, and outside Next's
  bundler that package throws on import. Keep it in `lib/auth/dal.ts`, which
  scripts never reach, and out of the `auth.ts` import graph.
- **The rate feed only publishes today.** An entry backdated before rate
  collection began has nothing to look back to, so `getRate` falls forward to
  the earliest rate on record and logs that it approximated. Without this,
  saving a backdated expense fails outright.
- **The HTTP database driver has no interactive transactions.** Multi-step
  writes have to compute everything that can fail _before_ writing anything —
  see `changeBaseCurrency`.
- **`react-hooks/set-state-in-effect` will fail lint** for resetting a
  dialog's fields when the record changes. Remount the form with a `key`
  instead of syncing state in an effect.
- **`pnpm db:seed` truncates `session`,** so any browser or curl session is
  signed out and pages start answering 307. Sign in again after seeding.
- **`BETTER_AUTH_URL` is `http://localhost:3001`,** so `next dev` on the default
  3000 makes better-auth reject every sign-in with `INVALID_ORIGIN`. Run
  `pnpm dev --port 3001`, or change the variable — not one and not the other.
- **The Select reports "nothing chosen" as `null`, not `""`.** Its
  `onValueChange` is typed `string | null`, so backing it with a `useState<string>`
  fails to typecheck.
- **better-auth blocks removing the only owner** before it checks role
  permissions, so that path returns a confusing "cannot leave as the only
  owner" message rather than a permission error. It still denies the action.

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
- [ ] No tests yet. Worth adding around permissions, space scoping and currency
      conversion first.
- [ ] `expenses` and `income` are structurally identical tables. A single
      `transactions` table with a `type` column would have been simpler; the
      shared query and service layer hide most of the cost, so this is only
      worth revisiting if a third kind ever appears.
- [ ] Reassigning a category updates four tables in four statements with no
      transaction to wrap them (the HTTP driver has none). A failure part-way
      leaves some rows moved and the category still present. Recoverable —
      every moved row points at a valid same-type category and the delete can
      be retried — but a `transactions` table would reduce it to two.
- [ ] Changing a space's base currency writes entries and budget limits as
      parallel un-transacted statements, for the same missing-transaction
      reason. Every conversion is computed before anything is written, so a
      failure is a partial write rather than a wrong one — but a partial write
      leaves the space holding a mix of old-currency and new-currency amounts,
      with the space's own `baseCurrency` already switched, so nothing on screen
      says which row is in which. Worse than the reassign case, which stays
      internally consistent throughout. Re-running the change would convert the
      already-converted rows a second time, so recovery is manual. Second
      instance of this pattern; worth one shared answer — a batched multi-
      statement write, or a per-row marker that makes a re-run idempotent.
- [ ] Domain tables use camelCase column names while better-auth tables use
      snake_case. Consistent within each, inconsistent across.
