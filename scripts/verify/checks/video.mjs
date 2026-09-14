// EVERY CLIP ON A STREET PAGE STATES ITS LIMITS, NAMES ITS TAKEDOWN ROUTE, SITS AT A DATED KEY,
// SERVES, AND IS IN THE VIDEO SITEMAP. Nothing more, nothing less.
//
// MC-015. A clip with no stated extent implies it covers the street, and most cover a fraction
// of one: the coverage sentence is body text under every player, and it says when the clip was
// filmed, on the clip's own wall clock. Real streets and real houses are on camera, so the
// takedown address is on every page carrying footage. Every object is immutable at the edge for
// a year, so every key is dated and a newer capture can never overwrite an older one. Google's
// video index reads sitemap-video.xml, not the page schema, so the sitemap lists exactly the
// pages that carry a clip and exactly the clips they carry.
//
// THE PAGE IS THE SOURCE. Everything here is read off the rendered street page (the same crawl
// every other check uses): the <source src>, the poster attribute, the sentence, the mailto, the
// VideoObject nodes. sitemap-video.xml is fetched once and compared to that set. The clips and
// posters are HEADed, because a pointer to a deleted object is the failure a re-key can leave.
//
// NIGHT IS CHECKABLE ONLY WHEN THE TIME IS STATED. A night clip's sentence carries "at 9:40 pm"
// once the row holds its offset; before the backfill it carries the date alone. A stated time
// before 8 pm on a night clip fails; a night clip with no stated time is counted, not failed,
// so the check reads the same before and after the backfill and the count says which world it
// is in.
import { get } from '../lib/http.mjs';
import { clean } from '../lib/parse.mjs';

const DATED = /\/\d{8}\/(day|night)\.mp4$/;
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1];
const unescape = (s) => (s ?? '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

/** Pure: what one page says about its video. */
export function videoFacts(html) {
  const section = (html.match(/<section class="s-block s-video">([\s\S]*?)<\/section>/) || [])[1];
  if (!section) return { hasVideo: false, clips: [], takedown: null, videoObjects: [] };

  const clips = [];
  for (const fig of section.match(/<figure class="s-video-clip">[\s\S]*?<\/figure>/g) || []) {
    const video = (fig.match(/<video\b[^>]*>/) || [])[0] || '';
    const src = unescape(attr((fig.match(/<source\b[^>]*>/) || [])[0] || '', 'src'));
    const coverage = clean((fig.match(/<p class="s-video-coverage">([\s\S]*?)<\/p>/) || [])[1] || '');
    const caption = clean((fig.match(/<figcaption class="s-video-cap">([\s\S]*?)<\/figcaption>/) || [])[1] || '');
    const time = coverage.match(/Filmed .+? at (\d{1,2}):(\d{2}) (am|pm)\.$/);
    const hour = time ? (Number(time[1]) % 12) + (time[3] === 'pm' ? 12 : 0) : null;
    clips.push({
      src,
      poster: unescape(attr(video, 'poster')) || null,
      preload: attr(video, 'preload') || null,
      night: /night\.mp4/.test(src) || /^Overnight/.test(caption),
      coverage,
      hour,
    });
  }

  const takedown = (section.match(/<p class="s-video-takedown">[\s\S]*?href="mailto:([^"?]+)/) || [])[1] || null;

  const videoObjects = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === 'object') {
        if (node['@type'] === 'VideoObject') videoObjects.push(node);
        Object.values(node).forEach(walk);
      }
    };
    walk(parsed);
  }
  return { hasVideo: true, clips, takedown, videoObjects };
}

/** Pure: the pages and clips sitemap-video.xml lists. */
export function parseVideoSitemap(xml) {
  const pages = new Map();
  for (const u of xml.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const loc = (u.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const clips = [...u.matchAll(/<video:content_url>([^<]+)<\/video:content_url>/g)].map((m) => unescape(m[1]));
    const durations = [...u.matchAll(/<video:duration>(\d+)<\/video:duration>/g)].map((m) => Number(m[1]));
    if (loc) pages.set(loc, { clips, durations });
  }
  return pages;
}

async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', headers: { 'user-agent': 'miltonly-verify' } });
    return r.status;
  } catch {
    return 0;
  }
}

