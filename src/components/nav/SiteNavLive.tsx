// src/components/nav/SiteNavLive.tsx
// The server half of the nav: reads the menu's live content and hands it to <SiteNav>.
//
// SiteNav is a client component and cannot query. The homepage composes its menu from data
// the page already fetched (see src/lib/megaLive.ts buildMegaLive); every other server page
// renders THIS instead of <SiteNav> and gets the same panels from getMegaLive(), memoised for
// five minutes per instance. A client component that needs the nav (HomePage, ValueLanding,
// BuildingAttributesPage) is handed `live` by its server parent and renders <SiteNav> itself.
//
// A failed read degrades to the rails. The menu's live panels are an enhancement of a page
// that has its own reason to exist; a database blip must not turn a street page into a 500.
import { getMegaLive } from "@/lib/megaLive";
import type { MegaLive } from "./megaTypes";
import SiteNav from "./SiteNav";

export default async function SiteNavLive({ variant = "page" }: { variant?: "home" | "page" }) {
  let live: MegaLive | undefined;
  try {
    live = await getMegaLive();
  } catch (e) {
    console.error("[nav] live menu content unavailable, rendering rails only:", e instanceof Error ? e.message : e);
  }
  return <SiteNav variant={variant} live={live} />;
}
