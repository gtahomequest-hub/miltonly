// src/components/home/HomeFooter.tsx
// THE SITE'S MAP, on every page.
//
// The page it sat under shipped 24 unique internal links, and 20 of them came from here.
// Every published hub is named here, and so is every in-demand street, because each one is a
// page we want found. MH-006 (MA-004 change 9) made it the whole map: the eight guides, the
// schools and mosques with their counts, the current Market Watch edition, the flagship
// comparison, and the legal pages, which no forest page had linked anywhere. Every entity
// kind is one click from the bottom of every page. /sold is listed once; a link that lands on
// a redirect is not listed at all (the footer gate refuses a 3xx).
//
// IT CAPTURES. The brief field sits beside the search well (change 8): a footer on every page
// is a lead surface, and the one form in the chrome used to point at a sign-in wall.
//
// HEADINGS: one <h2>, then <h3> columns. Lighthouse heading-order failed on the homepage and
// named the five <h4>s that used to open here under no <h3>.
import type { FooterData, TrustInfo } from './types';
import type { NavContext } from '../nav/megaTypes';
import { FooterSearch } from './FooterSearch';
import { BriefSignup } from '../nav/BriefSignup';
import './footer.css';
import { OGL_MILTON_ATTRIBUTION } from '@/lib/town/roadFacts';
import { VOW_NOTICES } from "@/lib/vowNotice";

interface Props {
  footer: FooterData;
  brand: TrustInfo;
  /** the page's subject, recorded by the brief form; see NavContext */
  context?: NavContext;
}

export function HomeFooter({ footer, brand, context }: Props) {
  return (
    <footer className="m-footer">
      <div className="m-wrap">
        <div className="m-ftop">
          <div className="m-fbrand">
            <div className="m-logo">Miltonly</div>
            <h2>Milton real estate, neighbourhood by neighbourhood, street by street.</h2>
          </div>
          <div className="m-fforms">
            <FooterSearch />
            <BriefSignup id="m-footer-brief" context={context} where="footer" variant="footer" />
          </div>
        </div>

        {/* Every published hub, alphabetically. */}
        <div className="m-fhoods">
          <h3>All {footer.neighbourhoods.length} neighbourhoods</h3>
          <div className="m-fhoodlinks">
            {footer.neighbourhoods.map((n) => (
              <a href={`/neighbourhoods/${n.slug}`} key={n.slug}>
                {n.name}
              </a>
            ))}
          </div>
        </div>

        <div className="m-fgrid">
          <div className="m-fcol">
            {/* The basis is in the heading: these are ranked by recency-weighted sales, and the
                old "In-demand streets" stated no basis (MA-004 defect 15). */}
            <h3>Busiest streets, recent sales</h3>
            {footer.topStreets.map((s) => (
              <a href={`/streets/${s.slug}`} key={s.slug}>
                {s.name}
              </a>
            ))}
            {/* PAGES, not surfaced entities. The label said "All 738 streets" while 444
                street pages existed; 738 is the set allowed to appear in search and in a
                hub ladder. /streets is the index for both, and it states both itself. */}
            <a href="/streets">All {footer.streetPageCount} street pages</a>
            <a href="/schools">{footer.schoolCount ? `${footer.schoolCount} schools` : 'Schools'}</a>
            <a href="/mosques">{footer.mosqueCount ? `${footer.mosqueCount} mosques` : 'Mosques'}</a>
          </div>

          <div className="m-fcol">
            <h3>Buy</h3>
            <a href="/listings">Homes for sale</a>
            <a href="/rentals">Homes for rent</a>
            <a href="/condos">Condo buildings</a>
            <a href="/freehold">Freehold homes</a>
            <a href="/potl">POTL and freehold condos</a>
            <a href="/condos-guide">Condo buying guide</a>
            <a href="/compare/freehold-vs-condo">Freehold or condo</a>
            <a href="/compare">Compare</a>
            <a href="/exclusive">Exclusive listings</a>
          </div>

          <div className="m-fcol">
            <h3>Sell</h3>
            <a href="/sell">Home valuation</a>
            <a href="/sold">Sold prices and trends</a>
            <a href="/market-watch">Market watch</a>
            {footer.edition ? <a href={`/market-watch/${footer.edition.weekOf}`}>{footer.edition.label}</a> : null}
            <a href="/about">About Aamir</a>
          </div>

          <div className="m-fcol">
            <h3>Guides</h3>
            {footer.guides.map((g) => (
              <a href={`/guides/${g.slug}`} key={g.slug}>
                {g.title}
              </a>
            ))}
            <a href="/guides">All guides</a>
          </div>
        </div>

        <div className="m-flegal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>

        <div className="m-compliance">
          RECO / TREB / VOW compliance disclosures · IDX #{brand.idx} · VOW #{brand.vow} · MLS® data
          displayed under the terms of the applicable feed agreements.
          {" "}
          {/* PropTx's consumer notice, verbatim (VOW Best Practices item 5; MC-036). The footer is
              the one element on every page type, so this is the one place the sentence cannot be
              missing from a surface that shows VOW data. */}
          <span data-vow-notice>{VOW_NOTICES}</span>
          {" "}
          Information deemed reliable but not guaranteed. © Miltonly.
          {" "}
          {/* Required by the Open Government Licence – Milton wherever its data is published.
              Map pins, street positions, park and school locations all derive from it. */}
          {OGL_MILTON_ATTRIBUTION}
        </div>
      </div>
    </footer>
  );
}

export default HomeFooter;
