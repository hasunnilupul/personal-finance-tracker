# Implementation plan

Working document for FinanceFlow. It records what is decided, what is done, and
what comes next, so work can resume without re-deciding anything.

**Update this file as part of the feature's own commit** — tick the boxes, move
the "Current position" marker, and add anything learned to Decisions or Gotchas.

---

## Current position

**Released 2026-08-19** — `4cc30b8` (PR #48), carrying **#46 (Feature 14 —
error boundaries)** and **#47 (Feature 15 — the cold-start splash)**, plus the
plan records for the 2026-08-18 release and for #47. **No migrations and no
dependency changes** — `git diff main dev -- lib/db/` was empty and the lockfile
untouched, the only `package.json` change being the `dev` script moving to port
3001, which never runs in production — so the deploy-time migrate step was a
no-op again.

**Merged with a merge commit, and the history is convergent.** `4cc30b8` has two
parents (`45305b7` and `7fc66ba`), `git diff main dev` is empty, and `dev` is an
ancestor of `main`, so the next release PR will list only what is new. That is
the rule being followed rather than repaired.

Verified against the live site: `/` 307s to `/sign-in`; `/sign-in` and
`/offline` answer 200 as HTML; `/manifest.webmanifest` answers 200 as
`application/manifest+json`; and **`/sw.js` answers 200 as JavaScript with
`no-cache, no-store, must-revalidate`**, identically with and without
`?v=<id>` — so the query misses neither the header rule nor the static file.

**The id agrees on both sides again, and it is a new one.** `/api/version`
reports `dpl_F9hiY77kzSpivpTxQe9TfCuRNCt8` and the page's `data-dpl-id` is the
same string; the previous release reported `dpl_79M3hmykYNdwoQsqpdVdeKUs2fT8`.
A changed id is the precondition for everything Feature 13 does.

**The splash reached production in the right shape** — checked in the response
body, not inferred from the build: the gate script is present, it is inside
`<body>` rather than a `<head>` of the layout's own, it precedes the splash
markup so the parser runs it first, and the brand mark's SVG is there. This is
the half that can be proved from outside.

**Feature 13 is still not proven, and this deploy was the chance.** The id
changed, which is the precondition, but whether a new worker actually installed
and whether `activate` dropped the previous build's caches cannot be seen from
`curl` — it needs a browser that already had the previous version installed.
**If it turns out not to have happened, suspect the registration URL before
suspecting the cache code.**

**Seen on a real installed device, 2026-08-19: the splash plays on a cold
start.** That closes the gap this release opened with — a launch screen had only
ever been watched in a browser tab, and the installed app is the moment it
exists for. **It does not prove Feature 13.** Navigations are network-first, so
an online device would have been served the new document whether or not a new
worker installed; the splash playing says the document was fresh, nothing more.

**The update notice deliberately does not appear on a cold start, and that
confused its first real test.** Opening the installed app after this deploy
showed no banner, which is correct: the document that just arrived *is* the new
deployment, so `loadedDeploymentId()` and `/api/version` agree and
`hasNewDeployment` is false. `components/update-notice.tsx` also does not check
on mount, on purpose — the first useful moment is the first time a tab is
*returned to*. **The banner needs a deploy that lands while the app is already
open**, then a focus or visibility change (or five minutes). A cold start is
precisely the case it must stay silent for, so "I opened the app and saw no
banner" is evidence the feature works, not evidence it is broken.

**What this release did not prove.** The deploy is green and the app answers,
which is a weaker claim than the features working. Still unseen: **#46's dashboard boundary**, so that it renders inside the shell
rather than replacing it still rests on the file's position; the update-notice
card itself; whether push actually delivers; whether `financeflow-private-*`
disappears from Cache Storage on sign-out; and whether an invitation notice
reaches the other account. Each needs a signed-in browser with the owner's own
credentials — the standing gap no release has closed.

**Released 2026-08-18** — `45305b7` (PR #45), carrying #43 (Feature 12 —
new-version notice) and #44 (Feature 13 — the worker sees a deployment), plus
the plan records for both. **No migrations and no dependency changes**, so the
deploy-time migrate step was a no-op again. Merged with a merge commit:
`45305b7` has two parents, `git diff main dev` is empty, and `dev` is an
ancestor of `main`, so the next release PR will list only what is new.

Verified against the live site: `/` 307s to sign-in, `/sign-in`, `/offline` and
`/manifest.webmanifest` all answer 200, and **`/sw.js?v=<id>` answers 200 as
JavaScript with `no-cache, no-store, must-revalidate`** — the query misses
neither the header rule nor the static file, which is what Feature 13 depends
on. Bare `/sw.js` answers identically, so the no-deployment-id fallback is
intact.

**The id agrees on both sides, and this is the first build where that could be
checked.** `/api/version` reports `dpl_79M3hmykYNdwoQsqpdVdeKUs2fT8` and the
page's `data-dpl-id` is the same string. That is the exact disagreement Feature
12 hit locally — `next.config.ts` re-read at boot against a `process.env` read
inlined at build time — confirmed absent on a real deployment. Had they
differed, the notice would have shown on a page that was already current, for
ever, and no reload could have cleared it.

**Feature 13 is not proven yet, and cannot be until the next deploy.** Installed
devices are only now being handed the versioned registration, so `install` has
not had a reason to run a second time. **The deployment after this one is the
first that can prove the feature works** — that is when a new worker should
install and `activate` should drop the previous build's caches for the first
time since Feature 10 shipped. If it does not, suspect the registration URL
before suspecting the cache code.

**Still unverified, and none of it belongs to this release:** the update notice
card itself, whether push actually delivers, whether `financeflow-private-*`
disappears from Cache Storage on sign-out, and whether an invitation notice
reaches the other account. Each needs a signed-in browser with the owner's own
credentials, which is the standing gap no release has closed.

**Released 2026-08-17** — `d0aff32` (PR #42), carrying #40 (Feature 11 —
loading skeletons) and the documentation in #39 and #41. **No migrations and no
dependency changes**, so the deploy-time migrate step was a no-op again. The
production deployment for `d0aff32` reports success, and the live site answers:
`/` 307 to sign-in, `/sign-in`, `/offline`, `/manifest.webmanifest` and `/sw.js`
all 200.

**Nothing in this release is visible to a signed-out visitor**, which is the
limit of what those URLs prove. Skeletons only appear on authenticated routes,
so "the deploy is green and the app still answers" is the whole claim — whether
a skeleton matches the page that replaces it still needs a signed-in browser.

**Merged with a merge commit, and the history is convergent again.** `d0aff32`
has two parents, `git diff main dev` is empty, and `dev` is an ancestor of
`main` — so the next release PR will list only what is new. That is the rule
below being followed rather than repaired.

