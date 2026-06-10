// src/components/home/HomeNav.tsx
// Thin wrapper preserved for the homepage. Renders the shared <SiteNav> in its
// "home" variant — class="m-nav", the #index/#vip/#mls/#market anchors, the #dual
// CTA, and the scroll-reveal search tied to #m-searchband — i.e. byte-identical to
// the previous inline HomeNav. Styled by the untouched .home-v2 .m-nav cascade.
'use client';

import { SiteNav } from '../nav/SiteNav';

export function HomeNav() {
  return <SiteNav variant="home" />;
}

export default HomeNav;
