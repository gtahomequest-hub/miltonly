import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyNewLead } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { propertyType, budget, bedrooms, phone, source } = body as {
      propertyType?: string;
      budget?: string;
      bedrooms?: string;
      phone?: string;
      source?: string;
    };

    if (!propertyType || !budget || !bedrooms || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }

    // Map "3+" / "4+" → integer for Lead.bedrooms
    const bedsMatch = bedrooms.match(/(\d+)/);
    const bedsInt = bedsMatch ? parseInt(bedsMatch[1], 10) : null;

    // Score: $1.5M+ → hot, $700K+ → warm, otherwise cold
    const isHot = budget.includes("$1.5M") || budget.includes("$2M");
    const isWarm = budget.includes("$900K") || budget.includes("$1.2M");
    const score = isHot ? "hot" : isWarm ? "warm" : "cold";

    // Attribution capture — see src/lib/attribution.ts. Sent by OffMarketForm.tsx
    // via attributionPayload() spread into the fetch body. Missing on legacy
    // submissions (pre-2026-05-11) — fields default to null.
    const utmSource = (body.utm_source || "").toString().slice(0, 80) || null;
    const utmMedium = (body.utm_medium || "").toString().slice(0, 80) || null;
    const utmCampaign = (body.utm_campaign || "").toString().slice(0, 120) || null;
    const utmKeyword = (body.utm_term || "").toString().slice(0, 120) || null;
    const utmContent = (body.utm_content || "").toString().slice(0, 120) || null;
    const gclid = (body.gclid || "").toString().slice(0, 200) || null;
    const utmSourceLast = (body.utm_source_last || "").toString().slice(0, 80) || null;
    const utmMediumLast = (body.utm_medium_last || "").toString().slice(0, 80) || null;
    const utmCampaignLast = (body.utm_campaign_last || "").toString().slice(0, 120) || null;
    const utmTermLast = (body.utm_term_last || "").toString().slice(0, 120) || null;
    const utmContentLast = (body.utm_content_last || "").toString().slice(0, 120) || null;
    const gclidLast = (body.gclid_last || "").toString().slice(0, 200) || null;
    const landingPage = (body.landingPage || "").toString().slice(0, 300) || null;
    const firstVisitAt = body.firstVisitAt ? new Date(body.firstVisitAt) : null;

    const lead = await prisma.lead.create({
      data: {
        firstName: "Off-Market Subscriber",
        email: "",
        phone: phoneDigits,
        intent: "buyer",
        score,
        scorePoints: 30,
        bedrooms: bedsInt,
        propertyType: propertyType.toLowerCase(),
        notes: `Off-market list signup — Budget: ${budget}`,
        source: source || "homepage-exclusive",
        utmSource,
        utmMedium,
        utmCampaign,
        utmKeyword,
        utmContent,
        gclid,
        utmSourceLast,
        utmMediumLast,
        utmCampaignLast,
        utmTermLast,
        utmContentLast,
        gclidLast,
        landingPage,
        firstVisitAt,
      },
    });

    // Fire email to Aamir (non-blocking). notifyNewLead BCCs the kvCORE
    // lead-parse address when KVCORE_LEAD_PARSE_EMAIL is set.
    notifyNewLead(
      {
        firstName: "Off-Market Subscriber",
        phone: phoneDigits,
        propertyType,
        budget,
        bedrooms,
        intent: "off-market list",
        timeline: "ASAP",
        source: source || "homepage-exclusive",
        gclid: gclid || undefined,
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        utm_term: utmKeyword || undefined,
        utm_content: utmContent || undefined,
        landingPage: landingPage || undefined,
      },
      lead.id
    ).catch((e) => console.error("[off-market-lead] notify error:", e));

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("[off-market-lead] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
