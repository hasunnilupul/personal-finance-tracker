# Implementation plan

Working document for FinanceFlow. It records what is decided, what is done, and
what comes next, so work can resume without re-deciding anything.

**Update this file as part of the feature's own commit** — tick the boxes, move
the "Current position" marker, and add anything learned to Decisions or Gotchas.

---

## Current position

**Last completed:** Cleared the Dependabot advisories — 40 down to 0, verified
by `pnpm audit` on both the full and the production-only tree. On
`chore/security-advisories`, ready to push and open a PR into `dev`.

**Next up:** Nothing on the roadmap. The Known follow-ups below are what is
left, and none of them is urgent now the advisories are cleared.

| Branch | State                                                                  |
| ------ | ---------------------------------------------------------------------- |
| `main` | Production. Behind `dev` by Features 0 up to 7.                        |
| `dev`  | Integration branch. Has Features 0, 1a, 1b, 2, 3, 4, 5, 6, 7, and #19. |

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

| Decision                 | Choice                                    | Why                                                                                      |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Spaces implementation    | better-auth `organization` plugin         | Members, invitations and roles come tested; a space is an organization                   |
| Personal space           | Auto-created at sign-up, `isPersonal`     | Uniform model — everything belongs to a space, so there is no nullable branch anywhere   |
| Shared-space edit rights | Any member may edit or delete any entry   | A household budget is only useful if everyone can correct it                             |
| Attribution              | `createdBy` / `updatedBy` on every row    | Preserves "who did what" without locking rows down                                       |
| Invite delivery          | Copyable link, with Resend email on top   | The link is the mechanism and needs no infrastructure; email is a convenience layer      |
| Data access              | Server Actions; route handlers as needed  | Least boilerplate in Next 16                                                             |
| Validation               | Zod at the Server Action boundary         | Untrusted input is parsed once, at the edge                                              |
| Category deletion        | Reassign, or refused while in use         | Deleting a category must not silently destroy spending history                           |
| Category `type`          | Fixed once created                        | Flipping it would strand every entry filed under it in a list that no longer offers it   |
| Budget periods           | Calendar-aligned, nothing materialised    | Rollover becomes free — the window moves on its own, with no cron and no period rows     |
| Budget amounts           | Space base currency, no `currency` column | They are compared against `baseAmount` sums; anything else converts one side each time   |
| Budget `startDate`       | Derived from the clock, never from input  | A client-supplied start is a way to backdate a limit over spending already recorded      |
| Charts                   | Hand-rolled CSS/SVG, no chart library     | Three chart shapes do not pay for a dependency, and the marks are already CSS            |
| Chart colour             | Two validated tokens, checked not chosen  | The existing `--chart-*` are a grey ramp; a series pair has to clear CVD and contrast    |
| Recurring trigger        | On-read catch-up; cron as an accelerator  | `CRON_SECRET` is unset, so a cron-only sweep would never fire in this deployment         |
| Recurring idempotency    | Unique `(org, recurringId, date)` key     | No interactive transactions, so a retry must be a no-op rather than a duplicate          |
| Occurrence dates         | Measured from `startDate`, not stepped    | Stepping from the last one makes a month-end clamp permanent — the 31st becomes the 28th |
| Savings goals            | A target, not an account; no money moves  | Keeps one place for money to live; a contribution marks intent, not a transfer           |
| Package manager          | pnpm                                      |                                                                                          |

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

**Dependencies.** `pnpm-lock.yaml` is committed, so a deploy installs the tree
that was tested rather than re-resolving it. That makes the lockfile part of
any change that touches `package.json` — run `pnpm install` and commit both
together, or a CI install with `--frozen-lockfile` fails. Prettier is told to
leave it alone, for the same reason it leaves migrations alone.

