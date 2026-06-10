import GuideArticlePage from '@/components/guides/GuideArticlePage';
import { mockGuideArticle } from '@/components/guides/mockData';

export const metadata = {
  title: 'Guide article — design preview',
  robots: { index: false, follow: false },
};

export default function Page() { return <GuideArticlePage data={mockGuideArticle} />; }