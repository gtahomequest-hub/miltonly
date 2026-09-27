// ML-012: can the middleware's canonical rule rescue the feed slugs that have no page as written?
import canonicalMap from "@/lib/_generated/canonical-map.json";
import { deriveIdentity } from "@/lib/streetUtils";
import { readFileSync } from "node:fs";
const sample = JSON.parse(readFileSync("scratchpad/ml012/db-sample.json", "utf8"));
const published = new Set<string>(Object.values(sample as Record<string, { linkableSlugs: string[] }>).flatMap((v) => v.linkableSlugs));
const map = canonicalMap as Record<string, string>;
const all = [...new Set(Object.values(sample as Record<string, { unlinkable: string[] }>).flatMap((v) => v.unlinkable))];
for (const s of all) {
  const mapped = map[s];
  const id = deriveIdentity(s)?.canonicalSlug ?? null;
  console.log(`${s}  map->${mapped ?? "-"}  identity->${id ?? "-"}  published(sample)? map:${mapped ? published.has(mapped) : "-"} id:${id ? published.has(id) : "-"}`);
}
