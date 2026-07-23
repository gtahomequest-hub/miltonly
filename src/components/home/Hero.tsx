// src/components/home/Hero.tsx
import type { HeroContent, MiltonStats, TrustInfo } from './types';
import { AskBar } from './AskBar';
import { HeroMap } from './HeroMap';
import { IconSell, IconSearch, IconRent, IconChat } from './icons';
import { compactPrice } from './format';

interface HeroProps {
  hero: HeroContent;
  stats: MiltonStats;
  trust: TrustInfo;
}

// Leading icon for each pill (existing repo icon set — no dependency).
function PillIcon({ label }: { label: string }) {
  if (label === 'Value my home') return <IconSell />;
  if (label === 'Buying') return <IconSearch />;
  if (label === 'Renting') return <IconRent />;
  if (label === 'Talk to Aamir') return <IconChat />;
  return null;
}

export function Hero({ hero, stats, trust }: HeroProps) {
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
                <a
                  key={p.label}
                  href={p.href}
                  className={`m-pill-btn${p.cta ? ' m-pill-cta' : ''}`}
                >
                  <span className="m-pill-ic">
                    <PillIcon label={p.label} />
                  </span>
                  {p.label}
                </a>
              ))}
            </div>
            {/* trust markers now live in a flush bar inside the card */}
            <div className="m-cardtrust">
              <span className="m-stars" aria-hidden="true">★★★★★</span>
              <span>{trust.rating.toFixed(1)}</span>
              <span className="m-td">·</span>
              <span>{trust.reviewCount}+ families helped</span>
              <span className="m-td">·</span>
              <b>{trust.credentials[0]}</b>
              <span className="m-td">·</span>
              <span>TRREB · RECO</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
