// src/components/condo/icons.tsx
import type { ReactNode } from 'react';

const box = (children: ReactNode) => <svg viewBox="0 0 24 24">{children}</svg>;

export const IconBuilding = () =>
  box(<><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>);
export const IconWallet = () =>
  box(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1" /></>);
export const IconBed = () =>
  box(<><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" /><path d="M3 18h18M3 14h18" /><path d="M7 10V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" /></>);
export const IconPaw = () =>
  box(<><circle cx="6" cy="10" r="1.6" /><circle cx="10" cy="7" r="1.6" /><circle cx="14" cy="7" r="1.6" /><circle cx="18" cy="10" r="1.6" /><path d="M8 17a4 4 0 0 1 8 0c0 2-2 3-4 3s-4-1-4-3z" /></>);
export const IconCar = () =>
  box(<><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" rx="1" /><circle cx="7" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></>);
export const IconKeyR = () =>
  box(<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9 2 2-2 2 1.5 1.5" /></>);
export const IconSearch = () =>
  box(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);
export const IconTag = () =>
  box(<><path d="M20.6 13.4 11 3.8H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" /><circle cx="7.5" cy="7.5" r="1" /></>);
export const IconInvest = () =>
  box(<><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></>);

export function IntentIcon({ k }: { k: 'buy' | 'sell' | 'rent' | 'invest' }) {
  switch (k) {
    case 'buy':
      return <IconSearch />;
    case 'sell':
      return <IconTag />;
    case 'rent':
      return <IconKeyR />;
    case 'invest':
      return <IconInvest />;
  }
}
