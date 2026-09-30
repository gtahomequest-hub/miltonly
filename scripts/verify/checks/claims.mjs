// No street page makes a claim about the sold record, and every page has a working CTA.
//
// This check used to hold two derived sets equal: the pages claiming absence ("No resales
// recorded") and the streets whose DB2 record held no For Sale row. MC-046 Stage 1 (PropTx VOW
// Best Practices item 40, ruling R10) removed the claim itself: an existence or count claim about
// sold records ("No resales recorded", "Too few recent sales", "New to the record", "has seen N
// closed sales", "Be first when X trades") is a value derived from VOW records, true or false,
// and the switch between the wordings disclosed which kind of street a page was. So every such
// phrasing is now asserted ABSENT on every page, in the rendered document and the JSON-LD, and the
// CTA assertions stay as they were.
const CLAIMS = [
  ['"No resales recorded"', /No (?:home )?resales? (?:are )?recorded/i],
  ['"Too few recent sales" / "Few recent sales"', /\b(?:Too )?few recent (?:sales|trades)\b/i],
  ['"New to the record"', /New to the record/],
  ['"has seen N closed sales"', /has seen \d+ closed sales?/],
  ['"Be first when X trades"', /Be first when [^<"]{1,80} trades/],
  ['"No resale on record"', /No resale on record/i],
  ['"grounded in every sale we have tracked"', /every sale we have tracked/i],
  ['"Sales and leases from the Board\'s closed records"', /Sales and leases from the Board/],
];

export default {
  id: 'claims',
  title: 'No claim about the sold record, and every page has a working CTA',

  perPage(slug, raw) {
    // The RENDERED document, with the RSC payload removed, for what a reader sees; the JSON-LD
    // blocks read separately, because a claim in structured data reaches the index all the same.
    const html = raw.replace(/<script[\s\S]*?<\/script>/g, ' ');
    const ld = [...raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    return {
      slug,
      visible: CLAIMS.filter(([, re]) => re.test(html)).map(([label]) => label),
      schema: CLAIMS.filter(([, re]) => re.test(ld)).map(([label]) => label),
      deadCta: /class="s-b2" href="\/listings"/.test(html),
      wiredCta: html.includes('id="street-alert"'),
    };
  },

  finish(rows) {
    const withClaim = (key) => rows.filter((r) => r[key].length > 0);
    return {
      coverage: [
        ['pages read', rows.length],
        ['CTAs wired', rows.filter((r) => r.wiredCta).length],
      ],
      assertions: [
        ['pages with a sold-record claim (visible)', withClaim('visible').length, 0],
        ['pages with a sold-record claim (JSON-LD)', withClaim('schema').length, 0],
        ['dead "/listings" CTAs', rows.filter((r) => r.deadCta).length, 0],
        ['pages with no wired alert CTA', rows.filter((r) => !r.wiredCta).length, 0],
      ],
      examples: [
        ...withClaim('visible').slice(0, 4).map((r) => `visible ${r.slug}: ${r.visible.join(', ')}`),
        ...withClaim('schema').slice(0, 4).map((r) => `JSON-LD ${r.slug}: ${r.schema.join(', ')}`),
      ],
    };
  },
};
