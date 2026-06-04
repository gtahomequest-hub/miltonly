// src/components/condo/CondoPage.tsx
import './condo-theme.css';
import type { CondoData } from './types';
import {
  CondoHero,
  CondoCost,
  CondoBedrooms,
  CondoOverview,
  CondoListings,
  CondoAmenities,
  CondoRulesSection,
  CondoFaqs,
  CondoNearbySection,
  CondoDualCta,
} from './sections';

export function CondoPage({ data }: { data: CondoData }) {
  return (
    <div className="condo-v2">
      <CondoHero data={data} />
      <CondoCost data={data} />
      <CondoBedrooms data={data} />
      <CondoOverview data={data} />
      <CondoListings data={data} />
      <CondoAmenities data={data} />
      <CondoRulesSection data={data} />
      <CondoFaqs data={data} />
      <CondoNearbySection data={data} />
      <CondoDualCta data={data} />
    </div>
  );
}

export default CondoPage;
