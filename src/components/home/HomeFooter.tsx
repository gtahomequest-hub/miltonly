// src/components/home/HomeFooter.tsx
import type { FooterData, TrustInfo } from './types';
import { FooterSearch } from './FooterSearch';

interface Props {
  footer: FooterData;
  brand: TrustInfo;
}

// V1 deep-forest homepage footer: brand + a street-first search well over a
// 4-column link graph (Neighbourhoods / Condo buildings / Streets / Styles &
// tools). The two dead #mls anchors are gone. Rolling this treatment site-wide
// (FooterSection on other pages) is a separate later pass — not touched here.
export function HomeFooter({ footer, brand }: Props) {
  const moreNbhd = footer.neighbourhoodCount - footer.topNeighbourhoods.length;
  const moreStreets = footer.streetCount - footer.topStreets.length;
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

        <div className="m-fgrid">
          <div className="m-fcol">
            <h4>Neighbourhoods</h4>
            {footer.topNeighbourhoods.map((n) => (
              <a href={`/neighbourhoods/${n.slug}`} key={n.slug}>
                {n.name}
              </a>
            ))}
            <a href="/neighbourhoods">All {footer.neighbourhoodCount} neighbourhoods{moreNbhd > 0 ? ` →` : ''}</a>
          </div>

          <div className="m-fcol">
            <h4>Condo buildings</h4>
            <a href="/condos">Browse condo buildings</a>
            <a href="/condos-guide">Condo buying guide</a>
            <a href="/potl">POTL &amp; freehold condos</a>
          </div>

          <div className="m-fcol">
            <h4>Streets</h4>
            {footer.topStreets.map((s) => (
              <a href={`/streets/${s.slug}`} key={s.slug}>
                {s.name}
              </a>
            ))}
            <a href="/streets">All {footer.streetCount} streets{moreStreets > 0 ? ` →` : ''}</a>
            <a href="/map">Street map</a>
          </div>

          <div className="m-fcol">
            <h4>Styles &amp; tools</h4>
            <a href="/freehold">Freehold homes</a>
            <a href="/sold">Sold data &amp; trends</a>
            <a href="/compare">Compare</a>
            <a href="/sell">Home valuation</a>
            <a href="/schools">Schools</a>
            <a href="/mosques">Mosques</a>
          </div>
        </div>

        <div className="m-compliance">
          RECO / TREB / VOW compliance disclosures · IDX #{brand.idx} · VOW #{brand.vow} · MLS® data
          displayed under the terms of the applicable feed agreements. Information deemed reliable
          but not guaranteed. © Miltonly.
        </div>
      </div>
    </footer>
  );
}

export default HomeFooter;
