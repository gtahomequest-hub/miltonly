// src/components/home/ValuationBand.tsx
// The valuation form, and the three claims that earn it the space.
//
// A form is not indexable content, so the prose beside it has to do the work. The three
// proof points are therefore not adjectives: each is a LIVE FIGURE, and each sentence
// describes exactly the set its figure counts.
//
// BOTH FIGURES HERE HAVE BEEN WRONG, and the fixes are the reason the shapes below look
// the way they do:
//
//   · "738 Milton streets with their own page" counted `surfacedStreetWhere()`, which is
//     entities with sold history OR a published page — the set allowed to appear in search
//     and in a hub ladder. 738 streets can be spoken about; 444 have a page. The count now
//     comes from publishedStreetPageCount(), the same set src/app/sitemap.ts emits, and the
//     sentence says "street pages published" rather than "streets".
//
//   · Sold-to-ask rendered as "0.980868783307145%". It was reading the Board's
//     `soldToAsk.value`, which is a RATIO that TheBoard multiplies by 100 at render, and
//     printing it raw with a percent sign welded on. It now reads `soldToAskPct` from
//     getMiltonSoldOverall(), the same all-Milton 12-month aggregate /sold publishes, which
//     is already a percent, and rounds it to a whole number for display.
//
// The lesson both share: a figure crossing a component boundary must carry its unit in its
// name. `soldToAsk` did not; `soldToAskPct` does.
//
// The form itself is HomeValuationCard, the only component in this repo with a proven
// conversion record: CASL consent text snapshotted at submit, honeypot, phone formatting,
// GA4 generate_lead, and the one ingest path behind it. It is reused whole, in its forest theme,
// with a homepage source tag.
import HomeValuationCard from '@/components/landing/HomeValuationCard';
import { SectionHead } from './SectionHead';

interface Props {
  /** published street PAGES, from the sitemap's set */
  streetPageCount: number;
  sold12mo: number;
  /** already a percent (98.1), not a ratio. null = k-suppressed */
  soldToAskPct: number | null;
  videoCount: number;
}

export function ValuationBand({ streetPageCount, sold12mo, soldToAskPct, videoCount }: Props) {
  // Only proof points with a live figure behind them render. A claim with a null figure is
  // dropped rather than softened into an adjective.
  const proof: { fig: string; figure: string; label: string }[] = [
    {
      fig: 'proof-street-pages',
      figure: streetPageCount.toLocaleString('en-CA'),
      label: 'Milton street pages published, each one researched and kept current',
    },
    {
      fig: 'proof-sales-12mo',
      figure: sold12mo.toLocaleString('en-CA'),
      label: 'sales tracked over the last 12 months, the basis of every figure here',
    },
  ];
  if (soldToAskPct !== null) {
    proof.push({
      fig: 'proof-sold-to-ask',
      // Whole-number percent. The reader is being told what homes close at, not being
      // handed a ratio to interpret.
      figure: `${Math.round(soldToAskPct)}%`,
      label: 'of asking, what Milton homes closed at over the last 12 months',
    });
  } else if (videoCount > 0) {
    proof.push({
      fig: 'proof-video-count',
      figure: videoCount.toLocaleString('en-CA'),
      label: 'streets filmed end to end, so a valuation starts from the street itself',
    });
  }

  return (
    <section className="mh-sec mh-value" id="valuation">
      <div className="m-wrap">
        <SectionHead
          index="04"
          title="What your home is worth, in writing"
          standfirst="Aamir reads the comparable sales on your street, not a national model's guess at your postal code. A written valuation, within 24 hours, no obligation."
        />
        <div className="mh-valuegrid">
          <ol className="mh-proof">
            {proof.map((p) => (
              <li key={p.fig}>
                <span className="mh-prooffig" data-fig={p.fig} data-value={p.figure}>
                  {p.figure}
                </span>
                <span className="mh-prooflabel">{p.label}</span>
              </li>
            ))}
          </ol>
          <div className="mh-valueform">
            <HomeValuationCard
              mlsNumber=""
              source="homepage-valuation"
              theme="forest"
              kicker="Free valuation, no obligation"
              title="What's your Milton home worth?"
              ctaLabel="Get my home's value"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default ValuationBand;
