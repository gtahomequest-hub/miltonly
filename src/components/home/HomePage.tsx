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
  // The lower "Explore Milton MLS — What are you here to do?" section was removed
  // (it duplicated the hero quick-picks). The hero pills have no destination yet;
  // their intent routing is a follow-up decision — see the removal report. Kept
  // as an inert handler so the buttons don't throw pending that decision.
  const onHeroIntent = () => {};

  return (
    <div className="home-v2">
      <HomeNav />
      <Hero hero={data.hero} stats={data.stats} trust={data.trust} onIntent={onHeroIntent} />
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
