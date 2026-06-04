// src/components/guides/GuidesIndexPage.tsx
import './guides-theme.css';
import type { GuidesIndexData } from './types';
import { GuidesHero, GuidesCategories, GuidesDualCta } from './sections';

export function GuidesIndexPage({ data }: { data: GuidesIndexData }) {
  return (
    <div className="guides-v2">
      <GuidesHero data={data} />
      <GuidesCategories data={data} />
      <GuidesDualCta eyebrow="Your next move" buyer={data.ctaBuyer} seller={data.ctaSeller} />
    </div>
  );
}

export default GuidesIndexPage;