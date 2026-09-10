// src/lib/content/groundedFigures.ts
//
// THE CONTENT TIER'S GROUNDING CONTRACT. Minimal on purpose.
//
// Every validator in src/lib/ai/validateStreetGeneration.ts takes
// `input: StreetGeneratorInput` and reaches into `input.aggregates`,
// `input.quarterlyTrend`, `input.nearby` and `input.primaryBuilder`. Checked
// 2026-09-10: `findUngroundedNumerics`, `findZeroTierPrices`,
// `findUngroundedBuilderName` and the `superlative` rule all do, and
// `SUPERLATIVE_PHRASES` is module-private. None of the four extracts onto this
// interface unchanged, so under ruling 3 they are reimplemented here rather
// than proposed to Core as a refactor. `validateStreetGeneration.ts` is NOT
// edited by this worktree.
//
// A figure is a value the page ALREADY RENDERS, k-gated by whoever computed it.
// This interface does not do k-gating and must never be asked to: by the time a
// figure reaches here the suppression decision is made and a suppressed figure
// arrives as `value: null`. Never 0, never a placeholder string.

/** One number (or explicitly suppressed number) the prose is allowed to cite. */
export interface GroundedFigure {
  /** Stable identifier, e.g. "weekly.median". Used in prompts and diagnostics. */
  key: string;
  /**
   * The value as rendered. `null` means the figure is k-suppressed and the
   * prose may not state it in any form, including a reconstruction.
   */
  value: number | string | null;
  /** How the figure reads on the page, e.g. "typical sold price, week of 2026-09-07". */
  label: string;
  /** Where it came from, e.g. "getMiltonSoldWeekly". Carried for the audit row. */
  source: string;
  /** "dollar" | "percent" | "count" | "days" | "text". Drives the tolerance. */
  kind: FigureKind;
}

export type FigureKind = "dollar" | "percent" | "count" | "days" | "text";

export interface GroundedFigures {
  figures: GroundedFigure[];
  /**
   * Proper nouns the prose may name: neighbourhoods, streets, buildings,
   * schools. Anything capitalised that is not here is an invented entity.
   */
  entities: string[];
}

/** Figures whose value survived suppression. */
export function livingFigures(g: GroundedFigures): GroundedFigure[] {
  return g.figures.filter((f) => f.value !== null && f.value !== "");
}

/** True when NO figure in the bundle carries a dollar value. */
export function hasNoDollarFigure(g: GroundedFigures): boolean {
  return !g.figures.some((f) => f.kind === "dollar" && typeof f.value === "number");
}

export function numericValues(g: GroundedFigures, kind: FigureKind): number[] {
  return g.figures
    .filter((f) => f.kind === kind && typeof f.value === "number")
    .map((f) => f.value as number);
}

/** Render the bundle for a prompt. Suppressed figures are stated as suppressed
 *  rather than omitted, because a missing figure reads to a model as a figure
 *  to supply — the lesson DEC-ZERO-PRICE-PREAMBLE already paid for. */
export function figuresForPrompt(g: GroundedFigures): string {
  const lines = g.figures.map((f) =>
    f.value === null || f.value === ""
      ? `- ${f.label}: NOT AVAILABLE (too few sales to publish). You may not state, estimate or reconstruct this figure.`
      : `- ${f.label}: ${f.value}`,
  );
  const ents = g.entities.length
    ? `\nPlaces you may name (no others): ${g.entities.join(", ")}.`
    : `\nDo not name any place, street, building, school or person.`;
  return lines.join("\n") + ents;
}
