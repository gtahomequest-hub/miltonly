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
      },
    });

    // Fire email to Aamir (non-blocking).
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
      },
      lead.id
    ).catch((e) => console.error("[off-market-lead] notify error:", e));

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("[off-market-lead] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
