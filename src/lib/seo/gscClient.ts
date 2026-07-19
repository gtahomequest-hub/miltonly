// src/lib/seo/gscClient.ts
// Shared GSC access for the organic-growth-loop: one auth path used by the
// CLI scripts (gsc-keyword-report / gsc-coverage-audit) and the /api/seo/sense
// route. Server-side the key comes from GSC_SERVICE_ACCOUNT_KEY in the env;
// the .env-file fallback only fires in local CLI runs (fails silently on
// serverless where no .env exists).
import { readFileSync } from "node:fs";
// Subpath import on purpose: the "googleapis" meta-package pulls every Google
// API into the Next build graph (build-worker OOM, exit 134, observed
// 2026-07-18) and slows serverless cold starts. This path exposes only the
// Search Console surface + auth.
import {
  searchconsole,
  auth as googleAuth,
  type searchconsole_v1,
} from "googleapis/build/src/apis/searchconsole";

export const GSC_PROPERTY = "sc-domain:miltonly.com";
export const APEX = "https://miltonly.com";
export const SITEMAP_URL = "https://miltonly.com/sitemap.xml";

export const dayStr = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

export const pathOf = (url: string): string => {
  try {
    const u = new URL(url);
    let p = u.pathname;
    if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  } catch {
    return url;
  }
};

// Normalize a URL to its apex identity for set comparisons:
// https, www -> apex host, no query/fragment, no trailing slash (root stays "/").
export function normUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  u.protocol = "https:";
  if (u.hostname === "www.miltonly.com") u.hostname = "miltonly.com";
  u.hash = "";
  u.search = "";
  let s = u.toString();
  if (u.pathname !== "/" && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export function gscEnvKey(): string | null {
  if (process.env.GSC_SERVICE_ACCOUNT_KEY) return process.env.GSC_SERVICE_ACCOUNT_KEY;
  try {
    const m = readFileSync(".env", "utf8").match(/^GSC_SERVICE_ACCOUNT_KEY=(.*)$/m);
    if (!m) return null;
    let v = m[1].trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
    return v || null;
  } catch {
    return null;
  }
}

export type SearchConsole = searchconsole_v1.Searchconsole;

export function getSearchConsole(): SearchConsole {
  const rawKey = gscEnvKey();
  if (!rawKey) throw new Error("GSC_SERVICE_ACCOUNT_KEY not set");
  const auth = new googleAuth.GoogleAuth({
    credentials: JSON.parse(rawKey),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  return searchconsole({ version: "v1", auth });
}

// Live sitemap -> unique normalized URLs (handles index files).
export async function fetchSitemapUrls(): Promise<string[]> {
  const xml = await (await fetch(SITEMAP_URL)).text();
  let locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
  if (xml.includes("<sitemapindex")) {
    const children = locs;
    locs = [];
    for (const child of children) {
      const cx = await (await fetch(child)).text();
      locs.push(...Array.from(cx.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim()));
    }
  }
  return Array.from(new Set(locs.map(normUrl)));
}
