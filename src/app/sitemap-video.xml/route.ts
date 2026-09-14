// src/app/sitemap-video.xml/route.ts
//
// The video sitemap (MC-015). Google's video index reads this, not the VideoObject in page
// JSON-LD, so a clip that is only in the page schema is a clip Google's video surfaces never
// see. One <url> per published street page carrying a clip, one <video:video> per clip, and
// only clips a VideoObject would be emitted for: a poster and a capture date are the required
// trio's other two legs, and a clip without them is left out here for the same reason it is
// left out of the page schema.
//
// The page set is the sitemap's own: published content AND a ResidentialStreet entity
// (publishedStreetPageSlugs), so this file can never list a page /sitemap.xml does not.
// Duration comes from the sidecar and is omitted, never fabricated, when the clip has none.
// robots.ts names this file beside /sitemap.xml.

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { resolveStreetName } from "@/lib/streetName";
import { resolveStreetVideo, type StreetVideoClip } from "@/lib/streetVideo";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One <video:video> block, or null when the clip lacks the required trio. */
function videoXml(clip: StreetVideoClip): string | null {
  if (!clip.poster || !clip.uploadDate) return null;
  const lines = [
    `    <video:video>`,
    `      <video:thumbnail_loc>${esc(clip.poster)}</video:thumbnail_loc>`,
    `      <video:title>${esc(clip.name.slice(0, 100))}</video:title>`,
    `      <video:description>${esc(clip.description.slice(0, 2048))}</video:description>`,
    `      <video:content_url>${esc(clip.src)}</video:content_url>`,
  ];
  if (clip.durationS != null && clip.durationS >= 1) lines.push(`      <video:duration>${Math.round(clip.durationS)}</video:duration>`);
  lines.push(`      <video:publication_date>${esc(clip.uploadDate)}</video:publication_date>`);
  lines.push(`      <video:family_friendly>yes</video:family_friendly>`);
  lines.push(`      <video:live>no</video:live>`);
  lines.push(`    </video:video>`);
  return lines.join("\n");
}

export async function GET() {
  const slugs = new Set(await publishedStreetPageSlugs());
  const rows = await prisma.streetContent.findMany({
    where: {
      status: "published",
      OR: [{ videoUrl: { not: null } }, { nightVideoUrl: { not: null } }],
    },
    select: {
      streetSlug: true,
      streetName: true,
      videoUrl: true,
      videoCapturedAt: true,
      videoCapturedOffsetMin: true,
      nightVideoUrl: true,
      nightCapturedAt: true,
      nightCapturedOffsetMin: true,
    },
    orderBy: { streetSlug: "asc" },
  });

  const urls: string[] = [];
  for (const r of rows) {
    if (!slugs.has(r.streetSlug)) continue;
    const view = resolveStreetVideo({
      streetName: resolveStreetName(r.streetSlug, r.streetName).name,
      videoUrl: r.videoUrl,
      videoCapturedAt: r.videoCapturedAt,
      videoCapturedOffsetMin: r.videoCapturedOffsetMin,
      nightVideoUrl: r.nightVideoUrl,
      nightCapturedAt: r.nightCapturedAt,
      nightCapturedOffsetMin: r.nightCapturedOffsetMin,
    });
    if (!view) continue;
    const videos = [view.day, view.night].map((c) => (c ? videoXml(c) : null)).filter((x): x is string => x !== null);
    if (videos.length === 0) continue;
    urls.push([`  <url>`, `    <loc>${esc(`${config.SITE_URL}/streets/${r.streetSlug}`)}</loc>`, ...videos, `  </url>`].join("\n"));
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    urls.join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
