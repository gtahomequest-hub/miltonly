// Pure extractor for the "Highlights from this listing" card on
// /sales/ads/[mlsNumber]. Combines two signal sources:
//
//   1. Structured Listing fields gated by a premium-feature allowlist.
//      Generic items (asphalt shingle, forced air, etc.) are NOT here —
//      the card is editorial, not a spec sheet.
//
//   2. Conservatively parsed signals from the listing's description text:
//        - Dollar-amount claims ($X+ NOUN-PHRASE)
//        - Ceiling heights ("X-foot ceilings on …")
//      Dollar claims carry a seller/listing-source attribution prefix so
//      the bullet reads as "we're surfacing what the seller says," not
//      as a Miltonly-authored claim.
//
// Skipped on purpose (documented as constants below):
//   - sqft from description — structured field is authoritative; mismatch
//     leads to two different numbers on the page.
//   - bedroom-count from description — structured includes basement
//     bedrooms; description often advertises upper-level count only.
//
// The card hides entirely when the extractor returns no bullets AND no
// virtual-tour URL. No empty-state placeholder.

export interface HighlightInput {
  description: string | null;
  architecturalStyle: string | null;
  approximateAge: string | null;
  heatType: string | null;
  cooling: string | null;
  interiorFeatures: string[];
  exteriorFeatures: string[];
  fireplace: boolean;
  construction: string | null;
  foundation: string | null;
  virtualTourUrl: string | null;
}

export interface ExtractedHighlights {
  bullets: string[];
  virtualTourUrl: string | null;
}

// Lower-case substrings that mark a structured-field value as "premium."
// Generic items (forced air, asphalt shingle, vinyl siding, etc.) deliberately
// omitted — the card is editorial. Update with care: anything added here
// becomes a permanent bullet on every listing carrying that signal.
const PREMIUM_FEATURE_ALLOWLIST = [
  "heat pump",
  "erv",
  "hrv",
  "water softener",
  "water heater owned",
  "on demand water heater",
  "fireplace",
  "brick",
  "poured concrete",
  "built-in oven",
  "sump pump",
] as const;

// Max bullets in the rendered card. Beyond this is wall-of-text.
const MAX_BULLETS = 6;

// Attribution prefixes for description-parsed dollar claims. Rotating through
// the array spreads the attribution voice across the bullets so the card
// doesn't read as "Listed with… Listed with… Listed with…" repetition.
const DOLLAR_PREFIXES = ["Listed with", "Seller notes"] as const;

// Skip-rules documented as constants so future listings inherit them and a
// future maintainer can read why these paths exist.
//
//   sqft     — structured Listing.sqft is authoritative; the hero facts row
//              already shows it. Description sometimes carries a different
//              number (above-grade vs total).
//   bedrooms — same reasoning. Hero facts row shows the structured count.
//
// These intentionally have no extractor paths in this file.

function isPremium(s: string | null | undefined): boolean {
  if (!s) return false;
  const lc = s.toLowerCase();
  return PREMIUM_FEATURE_ALLOWLIST.some((p) => lc.includes(p));
}

function capFirst(s: string): string {
  if (!s) return s;
  const t = s.trim();
  if (!t) return t;
  return t[0].toUpperCase() + t.slice(1);
}

// Trim a description-extracted phrase so the bullet stays scannable. Cuts
// at the first sentence-break or conjunction (", " / " and " / " with " /
// " plus " / "."), then hard-caps length at 50 chars at a word boundary.
function tightenAfterDollar(s: string): string {
  let p = s.trim();
  const candidates = [
    p.indexOf(", "),
    p.search(/\s+and\s+/i),
    p.search(/\s+with\s+/i),
    p.search(/\s+plus\s+/i),
    p.indexOf("."),
  ].filter((x) => x > 5);
  if (candidates.length > 0) {
    p = p.slice(0, Math.min(...candidates));
  }
  if (p.length > 50) {
    p = p.slice(0, 50);
    const ls = p.lastIndexOf(" ");
    if (ls > 10) p = p.slice(0, ls);
  }
  return p.trim();
}

