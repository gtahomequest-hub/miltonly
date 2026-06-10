// src/components/street/v2/icons.tsx
import type { ReactNode } from 'react';
import type { CommuteCategory } from './types';

const box = (children: ReactNode) => <svg viewBox="0 0 24 24">{children}</svg>;

export const IconTransit = () =>
  box(
    <>
      <rect x="5" y="3" width="14" height="13" rx="3" />
      <path d="M5 11h14" />
      <circle cx="9" cy="13.5" r="0.6" />
      <circle cx="15" cy="13.5" r="0.6" />
      <path d="M7 21l2-3M17 21l-2-3" />
    </>,
  );
export const IconSchool = () =>
  box(
    <>
      <path d="M12 4 2 9l10 5 10-5-10-5z" />
      <path d="M6 11v5c0 1 3 2.5 6 2.5S18 17 18 16v-5" />
    </>,
  );
export const IconHealth = () =>
  box(
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>,
  );
export const IconPark = () =>
  box(
    <>
      <path d="M12 2l5 8H7l5-8z" />
      <path d="M12 8l5 8H7l5-8z" />
      <path d="M12 16v6" />
    </>,
  );
export const IconShop = () =>
  box(
    <>
      <path d="M4 7h16l-1 5H5L4 7z" />
      <path d="M4 7l-1-3M6 12v8h12v-8" />
      <circle cx="9" cy="20" r="0" />
    </>,
  );
export const IconWorship = () =>
  box(
    <>
      <path d="M12 2c2 3 4 4 4 7v11H8V9c0-3 2-4 4-7z" />
      <path d="M9 13h6" />
    </>,
  );
export const IconArrow = () => box(<path d="M5 12h14M13 6l6 6-6 6" />);

export function CommuteIcon({ k }: { k: CommuteCategory['icon'] }) {
  switch (k) {
    case 'transit':
      return <IconTransit />;
    case 'schools':
      return <IconSchool />;
    case 'health':
      return <IconHealth />;
    case 'parks':
      return <IconPark />;
    case 'shopping':
      return <IconShop />;
    case 'worship':
      return <IconWorship />;
  }
}
