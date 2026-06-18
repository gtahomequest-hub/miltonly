// src/app/compare/page.tsx
// /compare — the forest INDEX of comparison pages. REPLACES the old navy
// "coming soon" street-vs-street waitlist stub (that tool was never built; the
// waitlist + its CompareWaitlistForm are retired with this cut). Lists the live
// comparison pages as cards; the engine (COMPARISONS) lists more as they ship.
// Forest .hub-v2 theme, single SiteNav, zero navy.
import "@/components/hub/hub-theme.css";
import "@/components/compare/compare-theme.css";
import { config } from "@/lib/config";
import { generateMetadata as genMeta } from "@/lib/seo";
import { COMPARISONS } from "@/lib/comparisonData";
import { SiteNav } from "@/components/nav/SiteNav";
import SchemaScript from "@/components/SchemaScript";
import FooterSection from "@/components/sections/FooterSection";
import { generateBreadcrumbSchema, generateLocalBusinessSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata = genMeta({
  title: `Compare Milton Ownership Choices — Side by Side`,
  description: `Compare ${config.CITY_NAME} home ownership choices side by side: freehold vs condo prices, fees, and the real trade-offs — to find the side that fits you.`,
  canonical: `${config.SITE_URL}/compare`,
});

export default function CompareIndexPage() {
  const schemas: Array<Record<string, unknown>> = [
    generateBreadcrumbSchema([
      { name: "Home", url: config.SITE_URL },
      { name: "Compare", url: `${config.SITE_URL}/compare` },
    ]),
    generateLocalBusinessSchema(),
  ];

  return (
    <>
      <SchemaScript schemas={schemas} />
      <div className="hub-v2">
        <SiteNav variant="page" />

        <header className="h-hero">
          <div className="h-wrap">
            <div className="h-crumb">
              <a href="/">Miltonly</a>
              <span>/</span>
              Compare
            </div>
            <div style={{ padding: "8px 0 6px" }}>
              <span className="h-eyebrow">Milton, side by side</span>
              <h1>Compare Milton ownership choices side by side</h1>
              <p className="h-character" style={{ maxWidth: 680 }}>
                The honest comparisons — live Milton prices, fees, and the real trade-offs — so you
                can see which side fits your life, budget, and stage before you start touring.
              </p>
            </div>
          </div>
        </header>

        <section className="h-block">
          <div className="h-wrap">
            <div className="h-sechead">
              <span className="h-eyebrow">Comparisons</span>
              <h2>Pick a comparison</h2>
            </div>
            <div className="cmp-index">
              {COMPARISONS.map((c) => (
                <a className="cmp-card" href={`/compare/${c.slug}`} key={c.slug}>
                  <div className="cmp-card-vs">
                    <span className="cmp-card-pill">{c.sideALabel}</span>
                    <span className="cmp-card-x">vs</span>
                    <span className="cmp-card-pill">{c.sideBLabel}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.blurb}</p>
                  <span className="cmp-card-go">See the side-by-side →</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
      <FooterSection />
    </>
  );
}
