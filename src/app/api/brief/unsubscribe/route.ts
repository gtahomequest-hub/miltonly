// The brief's original unsubscribe path. Every link minted before ML-004 points here, and
// those links sit in inboxes for as long as the inbox does, so the path stays and runs the
// same handler as /api/unsubscribe. New links point at the generic path.

import { NextRequest } from "next/server";
import { handleUnsubscribe } from "@/lib/email/unsubscribeHandler";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleUnsubscribe(request);
}

export async function POST(request: NextRequest) {
  return handleUnsubscribe(request);
}
