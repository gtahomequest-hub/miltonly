// src/components/home/HomePage.tsx
'use client';

import './home-theme.css';
import './home-sections.css';
import type { HomepageData } from './types';
import type { MegaLive } from '@/components/nav/megaTypes';
import SoldHistoryLine from '@/components/vow/SoldHistoryLine';
import { SiteNav } from '../nav/SiteNav';
import { Hero } from './Hero';
import { VideoStreets } from './VideoStreets';
import { NewestListings } from './NewestListings';
import { NeighbourhoodLadder } from './NeighbourhoodLadder';
import { ValuationBand } from './ValuationBand';
import { DailyBrief } from './DailyBrief';
import { HomeFooter } from './HomeFooter';

// THE ORDER, and why it is this one.
//
//   Nav          four menus, every link a real anchor in the served HTML
//   Hero         one search box + Milton right now (active and new counts)
//   01 Video     the thing nobody else has, before the thing everybody has
//   02 Newest    live inventory, each card linking out to its street's neighbourhood
//   03 Hoods     all published hubs, ranked by homes for sale now
//   Sold line    the one neutral line where The Board was
//   04 Valuation the one proven converting component
//   05 Brief     low-friction email capture into the existing lead path
//   Footer       the link graph
//
// THE BOARD IS GONE (MC-046 R7, PropTx VOW Best Practices item 40). Every tab was sold, leased
// and days-on-market data, and all five tabs rode in this component's props. In its place, at
// most once on the page, the neutral line: it carries no figure, no count and no status.
//
// NO PRICE-DROP SECTION, deliberately and by ruling. Which listing changed price, and from
// what, is price history, a VOW-only fact.
export function HomePage({ data, mega }: { data: HomepageData; mega: MegaLive }) {
  return (
    <div className="home-v2">
      <SiteNav variant="home" live={mega} />
      <Hero hero={data.hero} stats={data.stats} trust={data.trust} />
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

export default HomePage;
