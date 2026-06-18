// src/components/compare/CompareModule.tsx
//
// STANDALONE, DROPPABLE compare teaser. Extracted from the old tenure-scoped
// TenureCompareStrip so it can be placed on ANY forest page — not just .hub-v2
// hubs. Self-contained styling (CompareModule.css, no .hub-v2 ancestor required):
// the forest tokens are referenced as var(--h-x, <fallback>), so inside a .hub-v2
// page the inherited tokens win (byte-identical to the old strip) and on a bare
// forest page the fallbacks render the same forest look.
//
// TEASER ONLY: one headline + sub + an optional LIVE stat-contrast line + one
// link to the canonical comparison. NEVER the full table/editorial — that lives
// solely in ComparePage.tsx. The contrast prop is optional and degrades to the
// sub text when not passed (or when a side's median is sub-k -> null).
import "./CompareModule.css";
import React from "react";
import { compactPrice } from "../hub/format";

/** A live two-value median contrast, e.g. Freehold ~$1.08M vs Condo ~$599K.
 *  Sourced from comparisonData.compareFacts; null when either side is sub-k. */
export interface CompareContrast {
  aLabel: string;
  aValue: number;
  bLabel: string;
  bValue: number;
}

export interface CompareModuleProps {
  title: string;
  sub: string;
  label: string;
  href: string;
  contrast?: CompareContrast | null;
}

export function CompareModule({ title, sub, label, href, contrast }: CompareModuleProps) {
  return (
    <section className="cm-wrap">
      <div className="cm-inner">
        <div className="cm">
          <div>
            <div className="cm-t">{title}</div>
            <div className="cm-s">{sub}</div>
            {contrast && (
              <div className="cm-contrast">
                <span>
                  {contrast.aLabel} <b>~${compactPrice(contrast.aValue)}</b>
                </span>
                <span className="cm-vs">vs</span>
                <span>
                  {contrast.bLabel} <b>~${compactPrice(contrast.bValue)}</b>
                </span>
              </div>
            )}
          </div>
          <a className="cm-b" href={href}>
            {label} →
          </a>
        </div>
      </div>
    </section>
  );
}

export default CompareModule;
