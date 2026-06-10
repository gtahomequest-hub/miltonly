import CondoPage from '@/components/condo/CondoPage';
import { mockCondoRich } from '@/components/condo/mockData';

export const metadata = {
  title: 'Condo v2 — design preview',
  robots: { index: false, follow: false },
};

export default function Page() { return <CondoPage data={mockCondoRich} />; }