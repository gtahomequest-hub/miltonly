// One click, no account, no password, and it works from inside a mail client.
//
// The subscriber never had an account — an email address is the whole of what they gave us —
// so this is the only unsubscribe they can be offered, and it has to be genuinely one click.
// It answers HTML rather than JSON because the thing that follows the link is a browser, and
// it answers POST as well as GET so a mail client honouring RFC 8058 One-Click can use it.
//
// ONE HANDLER FOR EVERY WATCH KIND. The token signs a watch id (src/lib/email/unsubscribe.ts)
// and the row says what kind of mail it drives: a brief, a street or hub or price-band alert,
// or the leads digest. The page names what stops, and only that row is touched, so
// unsubscribing from a street alert leaves the same address's brief alone, and the reverse.
// Two routes mount this: /api/unsubscribe, which every new link points at, and
// /api/brief/unsubscribe, which links already sitting in inboxes point at.
//
// A signed link cannot be forged, so a bad or missing token is refused rather than treated as
// a sloppy but well-meant request. An unknown watch id reads as already unsubscribed: the
// outcome the person wanted is the outcome they see, and the page does not confirm or deny
// that an address is on the list.

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { verifyWatch } from "@/lib/email/unsubscribe";

function page(heading: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading} · ${config.SITE_NAME}</title><meta name="robots" content="noindex">
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f4ef;color:#073126;
    font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:24px}
  main{max-width:26rem}
  h1{font-size:1.35rem;margin:0 0 .6rem}
  p{margin:0 0 1rem;color:#334155}
  a{color:#017848}
</style></head><body><main>
<h1>${heading}</h1><p>${body}</p>
<p><a href="${config.SITE_URL}">Back to ${config.SITE_NAME}</a></p>
</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** What the page says has stopped, by watch kind. The row's `name` is the sender's own
 *  description of the watch ("New listings on Main Street"), so it is reused for alerts. */
export function whatStops(kind: string, name: string): string {
  switch (kind) {
    case "brief":
      return `The ${config.CITY_NAME} daily brief`;
    case "digest":
      return "The weekly leads digest";
    default:
      return name ? `The "${name}" alert` : "This alert";
  }
}

export async function handleUnsubscribe(request: NextRequest): Promise<NextResponse> {
  const watchId = request.nextUrl.searchParams.get("w")?.trim() ?? "";
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";

  if (!watchId || !token || !verifyWatch(watchId, token)) {
    return page(
      "That link did not work",
      `The unsubscribe link was incomplete or has expired. Reply to any email from us and we will take you off the list by hand, or email <a href="mailto:${config.realtor.email}">${config.realtor.email}</a>.`,
      400,
    );
  }

  const watch = await prisma.savedSearch.findUnique({
    where: { id: watchId },
    select: { id: true, kind: true, name: true, alertEnabled: true },
  });

  if (!watch) {
    return page("You are unsubscribed", "You will not receive that email again.");
  }

  if (watch.alertEnabled) {
    // The watch row is kept rather than deleted, so a re-subscribe from the same address
    // re-enables it instead of stacking a second one, and so the unsubscribe itself is a fact
    // on the record rather than an absence.
    await prisma.savedSearch.update({ where: { id: watch.id }, data: { alertEnabled: false } });
    console.log("[unsubscribe] disabled", { watchId: watch.id, kind: watch.kind });
  }

  return page(
    "You are unsubscribed",
    `${esc(whatStops(watch.kind, watch.name))} will stop. Nothing else changes, and no other email was affected.`,
  );
}
