// src/components/home/HomePage.tsx
'use client';

import './home-theme.css';
import type { HomepageData } from './types';
import type { BoardTab } from '@/lib/board/computeBoard';
import { HomeNav } from './HomeNav';
import { Hero } from './Hero';
import { SearchBand } from './SearchBand';
import { TheBoard } from '../board/TheBoard';
import { TrustBand } from './TrustBand';
import { HomeFooter } from './HomeFooter';

// Board V1: the Board is now the homepage's single market read. The sections it
// supersedes — MarketCommentary ("How Milton is trading"), NeighbourhoodIndex,
// VipStrip, and DualCTA — were removed from the render so the Board doesn't sit
// alongside what it replaces (browsing lives in the nav mega-menus + footer; the
// hero pills carry the CTAs). Those components remain in-repo. SearchBand and
// TrustBand are kept (see recon in the report). getHomepageData still computes
// neighbourhoods/vipStreets/commentary — trimming that is a later perf pass.
export function HomePage({ data, board }: { data: HomepageData; board: BoardTab[] | null }) {
  return (
    <div className="home-v2">
      <HomeNav />
      <Hero hero={data.hero} stats={data.stats} trust={data.trust} />
      <SearchBand />
      {board && board.length > 0 && <TheBoard board={board} />}
      <TrustBand />
      <HomeFooter footer={data.footer} brand={data.trust} />
    </div>
  );
}

export default HomePage;
