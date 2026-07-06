// src/components/compare/ComparePage.tsx
//
// THE NET-NEW two-column comparison composer (the only new architecture in the
// compare build). Renders a ComparisonData ({cfg, sideA, sideB}) as a forest
// side-by-side: grounded stat table + the three trades + per-side "who should
// choose" + honest tradeoff + bottom line + FAQ + CTA. Reuses the .hub-v2 forest
// tokens (hub-theme.css) + format helpers VERBATIM — same visual system as the
// tenure hubs. Single SiteNav, forest theme, zero navy.
//
// CONFIG-DRIVEN: every stat is read live from each side's compareFacts (the
// getTenureHubData seam). k-safe — any null cell degrades to silent (never
// $0/NaN/fabricated). A null-stats side renders silent cells cleanly.
import "../hub/hub-theme.css";
import "./compare-theme.css";
import React from "react";
import { SiteNav } from "../nav/SiteNav";
import CompareDecisionTool from "./CompareDecisionTool";
import { fullPrice, compactPrice } from "../hub/format";
import type { TenureCompareFacts } from "../hub/types";
import type { ComparisonData } from "@/lib/comparisonData";

const facts = (s: ComparisonData["sideA"]): TenureCompareFacts | undefined => s?.compareFacts;

// live "median A vs median B" fragment for the (live:) editorial slots. Silent
// (empty) if either median is sub-k — the sentence around it stays grammatical.
function priceGap(d: ComparisonData): string {
  const a = facts(d.sideA)?.medianList;
  const b = facts(d.sideB)?.medianList;
  if (!a || !b) return "";
  const la = d.cfg.sideA.label.toLowerCase();
  const lb = d.cfg.sideB.label.toLowerCase();
  return `a median ${la} home in Milton runs ${fullPrice(a)}, versus ${fullPrice(b)} for a ${lb}`;
}
function faqGap(d: ComparisonData): string {
  const a = facts(d.sideA)?.medianList;
  const b = facts(d.sideB)?.medianList;
  if (!a || !b) return "";
  const la = d.cfg.sideA.label.toLowerCase();
  const lb = d.cfg.sideB.label.toLowerCase();
  return `In Milton today, the median is ${fullPrice(a)} for ${la} versus ${fullPrice(b)} for a ${lb}.`;
}

// a single table cell value: rendered node or the silent state.
function Val({ children, silent, className }: { children?: React.ReactNode; silent?: boolean; className?: string }) {
  if (silent || children == null) return <div className="cmp-val cmp-silent">not stated</div>;
  return <div className={`cmp-val${className ? " " + className : ""}`}>{children}</div>;
}

function CountCell({ n }: { n: number | null }) {
  return <Val silent={n == null}>{n != null ? n.toLocaleString("en-CA") : null}</Val>;
}
function PriceCell({ n }: { n: number | null }) {
  return <Val silent={n == null}>{n != null ? fullPrice(n) : null}</Val>;
}
function RangeCell({ lo, hi }: { lo: number | null; hi: number | null }) {
  const ok = lo != null && hi != null;
  return <Val silent={!ok}>{ok ? `${compactPrice(lo as number)} – ${compactPrice(hi as number)}` : null}</Val>;
}
function DomCell({ n }: { n: number | null }) {
  return (
    <Val silent={n == null}>
      {n != null ? (
        <>
          {n}
          <span className="cmp-unit">days</span>
        </>
      ) : null}
    </Val>
  );
}
function FeeCell({ f }: { f: TenureCompareFacts | undefined }) {
  if (!f) return <Val silent />;
  if (!f.hasFee) return <div className="cmp-val cmp-nofee">No monthly fee</div>;
  const ok = f.feeLo != null && f.feeHi != null;
  return (
    <Val silent={!ok}>
      {ok ? (
        <>
          {fullPrice(f.feeLo as number)} – {fullPrice(f.feeHi as number)}
          <span className="cmp-unit">/mo</span>
        </>
      ) : null}
    </Val>
  );
}

function Row({ metric, a, b }: { metric: string; a: React.ReactNode; b: React.ReactNode }) {
  return (
    <div className="cmp-row">
      <div className="cmp-cell cmp-metric">{metric}</div>
      <div className="cmp-cell">{a}</div>
      <div className="cmp-cell">{b}</div>
    </div>
  );
}

