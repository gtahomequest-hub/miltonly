// src/components/hub/HubPage.tsx
import './hub-theme.css';
import './hub-sections.css';
import type { HubData } from './types';
import {
  HubHero,
  HubGlance,
  HubVideoStreets,
  HubStreets,
  HubOverview,
  HubMarket,
  HubSchools,
  HubCondos,
  HubFaqs,
  HubSiblings,
  HubDualCta,
} from './sections';
import { SiteNav } from '../nav/SiteNav';
import { HomeFooter } from '../home/HomeFooter';
import type { FooterData, TrustInfo } from '../home/types';

// THE ORDER, and why.
//
//   Nav        the three-menu header, every link a real anchor
//   Hero       name, one derived character line, four intent squares that all resolve
//   Glance     derived facts only, each carrying its own basis
//   01 Film    the hood's own filmed streets — rung one, and the thing nobody else has
//   02 Ladder  every published street, ranked, marked where filmed, each carrying the
//              street page's own typical and that figure's sample — rung two
//   03 About   the generated read
//   04 Market  how it trades, against Milton
//   05 Schools position against the Town boundary, where any stand
//   06 Condos  buildings with a page
//   07 FAQs
//   08 Nearby
//   09 CTAs
//   Footer     the homepage's live link graph
//
// Film sits ABOVE the ladder and the prose deliberately: a visitor who has never heard of this
// site learns in one glance that somebody drove these streets. On the 14 hubs with no clip the
// section does not render at all, and 02 becomes the opening.
export function HubPage({
  data,
  footer,
  brand,
}: {
  data: HubData;
  footer: FooterData;
  brand: TrustInfo;
}) {
  return (
    <div className="hub-v2 hub-v3">
      <SiteNav variant="page" />
      <HubHero data={data} />
      <HubGlance data={data} />
      <HubVideoStreets data={data} />
      <HubStreets data={data} />
      <HubOverview data={data} />
      <HubMarket data={data} />
      <HubSchools data={data} />
      <HubCondos data={data} />
      <HubFaqs data={data} />
      <HubSiblings data={data} />
      <HubDualCta data={data} />
      <HomeFooter footer={footer} brand={brand} />
    </div>
  );
}

export default HubPage;
