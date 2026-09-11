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
import SiteNavLive from '../nav/SiteNavLive';
import { GuideUplinks } from '../guides/GuideUplinks';
import { guidesForHub } from '@/lib/guides/uplinks';

export function HubPage({ data }: { data: HubData }) {
  // MC-003 guide up-links. Condo-heavy means the hub lists condo buildings (the h-condos
  // section renders), which is the marker the battery's guide-links check reads.
  const guides = guidesForHub({ condoHeavy: data.condos.length > 0 || data.compareFacts?.hasFee === true });
  return (
    <div className="hub-v2">
      <SiteNavLive variant="page" />
      <HubHero data={data} />
      <HubGlance data={data} />
      <HubOverview data={data} />
      <HubMarket data={data} />
      <HubStreets data={data} />
      <HubVip data={data} />
      <HubCondos data={data} />
      <HubFaqs data={data} />
      <GuideUplinks guides={guides} context={data.name} variant="hub" />
      <HubSiblings data={data} />
      <HubDualCta data={data} />
    </div>
  );
}

export default HubPage;