**Released 2026-08-14 (third)** — `ac4e6cc` (PR #38), bringing `main` level with
`dev`. It carries #36 (Feature 9d — invitations notify without asking) and #37
(Feature 10 — offline reads), and **no migrations and no dependency changes**,
so the deploy-time migrate step was a no-op again. The deploy went green.

Verified against the live site, which is where these first become checkable:

- `/offline` answers **200**. It answered **307** before this release, which is
  the proof that `publicRoutes` took effect — and therefore that the worker
  precaches the page rather than a redirect to sign-in.
- `/sw.js` answers 200 as JavaScript with `no-cache, no-store, must-revalidate`
  and now carries the caching code, so installed apps are being handed the new
  worker rather than the one that cached nothing.
- `/manifest.webmanifest` still answers 200.

**Not yet verified, and each needs a signed-in browser rather than a URL:** that
push actually delivers, that `financeflow-private-*` really disappears from
Cache Storage on sign-out, and that an invitation notice reaches the other
account. The first is the one to check first — this is the first production
build made with the VAPID keys present, so it is the first that *could* work.

**Last completed:** **Feature 14 — error boundaries**, on `feat/error-boundaries`
and not yet merged. Three boundaries rather than one per route: a dashboard page
that throws keeps the sidebar and topbar, anything with no shell to preserve
falls to `app/error.tsx`, and the root layout failing falls to a
`global-error.tsx` built out of nothing. The retry button takes Next 16.2's
`unstable_retry` rather than `reset`, which is the difference between a button
that re-fetches and one that only looks like it does.

**Before that:** **Feature 13 — the worker sees a deployment**. The page
registers `/sw.js?v=<deployment id>`, so a deploy is finally a script change the
browser can find: `install` runs again, and the `activate` cleanup that has been
sitting there since Feature 10 drops the previous build's caches for the first
time. The version rides in the **query, never the path** — a changed path is a
second registration, and it would take every device's push subscription with it.

**Before that:** **Feature 12 — new-version notice** (PR #43). A tab that was
open when a deployment went out says so and offers a reload. The detection is
**verified against a real production build**; the card itself is unseen.

**Before that:** **Feature 11 — loading skeletons** (PR #40, released in
`d0aff32`). Every route answers a navigation with a skeleton of its own shape,
and a filter, month or range change greys only the figures it changes. **Nobody
has watched one resolve** — see the caveat under the feature.

**And before that:** **Feature 10 — offline reads** (PR #37). The app opens and
reads without a connection, and the page cache ends with the session.

**And before that:** **Feature 9d — invitations notify without asking** (PR
#36). The channel choice is gone; a failed notice alerts.

**Before that:** **Feature 9b — web push** (PR #34). Notifications reach the
phone when the app is closed, which also carries the invitation notice.

**Before that:** **UI polish** (`fix/ui-polish`) — eight commits of
presentation fixes found by using the app rather than by planning it. Two were
whole classes rather than single sightings: no `Select` passed `items`, so every
trigger printed its raw value (the space switcher showed an organization id),
and no `Button` rendering a link passed `nativeButton={false}`, which is what
gates Base UI's link-aware keyboard handling. Also: the sidebar tab that only
answered a click on its label, a mobile bar carrying ten tabs across a phone,
the topbar extracted into `components/app-topbar.tsx` and taught to reflow, and
`PLAN.md` moved into `.prettierignore` because `pnpm format` was indenting it
four spaces deeper on every run. All four checks pass; none of it was exercised
in a browser, since signing in needs the owner's own credentials.

**And before that:** **Shipped.** `dev` merged into `main` on 2026-08-14 (merge
`ae12bc9`, 41 commits), and the production deploy succeeded. That build was also
the first exercise of the deploy-time migration added in #24: the deployment
went green, which on a production build means the migrate step ran rather than
skipped, so `DATABASE_URL_UNPOOLED` was already set in Vercel's Production
environment, the two connection strings agreed, and the nine migrations applied
to the empty production database. A missing variable, a mismatched pair or a
failing migration would each have taken the build down instead.

**Released 2026-08-14** — `main` brought level with `dev` (merge `bb58048`,
PR #28), carrying #25 (UI fixes), #26 (category scoping) and #27 (installable
PWA). The deploy went green. It held **no migrations and no dependency
changes**, so the deploy-time migrate step was a no-op — the lowest-risk shape
a release here can have, and worth aiming for deliberately.

Verified against the live site, which is the first place these could be
checked: `/manifest.webmanifest` answers 200 as `application/manifest+json`,
every icon answers 200 at exactly its declared size, and `/` answers 307 to
sign-in rather than redirecting to `vercel.com/sso-api` — which is independent
proof the deployment protection below is genuinely off.

The three deployment blockers recorded below were **fixed on 2026-08-14**,
outside the repo. Their notes are kept for the traps they explain, not as
outstanding work.

**Released 2026-08-14 (second)** — `d73622e` (PR #30), carrying #29: the
service worker Chrome needs before it will offer to install, and the hint iOS
needs because Safari never offers at all. Verified on the live site (`/sw.js`
answers 200 as JavaScript with `no-store`, and carries the `fetch` handler that
is the whole point) **and confirmed installed on a real iPhone** — the first
end-to-end proof the PWA works.

**Release PRs must be merge commits, not squashes — reconverged 2026-08-17.**
PR #38 was squash-merged, unlike the four releases before it: `ac4e6cc` has one
parent where `89ffd52`, `d73622e`, `bb58048` and `ae12bc9` each have two. The
content was fine — `git diff main dev` was empty — but `dev` stopped being an
ancestor of `main`, which would have made the *next* release PR list #36 and
#37 again alongside the new work: a correct diff under a commit list that grows
with every squashed release. Fixed by merging `main` back into `dev` (`4c0795a`,
no content change; the `PLAN.md` conflict was main's squashed copy of #36 and
#37 against `dev`'s same changes plus #39, resolved to `dev`'s superset). If a
release is ever squashed again, do the same thing straight afterwards.

**The four VAPID variables were set in Vercel on 2026-08-14**, after `89ffd52`
had already built. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined into the client
bundle at build time rather than read at runtime, so push stayed inert until
this release rebuilt. **Verify by pressing the toggle, not by loading the
page:** a missing server-side key makes the toggle say "not configured", but a
missing or mismatched *public* key fails only at `pushManager.subscribe`.

**Feature 14 — error boundaries** merged as #46, and **Feature 15 — the
cold-start splash** as #47 (`48c112c`, squash-merged, 2026-08-19): a branded
launch screen for the installed app, with an SVG mark drawn in the language of
the existing icon so its parts animate separately. It deliberately does **not**
touch the route skeletons — Feature 11 settled that a shape-matched fallback
beats a generic one, and a logo animation on every navigation would be exactly
the generic one.

**Both are merged into `dev` and neither has been released.** `main` is still at
`45305b7`, so nothing in #46 or #47 has been near production; the next release
PR carries both.

**It is the first feature verified in a browser before its PR was opened**, and
that is the only reason it is correct: the splash renders, the mark sizes to
`5rem`, the gate suppresses it on the second load of a session, and the console
is clean. Two separate faults were invisible to `typecheck`, `lint`, `test` and
`build`, which all passed against both of them — see the two gotchas below.

**Feature 13 was built stacked on `feat/update-notice` rather than branched from
`dev`**, because it reuses the `loadedDeploymentId()` that Feature 12
introduced. That is a departure from the one-feature-one-branch rule above, and
it is recorded because the way out is not obvious: opening the PR against `dev`
while #43 was still open would have listed Feature 12's three commits as part of
it. Resolved by merging #43 first (squashed to `f39924e`), then
`git rebase --onto origin/dev <old tip> feat/versioned-worker` — which replays
only the commits *after* the old branch tip, so the three that were already in
`dev` are dropped rather than replayed against their own squashed copy. It
rebased clean, because a squash preserves the tree. **If a branch is ever
stacked again, that is the command**; a plain `git rebase dev` would have tried
to reapply all four.

**`main` and `dev` hold the same code as of the 2026-08-17 release**, and `dev` is one commit ahead — this
record itself, written after the merge. A release record has no feature branch
to ride along on, so it is committed straight to `dev` rather than through a
documentation branch of its own: the repo owner asked for those to stop on
2026-08-17, and everything else belongs in the commits of the feature it
describes.

**Still to come:** no feature is planned. The one known gap is offline *entry*,
which Feature 10 deliberately leaves out: writes are not queued, and doing it
properly means IndexedDB and a replay queue with the same idempotency care the
recurring materialiser needed.

**Both cron routes are scheduled and both are live.** `vercel.json` lists
`/api/cron/refresh-rates` at 03:00 and `/api/cron/materialise-recurring` at
04:00; the second was added in #32 and reached production with it, so recurring
entries no longer wait for somebody to open the app. Notes elsewhere in this
file said otherwise until 2026-08-17 — they predated #32 and were stale.

**~~Reachability~~ — settled 2026-08-14.** Kept because each of these explains a
trap that can come back, not because any is outstanding:

1. ~~**Vercel Deployment Protection is on.**~~ Both `/` and `/sign-up` answered
   `302` to `vercel.com/sso-api`, so the deployment sat behind the Vercel
   account's own login and nobody else could load the app at all. It is not an
   app setting: no amount of correct configuration inside the app works around
   it. Production had to be set public in Settings → Deployment Protection.
2. ~~**`BETTER_AUTH_URL` must be the project's stable production domain**~~ —
   not the per-deployment hash URL, which changes on every deploy and would rot
   every invitation link built from it.
3. ~~**`RESEND_FROM` is `onboarding@resend.dev`**~~, which delivers only to the
   Resend account's own address. Invitations still work by copying the link;
   the email just never arrives and nothing on screen says so. A real domain
   has to be verified, or the variable cleared so the app falls back to
   copy-the-link honestly.

Then **sign up first, before sharing the URL.** The production database is
empty and its own bootstrap is unspent, so whoever creates the first account
becomes the owner. The development account does not exist there — the two
databases are separate.

| Branch | State                                                                          |
| ------ | ------------------------------------------------------------------------------ |
| `main` | Production, at `4cc30b8` (PR #48, 2026-08-19). Deployed and green.            |
| `dev`  | Integration branch. Level with `main` in code; ahead by this release record. No branch open against it. |

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

### Releasing

**7. Open the release PR** (`dev` → `main`) and **write the release record into
this file as part of it**, not afterwards. Everything except the merge SHA and
the live-site results is known before the merge: what the release carries,
whether it holds migrations or dependency changes, and what each feature in it
still leaves unverified. That half goes in the release PR's own commit.

**8. Merge it, then finish the record** — the merge SHA, that the merge has two
parents, and what the live site actually answered. Committed straight to `dev`,
which is the one place a record with no branch to ride along on belongs.

**The record rides with the work that produced it. Always.** This is the same
rule as step 2, and it is written out separately because releases are where it
keeps getting dropped: the record has twice been an afterthought somebody had to
be asked for, and once it was a documentation branch of its own — which is what
the repo owner asked to stop on 2026-08-17. A release that is not written down
while it is being made is a release nobody can reconstruct later, and the parts
worth having are exactly the ones that fade: what was verified against the live
site, what was merely deployed, and what is still waiting on a signed-in
browser.

**What a release record must state**, because each of these has been the thing
that mattered later:

- What it carries, by PR number, and the merge commit.
- **Whether it holds migrations or dependency changes.** A release with neither
  is the lowest-risk shape one can have here and is worth aiming for
  deliberately; a release with either needs the deploy watched rather than
  glanced at.
- That the merge has **two parents** — see below for why.
- What the live site answered, URL by URL.
- **What is still unverified, and what it would take.** The most valuable line
  in every record so far. "The deploy is green" is not the same claim as "the
  feature works", and the gap between them is where every one of these features
  currently sits.

**Releasing is the one exception to how PRs are merged here.** A feature PR into
`dev` may be squashed — that is what most of them have been, and it costs
nothing. A **release PR (`dev` → `main`) must be a merge commit**: squashing one
gives `main` a commit with a single parent, so `dev` stops being an ancestor of
it and every later release PR re-lists the features already shipped. It happened
once, with #38; the repair is to merge `main` back into `dev` immediately, which
is `4c0795a`.

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
| Multi-table writes       | One `db.batch`, via `lib/db/batch.ts`     | The HTTP driver has no _interactive_ transactions, but a batch is still one transaction  |
| Reassigning a category   | Budgets are not moved; they cascade       | The dialog already counts them destroyed, and moving one trips the unique period index   |
| Recurring trigger        | On-read catch-up; cron as an accelerator  | `CRON_SECRET` is unset, so a cron-only sweep would never fire in this deployment         |
| Recurring idempotency    | Unique `(org, recurringId, date)` key     | No interactive transactions, so a retry must be a no-op rather than a duplicate          |
| Occurrence dates         | Measured from `startDate`, not stepped    | Stepping from the last one makes a month-end clamp permanent — the 31st becomes the 28th |
| Savings goals            | A target, not an account; no money moves  | Keeps one place for money to live; a contribution marks intent, not a transfer           |
| Notification delivery    | In-app record; push as a layer on top      | A denied permission must not mean the overspend was never recorded — as with invites     |
| Notification triggers    | At the write that causes them, not swept   | Crossing a budget is caused by an expense; there is nothing to poll for                  |
| Notification idempotency | Unique `(org, user, dedupeKey)`            | Every later expense re-crosses the same limit; a sweep races page loads                  |
| Category scoping         | Services assert; the FK is a backstop     | A foreign key enforces existence in _any_ space, so ownership has to be asked separately |
| Package manager          | pnpm                                      |                                                                                          |

---

## Conventions

**The dev server runs on port 3001.** `pnpm dev` is `next dev -p 3001`, pinned
rather than left to default, so the URL is the same every time and a second
Next instance cannot quietly claim 3000 and leave you testing the wrong tree.

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

**Multi-table writes go through `runBatch`** (`lib/db/batch.ts`). The HTTP
driver has no _interactive_ transactions — it cannot hold `BEGIN` open across
round trips — but `db.batch` sends a list of statements in one request as one
non-interactive transaction, so either all of them land or none do. Anything
that has to be all-or-nothing is composed as statements and run through it.

The constraint that comes with it: **the whole batch is decided before it
opens.** Nothing inside can read a result and choose what to write next, so
every lookup, every rate fetch and every refusal happens first. That is not a
new discipline here — it is the same "compute everything that can fail before
writing anything" the un-transacted code already followed — but now the payoff
is a rollback rather than a tidier partial write.

Repositories expose statement builders (`…Statement`) beside their normal
methods; services compose them and call `runBatch`. `db` still only appears in
repositories. **Statement builders must not be `async`** — see Gotchas.

**Migrations.** `pnpm db:generate` then review the SQL before applying.
drizzle-kit 1.0-rc asks for `--hints` on ambiguous rename-vs-create; pass
`{"type":"create",...}` for genuinely new columns. Never let `pnpm format`
touch `lib/db/migrations` (covered by `.prettierignore`).

**Dates.** A transaction date is a calendar day held in a `timestamp` column.
Everything that writes one anchors it to **midday UTC**, and range filters use
whole UTC days. Anchoring to local midnight puts an entry made in Colombo on
the previous UTC day, which silently drops it out of ranges that should
contain it — this was a real bug, caught by a filter returning the wrong rows.

**Loading states.** Every route has a `loading.tsx` that mirrors _that page's_
layout, built from the shared kit in `components/skeletons/`. A new route needs
one — `app/loading-states.test.ts` fails otherwise, and a route under
`(dashboard)` without one inherits the dashboard's skeleton rather than getting
none. Anything driven by a search param also needs a `<Suspense>` boundary
**keyed** on that param, with the control itself left outside the boundary; see
Gotchas for why `loading.tsx` alone does not cover it.

**Error boundaries.** **A segment that owns a `layout.tsx` owns an `error.tsx`**
— `app/error-states.test.ts` fails otherwise. That is the rule rather than a
list of files: a layout is UI worth keeping on screen when something below it
fails, and it is exactly what a boundary further up would throw away. The root
is the exception, because `error.tsx` never wraps the layout in its own segment;
`app/global-error.tsx` covers that one.

Every boundary renders `components/error-state.tsx` and takes **`unstable_retry`,
never `reset`** — see Gotchas. No boundary formats the error itself: what may be
shown is decided once, in `lib/errors/error-presentation.ts`.

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

### Feature 9b — Web push ✅ merged (PR #34), released in ac4e6cc

- [x] `push_subscriptions`, one row per device, keyed on the endpoint
- [x] `push` and `notificationclick` in the service worker
- [x] A per-device toggle on the space settings page
- [x] Dead subscriptions pruned as they are found

**Push is a layer, and the rows are the record.** Nothing here can lose
information: every push follows a notification that is already written, so a
failed send is a missed pop-up. That is what makes it safe for `sendToUsers`
never to throw.

**Only newly created rows are pushed.** `createManyIfAbsent` returns what it
actually inserted, so a repeat the dedupe key turned into a no-op pushes
nothing either — the phone stays quiet for the same reason the bell gains no
second entry. The dedupe key also rides along as the notification `tag`, so a
device that was offline collapses duplicates rather than stacking them.

**Sending is deferred with `after()`.** A push is several HTTPS round trips to
Apple or Google, and none of them belong in the time it takes to save an
expense. Not awaiting *without* `after()` would be worse than either: a
serverless function can be frozen the moment it responds, killing the request
half-sent.

**The bell refreshes on focus and on a slow poll, not on a live channel.**
Rendered with the page, so without that a notification raised by somebody else
appears only when the reader happens to navigate — which is what "I sent an
invitation and nothing showed up" turned out to mean. Coming back to the tab
refreshes immediately, a 60s interval covers sitting on one screen, and push
covers the app being closed. A socket for a household of four is not worth
running.

**An explicitly requested notification must report failure.** `notifySpace`
can stay silent because it always follows a write that already succeeded — the
expense is recorded either way. Sending an invitation notice *is* the action,
so `notifyUser` returns `created` / `duplicate` / `failed` and the action says
which. It reported success while writing nothing when the column was still
`NOT NULL` locally, and that is the failure worth designing against.

**404 and 410 prune; nothing else does.** Those two mean the browser has
discarded the subscription — permission revoked, app uninstalled — and pruning
on discovery is the only way they are ever cleaned up, since nothing tells the
server that somebody uninstalled. A 429 or a 500 is an outage, not consent
withdrawn: deleting on those would silently unsubscribe the household after one
bad afternoon at a push service. Three tests fail if that distinction is
dropped.

**The endpoint is the device's identity**, not a generated id, so re-subscribing
upserts. A browser hands back the same endpoint after a permission reset while
possibly rotating its keys; inserting would leave two rows pushing to one place.

**iOS only exposes the push API to an installed PWA.** Not a permission that
can be asked for and denied — the API is simply absent until the app is on the
home screen, which is why the toggle reads that state and says so rather than
offering a button that would throw.

### Feature 9c — Invitations through the app ✅ merged (PR #33)

- [x] An invited address that already has an account is reached in the app
      (the channel *choice* this feature added was replaced in 9d)
- [x] An address with no account is emailed automatically, as before
- [x] The copyable link is shown in every case
- [x] Account-level notifications, which follow the reader between spaces

**An invitation notice cannot be space-scoped.** The recipient is not a member
of the inviting space — that is the whole point of the invitation — so a row
keyed to it would be visible to nobody. `notifications.organizationId` is now
nullable, meaning "about you rather than about a space", and the bell shows
those wherever the reader happens to be.

**Which forced `NULLS NOT DISTINCT` on the unique constraint.** Postgres treats
nulls as distinct in a unique index by default, so without it every
account-level row would be unique to itself and the dedupe key would silently
stop meaning anything for exactly the rows most likely to repeat — an
invitation sent twice. The old `uniqueIndex` cannot express that; a `unique`
table constraint can.

**Nothing is emailed to an existing account.** The `sendInvitationEmail` hook
looks the address up and holds off when it finds one. Somebody with an account
is better served by the in-app notice: it arrives whatever `RESEND_FROM` is set
to, which is not true of the email.

**The disclosure is deliberate.** The form tells the inviter whether an address
already has an account, which is account enumeration. Accepted knowingly: only
a space owner can invite, sign-up is invite-only, and the alternative — saying
nothing about which channel was used — is a less honest screen. Revisit if
sign-up is ever opened up.

### Feature 9d — Invitations notify without asking ✅ merged (PR #36)

- [x] An invited address with an account is notified in the app as the
      invitation is created, with no channel question
- [x] A failed notice **alerts**, with a retry and an email beside it
- [x] Email stays available afterwards as an extra, not as a choice
- [x] The wording of the notice lives in one place, used by both paths

**The choice was only ever worth asking before push existed.** 9c put two
buttons on screen because the in-app notice might go unread; 9b then made that
notice ring the phone. Once one channel reaches both the bell and the device
and does not depend on `RESEND_FROM`, asking which to use is a question with an
obvious answer, which is a good sign it should not be a question. Email did not
go away — it moved to *after* the notice, where it costs nothing to skip.

**The send moved out of the auth hook and into the action.** `sendInvitationEmail`
still decides that an existing account gets no mail, because it is the choke
point every route into `createInvitation` passes through. But its return value
is discarded by better-auth, so a notice raised there could never be reported.
`inviteMemberAction` raises it instead and returns the outcome, which is the
only reason the failure can be shown at all.

**A failed notice has to be loud.** `notifyUser` already distinguished
`created` / `duplicate` / `failed`, and 9c surfaced the failure only on the
manual button. Now that nobody presses a button, a swallowed failure would mean
an invitation nobody has been told about, looking exactly like one that
worked — so the panel turns destructive, takes `role="alert"`, and leads with
the retry and the email. The three outcomes are covered by the existing
`notification.service` tests; the action layer has no test harness here.

**Only the failure is announced to a screen reader.** A notice that worked is a
confirmation, and `role="alert"` on a confirmation is an interruption for news
that is not urgent.

**`InviteLink` needed to know.** It read `emailSent` alone, and an existing
account is never emailed — so on a correctly configured install it told the
owner "email is not configured". It now takes whether *anything* reached them.

### Feature 10 — Offline reads ✅ merged (PR #37)

- [x] Two caches with different lifetimes: a shell that survives sign-out, and
      pages that do not
- [x] Cache-first for `/_next/static/` and icons; network-first for navigations
- [x] `/offline` as the last resort, precached and public
- [x] Private caches purged on sign-out **and** on sign-in
- [x] A banner that says the page came off the device
- [x] `updateViaCache: "none"` on registration

**The decision the worker had been avoiding since #29 is now made.** It cached
nothing because every dashboard page is dynamic and cookie-gated, so caching one
writes somebody's balances to a phone. That is still exactly what happens — the
change is that it now ends with the session instead of outliving it. Two caches:
`financeflow-shell-*` is build output and icons, about nobody, and survives;
`financeflow-private-*` is rendered pages, and is wiped at both ends of a
session.

**Purged on sign-in as well as sign-out, and sign-in is the half that holds.**
Sign-out can be skipped by closing the app, uninstalling it, or letting the
session expire; arriving at a successful sign-in cannot be. On a phone two
people in the household share, that is what stops the second person opening the
first one's ledger from the cache.

**The purge runs in the page, not in the worker.** A document can reach the
Cache API directly, and one code path that always runs beats a `postMessage`
that needs a live worker to hear it — sign-out is precisely when the worker may
be starting, being replaced, or absent. The cost is that
`PRIVATE_CACHE_PREFIX` exists twice, in `lib/pwa/private-cache.ts` and in
`public/sw.js`; `sw.js` is served as-is rather than bundled, so it cannot import
anything. Both copies say so, and the test writes the names out literally so a
drift fails rather than silently stops matching.

**Awaited before the redirect.** A `caches.delete` still running when the
document unloads is abandoned, which would leave the pages on disk under a
session that has ended — the one failure that would make all of this decorative.

**RSC requests are deliberately not intercepted.** They are what the router
sends when navigating inside the app, and caching them means keying on the
`_rsc` hash and risking a client half served against a different server half.
Left alone, an offline RSC fetch fails the way Next expects and the router falls
back to a full navigation — which the worker *does* answer from the page cache.
Not handling a request is a strategy here, not a gap.

**Only a plain 200 is cached for a navigation.** A redirect is the proxy sending
an expired session to sign-in, and storing that under the page's own URL would
pin the app to the sign-in screen for as long as it stayed offline.

**`/offline` had to be public.** The worker precaches it at install time, when
the user may well be signed in; a `fetch` of a guarded route follows the
redirect, so the sign-in page would have been stored under `/offline`. It holds
no session and no data, so `publicRoutes` costs nothing. It builds as `○
(Static)`, which is the check that it needs no server at all.

**`install` adds assets one at a time.** `cache.addAll` rejects the whole batch
on a single 404 and leaves the worker uninstalled — losing push and the install
prompt over a missing icon.

**Deliberately not included: offline _entry_.** Writes are not queued; the
banner says changes will not save, and non-GET requests are never touched by the
worker. Real offline entry means IndexedDB and a replay queue with the same
idempotency care the recurring materialiser needed, and it is a feature, not a
corner of this one.

**Still hand-written, still not Serwist.** The Next.js PWA guide recommends it
and notes it requires webpack configuration; this project builds with Turbopack.

### Feature 12 — New-version notice ✅ merged (PR #43)

- [x] `deploymentId` set from the deployment's own environment, which also
      turns on Next's version-skew protection
- [x] `/api/version` — public, uncached, reports the running build
- [x] A tab compares the id it was served with against that, on focus and on a
      slow interval, and offers a reload when they differ
- [x] Never reloads by itself, and never nags twice for the same version
- [x] Silent wherever there is no id to compare

**The service worker could not answer this.** The obvious mechanism for "a new
version is out" in a PWA is the worker's own update flow — `updatefound`, a
waiting worker, `skipWaiting`. It does not work here: `public/sw.js` is a static
file whose bytes are identical from one deployment to the next, so the browser's
byte comparison finds no change and no update event ever fires. A deployment is
invisible to it. What *does* change every deployment is the deployment id, so
that is what is compared.

**Both sides must read the id at the same moment, and finding out why cost a
real bug.** `data-dpl-id` comes from `next.config.ts`, which the server re-reads
when it boots; the endpoint reads `process.env`, which the bundler **inlines at
build time**. Built under one id and started under another, the page said one
thing and the endpoint another — and since a reload cannot change either, the
notice would have shown on a page that was already current, for ever. Both now
go through `deploymentId()`, which indexes `process.env` with a variable so it
cannot be inlined. Verified by building under `build-a` and starting under
`build-b`: page and endpoint both answer `build-b`, and no notice is raised.

**Verified the other direction too**, which is the point of the feature: a page
served under `build-b`, then the server restarted as `build-c`, and the poll
comes back different. That is the exact shape of a redeploy under an open tab.

**It asks rather than acts.** A page that reloaded itself would throw away a
half-typed expense to fix a problem the reader had not noticed. Next's own
skew protection already hard-navigates the *next* navigation, so the only person
this notice is for is the one sitting still — and they can finish first.

**A poll that fails is not news.** Offline, a 500, a captive portal answering
with HTML: each returns "no answer", never "changed". `hasNewDeployment` refuses
to compare unless both ids are present, and `parseVersionResponse` refuses
anything that is not a non-empty string. The tests weight this direction
deliberately — a false alarm is produced by ordinary conditions, and it is the
failure that costs somebody their unsaved input.

**Dismissing is per version, not per notice.** The id that was dismissed is
remembered, so the next deployment says so again rather than staying quiet
because somebody waved this one away.

**Five minutes, and on focus.** Deployments here happen a few times a week, and
each check is a request from every open tab. The case that matters — coming back
to a tab left open overnight — is the focus listener; the interval only covers a
tab left in front all afternoon. The same shape as the notification bell, which
had the same choice to make.

**Not watched in a browser.** The detection is proven end to end with curl
against `next start`; what nobody has seen is the card appearing, the Reload
button, or the two bottom notices stacking on a phone.

### Feature 15 — Cold-start splash ✅ merged (PR #47)

- [x] `components/brand-mark.tsx` — the icon redrawn as inline SVG, its bars,
      arrow and head separately addressable so they can animate apart
- [x] `components/app-splash.tsx` — the overlay, server-rendered, no client
      component and no hydration on the path that shows it
- [x] `lib/pwa/splash.ts` — the session gate, as source for an inline script
- [x] The whole lifecycle in `app/globals.css`, dismissal included
- [x] `lib/pwa/splash.test.ts` — the gate executed, not pattern-matched
- [x] `app/splash-dismissal.test.ts` — the dismissal cannot become conditional

**Nothing has to run for the splash to leave.** It is a fixed overlay across the
whole viewport, so every mechanism that could fail to remove it is a way to lose
the application completely — not degrade it, lose it. So the dismissal is a CSS
animation with `forwards`, defined outside every guard: it plays under reduced
motion, and it plays with JavaScript blocked or broken.
`app/splash-dismissal.test.ts` asserts that shape rather than the appearance,
because the realistic way it breaks is somebody tidying the fade-out in with the
decorative animations under `prefers-reduced-motion`, where they are switched off
together. That reads perfectly in review and would be caught by nobody who did
not have the preference set.

**The gate fails towards showing.** `sessionStorage` does not merely come back
empty in Safari's private mode and under blocked cookies — it *throws*, in
`<body>`'s first script, before anything else. So it is wrapped in
`try`/`catch`, and the catch leaves the splash playing: the cost of that
direction is a repeated animation, where marking it done by mistake would mean
nobody ever saw the launch screen and nothing would ever say so.

**`sessionStorage`, not `localStorage`, and the scope is the feature.** A splash
is for a cold start. `sessionStorage` ends when the tab or the installed app is
closed, which is exactly when the next open is a real launch; `localStorage`
would show it once ever, and a timestamp in `localStorage` would be a guess at
what "a new launch" means.

**Verified in a browser on `localhost:3001`, both halves.** Cold start: the
overlay renders, the mark computes to `80px`, `ff-splash-dismiss` is the running
animation, and it clears to the sign-in card. Second load in the same tab:
`<html data-splash="done">`, the overlay computes `display: none`, and the app
is there immediately with no flash. **Still unseen: the installed app on a real
device**, which is the moment the feature exists for — a browser tab is the
nearest thing reachable from here.

### Feature 14 — Error boundaries ✅ merged (PR #46)

- [x] `app/(dashboard)/error.tsx` — a failed page keeps the sidebar, the topbar
      and the mobile navigation
- [x] `app/error.tsx` — the net under everything with no shell to preserve,
      including the dashboard layout's own failure
- [x] `app/global-error.tsx` — the root layout failing, built out of nothing
- [x] One disclosure rule, in `lib/errors/error-presentation.ts`, with tests
- [x] `app/error-states.test.ts` — a segment with a layout has a boundary

**The gap this closes was opened by Feature 11.** While every page rendered in
one blocking pass a throw produced the framework's 500 page, which is ugly but
honest. Feature 11 put `<Suspense>` inside three pages and the dashboard layout,
and an error thrown *after* streaming has begun cannot set a status code — it is
handled inside the streamed HTML by the nearest `error.js`, and with none the
whole tree is replaced rather than the section that failed.

**`unstable_retry`, not `reset`, and the difference is the whole feature.** Next
16.2 added `unstable_retry` and the old `reset` still exists beside it, so the
wrong one compiles and renders a perfectly good "Try again" button — one that
clears the boundary and re-renders **without re-fetching**. Every page here
fails by way of a query, so `reset` would have recovered nothing, ever, while
looking exactly like a working button. Verified by clicking the real one against
a production build: the server logged a *new* render, which is the only
observable difference between the two.

**A group's boundary cannot catch its own layout, and that turned out to be the
right shape.** `error.tsx` wraps `page.tsx`, `loading.tsx` and nested layouts
but not the `layout.tsx` beside it — so `requireActiveSpace()` failing in
`app/(dashboard)/layout.tsx` bypasses the dashboard boundary entirely and lands
in `app/error.tsx`. That is correct rather than a hole: the authorization gate is
what failed, so there is no resolved space, and a sidebar drawn around the
message would be furniture the app has no right to show.

**One rule about what an error may say, and no boundary can opt out of it.**
Next redacts a Server Component's `message` before it reaches the client, but
**not a Client Component's** — that arrives intact, and here it can carry a space
id or an amount. So `visibleErrorDetail` returns the message only in
development, `errorDigest` returns the quotable hash, and `ErrorState` is handed
the error object rather than a formatted string. Tested in the production
direction on purpose: a boundary that leaks looks entirely normal, and only the
person who triggered it would ever see.

**`global-error.tsx` is built out of nothing** — no `Card`, no `Button`, no
icons, no design tokens, colours inline. Every import is another thing that can
be broken by whatever broke the root layout, and a global boundary that throws
while rendering leaves Next's own default and no way back. It also loses the
theme with the layout that sets the `.dark` class, so it is deliberately near-
black on near-white rather than re-deriving the theme from `localStorage` with a
blocking script.

**One boundary per group, not per route** — the opposite of Feature 11's rule,
for the reason that made that rule right. A skeleton is a promise about the page
that is arriving, so its shape carries information; an error is the absence of
that page, and shaping it like the thing that failed tells the reader nothing
they can act on.

**Verified in a browser, which is new for this project.** A production build
with a throw injected into `/accept-invitation/[id]`: the card renders with the
heading, both buttons and `Reference: 2684280875` matching the digest in the
server log, and the message — seeded with a fake amount and space id — appears
nowhere in the response. **Still unseen: the dashboard boundary specifically**,
because reaching it needs a signed-in session. That it renders inside the shell
rather than replacing it is the one claim still resting on the file's position
rather than on having been watched.

### Feature 13 — The worker sees a deployment ✅ merged (PR #44)

- [x] The page registers `/sw.js?v=<deployment id>`, so a deploy is a script
      change the browser can find
- [x] The worker reads its own version back out of that URL
- [x] `activate` therefore drops the previous build's caches, which is what it
      was always written to do and had never once done
- [x] The **path** is unchanged, so the registration — and the push
      subscription hanging off it — is updated rather than replaced
- [x] Bare `/sw.js` and `v1` wherever there is no deployment id

**This is the open item Feature 12 left behind, and it is the same fact seen
from the other side.** #12 could not use the worker's update flow to detect a
deployment because `public/sw.js` is byte-identical from one build to the next,
so the browser's comparison never finds a change. That is not only a missed
signal: it means `install` has run exactly once, on the day the app was first
opened. The shell cache still holds that build's `/offline`, and because Next
appends `?dpl=` to static assets, every deployment has been *adding* a copy of
every asset it touched rather than replacing one. The `activate` cleanup that
was supposed to prevent that has never fired.

**Versioning the registration URL, not the file.** The note in this plan
proposed serving the worker from a route handler with the id substituted into
its body. That works, and it is more machinery than the job needs: it moves the
file out of `public/`, and the existing header rule and static serving with it.
A script URL that differs by a query is already a different script to the
browser, so `/sw.js?v=<id>` is enough to make a deploy visible. The worker still
cannot import anything — it is served as-is — so it reads its version out of
`self.location` rather than having it baked in, which is the one thing the route
handler would have bought.

**Changing the path would have unsubscribed every installed device from push.**
This is the trap worth remembering, and it is why the version rides in the query
rather than in the filename. Scope comes from the path: `/sw.js?v=…` is still
`/sw.js`, so `getRegistration()` finds the same registration and updates it.
`/sw-<id>.js` would have been a *second* registration, orphaning the first along
with the `PushSubscription` that belongs to it — and nothing on screen would
have said so. A test asserts the pathname for that reason alone.

**One read of the deployment id, so the two callers cannot disagree.**
`loadedDeploymentId()` moved out of `components/update-notice.tsx` into
`lib/version/update-check.ts`. The notice compares it against the live one and
the registration keys its URL on it; both now mean the same "which build served
this document", taken from the same `data-dpl-id` attribute.

**The reload button's `registration.update()` is close to a no-op now**, and is
kept for the build that has no id. Where the URL is versioned, what swaps the
worker is the reloaded page registering the new build's URL. Where it is not,
that call is the only thing the browser has to go on.

**The cost is that a deploy now empties the caches**, which is the point but is
worth stating plainly: the first load after a deployment re-fetches the shell,
and an old-build tab left open *and* offline loses the chunks it had cached.
Online that tab is fine — `?dpl=` keeps serving it the deployment it was built
against — and Next's skew protection hard-navigates its next navigation anyway.

**Not watched in a browser.** All four checks pass, and `/sw.js?v=…` is
confirmed against `next start` to answer 200 as JavaScript with
`no-cache, no-store, must-revalidate` — the query does not miss the header rule
or the static file. What nobody has seen is the second worker installing on a
real device, which is the only place the whole claim is checkable.

### Feature 11 — Loading skeletons ✅ merged (PR #40)

- [x] A `Skeleton` primitive, and a kit of section shapes every fallback is
      built from
- [x] A `loading.tsx` for every route, each mirroring that page's own layout
- [x] Filters, month arrows and the range picker fall back in place, behind
      `<Suspense>` boundaries keyed on what they change
- [x] The topbar's three queries moved below their own boundary, so the shell
      no longer waits on a notification count
- [x] A test that fails when a route loses its skeleton

**One shape per page, not one spinner for all of them.** The old
`(dashboard)/loading.tsx` was a centred spinner, and being the only file of its
kind it answered every route under the group. A skeleton is worth more than a
spinner only if it is the shape of what is arriving; a generic one that resolves
into a different layout is a page that appears to change its mind. So each route
has its own, and the shapes are composed from one kit in
`components/skeletons/` rather than drawn twice.

**A route's `loading.tsx` renders _inside_ its layout, which is what forced the
topbar apart.** The layout awaited the space, the space list, the notifications
and the unread count before returning anything — and an awaiting layout blocks
its own children's fallback too, so the "instant" loading state could not appear
until the slowest of those four had answered. Only the space is awaited now,
because that call is the authorization gate and a `redirect()` cannot be issued
once streaming has started. The other three moved into `AppTopbarControls`,
below a `<Suspense>` of their own.

**`loading.tsx` does not fire on a search-param change**, and every filter in
this app is a search param. The segment never unmounts, so its fallback belongs
to the first visit; changing a filter leaves the old rows on screen until the
new ones arrive, which reads as a click that did nothing. The fix is a
`<Suspense>` boundary **keyed** on the params — the key is what makes React
treat it as a new boundary and show the fallback again. Three pages needed it:
transactions (keyed on the whole filter set), budgets (on the month) and reports
(on the range).

**Which meant splitting each of those pages in two.** The control and the header
render from the URL and stay; only the part that depends on the answer is inside
the boundary. That is deliberate beyond the mechanics: blanking the filter bar
while its own results reload takes away the control the reader would reach for
next. It also removed a dependency the budgets page did not need —
`monthWindow(month)` is pure, so the month label beside the arrows no longer
waits for the overview query that used to supply it.

**A fallback has to reproduce the container, not just the contents.** The
topbar controls are a flex row; the first version of the fallback was a flex
*item* where the content was a flex *container*, so the switcher sized
differently in the two states and the header jumped as it resolved. Both sides
now render the same wrapper. The same rule is why the skeleton rows carry the
real `divide-y`, the real `size-8` chip and the meters' `rounded-full`, which is
set explicitly rather than taken from `--radius`.

**The pulse is behind `motion-safe`.** Reduced motion leaves a static block,
which still says "not here yet" — the shape carries that, not the animation.

**One `role="status"` per screen.** The blocks are `aria-hidden` and a single
sr-only line says what is loading; a dozen empty divs announced one at a time is
noise. The topbar's fallback announces nothing at all, since it is on every
navigation and would interrupt the page actually being asked for.

**Guarded structurally, not by rendering.** Components are not tested here, and
a skeleton is a weak candidate for a render test. But this is the rare
presentation bug that fails _silently_: a fallback is on screen for a few
hundred milliseconds, so a route that lost its `loading.tsx` looks fine in every
screenshot and merely feels slower — and under `(dashboard)` it does something
worse, inheriting the dashboard's own skeleton. `app/loading-states.test.ts`
walks the routes and fails when one has no fallback and no stated reason for
having none. Checked against the broken state: moving `goals/loading.tsx` aside
fails it.

**Not exercised in a browser.** All four checks pass and every route still
answers — dashboard routes 307 to sign-in, `/accept-invitation/[id]` and
`/sign-in` answer 200 — but signing in needs the owner's own credentials, so
nobody has watched a skeleton resolve into its page. The layout and topbar
change is the part worth a look first, since it is on every screen.

### Feature 8 — Installable PWA ✅ merged (PR #27), completed by PR #29

- [x] `app/manifest.ts` — name, standalone display, categories, icons
- [x] A real icon set: 192, 512, 512 maskable, 180 apple-touch, two 32px favicons
- [x] `themeColor` per colour scheme, and the `appleWebApp` metadata iOS needs
- [x] Fixed four icon references in the root layout that had always 404ed
- [x] A service worker, without which Chrome never offers to install
- [x] An iOS install hint, because Safari never offers either

**A manifest and icons do not make an app installable.** #27 shipped both,
correct and verified, and no prompt ever appeared on any device. There are two
unrelated reasons, and each needed its own answer:

**Chrome requires a registered service worker with a `fetch` handler.** Not
offline support — the handler. The Next guide's line that install prompts work
"without needing offline support" is true and was misread here as meaning no
worker at all. `public/sw.js` now exists to satisfy exactly that and does
nothing else: it caches nothing, because every dashboard page is dynamic and
cookie-gated, and caching one would put somebody's balances in a phone's
browser cache. Chrome has said it may eventually require a valid offline
response rather than merely a handler; that is the one thing that would force
this decision open again.

**Safari has never shown an install prompt and never will.** On iOS the only
route is Share ▸ Add to Home Screen, so the app says so itself — a dismissible
hint, shown only on iOS, only when not already running standalone, and only
until it is dismissed. It renders after mount rather than on the server:
it depends on the user agent and on `localStorage`, and deciding it server-side
would make every page vary by user agent.

**Deliberately not included: offline support and push notifications.** Neither
is needed to be installable — the browser prompt asks for a manifest, icons and
HTTPS, nothing more. Push is the next slice when there is something worth
notifying about; offline is a bigger question than it sounds, because every
dashboard page is dynamic and cookie-gated, so caching pages means writing
somebody's balances to disk. See the follow-up below.

**The icons are cropped out of `design/icons-sheet.png`.** That file is a
presentation mockup rather than an export — seven tiles laid out on one
transparent 1536×1024 canvas — so the assets were extracted by flood-filling
the alpha channel to find each tile's bounding box, cropping square around it,
and resizing. The sheet is kept out of `public/` because everything there is
served: it is 1.5 MB, and nothing should be able to fetch it.

**The supplied maskable tile was a circle**, which is precisely what a maskable
icon cannot be — Android masks a full square itself, so transparent corners
punch through to whatever is behind. The one shipped is built from the square
tile instead: opaque background, art at 88%, which keeps the mark inside the
safe circle.

**The 512 is upscaled from a 425px tile**, so it is slightly soft. It is the
largest art the sheet contains. Re-export from the original at 512 and rerun
the crop if it ever looks wrong on a device.

### Feature 9a — Notifications, in-app ✅ merged (PR #32)

- [x] `notifications` table, one row per recipient, keyed against duplicates
- [x] Budget overspend, raised at write time
- [x] Recurring entries, raised as each occurrence is materialised
- [x] A bell in the topbar with an unread dot, and mark-read
- [x] Scheduled the recurring sweep, which nothing had ever called

**In-app first, push as a layer on top.** The same shape as invitations, where
the copyable link is the mechanism and the email sits above it. Push can be
denied, is only delivered to an installed PWA on iOS, and fails silently; if
the notification existed only as an OS toast then a denied permission would
mean the overspend was never recorded anywhere. Stored, it is durable, it can
be read later, and it can be tested without a push round trip.

**Both triggers hang off writes that already happen.** Crossing a budget is
*caused* by recording an expense, so the check runs there rather than on a
sweep — noticed when it happens, not when someone next opens the app. A
recurring entry is announced as it is materialised. Neither needs a scheduler
to be correct.

**`dedupeKey` carries the whole feature.** Unique on
`(organizationId, userId, dedupeKey)`. Every caller can run twice: the second
expense of an overspent month crosses the same limit again, and the cron sweep
races page loads. The key makes the repeat a no-op at the database, which is
the same answer the `(organizationId, recurringId, date)` occurrence key gave
the entries themselves. Keyed on the budget and its window, not on the entry —
keying on the entry would notify per purchase.

**Raising one can never fail the write that caused it.** Every call follows a
write that has already succeeded, so `notifySpace` catches and logs rather than
throwing. An expense that was recorded stays recorded even if the notice fails.
Six tests break if that `catch` is removed, including the materialiser's own —
which is the point.

**Overspend costs one query in the usual case.** Most categories have no
budget, and `findByCategory` answers that without summing a window. Only when a
limit exists is the spend computed, through the same
`sumBaseAmountByCategory` + `windowFor` pair the budgets page reads. A second
way to decide what "over" means would eventually disagree with the bar on
screen.

**No `createdBy` / `updatedBy`,** unlike every other space-scoped table. Nobody
authors a notification: it is raised by a write somebody else made, or by a
cron sweep with no acting user at all. A nullable attribution column that is
usually null would invite reading null as "system".

**`/api/cron/materialise-recurring` is now scheduled**, daily at 04:00, an hour
after the rate refresh so conversions have fresh rates. It had existed, guarded
and correct, and nothing had ever called it — so occurrences only appeared when
someone opened the app. A notification saying "your rent was recorded" is worth
nothing if the recording waits for you to look.

---

## Environment

| Variable                | Needed for       | Notes                                          |
| ----------------------- | ---------------- | ---------------------------------------------- |
| `BETTER_AUTH_SECRET`    | Auth             | `openssl rand -base64 32`                      |
| `BETTER_AUTH_URL`       | Auth             | Stable production domain, not the deploy URL   |
| `DATABASE_URL`          | Runtime          | Pooled Neon connection. Same endpoint as below |
| `DATABASE_URL_UNPOOLED` | Migrations       | Direct connection. Needed in Production too    |
| `RESEND_API_KEY`        | Invite email     | Set                                            |
| `RESEND_FROM`           | Invite email     | **Not set.** Needs a domain verified in Resend |
| `ALLOW_PUBLIC_SIGNUP`   | Sign-up gate     | Defaults to `false`                            |
| `CRON_SECRET`           | Both cron routes | Set. Both refuse to run without it             |
| `VAPID_PUBLIC_KEY`      | Web push         | Same value as the `NEXT_PUBLIC_` one below     |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push  | The browser needs it to subscribe              |
| `VAPID_PRIVATE_KEY`     | Web push         | Server-side only; signs every push             |
| `VAPID_SUBJECT`         | Web push         | `mailto:` contact for the push services        |
| `NEXT_DEPLOYMENT_ID`    | Update notice    | Unset. Vercel's own id is used; see below      |

**On `NEXT_DEPLOYMENT_ID`:** nothing needs to set it. `deploymentId()` falls
through to `VERCEL_DEPLOYMENT_ID`, then the commit sha, then `VERCEL_URL`, each
of which changes on every deployment — which is the only property the update
notice needs. Set it by hand to exercise the notice locally, since `next build`
belongs to no deployment: build under one value, `pnpm start` under another, and
the page and the endpoint disagree exactly as they would after a deploy.

**On the two database URLs:** they are the pooled and direct connections of one
Neon endpoint, and `drizzle.config.ts` refuses to migrate if they are not — see
Gotchas.

**There are two databases**, each with its own endpoint and so its own pair of
URLs. Production has one, reached only by `main`; every other branch shares the
other with local development. `ep-lingering-grass-avsghlb7` is the endpoint that
was verified on 2026-08-14 — _which of the two roles it now holds is not
recorded here, and the other endpoint's id is not recorded at all._ Fill both in
when next in the Neon dashboard.

Both were **fresh databases** as of 2026-08-14, holding no data. The first
account to sign up on either is allowed through by the bootstrap, so a personal
space is created on sign-up as normal — and the two databases have separate
accounts, so signing up in development does not create the production owner.
`pnpm db:seed` is there if demo data is wanted instead.

**Production migrates itself on deploy.** Nobody applies migrations to the
production database by hand, so `vercel.json` points Vercel's build command at
`pnpm run build:deploy`, which runs `scripts/migrate-on-deploy.ts` before
`next build`. **Exercised for the first time by the 2026-08-14 release**, which
went green — so the production environment does hold both connection strings,
and they do address one endpoint. It acts only when `VERCEL_ENV` is
`production`; the development database stays the developer's to migrate. See
the follow-up at the end for why a release checklist was not enough.

**On `CRON_SECRET`:** neither cron route runs without it, and that was
survivable by design. Rates are fetched on demand when a conversion misses the
cache, and recurring entries are materialised when someone loads a page. It buys
freshness in a space nobody has opened, not correctness. **It is now set** —
earlier notes here saying otherwise were stale.

**Both routes are scheduled.** `vercel.json` lists `/api/cron/refresh-rates` at
03:00 and `/api/cron/materialise-recurring` at 04:00, an hour apart so
conversions have fresh rates. The second was added in #32 — before that it was
a guarded endpoint nothing had ever called, and occurrences appeared only when
somebody opened the app, which made "your rent was recorded" a message that
waited for you to look. On-read catch-up is still the guarantee; the schedule is
the accelerator for a space nobody opens.

**On `RESEND_FROM`:** Resend only sends from a domain you have verified via DNS.
`onboarding@resend.dev` works with no setup but delivers **only** to the Resend
account's own address, so it cannot reach family members. A `*.vercel.app`
domain cannot be verified — you do not control its DNS. Until a real domain is
verified, invites work by copying the link.

**On Vercel Deployment Protection:** it is **on**, and it is not an app setting,
so no amount of correct configuration inside the app works around it. Checked
against the first production deployment: `/` and `/sign-up` both answer `302` to
`vercel.com/sso-api`, meaning every request is gated behind the Vercel account's
own login before it ever reaches Next.js. Invited family members would hit a
Vercel sign-in page for an account they do not have. Production has to be set
public in Settings → Deployment Protection before anyone else can use the app.

**On `BETTER_AUTH_URL` and which URL to use:** every deployment gets a unique
hash URL (`…-2qbchvrkd-….vercel.app`), and the project also has a stable domain.
Use the stable one. Invitation links are built from this value and sit in
someone's inbox for days, so pointing it at a per-deployment URL means every
link dies at the next deploy.

---

## Gotchas

Things already hit, so they are not hit twice.

- **The update notice is silent on a cold start, by design.** It compares the
  id the *document* loaded against `/api/version`, and a freshly opened app is
  already running the new build — so they agree and nothing shows. It also does
  not check on mount; the listeners are `focus`, `visibilitychange` and a
  five-minute interval, because the first useful moment is the first time a tab
  is returned to. **To see the banner, the deploy has to land while the app is
  already open**, then background and foreground it. Opening the app after a
  deploy and seeing no banner is the feature working. This was read as a fault
  the first time it was tested on a real device.
- **Never hand-write a `<head>` in the root layout.** Next owns it in the App
  Router. A `<head>` of your own renders, and the page looks right, but React
  re-creates its children on the client: it logs "Encountered a script tag while
  rendering React component" on every load and substitutes a `<div>` for the
  script. That warning is **dev-only** — it exists solely in React's
  `.development.js` builds — so `build` cannot see it and neither can the tests.
  An inline script that must beat the first paint goes at the **top of `<body>`**
  instead: a synchronous script blocks the parser where it stands, so it still
  runs before the markup below it is parsed. `lib/pwa/splash.ts` is the example.
- **`next/script` cannot run anything before the first paint**, whatever the
  strategy says. `strategy="beforeInteractive"` does not put the source in the
  document head; it compiles to a `self.__next_s.push([...])` in the body, which
  Next's runtime drains at hydration. For a theme gate or a splash gate —
  anything whose whole job is to be finished before the browser paints — that is
  far too late, and the failure is a visible flash rather than an error. Use a
  raw inline `<script>`; `next-themes` does exactly that for the same reason.
- **The service worker will serve stale JS and CSS to `localhost` across branch
  switches.** Turbopack's dev chunk URLs are stable rather than content-hashed,
  so `financeflow-shell-v1` keeps answering for a chunk name whose contents have
  since changed — and it survives restarting the dev server *and* deleting
  `.next`. This cost real time once: new CSS appeared not to apply at all, the
  splash mark rendered at 1905px instead of `5rem`, and `curl` and the browser
  disagreed about the bytes at one URL. **If styles or scripts look impossibly
  stale, suspect the worker before the code**: unregister it and delete the
  caches in the console, or the symptom outlives every other thing you try.

- **`error.tsx` takes `unstable_retry`, not `reset`** — Next 16.2 added it, and
  it is not the signature most references still show. Both props exist, which is
  what makes it quiet: `reset` compiles, renders, and gives a "Try again" button
  that only clears the boundary and re-renders **without re-fetching**. Every
  page in this app fails by way of a query, so a `reset` button would have
  looked correct and never once recovered. Verified the right way round —
  clicking the real button produces a fresh render on the server.
- **An `error.tsx` never wraps the `layout.tsx` in its own segment.** It wraps
  `page.tsx`, `loading.tsx` and nested layouts, so `app/(dashboard)/error.tsx`
  cannot catch `app/(dashboard)/layout.tsx` throwing. That is where
  `requireActiveSpace()` runs, so the app's most likely layout failure lands one
  level up, in `app/error.tsx`.
- **drizzle-kit 1.0-rc needs `--hints`** for ambiguous column changes, and
  exits 2 without them.
- **Postgres will not cast integer to boolean** with `::boolean`. Use
  `USING (col <> 0)`, and drop the old default first.
- **better-auth rejects requests with no `Origin` header** (`MISSING_OR_NULL_ORIGIN`).
  Testing endpoints with curl needs `-H "Origin: http://localhost:PORT"`.
- **`createOrganization` activates the new space** immediately.
- **The `neon_auth` schema in the database is not ours.** It is an unused Neon
  Auth integration sitting alongside `public`. Consider disabling it in Neon.
- **`DATABASE_URL` and `DATABASE_URL_UNPOOLED` must be one database.** They are
  two variables describing the same Neon endpoint — pooled for the app, direct
  for drizzle-kit — and nothing keeps them in step. When they drifted onto
  different databases the failure was silent in the worst way: `db:migrate`
  reported success while applying to a database the app never opens, so the
  schema looked current and was not. `drizzle.config.ts` now compares the two
  hostnames (Neon's pooled host is the direct host with `-pooler` inserted) and
  throws before connecting. A migration is not something to run past a warning,
  so it refuses rather than warns.
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
- **The HTTP database driver has no interactive transactions,** but it does
  have batched ones. `db.batch` is a real transaction and rolls back — verified
  against the database by putting a constraint violation last in a batch and
  confirming the two successful statements before it were undone. Multi-step
  writes still have to compute everything that can fail _before_ writing
  anything, because a batch cannot read a result and decide what to write next.
- **A statement builder must not be an `async` function.** Drizzle query
  builders are thenables, so `async` awaits one on the way out and executes the
  statement then and there — exactly what a batch exists to avoid, and it fails
  silently by still returning something plausible. Every `…Statement` method is
  deliberately sync.
- **`(values …)` needs casts on its first tuple.** Postgres infers the column
  types of a `VALUES` list from its first row, so an uncast literal arrives as
  `text` and fails to compare against an `integer` id or assign to a `numeric`.
  Only the first tuple needs them; see `reconvertEntriesStatement`.
- **`process.env.FOO` is inlined into the server bundle at build time.** Not
  only the `NEXT_PUBLIC_` ones, and not only in client code — a literal
  `process.env.NEXT_DEPLOYMENT_ID` inside a route handler answers with whatever
  was set during `next build`, while `next.config.ts` is re-read when the server
  boots and answers with what is set *then*. Two reads of one variable
  disagreeing is a bug that only appears where the build environment and the run
  environment differ, which is nowhere on Vercel and everywhere in a
  build-once-run-anywhere setup. Index with a variable —
  `process.env[key]` — when the value has to be a runtime fact. See
  `lib/version/deployment.ts`.
- **The service worker cannot see a deployment.** `public/sw.js` is served
  as-is, so its bytes are identical from one deployment to the next and the
  browser's update check finds nothing — no `updatefound`, no waiting worker.
  Anything that needs to react to a deploy has to compare something that
  actually changes, which is what `deploymentId` is for. It also means the shell
  cache keeps the assets of every build it has seen, since `deploymentId` adds
  `?dpl=` to their URLs and a new query is a new cache key.
- **A `loading.tsx` renders inside its own layout, so an awaiting layout blocks
  it.** The fallback is nested _within_ `layout.tsx`, not around it — which
  means every `await` at the top of a layout delays the "instant" loading state
  as well as the page. A layout should await only what has to happen before
  anything is sent (here: the authorization gate, because `redirect()` stops
  being an HTTP redirect once streaming starts) and push the rest below a
  `<Suspense>` of its own. Next's own `loading.js` reference says this in one
  line and it is easy to read past.
- **`loading.tsx` does not fire again on a search-param change.** The segment
  stays mounted, so the fallback belongs to the first visit only and a filter
  change silently leaves the previous results on screen until the new ones land.
  A `<Suspense>` boundary with a `key` derived from the params is what shows a
  fallback for the second and every later navigation. Everything URL-driven in
  this app — transaction filters, the budget month, the report range — depends
  on this.
- **A Suspense fallback has to reproduce the container, not just the content.**
  A fallback that is a flex _item_ where the resolved content is a flex
  _container_ lays its children out differently, and the swap shows as a jump.
  The topbar controls hit exactly this. Where the boundary sits at a layout
  seam, render the same wrapper element on both sides of it.
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
- **`<SelectValue />` renders the raw `value`, not the chosen item's text.**
  Base UI resolves the trigger's label from the `items` prop on `Select` (the
  Root), _not_ from the `<SelectItem>` children — with no `items` it falls back
  to stringifying the value. So a picker backed by an id showed the id: the
  space switcher printed an organization id where the space's name belonged,
  and every category, author and preset picker did the same. Every `Select` now
  passes `items`, and the options are built once and mapped over for both the
  `items` prop and the `<SelectItem>` list, so the trigger and the list cannot
  drift apart. A label may be a `ReactNode`, which is how the switcher keeps its
  wallet/users icon in the trigger.
- **A `<Link>` nested inside a `<Button>` is only clickable where the text is.**
  The Button carries the padding, the height and the full width, but the anchor
  inside it is the only part that navigates — so the sidebar's tabs answered a
  click on the label and ignored one anywhere in the surrounding gap. It is also
  invalid HTML: an `<a>` cannot live inside a `<button>`.
- **A link that looks like a button is `buttonVariants`, not `<Button render>`.**
  The obvious repair for the nesting above is Base UI's `render` prop, and it is
  wrong: Base UI's own docs rule it out, because Button _enforces button
  semantics_. Left as-is it puts `type="button"` on an `<a>`; with
  `nativeButton={false}` it stamps `role="button"`, so a navigation link is
  announced as a button and loses every link affordance. Style the anchor
  instead — `className={cn(buttonVariants({ variant }), …)}` — which is one
  element, correctly announced, with the whole padded box clickable. `render` is
  still right for a Menu item, whose `role="menuitem"` is what a menu wants.
- **`<Button render={<Link/>}>` needs `nativeButton={false}`.** Without it Base
  UI believes it wrapped a native `<button>`: it logs "expected a native
  <button> because the `nativeButton` prop is true", and — the part that
  matters — `useButton` gates its link-aware keyboard handling behind
  `!isNativeButton`, so the anchor never gets it. The cost is a `role="button"`
  on the anchor, which is why Base UI's docs suggest styling the `<a>` with
  `buttonVariants` instead. Both patterns are in the tree: the sidebar and the
  create-space Cancel are styled anchors, everything else is `Button` +
  `render` + `nativeButton={false}`.
- **`nativeButton` must track a _conditional_ `render`.** Several controls pass
  `render={cond ? <Link/> : undefined}` so a dead-end page arrow is a disabled
  button rather than a link to nowhere. A static `nativeButton={false}` is then
  right for one branch and wrong for the other, and the wrong branch logs the
  mirror-image error about extra attributes. Tie it to the same condition —
  `nativeButton={!previous}`, `nativeButton={page.page <= 1}` — so it always
  describes what was actually rendered.
- **A PWA with no service worker is not installable in Chrome,** however
  correct its manifest is. The check is for a registered worker with a `fetch`
  handler; offline behaviour is not required, and an empty handler passes. The
  failure is silent — no console warning, no prompt, nothing to suggest the
  manifest is being read at all. Safari is a separate case: it has no prompt on
  any version, so iOS needs the app to explain Share ▸ Add to Home Screen.
- **`/sw.js` must not be cached, and must be served as JavaScript.** A cached
  worker is how a PWA gets stuck on an old build — the browser keeps serving
  the worker it has, and that worker is what would have told it to update.
  `next.config.ts` sets `no-store` and an explicit content type on that one
  path. Registration also passes `updateViaCache: "none"`, which is the half
  that does not depend on a host or a CDN honouring the header.
- **Guard the thing you are about to call.** `purgePrivateCaches` first tested
  `"caches" in window` and then called the *global* `caches`. In a browser both
  exist so it worked; under test the guard saw a stubbed `window` without the
  property and returned early, silently purging nothing. A check on one object
  and a call on another is a guard that can pass while its call still throws —
  or, as here, refuse while its call would have worked. Its test caught it.
- **A precached route must be public, or you cache the redirect.** The worker
  fetches `/offline` at install time with the user's cookies, so a guarded route
  would follow the proxy's 307 and store the *sign-in page* under `/offline`.
  The same trap applies to any navigation cached from a response that redirected,
  which is why `networkFirst` stores only a non-redirected basic 200.
- **A unique index treats nulls as distinct, so it stops guarding.** Postgres
  considers two nulls unequal, which means a unique index over a nullable
  column silently permits duplicates for exactly the rows that have none. It
  bit here when `notifications.organizationId` became nullable for
  account-level notices: the dedupe key would have kept working for every
  space-scoped row and quietly stopped working for invitations. `unique(...)
  .nullsNotDistinct()` fixes it — and note `uniqueIndex()` has no such option,
  so the constraint has to be a table constraint rather than an index.
- **Chrome checks a manifest icon's real pixels against its `sizes`.** An entry
  claiming `192x192` whose file is 276×284 is discarded, and with no valid 192
  and 512 the install prompt never appears at all — the app simply is not
  installable, with nothing on screen to say why. Check exports with their IHDR
  rather than their filenames.
- **`pnpm format` does not converge on this file.** Prettier's markdown printer
  adds four spaces to the continuation lines of a _second_ paragraph inside a
  `- [x]` item, every run — so two entries under Known follow-ups crept right by
  four spaces per `pnpm format` until they were indented past twenty columns.
  Nothing warns; it just looks like someone made a mess. `PLAN.md` is in
  `.prettierignore` for that reason, alongside the migrations, and its
  indentation is now hand-maintained. A single-line paragraph survives
  untouched, if a formatted version is ever wanted back.
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
      production audit. The advisories were counted against `main`, which lagged
      `dev` by every feature — GitHub still printed the 40 on the release push
      itself, since that scan predates the merge. `main` now carries the fixes,
      so the next scan should clear them. Worth a glance at the Dependabot tab
      to confirm it did.
- [x] ~~**A submitted `categoryId` is never scoped to the space.**~~ Fixed.
      `categoryService.assertUsable` is now the single answer to "may this space
      file under this id", and `transactionService.create` / `update` call it.
      Budgets and recurring templates already had the rule as a private method
      each; both now delegate, so there is one copy rather than the three this
      would have become. A wrong-space or deleted id is refused with
      `NOT_FOUND`, an income category on an expense with `VALIDATION_FAILED`,
      and `toUserMessage` passes both through — so the deleted-category race
      reads "That category no longer exists." instead of a foreign-key error.

      **A materialised occurrence is exempt.** The recurring machinery passes a
      category the template already validated, and `deleteCategory` refuses
      while a template still points at it, so the answer cannot have changed. A
      catch-up run writes up to sixty entries inside one page render, and a
      lookup each would be a query per entry for an answer already known. The
      exemption keys off `options.recurringId`, which only that machinery sets.

      Seven tests cover it, and each was checked against the unfixed code:
      disabling the create guard fails three, disabling the update guard fails
      one. Not verified against the database — the refusal happens above it.
- [x] ~~**PWA: offline support and push notifications.**~~ Push shipped in
      Feature 9b, offline **reads** in Feature 10. The question that had been
      deferred — whether pages may be cached, given that they are dynamic,
      cookie-gated, and full of balances — was answered "yes, if the cache ends
      with the session", which is why 10 purges at both ends of one. What is
      still open is offline _entry_: IndexedDB and a replay queue, with the same
      idempotency care the recurring materialiser needed. Still hand-written
      rather than Serwist, which the Next guide recommends and which requires
      webpack; this project builds with Turbopack.
- [x] ~~**The service worker never changes, so nothing it cached is ever
      reconsidered.**~~ Fixed by Feature 13. The registration is versioned
      (`/sw.js?v=<deployment id>`) rather than the file being made dynamic, so a
      deploy is a script change the browser can find and the `activate` cleanup
      finally runs. The route handler this note proposed was the more expensive
      half of the same idea — see the feature for why the query wins, and for
      the reason the version must not go in the *path*.
- [x] ~~**There is no `error.tsx` anywhere in `app/`.**~~ Fixed by Feature 14.
      Three boundaries — `(dashboard)`, root, and `global-error` — with the
      dashboard's being the one this note was asking for: a failed page keeps
      the sidebar, the topbar and the mobile navigation. What the note did not
      anticipate is that the group's boundary cannot catch its own
      `layout.tsx`, so `requireActiveSpace()` failing goes to the root
      boundary instead; see the feature for why that is right rather than a
      gap.
- [ ] `@better-auth/drizzle-adapter` declares a peer of `drizzle-orm@^0.45.2`
      against the installed `1.0.0-rc.4`. Works today; suspect it first if auth
      behaves oddly.
- [x] ~~No tests yet.~~ 255 unit tests across the RBAC policy, space scoping,
      currency conversion, the date arithmetic behind budgets, reports and
      recurring entries, and the atomicity of the two multi-table writes. Still
      untested: Server Actions, components, and anything that needs a database.
- [ ] `expenses` and `income` are structurally identical tables. A single
      `transactions` table with a `type` column would have been simpler; the
      shared query and service layer hide most of the cost, so this is only
      worth revisiting if a third kind ever appears.
- [x] ~~Reassigning a category updates four tables in four statements with no
      transaction to wrap them.~~ Now one `db.batch` — the three reassignments
      and the delete land together or not at all. Fixing it surfaced a real bug
      underneath: `budgets` was being reassigned along with the other three,
      which both contradicted the delete dialog (it counts budgets as
      _destroyed_, since they cascade) and tripped
      `budgets_organizationId_categoryId_period_key` whenever the replacement
      category already had a limit for the same period. Budgets are no longer
      moved; they cascade, as the dialog always said they would.
- [x] ~~Changing a space's base currency writes entries and budget limits as
      parallel un-transacted statements.~~ The switch, the entries and the
      budget limits are now one `db.batch`, so the space can no longer end up
      holding a mix of old- and new-currency amounts under an already-switched
      `baseCurrency`. The shared answer was the batched multi-statement write
      rather than a per-row marker — it fixed both instances without adding a
      column or a recovery path to maintain.

      The per-row updates became **one statement per table** on the way, joining
      against an inline `VALUES` list. Each entry converts at its own date and
      so needs its own figures; a space with years of history would otherwise
      have been thousands of statements in one request. The remaining ceiling is
      Postgres' 65535 parameters per statement — three per entry, so roughly
      20k entries, far past anything a household ledger will reach and much
      further than the old code got.

- [ ] Domain tables use camelCase column names while better-auth tables use
      snake_case. Consistent within each, inconsistent across.
- [x] ~~Finish the database verification of the batched writes.~~ Done — all 15
      checks pass against the real database, including the reassign-plus-delete
      batch that was outstanding. Confirmed on real rows: each entry gets its own
      figures from the `VALUES` join, original `amount`s are untouched, a
      wrong-space id changes nothing, entries and recurring templates land on the
      replacement category while the deleted category's budget cascades and the
      replacement keeps its own, and — the guarantee itself — a batch whose last
      statement violates a constraint rolls back the successful statements before
      it, leaving `baseCurrency` and the amounts as they were.
- [x] ~~`DATABASE_URL` and `DATABASE_URL_UNPOOLED` point at different
      databases.~~ Both now address one Neon endpoint
      (`ep-lingering-grass-avsghlb7`, pooled and direct), and both authenticate.
      `drizzle.config.ts` now **refuses to migrate** when the two disagree, so
      the silent version of this cannot come back — see Gotchas for what made it
      silent.
- [x] ~~Nothing applies migrations to the production database.~~ Splitting
      development and production onto separate Neon instances reopened the
      earlier failure from a new angle: `db:migrate` runs from a developer's
      `.env`, which now addresses development, so merging to `main` shipped code
      whose schema had never been applied to the database it would run against.
      The guard added for the split URLs could not catch it — it compares the two
      variables against _each other_, and in development both are correct.

      The production deploy now migrates its own database:
      `vercel.json` → `pnpm run build:deploy` → `scripts/migrate-on-deploy.ts`,
      then `next build`. Chosen over a release checklist because the whole class
      of bug is _forgetting_, and a checklist is another thing to forget. It
      applies migrations **only** when `VERCEL_ENV` is `production` — preview
      builds share the development database with whoever is working locally, and
      a preview build has no business migrating it out from under them. A failed
      migration exits non-zero and takes the build with it, so a deployment whose
      schema is missing never goes live. The `drizzle.config.ts` check runs
      inside that child process, so a mismatched pair in the production
      environment fails the build too.
