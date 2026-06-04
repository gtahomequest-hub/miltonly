// src/components/home/HomeFooter.tsx
import type { FooterData, TrustInfo } from './types';

interface Props {
  footer: FooterData;
  brand: TrustInfo;
}

export function HomeFooter({ footer, brand }: Props) {
  const moreNbhd = footer.neighbourhoodCount - footer.topNeighbourhoods.length;
  const moreStreets = footer.streetCount - footer.topStreets.length;
  return (
    <footer className="m-footer">
      <div className="m-wrap">
        <div className="m-fgrid">
          <div className="m-fcol m-brand">
            <div className="m-logo">Miltonly</div>
            <p>
              The definitive read on Milton real estate — neighbourhood by neighbourhood, street by
              street.
            </p>
          </div>
          <div className="m-fcol">
            <h4>Neighbourhoods</h4>
            {footer.topNeighbourhoods.map((n) => (
              <a href={`/neighbourhoods/${n.slug}`} key={n.slug}>
                {n.name}
              </a>
            ))}
            {moreNbhd > 0 && <a href="/neighbourhoods">+ {moreNbhd} more</a>}
          </div>
          <div className="m-fcol">
            <h4>Streets</h4>
            {footer.topStreets.map((s) => (
              <a href={`/streets/${s.slug}`} key={s.slug}>
                {s.name}
              </a>
            ))}
            {moreStreets > 0 && <a href="/streets">+ {moreStreets} more</a>}
          </div>
          <div className="m-fcol">
            <h4>Market</h4>
            <a href="#market">Milton trends</a>
            <a href="/sold">Sold data</a>
            <a href="#mls">Explore MLS</a>
          </div>
          <div className="m-fcol">
            <h4>Work with us</h4>
            <a href="/sell">Home valuation</a>
            <a href="#mls">Build wealth</a>
            <a href="/contact">Contact</a>
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
