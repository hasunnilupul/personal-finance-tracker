import { NextResponse } from "next/server";

import { deploymentId } from "@/lib/version/deployment";

/**
 * Which build is answering right now.
 *
 * **Nothing in the app calls this.** It was built for the update notice, which
 * polled it and compared the answer against the id the page loaded with; that
 * notice was removed on 2026-08-19. The endpoint is kept because it is the
 * release check: every release record in PLAN.md since 2026-08-18 verifies the
 * live site by asking this and confirming it agrees with the `data-dpl-id` on
 * the page. Losing it would not break the app, only make it harder to tell
 * which build production is actually serving.
 *
 * Public on purpose, and there is nothing here worth guarding: the id is
 * already on every page as `data-dpl-id`, put there by Next's own
 * deployment-id support. `/api/*` is outside the proxy's matcher, so it is
 * reachable without a session by default rather than by an exception.
 *
 * `no-store` matters more than it looks. A cached answer here is an answer
 * about the *previous* deployment, which is the one thing it must never say.
 * `force-dynamic` keeps the route out of the build's static output, where its
 * answer would be frozen and CDN-cacheable.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { deploymentId: deploymentId() ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
