// src/components/home/Hero.tsx
import type { HeroContent, MiltonStats, MlsTabKey, TrustInfo } from './types';
import { TabIcon } from './icons';
import { AskBar } from './AskBar';
import { HeroMap } from './HeroMap';
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
      <HeroMap />
      <div className="m-wrap">
        <div className="m-inner">
          {/* 2026-07-21 iteration (Better.com conversion pattern): white
              Kaushan "Milton" over Playfair white (the gradient now lives
              ONLY on the nav wordmark); stat row primes credibility ABOVE
              the ask card; the four intent chips sit INSIDE the card below
              the input; trust line closes below the card. */}
          <h1>
            <span className="m-hl-milton">{hero.headline}</span>
            <br />
            <span className="m-hl-ency">{hero.headlineAccent}</span>
          </h1>
          <p className="m-lede">{hero.lede}</p>

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

          <div className="m-askcard">
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
