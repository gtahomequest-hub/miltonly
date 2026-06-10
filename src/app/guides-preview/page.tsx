import GuidesIndexPage from '@/components/guides/GuidesIndexPage';
import { mockGuidesIndex } from '@/components/guides/mockData';

export const metadata = {
  title: 'Guides index — design preview',
  robots: { index: false, follow: false },
};

export default function Page() { return <GuidesIndexPage data={mockGuidesIndex} />; }