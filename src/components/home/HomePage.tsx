// src/components/home/HomePage.tsx
'use client';

import './home-theme.css';
import './home-sections.css';
import type { HomepageData } from './types';
import type { BoardTab } from '@/lib/board/computeBoard';
import type { MegaLive } from '@/components/nav/megaTypes';
import { SiteNav } from '../nav/SiteNav';
import { Hero } from './Hero';
import { VideoStreets } from './VideoStreets';
import { NewestListings } from './NewestListings';
import { NeighbourhoodLadder } from './NeighbourhoodLadder';
import { ValuationBand } from './ValuationBand';
import { DailyBrief } from './DailyBrief';
import { TheBoard } from '../board/TheBoard';
import { HomeFooter } from './HomeFooter';

// THE ORDER, and why it is this one.
//
//   Nav          three menus, every link a real anchor in the served HTML
//   Hero         one search box + Milton right now
//   01 Video     the thing nobody else has, before the thing everybody has
//   02 Newest    live inventory, each card linking out to its street's neighbourhood
//   03 Hoods     all 22 published hubs, ranked, with each hub's own k-gated price
//   The Board    the market read, unchanged
//   04 Valuation the one proven converting component, with three live proof points
//   05 Brief     low-friction email capture into the existing lead path
//   Footer       the link graph
//
// NO PRICE-DROP SECTION, deliberately and by ruling. DB1 records THAT a price changed and
// never what it changed from, so "dropped" is a claim the data cannot support. The section
// returns when a prior price is stored, not before. The TrustBand it replaced is retired:
// its 27 words of adjectives are now four live figures in the hero and three in section 04.
export function HomePage({
  data,
  board,
  mega,
}: {
  data: HomepageData;
  board: BoardTab[] | null;
  mega: MegaLive;
}) {
  return (
    <div className="home-v2">
      <SiteNav variant="home" live={mega} />
      <Hero hero={data.hero} stats={data.stats} trust={data.trust} />
      <VideoStreets streets={data.videoStreets} total={data.videoCount} />
      <NewestListings listings={data.newestListings} newThisWeek={data.stats.newThisWeek} />
      <NeighbourhoodLadder neighbourhoods={data.neighbourhoods} />
      {board && board.length > 0 && <TheBoard board={board} />}
      <ValuationBand
        streetPageCount={data.streetPageCount}
        sold12mo={data.stats.sold12mo}
        soldToAskPct={data.soldToAskPct}
        videoCount={data.videoCount}
      />
      <DailyBrief />
      <HomeFooter footer={data.footer} brand={data.trust} />
    </div>
  );
}

export default HomePage;
