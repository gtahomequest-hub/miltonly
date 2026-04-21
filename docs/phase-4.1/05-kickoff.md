# Phase 4.1 Kickoff — 8-Section AI Description Generator (v3)

You are executing Phase 4.1 on miltonly.com. This is the highest-leverage remaining content task on the project. Every Milton street page currently renders hollow because the generator produces single-blob descriptions instead of 8-section structured output. You will fix that end to end, then run a backfill against all Milton streets in the database.

## What you are building

The generator in `src/lib/ai/generateStreet.ts` currently produces a single `description` string. You will convert it to produce a structured 8-section output plus an FAQ block, persist that structure, extend the `StreetContent` table to store it, and wire the output into the existing `DescriptionBody` render component. You will also run a one-time backfill against all known Milton streets in the database, paced to respect Anthropic API rate limits.

## Deliverable artifacts (all provided, use verbatim)

Four artifacts are provided separately:

1. The full system prompt for the model.
2. The TypeScript output schema the model returns.
3. Three worked example outputs (input + output pairs), pre-validated and documented as regression fixtures.
4. The validator rules and retry loop.

All three worked examples have been programmatically validated against artifact 4. Harness output is documented at the bottom of artifact 3. All three pass with zero violations. They are the ground truth for voice, length, and structure; use them as regression fixtures. If the live generator produces output materially divergent from these on a spot-check, something has drifted.

## Execution plan

Work in this order. Do not skip steps. Do not parallelize prematurely.

### Step 1 — Schema migration

Extend the `StreetContent` table (check current schema in `prisma/schema.prisma`) to store structured output:

```prisma
model StreetContent {
  // ...existing fields
  sectionsJson     Json?        // StreetSection[] from schema
  faqJson          Json?        // StreetFAQItem[] from schema
  generationMeta   Json?        // StreetGenerationMeta for audit
  inputHash        String?      // sha256 for drift detection
  // Keep existing `description` field for one release as a fallback; deprecate in Phase 4.2.
}

model StreetGenerationReview {
  id              String   @id @default(cuid())
  streetSlug      String
  attemptedAt     DateTime @default(now())
  violations      Json
  lastOutput      Json?
  status          String   @default("pending")  // "pending" | "resolved" | "ignored"
  @@index([status])
}
```

Run the migration. Commit it as a standalone change before moving on.

### Step 2 — Type definitions

Create `src/types/street-generator.ts` with the exact contents from artifact 2. The `ValidatorRule` union type has seventeen members; do not trim it. Update `src/types/street.ts` so `DescriptionBodyProps` accepts `{ sections: StreetSection[]; faq: StreetFAQItem[] }`.

### Step 3 — Generator function

Rewrite `src/lib/ai/generateStreet.ts` to:

- Accept `StreetGeneratorInput` (defined at the bottom of this kickoff) as its input parameter.
- Call Claude Opus 4.7 (`claude-opus-4-7`) with the system prompt from artifact 1.
- Pass the input payload as JSON in the user message, prefixed with "Street data for generation:".
- Parse the returned JSON strictly against `StreetGeneratorOutput`.
- Invoke the validator from artifact 4. On violations, retry up to 2 more times with `formatViolationsForRetry(violations)` appended to the conversation. Total attempts: 3.
- On third-attempt failure, insert a row into `StreetGenerationReview` with status "pending" and throw `StreetGenerationFailure`. Do not publish partial output.
- On success, return `{ output, meta }` where meta contains attemptCount, inputHash, word counts, and timestamp.

Keep the existing retry infrastructure scaffold if present; adapt it to the new schema. Do not rewrite unrelated code.

### Step 4 — Validator

Create `src/lib/ai/validateStreetGeneration.ts` with the exact contents from artifact 4. No modifications to the denylists, regexes, rounding rules, or word thresholds without asking first.

Documented validator limitations (intentional, do not "fix"):

- "average" in `METHODOLOGY_LEAK_PHRASES` will false-positive on valid uses like "on average" or "average household size." Keep strict; monitor retry rate during backfill.
- K/M shorthand prices like "$1.4M" cannot be rounding-validated by the price regex. These are structurally hard to emit un-rounded, so the gap is low-risk.
- `extractCandidateStreetNames` is a heuristic. Expand `KNOWN_MILTON_ANCHORS` as new false positives surface during backfill.

