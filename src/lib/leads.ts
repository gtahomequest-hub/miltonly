// Lead persistence + estimated-value calculator for ads.leads.
//
// Two concerns live here:
//   1. createLead — single Prisma write into ads.leads. Returns the new row's
//      id plus the estimated dollar value used as Meta's optimizer signal.
//   2. estimateLeadValue — proxy values for Meta's bidding (NOT real
//      commissions). These are intentionally small and constant so Meta
//      can compare lead quality across campaigns without us shipping
//      actual transaction economics to a third-party ad network.

import { prisma } from "@/lib/prisma";

// Intent buckets that map to a proxy dollar value. Anything outside this
// set returns 0 so unrecognized leads don't ship a misleading signal.
export type LeadIntent = "rent" | "buy" | "sell";

// Proxy values for Meta's optimizer (CAD). Calibrated to relative
// commission size: a rental tenant is worth ~one month's commission to
// the agent, a buyer is ~4x that, a seller listing is ~10x. Not real
// money — Meta uses them to rank lead quality, not for our P&L.
const INTENT_VALUE: Record<LeadIntent, number> = {
  rent: 50,
  buy: 200,
  sell: 500,
};

export function estimateLeadValue(intent: LeadIntent | string | undefined): number {
  if (!intent) return 0;
  if (intent in INTENT_VALUE) return INTENT_VALUE[intent as LeadIntent];
  return 0;
}

// Source-of-truth shape for whoever calls createLead. camelCase to match
// the Prisma model (Prisma handles the @map to snake_case columns).
export interface CreateLeadInput {
  source: string;
  campaign?: string;
  intent?: string;
  name?: string;
  email?: string;
  phone?: string;
  timeline?: string;
  budget?: string;
  bedrooms?: string;
  neighbourhood?: string;
  propertyAddress?: string;
  notes?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  fbclid?: string;
  // Extra context that doesn't earn its own column. Persisted as JSONB.
  // Typical contents: fbp, fbc, event_id, event_source_url, user_agent,
  // ip_address, referrer.
  meta?: Record<string, unknown>;
}

export interface CreateLeadResult {
  leadId: string;
  estimatedValue: number;
}

// Single point of insertion for ads.leads. Throws on DB error so the
// caller can decide whether to 500 (route handler does exactly that
// before firing any side effects).
export async function createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
  const lead = await prisma.adsLead.create({
    data: {
      source: input.source,
      campaign: input.campaign ?? null,
      intent: input.intent ?? null,
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      timeline: input.timeline ?? null,
      budget: input.budget ?? null,
      bedrooms: input.bedrooms ?? null,
      neighbourhood: input.neighbourhood ?? null,
      propertyAddress: input.propertyAddress ?? null,
      notes: input.notes ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmContent: input.utmContent ?? null,
      fbclid: input.fbclid ?? null,
      meta: (input.meta ?? {}) as object,
    },
    select: { id: true },
  });

  return {
    leadId: lead.id,
    estimatedValue: estimateLeadValue(input.intent),
  };
}
