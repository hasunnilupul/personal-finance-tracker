<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Where the work stands

Read [PLAN.md](./PLAN.md) before starting anything. It holds the current
position, the decisions already made, the conventions to follow, and a list of
gotchas already hit in this codebase.

Update PLAN.md as part of the feature's own commit — tick the boxes, move the
"Current position" marker, and record anything newly learned.

# Branch workflow

One feature per branch, one PR per feature. See the Workflow section of
PLAN.md for the full steps. In short:

1. Branch from the latest `origin/dev`.
2. Build the feature on that branch.
3. When it is done, `git pull origin dev` into the branch and re-run the checks.
4. Open a PR into `dev` **before** switching away from the branch.
5. **Stop and ask the repo owner to merge.** Do not begin the next feature or
   create the next branch until that PR is merged.
