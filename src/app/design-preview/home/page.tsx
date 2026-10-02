// MH-012, MH-013: the homepage design preview. Noindex and nofollow, not in the sitemap and not
// linked from any page. ?option=c|d switches the hero (Doors, Four paths), ?palette=1|2|3 the
// orange, navy and white palette (Harbour, Midnight, Slate), ?wordmark=serif|script the nav
// wordmark (serif by default). Bare keys do the same (?d&p2&script), for the leak test's --explain, whose argument
// parser stops at the first "=". The data is the live homepage's own read (public counts and active
// listings only; MC-046 took every VOW-derived value off it), so nothing on this page reads the VOW.
import type { Metadata, Viewport } from "next";
import { getHomepageData } from "@/lib/homepageData";
import { buildMegaLive, getMegaExtras } from "@/lib/megaLive";
import HomeDesign, { type PreviewState } from "@/components/home-design/HomeDesign";
import { PALETTES, type PaletteKey } from "@/components/home-design/tokens";

export const metadata: Metadata = {
  title: "Homepage design preview",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // The tab icon in navy (icon.svg in this folder, written from tokens.ts by
  // scratchpad/mh013/make-icon.ts), in place of the layout's forest set, for this route only.
  icons: { icon: [{ url: "/design-preview/home/icon.svg", type: "image/svg+xml" }], apple: [] },
};

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function pick(sp: SP): PreviewState {
  const o = one(sp.option);
  const option = o === "c" || o === "d" ? o : "c" in sp ? "c" : "d";
  const p = one(sp.palette);
  const palette: PaletteKey = p === "1" || p === "2" || p === "3" ? p : "p2" in sp ? "2" : "p3" in sp ? "3" : "1";
  const w = one(sp.wordmark);
  const wordmark = w === "script" || w === "serif" ? w : "script" in sp ? "script" : "serif";
  return { option, palette, wordmark };
}

// The browser's own colour (the address bar on a phone) follows the palette, not the layout's forest.
export function generateViewport({ searchParams }: { searchParams: SP }): Viewport {
  return { themeColor: PALETTES[pick(searchParams).palette].navy };
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const state = pick(searchParams);
  const [data, extras] = await Promise.all([getHomepageData(), getMegaExtras()]);
  const mega = buildMegaLive(data, extras);
  return <HomeDesign state={state} data={data} mega={mega} />;
}
