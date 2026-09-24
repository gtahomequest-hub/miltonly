// POST /api/privacy/request: the personal information removal request (MC-036, item 12).
//
// The decision is src/lib/privacy/request.ts. This file is the guards and the headers off the
// request, in the order the portal door runs them: honeypot, origin, then the rate limit, with
// the same answers. A trapped bot gets 200 and a reference-shaped nothing, so it learns
// nothing; a refused origin or a hammered address gets the guard's status and words.
//
// Not a lead. It does not touch /api/leads/create, ingestLead or the Lead table, and it is not
// in scripts/test-lead-forms.ts's surface list because it is not a lead surface; the honeypot
// field name is the shared one so the walk there still recognises the trap.

import { NextRequest, NextResponse } from "next/server";
import { checkHoneypot, checkOrigin, checkRateLimit } from "@/lib/lead/guards";
import { submitPrivacyRequest, validatePrivacyRequest, FALLBACK_EMAIL } from "@/lib/privacy/request";
import { resolveLeadEnv } from "@/lib/lead/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

const NOT_RECORDED = `The request could not be recorded. Email ${FALLBACK_EMAIL} and it will be handled by hand.`;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const trapped = checkHoneypot(body);
  if (!trapped.ok) {
    console.warn("[privacy/request] trapped", { reason: trapped.reason });
    return NextResponse.json({ ok: true, reference: null });
  }

  const origin = checkOrigin(req.headers.get("origin"), req.headers.get("referer"));
  if (!origin.ok) {
    console.warn("[privacy/request] refused", { reason: origin.reason });
    return NextResponse.json({ ok: false, error: origin.error }, { status: origin.status });
  }

  const verdict = validatePrivacyRequest(body);
  if (!verdict.ok) {
    return NextResponse.json({ ok: false, error: verdict.error }, { status: 400 });
  }

  const limit = await checkRateLimit({ ip: clientIp(req), email: verdict.input.email });
  if (!limit.ok) {
    console.warn("[privacy/request] refused", { reason: limit.reason });
    return NextResponse.json({ ok: false, error: limit.error }, { status: limit.status });
  }

  const result = await submitPrivacyRequest(verdict.input, new Date(), resolveLeadEnv(req.headers.get("host"))).catch((err) => {
    console.error("[privacy/request] failed", err);
    return null;
  });
  if (!result || !result.recorded) {
    return NextResponse.json({ ok: false, error: NOT_RECORDED }, { status: 503 });
  }

  return NextResponse.json({ ok: true, reference: result.reference });
}