**Transitive security fixes go in `pnpm.overrides`**, keyed by the range they
replace (`nanoid@^3.0.0`, not bare `nanoid`) so a package that legitimately
wants a different major is not dragged along with it. `brace-expansion` carries
two entries for exactly that reason — v1 and v5 are both in the tree and each
needed its own patched version. Check an override still does something before
keeping it: once the direct dependency catches up, the entry is a no-op that
pins the tree for no reason. `pnpm why <pkg>` and the resolved versions in
`pnpm-lock.yaml` are how to tell.

**Migrations.** `pnpm db:generate` then review the SQL before applying.
drizzle-kit 1.0-rc asks for `--hints` on ambiguous rename-vs-create; pass
`{"type":"create",...}` for genuinely new columns. Never let `pnpm format`
touch `lib/db/migrations` (covered by `.prettierignore`).

**Dates.** A transaction date is a calendar day held in a `timestamp` column.
Everything that writes one anchors it to **midday UTC**, and range filters use
whole UTC days. Anchoring to local midnight puts an entry made in Colombo on
the previous UTC day, which silently drops it out of ranges that should
contain it — this was a real bug, caught by a filter returning the wrong rows.

**Testing.** `pnpm test` (Vitest). Unit tests live beside the code they cover as
`*.test.ts`.

- **Nothing in the suite touches the database.** Repositories are mocked at the
  module boundary, so it runs offline, in CI, and against no shared state. The
  placeholder `DATABASE_URL` in `vitest.config.mts` exists only because
  `lib/db` builds a client at import time; a test that reaches a real query
  fails loudly, which is the signal wanted — it means a repository was left
  unmocked.
- **What is worth testing here is the domain logic**: the RBAC policy, space
  scoping, currency conversion, and the date arithmetic behind budgets,
  reports and recurring entries. Those are the parts where being wrong is
  quiet. Components are not tested; a broken button is loud.
- **Assert the refusals, not just the happy path.** A policy test that only
  checks what is allowed passes just as well against a policy that allows
  everything.

**Definition of done.** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
all pass, plus the feature exercised against the real database — not just
compiled. The suite covers the logic; it does not prove a page renders or that
a migration applies.

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

### Feature 5 — Budgets ✅ merged (PR #14)

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

### Feature 6 — Dashboard and reports ✅ merged (PR #16)

- [x] Dashboard: month totals, recent entries, budget health
- [x] Reports: spend by category, trend over time, income vs expense
- [x] Date-range picker, with presets before a custom range
- [x] Every chart has a table twin and a keyboard path to the same figures
- [x] Verified against the database: totals reconcile, junk ranges fall back, income path exercised

**Both pages are compositions, not a new layer.** The dashboard's "spent this
month" is the same window the budgets page measures against, and its budget
bars are `budgetService.getOverview` reused whole; the recent list is the
transaction list asked for one short page. A second way to compute the month's
spend would eventually disagree with the first — verified by a check that the
dashboard tile and the reports page report the same figure for the same month.

**The dashboard has no range control and the reports page does.** "Where am I
right now" is the dashboard's whole question; a dashboard that scrolls into the
past is the reports page with fewer features.

**Two grouped queries carry the reports page**, `sumByCategoryWithNames` and
`sumByMonth`, both taking the same `TransactionFilters` the list uses so a
report range and a list filter narrow identically. `sumByMonth` buckets with
`to_char` on the stored value: the column is `timestamp without time zone` and
every date is anchored to midday UTC, so no timezone conversion is in the way.

**The breakdown keeps the uncategorised bucket**, unlike the budgets query it
sits beside. Budgets can ignore it — no limit can point at it — but a report
that dropped it would print parts that do not add up to the total beside them.
A check asserts the breakdown and the monthly buckets each sum to the headline.

**Chart colour is two validated tokens, not a taste call.** `--viz-income` and
`--viz-expense` are a categorical pair checked against the app's own card
surfaces: worst-case deutan ΔE 9.2 light / 9.4 dark and normal-vision 27.6 /
26.5, against floors of 8 and 15. The existing `--chart-1..5` are a grey
lightness ramp and cannot tell two series apart. Light-mode aqua measures
2.82:1, under the 3:1 bar, which is **why** every chart ships visible labels
and a `details` table twin rather than leaning on the fill.

