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

// Conversation icon — "Talk to Aamir" pill.
export const IconChat = () =>
  box(
    <>
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z" />
    </>,
  );

// Entity-type icons for the hero autocomplete rows.
export const IconPin = () =>
  box(
    <>
      <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>,
  );
export const IconRoad = () =>
  box(
    <>
      <path d="M6 21 9 3M18 21 15 3M12 5v2M12 11v2M12 17v2" />
    </>,
  );
export const IconBuilding = () =>
  box(
    <>
      <path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11M2 21h20" />
      <path d="M8 8h1M11 8h1M8 12h1M11 12h1M8 16h1M11 16h1" />
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
