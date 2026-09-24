// The deployment identity, readable without a credential.
//
// scripts/verify/run.mjs asserts the host is serving the build under test before it runs a
// single content check. /api/ping already returns this SHA, but its Bearer CRON_SECRET is set
// for Production only, so it answers 401 on every preview — precisely the deployments the gate
// exists to guard. An identity probe that only works in production cannot gate a preview.
//
// So this returns the commit SHA, the build time and the environment name, nothing else.
// A commit SHA is an opaque hash that reveals nothing about repository contents, and it is
// already implicit in the immutable asset URLs every deployment serves. The build time
// (BUILD_AT, inlined by next.config.mjs at build) is what the battery's prerender-coverage
// check draws the pre-build street set from (MC-035); the environment name says whether the
// build prerendered the corpus (production) or fifty (preview). Neither is a secret: the
// deployment list shows both.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    builtAt: process.env.BUILD_AT || null,
    env: process.env.VERCEL_ENV || "local",
  });
}