export default {
  id: 'video',
  title: 'Every clip states its limits, names its takedown route, sits at a dated key, serves, and is in the video sitemap',

  perPage(slug, html) {
    return { url: `/streets/${slug}`, slug, ...videoFacts(html) };
  },

  async finish(rows, { base }) {
    const pages = rows.filter((r) => r.hasVideo);
    const clips = pages.flatMap((p) => p.clips.map((c) => ({ ...c, url: p.url })));

    const noTakedown = pages.filter((p) => !p.takedown);
    const noSentence = clips.filter((c) => !/^A(n overnight)? .+\. Filmed .+\.$/.test(c.coverage));
    const undated = clips.filter((c) => !DATED.test(c.src));
    const noPoster = clips.filter((c) => !c.poster || !DATED.test(c.poster.replace(/poster\.webp$/, c.night ? 'night.mp4' : 'day.mp4')));
    const eager = clips.filter((c) => c.preload !== 'none');
    const nightEarly = clips.filter((c) => c.night && c.hour !== null && c.hour < 20);
    const nightUnstated = clips.filter((c) => c.night && c.hour === null);

    // the schema on the page mirrors the players on the page: one VideoObject per clip, on that
    // clip's URL, with a thumbnail
    const schemaMismatch = pages.filter((p) => {
      const srcs = new Set(p.clips.map((c) => c.src));
      return p.videoObjects.length !== p.clips.length || p.videoObjects.some((v) => !srcs.has(v.contentUrl) || !v.thumbnailUrl || !v.uploadDate);
    });

    // the objects serve
    const heads = [];
    let i = 0;
    const targets = clips.flatMap((c) => [c.src, c.poster].filter(Boolean));
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (i < targets.length) { const u = targets[i++]; heads.push({ u, status: await head(u) }); }
    }));
    const dead = heads.filter((h) => h.status !== 200);

    // the video sitemap lists exactly these pages and exactly these clips
    const sm = await get(`${base}/sitemap-video.xml`);
    const listed = sm.status === 200 ? parseVideoSitemap(sm.body) : new Map();
    const origin = [...listed.keys()][0] ? new URL([...listed.keys()][0]).origin : base;
    const pageSet = new Set(pages.map((p) => `${origin}${p.url}`));
    const notListed = pages.filter((p) => !listed.has(`${origin}${p.url}`));
    const extraListed = [...listed.keys()].filter((loc) => !pageSet.has(loc));
    const clipMismatch = pages.filter((p) => {
      const l = listed.get(`${origin}${p.url}`);
      if (!l) return false;
      const a = p.clips.map((c) => c.src).sort().join('|');
      const b = [...l.clips].sort().join('|');
      return a !== b;
    });
    const listedClips = [...listed.values()].reduce((n, l) => n + l.clips.length, 0);
    const listedWithDuration = [...listed.values()].reduce((n, l) => n + l.durations.length, 0);

    return {
      coverage: [
        ['street pages carrying a clip', pages.length],
        ['clips rendered', clips.length],
        ['objects HEADed (clips + posters)', heads.length],
        ['sitemap-video.xml status', sm.status],
        ['clips listed in sitemap-video.xml', listedClips],
        ['listed clips with a duration', listedWithDuration],
        ['night clips with no stated time (pre-backfill rows)', nightUnstated.length],
      ],
      assertions: [
        ['pages with a clip and no takedown address', noTakedown.length, 0],
        ['clips with no coverage sentence', noSentence.length, 0],
        ['clips at an undated key', undated.length, 0],
        ['clips whose poster is not beside them', noPoster.length, 0],
        ['players that preload', eager.length, 0],
        ['night clips filmed before 8 pm by their own clock', nightEarly.length, 0],
        ['pages whose VideoObjects do not mirror their players', schemaMismatch.length, 0],
        ['clips or posters that do not serve', dead.length, 0],
        ['sitemap-video.xml serves', sm.status, 200],
        ['pages with a clip missing from sitemap-video.xml', notListed.length, 0],
        ['sitemap-video.xml pages with no clip on the page', extraListed.length, 0],
        ['pages whose listed clips differ from their players', clipMismatch.length, 0],
      ],
      examples: [
        ...noTakedown.slice(0, 2).map((p) => `${p.url} · no takedown mailto`),
        ...noSentence.slice(0, 2).map((c) => `${c.url} · sentence: "${c.coverage}"`),
        ...undated.slice(0, 2).map((c) => `${c.url} · ${c.src}`),
        ...noPoster.slice(0, 2).map((c) => `${c.url} · poster ${c.poster}`),
        ...nightEarly.slice(0, 2).map((c) => `${c.url} · night at ${c.hour}:00`),
        ...schemaMismatch.slice(0, 2).map((p) => `${p.url} · ${p.videoObjects.length} VideoObject(s) for ${p.clips.length} clip(s)`),
        ...dead.slice(0, 3).map((h) => `${h.u} -> ${h.status}`),
        ...notListed.slice(0, 2).map((p) => `${p.url} · not in sitemap-video.xml`),
        ...extraListed.slice(0, 2).map((loc) => `${loc} · listed, no clip`),
        ...clipMismatch.slice(0, 2).map((p) => `${p.url} · listed clips differ`),
      ],
    };
  },
};
