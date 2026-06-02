// src/components/home/HomePage.tsx
'use client';

import { useRef, useState } from 'react';
import './home-theme.css';
import type { HomepageData, MlsTabKey } from './types';
import { HomeNav } from './HomeNav';
import { Hero } from './Hero';
import { SearchBand } from './SearchBand';
import { MarketCommentary } from './MarketCommentary';
import { NeighbourhoodIndex } from './NeighbourhoodIndex';
import { MlsExplore } from './MlsExplore';
import { VipStrip } from './VipStrip';
import { DualCTA } from './DualCTA';
import { TrustBand } from './TrustBand';
import { HomeFooter } from './HomeFooter';

export function HomePage({ data }: { data: HomepageData }) {
  const [activeTab, setActiveTab] = useState<MlsTabKey>(data.mls.defaultTab);
  const mlsRef = useRef<HTMLDivElement>(null);

  const goToLens = (k: MlsTabKey) => {
    setActiveTab(k);
    mlsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="home-v2">
      <HomeNav />
      <Hero hero={data.hero} stats={data.stats} trust={data.trust} onIntent={goToLens} />
      <SearchBand />
      <MarketCommentary commentary={data.commentary} />
      <NeighbourhoodIndex items={data.neighbourhoods} total={data.neighbourhoodCount} />
      <div ref={mlsRef}>
        <MlsExplore config={data.mls} activeTab={activeTab} onSelect={setActiveTab} />
      </div>
      <VipStrip streets={data.vipStreets} />
      <DualCTA />
      <TrustBand />
      <HomeFooter footer={data.footer} brand={data.trust} />
    </div>
  );
}

export default HomePage;