// Description signals — dollar amounts. Returns 0–2 bullets.
function extractDollarBullets(description: string): string[] {
  const out: string[] = [];
  const dollarRe = /\$\s?(\d[\d,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = dollarRe.exec(description)) !== null && out.length < DOLLAR_PREFIXES.length) {
    const amount = m[1];
    const after = description.slice(m.index + m[0].length).replace(/^\+/, "");
    const tightened = tightenAfterDollar(after);
    if (tightened.length < 3) continue;
    const prefix = DOLLAR_PREFIXES[out.length];
    out.push(`${prefix} $${amount}+ ${tightened.toLowerCase()}`);
  }
  return out;
}

// Description signals — ceiling heights. Returns 0–1 bullets.
// Matches "9-foot ceilings on both the main and second levels" up to first
// comma/period so the "on X and Y levels" phrase stays intact (we don't cut
// at "and" here — it's a natural part of the bullet).
function extractCeilingBullet(description: string): string | null {
  const re = /(\d+)[-\s]?(?:foot|ft|')\s+ceilings?(?:\s+on\s+([^.!,]{5,40}))?/i;
  const m = re.exec(description);
  if (!m) return null;
  const height = m[1];
  const onPhrase = m[2]?.trim();
  return onPhrase ? `${height}-foot ceilings on ${onPhrase.toLowerCase()}` : `${height}-foot ceilings`;
}

// Structured bullets — architecture, premium-feature roll-up, heating,
// construction stack. Each gated by isPremium() where applicable.
function extractStructuredBullets(input: HighlightInput): string[] {
  const out: string[] = [];

  // 1. Architecture + age (only for buildings 15 years or newer — older
  //    isn't a highlight on a paid-traffic conversion page).
  if (input.architecturalStyle && input.approximateAge) {
    const style = input.architecturalStyle.toLowerCase();
    const age = input.approximateAge;
    if (age === "New" || age === "0-5") {
      out.push(`${capFirst(style)} home, built within last 5 years`);
    } else if (age === "6-10" || age === "6-15" || age === "11-15") {
      out.push(`${capFirst(style)} home, 5 to 15 years new`);
    }
    // 16-30, 31-50, 51-99, 100+ deliberately not surfaced.
  }

  // 2. Premium interior/exterior features — dedup'd, capped at 3 per
  //    bullet so the card doesn't get dominated by one wall of features.
  const features = [...(input.interiorFeatures || []), ...(input.exteriorFeatures || [])];
  const premium = Array.from(
    new Set(features.filter(isPremium).map((f) => f.toLowerCase().trim())),
  ).filter((f) => f.length > 0);
  if (premium.length > 0) {
    const top = premium.slice(0, 3).join(", ");
    out.push(`Includes ${top}`);
  }

  // 3. Heating type — only if premium signal.
  if (isPremium(input.heatType)) {
    out.push(capFirst(`${input.heatType!.toLowerCase()} heating system`));
  }

  // 4. Construction stack — combined into one bullet to save space.
  const buildBits: string[] = [];
  if (isPremium(input.construction)) buildBits.push(`${input.construction!.toLowerCase()} exterior`);
  if (isPremium(input.foundation)) buildBits.push(`${input.foundation!.toLowerCase()} foundation`);
  if (input.fireplace) buildBits.push("fireplace");
  if (buildBits.length > 0) {
    out.push(capFirst(buildBits.join(", ")));
  }

  return out;
}

export function extractHighlights(input: HighlightInput): ExtractedHighlights {
  const desc = input.description ?? "";
  // Description-derived first — these are the highest-engagement bullets
  // (specific dollar claims + architectural distinctives).
  const dollarBullets = desc ? extractDollarBullets(desc) : [];
  const ceilingBullet = desc ? extractCeilingBullet(desc) : null;
  const structured = extractStructuredBullets(input);

  const all: string[] = [];
  for (const b of dollarBullets) all.push(b);
  if (ceilingBullet) all.push(ceilingBullet);
  for (const b of structured) all.push(b);

  // Cap before returning — bullets after MAX_BULLETS are dropped silently.
  const bullets = all.slice(0, MAX_BULLETS);

  // Trim/normalize virtualTourUrl. Empty strings on the field should be
  // treated as null so the button doesn't render with a broken href.
  const vt = input.virtualTourUrl?.trim() || null;

  return { bullets, virtualTourUrl: vt };
}
