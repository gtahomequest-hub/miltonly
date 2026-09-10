import HubPage from '@/components/hub/HubPage';
import { mockHubUrban } from '@/components/hub/mockData';

export const metadata = {
  title: 'Hub v2 — design preview',
  robots: { index: false, follow: false },
};

export default function Page() { return <HubPage
      data={mockHubUrban}
      footer={{ neighbourhoods: [], topStreets: [], neighbourhoodCount: 0, streetCount: 0, streetPageCount: 0 }}
      brand={{ rating: 5, reviewCount: 235, credentials: [], idx: '1809031', vow: '1848370' }}
    />; }
