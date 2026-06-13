// src/components/listings/v2/icons.tsx
// Minimal inline stroke icons for the listings shell (1.8 stroke, currentColor).

const P = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const BedIcon = () => (
  <svg {...P}>
    <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    <path d="M3 18h18" />
    <path d="M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
  </svg>
);

export const BathIcon = () => (
  <svg {...P}>
    <path d="M4 12h16v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-2Z" />
    <path d="M6 12V6a2 2 0 0 1 4 0" />
    <path d="M7 21l1-3M17 21l-1-3" />
  </svg>
);

export const SqftIcon = () => (
  <svg {...P}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M9 4v3M15 4v3M4 9h3M4 15h3" />
  </svg>
);

export const CarIcon = () => (
  <svg {...P}>
    <path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16" />
    <rect x="4" y="14" width="16" height="5" rx="1.5" />
    <circle cx="8" cy="19" r="1" fill="currentColor" />
    <circle cx="16" cy="19" r="1" fill="currentColor" />
  </svg>
);

export const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg {...P} fill={filled ? 'currentColor' : 'none'}>
    <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.1a5 5 0 1 1 7.5 6.5Z" />
  </svg>
);

export const CameraIcon = () => (
  <svg {...P}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);

export const SearchIcon = () => (
  <svg {...P}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...P} width={12} height={12}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const PinIcon = () => (
  <svg {...P}>
    <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const GridIcon = () => (
  <svg {...P}>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
  </svg>
);

export const MapIcon = () => (
  <svg {...P}>
    <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);

export const BellIcon = () => (
  <svg {...P}>
    <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </svg>
);

export const TourIcon = () => (
  <svg {...P}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.3 4 5.2 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.2-4-8.5s1.4-6.2 4-8.5Z" />
  </svg>
);

export const SchoolIcon = () => (
  <svg {...P}>
    <path d="m12 4 9 4.5-9 4.5-9-4.5L12 4Z" />
    <path d="M6 10.8V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.2" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...P}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const FilterIcon = () => (
  <svg {...P}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const CheckIcon = () => (
  <svg {...P} width={13} height={13}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);
