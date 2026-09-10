// An alert surface promises recurring email, so it must leave behind something a sender can
// read. Before this, five surfaces promised alerts and nothing in the codebase read those
// rows: the only sender reads SavedSearch, and no lead surface created one.
//
// Three shapes, per the ruling: street, hub, price-band. Plus "brief" for the daily brief.
//
// A watch is created ONLY when there is a real criterion to watch. A SavedSearch with no
// street, no neighbourhood and no price band matches every listing in Milton, which is not
// what someone who left an area field blank asked for. In that case the Lead row still
// exists and the omission is logged rather than papered over with a watch nobody wanted.

import { prisma } from "@/lib/prisma";
import { streetNameToSlug } from "@/lib/streetUtils";
import { config } from "@/lib/config";

export type WatchKind = "street" | "hub" | "price-band" | "brief";

const STREET_SOURCES = new Set(["street-alert", "street-exit-intent", "street-corner-widget"]);
const HUB_SOURCES = new Set(["condo-building-alert", "condo-building-contact", "mosque-alert", "school-alert"]);
const BRIEF_SOURCES = new Set(["daily-brief"]);

export function kindForSource(source: string): WatchKind | null {
  if (BRIEF_SOURCES.has(source)) return "brief";
  if (STREET_SOURCES.has(source)) return "street";
  if (HUB_SOURCES.has(source)) return "hub";
  return null;
}

export interface WatchInput {
  source: string;
  email: string | null;
  leadId: string;
  /** Resolved street or building name the surface was about. */
  subject?: string | null;
  neighbourhood?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

export interface WatchResult {
  created: boolean;
  id?: string;
  kind?: WatchKind;
  skipped?: string;
}

/** Idempotent per (email, kind, criteria): a second submission from the same address for the
 *  same street re-enables the existing watch instead of stacking duplicate sends. */
export async function createWatchForLead(input: WatchInput): Promise<WatchResult> {
  if (!input.email) return { created: false, skipped: "no email captured" };
  const kind = kindForSource(input.source);
  if (!kind) return { created: false, skipped: `source ${input.source} is not an alert surface` };

  const email = input.email.trim().toLowerCase();
  let streetSlug: string | null = null;
  let neighbourhood: string | null = null;
  let name: string;

  if (kind === "street") {
    if (!input.subject) return { created: false, skipped: "street watch with no street name" };
    streetSlug = streetNameToSlug(input.subject);
    name = `New listings on ${input.subject}`;
  } else if (kind === "hub") {
    neighbourhood = input.neighbourhood?.trim() || null;
    if (!neighbourhood) {
      return { created: false, skipped: "hub watch with no neighbourhood" };
    }
    name = `New listings in ${neighbourhood}`;
  } else if (kind === "price-band") {
    if (input.priceMin == null && input.priceMax == null) {
      return { created: false, skipped: "price-band watch with no band" };
    }
    name = `New listings in your price range`;
  } else {
    name = `${config.CITY_NAME} daily brief`;
  }

  const existing = await prisma.savedSearch.findFirst({
    where: { email, kind, streetSlug, neighbourhood },
    select: { id: true, alertEnabled: true },
  });
  if (existing) {
    if (!existing.alertEnabled) {
      await prisma.savedSearch.update({ where: { id: existing.id }, data: { alertEnabled: true } });
    }
    return { created: false, id: existing.id, kind, skipped: "watch already existed" };
  }

  const row = await prisma.savedSearch.create({
    data: {
      email,
      leadId: input.leadId,
      kind,
      name,
      streetSlug,
      neighbourhood,
      priceMin: input.priceMin ?? null,
      priceMax: input.priceMax ?? null,
      alertEnabled: true,
      alertFrequency: kind === "brief" ? "daily" : "daily",
    },
    select: { id: true },
  });
  return { created: true, id: row.id, kind };
}