**Spending by category is one series, so one colour.** Shading each bar by its
own size would encode length twice; tinting by the category's own colour would
imply the hues mean something. Identity comes from the icon and name beside the
bar. Bars scale against the largest category, not the total, so the ranking
stays visible when one category dominates — the share of the total is printed
beside each one so the two readings cannot be confused.

**Income and expenses share one axis.** Both are amounts in the same currency,
so the comparison is real; a second y-axis would let the two be slid against
each other until they told whatever story was wanted.

### Feature 7 — Savings goals and recurring transactions ✅ done, PR #17 open

- [x] Savings goals with progress and deadlines
- [x] Recurring templates materialised into real entries when due
- [x] Trigger decided: **on-read catch-up**, with the cron route as an accelerator
- [x] `/goals` — targets, contributions, and what to put aside each month
- [x] `/recurring` — templates, pause and resume, and a manual "run now"
- [x] Verified against the database, including crash-replay and concurrent runs

**The trigger is on-read catch-up.** `CRON_SECRET` is unset, so a cron-only
sweep would never fire — the feature would silently do nothing in this
deployment. The dashboard and `/recurring` catch up before they read, which is
the guarantee; `/api/cron/materialise-recurring` is an accelerator for spaces
nobody has opened, and refuses to run without the secret exactly as the rate
refresh does. This mirrors the decision already made for exchange rates: fetch
on demand, cron as a safety net.

**Materialisation is idempotent, and that is what makes the rest safe.**
`expenses` and `income` carry a `recurringId`, with a unique index on
`(organizationId, recurringId, date)` — the occurrence key. The HTTP driver has
no interactive transactions, so writing the entry and advancing `nextDate`
cannot be atomic; the order is deliberately **entry first**, because advancing
first would lose an occurrence outright if the insert then failed, while
creating first can at worst repeat, and the key turns a repeat into a no-op.
Verified: a simulated crash between the two writes replays without duplicating,
and ten page loads including four concurrent ones produce exactly one entry per
occurrence.

**Occurrences are measured from an anchor, never stepped from the last one.**
That is what `startDate` is for. Rent anchored on the 31st is clamped to 28
February, and stepping on from there would give 28 March, 28 April and so on for
ever. Measuring from the anchor makes the clamp a one-off: 31 Jan, 28 Feb, 31
Mar. Same rule for 29 February on a yearly template.

**A catch-up run is capped at 60 occurrences per template.** A daily template
left dormant for two years is 730 entries, and creating them in one page load
would stall the request. The cap leaves `nextDate` on the first uncreated
occurrence, so the backlog drains over a few visits instead of in one burst.

**Deleting a template keeps the entries it created** — `set null`, not cascade.
That money really was spent. Editing one leaves them alone too: rewriting
history to match a template changed afterwards would be worse than the
inconsistency.

**A savings goal is a target, not an account.** No money moves between it and
the ledger, so a contribution says "this much of what I have is spoken for". The
figure worth having is `perMonth` — what to put aside to arrive on time — which
is why a deadline turns a goal from a number into a plan. Contributions are a
signed delta rather than a new balance, so two people paying into one household
goal both count.

**`recurringId` is a managed field.** A caller that could set it could both
claim an entry was generated and — because it is half of the occurrence key —
block a real occurrence from ever being created. It sits in `ManagedFields`
alongside the conversion columns, and the services pass it through their own
options argument.

---

## Environment

| Variable                | Needed for       | Notes                                          |
| ----------------------- | ---------------- | ---------------------------------------------- |
| `BETTER_AUTH_SECRET`    | Auth             | `openssl rand -base64 32`                      |
| `BETTER_AUTH_URL`       | Auth             | App base URL                                   |
| `DATABASE_URL`          | Runtime          | Pooled Neon connection                         |
| `DATABASE_URL_UNPOOLED` | Migrations       | Direct connection for drizzle-kit              |
| `RESEND_API_KEY`        | Invite email     | Set                                            |
| `RESEND_FROM`           | Invite email     | **Not set.** Needs a domain verified in Resend |
| `ALLOW_PUBLIC_SIGNUP`   | Sign-up gate     | Defaults to `false`                            |
| `CRON_SECRET`           | Both cron routes | **Not set.** Both refuse to run without it     |

