// The alert sender. Runs on the cron in vercel.json.
//
// PHASE 1 CHANGED THREE THINGS AND EACH ONE WAS A REASON IT HAD NEVER SENT ANYTHING:
//
//  1. It had no cron entry. Thirteen jobs were registered in vercel.json and this was not
//     one of them, so the only alert sender in the codebase had never run on a schedule.
//  2. It only accepted POST. Vercel crons issue GET, so the entry alone would not have been
//     enough. GET and POST now share one handler and the same auth the other jobs use
//     (Authorization: Bearer <CRON_SECRET>, or ?secret= for a manual run).
//  3. It required `search.user.verified`, and a saved search created by an alert signup has
//     no User at all — it carries an email. That gate silently excluded every row the lead
//     surfaces create. A row now resolves its recipient from the user when there is one and
//     from `email` when there is not, and the verified gate applies only to the former.
//
// `kind` chooses the query. "brief" is not sent here: the daily brief is a digest of what
// changed, not a match notification, and its sender is a later step.

import { prisma } from "@/lib/prisma";
import { sendDealAlertEmail } from "@/lib/email-user";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && (bearer === expected || query === expected);
}

interface Recipient {
  email: string;
  firstName: string | null;
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";

  const searches = await prisma.savedSearch.findMany({
    where: { alertEnabled: true, kind: { not: "brief" } },
    include: { user: true },
  });

  let sent = 0;
  let skipped = 0;
  const report: Array<Record<string, unknown>> = [];

  for (const search of searches) {
    // Recipient. A row with a User keeps the verified gate — that address was never
    // confirmed otherwise. A row with an email came from a lead surface, where the address
    // IS the thing the visitor typed and the only thing they gave us.
    let to: Recipient | null = null;
    if (search.user) {
      if (search.user.verified) to = { email: search.user.email, firstName: search.user.firstName };
    } else if (search.email) {
      to = { email: search.email, firstName: null };
    }
    if (!to) {
      skipped++;
      report.push({ id: search.id, kind: search.kind, skipped: "no deliverable recipient" });
      continue;
    }

    const since = search.lastAlertAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where: Record<string, unknown> = {
      status: "active",
      permAdvertise: true,
      createdAt: { gte: since },
    };

    if (search.propertyType) where.propertyType = search.propertyType;
    if (search.neighbourhood) where.neighbourhood = { contains: search.neighbourhood, mode: "insensitive" };
    if (search.streetSlug) where.streetSlug = search.streetSlug;
    if (search.priceMin || search.priceMax) {
      const price: Record<string, number> = {};
      if (search.priceMin) price.gte = search.priceMin;
      if (search.priceMax) price.lte = search.priceMax;
      where.price = price;
    }
    if (search.bedsMin) where.bedrooms = { gte: search.bedsMin };
    if (search.bathsMin) where.bathrooms = { gte: search.bathsMin };
    if (search.transactionType) where.transactionType = search.transactionType;

    // A watch with no criterion at all would match every active listing in Milton. Those
    // rows are not created any more (see src/lib/lead/savedSearch.ts) and any that predate
    // the rule are refused here rather than sent.
    const hasCriterion = Boolean(
      search.streetSlug || search.neighbourhood || search.propertyType ||
      search.priceMin || search.priceMax || search.bedsMin || search.bathsMin,
    );
    if (!hasCriterion) {
      skipped++;
      report.push({ id: search.id, kind: search.kind, skipped: "no criterion; would match every listing" });
      continue;
    }

    const matches = await prisma.listing.findMany({
      where,
      select: { address: true, price: true, mlsNumber: true, propertyType: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    if (matches.length === 0) {
      report.push({ id: search.id, kind: search.kind, matches: 0 });
      continue;
    }

    if (dryRun) {
      report.push({ id: search.id, kind: search.kind, matches: matches.length, to: to.email, dryRun: true });
      continue;
    }

    await sendDealAlertEmail(
      to.email,
      to.firstName,
      search.name,
      matches.map((m) => ({
        address: m.address,
        price: m.price,
        mlsNumber: m.mlsNumber,
        propertyType: m.propertyType || "Home",
      })),
    );

    await prisma.savedSearch.update({
      where: { id: search.id },
      data: { lastAlertAt: new Date(), lastMatchCount: matches.length },
    });

    sent++;
    report.push({ id: search.id, kind: search.kind, matches: matches.length, to: to.email, sent: true });
  }

  return NextResponse.json({
    success: true,
    alertsSent: sent,
    searchesChecked: searches.length,
    skipped,
    dryRun,
    report,
  });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
