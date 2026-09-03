// The deployment identity, readable without a credential.
//
// scripts/verify/run.mjs asserts the host is serving the build under test before it runs a
// single content check. /api/ping already returns this SHA, but its Bearer CRON_SECRET is set
// for Production only, so it answers 401 on every preview — precisely the deployments the gate
// exists to guard. An identity probe that only works in production cannot gate a preview.
//
// So this returns the commit SHA and nothing else: no timestamp, no environment, no config.
// A commit SHA is an opaque hash that reveals nothing about repository contents, and it is
// already implicit in the immutable asset URLs every deployment serves.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown" });
}