**On `CRON_SECRET`:** neither cron route runs without it, and that is survivable
by design. Rates are fetched on demand when a conversion misses the cache, and
recurring entries are materialised when someone loads a page. Setting it buys
freshness in a space nobody has opened, not correctness.

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
- **`sumTransactions` returns `"0"`, not `"0.00"`, for an empty set** — the
  `coalesce(..., 0)::text` in the query has no scale. `formatMoney` renders
  both the same, so it only shows up when a figure is compared as a string.
  Normalise with `Number(x).toFixed(2)` before putting it in a model.
- **The two transaction tables have separate id sequences,** so ordering a
  merged expense-and-income list by id ranks by which table was busier. The
  dashboard's recent list breaks date ties on `updatedAt` instead.
- **The dashboard and `/recurring` write during render.** Both catch up before
  they read, which is a side effect in a Server Component and normally a smell.
  It is safe only because the occurrence key makes it repeatable — a re-render,
  a prefetch or a double submit all converge on the same rows. Do not copy the
  pattern for anything that is not idempotent.
- **`neon()` is tagged-template only.** `sql("select …")` throws; use
  `sql.query("select …", params)` for a dynamically built statement.
- **`vi.clearAllMocks()` does not clear queued `mockResolvedValueOnce` values.**
  It clears recorded calls only, so one test's queued sequence leaks into the
  next and fails it in a way that looks like a bug in the code under test. Use
  `vi.resetAllMocks()` and set the implementations in `beforeEach`.
- **`Intl` separates a currency symbol from its figure with a non-breaking
  space.** An ordinary space in an expected string fails in a way that looks
  identical on screen. Normalise it before comparing.
- **`await` the `.resolves` / `.rejects` matchers.** Without it the assertion
  is a floating promise that passes whatever happens.
- **`parseAmount` matches one number; it does not strip characters.** It used
  to delete anything that was not a digit, which silently turned `1e5` into
  `15` — a typo becoming a plausible amount, which for money is the worst kind
  of failure. Found by the first test written against it. To accept a new
  format, widen the `AMOUNT` regex; never go back to stripping.

---

## Known follow-ups

Not blocking, but worth doing.

- [x] ~~`pnpm-lock.yaml` is git-ignored.~~ Committed, so every build resolves the
      same tree. `drizzle-orm` and `drizzle-kit` are pinned at `1.0.0-rc.4`
      rather than being re-resolved on each deploy.
- [x] ~~GitHub reports 40 Dependabot vulnerabilities (19 high) on the default
      branch.~~ Cleared: `pnpm audit` reports 0 across all severities, on the
      production-only tree as well as the full one. Fixed by bumping `next` and
      `eslint-config-next` to 16.2.11 and overriding five transitive packages
      (`postcss`, `nanoid`, `js-yaml`, `brace-expansion` ×2, `sharp`). `shadcn`
      moved to `devDependencies` at the same time — it is a CLI, nothing imports
      it, and shipping it as a runtime dependency pulled its whole tree into the
      production audit. **The advisories are counted against `main`,** which is
      still behind `dev` by every feature, so GitHub will keep reporting them
      until `dev` reaches `main`.
- [ ] `@better-auth/drizzle-adapter` declares a peer of `drizzle-orm@^0.45.2`
      against the installed `1.0.0-rc.4`. Works today; suspect it first if auth
      behaves oddly.
- [x] ~~No tests yet.~~ 223 unit tests across the RBAC policy, space scoping,
      currency conversion and the date arithmetic behind budgets, reports and
      recurring entries. Still untested: Server Actions, components, and
      anything that needs a database.
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
