// src/components/home/HomeFooter.tsx
// The homepage's link graph, and the reason it is a section rather than a postscript.
//
// The page it sits under shipped 24 unique internal links, and 20 of them came from
// here — the nav emitted none, and this footer listed three of twenty-two hubs and two
// of the streets. A footer that truncates a list of twenty-two links to three is not
// tidier; it is a crawl budget spent on an ellipsis. Every published hub is named here
// now, and so is every in-demand street, because each one is a page we want found.
import type { FooterData, TrustInfo } from './types';
import { FooterSearch } from './FooterSearch';
import { OGL_MILTON_ATTRIBUTION } from '@/lib/town/roadFacts';

interface Props {
  footer: FooterData;
  brand: TrustInfo;
}

export function HomeFooter({ footer, brand }: Props) {
  return (
    <footer className="m-footer">
      <div className="m-wrap">
        <div className="m-ftop">
          <div className="m-fbrand">
            <div className="m-logo">Miltonly</div>
            <p>Milton Real Estate Encyclopedia — neighbourhood by neighbourhood, street by street.</p>
          </div>
          <FooterSearch />
        </div>

        {/* Every published hub, in the order the grid above ranks them. */}
        <div className="m-fhoods">
          <h4>All {footer.neighbourhoods.length} neighbourhoods</h4>
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
            <h4>In-demand streets</h4>
            {footer.topStreets.map((s) => (
              <a href={`/streets/${s.slug}`} key={s.slug}>
                {s.name}
              </a>
            ))}
            <a href="/streets">All {footer.streetCount} streets</a>
            <a href="/map">Street map</a>
          </div>

          <div className="m-fcol">
            <h4>Buy</h4>
            <a href="/listings">Homes for sale</a>
            <a href="/rentals">For rent</a>
            <a href="/sold">Recently sold</a>
            <a href="/exclusive">Exclusive listings</a>
            <a href="/compare">Compare</a>
          </div>

          <div className="m-fcol">
            <h4>Condos &amp; tenure</h4>
            <a href="/condos">Browse condo buildings</a>
            <a href="/condos-guide">Condo buying guide</a>
            <a href="/potl">POTL &amp; freehold condos</a>
            <a href="/freehold">Freehold homes</a>
          </div>

          <div className="m-fcol">
            <h4>Sell &amp; tools</h4>
            <a href="/sell">Home valuation</a>
            <a href="/sold">Sold data &amp; trends</a>
            <a href="/schools">Schools</a>
            <a href="/mosques">Mosques</a>
            <a href="/about">About Aamir</a>
            <a href="/book">Book a call</a>
          </div>
        </div>

        <div className="m-compliance">
          RECO / TREB / VOW compliance disclosures · IDX #{brand.idx} · VOW #{brand.vow} · MLS® data
          displayed under the terms of the applicable feed agreements. Information deemed reliable
          but not guaranteed. © Miltonly.
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
