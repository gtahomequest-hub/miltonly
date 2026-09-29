// MH-011: the street-page design preview. Fictional data, noindex, not in the sitemap and not
// linked from any page. ?palette=a|b|c and ?view=visitor|registered switch what is reviewed;
// ?n=12 opens with the finder filled.
import type { Metadata } from "next";
import StreetDesign from "@/components/street-design/StreetDesign";
import type { PaletteKey } from "@/components/street-design/palettes";
import { contactEmail } from "@/lib/compliance/contact";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Street page design preview",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const raw = one(searchParams.palette);
  const palette: PaletteKey = raw === "b" || raw === "c" ? raw : "a";
  const view = one(searchParams.view) === "registered" ? "registered" : "visitor";
  const n = one(searchParams.n)?.slice(0, 6);
  return <StreetDesign palette={palette} view={view} initialNumber={n} email={contactEmail() ?? config.realtor.email} />;
}
