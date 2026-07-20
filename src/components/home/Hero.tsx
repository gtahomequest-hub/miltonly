// src/components/home/Hero.tsx
import type { HeroContent, MiltonStats, MlsTabKey, TrustInfo } from './types';
import { TabIcon } from './icons';
import { AskBar } from './AskBar';
import { compactPrice } from './format';

interface HeroProps {
  hero: HeroContent;
  stats: MiltonStats;
  trust: TrustInfo;
  onIntent: (k: MlsTabKey) => void;
}

export function Hero({ hero, stats, trust, onIntent }: HeroProps) {
  return (
    <header className="m-hero">
      <div className="m-wrap">
        <div className="m-inner">
          <span className="m-eyebrow">{hero.eyebrow}</span>
          <h1>
            {hero.headline}
            <br />
            <span className="m-grad">{hero.headlineAccent}</span>
          </h1>
          <p className="m-lede">{hero.lede}</p>

          <AskBar examples={hero.askExamples} />

          <div className="m-pills">
            {hero.pills.map((p) => (
              <button
                key={p.key}
                className={`m-pill-btn${p.mostAsked ? ' m-feat' : ''}`}
                onClick={() => onIntent(p.key)}
              >
                <TabIcon k={p.key} />
                {p.label}
                {p.mostAsked && <span className="m-most">Most asked</span>}
              </button>
            ))}
          </div>

          <div className="m-herostats">
            <div className="m-hs">
              <div className="m-n">
                <b>$</b>
                {compactPrice(stats.typicalPrice)}
              </div>
              <div className="m-l">typical Milton home</div>
            </div>
            <div className="m-hs">
              <div className="m-n">{stats.sold12mo}</div>
              <div className="m-l">sold · last 12 months</div>
            </div>
            <div className="m-hs">
              <div className="m-n">{stats.onMarket}</div>
              <div className="m-l">on the market today</div>
            </div>
          </div>

          <div className="m-trustlogos">
            <span>
              ★ {trust.rating} · {trust.reviewCount}+ families helped
            </span>
            <span>·</span>
            <b>{trust.credentials[0]}</b>
            <span>·</span>
            <span>TRREB · RECO</span>
          </div>
        </div>
      </div>
    </header>
  );
}
