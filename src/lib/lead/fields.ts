// The field mappings the old monolith did inline, in one testable place.
//
// Four of its branches each had their own copy of "turn what the form offered into what the
// column holds": a phone into E.164, a bedroom token into an integer, a budget token into a
// price, a home-type token into a property type. The copies had drifted — `budgetToInt` read
// "$2K–$2.5K" as null and stored nothing, while the same token reached the realtor email
// intact — so a rental quiz lead arrived with no budget in the database and a budget in the
// notification. One set of functions, used by the one ingest path, ends that.
//
// Every function returns null for "the form did not say", never a sentinel. A 0 bedroom
// count is a studio and is returned as 0, which is why the bedroom function cannot use a
// falsy test at its call site.

/** E.164. Ten digits are assumed North American; anything longer is already country-coded. */
export function normalizePhone(raw: string | undefined | null): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export function phoneDigits(raw: string | undefined | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** "studio" is 0 bedrooms, not no answer. "4+" is 4. */
export function bedroomToInt(v: string | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "studio" || s === "bachelor") return 0;
  const m = s.match(/^(\d+)\s*\+?$/);
  return m ? parseInt(m[1], 10) : null;
}

const HOME_TYPE_TO_PROPERTY_TYPE: Record<string, string | null> = {
  any: null,
  all: null,
  condo: "condo",
  apartment: "condo",
  town: "townhouse",
  townhouse: "townhouse",
  semi: "semi",
  "semi-detached": "semi",
  detached: "detached",
  house: "detached",
};

/** The form's own home-type token onto Lead.propertyType. An unknown token stores nothing
 *  rather than a guess: propertyType is a filter column and a wrong value mis-matches. */
export function propertyTypeFor(raw: string | undefined | null): string | null {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return null;
  return key in HOME_TYPE_TO_PROPERTY_TYPE ? HOME_TYPE_TO_PROPERTY_TYPE[key] : null;
}

export interface PriceBand {
  min: number | null;
  max: number | null;
}

/**
 * A budget token into a band.
 *
 * The surfaces offer three shapes and the old code only read the first:
 *   "700000"        a plain number  → an upper bound
 *   "$2K–$2.5K"     a range         → both ends
 *   "$3K+" / "Under $2K"            → one open end
 *
 * K and M are read as thousands and millions, so "$1.5M" is 1,500,000 and "$2K" is 2,000.
 * A bare number inside a K/M token ("$900K–1.2M") takes the suffix that follows it.
 */
export function budgetToBand(raw: string | undefined | null): PriceBand {
  const s = (raw ?? "").trim();
  if (!s || s === "0") return { min: null, max: null };

  // A plain integer is an upper bound, which is how every numeric <select> on the site
  // labels its options ("up to $700,000").
  if (/^\d[\d,]*$/.test(s)) {
    const n = parseInt(s.replace(/,/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? { min: null, max: n } : { min: null, max: null };
  }

  const values: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*([kKmM])?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    const suffix = (m[2] ?? "").toLowerCase();
    values.push(suffix === "m" ? n * 1_000_000 : suffix === "k" ? n * 1_000 : n);
  }
  if (values.length === 0) return { min: null, max: null };

  const lower = s.toLowerCase();
  if (values.length === 1) {
    const only = values[0];
    if (lower.includes("under") || lower.includes("below") || lower.includes("up to")) {
      return { min: null, max: only };
    }
    if (lower.includes("+") || lower.includes("over") || lower.includes("above")) {
      return { min: only, max: null };
    }
    return { min: null, max: only };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max };
}

/** Free text from a visitor, into something safe to store and to inline in an email. */
export function sanitizeText(raw: unknown, cap = 1000): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, cap);
  return cleaned.length > 0 ? cleaned : null;
}

const MLS_RE = /^[A-Z][0-9]{8}$/;

/** A malformed MLS number stores nothing and never refuses the lead: the value arrives from
 *  a referrer tag, and losing a conversion over it would be the worse failure. */
export function mlsNumberFor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  return MLS_RE.test(s) ? s : null;
}
