// Runtime narrowing for reading Phase 4.1 StreetGeneration rows at page-render time.
//
// Prisma's Json columns come back as `JsonValue` — the shape is whatever was written.
// A corrupt or schema-drifted row must fail SAFE (return null so the page falls back
// to the legacy description path), never throw and blow up the request. All narrowing
// is explicit here; callers cast through this function, not a bare `as`.

import { prisma } from "@/lib/prisma";
import type { StreetSection, StreetFAQItem, StreetSectionId } from "@/types/street-generator";

const VALID_SECTION_IDS = new Set<StreetSectionId>([
  "about",
  "homes",
  "amenities",
  "market",
  "gettingAround",
  "schools",
  "bestFitFor",
  "differentPriorities",
]);

function isStreetSection(v: unknown): v is StreetSection {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (typeof s.id !== "string") return false;
  if (!VALID_SECTION_IDS.has(s.id as StreetSectionId)) return false;
  if (typeof s.heading !== "string") return false;
  if (!Array.isArray(s.paragraphs)) return false;
  for (const p of s.paragraphs) if (typeof p !== "string") return false;
  return true;
}

function isStreetFAQItem(v: unknown): v is StreetFAQItem {
  if (!v || typeof v !== "object") return false;
  const q = v as Record<string, unknown>;
  return typeof q.question === "string" && typeof q.answer === "string";
}

export interface LoadedStreetGeneration {
  sections: StreetSection[];
  faq: StreetFAQItem[];
}

/**
 * Fetch the generated description for a street if one exists AND passed structural
 * narrowing. Returns null when:
 *   - no row exists
 *   - row exists but status !== "succeeded"
 *   - JSON columns fail runtime narrowing (corrupt or drift)
 * In all null cases, the caller should fall back to whatever legacy description
 * path already exists. On-demand generation at render time is NOT a fallback
 * path — backfill is the only generation path per Phase 4.1 spec.
 */
export async function loadStreetGeneration(
  streetSlug: string
): Promise<LoadedStreetGeneration | null> {
  const row = await prisma.streetGeneration
    .findUnique({
      where: { streetSlug },
      select: { status: true, sectionsJson: true, faqJson: true },
    })
    .catch(() => null);

  if (!row) return null;
  if (row.status !== "succeeded") return null;

  if (!Array.isArray(row.sectionsJson)) return null;
  if (!Array.isArray(row.faqJson)) return null;

  const sections: StreetSection[] = [];
  for (const s of row.sectionsJson) {
    if (!isStreetSection(s)) return null;
    sections.push(s);
  }
  if (sections.length === 0) return null;

  const faq: StreetFAQItem[] = [];
  for (const q of row.faqJson) {
    if (!isStreetFAQItem(q)) return null;
    faq.push(q);
  }

  return { sections, faq };
}
