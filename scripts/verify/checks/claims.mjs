// Absence is claimed on exactly the streets whose record is empty — no more, no fewer.
//
// TWO SETS, DERIVED INDEPENDENTLY: the pages that claim absence, read off the served HTML; the
// streets with no For Sale record ever, read off DB2 and scoped to the pages actually iterated.
// The assertion is that they are the SAME SET, in both directions. A false claimer is a page
// telling buyers no home has ever sold on a street where one closed days earlier (14 published
// streets did). A silent zero-sale page is the mirror failure and is just as wrong.
//
// The population for the wording check is derived too. It used to be a frozen roll-call of the 14
// streets that were failing when the gate was written — a list that cannot grow, so a fifteenth
// street acquiring the defect would have printed nothing and the gate would have read clean.
export default {
  id: 'claims',
  title: 'Absence claims match the record, and every page has a working CTA',
  needsRecord: true,

  perPage(slug, raw) {
    // The RENDERED document, with the RSC payload removed. Next serializes the same props into
    // <script> tags, so counting class names on the raw response double-counts every one of them:
    // aird-court reads 8 suppressed cells raw and 4 as rendered. Everything here is a statement
    // about what a reader sees, so everything here reads the stripped document.
    const html = raw.replace(/<script[\s\S]*?<\/script>/g, ' ');
    const pills = [...html.matchAll(/<span class="s-pill-p(| s-silent)">([^<]*)<\/span>/g)]
      .map((m) => ({ silent: m[1].trim() === 's-silent', text: m[2] }));
    const disclosures = [...html.matchAll(/<div class="s-basis">([^<]*)<\/div>/g)].map((m) => m[1]);
    const areacx = html.includes('s-areacx');
    const identity = html.includes('New to the record') || html.includes('Where this street sits');
    const minimalTpl = html.includes('s-placeholder')
      && /No resales recorded yet|Too few recent sales to publish a price/.test(html);
    const leasePriced = pills.some((p) => !p.silent && /\$/.test(p.text) && /\/\s*mo/.test(p.text));

    let tier;
    if (minimalTpl) tier = 'identity-only';
    else if (!areacx) tier = 'priced-sale';
    else if (identity) tier = 'identity-only';
    else if (disclosures.some((d) => /across \d+ leases? in the last/.test(d)) || leasePriced) tier = 'priced-lease';
    else tier = 'area-only';

    return {
      slug, tier,
      claimsAbsence: html.includes('No resales recorded'),
      suppression: /Too few recent sales/.test(html),
      deadCta: /class="s-b2" href="\/listings"/.test(html),
      wiredCta: html.includes('id="street-alert"'),
      saleDisclosures: disclosures.filter((d) => /across \d+ sales? in the last/.test(d)).length,
      leaseWindowNote: /Recent leases[\s\S]{0,120}?s-pillrow-win">[\s\S]{0,40}?(last 12 months|last ~2 years)/.test(html),
      leasePillCount: (html.match(/<span class="s-pill-c">(\d+)<\/span>/g) || []).length,
      areaBasisCountless: disclosures.filter((d) => /^across\s+sales in the last/.test(d)).length,
      areaBasisGood: disclosures.filter((d) => /^across \d+ sales? in the last/.test(d)).length,
      suppressedCells: (html.match(/class="[^"]*s-silent/g) || []).length,
    };
  },

  finish(rows, { record, slugs }) {
    const zero = record.zeroSaleSet(slugs);
    const claimers = rows.filter((r) => r.claimsAbsence).map((r) => r.slug);
    const falseClaims = claimers.filter((s) => !zero.has(s));
    const silentZero = [...zero].filter((s) => !claimers.includes(s));
    const withSales = rows.filter((r) => !zero.has(r.slug));
    const tiers = rows.reduce((a, r) => { a[r.tier] = (a[r.tier] ?? 0) + 1; return a; }, {});

    return {
      coverage: [
        ['pages claiming absence', claimers.length],
        ['zero-sale set (derived from DB2, scoped to these pages)', zero.size],
        ['pages with a sale on record', withSales.length],
        ['of those, carrying suppression phrasing', withSales.filter((r) => r.suppression).length],
        ['tiers', JSON.stringify(tiers)],
        ['CTAs wired', rows.filter((r) => r.wiredCta).length],
      ],
      assertions: [
        ['claimers == zero-sale set', claimers.length === zero.size ? 0 : 1, 0],
        ['false claimers (claims absence, has sales)', falseClaims.length, 0],
        ['silent zero-sale pages (has no sales, does not say so)', silentZero.length, 0],
        ['dead "/listings" CTAs', rows.filter((r) => r.deadCta).length, 0],
        ['pages with no wired alert CTA', rows.filter((r) => !r.wiredCta).length, 0],
        ['priced-sale pages missing a sample disclosure', rows.filter((r) => r.tier === 'priced-sale' && r.saleDisclosures === 0).length, 0],
        ['priced-lease pages missing window + n', rows.filter((r) => r.tier === 'priced-lease' && !(r.leaseWindowNote && r.leasePillCount > 0)).length, 0],
        ['countless "across sales" disclosures', rows.filter((r) => r.areaBasisCountless > 0).length, 0],
        ['pages with >= 9 suppressed cells', rows.filter((r) => r.suppressedCells >= 9).length, 0],
      ],
      examples: [...falseClaims.slice(0, 4).map((s) => `false claimer: ${s}`),
                 ...silentZero.slice(0, 4).map((s) => `silent zero-sale: ${s}`)],
    };
  },
};
