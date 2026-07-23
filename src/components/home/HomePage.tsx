// src/components/home/HomePage.tsx
'use client';

import './home-theme.css';
import type { HomepageData } from './types';
import { HomeNav } from './HomeNav';
import { Hero } from './Hero';
import { SearchBand } from './SearchBand';
import { MarketCommentary } from './MarketCommentary';
import { NeighbourhoodIndex } from './NeighbourhoodIndex';
import { VipStrip } from './VipStrip';
import { DualCTA } from './DualCTA';
import { TrustBand } from './TrustBand';
import { HomeFooter } from './HomeFooter';

export function HomePage({ data }: { data: HomepageData }) {
  return (
    <div className="home-v2">
      <HomeNav />
      <Hero hero={data.hero} stats={data.stats} trust={data.trust} />
      <SearchBand />
      <MarketCommentary commentary={data.commentary} />
      <NeighbourhoodIndex items={data.neighbourhoods} total={data.neighbourhoodCount} />
      <VipStrip streets={data.vipStreets} />
      <DualCTA />
      <TrustBand />
      <HomeFooter footer={data.footer} brand={data.trust} />
    </div>
  );
}

export default HomePage;