function GroundedTable({ d }: { d: ComparisonData }) {
  const a = facts(d.sideA);
  const b = facts(d.sideB);
  return (
    <div className="cmp-table">
      <div className="cmp-row cmp-head">
        <div className="cmp-cell cmp-colhead cmp-corner">
          <div className="cmp-col-l">In Milton today</div>
        </div>
        <div className="cmp-cell cmp-colhead">
          <div className="cmp-col-l">{d.cfg.sideA.label}</div>
          <div className="cmp-col-s">{d.cfg.sideA.blurb}</div>
        </div>
        <div className="cmp-cell cmp-colhead">
          <div className="cmp-col-l">{d.cfg.sideB.label}</div>
          <div className="cmp-col-s">{d.cfg.sideB.blurb}</div>
        </div>
      </div>
      <Row metric="Active listings" a={<CountCell n={a?.activeCount ?? null} />} b={<CountCell n={b?.activeCount ?? null} />} />
      <Row metric="Median list price" a={<PriceCell n={a?.medianList ?? null} />} b={<PriceCell n={b?.medianList ?? null} />} />
      <Row
        metric="List price range"
        a={<RangeCell lo={a?.listLo ?? null} hi={a?.listHi ?? null} />}
        b={<RangeCell lo={b?.listLo ?? null} hi={b?.listHi ?? null} />}
      />
      <Row metric="Typical sold · 12 mo" a={<PriceCell n={a?.soldTypical ?? null} />} b={<PriceCell n={b?.soldTypical ?? null} />} />
      <Row metric="Sold · last 12 months" a={<CountCell n={a?.soldCount ?? null} />} b={<CountCell n={b?.soldCount ?? null} />} />
      <Row metric="Days on market" a={<DomCell n={a?.dom ?? null} />} b={<DomCell n={b?.dom ?? null} />} />
      <Row metric="Monthly fee" a={<FeeCell f={a} />} b={<FeeCell f={b} />} />
    </div>
  );
}

function ByTypePanel({ label, f }: { label: string; f: TenureCompareFacts | undefined }) {
  const rows = f?.subtypeMedians ?? [];
  return (
    <div className="cmp-bt">
      <div className="cmp-bt-h">{label} · by home type</div>
      {rows.length ? (
        rows.map((r) => (
          <div className="cmp-bt-row" key={r.label}>
            <div className="cmp-bt-l">{r.label}</div>
            <div className="cmp-bt-v">{fullPrice(r.value)}</div>
          </div>
        ))
      ) : (
        <div className="cmp-bt-empty">Not enough active listings to publish a by-type median.</div>
      )}
    </div>
  );
}

