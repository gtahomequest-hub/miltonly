// src/components/home-design/HomeDesign.tsx
// MH-012, MH-013: the homepage with a new hero, for review. The header is the live SiteNav (home
// variant, with the MC-047 registrant strip) and everything under the hero is HomePage's sections
// in HomePage's order, on the same live data, so each option is judged in place. MH-013 recolours
// the whole page: the palette's CSS variables sit on this root, and brand-preview.css repaints the
// nav, the sections and the footer from them, scoped to `.bp`, which only this preview renders.
// The live homepage (src/components/home/HomePage.tsx and Hero.tsx) and its stylesheets are untouched.
'use client';

import type { CSSProperties } from 'react';
import '@/components/home/home-theme.css';
import '@/components/home/home-sections.css';
import './home-design.css';
import './brand-preview.css';
import type { HomepageData } from '@/components/home/types';
import type { MegaLive } from '@/components/nav/megaTypes';
import SoldHistoryLine from '@/components/vow/SoldHistoryLine';
import { SiteNav } from '@/components/nav/SiteNav';
import { VideoStreets } from '@/components/home/VideoStreets';
import { NewestListings } from '@/components/home/NewestListings';
import { NeighbourhoodLadder } from '@/components/home/NeighbourhoodLadder';
import { ValuationBand } from '@/components/home/ValuationBand';
import { DailyBrief } from '@/components/home/DailyBrief';
import { HomeFooter } from '@/components/home/HomeFooter';
import { HeroDesign, type HeroOption } from './HeroDesign';
import { PALETTES, paletteVars, WORDMARKS, type PaletteKey, type Wordmark } from './tokens';

export type PreviewState = { option: HeroOption; palette: PaletteKey; wordmark: Wordmark };

const OPTIONS: { key: HeroOption; name: string }[] = [
  { key: 'c', name: 'Doors' },
  { key: 'd', name: 'Four paths' },
];

const href = (s: PreviewState) => `/design-preview/home?option=${s.option}&palette=${s.palette}&wordmark=${s.wordmark}`;

/** Review tooling, not part of the design: which option, palette and wordmark this is. */
function ReviewBar({ state }: { state: PreviewState }) {
  return (
    <div className="hd-review" role="navigation" aria-label="Design options">
      <span className="hd-review-tag">MH-013 · design preview, not the live homepage</span>
      <span className="hd-review-group" aria-label="Layout">
        {OPTIONS.map((o) => (
          <a key={o.key} href={href({ ...state, option: o.key })} aria-current={o.key === state.option ? 'true' : undefined}>
            {o.key.toUpperCase()} · {o.name}
          </a>
        ))}
      </span>
      <span className="hd-review-group" aria-label="Palette">
        {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
          <a key={k} href={href({ ...state, palette: k })} aria-current={k === state.palette ? 'true' : undefined}>
            {k} · {PALETTES[k].name}
          </a>
        ))}
      </span>
      <span className="hd-review-group" aria-label="Wordmark">
        {WORDMARKS.map((w) => (
          <a key={w} href={href({ ...state, wordmark: w })} aria-current={w === state.wordmark ? 'true' : undefined}>
            Wordmark · {w === 'script' ? 'script' : 'serif'}
          </a>
        ))}
      </span>
    </div>
  );
}

export function HomeDesign({ state, data, mega }: { state: PreviewState; data: HomepageData; mega: MegaLive }) {
  const counts = {
    onMarket: data.stats.onMarket,
    newThisWeek: data.stats.newThisWeek,
    rentalsAvailable: data.stats.rentalsAvailable,
  };
  return (
    <div
      className={`home-v2 bp bp-wm-${state.wordmark}`}
      data-palette={state.palette}
      style={paletteVars(PALETTES[state.palette]) as CSSProperties}
    >
      <SiteNav variant="home" live={mega} />
      <HeroDesign option={state.option} counts={counts} />
      <ReviewBar state={state} />
      <VideoStreets streets={data.videoStreets} total={data.videoCount} />
      <NewestListings listings={data.newestListings} newThisWeek={data.stats.newThisWeek} />
      <NeighbourhoodLadder neighbourhoods={data.neighbourhoods} />
      <section className="mh-soldline" aria-label="Milton sold history">
        <div className="m-wrap">
          <SoldHistoryLine subject="Milton" soldViewHref="/sold" tone="dark" />
        </div>
      </section>
      <ValuationBand streetPageCount={data.streetPageCount} videoCount={data.videoCount} />
      <DailyBrief />
      <HomeFooter footer={data.footer} brand={data.trust} />
    </div>
  );
}

export default HomeDesign;
