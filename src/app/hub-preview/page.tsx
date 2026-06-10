import HubPage from '@/components/hub/HubPage';
import { mockHubUrban } from '@/components/hub/mockData';

export const metadata = {
  title: 'Hub v2 — design preview',
  robots: { index: false, follow: false },
};

export default function Page() { return <HubPage data={mockHubUrban} />; }
