// src/components/hub/HubPage.tsx
import './hub-theme.css';
import type { HubData } from './types';
import {
  HubHero,
  HubGlance,
  HubOverview,
  HubMarket,
  HubStreets,
  HubVip,
  HubCondos,
  HubFaqs,
  HubSiblings,
  HubDualCta,
} from './sections';
import { SiteNav } from '../nav/SiteNav';

export function HubPage({ data }: { data: HubData }) {
  return (
    <div className="hub-v2">
      <SiteNav variant="page" />
      <HubHero data={data} />
      <HubGlance data={data} />
      <HubOverview data={data} />
      <HubMarket data={data} />
      <HubStreets data={data} />
      <HubVip data={data} />
      <HubCondos data={data} />
      <HubFaqs data={data} />
      <HubSiblings data={data} />
      <HubDualCta data={data} />
    </div>
  );
}

export default HubPage;
