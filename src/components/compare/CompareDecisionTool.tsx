"use client";

// src/components/compare/CompareDecisionTool.tsx
//
// THE DECISION TOOL — the one client island on /compare/freehold-vs-condo
// (besides SiteNav). Statically imported by the SERVER ComparePage and SSR'd
// with deterministic initial state (all sliders = 3 -> the dead-center
// readout), so the prerendered HTML matches hydration exactly — no CLS, no
// mismatch. NO fetching here: the live numbers arrive as numeric
// TenureCompareFacts PROPS from the same getComparisonData call that feeds
// the grounded table above, so the tool and the table can never disagree.
//
// k-anon discipline mirrors the table's Val/silent gate: any null figure
// drops its clause from the readout copy (never $0/NaN); the qualitative
// weighting still applies.

import { useState } from "react";
import { fullPrice } from "../hub/format";
import type { TenureCompareFacts } from "../hub/types";

export interface CompareDecisionToolProps {
  /** Freehold-side numeric facts (undefined when the seam returned a shell). */
  factsA?: TenureCompareFacts;
  /** Condo-side numeric facts. */
  factsB?: TenureCompareFacts;
  /** Side hub links (cfg.sideA.href / cfg.sideB.href). */
  hrefA: string;
  hrefB: string;
}

// slider value 1..5 -> lean -1..+1 (3 = neutral)
const t = (v: number) => (v - 3) / 2;
const round5 = (n: number) => Math.round(n / 5) * 5;

/** Weighted freehold percentage from the three sliders. Money: left favors
 *  condo (entry price), right favors freehold (no fee long-run). Maintenance:
 *  left favors freehold (self-managed), right favors condo (fee buys managed
 *  upkeep). Control: left favors freehold STRONGLY, right only mildly condo
 *  (rules being "fine" is tolerance, not preference). Sides normalize to
 *  their own maximum so full-left and full-right both read as a full lean. */
function freeholdPct(money: number, maint: number, ctrl: number): number {
  const mMoney = t(money); // -1 condo .. +1 freehold
  const mMaint = -t(maint); // +1 freehold .. -1 condo
  const c = t(ctrl);
  const mCtrl = c < 0 ? -c : -c * 0.5; // +1 freehold .. -0.5 condo
  const total = mMoney + mMaint + mCtrl; // -2.5 .. +3
  const raw = total >= 0 ? 50 + (total / 3) * 50 : 50 + (total / 2.5) * 50;
  return Math.min(100, Math.max(0, round5(raw)));
}

function Slider({
  tag,
  left,
  right,
  value,
  onChange,
  live,
  aria,
}: {
  tag: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
  live?: string;
  aria: string;
}) {
  return (
    <div className="cmp-slider">
      <div className="cmp-slider-tag">{tag}</div>
      <div className="cmp-slider-ends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={aria}
      />
      {live ? <div className="cmp-slider-live">{live}</div> : null}
    </div>
  );
}

export default function CompareDecisionTool({ factsA, factsB, hrefA, hrefB }: CompareDecisionToolProps) {
  const [money, setMoney] = useState(3);
  const [maint, setMaint] = useState(3);
  const [ctrl, setCtrl] = useState(3);

  // ---- live figures (each independently k-safe; null -> its clause drops) ----
  const medianA = factsA?.medianList ?? null;
  const medianB = factsB?.medianList ?? null;
  const entryGap = medianA != null && medianB != null && medianA > medianB ? medianA - medianB : null;
  const feeTenYr =
    factsB?.hasFee && factsB.feeLo != null && factsB.feeHi != null
      ? Math.round(((factsB.feeLo + factsB.feeHi) / 2) * 120)
      : null;
  const condoListLo = factsB?.listLo ?? null;
  const activeA = factsA?.activeCount ?? null;
  const activeB = factsB?.activeCount ?? null;

  const moneyLiveParts: string[] = [];
  if (entryGap != null) moneyLiveParts.push(`condos list ~${fullPrice(entryGap)} below freehold today`);
  if (feeTenYr != null) moneyLiveParts.push(`a typical condo fee adds ~${fullPrice(feeTenYr)} over 10 years`);
  const moneyLive = moneyLiveParts.length ? `Live: ${moneyLiveParts.join(" — ")}.` : undefined;

  // ---- the resolution ----
  const pctA = freeholdPct(money, maint, ctrl);
  const dead = pctA >= 45 && pctA <= 55;
  const leanFreehold = pctA > 55;

  let head: string;
  let body: string;
  if (dead) {
    const counts =
      activeA != null && activeB != null ? ` (${activeA.toLocaleString("en-CA")} freehold, ${activeB.toLocaleString("en-CA")} condos on the market)` : "";
    head = "Genuinely split — and that's a real answer.";
    body = `You're weighing money against control against convenience, and in Milton both sides are strong right now${counts}. This is exactly the conversation worth having before you tour anything.`;
  } else if (leanFreehold) {
    head = `You lean freehold — ${pctA}/${100 - pctA}.`;
    body =
      "What you're choosing: the land, the control, no monthly fee — and the responsibility. Your real risk isn't the price tag, it's deferred maintenance: with no fee, the reserve fund is you. Budget like it." +
      (medianA != null ? ` Today that choice starts around ${fullPrice(medianA)} in Milton.` : "");
  } else {
    const gapClause = entryGap != null ? ` (~${fullPrice(entryGap)} less than freehold today)` : "";
    head = `You lean condo — ${100 - pctA}/${pctA}.`;
    body =
      `What you're choosing: a lower entry${gapClause}, predictable costs, upkeep handled. Your real risk isn't the fee — it's the building. A well-run corporation is everything: read the status certificate before you fall in love with a unit.` +
      (condoListLo != null ? ` Today condos start around ${fullPrice(condoListLo)}.` : "");
  }

  return (
    <div className="cmp-tool">
      <div className="cmp-sliders">
        <Slider
          tag="Money"
          left="Entry price matters most"
          right="Long-run cost matters most"
          value={money}
          onChange={setMoney}
          live={moneyLive}
          aria="Money — entry price versus long-run cost of ownership"
        />
        <Slider
          tag="Maintenance"
          left="I'll handle my own upkeep"
          right="I want it handled for me"
          value={maint}
          onChange={setMaint}
          aria="Maintenance — handle your own upkeep versus have it handled for you"
        />
        <Slider
          tag="Control"
          left="Full control is non-negotiable"
          right="Rules are fine if it's easy"
          value={ctrl}
          onChange={setCtrl}
          aria="Control — full control versus accepting rules for convenience"
        />
      </div>

      <div className="cmp-readout" aria-live="polite">
        <div className="cmp-readout-h">{head}</div>
        <p className="cmp-readout-b">{body}</p>
        <div className="cmp-readout-ctas">
          {!dead && leanFreehold ? (
            <a className="cmp-readout-cta" href={hrefA}>
              Explore freehold →
            </a>
          ) : null}
          {!dead && !leanFreehold ? (
            <a className="cmp-readout-cta" href={hrefB}>
              Explore condos →
            </a>
          ) : null}
          <a className="cmp-readout-cta cmp-readout-cta-sec" href="/sell">
            Talk it through with Aamir →
          </a>
        </div>
      </div>
    </div>
  );
}
