import { NextResponse } from "next/server";

import { deploymentId } from "@/lib/version/deployment";

/**
 * Which build is answering right now.
 *
 * A tab compares this against the id it was served with; when they differ, the
 * app says so and offers a reload. That is the whole feature — everything else
 * about it is client-side.
 *
 * Public on purpose. It is the one thing an open tab has to be able to ask
 * while its session is expired or absent, and there is nothing here worth
 * guarding: the id is already on every page as `data-dpl-id`, put there by
 * Next's own deployment-id support. `/api/*` is outside the proxy's matcher, so
 * it is reachable without a session by default rather than by an exception.
 *
 * `no-store` matters more than it looks. A cached answer here is an answer
 * about the *previous* deployment, which is precisely the state this exists to
 * detect — the endpoint would then hide the update it was added to announce.
 * The service worker refuses to cache anything under `/api/` for the same
 * family of reasons, and `force-dynamic` keeps the route out of the build's
 * static output, where its answer would be frozen and CDN-cacheable.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { deploymentId: deploymentId() ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
