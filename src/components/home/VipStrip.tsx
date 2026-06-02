// src/components/home/VipStrip.tsx
import type { VipStreet } from './types';

interface Props {
  streets: VipStreet[];
}

export function VipStrip({ streets }: Props) {
  return (
    <section className="m-block" id="vip" style={{ background: 'var(--m-bg-secondary)' }}>
      <div className="m-wrap">
        <div className="m-row-between">
          <div className="m-sechead" style={{ marginBottom: 0 }}>
            <span className="m-eyebrow">Every street, read in depth</span>
            <h2>
              The street you live on. The one you&apos;re about to buy on. Read closely.
            </h2>
          </div>
          <a className="m-more" href="/streets">
            View all streets →
          </a>
        </div>
        <div className="m-vipgrid" style={{ marginTop: 30 }}>
          {streets.map((s) => (
            <a className="m-vip" href={`/streets/${s.slug}`} key={s.slug}>
              <div className="m-title">{s.name}</div>
              <div className="m-meta">{s.soldCount} sold · full street guide</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
