// src/components/home/MlsExplore.tsx
import type { MlsExploreConfig, MlsLens, MlsTabKey } from './types';
import { TabIcon } from './icons';

function Panel({ lens }: { lens: MlsLens }) {
  return (
    <div className="m-panel">
      <div className="m-badge">
        {lens.badgeLabel}
        {lens.badgePill && <span className="m-pill">{lens.badgePill}</span>}
      </div>
      <h3>{lens.headline}</h3>
      <div className="m-desc">{lens.description}</div>

      <div className="m-chips">
        {lens.chips.map((c) => (
          <span key={c.label} className={`m-chip${c.compare ? ' m-cmp' : ''}`}>
            {c.compare ? `⇄ ${c.label}` : c.label}
          </span>
        ))}
      </div>

      {lens.listings && lens.listings.length > 0 && (
        <div className="m-listings">
          {lens.listings.map((l) => (
            <div className="m-lst" key={l.title}>
              <div className="m-title">{l.title}</div>
              <div className="m-meta">{l.meta}</div>
              <div className="m-sig">{l.signal}</div>
            </div>
          ))}
        </div>
      )}

      <div className="m-vow">
        <div className="m-txt">
          {lens.vow.text} <span>{lens.vow.sub}</span>
        </div>
        <button>{lens.vow.buttonLabel}</button>
      </div>

      {lens.compareRow && (
        <div className="m-comparerow">
          <b>Compare</b> {lens.compareRow}
        </div>
      )}
      {lens.vowNote && <div className="m-vownote">{lens.vowNote}</div>}
    </div>
  );
}

interface Props {
  config: MlsExploreConfig;
  activeTab: MlsTabKey;
  onSelect: (k: MlsTabKey) => void;
}

export function MlsExplore({ config, activeTab, onSelect }: Props) {
  const active = config.lenses.find((l) => l.key === activeTab) ?? config.lenses[0];
  return (
    <section className="m-block" id="mls">
      <div className="m-wrap">
        <div className="m-mls">
          <div className="m-head">
            <span className="m-eyebrow">Explore Milton MLS</span>
            <h2>What are you here to do?</h2>
          </div>
          <div className="m-tabs">
            {config.lenses.map((l) => (
              <button
                key={l.key}
                className={`m-tab${l.key === activeTab ? ' m-active' : ''}`}
                onClick={() => onSelect(l.key)}
              >
                <TabIcon k={l.key} />
                {l.tabLabel}
              </button>
            ))}
          </div>
          <Panel lens={active} />
        </div>
      </div>
    </section>
  );
}
