// src/lib/heroSearchClient.ts
// Client helper: resolve typed search text to a destination href via
// /api/hero-search (entity-first). Shared by every search input on the site so
// the hero, the search band, the footer well, and the nav mini-search all behave
// identically. Never throws — falls back to /listings?q= on any error.
export async function resolveHeroHref(raw: string): Promise<string> {
  const q = raw.trim();
  if (!q) return "/listings";
  try {
    const res = await fetch(`/api/hero-search?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as { href?: string };
    return data.href || `/listings?q=${encodeURIComponent(q)}`;
  } catch {
    return `/listings?q=${encodeURIComponent(q)}`;
  }
}