export function ComparePage({ data, source }: { data: ComparisonData; source: string }) {
  const { cfg } = data;
  const tableIntro = cfg.tableIntro.replace("{GAP}", priceGap(data));

  return (
    <div className="hub-v2">
      <SiteNav variant="page" />

      {/* hero */}
      <header className="h-hero">
        <div className="h-wrap">
          <div className="h-crumb">
            <a href="/">Miltonly</a>
            <span>/</span>
            <a href="/compare">Compare</a>
            <span>/</span>
            {cfg.breadcrumbLabel}
          </div>
          <div style={{ padding: "8px 0 6px" }}>
            <span className="h-eyebrow">{cfg.eyebrow}</span>
            <h1>{cfg.h1}</h1>
            <p className="h-character" style={{ maxWidth: 720 }}>
              {cfg.lede}
            </p>
          </div>
        </div>
      </header>

      {/* grounded side-by-side table */}
      <section className="h-block">
        <div className="h-wrap">
          <div className="h-sechead">
            <span className="h-eyebrow">The numbers</span>
            <h2>What each costs in Milton today</h2>
          </div>
          <GroundedTable d={data} />
          <div className="cmp-bytype">
            <ByTypePanel label={cfg.sideA.label} f={facts(data.sideA)} />
            <ByTypePanel label={cfg.sideB.label} f={facts(data.sideB)} />
          </div>
          <div className="cmp-src">{source}</div>
          <div className="h-overview" style={{ marginTop: 26 }}>
            <p style={{ maxWidth: 820 }}>{tableIntro}</p>
          </div>
        </div>
      </section>

      {/* the three trades */}
      <section className="h-block h-alt">
        <div className="h-wrap">
          <div className="h-sechead">
            <span className="h-eyebrow">The trade</span>
            <h2>{cfg.sectionTitles.trades}</h2>
          </div>
          <p className="cmp-trades-intro">{cfg.threeTradesIntro}</p>
          <div className="cmp-trades">
            {cfg.trades.map((t) => (
              <div className="cmp-trade" key={t.name}>
                <div className="cmp-trade-n">{t.name}</div>
                <div className="cmp-trade-b">{t.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* the decision tool — the ONE client island (besides SiteNav). Sliders
          map 1:1 onto the three trades the reader just finished; the header +
          sub stay server-rendered static text. Facts come off the SAME data
          object the grounded table used — no second fetch. */}
      <section className="h-block">
        <div className="h-wrap">
          <div className="h-sechead">
            <span className="h-eyebrow">Decide it live</span>
            <h2>Which side fits you? Weight what matters.</h2>
          </div>
          <p className="cmp-tool-sub">
            Move the three sliders to match what you actually care about. The answer updates live, using
            today&apos;s real Milton numbers.
          </p>
          <CompareDecisionTool
            factsA={facts(data.sideA)}
            factsB={facts(data.sideB)}
            hrefA={cfg.sideA.href}
            hrefB={cfg.sideB.href}
          />
        </div>
      </section>

      {/* who should choose which */}
      <section className="h-block">
        <div className="h-wrap">
          <div className="h-sechead">
            <span className="h-eyebrow">Your read</span>
            <h2>{cfg.sectionTitles.choose}</h2>
          </div>
          <div className="cmp-choose">
            <div className="cmp-side">
              <span className="cmp-side-tag">{cfg.sideA.label}</span>
              <h3>{cfg.whoChooseA.heading}</h3>
              <p>{cfg.whoChooseA.body}</p>
              <a className="cmp-side-link" href={cfg.sideA.href}>
                {cfg.sideA.hrefLabel} →
              </a>
            </div>
            <div className="cmp-side">
              <span className="cmp-side-tag">{cfg.sideB.label}</span>
              <h3>{cfg.whoChooseB.heading}</h3>
              <p>{cfg.whoChooseB.body}</p>
              <a className="cmp-side-link" href={cfg.sideB.href}>
                {cfg.sideB.hrefLabel} →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* the honest tradeoff */}
      <section className="h-block h-alt">
        <div className="h-wrap">
          <div className="h-sechead">
            <span className="h-eyebrow">Go in clear-eyed</span>
            <h2>{cfg.sectionTitles.tradeoff}</h2>
          </div>
          <div className="cmp-prose">
            <p>{cfg.honestTradeoff}</p>
          </div>
        </div>
      </section>

      {/* bottom line */}
      <section className="h-block">
        <div className="h-wrap">
          <div className="h-sechead">
            <span className="h-eyebrow">The bottom line</span>
            <h2>So which is your side?</h2>
          </div>
          <div className="cmp-prose">
            <p>{cfg.bottomLine}</p>
          </div>
        </div>
      </section>

      {/* faq */}
      <section className="h-block h-alt">
        <div className="h-wrap">
          <div className="h-sechead">
            <span className="h-eyebrow">Common questions</span>
            <h2>{cfg.sectionTitles.faq}</h2>
          </div>
          <div className="h-faq">
            {cfg.faqs.map((f, i) => (
              <div className="h-faq-item" key={i}>
                <div className="h-faq-q">{f.question}</div>
                <div className="h-faq-a">{f.answer.replace("{GAP}", faqGap(data)).replace(/\s{2,}/g, " ").trim()}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta row */}
      <section className="h-block">
        <div className="h-wrap">
          <div className="h-dual">
            <span className="h-eyebrow" style={{ color: "var(--h-green)" }}>
              Your move
            </span>
            <h2 style={{ fontFamily: "var(--h-serif)", fontWeight: 400, fontSize: 28, color: "#fff", marginTop: 8 }}>
              Still weighing it up?
            </h2>
            <div className="cmp-ctas">
              {cfg.ctas.map((c) => (
                <a className="cmp-cta" href={c.href} key={c.href}>
                  <span className="cmp-cta-l">{c.label}</span>
                  <span className="cmp-cta-s">{c.sub}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ComparePage;
