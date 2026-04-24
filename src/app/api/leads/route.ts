import { prisma } from "@/lib/prisma";
import { notifyNewLead } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, email, phone, source, intent, street, timeline, hasAgent } = body;

    if (!firstName && !email && !phone) {
      return NextResponse.json({ error: "At least one contact field required" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: firstName || "Unknown",
        email: email || "",
        phone: phone || null,
        source: source || "website",
        intent: intent || "buyer",
        score: timeline === "ASAP" || timeline === "Within 1 month" ? "hot" : timeline === "1–3 months" ? "warm" : "cold",
        scorePoints: phone ? 30 : 0,
        street: street || null,
        timeline: timeline || null,
        hasAgent: hasAgent === "Yes" ? true : hasAgent === "No" ? false : null,
      },
    });

    // Send email notification (non-blocking)
    notifyNewLead(body, lead.id).catch((e) => console.error("Email notify error:", e));

    return NextResponse.json({ success: true, id: lead.id });
  } catch (e) {
    console.error("Lead creation error:", e);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
