// Estimated lead value for Meta's optimizer.
//
// PHASE 1 RETIRED createLead. ads.leads is no longer written by anything: public.Lead is
// canonical and src/lib/lead/ingest.ts is the only write path. The existing ads.leads rows
// were copied across by scripts/migrate-ads-leads.ts with an "adsleads:" source tag, and the
// table keeps its history so the migration can be re-checked.
//
// estimateLeadValue stays, and is now reached through src/lib/lead/intent.ts, which
// normalizes the fourteen intent spellings the surfaces send into the three tokens this
// function understands. Every one of those surfaces was previously scoring 0.
//
// These are proxy values for Meta's bidding, NOT real commissions. They are intentionally
// small and constant so Meta can compare lead quality across campaigns without us shipping
// actual transaction economics to a third-party ad network.

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
