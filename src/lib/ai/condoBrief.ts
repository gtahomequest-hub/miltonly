// src/lib/ai/condoBrief.ts
// Build B — TEMPLATE-COMPOSED building brief (Ruling 1, Option A). Deterministic sentences
// assembled from Build A's k-anon aggregate facts — NO model call. Every sentence traces to a
// real number/attribute. Run through assertPromptSafe as a belt (fail-closed to null). NEVER
// reads listing descriptions/remarks. Wiring the live condo generator is a separate later pass.
import { assertPromptSafe } from "@/lib/ai/compliance";
import { formatPrice } from "@/lib/format";
import type { BuildingAttributes } from "./buildingAttributes.types";

type Attrs = Omit<BuildingAttributes, "_debug">;
const money = (n: number) => formatPrice(n);
const list = (xs: string[], n: number) => {
  const t = xs.slice(0, n);
  if (t.length <= 1) return t[0] ?? "";
  return `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}`;
};

export function composeCondoBrief(a: Attrs): { text: string | null } {
  const name = a.buildingName.name;
  const nbhd = a.areaContext.neighbourhoodName ?? "Milton";
  const buy = a.gyield.saleMedian;
  const rnt = a.gyield.leaseMedian;
  const yld = a.gyield.headlinePct;
  const area = a.areaContext.typicalCondo;
  const parts: string[] = [];

  // 1 — the relationship (or the honest thin-building opener)
  if (buy != null && rnt != null && yld != null) {
    const tone = yld >= 5 ? "high enough that investors stay active alongside owner-occupiers" : "a measured return that leans on owner-occupier demand";
    parts.push(`At a typical ${money(buy)} to buy against $${Math.round(rnt).toLocaleString("en-CA")} a month to rent, ${name} runs a ${yld}% gross yield — ${tone}.`);
  } else if (buy == null && rnt != null) {
    parts.push(`${name} sells quietly — too few recent resales to fix a typical price — but it rents readily at about $${Math.round(rnt).toLocaleString("en-CA")} a month${area != null ? `, and condos across ${nbhd} typically sell around ${money(area)}` : ""}.`);
  } else if (area != null) {
    parts.push(`${name} is new to the sales record. Condos across ${nbhd} typically sell around ${money(area)}, the best guide to its value until it trades more often.`);
  } else {
    return { text: null };
  }

  // 2 — activity (labeled as activity; no tenure claim, no small count)
  if (a.records.total > 1) {
    if (!a.kFloors.saleTypical && a.kFloors.leaseTypical) parts.push("Leasing is by far its more active market.");
    else if (a.records.lease12mo > a.records.sale12mo) parts.push("Leasing has been the busier side of its market over the past year.");
    else if (a.kFloors.saleTypical) parts.push("It resells actively, with steady owner turnover.");
  }

  // 3 — amenities (only what Build A already vetted at >=2 sales; drop TREB combo tokens like
  // "Party Room/Meeting Room" that duplicate their split parts)
  const amen = a.amenities.rendered.filter((x) => !x.includes("/"));
  if (amen.length >= 2) parts.push(`Its sold listings consistently feature ${list(amen, 3)}.`);

  // 4 — fees / management
  const feeTail: string[] = [];
  if (a.feeIncludes.stated && a.feeIncludes.items.length) feeTail.push(`the maintenance fee typically covers ${list(a.feeIncludes.items.map((i) => i.replace(/ Included$/i, "")), 3)}`);
  if (a.management.company) feeTail.push(`it's managed by ${a.management.company}`);
  if (feeTail.length) parts.push(`${feeTail.join(", and ")}.`.replace(/^./, (c) => c.toUpperCase()));

  const text = parts.slice(0, 4).join(" ").replace(/\s+/g, " ").trim();
  // belt: even deterministic text passes the prompt-safety choke (fail-closed to null).
  try { assertPromptSafe("condo-brief", text); } catch { return { text: null }; }
  return { text: text || null };
}
