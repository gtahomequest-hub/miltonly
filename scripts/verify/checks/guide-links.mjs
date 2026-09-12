// EVERY STREET PAGE AND EVERY HUB LINKS UP TO ITS GUIDES, IN THE SERVED HTML.
//
// The six guides shipped on 2026-09-10 with no inbound link from any street page or hub, so
// the corpus that was meant to feed them told a crawler they were orphans. MC-003 put a
// "Guides" ledger on every street page and every hub. This check reads the anchors back off
// the served page, because a block that renders after hydration, or renders for the mock and
// not for the data, or renders on 448 pages and not the 449th, is invisible to everything
// except a reader of the HTML.
//
// The population for the condo guide is DERIVED FROM THE PAGE, not from a list:
//   · a street is condo-heavy when its hero renders a condo SALE pill (the lease pill is also
//     typed condo in the seam, so the match is on the pill's label, not its anchor alone)
//   · a hub is condo-heavy when it renders the condo-buildings section (h-condos / hh-condos)
// and the assertion runs in both directions: condo-heavy without the condo guide, and the
// condo guide without a condo-heavy page, are each a defect.
//
// Every destination is resolved once. 449 pages x 3 guides is 1,347 anchors over six
// destinations; the routes are fetched six times, not 1,347.
import { get, publishedHubSlugs } from '../lib/http.mjs';

const REQUIRED_STREET = [
  '/guides/how-to-read-a-milton-sold-price',
  '/guides/what-it-costs-to-buy-your-first-home-in-milton',
  '/guides/milton-schools-what-the-data-shows',
];
const REQUIRED_HUB = [
  '/guides/what-milton-neighbourhoods-cost',
  '/guides/milton-schools-what-the-data-shows',
];
const CONDO_GUIDE = '/guides/milton-condo-fees-parking-and-lockers';

const stripScripts = (raw) => raw.replace(/<script[\s\S]*?<\/script>/g, ' ');

/** The ledger's anchors, off the rendered document (RSC payload removed so nothing is double-counted). */
function guideHrefs(raw) {
  return [...stripScripts(raw).matchAll(/<a\b[^>]*class="g-up-link"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
}
const streetIsCondoHeavy = (raw) =>
  /<a class="s-pill" href="#type-condo"><span class="s-pill-t">Condo<\/span>/.test(stripScripts(raw));
// Both the legacy hub markup (h-condos) and the 2026-09-11 rebuild (hh-sec hh-condos), so a
// template rename cannot blind this the way it blinded hub-intents.mjs.
const hubIsCondoHeavy = (raw) => /class="(h-condos|hh-sec hh-condos)"/.test(stripScripts(raw));

function audit(hrefs, required, condoHeavy) {
  const set = new Set(hrefs);
  return {
    hrefs,
    missingRequired: required.filter((r) => !set.has(r)),
    condoHeavy,
    hasCondoGuide: set.has(CONDO_GUIDE),
    malformed: hrefs.filter((h) => !/^\/guides\/[a-z0-9-]+$/.test(h)),
  };
}

export default {
  id: 'guide-links',
  title: 'Every street page and every hub links up to its guides, in the served HTML',

  perPage(slug, raw) {
    return { slug, ...audit(guideHrefs(raw), REQUIRED_STREET, streetIsCondoHeavy(raw)) };
  },

  async finish(streetRows, { base, slugs }) {
    const hubSlugs = await publishedHubSlugs(base);
    const hubRows = [];
    for (const slug of hubSlugs) {
      const r = await get(`${base}/neighbourhoods/${slug}`);
      if (r.status !== 200) continue;
      hubRows.push({ slug, ...audit(guideHrefs(r.body), REQUIRED_HUB, hubIsCondoHeavy(r.body)) });
    }

    const targets = new Set();
    for (const r of [...streetRows, ...hubRows]) for (const h of r.hrefs) targets.add(h);
    const dead = [];
    for (const href of targets) {
      const r = await get(base + href);
      if (r.status !== 200) dead.push(`${href} -> HTTP ${r.status}`);
    }

    const streetNoBlock = streetRows.filter((r) => r.hrefs.length === 0).map((r) => r.slug);
    const streetMissing = streetRows.filter((r) => r.missingRequired.length).map((r) => `${r.slug}: missing ${r.missingRequired.join(', ')}`);
    const streetCondoNoGuide = streetRows.filter((r) => r.condoHeavy && !r.hasCondoGuide).map((r) => `${r.slug}: condo sale pill, no condo guide`);
    const streetGuideNoCondo = streetRows.filter((r) => !r.condoHeavy && r.hasCondoGuide).map((r) => `${r.slug}: condo guide, no condo sale pill`);
    const hubNoBlock = hubRows.filter((r) => r.hrefs.length === 0).map((r) => r.slug);
    const hubMissing = hubRows.filter((r) => r.missingRequired.length).map((r) => `${r.slug}: missing ${r.missingRequired.join(', ')}`);
    const hubCondoNoGuide = hubRows.filter((r) => r.condoHeavy && !r.hasCondoGuide).map((r) => `hub ${r.slug}: lists condos, no condo guide`);
    const hubGuideNoCondo = hubRows.filter((r) => !r.condoHeavy && r.hasCondoGuide).map((r) => `hub ${r.slug}: condo guide, no condo section`);
    const malformed = [...streetRows, ...hubRows].flatMap((r) => r.malformed.map((h) => `${r.slug}: ${h}`));

    const streetAnchors = streetRows.reduce((n, r) => n + r.hrefs.length, 0);
    const hubAnchors = hubRows.reduce((n, r) => n + r.hrefs.length, 0);

    return {
      coverage: [
        ['street pages read', `${streetRows.length} of ${slugs.length}`],
        ['hub pages read', `${hubRows.length} of ${hubSlugs.length}`],
        ['guide anchors on street pages', streetAnchors],
        ['guide anchors on hubs', hubAnchors],
        ['condo-heavy street pages (condo sale pill)', streetRows.filter((r) => r.condoHeavy).length],
        ['condo-heavy hubs (condo section)', hubRows.filter((r) => r.condoHeavy).length],
        ['unique guide destinations resolved', targets.size],
      ],
      assertions: [
        ['street pages read == live sitemap count', streetRows.length, slugs.length],
        ['hub pages read == published hub count', hubRows.length, hubSlugs.length],
        // A parser that finds no ledger must fail on its own coverage, not read as "all fine".
        ['street pages rendering no guides ledger', streetNoBlock.length, 0],
        ['street pages missing a required guide', streetMissing.length, 0],
        ['condo-heavy street pages without the condo guide', streetCondoNoGuide.length, 0],
        ['street pages carrying the condo guide with no condo sale pill', streetGuideNoCondo.length, 0],
        ['hubs rendering no guides ledger', hubNoBlock.length, 0],
        ['hubs missing a required guide', hubMissing.length, 0],
        ['condo-heavy hubs without the condo guide', hubCondoNoGuide.length, 0],
        ['hubs carrying the condo guide with no condo section', hubGuideNoCondo.length, 0],
        ['guide anchors not shaped /guides/<slug>', malformed.length, 0],
        ['guide destinations not returning 200', dead.length, 0],
      ],
      examples: [
        ...streetNoBlock.map((s) => `${s}: no guides ledger parsed`),
        ...streetMissing, ...streetCondoNoGuide, ...streetGuideNoCondo,
        ...hubNoBlock.map((s) => `hub ${s}: no guides ledger parsed`),
        ...hubMissing, ...hubCondoNoGuide, ...hubGuideNoCondo, ...malformed, ...dead,
      ],
    };
  },
};
