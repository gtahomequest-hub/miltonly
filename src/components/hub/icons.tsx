// src/components/hub/icons.tsx
import type { ReactNode } from 'react';

const box = (children: ReactNode) => <svg viewBox="0 0 24 24">{children}</svg>;

export const IconHome = () =>
  box(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>);
export const IconPeople = () =>
  box(<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 6a3 3 0 0 1 0 6" /><path d="M21 20a6 6 0 0 0-4-5.6" /></>);
export const IconTrain = () =>
  box(<><rect x="5" y="3" width="14" height="13" rx="3" /><path d="M5 11h14" /><circle cx="9" cy="13.5" r="0.6" /><circle cx="15" cy="13.5" r="0.6" /><path d="M7 21l2-3M17 21l-2-3" /></>);
export const IconSchool = () =>
  box(<><path d="M12 4 2 9l10 5 10-5-10-5z" /><path d="M6 11v5c0 1 3 2.5 6 2.5S18 17 18 16v-5" /></>);
export const IconTag = () =>
  box(<><path d="M20.6 13.4 11 3.8H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" /><circle cx="7.5" cy="7.5" r="1" /></>);
export const IconArrow = () =>
  box(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconSearch = () =>
  box(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);

export const IconInvest = () =>
  box(<><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></>);
export const IconKey = () =>
  box(<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9 2 2-2 2 1.5 1.5" /></>);

export function IntentIcon({ k }: { k: 'buy' | 'sell' | 'rent' | 'invest' }) {
  switch (k) {
    case 'buy':
      return <IconSearch />;
    case 'sell':
      return <IconTag />;
    case 'rent':
      return <IconKey />;
    case 'invest':
      return <IconInvest />;
  }
}
