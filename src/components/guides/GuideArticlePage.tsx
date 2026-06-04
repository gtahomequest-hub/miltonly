// src/components/guides/GuideArticlePage.tsx
import './guides-theme.css';
import type { GuideArticleData } from './types';
import {
  GuideHero,
  GuideTakeaways,
  GuideBody,
  GuideFaqs,
  GuideRelated,
  GuidesDualCta,
} from './sections';

export function GuideArticlePage({ data }: { data: GuideArticleData }) {
  return (
    <div className="guides-v2">
      <GuideHero data={data} />
      <GuideTakeaways data={data} />
      <GuideBody data={data} />
      <GuideFaqs data={data} />
      <GuideRelated data={data} />
      <GuidesDualCta eyebrow="Ready when you are" buyer={data.ctaBuyer} seller={data.ctaSeller} />
    </div>
  );
}

export default GuideArticlePage;