### Step 5 — Data pipeline

Extend `src/lib/street-data.ts` so `getStreetPageData(slug)` produces a `StreetGeneratorInput` in addition to its current output. Key requirement: the pipeline applies k-anonymity redaction before the generator sees data. Generator must never receive a raw price that would violate k-rules if published.

Populate `crossStreets[]` by running a nearby-street lookup keyed on neighbourhood overlap and product-profile similarity. Cap at six streets. Each entry must carry a non-null `typicalPrice` at k≥5, or be excluded. If fewer than two confident matches exist for a given street, `crossStreets[]` may be empty, and the generator will fall back to qualitative routing per the system prompt.

### Step 6 — Render wiring

Update `src/components/street/DescriptionBody.tsx` to consume `{ sections, faq }`. Render the eight sections in order, applying existing typography primitives (`SerifHeading`, `Body`) from the design system. Render `faq` into the existing `FAQ` component, replacing the current hard-coded Q/A.

For `bestFitFor` and `differentPriorities`, render as prose paragraphs using the same `Body` primitive as other sections. Do not reach for bullet lists. The prose treatment is intentional.

Conditionally hide the `market` section body when `kAnonLevel === "zero"` collapses to its single-paragraph form only if that paragraph is below 25 words; otherwise render normally. This handles the edge case where the model returns a valid but extremely brief zero-state market paragraph.

### Step 7 — Backfill script

Create `scripts/backfill-street-content.ts`:

- Query all distinct streets from the Milton dataset (use existing `getAllMiltonStreets()` helper or equivalent).
- For each street, compute input via `getStreetPageData`, call generator, validate, persist.
- Rate-limit to 4 requests per minute initial pace. Increase to 8/minute after the first 50 succeed without rate-limit errors. Respect 429 responses with exponential backoff.
- Log progress to stdout every 10 streets: slug, attempt count, validator pass/fail, word total.
- On `StreetGenerationFailure`, continue to next street. Do not abort the run. Failures are already captured in `StreetGenerationReview`.
- Idempotent: if a street already has `sectionsJson` populated with matching `inputHash`, skip it. This allows safe re-runs.

Budget estimate at current Opus 4.7 pricing for 700 streets with 3-attempt retry budget, given the 1,200–1,800 word target: $60–$140. Do not optimize for cost. Optimize for voice fidelity.

### Step 8 — Weekly refresh job

Add a Vercel cron route at `src/app/api/cron/refresh-streets/route.ts` that runs weekly. For each street:

- Compute current `inputHash`.
- If stored hash differs and data drift exceeds 15% on any aggregate (typical price, txCount, activeListingsCount), regenerate.
- If stored `generatedAt` is older than 7 days regardless of drift, regenerate.

Reuse the backfill script's per-street logic. Pace at 2 requests per minute since cron has time budget.

### Step 9 — Verification

Before declaring Phase 4.1 complete, spot-check five streets manually:

- Main Street East (rich-data mixed type)
- Murlock Heights (zero-data new build)
- Lily Crescent (thin-data lease-heavy condo)
- One street you pick with k-anonymity `thin` between 1 and 4 transactions
- One street with `primaryBuilder.confidence === "medium"`

For each, verify: eight sections render in order, headings match the bank, no em-dashes, no superlatives, no methodology leaks, no out-of-rounding prices, cross-street references are real, builder mentioned only at high confidence, FAQ questions drawn verbatim from the cluster bank, FAQ answers 2–4 sentences each, total word count clears the tier-appropriate floor.

If any fail, report back before running the full backfill.

## Non-negotiables

- Do not change the system prompt without asking. It encodes tested voice rules.
- Do not expand the heading bank or the FAQ cluster bank. Fixed variants prevent drift.
- Do not soften the validator. Hard-fail is the design. Do not remove or weaken any rule.
- Do not publish partial output on failure. Insert to `StreetGenerationReview` and move on.
- Do not introduce bullet lists into `bestFitFor` or `differentPriorities` prose. Prose is the moat.
- Do not modify the three worked examples. They are regression fixtures with documented validator proof.

