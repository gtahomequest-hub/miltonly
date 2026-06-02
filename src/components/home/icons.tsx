// src/components/home/icons.tsx
import type { ReactNode } from 'react';
import type { MlsTabKey } from './types';

const box = (children: ReactNode) => (
  <svg viewBox="0 0 24 24">{children}</svg>
);

export const IconSpark = () =>
  box(
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );

export const IconSearch = () =>
  box(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>,
  );

export const IconWealth = () =>
  box(
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </>,
  );

export const IconSell = () =>
  box(
    <>
      <path d="M20.6 13.4 11 3.8H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>,
  );

export const IconRent = () =>
  box(
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9 2 2-2 2 1.5 1.5" />
    </>,
  );

export const TabIcon = ({ k }: { k: MlsTabKey }) => {
  switch (k) {
    case 'wealth':
      return <IconWealth />;
    case 'buy':
      return <IconSearch />;
    case 'sell':
      return <IconSell />;
    case 'rent':
      return <IconRent />;
  }
};
