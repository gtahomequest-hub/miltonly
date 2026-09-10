// EVERY INTENT SQUARE GOES SOMEWHERE THAT EXISTS.
//
// A hub's hero opens with four intent squares — buying, selling, renting, investing — and on
// 2026-09-10 TWO OF THE FOUR led nowhere, on all 22 hubs, for as long as they had existed:
//
//   · "I'm investing" pointed at `/#mls`. That anchor died when the homepage's MLS-explore
//     section was removed. The link resolved to the homepage and scrolled nowhere.
//   · "I'm buying" pointed at `/neighbourhoods/<slug>#streets` and no section on the page
//     carried `id="streets"`.
//
// WHY NOTHING CAUGHT IT. A dead fragment is the quietest defect a page can carry. The href is
// well-formed, the target page returns 200, no console error is raised, and the browser's answer
// to an unresolvable fragment is to do nothing at all. A crawler follows it happily. Only a
// human clicking that exact square would ever find out, and they would conclude the site is
// broken rather than report it.
//
// So this check resolves both halves of every intent href:
//   · the ROUTE half must return 200 (fetched once per unique route, not once per hub)
//   · the FRAGMENT half must match an `id` that exists in the HTML of the page it points at
//
// It reads the hrefs out of the rendered hubs rather than importing intentsFor(), so a square
// added or re-pointed in the app is covered without touching this file — and so that a mistake
// in intentsFor() cannot validate itself.
import { get, publishedHubSlugs } from '../lib/http.mjs';

/** Every `id="..."` present in a document. */
function idsIn(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
}

/** The hero's intent squares, in document order. */
function intentHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*class="h-intent"[^>]*href="([^"]+)"/g)].map((m) => m[1])
    .concat([...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*class="h-intent"/g)].map((m) => m[1]));
}

export default {
  id: 'hub-intents',
  title: 'Every hub intent square resolves to a real route and a real id',
  wholeCorpusOnly: true,

  async finish(_rows, { base }) {
    const slugs = await publishedHubSlugs(base);
    const pages = new Map();   // path -> { status, ids }
    const rows = [];

    for (const slug of slugs) {
      const path = `/neighbourhoods/${slug}`;
      const r = await get(base + path);
      if (r.status !== 200) { rows.push({ slug, status: r.status, hrefs: [] }); continue; }
      pages.set(path, { status: 200, ids: idsIn(r.body) });
      rows.push({ slug, status: 200, hrefs: intentHrefs(r.body) });
    }

    const ok = rows.filter((r) => r.status === 200);
    const noSquares = ok.filter((r) => r.hrefs.length === 0).map((r) => r.slug);

    // Resolve each unique target ONCE. 22 hubs x 4 squares is 88 links over a handful of
    // destinations; fetching per hub would be 88 requests to say the same four things.
    const targets = new Set();
    for (const r of ok) for (const h of r.hrefs) targets.add(h);

    const deadRoute = [], deadFragment = [];
    for (const href of targets) {
      const [path, frag] = href.split('#');
      const p = path || '/';
      if (!pages.has(p)) {
        const r = await get(base + p);
        pages.set(p, { status: r.status, ids: r.status === 200 ? idsIn(r.body) : new Set() });
      }
      const page = pages.get(p);
      if (page.status !== 200) { deadRoute.push(`${href} -> HTTP ${page.status}`); continue; }
      if (frag && !page.ids.has(frag)) deadFragment.push(`${href} -> no element with id="${frag}" on ${p}`);
    }

    return {
      coverage: [
        ['hub pages read', `${ok.length} of ${slugs.length}`],
        ['intent squares found', ok.reduce((n, r) => n + r.hrefs.length, 0)],
        ['unique destinations resolved', targets.size],
        ['destinations', [...targets].map((t) => t.replace(/^\/neighbourhoods\/[^/#]+/, '/neighbourhoods/<slug>')).filter((v, i, a) => a.indexOf(v) === i).join(' · ')],
      ],
      assertions: [
        ['hub pages read == published hub count', ok.length, slugs.length],
        // A parser that finds no squares must fail on its own coverage, not read as "all fine".
        ['hubs rendering no intent squares', noSquares.length, 0],
        ['intent hrefs whose route does not return 200', deadRoute.length, 0],
        ['intent hrefs whose fragment matches no id', deadFragment.length, 0],
      ],
      examples: [...deadRoute, ...deadFragment, ...noSquares.map((s) => `${s}: no intent squares parsed`)],
    };
  },
};