## What to report back

When Phase 4.1 is complete:

1. Migration applied and confirmed.
2. Generator, validator, and data pipeline merged.
3. Five spot-checks pass with validator output pasted as proof.
4. Backfill run complete, with total street count, success count, failure count, average cost per street, and needsReview queue depth.
5. Cron route deployed and confirmed on next schedule tick.

Any deviation from this plan, ask before acting.

---

## Artifact 1 — System prompt

[PASTE CONTENTS OF 01-system-prompt.md HERE VERBATIM]

## Artifact 2 — Output schema

[PASTE CONTENTS OF 02-output-schema.ts HERE VERBATIM]

## Artifact 3 — Worked examples

[PASTE CONTENTS OF 03-examples.ts HERE VERBATIM]

## Artifact 4 — Validator

[PASTE CONTENTS OF 04-validator.ts HERE VERBATIM]

## Input type (to be wired into getStreetPageData)

```typescript
interface StreetGeneratorInput {
  street: {
    name: string;
    slug: string;
    shortName: string;
    type: "avenue" | "crescent" | "court" | "drive" | "street" | "road" | "boulevard" | "place" | "terrace" | "way" | "lane" | "heights" | "trail" | "circle" | "gate" | "close";
  };
  neighbourhoods: string[];
  primaryBuilder?: {
    name: string;
    confidence: "high" | "medium";
    evidence: string;
  };
  aggregates: {
    txCount: number;
    salesCount: number;
    leasesCount: number;
    typicalPrice: number | null;
    priceRange: { low: number; high: number } | null;
    daysOnMarket: number | null;
    kAnonLevel: "full" | "thin" | "zero";
  };
  byType: {
    detached?: { count: number; typicalPrice: number | null; priceRange: { low: number; high: number } | null; kFlag: "full" | "thin" | "zero" };
    semi?:     { count: number; typicalPrice: number | null; priceRange: { low: number; high: number } | null; kFlag: "full" | "thin" | "zero" };
    townhouse?:{ count: number; typicalPrice: number | null; priceRange: { low: number; high: number } | null; kFlag: "full" | "thin" | "zero" };
    condo?:    { count: number; typicalPrice: number | null; priceRange: { low: number; high: number } | null; kFlag: "full" | "thin" | "zero" };
  };
  dominantStyle?: string;
  lotSize?: { typical: string; range: string };
  leaseActivity?: {
    byBed: {
      "1br"?: { count: number; typicalRent: number };
      "2br"?: { count: number; typicalRent: number };
      "3br"?: { count: number; typicalRent: number };
    };
  };
  quarterlyTrend?: Array<{ quarter: string; typical: number; count: number }>;
  nearby: {
    parks: Array<{ name: string; distanceMin: number; walkable: boolean }>;
    schoolsPublic: Array<{ name: string; level: "elementary" | "secondary"; board: string; distanceMin: number }>;
    schoolsCatholic: Array<{ name: string; level: "elementary" | "secondary"; board: string; distanceMin: number }>;
    mosques: Array<{ name: string; distanceMin: number }>;
    grocery: Array<{ name: string; distanceMin: number }>;
    hospital?: { name: string; distanceMin: number };
    goStation?: { name: string; distanceMin: number };
    highway?: { name: string; onrampDistanceMin: number };
  };
  commute: {
    toTorontoDowntown: { method: "GO+TTC" | "drive"; minutes: number };
    toMississauga: { method: "drive" | "GO+TTC"; minutes: number };
    toOakville: { method: "drive" | "GO+TTC"; minutes: number };
    toBurlington: { method: "drive" | "GO+TTC"; minutes: number };
    toPearson: { method: "drive" | "GO+TTC"; minutes: number };
  };
  activeListingsCount: number;
  crossStreets: Array<{
    slug: string;
    shortName: string;
    distinctivePattern: string;
    typicalPrice: number | null;
  }>;
}
```

Start with Step 1. Report back after the migration before moving to Step 2.
