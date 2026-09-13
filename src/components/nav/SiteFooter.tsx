// src/components/nav/SiteFooter.tsx
// The server half of the footer: reads the link graph and hands it to <HomeFooter>.
//
// Every page that is not the homepage or a hub renders THIS. Before MH-006 those pages ended
// in one of two footers or none: the listing page and the guides carried the legacy navy
// FooterSection (thirteen top-level links, no hub, no street, no guide, a /map that
// redirected, a "Sign in" CTA, 10px text) and 509 street pages carried nothing at all. The
// footer is the site's map, so every page gets the same one, from the same read, memoised
// five minutes per instance in getHubFooter().
//
// A failed read degrades to the footer's fixed columns with an empty hub list. The footer is
// an enhancement of a page that has its own reason to exist; a database blip must not turn a
// guide into a 500. The footer gate (scripts/verify/checks/footer.mjs) would then report the
// hub list short, which is the right outcome for a served page with a broken footer.
import { getHubFooter, HUB_BRAND } from "@/lib/hubFooter";
import type { FooterData } from "@/components/home/types";
import { HomeFooter } from "../home/HomeFooter";

const EMPTY: FooterData = { neighbourhoods: [], topStreets: [], neighbourhoodCount: 0, streetCount: 0, streetPageCount: 0 };

export default async function SiteFooter() {
  let footer: FooterData = EMPTY;
  try {
    footer = await getHubFooter();
  } catch (e) {
    console.error("[footer] link graph unavailable, rendering fixed columns only:", e instanceof Error ? e.message : e);
  }
  return <HomeFooter footer={footer} brand={HUB_BRAND} />;
}
