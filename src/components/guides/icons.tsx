// src/components/guides/icons.tsx
import type { ReactNode } from 'react';
import type { GuideCategoryKey } from './types';

const box = (children: ReactNode) => <svg viewBox="0 0 24 24">{children}</svg>;

export const IconSearch = () =>
  box(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);
export const IconTag = () =>
  box(<><path d="M20.6 13.4 11 3.8H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" /><circle cx="7.5" cy="7.5" r="1" /></>);
export const IconKey = () =>
  box(<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9 2 2-2 2 1.5 1.5" /></>);
export const IconHome = () =>
  box(<><path d="M3 11l9-8 9 8" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>);
export const IconClock = () =>
  box(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconBulb = () =>
  box(<><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4.2 10.3c.7.7 1.2 1.6 1.2 2.7h6c0-1.1.5-2 1.2-2.7A6 6 0 0 0 12 3z" /></>);
export const IconCheck = () =>
  box(<path d="M5 13l4 4L19 7" />);

export function CategoryIcon({ k }: { k: GuideCategoryKey }) {
  switch (k) {
    case 'buying':
      return <IconSearch />;
    case 'selling':
      return <IconTag />;
    case 'renting':
      return <IconKey />;
    case 'living':
      return <IconHome />;
  }
}