// src/components/home/TrustBar.tsx
import type { TrustInfo } from './types';

export function TrustBar({ trust }: { trust: TrustInfo }) {
  return (
    <div className="m-trustbar">
      <div className="m-wrap">
        <div className="m-ti">
          <span className="m-g">★ {trust.rating}</span> from {trust.reviewCount}+ families helped
        </div>
        {trust.credentials.map((c, i) => (
          <div className="m-ti" key={c}>
            {i === 0 ? <b>{c}</b> : c}
          </div>
        ))}
        <div className="m-ti">
          IDX #{trust.idx} · VOW #{trust.vow}
        </div>
      </div>
    </div>
  );
}
