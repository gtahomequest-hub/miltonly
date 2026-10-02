// src/components/home-design/HomeDesign.tsx
// MH-012: the homepage with a new hero, for review. The header is the live SiteNav (home variant,
// with the MC-047 registrant strip) and everything under the hero is HomePage's sections in
// HomePage's order, on the same live data, so each option is judged in place. Only the hero is
// new. The live homepage (src/components/home/HomePage.tsx and Hero.tsx) is not touched.
'use client';

import '@/components/home/home-theme.css';
import '@/components/home/home-sections.css';
import './home-design.css';
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

const OPTIONS: { key: HeroOption; name: string }[] = [
  { key: 'a', name: 'Road' },
  { key: 'b', name: 'Sentences' },
  { key: 'c', name: 'Doors' },
];

/** Review tooling, not part of the design: which option this is, and the other two. */
function ReviewBar({ option }: { option: HeroOption }) {
  return (
    <div className="hd-review" role="navigation" aria-label="Design options">
      <span className="hd-review-tag">MH-012 · hero design preview, not the live homepage</span>
      <span className="hd-review-group">
        {OPTIONS.map((o) => (
          <a key={o.key} href={`/design-preview/home?option=${o.key}`} aria-current={o.key === option ? 'true' : undefined}>
            {o.key.toUpperCase()} · {o.name}
          </a>
        ))}
      </span>
    </div>
  );
}

export function HomeDesign({ option, data, mega }: { option: HeroOption; data: HomepageData; mega: MegaLive }) {
  const counts = {
    onMarket: data.stats.onMarket,
    newThisWeek: data.stats.newThisWeek,
    rentalsAvailable: data.stats.rentalsAvailable,
  };
  return (
    <div className="home-v2">
      <SiteNav variant="home" live={mega} />
      <HeroDesign option={option} counts={counts} />
      <ReviewBar option={option} />
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
