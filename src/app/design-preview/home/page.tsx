// MH-012: the homepage hero design preview. Noindex and nofollow, not in the sitemap and not linked
// from any page. ?option=a|b|c switches the hero (Road, Sentences, Doors); a bare ?b or ?c does the
// same, for the leak test's --explain, whose argument parser stops at the first "=". The data is the
// live homepage's own read (public counts and active listings only; MC-046 took every VOW-derived
// value off it), so nothing on this page reads the VOW.
import type { Metadata } from "next";
import { getHomepageData } from "@/lib/homepageData";
import { buildMegaLive, getMegaExtras } from "@/lib/megaLive";
import HomeDesign from "@/components/home-design/HomeDesign";
import type { HeroOption } from "@/components/home-design/HeroDesign";

export const metadata: Metadata = {
  title: "Homepage hero design preview",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function pickOption(sp: Record<string, string | string[] | undefined>): HeroOption {
  const raw = one(sp.option);
  if (raw === "a" || raw === "b" || raw === "c") return raw;
  if ("b" in sp) return "b";
  if ("c" in sp) return "c";
  return "a";
}

export default async function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const option = pickOption(searchParams);
  const [data, extras] = await Promise.all([getHomepageData(), getMegaExtras()]);
  const mega = buildMegaLive(data, extras);
  return <HomeDesign option={option} data={data} mega={mega} />;
}
