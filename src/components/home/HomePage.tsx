// src/components/home/HomePage.tsx
'use client';

import './home-theme.css';
import type { HomepageData } from './types';
import type { BoardTab } from '@/lib/board/computeBoard';
import { HomeNav } from './HomeNav';
import { Hero } from './Hero';
import { TheBoard } from '../board/TheBoard';
import { TrustBand } from './TrustBand';
import { HomeFooter } from './HomeFooter';

// Board V1: the Board is the homepage's single market read. The sections it
// supersedes — MarketCommentary, NeighbourhoodIndex, VipStrip, DualCTA — plus the
// SearchBand were removed from the render (all components remain in-repo; browsing
// lives in the nav mega-menus + footer, the hero pills carry the CTAs). The nav
// scroll-reveal search now anchors on the hero ask bar (#m-hero-askbar) since
// #m-searchband is gone. Final order: Nav → Hero → Board → TrustBand → Footer.
export function HomePage({ data, board }: { data: HomepageData; board: BoardTab[] | null }) {
  return (
    <div className="home-v2">
      <HomeNav />
      <Hero hero={data.hero} stats={data.stats} trust={data.trust} />
      {board && board.length > 0 && <TheBoard board={board} />}
      <TrustBand />
      <HomeFooter footer={data.footer} brand={data.trust} />
    </div>
  );
}

export default HomePage;
