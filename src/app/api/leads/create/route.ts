// POST /api/leads/create — THE submission path.
//
// Phase 1 rewrote this. It used to write ads.leads and fire a Meta CAPI event, a generic
// confirmation and an ops alert, with no honeypot, no rate limit and no origin check: a
// plain curl against a protected preview deployment wrote a row into the production table.
//
// It now writes public.Lead, which is canonical, through src/lib/lead/ingest.ts. ads.leads
// is no longer written by anything. The response shape is unchanged — { ok, lead_id } —
// so every existing caller keeps working.
//
// LEADS_API_ENABLED still gates the whole thing, and still answers { ok: true, no_op: true }
// so the route shape can be deployed without going live.

import { NextRequest, NextResponse } from "next/server";
import { ingestLead, type LeadBody } from "@/lib/lead/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (process.env.LEADS_API_ENABLED !== "true") {
    return NextResponse.json({ ok: true, no_op: true });
  }

  const result = await ingestLead(body, req);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  // A honeypot rejection lands here: ok, 200, no lead id. The caller renders its success
  // state and the bot learns nothing about which field betrayed it.
  if (!result.leadId) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({
    ok: true,
    lead_id: result.leadId,
    env: result.env,
    ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
  });
}
