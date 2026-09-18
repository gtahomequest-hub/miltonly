// The one-click unsubscribe for every recurring email. The handler and its reasons live in
// src/lib/email/unsubscribeHandler.ts; this file only mounts it.

import { NextRequest } from "next/server";
import { handleUnsubscribe } from "@/lib/email/unsubscribeHandler";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleUnsubscribe(request);
}

export async function POST(request: NextRequest) {
  return handleUnsubscribe(request);
}
