// MA-002. Per-page checks on raw HTML. No browser, no database: everything here reads the
// document the host served and returns findings. The browser-only checks (fonts under 12 px,
// overflow at 390) live in browser.mjs.
//
// A finding is { code, sev, key, detail }. `code` names the check, `key` disambiguates within a
// page (an href, a word), and code + key + path is the identity the nightly diff compares.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Vocabulary. VALIDATOR_SUPERLATIVES mirrors src/lib/ai/validateStreetGeneration.ts
// (SUPERLATIVE_PHRASES) exactly, and CATCHMENT mirrors src/lib/ai/catchmentVocabulary.ts
// (BAN_PATTERNS), so the audit judges rendered text by the lists the validators judge generated text.
// Kept in sync by hand; the audit cannot import TS. MA-011 adds AUDIT_CLAIMS on the audit side only:
// the validator hard-rejects every hit, and "only" alone sits in 789 sections of 543 published streets'
// stored prose ("only a handful of recorded transactions"), so the generator keeps its eleven (Aamir's
// call, 2026-09-28). The drift test holds both halves: the mirror equal, the audit's list the mirror
// plus these five.
export const VALIDATOR_SUPERLATIVES = [
  'best', 'unbeatable', 'nothing comes close', 'premier', 'second to none', 'finest',
  'most desirable', 'top-tier', 'world-class', 'unparalleled', 'unmatched',
];
export const AUDIT_CLAIMS = ['only', 'highest', '#1', 'top producer', 'leading'];
export const SUPERLATIVES = [...VALIDATOR_SUPERLATIVES, ...AUDIT_CLAIMS];

// MA-010. The superlative check is a compliance check, not a style check: RECO bars a registrant
// from an unsubstantiated superlative or comparative claim about themselves, their brokerage or a
// property (Bulletin 5.1). So it fails closed: every hit fires unless it sits in one of the
// constructions below, each of which ranks nothing, each drawn only as wide as the site's own copy
// needs. A construction the list does not know fires; a new benign idiom costs one false positive
// and one fixture, never a missed claim. The fixtures are test-voice-rules.mjs in this folder, run
// before every nightly; a change here without a fixture there is not done. Four red-team rounds
// (2,433 executed attack candidates, 999 mutants of this file) drew every boundary below.
//
//   proper    a name. A Milton street (src/data/miltonStreetRegistry.ts) or a Town park or school
//             (src/data/townPlaces.ts) in Title Case, the street type spelled or abbreviated ("Best
//             Road", "Best Rd", "Brian Best Park"), in capitals after a street number ("1234 BEST RD"),
//             in a feed intersection whose side it closes ("Ferguson/Best"; after "Near" or "Cross
//             street" also "Best and Ferguson"), or as its slug. A name that opens with the word ("Best
//             Road") is not a name after "the", "a", "our" or the town's possessive ("Milton's") unless a
//             noun it modifies follows ("the Best Road homes", "a Best Road price", "your Best Road
//             valuation"), and never before a ranking for an audience ("Best Road for families"). A
//             company whose capitalised run ends in a legal designator and holds no function word,
//             determiner, possessive, claim noun or our own name ("RE/MAX Premier Inc."). The listing
//             brokerage where the feed attributes one, on the same line or under a label line ("Listed
//             by World Class Realty Point", "Listing office ...", "the listing brokerage (...)", "MLS®
//             W... · ...", "Brokerage ..."): two words or more, no possessive, no first person, not ours;
//             a feed name may carry a claim noun ("Century 21 Premier Service"). "Premier" as the office
//             ("Premier Doug Ford", "under Premier Ford", "Premier Ford said", "the Premier of Ontario",
//             "former Premier", "the Premier's office").
//   adverb    "best" before a neutral verb of finding out, after a copula (two adverbs may stand
//             between), a data noun or "a/the <noun>", or opening a note ("Best confirmed per listing",
//             "Maintenance fee: best confirmed per listing"): "is best confirmed per listing", "is
//             therefore best characterised", "a building best understood through its lease record".
//             "served" counts only as "best served by <doing>"; "reviewed", "handled", "done" and
//             "appreciated" only before a process ("against", "per", "through" ...). An evaluative
//             participle ranks its subject and fires: "best placed", "best located", "best known".
//   fit       suitability, not rank: "fits a buyer best", "works best from here", "works best.", "Best
//             suits", "Best for" as a label, "is best suited to". Never after a determiner or a noun ("the
//             home best suited to"), never before a noun ("working hard for the best results"), never
//             with a comparison set ("of all", "among", "out of 20 listings", "than any").
//   source    a data subject named as the place to look: "the Ford market is your best guide to what
//             you'd pay", "sold prices are the best guide to value", "recent sales on this street are your
//             best guide", and in apposition to a figure ("typically sell around $610K, the best guide to
//             its value"). Never one of the site's own products ("this street report", "the market
//             watch", "each street page"), and never followed by a claim about the agent ("of local
//             expertise").
//   question  a choice the reader makes: "Which Milton neighbourhood has the best schools?", "What Milton
//             neighbourhood is best for GO commuters?", "Is a condo or a freehold best for a first-time
//             buyer?", "Who is this building best for?", "decide which is best for your family",
//             "Whether a condo or a freehold is best depends on your stage". Never "why", "what makes" or
//             "how come", which presuppose the claim; never "the best <value, price, agent ...>"; void
//             when the question names a role or says "we", or its answer (the next sentence) names the
//             registrant, a site product or a pick ("This one: four beds"). A choice left to the reader
//             ("Aamir can show you which streets suit your budget best") survives our name; a choice of
//             agent never does.
//   idiom     fixed phrases that rank nothing: "at best" closing a clause, after a copula or before a
//             qualifier ("given the small sample"), "to the best of my knowledge", "do our (very) best"
//             closing a clause, "your best interest", "the best interests of", "best and final", "best
//             practice", "best time to call", "the best part of an hour", "no single best", "look its
//             best", "best foot forward", "the best of both worlds", "best-case scenario"; and, when the
//             sentence and any answer do not name the registrant: "it is (typically) best to", "Best to
//             confirm", "your best bet is to", "the best way to confirm", "the best source for the exact
//             fee", "the best time to list", "best month for sellers", "the best offer is", "a best
//             estimate", "the top tier of the price range", "nothing comes close to the 2022 peak", and a
//             data match ("unmatched in the Town file", "an unmatched address rolls up").
//
// adverb, fit, source, question and the guarded idioms are void when the sentence, or the answer to a
// question, names the registrant: Aamir, Yaqoob, Miltonly, RE/MAX, Realty Specialists, I, we, our (not
// "Our Lady"), us, me, my, he, his, a realtor or broker (not a mortgage broker), or a brokerage, agent,
// specialist, expert, advisor, representative, negotiator, producer or team that is not a third party's
// ("the listing agent", "the buyer's agent", "the leasing team", "the management team"), or "this
// site". The site's own brand after a title separator ("| Miltonly.com") is not a claimant.
//
// MA-011. The five audit-only words. "#1" and "top producer" (and "top-producing") rank by their
// nature and run the path above: they fire unless proper ("Unit #1", "Lot #1", "Highway #1": a
// number, not a rank) or a guarded label idiom ("Step #1", "Myth #1"). "only", "leading" and
// "highest" are ordinary words first ("only a handful of sales", "the road leading to Main", "the
// highest sales count of the four quarters"), so for them the rule is the other way round (Aamir's
// call, 2026-09-28): they fire only in the claim sense, and the quantity or ordinary sense is exempt
// as "ordinary". The claim sense is
//   - the thing ranked is the registrant, the site, a brokerage, an agent or a team: the noun phrase
//     the word opens holds a claim target ("the only dedicated real estate platform", "Milton's leading
//     brokerage", "the highest-rated agent", "the highest level of service", "Highest career
//     achievement recognition": an award or a rating is the agent's standing);
//   - or, for "only", the shape "the only ... in <place>" or "<Place>'s only ...": a place is a
//     capitalised name that is not a month, a day or a quarter, or the town, city, region, area,
//     neighbourhood, community, province, country or GTA ("the only detached home in Timberlea",
//     "Milton's only waterfront condo"). A count after "only" is the quantity sense even there ("the
//     only two sales in Milton this year").
// The "ordinary" exemption is void, as every MA-010 exemption but proper and the free idioms is, when
// the sentence or a question's answer names the registrant ("Aamir takes only a handful of listings a
// year" fires). "only" closing the phrase it restricts ("Miltonly emails only, from Aamir Yaqoob") is a
// free idiom and is never void.
const HYPHEN = '[-\\u2010\\u2011\\u2012\\u2013\\u00ad\\s]+';
const supPattern = (w) => w.replace(/[-\s]+/g, HYPHEN);
// The regex source for one vocabulary entry: "#1" has no word boundary before "#", and "top producer"
// takes its plural and "top-producing".
const supSource = (w) => w === '#1' ? '(?<![\\w#&])#\\s?1(?![\\d]|st[A-Z])' : w === 'top producer' ? `\\btop(?:${HYPHEN})?produc(?:ers?|ing)\\b` : `\\b${supPattern(w)}\\b`;
const SUP_WORD = new RegExp(SUPERLATIVES.map(supSource).join('|'), 'i');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, c) => a + c.toUpperCase());
const TYPE_ABBR = { road: ['Rd'], street: ['St'], avenue: ['Ave'], drive: ['Dr'], crescent: ['Cres'], court: ['Ct'], boulevard: ['Blvd'], lane: ['Ln'], place: ['Pl'], terrace: ['Terr'], circle: ['Cir'], parkway: ['Pkwy'], trail: ['Trl'], heights: ['Hts'] };
// The names on record when MA-010 was written, used only if the data files cannot be read.
const NAMES_FALLBACK = ['Best Road', 'Best Rd', 'Brian Best Park'];
const SLUGS_FALLBACK = ['best-road-milton'];
function loadRegisteredNames() {
  const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
  const names = new Set(); const slugs = new Set(); const bases = new Set(); const supBases = new Set();
  const registry = read('src/data/miltonStreetRegistry.ts');
  for (const m of registry.matchAll(/\{\s*name:\s*"([^"]+)"[^}]*?base:\s*"([^"]*)"[^}]*?type:\s*"([^"]*)"[^}]*?slug:\s*"([^"]+)"/g)) {
    const base = m[2].toLowerCase().replace(/-/g, ' ');
    bases.add(base);
    if (!SUP_WORD.test(m[1])) continue;
    supBases.add(base);
    const full = titleCase(m[1]); names.add(full); slugs.add(m[4]);
    const head = full.split(' ').slice(0, -1).join(' ');
    for (const a of TYPE_ABBR[m[3].toLowerCase()] || []) names.add(`${head} ${a}`);
  }
  const places = read('src/data/townPlaces.ts');
  for (const m of places.matchAll(/\bname:\s*"([^"]+)"/g)) if (SUP_WORD.test(m[1])) names.add(m[1].replace(/\s*\(.*\)\s*$/, ''));
  const fromFiles = names.size > 0 && bases.size > 0;
  if (!fromFiles) { NAMES_FALLBACK.forEach((n) => names.add(n)); SLUGS_FALLBACK.forEach((s) => slugs.add(s)); supBases.add('best'); }
  return { names: [...names].sort((a, b) => b.length - a.length), slugs: [...slugs], bases, supBases, fromFiles };
}
export const REGISTERED = loadRegisteredNames();
// Title Case as written; ALL CAPS only after a street number ("8124 BEST RD"), where it is an address.
const NAME_RE = new RegExp(`(?<![\\w-])(?:${REGISTERED.names.map(esc).join('|')})\\.?(?![\\w-])|(?<=\\b\\d+[A-Z]?\\s+)(?:${REGISTERED.names.map((n) => esc(n.toUpperCase())).join('|')})\\.?(?![\\w-])`, 'g');
// A noun a street name can modify: after one, "the Best Road ..." is the street, not a ranking.
const ATTRIBUTIVE_NEXT_RE = /^(?:homes?|houses?|townhomes?|townhouses?|semis?|detached|condos?|listings?|sales?|rentals?|market|end|side|corner|corridor|stretch|section|intersection|entrance|exit|overpass|underpass|bridge|crossing|extension|address(?:es)?|page|records?|numbers?|figures?|price|prices|typical|rents?|leases?|trades?|residents|neighbours|owners|lots?|property|properties|frontage|allowance|area|views?|valuations?|reports?|alerts?|updates?|neighbourhood)$/i;
const NAME_RANKED_RE = /^\s+(?:(?:in\s+[A-Z][\w'’-]*\s+)?for\s+(?:(?:young|growing|busy|new|first[-\s]time|retired|active|local)\s+)?(?:families|family|commuters|buyers|sellers|investors|downsizers|retirees|kids|children|renters|couples|professionals|you\b|your\b|GO\b|everyone|anyone)|to\s+(?:selling|buying|homeownership|success|owning))/i;
const RANKING_POSSESSIVE_RE = /^(?:Milton|Halton|Ontario|Canada|GTA|Toronto|town|city|region)['’]s$/i;
const STREET_TYPE = '(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Crescent|Cres|Court|Ct|Boulevard|Blvd|Lane|Ln|Line|Way|Place|Pl|Terrace|Terr|Trail|Trl|Circle|Cir|Gate|Heights|Hts|Parkway|Pkwy|Path|Common|Crossing|Landing|Close|Grove)\\.?';
const INTERSECT_SLASH_AFTER_RE = new RegExp(`^(?:\\s+${STREET_TYPE})?\\s*\\/\\s*([A-Za-z][A-Za-z'-]+)`, 'i');
const INTERSECT_SLASH_BEFORE_RE = new RegExp(`([A-Za-z][A-Za-z'-]+)(?:\\s+${STREET_TYPE})?\\s*\\/\\s*$`, 'i');
const INTERSECT_AND_AFTER_RE = new RegExp(`^(?:\\s+${STREET_TYPE})?(?:\\s*&\\s*|\\s+(?:and|AND)\\s+)([A-Za-z][A-Za-z'-]+)`, 'i');
const INTERSECT_AND_BEFORE_RE = new RegExp(`([A-Za-z][A-Za-z'-]+)(?:\\s+${STREET_TYPE})?(?:\\s*&\\s*|\\s+(?:and|AND)\\s+)$`, 'i');
const INTERSECT_CUE_RE = /\b(?:Near|NEAR|near|Cross\s+streets?|Major\s+intersection|Intersection|at\s+the\s+corner\s+of)\b:?[^\n]{0,40}$/;
const PREMIER_OFFICE_RE = /\bPremier\s+(?:Doug\s+Ford|Kathleen\s+Wynne|Dalton\s+McGuinty|Ernie\s+Eves|Mike\s+Harris|Bob\s+Rae|David\s+Peterson)\b|(?<=\b(?:under|by|from|with|to|told|asked|former|then|provincial|Ontario['’]?s?)\s+)Premier\s+Ford\b|\bPremier\s+Ford\b(?=['’]s\s+(?:office|government|announcement|plan|housing)\b|\s+(?:[Ss]aid|[Ss]ays|[Aa]nnounce[sd]?|[Hh]as|[Hh]ad|[Ww]ill|is\s+expected|[Ww]as|[Cc]uts?|[Ss]igned|[Ss]igns|[Pp]romised|[Pp]romises|[Pp]ledged|[Tt]old|[Uu]nveil(?:s|ed)|[Ii]ntroduce[sd]|[Vv]isit(?:s|ed)|[Cc]all(?:s|ed))\b|\s+and\s+(?:Mayor|Minister|MPP|Councillor|Premier|the\s+(?:Mayor|Minister|province))\b)|\bPremier\s+of\s+Ontario\b|\b(?:[Ff]ormer|[Tt]hen|[Pp]rovincial)\s+Premier\b|\b[Aa]s\s+Premier\b|\bOntario(?:['’]s)?\s+Premier\b(?=\s+(?:Doug\s+Ford|Ford)\b|,\s+Doug\s+Ford\b|\s+(?:said|says|announced|has|had|will|is|was)\b)|\b[Tt]he\s+Premier\b(?=\s+(?:said|says|announced|has|had|will|is|was|would|told|promised|pledged|signed|unveiled|introduced|visited|called)\b|\s+and\s+(?:the\s+)?(?:Mayor|Minister|MPP)\b|\s+of\s+(?:Ontario|the\s+province)\b|,\s+Doug\s+Ford\b|['’]s\s+(?:office|government|announcement|plan|housing)\b)/g;
const NAME_OPENER_RE = /^(?:the|a|an|our|my|your|his|her|their|its)$/i;
const DETERMINER_RE = /^(?:the|a|an|our|my|your|his|her|their|its|this|that|these|those|whose|every)$/i;
const POSSESSIVE_RE = /['’]s$/i;
const HARD_DESIGNATOR_RE = /^(?:Inc\.?|Incorporated|Ltd\.?|Limited|Corp\.?|Corporation|LLC|LLP|L\.L\.C\.)$/i;
const FUNCTION_WORD_RE = /^(?:the|a|an|of|in|for|with|to|at|on|by|and|or|is|are|was|be|our|your|my|their|his|her|its|this|that|these|those|why|how|what|who|which|work|choose|sell|buy|call|meet|voted|get|find)$/i;
const CLAIM_NOUN_RE = /^(?:Team|Teams|Agent|Agents|Realtor|Realtors|Service|Services|Home|Homes|House|Houses|Value|Values|Deal|Deals|Buy|Buys|Price|Prices|Pricing|Location|Locations|Choice|Results|Expert|Experts|Expertise|Experience|Investment|Investments|Street|Streets|Neighbourhood|Neighbourhoods|Property|Properties|Condo|Condos|Brokerage|Brokerages|Partner|Partners|Support|Advisor|Advisors|Adviser|Representation|Negotiator|Rates|Leader|Leaders|Data|Knowledge|Reach|Network|Marketing|Picks|Group|Edition|Townhomes|Resource|Resources|Platform|Guide)$/i;
const OWN_NAMES_RE = /\b(?:Miltonly|Aamir|Yaqoob)\b|Realty Specialists/i;
const ATTRIBUTION_CUE_RE = /(?:\b[Ll]isted\s+(?:now\s+)?by:?|\b[Ll]isting\s+(?:[Bb]rokerage|[Oo]ffice):?|\blisting\s+brokerage\s*\(|(?:^|[·|])[ \t]*Brokerage:?|\b(?:[Ll]isting\s+)?[Cc]ourtesy\s+of:?|\b[Pp]resented\s+by:?|MLS®?\s*[A-Z]?\d+\s*·)[ \t]*((?:[A-Z0-9#][\w'’&./®-]*[ \t]+){0,4})$/;
const ATTRIBUTION_LABEL_RE = /^\s*(?:Listed\s+(?:now\s+)?by|Listing\s+(?:brokerage|office)|Brokerage|Courtesy\s+of|Presented\s+by):?\s*$/i;
// The registrant, the agent, the brokerage or the site. A third party's agent, brokerage or team is not.
// MA-011: a role is a third party's after its owner or trade, with or without a determiner ("listing
// brokerages", "an insurance agent", "a Town representative", "buyers' agents"), or after "another".
const THIRD = '(?<!\\b(?:listing|leasing|buyer[\'’]s|buyers[\'’]|seller[\'’]s|sellers[\'’]|tenant[\'’]s|landlord[\'’]s|mortgage|insurance|tax|financial|lender[\'’]s|bank[\'’]s|developer[\'’]s|builder[\'’]s|builder[\'’]s\\s+sales|town|town[\'’]s|municipal|city|government)\\s)(?<!\\b(?:another|other)\\s)';
const TEAM = '(?<!\\b(?:management|concierge|building|property|maintenance|security|board|leasing|front[\\s-]desk|builder[\'’]s\\s+sales|developer[\'’]s\\s+sales|sales|hockey|sports|roads?|construction|design|medical|nursing|school|coaching|soccer|baseball|basketball)\\s)\\bteams?\\b';
const ROLE_ALT = `\\b(?:Miltonly|Aamir|Yaqoob)\\b|\\brealtors?\\b(?!\\.ca)|(?<!\\b(?:mortgage|insurance)\\s)\\bbrokers?\\b|Realty Specialists|RE\\/?MAX|${THIRD}\\bbrokerages?\\b|${THIRD}\\bagents?\\b|${THIRD}\\b(?:specialists?|experts?|advis[oe]rs?|sales\\s+representatives?|representatives?|salespersons?|negotiators?|producers?)\\b|${THIRD}(?<!\\b(?:licensed|qualified|legal|medical|health|home[\\s-]inspection)\\s)\\bprofessionals?\\b|${THIRD}\\bpros?\\b(?![-\u2010\u2011]|\\s*(?:and|&)\\s*cons|\\s*#)|\\bsomeone\\s+who\\s+(?:knows|has\\s+sold|sells|(?:lives|works)\\s+(?:on|in)\\s+(?:this|your|the)\\s+(?:street|neighbourhood|area|market))\\b|${TEAM}|(?<!\\b(?:plans?|development|zoning|builder|developer|construction|proposal|application)\\s+(?:for|on|at|of)\\s+)\\b(?:this|our)\\s+(?:site|website|platform)\\b`;
const ROLE_RE = new RegExp(ROLE_ALT, 'i');
// MA-011: "us" in lower case only ("relocate from the US" is the country).
const US_RE = /\b(?:us|Us)\b/;
const PRONOUN_CI_RE = /\b(?:we|we're|we’re|we've|we’ve|we'll|we’ll|ours|me|my|mine|he|him|his)\b|\bour\b(?!\s+Lady\b)/i;
const PRONOUN_RE = { test: (s) => PRONOUN_CI_RE.test(s) || US_RE.test(s) };
const ANSWER_PICKS_RE = /^\s*(?:this|that)\s+(?:one|home|house|condo|listing|property|building|street|townhome|townhouse)\b|^\s*ours\b/i;
const WE_CI_RE = /\b(?:we|we're|we’re|we've|we’ve|we'll|we’ll|ours)\b|\bour\b(?!\s+Lady\b)/i;
const WE_RE = { test: (s) => WE_CI_RE.test(s) || US_RE.test(s) };
// MA-011: not a Roman numeral ("World War I-era", "Phase I", "Part I").
const FIRST_PERSON_I_RE = /(?<!\b(?:War|Phase|Part|Schedule|Class|Type|Level|Stage|Section|Chapter|Tier|Grade|Zone|Division|Appendix|Exhibit|Article|Title|Volume|Book|Act|Tower|Building|Block|Henry|George|Elizabeth|William|Charles|Edward|Richard|James|Mary|Louis)\s)(?<![\w.])I(?:'m|’m|'ve|’ve|'ll|’ll|'d|’d)?(?![\w.-])/;
const BRAND_SUFFIX_RE = /\s*[|–—-]\s*Miltonly(?:\.com)?\s*$/i;
// MA-011: our names, "this site" (not a development's), "someone who knows your street", and the role
// words no third party claims (rolesNameRegistrant, below).
const OWN_ROLE_RE = /\b(?:Miltonly|Aamir|Yaqoob)\b|Realty Specialists|RE\/?MAX/i;
const THIS_SITE_RE = /(?<!\b(?:plans?|development|zoning|builder|developer|construction|proposal|application|proposed|planned|zoned|approved|built|designated)\s+(?:for|on|at|of)\s+)\b(?:this|our)\s+(?:site|website|platform)\b/i;
const SOMEONE_RE = /\bsomeone\s+who\s+(?:knows|has\s+sold|sells|(?:lives|works)\s+(?:on|in)\s+(?:this|your)\s+(?:street|neighbourhood|area|market))\b/i;
const namesRole = (s) => { const t = s.replace(BRAND_SUFFIX_RE, ''); return OWN_ROLE_RE.test(t) || THIS_SITE_RE.test(t) || SOMEONE_RE.test(t) || rolesNameRegistrant(t); };
const namesRegistrant = (s) => { const t = s.replace(BRAND_SUFFIX_RE, ''); return namesRole(t) || PRONOUN_RE.test(t) || FIRST_PERSON_I_RE.test(t); };
const CORE_ROLE_RE = /\b(?:realtors?|brokers?|brokerages?|agents?|salespersons?|salespeople|sales\s+representatives?|teams?)\b/i;
const namesRegistrantSense = (s) => { const t = s.replace(BRAND_SUFFIX_RE, ''); return OWN_ROLE_RE.test(t) || THIS_SITE_RE.test(t) || SOMEONE_RE.test(t) || (CORE_ROLE_RE.test(t) && rolesNameRegistrant(t.replace(/\b(?:specialists?|experts?|advis[oe]rs?|representatives?(?<!sales\s+representatives?)|negotiators?|producers?|professionals?|pros?)\b/gi, 'x'))) || PRONOUN_RE.test(t) || FIRST_PERSON_I_RE.test(t); };
const COPULA_RE = /^(?:is|are|am|was|were|be|been|being|remains?|remained|it's|it’s|that's|that’s|i'm|i’m|we're|we’re|they're|they’re)$/i;
const MODAL_RE = /^(?:can|may|might|could|would|should|will|must)$/i;
const ADVERB_RE = /^(?:therefore|thus|perhaps|probably|often|usually|generally|still|also|again|currently|now|arguably|typically|simply|then|so|all|both|each|[a-z]+ly)$/i;
const DATA_NOUN_RE = /^(?:markets?|mix|records?|listings?|figures?|data|sales|activity|trends?|history|numbers|composition|stock|pace|movement)$/i;
// Verbs of finding something out. An evaluative participle (placed, positioned, qualified, located,
// situated, priced, appointed, rated, known, kept, suited) is not here: it ranks its subject.
const NEUTRAL_PARTICIPLE_RE = /^(?:confirmed|verified|checked|described|read|understood|judged|assessed|answered|explained|gauged|treated|thought|discussed|explored|handled|done|measured|estimated|interpreted|approached|compared|considered|characterised|characterized|summarised|summarized|captured|expressed|framed|reached|reviewed|viewed|seen|left|served|evaluated|determined|established|calculated|counted|tracked|addressed|appreciated|used|taken|reflected|represented|directed|raised|obtained|found|asked|noted|documented|clarified|resolved|sourced)$/i;
const PARTICIPLE_NEEDS = { served: /^\s+by\s+[a-z]+ing\b/i, reviewed: /^\s+(?:against|per|with|through|before|at|directly|in\s+person|on\s+site)\b/i, handled: /^\s+(?:through|via|per|against|at|directly|in\s+person|by\s+[a-z]+ing)\b/i, done: /^\s+(?:through|via|per|against|at|directly|in\s+person|by\s+[a-z]+ing|before|after|once)\b/i, appreciated: /^\s+(?:from|in\s+person|on\s+foot|at)\b/i };
const FIT_VERB_RE = /^(?:fits?|fitting|suits?|suiting|works?|working)$/i;
const FIT_FOLLOW_RE = /^(?:from|for|with|when|if|here|there|overall|comes|come|depends|depend|and|but|or|so|because|during|today|now|in)$/i;
const SOURCE_RE = /\b(?:is|are|was|were|remains?|will\s+be|would\s+be|can\s+be)\s+(?:your|the)\s+best\s+(?:available\s+)?(?:guide|guides|source|sources|reference|indicator|indicators|measure|proxy|check|figure|estimate|evidence)\b/gi;
const DATA_SUBJECT_RE = /\b(?:markets?|listings?|records?|data|figures?|numbers|sales?|prices?|levels?|history|trends?|comparables|activity|corporations?|management|certificates?|documentation|filings?|typical)\b/i;
const SITE_PRODUCT_RE = /\b(?:reports?|watch|newsletters?|alerts?|emails?|website|valuations?|analysis|index|app|brief|briefing|tool|tools|Miltonly)\b|\b(?:this|these|those|our|each|every)\s+(?:[\w'’-]+\s+)?(?:page|pages|site|report|reports|tool|tools|data|figures|numbers|analysis|research|listings)\b|\bon\s+the\s+site\b|\bour\b(?!\s+Lady\b)/i;
const SOURCE_APPOSITIVE_RE = /,\s+(?:the|your)\s+best\s+(?:guide|reference|indicator|measure)\s+to\b/gi;
const SOURCE_APPOSITIVE_DATA_RE = /\b(?:typical|typically|sells?|sold|sales|market|listings|prices?|figures?)\b/i;
const FIT_RANKING_RE = /\b(?:of\s+all|out\s+of\s+(?:all|every|the|\d+)|among|than\s+any|compared\s+(?:with|to)|of\s+(?:every|the\s+\w+\s+(?:for\s+sale|listed|on\s+the\s+market)))\b/i;
const WHICH_ASKS_RE = /(?:^\s*|[,:;—–(]\s*|\b(?:of|between|among|to|about|on|see|decide|choose|compare|know|tell\s+me|sure|wondering|unsure|deciding|choosing|you|out)\s+)which\b/i;
const SOURCE_CLAIM_AFTER_RE = /^[^.!?]*?\b(?:expertise|expert|skill|skills|knowledge|service|agent|realtor|representation|results)\b/i;
const QUESTION_PRESUPPOSES_RE = /\b(?:why|what\s+makes|what['’]s\s+so|how\s+come)\b/i;
const INDIRECT_CHOICE_RE = /\b(?:see|decide|choose|find\s+out|work\s+out|figure\s+out|compare|weigh|show\s+you|help\s+you\s+(?:see|decide|choose|work\s+out|find))\s+(?:which|what(?:['’]s)?)\b[^.?!]*$/i;
const FREE_IDIOM_RES = [
  /\bat\s+best\b(?=\s*(?:[.,;:!?)—–]|$)|\s+(?:given|for|until|when|with|since|because|as|on|in)\b)/gi,
  /\b(?:is|are|was|were|be|remains?)\s+at\s+best\b/gi,
  /\bto\s+the\s+best\s+of\s+(?:my|our|your|his|her|their)\s+(?:knowledge|ability|abilities|recollection|understanding|belief)\b/gi,
  /\b(?:do|does|did|doing|done|try|tries|tried|trying)\s+(?:my|our|your|their|his|her|its)\s+(?:very\s+)?best\b(?=\s*(?:to\b|[.,;:!?)]|$))/gi,
  /\b(?:your|their|his|her|our|my|its|(?:the\s+)?(?:client|buyer|seller|tenant|landlord)['’]s|(?:clients|buyers|sellers|tenants|landlords)['’])\s+best\s+interests?\b(?!\s+rates?)/gi,
  /\bthe\s+best\s+interests?\s+of\b/gi,
  /\bbest\s+and\s+final\b/gi,
  /\bhighest\s+and\s+best\s+use\b/gi,
  /\bbest\s+(?:time|times|way|number|day|days)\s+to\s+(?:call|reach|contact|text|email)\b/gi,
  /\bthe\s+best\s+part\s+of\s+an?\s+(?:hour|day|week|month|year|decade)\b/gi,
  /\bno\s+(?:single\s+|one\s+)?best\b/gi,
  /\b(?:look|looks|looking)\s+(?:its|their|your)\s+best\b/gi,
  /\bbest\s+foot\s+forward\b/gi,
  /\bthe\s+best\s+of\s+both\s+worlds\b/gi,
  /\bin\s+the\s+best\s+case\b|\bbest[-\s]case\s+scenario\b/gi,
];
const GUARDED_IDIOM_RES = [
  /\bit(?:\s+is|['’]s|\s+was|\s+may\s+be|\s+would\s+be|\s+will\s+be|\s+would\s+(?:therefore|usually|generally|typically)\s+be)\s+(?:usually\s+|generally\s+|often\s+|always\s+|probably\s+|still\s+|typically\s+|therefore\s+)?best\s+to\b/gi,
  /(?:^|[.;:!?]\s+|\n\s*)best\s+to\s+(?:confirm|check|verify|ask|contact|call|book|review|compare)\b/gi,
  /\bbest\s+practices?\b/gi,
  /\b(?:your|the)\s+best\s+bet\s+is\s+to\b/gi,
  /\bthe\s+best\s+way\s+to\s+(?:confirm|check|verify|find\s+out|learn|see|compare|know|tell|judge|read|understand|estimate|gauge)\b/gi,
  /\bthe\s+best\s+(?:source|reference|place|first\s+step)\s+(?:to\s+(?:confirm|check|verify|find\s+out|learn|ask|get)\b|for\s+(?:the\s+)?(?:(?:exact|current|specific|up-to-date|latest|monthly|annual)\s+)?(?:fee|fees|figure|figures|build\s+year|rent|rents|price|pricing|details|specifics|amenities|unit\s+counts?|reserve\s+fund|status)\b)/gi,
  /\bthe\s+(?:next\s+)?best\s+(?:first\s+step|starting\s+point|reference)\s+is\b/gi,
  /\b(?:give|gives|offer|offers)\s+the\s+best\s+read\s+on\b/gi,
  /\bthe\s+best\s+time\s+to\s+(?:list|sell|buy|move|visit|book|view|call)\b/gi,
  /\bbest\s+(?:month|week|season|quarter|year)\s+(?:for|to)\s+(?:sellers|buyers|sell|buy|list)\b/gi,
  /\bthe\s+best\s+offer\b(?=\s+(?:is|isn['’]t|may|might|will|won['’]t|can|and\s+final|in\s+a)\b)/gi,
  /\b(?:a|our|your|my)\s+best\s+(?:estimate|estimates|guess)\b/gi,
  /\bthe\s+top[-\s]+tier\s+(?:of|by)\s+(?:the\s+)?(?:[\w'’]+\s+){0,2}?(?:price|prices|market|range|sales)\b(?!\s+for\b)/gi,
  /\b(?:the\s+)?top[-\s]+tier\s+(?:segment|band|bracket|price\s+band)\b/gi,
  /\bnothing\s+comes\s+close\s+to\s+(?:the\s+)?(?:(?:peak|high|record|level|total|pace)\s+of\s+)?(?:[A-Za-z]+\s+)?(?:19|20)\d{2}(?:\s+(?:[\w'’-]+\s+){0,2}?(?:peak|high|record|level|total|pace))?\b/gi,
  /\bunmatched\s+(?:in|against|to|with)\s+(?:the\s+)?(?:Town(?:['’]s)?\s+(?:file|record|records|registry|data)|record|records|file|registry|data|feed)\b(?!\s+books?\b)/g,
  /\bunmatched\s+(?:address(?:es)?|records?|rows?|sales?|listings?)\b(?=\s*(?:[.;:!?)]|$)|\s+(?:roll|rolls|are|is|was|were|stay|stays|remain|remains|go|goes|fall|falls|drop|drops)\b)/gi,
];
const INTERSECT_ENDS_RE = new RegExp(`^(?:\\s+${STREET_TYPE})?(?=\\s*(?:$|[\\n.,;:!?)\\u00b7|/&]|\\s+(?:and|AND)\\s))`);
const LEAD_P = /^[(\[“"‘']+/;
const TRAIL_P = /[)\]”"’',;:!?]+$/;
const coreOf = (raw) => raw.replace(LEAD_P, '').replace(TRAIL_P, '');
const leads = (t) => LEAD_P.test(t.raw);
const trails = (t) => TRAIL_P.test(t.raw);
const CAP_TOKEN_RE = /^(?:[A-Z][\w'’&./®-]*|&|#1)$/;
const openerBlocks = (tok) => !!tok && (DETERMINER_RE.test(tok.core) || POSSESSIVE_RE.test(tok.core));
// Every construction and name is short, so a match covering idx starts within WINDOW characters of it.
const WINDOW = 400;
const covers = (re, text, idx) => { re.lastIndex = Math.max(0, idx - WINDOW); let m; while ((m = re.exec(text))) { if (m.index > idx) return false; if (idx < m.index + m[0].length) return true; if (m[0].length === 0) re.lastIndex++; } return false; };

// The sentence around an index: a full stop, question mark or exclamation mark ends one only when
// whitespace or the end follows ("4.9-star" and "P.F." do not), and a line break always does.
const BOUNDARY_RE = /(?<!\b(?:Inc|Ltd|Corp|Co|St|Ave|Rd|Dr|Cres|Blvd|Crt|Ct|Pl|Mr|Mrs|Ms|Jr|Sr|No|vs|approx|[A-Z]))[.](?=\s|$)|[!?](?=[)\]”"’]*(?:\s|$))|\n/g;
function sentenceSpan(text, idx) {
  let a = Math.max(0, idx - 10 * WINDOW); let b = text.length; BOUNDARY_RE.lastIndex = a; let m;
  while ((m = BOUNDARY_RE.exec(text))) { if (m.index < idx) a = m.index + 1; else { b = m.index; break; } }
  return { a, b };
}
// The clause around an index: bounded by sentence and clause punctuation or a line break.
function clauseStart(text, idx) { let a = idx; while (a > 0 && !/[.!?;:,()—–\n]/.test(text[a - 1])) a--; return a; }
// The whitespace tokens of the line around [start, end), with the first and last token overlapping it.
function lineTokens(text, start, end) {
  const ls = text.lastIndexOf('\n', start - 1) + 1; let le = text.indexOf('\n', end); if (le < 0) le = text.length;
  const toks = [...text.slice(ls, le).matchAll(/\S+/g)].map((m) => ({ s: ls + m.index, e: ls + m.index + m[0].length, raw: m[0], core: coreOf(m[0]) }));
  return { toks, a: toks.findIndex((t) => t.e > start), b: toks.findIndex((t) => t.e >= end) };
}
// A capitalised run of tokens around [a, b], stopping at punctuation and at a token that ends a
// sentence or a name ("Inc.").
function capitalisedRun(toks, a, b) {
  if (!CAP_TOKEN_RE.test(toks[a].core)) return null;
  let i = a; let j = b;
  while (i > 0 && !leads(toks[i]) && !trails(toks[i - 1]) && !/\.$/.test(toks[i - 1].raw) && CAP_TOKEN_RE.test(toks[i - 1].core)) i--;
  while (j < toks.length - 1 && !trails(toks[j]) && !/\.$/.test(toks[j].raw) && !leads(toks[j + 1]) && CAP_TOKEN_RE.test(toks[j + 1].core)) j++;
  return toks.slice(i, j + 1).map((t) => t.core);
}
const cleanRun = (run) => !run.some((t) => FUNCTION_WORD_RE.test(t) || DETERMINER_RE.test(t) || POSSESSIVE_RE.test(t) || t.split(/[-‐‑]/).some((p) => CLAIM_NOUN_RE.test(p))) && !OWN_NAMES_RE.test(run.join(' '));

// MA-011. "#1" fails closed. It is a NUMBER (proper, never void) after a unit, lot, suite, spot, store
// or street word ("Unit #1", "8330 James Snow Pkwy #1", "Road, #1"), in an address ("#1 - 8450 Lawson
// Road", "#1B-100 Nipissing Road"), in a series ("Units #1 and #2", "Photo #1 of 32"), or naming a route
// or a place in a plan ("the #1 bus", "#1 on the site plan"). It is a LABEL (an idiom, void when the
// sentence names the registrant) after a noun that is counted in lists ("Offer #1", "Bedroom #1", "Red
// flag #1"), opening a list item ("#1: Get pre-approved", "#1 - Overpricing"), among other numbered
// items ("Photos: #1 front, #2 kitchen"), after "Of the two offers," or as a back-reference ("higher
// than #1."). Anything else is a RANK and fires: "Ranked #1 of 350 agents", "Milton #1", "Number #1",
// "(#1 agent in Milton)", "Client Satisfaction #1".
const UNIT_WORD = '(?:townhomes?|units?|suites?|ste|apt|apartments?|lots?|ph|penthouse|phases?|blocks?|blk|buildings?|bldg|towers?|levels?|lvl|floors?|parking(?:\\s+spot)?|spots?|lockers?|stalls?|spaces?|rooms?|rm|townhouses?|th|concession|con|parts?|pt|box|pads?|parcels?|bays?|docks?|stores?|offices?|garages?|homesites?|meters?|wells?|stations?|ponds?|wards?|fields?|paddocks?|barns?|rinks?|pavilions?|portables?|plots?|elevators?|terminals?|platforms?|chargers?|furnaces?|kitchens?|washrooms?|ensuites?|storage|shops?|holes?)';
const STREET_WORD = '(?:road|rd|street|st|avenue|ave|drive|dr|crescent|cres|court|ct|crt|boulevard|blvd|lane|ln|way|place|pl|terrace|terr|trail|trl|circle|cir|gate|gt|path|common|landing|grove|parkway|pkwy|heights|hts|line|sideroad|side\\s+road|highway|hwy)';
// A unit word right before "#1" ("Unit #1", "Unit No. #1", "Unit: #1"); a unit or street word with a comma ("The end unit, #1,", "Road, #1").
const UNIT_ADJACENT_RE = new RegExp('(?:\\b' + UNIT_WORD + '(?:\\s+(?:no\\.?|number))?|\\b(?:units?|suites?|lots?|apt|parking|lockers?|stalls?|rooms?)\\s*:)\\s*$', 'i');
const NUMBERED_RE = new RegExp('\\b(?:(?!offices?|stores?|shops?|stations?|platforms?|levels?|blocks?|spots?)' + UNIT_WORD + '|' + STREET_WORD + '\\.?(?:\\s+\\d+)?(?:\\s+(?:north|south|east|west|[NSEW]))?)\\.?,?\\s*$', 'i');
const HASH1_SERIES_RE = /^[A-Z]?\s*(?:,\s*#\s?\d+[A-Z]?\s*)*(?:(?:and|or|to|through|thru|&|[-–]|vs\.?)\s*#\s?\d|(?:and|or|to|through|&)\s+\d+\s*(?:[,.;)]|$|\b(?:are|were|is|share|both|each|have|remain|sit|face)\b)|of\s+\d[\d,]*(?![\d,])(?!\s*\+?\s*(?:[\w/'’-]+\s+){0,3}(?:agents?|realtors?|teams?|brokerages?|reps?|representatives?|salespe\w+|offices?|members?|licensees?)))/i;
const HASH1_ADDRESS_RE = /^[A-Z]?\s*[-–,]?\s*\d{1,6}[A-Z]?\s+(?:[A-Z0-9][\w'-]*\s+){0,4}(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Crescent|Cres|Court|Ct|Crt|Boulevard|Blvd|Lane|Ln|Way|Place|Pl|Terrace|Trail|Circle|Cir|Gate|Path|Common|Landing|Grove|Parkway|Pkwy|Heights|Hts|Line|Sideroad|Highway|Hwy|MAIN|ST|RD|AVE|DR)\b/;
const HASH1_NUMBERING_AFTER_RE = /^\s+(?:bus|route|line|train|exit|gate|side\s*road|sideroad|highway|concession|(?:on|in)\s+(?:the\s+)?(?:site\s+|floor\s+|draft\s+|reference\s+)?(?:plan|map|survey|chart|table|series|sequence|gallery|block|row)|on\s+Plan\b)\b/i;
const RANK_BEFORE_RE = /^(?:the|a|an|our|my|your|his|her|their|its|is|are|was|were|be|been|become|becomes|remains?|ranked|ranks|rank|rated|rates|voted|named|crowned|finished|finishes|still|consistently|currently|overall|officially|always|truly|proudly|again|now|number|no\.?|top|holds?|hold|them|it|us|him|me)$/i;
const RANK_VERB_RE = /^(?:ranked|ranks|rank|rated|rates|voted|named|crowned|finished|finishes|consistently|currently|overall|officially|them|it|us)$/i;
// A noun before "#1" that ranks rather than numbers ("Client Satisfaction #1", "Sales #1 · Service #1").
const CLAIM_LABEL_RE = /^(?:sales|service|reviews?|ratings?|rankings?|rank|score|satisfaction|care|choice|pick|resource|platform|agents?|realtors?|teams?|brokerages?|office|producer|volume|transactions|realty|go-to)$/i;
// A noun that numbers a list whatever follows ("Tip #1 for sellers", "Step #1 in this guide").
const STRONG_LABEL_RE = /^(?:tips?|steps?|questions?|mistakes?|costs?|options?|reasons?|chapters?|sections?|days?|guides?|hacks?|tricks?|secrets?|rules?|myths?|lessons?|stops?|features?|highlights?|stats?|ideas?|goals?|tasks?|checklists?|criteri(?:on|a)|requirements?|deadlines?|milestones?|hurdles?|watch-outs?|checks?|draws?|terms?|paragraphs?|clauses?|amendments?|addend(?:um|a)|counter-offers?|counteroffers?|sign-backs?|sessions?|slides?|videos?|episodes?|packages?|quotes?|estimates?|appraisals?|showings?|viewings?|renderings?|contenders?|sources?|dealbreakers?|deal-breakers?|layouts?|criterion|years?|months?|weeks?)$/i;
const LABEL_IMPERATIVE_RE = /^\s+(?:get|find|price|know|check|hire|call|book|set|make|start|avoid|skip|stage|list|save|compare|ask|read|plan|build|choose|pick|watch|review|do|don['’]t)\b/i;
const HASH1_RANKS_AFTER_RE = /^\s+(?:of\s+[\d,]+\+?\s+(?:[\w/'’-]+\s+){0,3}(?:agents?|realtors?|teams?|brokerages?|reps?|representatives?|salespe\w+|offices?|members?|licensees?)|in\s+(?:the\s+)?(?:\w+\s+){0,2}(?:office|brokerage|company|team|region|province|country|GTA|town|city)\b|on\s+(?:the\s+)?(?:list|chart|map)\s+of|for\s+(?:[\w'’-]+\s+){0,3}(?:sold|sales|resale|homes|listings|buyers|sellers|clients?|client\s+\w+|customer\s+\w+|reviews?|service|satisfaction|care|transactions|units|real\s+estate|first-time|sold-over-asking|results)|(?:[\w'’-]+\s+){0,2}(?:agents?|realtors?|teams?|brokerages?|brokers?|reps?|representatives?|salespe\w+|platforms?|choice|pick|source|resource|go-to|route\s+to|line\s+of\s+defence|real\s+estate|home\s+selling|realty|office)\b|[-–—:]\s+(?:most|top|best|highest|leading|largest|\d{4}|\d+\s+years|[\w'’-]+\s+(?:running|straight|in\s+a\s+row)|(?:[A-Z][\w'’-]*\s+)?(?:office|agent|team|brokerage|Readers['’]?\s+Choice))|of\s+[\d,]+\+?\s+(?:at|in)\s|in\s+(?:19|20)\d{2}\b|by\s+(?:transactions|units|volume|sales))/i;
function hash1Kind(text, idx, len) {
  const before = text.slice(Math.max(0, idx - 80), idx); const after = text.slice(idx + len, idx + len + 80);
  const prevTok = (before.match(/(\S+)[ \t]*$/) || [])[1] || '';
  const adjacent = /[ \t]$/.test(before) && /^[A-Za-z][\w'’.-]*$/.test(prevTok) ? prevTok.replace(/\.$/, (m) => (/^no\.$/i.test(prevTok) ? m : '')) : null;
  const prevPrev = (before.match(/(\S+)\s+\S+[ \t]*$/) || [])[1] || '';
  const inPlaceAfter = () => { const m = after.match(/^\s+(?:[\w'’-]+\s+){0,3}?in\s+/i); return !!m && placeAt(after.slice(m[0].length)); };
  // 0. A ranking verb, a possessive or "your" before it ranks whatever follows ("Ranked #1 on the chart", "Milton's #1 route").
  if (adjacent && (RANK_VERB_RE.test(adjacent) || /^(?:your|our|my)$/i.test(adjacent) || (/['’]s$/i.test(adjacent) && !/^(?:here|there|that|what|it|let|who|where)['’]s$/i.test(adjacent)) || /s['’]$/.test(adjacent))) return null;
  if (/\bfrom\s+#\s?\d+\s+(?:in\s+[\w\s]+?\s+)?to\s+$/i.test(before)) return null;
  if (/\b(?:reviews?|satisfaction|sales|sold|service|clients?)\b[^.!?]*:\s*$/i.test(before) && /^\s*[.!]?\s*(?:$|[A-Z])/.test(after)) return null;
  if (/\b(?:units?|lots?|suites?|spots?|stalls?|lockers?|townhomes?)\s+(?:number\s+)?(?:is|was)\s+$/i.test(before) || /\bnumber(?:ing|s)?\b[^.]{0,30}\b(?:at|from)\s+$/i.test(before)) return 'numbered';
  // 1. Numbers: a route or a place in a plan, an address, a unit word right before.
  if (HASH1_NUMBERING_AFTER_RE.test(after) || HASH1_ADDRESS_RE.test(after)) return 'numbered';
  if (UNIT_ADJACENT_RE.test(before) && !/,\s*$/.test(before)) return 'numbered';
  // 2. A list noun numbers its list whatever follows ("Tip #1 for sellers"); "Without question #1" ranks.
  if (adjacent && STRONG_LABEL_RE.test(adjacent) && !/^without$/i.test(prevPrev)) return 'label';
  // 3. A rank context after it: "#1 in Milton", "#1 of 400 RE/MAX agents", "#1 for client care", "#1 agent".
  if (HASH1_RANKS_AFTER_RE.test(after) || inPlaceAfter()) return null;
  // 4. A ranking verb before it ranks even a series ("Ranked #1 or #2 in Halton"); then numbers with a
  //    comma and series ("The end unit, #1,", "Units #1 and #2", "Photo #1 of 32").
  if (adjacent && RANK_VERB_RE.test(adjacent)) return null;
  if (NUMBERED_RE.test(before) || HASH1_SERIES_RE.test(after)) return 'numbered';
  // 5. A rank before it: "Ranked #1", "Milton's #1", "Milton #1", "Number #1", "Client Satisfaction #1", "Rank: #1".
  if (adjacent && (RANK_BEFORE_RE.test(adjacent) || (/['’]s$/i.test(adjacent) && !/^(?:here|there|that|what|it|let|who|where)['’]s$/i.test(adjacent)) || /s['’]$/.test(adjacent) || KNOWN_PLACES.has(adjacent.toLowerCase()) || (CLAIM_LABEL_RE.test(adjacent) && !/^\s*:/.test(after)))) return null;
  if (/\b(?:rank|ranking|satisfaction|reviews?|volume|sales|service|score|rating)\s*:\s*$/i.test(before)) return null;
  // 6. Labels: another noun it numbers, a list item, one of several numbered items, a set, a back-reference.
  if (adjacent && /^(?:here['’]s|here|next|then|now|so)$/i.test(adjacent) && /^\s*:\s/.test(after)) return 'label';
  if (adjacent && /^[A-Za-z][a-z'’-]*$/.test(adjacent) && !FUNCTION_WORD_RE.test(adjacent) && !DETERMINER_RE.test(adjacent) && !/^(?:in|see|from|than|on|to|vs|after|before|like|by|at|with|of|for)$/i.test(adjacent)) return 'label';
  if (adjacent && /^[A-Z][A-Za-z'’-]*$/.test(adjacent) && !FUNCTION_WORD_RE.test(adjacent)) return 'label';
  const lineStart = /(?:^|[\n.!?:•·*(]\s*)$/.test(before);
  if (!adjacent && lineStart && (/^\s*[:.)–—-]\s/.test(after) || LABEL_IMPERATIVE_RE.test(after))) return 'label';
  if (/(?:^|[^\w])#\s?(?:[2-9]|\d{2})\b/.test(text.slice(Math.max(0, idx - 120), idx + len + 120).replace(text.slice(idx, idx + len), ''))) return 'label';
  if (/\b(?:of|among)\s+(?:the|these|those|our|your|its|their)\s+(?:\w+\s+){0,2}\w+s\s*,\s*$/i.test(before)) return 'label';
  if (adjacent && /^(?:in|see|from|than|on|to|vs|after|before|like|by|at)$/i.test(adjacent) && /^\s*(?:[,.;:)]|$)/.test(after)) return 'label';
  if (/\bfrom\s+$/i.test(before) && /^\s+(?:at|near|by)\b/i.test(after)) return 'label';
  return null;
}
// "#1" and "top producer" sit inside a company's name only when the name ends in a designator and the
// word after them is the company's business ("RE/MAX #1 Realty Inc.", "#1 Movers Ltd.", "Top Producer
// Realty Brokerage"); a brokerage brand after them makes them a title before the issuer ("Top Producer
// RE/MAX Ontario-Atlantic Canada Inc.", "Top Producer Revel Realty Inc." is a title too: fail closed).
const BRAND_RE = /^(?:RE\/?MAX|Century|Royal|Keller|Coldwell|Sotheby['’]?s|Sutton|HomeLife|iPro|eXp|Right|Cityscape|Revel|Zolo|Real\s+Broker)®?$/i;
const DESIGNATOR_TOKEN_RE = /^(?:Inc\.?|Ltd\.?|Limited|Corp\.?|Corporation|LLC|Brokerage|Realty)$/i;
const COMPANY_WORD_RE = /^(?:Realty|Real|Brokerage|Movers|Moving|Home|Homes|Inspections?|Choice|Properties|Property|Mortgages?|Construction|Renovations?|Cleaning|Plumbing|Roofing|Landscaping|Painting|Insurance|Law)$/i;
const AUDIT_FAIL_CLOSED_RE = /^(?:#\s?1|top[-\s‐‑]*produc)/i;
const BRAND_MULTI_RE = /\b(?:Real\s+Broker|Right\s+at\s+Home|Royal\s+LePage|Keller\s+Williams|Coldwell\s+Banker|Century\s+21)\b/i;
const GENERIC_CO_RE = /^(?:Real|Estate|Realty|Brokerage|Group|Team|Home|Homes|Property|Properties|Of|And|&)$/i;
const ISSUER_WORD_RE = /^(?:Ontario-Atlantic|Ontario|Atlantic|Canada|Integra|Central|Western|Eastern|Northern|Southern|Region|Regional|Head|Office)$/i;
const auditCompanyAt = (text, idx, len) => {
  if (/(?:RE\/?MAX|Century\s+21|Royal\s+LePage|Keller\s+Williams|Coldwell\s+Banker|Sutton|HomeLife|iPro|eXp|Revel)®?\s+(?:\d{4}\s+)?$/i.test(text.slice(Math.max(0, idx - 30), idx))) return false;
  const m = text.slice(idx + len, idx + len + 90).match(/^\s+((?:(?:[A-Z][\w'’&.-]*|&|and|of)\s+){1,6}?)(?:Inc|Ltd|Limited|Corp|LLC|Incorporated|Realty(?=\s*[.,;:]|\s*$))\b/);
  if (!m) return false;
  const words = m[1].trim().split(/\s+/);
  return words.some((w) => /^[A-Z]/.test(w) && !GENERIC_CO_RE.test(w) && !ISSUER_WORD_RE.test(w) && !KNOWN_PLACES.has(w.toLowerCase())) && !words.some((w) => BRAND_RE.test(w)) && !BRAND_MULTI_RE.test(m[1]) && !OWN_NAMES_RE.test(m[1]);
};

// Places the town knows, for a possessive ("Timberlea's only") and for a sentence in Title Case or
// capitals, where a capital letter says nothing.
function loadKnownPlaces() {
  const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
  const out = new Set(['halton region', 'town of milton', 'region of halton', 'southern ontario', 'west milton', 'east milton', 'glen williams', 'speyside', 'mountainview', 'milton', 'halton', 'ontario', 'canada', 'gta', 'toronto', 'mississauga', 'oakville', 'burlington', 'georgetown', 'halton hills', 'acton', 'campbellville', 'hamilton', 'brampton', 'guelph', 'old milton', 'downtown milton', 'north milton', 'south milton', 'hawthorne village', 'boyne', 'kelso', 'sherwood', 'bristol', 'moffat', 'brookville', 'milton education village']);
  for (const m of read('src/data/townNeighbourhoods.ts').matchAll(/"name":"([^"]+)"/g)) out.add(m[1].toLowerCase());
  for (const m of read('src/lib/geo.ts').matchAll(/"\d{4}\s*-\s*[A-Z]{2}\s+([^"]+)"\s*:/g)) out.add(m[1].trim().toLowerCase());
  return out;
}
export const KNOWN_PLACES = loadKnownPlaces();

// MA-011. The claim sense of "only", "leading" and "highest", as redrawn by two red-team rounds (2,968
// executed candidates, 758 confirmed breaks). On a real estate site an unanchored ranking of a service,
// a person or an outlet is the site's own; a ranking anchored to someone else is not. ANCHORS:
//   a third party's domain in the sentence (transit, schools, EQAO, Walk Score, heritage, hospitals,
//   insurance, inspection, builders, surveys ...) or a named third party (TRREB, Zoocasa, the Town,
//   Conservation Halton, Mattamy ...);
//   a third party's statement: a subject and a verb before the word ("Highway 401 is the leading
//   source"), an apposition to a name ("Mattamy Homes, a leading name"), a possessor ("The builder's
//   industry-leading warranty"), or examples after it ("websites such as Zoocasa"); a customer ("Every
//   listing gets", "You get"), a site product ("The Street Report is") or a pronoun is never a third party;
//   a data head: the word ranks a price, a share, a density, a frequency ("the highest sales count").
// "leading" is ordinary as a path ("the road leading to the 401") or a participle after its subject
// ("engineers leading the reconstruction"); "leading the market" with no subject is the site's. A
// rating ("highest-rated", "rated highest in Milton", "the highest of any Milton real estate website")
// fires unless anchored. Plural generics ("leading listing sites") rank others. "only" needs a mark
// of uniqueness ("the only", "Milton's only", "only one ... in Milton", "only here", a headline "Only
// X in Y"); without one it is the restriction sense ("only licensed agents can", "only local producers").
const SENSE_WORD_RE = /^(?:only|leading|highest)$/i;
const PERSON_RE = /^(?:agents?|realtors?|brokers?|brokerages?|salesperson|salespersons|salespeople|salesman|saleswoman|reps?|representatives?|registrants?|teams?|negotiators?|advis[oe]rs?|consultants?|experts?|specialists?|professionals?|agency|agencies|strategists?|marketers?|advocates?|realty|awards?|recognition|honou?rs?|achievements?|production)$/i;
const RE_PERSON_RE = /^(?:duo|family|producers?|producing|licensees?)$/i;
const AWARD_HOLDER_RE = /^(?:recipients?|winners?|inductees?|honou?rees?|members?)$/i;
const SERVICE_RE = /^(?:services?|marketing|representation|communication|expertise|care|exposure|negotiation|advice|guidance|results|satisfaction|experience|ratings?|reviews?|reputation|retention|referrals?|business|support|professionalism|standards?|attention|technology|tools|photography|video|program|package|solution|data|estimates?|accuracy|promoter)$/i;
const OUTLET_RE = /^(?:firms?|company|companies|offices?|providers?|sources?|resources?|destinations?|choice|names?|authority|voice|brand|network|partners?|practice|platforms?|sites?|websites?|portals?|guides?|blogs?|newsletters?|reports?|groups?|designations?|apps?|hubs?|databases?|podcasts?|magazines?|places?|index|tool|calculator|estimator|tracker|dashboard|map|search|channel|account)$/i;
const PERSON_CORE_RE = /^(?:agents?|realtors?|brokers?|brokerages?|salesperson|salespersons|salespeople|salesman|saleswoman|reps?|representatives?|registrants?|teams?|negotiators?|advis[oe]rs?|consultants?|experts?|specialists?|professionals?|agency|agencies|strategists?|marketers?|advocates?|realty|person|licensees?|sponsors?)$/i;
// real estate in the phrase itself, strictly (not "home care", not "the housing market" as a subject)
const RE_STRICT_RE = /\b(?:real[\s-]estate|realty|resale|re-sale|sold[\s-]prices?|sold\s+(?:data|history|records)|street[\s-]by[\s-]street|MLS|listings?|sellers?|buyers?|home[\s-]?(?:selling|buying|sales?|search|valuation|value)|pre-construction|condo\s+(?:service|resale|specialist|market|sales)|sold-price|homeowners?|street-level|every\s+(?:\w+\s+)?(?:sold|sale|street))\b/i;
const DATA_HEAD_RE = /^(?:prices?|sales?|sold|counts?|shares?|numbers?|percent(?:age)?s?|rates?|volumes?|demand|supply|inventory|activity|turnover|density|frequency|traffic|elevation|points?|peaks?|records?|range|spread|values?|appreciation|growth|returns?|rents?|yields?|incomes?|population|concentration|proportions?|ratios?|taxes|assessments?|days|months?|years?|quarters?|weeks?|bids?|offers?|temperatures?|snowfall|scores?|frontage|footage|ceilings?|storeys?|stories|levels?|costs?|fees?|charges?|premiums?|payments?|interest|bidding|share|stock|mix|amount|amounts|point|priority|risk|demand)$/i;
const COMPOUND_CLAIM_RE = /^(?:rated|ranked|reviewed|quality|accuracy|performing|producing|selling|grossing|earning|trusted|recommended)$/i;
const MODIFIES_RE = /^(?:sales?|offers?|deals?|prices?|dates?|conditions?|fees?|frequency|hours?|building|buildings|space|spaces|park|parks|tower|towers|uses?|units?|homes?|houses?|builders?|providers?|centres?|centers?|levels?|areas?|hubs?|staff|jobs?|numbers?|figures?|counts?|rates?|charges?|costs?|taxes|noise|rooms?|tables?|windows?|periods?|process|leverage|power|roads?|budgets?|pages?|facilit(?:y|ies)|plans?|schedules?|margins?|gaps?|buffer|cushion|tactics|strateg(?:y|ies)|skills|style|history|records?|trends?|program|programs|model|models|amount|years?)$/i;
const RE_QUALIFIER_RE = /\b(?:real[\s-]estate|realty|resale|re-sale|sold[\s-]prices?|sold\s+(?:data|history|records)|sales?\s+data|street[\s-]by[\s-]street|every\s+(?:\w+\s+)?street|MLS|listings?|sellers?|buyers?|home[\s-]?(?:selling|buying|sales?|search|valuation|value)|homes?|housing|market|property|properties|condos?|neighbourhoods?|relocation|pre-construction|sold|sales?|all\s+(?:\d+\s+)?(?:\w+\s+)?streets|each\s+of\s+(?:\w+['’]s\s+)?(?:\d+\s+)?streets|street-level|pricing|(?:one\s+)?street\s+at\s+a\s+time)\b/i;
const DOMAIN_CI_RE = /\b(?:transit|bus(?:es)?|trains?|snow(?:-clearing)?|plow(?:ing|s)?|hospitals?|emergency|medical|health\s*care|clinics?|dental|dentists?|veterinary|animal|daycares?|child\s*care|schools?|EQAO|Fraser|walk\s*score|transit\s*score|librar(?:y|ies)|recreation|arenas?|playgrounds?|hydro|electricity|utilit(?:y|ies)|internet|surveys?|heritage|gallantry|civilian|soccer|hockey|sports|flood(?:ing|plain)?|watershed|conservation|engineering|engineers?|transportation|staffing|credit\s+rating|insurance|insurers?|mortgages?|lenders?|warrant(?:y|ies)|builders?|developers?|(?<!pre-)construction|employers?|employment|logistics|warehouses?|distribution|food|dining|restaurants?|bistro|grocer(?:y|ies)|farmers?|forestry|by-?law|police|inspectors?|law\s+firms?|lawyers?|legal|asbestos|structural|(?<!web\s|site\s|online\s)traffic|weather|sun(?:light)?|southern|northern|registry|councill?ors?|council|government|provincial|federal|municipal|parks|trends?\s+data|noise|legion|gallantry|(?:home\s+)?(?:staging|inspection|moving|photography|cleaning|renovation)\s+(?:compan(?:y|ies)|firms?|providers?|services))\b/i;
const DOMAIN_CS_RE = /\b(?:GO|the\s+Town['’]s|Town\s+(?:staff|council|hall|survey|by-law)|TRREB|CREA|TRESA|Tarion|Teranet|CoreLogic|Zoocasa|HouseSigma|Zolo|Zillow|Redfin|Realtor\.ca|realtor\.ca|Mattamy|Conservation\s+Halton|Milton\s+Hydro|Canada\s+Post|Statistics\s+Canada|CMHC|Bank\s+of\s+Canada|Market\s+Watch|Walk\s+Score|Transit\s+Score|OEB|Bill\s+\d+|Metrolinx)\b/;
const NAMED_AFTER_RE = /\b(?:such\s+as|like|including|from|per|according\s+to)\s+(?!Aamir|Miltonly|RE\/MAX|our\b|us\b|me\b)[A-Z]|\(\s*[A-Z]{2,}/;
const CUSTOMER_SUBJ_RE = /^(?:you|your\b.*|every\b.*|each\b.*|all\b.*|(?:the|this|our)\s+(?:site|website|guide|report|page|platform|app|street\s+report|newsletter|index|map|tool)|(?:home\s+|milton\s+)?(?:sellers?|buyers?|clients?|customers?|homeowners?|families|readers|users|visitors|listings?|home\s+sellers?)|it|this|that|these|those|there|here|which|who|what|we|they|over\s+.*)$/i;
const NP_STOP_RE = /^(?:to|of|in|on|at|for|with|by|from|into|over|under|near|across|along|through|about|after|before|since|until|during|within|without|except|besides|between|beyond|toward|towards|against|around|via|per|upon|onto|that|which|who|whom|whose|when|where|while|if|than|as|but|nor|so|because|is|are|was|were|be|been|being|am|can|will|would|could|should|may|might|must|has|have|had|do|does|did|the|a|an|this|these|those|it|its|they|their|we|our|you|your|he|his|she|her|there|here|all|both|each|also|still|often|usually|typically|such|like|including)$/i;
const NP_OF_RE = /^(?:level|levels|standard|standards|quality|degree|calibre|caliber|kind|sort|type|tier|tiers)$/i;
const COUNT_WORD_RE = /^(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|a|few|several|some|handful|couple|dozen|fraction|half|limited)$/i;
const COUNT_UNIT_RE = /^(?:bed(?:room)?s?|bath(?:room)?s?|car|storey|story|level|acre|foot|ft|metre|meter|m|sq|star|time|percent|per|%|x|day|bay|season|unit|year|yr|door|piece|stor(?:e|ey)|garage)\b/i;
const NON_PLACE_RE = /^(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Q[1-4]|H[12]|Spring|Summer|Fall|Autumn|Winter|MLS|TRREB|PropTx|Buyer|Buyers|Seller|Sellers|Owner|Owners|Tenant|Tenants|Landlord|Landlords|Family|Street|Home|House|Building|Condo|Unit|Market|Today|Tonight|Tomorrow|Yesterday|Day|Night|Week|Month|Year|There|Here|That|It|What|Who|Where|This|He|She|They|We|You|Let|One|Everyone|Everybody|Nobody|Somebody|Schedule|Appendix|Section|Part|Chapter|Article|Table|Figure|Exhibit|Plan|Phase|Block|Lot|Bill|Act|French|English|Spanish|Mandarin|Punjabi|Urdu|Arabic|Tagalog)$/i;
const PLACE_WORD_RE = /^(?:town|city|region|area|neighbourhood|neighborhood|community|province|country|GTA|county|district|subdivision)$/i;
const PLACE_SKIP_RE = /^(?:and|or|around|all|of|the|greater|near|wider|whole|entire|broader|central|downtown|surrounding|nearby|this|our|your|heart|sought-after|north|south|east|west|northern|southern|eastern|western|new|old)$/i;
const THE_ONLY_RE = /\bthe\s+(?:(?:very|one|first|single|sole)\s*[-,]?\s*\(?\s*(?:and|&)?\s*-?\s*)?$/i;
const POSS_ONLY_RE = /(?:^|[^\w'’])((?:the\s+)?[A-Za-z][\w.-]*(?:\s+[A-Z][\w.-]*)?)(?:['’]s|(?<=s)['’])\s+(?:(?:first|one|very|single|sole)\s*,?\s*\(?\s*(?:and\s+)?)?$/i;
const FRAME_BEFORE_RE = /\b(?:publishes|published|publish|releases|released|tracks|tracked|peaked|peaks|peak|climbed|rose|reached|hit|fell|is|are|was|were|be|been|being|has|have|had|get|gets|got|remains?|remained|became|becomes|become|include[sd]?|including|offers?|offered|provides?|provided|holds?|held|contains?|carr(?:y|ies|ied)|runs?|ran|sees?|saw|receives?|received|enjoys?|serves?|served|gives?|gave|posts?|posted|brings?|brought|earned|earns|draws?)\b/gi;
const COMPARISON_RE = /\b(?:of|among)\s+(?:any|all|every)\s+(?:[\w'’-]+\s+){0,4}?(?:agents?|realtors?|brokers?|brokerages?|offices?|teams?|sites?|websites?|reps?|salespe\w+|firms?|companies)\b/i;
const titleMode = (s) => { const w = s.match(/\b[A-Za-z][A-Za-z'’-]{2,}\b/g) || []; return w.length >= 4 && w.filter((x) => /^[A-Z]/.test(x)).length / w.length >= 0.6; };
// A place in the next words: a place word, a known place, or (outside Title Case) a capitalised word
// that is not a month, a language, an act or an acronym; up to four modifiers may stand before it.
function placeAt(s, title = false) {
  const rawWords = s.trim().split(/\s+/).slice(0, 7);
  const end = rawWords.findIndex((w) => /[,;:!?)]$/.test(w));
  const words = (end >= 0 ? rawWords.slice(0, end + 1) : rawWords).map((w) => w.replace(/[,.;:!?)]+$/, ''));
  for (let i = 0, skipped = 0; i < words.length && skipped <= 3; i++) {
    const w = words[i].replace(/['’]s$/, '');
    if (!w) break;
    if (PLACE_WORD_RE.test(w)) return true;
    const two = `${w} ${(words[i + 1] || '').replace(/['’]s$/, '')}`.toLowerCase();
    if (KNOWN_PLACES.has(w.toLowerCase()) || KNOWN_PLACES.has(two)) return true;
    if (!title && /^[A-Z][a-z]/.test(w) && !NON_PLACE_RE.test(w)) return true;
    if (PLACE_SKIP_RE.test(w) || /^[a-z][\w-]*$/.test(w)) { skipped++; continue; }
    break;
  }
  return false;
}
// The subject of a verb before the word, in its clause, when it is a third party.
// A person word after another trade is that trade's ("the leading design team", "leading insurance agents").
const PERSON_TRADE_RE = /^(?:listing|leasing|buyer['’]s|buyers['’]?|seller['’]s|co-operating|insurance|mortgage|tax|financial|legal|design|engineering|transportation|staffing|medical|health|hockey|soccer|sports|youth|forestry|by-law|bylaw|enforcement|construction|building|property|management|inspection|credit|school|board|travel|moving|staging|marketing|software|tech|advertising)$/i;
const CUSTOMER_CORE_RE = /^(?:proud|happy|glad|honoured|honored|excited|you|you['’](?:ll|re|ve|d)|your|every|each|all|sellers?|buyers?|clients?|customers?|homeowners?|families|readers|users|visitors|listings?|downsizers|upsizers|investors|renters|homes|relocating|newcomers|it|this|that|we|they|he|she|i|site|website|guide|report|page|platform|app|newsletter|index|map|tool|our)$/i;
const CUSTOMER_MOD_RE = /^(?:home|milton|halton|local|and|or|&|both|over|\d[\d,]*\+?|the|new|first-time|young|many|most|repeat|happy|past)$/i;
function thirdPartySubject(beforeInSentence) {
  const clause = beforeInSentence.split(/(?<!\d),(?!\d)|[;:—–(]/).pop();
  const rankSubj = clause.match(/^\s*(.+?)\s+(?:ranks|ranked|rates|rated|scores|scored|places|placed|comes|came|finishes|finished)\s+(?:\w+\s+)?$/i);
  if (rankSubj && (KNOWN_PLACES.has(rankSubj[1].toLowerCase()) || (rankSubj[1].match(/\b[A-Z][\w.'’-]*/g) || []).filter((w, i) => !(i === 0 && rankSubj[1].trim().startsWith(w)) && !KNOWN_PLACES.has(w.toLowerCase()) && !/^(?:The|A|An|Our|Your|Service|Client|Customer|Seller|Five-Star|Satisfaction)$/.test(w)).length >= 1) && !OWN_NAMES_RE.test(rankSubj[1]) && !/\b(?:service|satisfaction|care|sellers?|clients?|customers?)\b/i.test(rankSubj[1])) return true;
  let m, last = null; FRAME_BEFORE_RE.lastIndex = 0; while ((m = FRAME_BEFORE_RE.exec(clause))) last = m;
  if (!last) return false;
  const subj = clause.slice(0, last.index).trim().replace(/^(?:and|but|so|then|now|yes|no)\s+/i, '');
  if (/\b(?:it|us|them|this|him)\s+(?:the\s+|a\s+)?(?:[\w'’-]+\s+){0,2}$/i.test(clause.slice(last.index + last[0].length))) return false;
  if (/\b(?:made|named|called|voted|crowned|chosen|picked)\b/i.test(clause) && /\b(?:it|us|them|this)\b/i.test(clause.slice(last.index))) return false;
  if (!subj || CUSTOMER_SUBJ_RE.test(subj) || SITE_PRODUCT_RE.test(subj)) return false;
  const sw = subj.split(/\s+/);
  if (sw.slice(0, 3).some((w) => CUSTOMER_CORE_RE.test(w)) && !sw.some((w) => /^[A-Z]/.test(w) && !KNOWN_PLACES.has(w.toLowerCase()) && w !== sw[0])) return false;
  if ((sw.every((w) => CUSTOMER_CORE_RE.test(w) || CUSTOMER_MOD_RE.test(w)) && sw.some((w) => CUSTOMER_CORE_RE.test(w))) || /^(?:it|this|that|we|they|you|you['’](?:ll|re|ve|d))$/i.test(sw[sw.length - 1])) return false;
  return true;
}
const SOURCE_CUE_RE = /\b(?:per|according\s+to|on|through|via|from|by|in|with|across)\s+(?:the\s+)?$|\(\s*$|,\s*$/i;
// A domain or third-party name anchors the ranking when it sits in the ranked phrase, before the word
// (a subject, a possessor), or after it in a sentence whose phrase is not about real estate; a source or
// a channel ("per TRREB", "on Google Maps", "(TRREB, 2025)", "for GO commuters") anchors nothing.
function domainAnchors(sentence, before, rest, npText, reNp) {
  const ci = new RegExp(DOMAIN_CI_RE.source, 'gi'); const cs = new RegExp(DOMAIN_CS_RE.source, 'g');
  if (ci.test(npText) || (cs.lastIndex = 0, cs.test(npText))) return true;
  const hits = (text) => [...text.matchAll(new RegExp(DOMAIN_CI_RE.source, 'gi')), ...text.matchAll(new RegExp(DOMAIN_CS_RE.source, 'g'))];
  const AUDIENCE = /\bfor\s+(?:[\w'’-]+\s+){0,2}$/i; const audienceWord = (t, i) => /^\s*(?:[\w'’-]+\s+){0,2}?(?:commuters?|buyers|sellers|families|homeowners|clients|downsizers|investors|renters|newcomers|parents|riders)\b/i.test(t.slice(i));
  for (const m of hits(before)) { const pre = before.slice(0, m.index); if (!SOURCE_CUE_RE.test(pre) && !(AUDIENCE.test(pre) && audienceWord(before, m.index))) return true; }
  if (reNp) return false;
  for (const m of hits(rest)) { const pre = rest.slice(0, m.index); if (!/\b(?:per|according\s+to|on|through|via)\s+(?:the\s+)?$|\(\s*$/i.test(pre) && !/\b(?:per|according\s+to|on|through|via|from)\s+[^.;]{0,40}(?:,|\band)\s+$/i.test(pre) && !(AUDIENCE.test(pre) && audienceWord(rest, m.index))) return true; }
  return false;
}
function anchored(sentence, before, rest, afterNp, npText = '', reNp = false, o = {}) {
  if (domainAnchors(sentence, before, rest, npText, reNp)) return true;
  // an appositive name right after the phrase ranks that name ("the only public listings portal, Realtor.ca")
  if (o.npEndsComma && /^(?!Aamir|Miltonly|RE\/MAX)(?:[A-Z][\w.&'’-]*|[\w-]+\.(?:ca|com))/.test(afterNp)) return true;
  // a publisher of the ranked report ("the leading report on GTA housing, from TRREB")
  if (o.outletHead && /\b(?:from|by|published\s+by)\s+(?:the\s+)?(?:TRREB|CREA|Teranet|CoreLogic|Statistics\s+Canada|CMHC|Halton\s+Region|the\s+Town|[A-Z]{3,})\b/.test(rest)) return true;
  const colon = sentence.indexOf(':');
  if (colon >= 0) {
    const label = sentence.slice(0, colon).trim(); const answer = sentence.slice(colon + 1).trim();
    const at = sentence.indexOf(before) + before.length;
    // a colon answer that names a place, a housing type or a third party ranks it, not us
    if (colon > at && !/^\d/.test(answer) && ((/^(?!Aamir|Miltonly|RE\/MAX|Our\b|We\b|This\b|The\s+one\b)[A-Z][\w'’.-]+/.test(answer)) || /^(?:a|an|the)?\s*(?:freehold|condos?|condo\s+apartments?|townhomes?|townhouses?|detached|semis?|semi-detached|bungalows?|older|move-up|first-time)\b/i.test(answer))) return true;
    if (colon < at && !o.reNpHead && (KNOWN_PLACES.has(label.toLowerCase()) || /^(?:freehold|condos?|townhomes?|townhouses?|detached|semis?|semi-detached|bungalows?)\b/i.test(label))) return true;
  }
  for (const m of rest.matchAll(new RegExp(NAMED_AFTER_RE.source, 'g'))) { const name = rest.slice(m.index + m[0].length - 1).match(/^[\w.&'’-]+/)?.[0] || ''; if (KNOWN_PLACES.has(name.replace(/['’]s$/, '').toLowerCase())) continue; if (/^(?:such|like|including)/i.test(m[0].trim())) { if (m.index <= (rest.length - afterNp.length) + 3 && !/^\s*[\w.&'’-]+(?:\s+[A-Z][\w.&'’-]*)?\s+(?:says|said|reports|notes)\b/.test(rest.slice(m.index + m[0].length - 1))) return true; continue; } if (!/^(?:from|per|according)/i.test(m[0].trim()) && !reNp) return true; }
  if (/^,\s+(?!Aamir|Miltonly|RE\/MAX)(?:[A-Z][\w.&'’-]*|[\w-]+\.(?:ca|com))/.test(afterNp.replace(/^[^,]*/, (x) => (x.length < 40 ? '' : x)))) return true;
  if (/^\s*source\s*:/i.test(sentence)) return true;
  if (/\b(?:is|are|was|were)\s+(?:first-time|move-up|young|local|out-of-town|investors?|families|buyers|sellers|condos?|townhomes?|townhouses?|detached|semis?|semi-detached|freehold|bungalows?)\b/i.test(afterNp)) return true;
  // a copula whose complement names something else: "the only pricing guide is the neighbourhood figure",
  // "the only professional who can confirm a lot line is an Ontario Land Surveyor"
  // (read up to the first comma, so "..., whatever your home is worth" is not an answer; a verb other than
  // the copula counts only as the phrase's own verb, not inside "that covers every street")
  const main = o.npEndsComma || /^(?:no\s+matter|which|whatever|whether|what|wherever|however)\b/i.test(afterNp) ? '' : afterNp.split(/,/)[0];
  const cop = main.match(/^(?:[\w'’$.%-]+\s+){0,10}?(?:is|are|was|were|remains?|comes?\s+from|came\s+from|belongs?\s+to|goes\s+to|went\s+to|will\s+be|would\s+be)\s+(?:usually\s+|typically\s+|often\s+|always\s+|generally\s+|now\s+)?(.{0,60})/i)
    || (!/^(?:that|which|who)\b/i.test(main) ? main.match(/^(?:[\w'’$.%-]+\s+){0,8}?(?:covers?|covered|requires?|asks?|runs?|ran)\s+(.{0,60})/i) : null);
  const nounAnswer = cop && /^(?:the|a|an|its|their|his|her|one|two|three|\d|[A-Z])/.test(cop[1]);
  if (cop && (!o.reNpHead || nounAnswer) && !/^(?:free|open|available|standard|included|updated|built|designed|dedicated|unique|here|live|online|now|yours|the\s+best|second\s+to\s+none|unmatched|trusted)\b/i.test(cop[1]) && !/^(?:Aamir|Miltonly|RE\/MAX|ours|this\s+one|The\s+Street\s+Report|Street\s+Watch|our\b|us\b|here\b)/i.test(cop[1]) && !SITE_PRODUCT_RE.test(cop[1].slice(0, 30))) return true;
  if (/^(?:all\s+|both\s+)?(?:say|says|said|agree|agrees|recommend|recommends)\b/i.test(afterNp.replace(/^(?:in|on|at|for|of)\s+[\w\s'’-]*?(?=\b(?:all|say|says|said|agree|recommend)\b)/i, ''))) return true;
  // an apposition to a proper name ("Mattamy Homes, a leading name"; "realtor.ca, the leading portal")
  const ap = before.match(/(?:^|[\s,;:])((?:[A-Z][\w.&'’-]*\s+){0,3}[A-Z][\w.&'’-]*|[\w-]+\.(?:ca|com|org|net)),\s+(?:(?:a|an|the|one\s+of\s+the)\s+)?(?:[\w'’-]+\s+){0,3}$/);
  if (ap) {
    const np = ap[1].trim();
    const proper = /^(?:[A-Z][\w.&'’-]*\s+){1,4}[A-Z][\w.&'’-]*$/.test(np) || /^[\w-]+\.(?:ca|com|org|net)\b/i.test(np) || DOMAIN_CS_RE.test(np);
    if (proper && !o.standing && !KNOWN_PLACES.has(np.toLowerCase()) && !/^(?:In|At|On|For|From|Across|Around|Near|With|By|Of|To|Since|After|Before|During|Throughout|Within|Here|There|Today|Now|Then|Yes|No|Serving|Proudly|Rated|Voted|Ranked|Local|Officially)\b/.test(np) && !SITE_PRODUCT_RE.test(np) && !CUSTOMER_CORE_RE.test(np.split(/\s+/)[0]) && !/\b(?:is|are|was|were|has|have)\b/.test(np)) return true;
  }
  // a third party's possessive before the word ("The builder's industry-leading warranty")
  const poss = before.match(/(?:^|\s)((?:the\s+)?[\w-]+)['’]s?\s+(?:[\w-]+[-‐‑])?$/i);
  if (poss && !/^(?:there|here|that|it|what|who|where|let|he|she|world|industry|market|country|nation|sector|region|province|city|town|area|neighbourhood|community|street|court|crescent|family|families|today|year)$/i.test(poss[1].replace(/^the\s+/i, '')) && !KNOWN_PLACES.has(poss[1].replace(/^the\s+/i, '').toLowerCase()) && !PLACE_WORD_RE.test(poss[1].replace(/^the\s+/i, '')) && !/^(?:our|my|your|his|her|their|its|sellers|buyers|clients|homeowners|customers|families)$/i.test(poss[1].replace(/^the\s+/i, ''))) return true;
  return thirdPartySubject(before);
}
function claimSense(text, idx, len, sa, se) {
  const word = text.slice(idx, idx + len).toLowerCase();
  const raw = text.slice(idx + len, se + 1).replace(/^\s*\)/, '');
  const rest = raw.replace(/\(([^)]{0,60})\)/g, '$1').split(/\.(?=\s|$)|[;:!?\n—–]/)[0];
  const toks = rest.split(/\s+/).filter(Boolean);
  const words = toks.map((w) => w.replace(/^[^\w#]+|[^\w®]+$/g, '').replace(/['’]s$/i, ''));
  const before = text.slice(sa, idx);
  const sentence = text.slice(sa, se + 1);
  const title = titleMode(sentence);
  // The noun phrase the word opens: up to twelve words, through "and"/"or" and "level of", stopping at a
  // preposition, a verb of being or a determiner. A hyphenated hit ("highest-rated") reads its compound.
  const compound = (text.slice(idx + len).match(/^[-‐‑]([A-Za-z]+)/) || [])[1] || '';
  const np = []; let k = 0;
  for (; k < words.length && np.length < 12; k++) {
    const w = words[k];
    if (NP_OF_RE.test(w) && /^of$/i.test(words[k + 1] || '')) { k++; continue; }
    if (/^(?:and|or|&)$/i.test(w) && np.length) continue;
    if (!w || NP_STOP_RE.test(w)) break;
    np.push(w);
    if (/,$/.test(toks[k]) && (/^(?:[A-Z]|[\w-]+\.(?:ca|com)\b)/.test(toks[k + 1] || '') || /^(?:no|which|whatever|whether|who|that|so|because|as|while|when|if|and|but|or|for|with|from|whatever)$/i.test(toks[k + 1] || ''))) { k++; break; }
  }
  if (compound && np[0] && np[0].toLowerCase() === compound.toLowerCase()) np.shift();
  const afterNp = toks.slice(k).join(' ');
  const heads = np.map((w, i) => ({ w: w.split(/[-‐‑/]/).pop().replace(/®$/, ''), next: np[i + 1] || '', prev: np[i - 1] || '' }));
  const has = (re) => heads.some(({ w, next, prev }) => re.test(w) && !MODIFIES_RE.test(next) && !(re === SERVICE_RE && (OUTLET_RE.test(next) || PERSON_RE.test(next))) && !(/^production$/i.test(w) && /^(?:housing|home|homes|new-home|construction|film|oil|food|crop)$/i.test(prev)) && !((re === PERSON_RE || re === PERSON_CORE_RE) && PERSON_TRADE_RE.test(prev)) && !(re === OUTLET_RE && /^(?:listing|leasing|buyer['’]s|buyers['’]?|seller['’]s|co-operating)$/i.test(prev)));
  const tradePerson = heads.some(({ w, next, prev }) => PERSON_RE.test(w) && !MODIFIES_RE.test(next) && PERSON_TRADE_RE.test(prev));
  const targets = heads.filter(({ w, next }) => (PERSON_RE.test(w) || OUTLET_RE.test(w)) && !MODIFIES_RE.test(next));
  const hasAwardHolder = heads.some(({ w, prev }) => AWARD_HOLDER_RE.test(w) && /^(?:[A-Z][\w-]*|award|club|circle|society)$/i.test(prev));
  const head = heads.length ? heads[heads.length - 1].w : '';
  const isPlural = (w) => /[a-z]s$/.test(w) && !/(?:ss|us|is)$/.test(w);
  const plural = !/\bone\s+of\s+(?:the\s+)?(?:[\w'’-]+\s+)?$/i.test(before) && (targets.length ? targets.every(({ w }) => isPlural(w)) : isPlural(head));
  const npText = np.join(' ');
  const headEnd = heads.findIndex(({ w }) => PERSON_RE.test(w) || OUTLET_RE.test(w) || SERVICE_RE.test(w));
  const npHeadText = headEnd >= 0 ? np.slice(0, headEnd + 1).join(' ') : npText;
  const reNp = RE_STRICT_RE.test(`${npText} ${rest.slice(0, 70)}`) || has(PERSON_CORE_RE);
  const reCtx = RE_QUALIFIER_RE.test(`${before.slice(-50)} ${npText} ${rest}`) || /\bhomeowners?\b/i.test(before.slice(-50));
  const reNpHead = RE_STRICT_RE.test(npHeadText) || has(PERSON_CORE_RE);
  const outletHead = has(OUTLET_RE) && !has(PERSON_CORE_RE);
  const standing = heads.some(({ w }) => /^(?:awards?|recognition|honou?rs?|achievements?|production)$/i.test(w));
  const anchor = () => anchored(sentence, before, rest, afterNp, npHeadText, reNp, { reNpHead, outletHead, standing, npEndsComma: np.length > 0 && /,$/.test(toks[k - 1] || '') });
  const rePerson = heads.some(({ w }) => RE_PERSON_RE.test(w)) && (RE_STRICT_RE.test(`${npText} ${rest.slice(0, 70)}`) || /\b(?:top|high|sales|real\s+estate)[-\s]+produc/i.test(`${before} ${npText}`));

  if (word === 'only') {
    // A count after "only" is the quantity sense ("only two agents", "only a handful"); a year, a
    // number of bedrooms or a percentage counts nothing, and "only one" is uniqueness.
    const f = (toks[0] || '').replace(/[,;:]+$/, '');
    if ((COUNT_WORD_RE.test(f) && !COUNT_UNIT_RE.test(toks[1] || '')) || (/^\d[\d,.]*$/.test(f) && !/^(?:19|20)\d{2}$/.test(f) && !COUNT_UNIT_RE.test(toks[1] || ''))) return false;
    const onlyOne = /^one$/i.test(f) && (/(?:^|[.!?]\s*|\b(?:there['’]s|there\s+is|has|have)\s+)$/i.test(before) || !/\b(?:use|uses|used|visit|visits|check|checks|need|needs|read|reads|want|wants|get|gets|receive|receives|interview|interviews|sign|with|hire|hires|call|calls)\s+$/i.test(before));
    const theOnly = THE_ONLY_RE.test(before);
    const poss = before.match(POSS_ONLY_RE);
    const possName = poss ? poss[1].replace(/^the\s+/i, '') : '';
    const possPlace = !!poss && (KNOWN_PLACES.has(possName.toLowerCase()) || KNOWN_PLACES.has(possName.split(/\s+/).pop().toLowerCase()) || PLACE_WORD_RE.test(possName));
    const headline = /^\s*$/.test(before) && /^[A-Z]/.test(text.slice(idx, idx + 1)) && !/\b(?:is|are|was|were|can|will|may|must|should)\b/i.test(sentence) && (!/[.!?]\s*$/.test(sentence) || title);
    const context = text.slice(Math.max(0, sa - 160), se + 1);
    const here = (/^\s*(?:here\s*(?:[.!:]|$)|on\s+(?:this\s+site|Miltonly)|at\s+Miltonly)/i.test(raw) || (/\b(?:find|get|see)\b/i.test(rest) && /\bhere\s*$/i.test(rest.trim().replace(/[.!]$/, '')))) && RE_QUALIFIER_RE.test(context);
    const selfRef = /\b(?:this one|the one you['’]re reading|you are reading it|you['’]re reading it|you['’]re on it)\b/i.test(sentence);
    const onlyThis = /^(?:this|our)$/i.test(f) && (OUTLET_RE.test((toks[1] || '').replace(/[^\w]/g, '')) || PERSON_CORE_RE.test((toks[1] || '').replace(/[^\w]/g, '')));
    if (onlyThis || (selfRef && /\b(?:one|guide|site|office|agent|realtor|team)\b/i.test(sentence) && RE_QUALIFIER_RE.test(sentence))) return true;
    if (theOnly && /^\s*one\s*[.!]?\s*$/i.test(rest) && RE_QUALIFIER_RE.test(sentence) && /\b(?:site|guide|agent|realtor|office|team|brokerage|platform)\b/i.test(sentence)) return true;
    if (!(theOnly || possPlace || poss || onlyOne || headline || here)) return false;
    if (/\?\s*$/.test(sentence.trim()) || /\?/.test(sentence.slice(0, sentence.indexOf(before) + before.length + 80))) { if (!here) return false; }
    if (here || possPlace) return true;
    // the place shape: "the only ... in <place>", "In Timberlea, this is the only ...", "Milton has only one ..."
    const clauseRest = rest.replace(/^[\s,]+/, '').split(/,\s+(?=(?:and|but|so|which|who|while|where|because|it|this|that|they|we|he|she|still)\b)|\b(?:which|while|where|because)\b/)[0];
    const placeIn = [...clauseRest.matchAll(/\b(?:in|within|across|throughout)\s+/gi)].some((m) => placeAt(clauseRest.slice(m.index + m[0].length), title))
      || (/^\s*(?:in|within|across)\s+/i.test(sentence) && placeAt(sentence.replace(/^\s*(?:in|within|across)\s+/i, ''), title) && /,/.test(before))
      || (/^\s*of\s+(?:all\s+)?(?:the\s+)?[^,]*\bin\s+/i.test(sentence) && placeAt(sentence.replace(/^\s*of\s+[^,]*?\bin\s+/i, ''), title) && /,/.test(before));
    const placeSubject = onlyOne && placeAt(before.replace(/\s+(?:has|have|had)\s+$/i, ''), title) && /\b(?:has|have|had)\s+$/i.test(before);
    if ((theOnly || onlyOne || headline) && (placeIn || placeSubject)) return true;
    if (anchor()) return false;
    if (plural && !/^one$/i.test(f) && !has(SERVICE_RE)) return false;
    if (/,\s+(?:the|a|an)\s+[a-z0-9]/.test(rest) && !reNp) return false;
    const oneThat = /^one$/i.test(f) && (/^who\b/i.test(toks[1] || '') && !/^who\s+can\b/i.test(`${toks[1]} ${toks[2] || ''}`) || /^that\s+(?:publishes|covers|tracks|maps|shows|lists|prices|posts)\b/i.test(`${toks[1] || ''} ${toks[2] || ''}`));
    if (has(PERSON_CORE_RE) || rePerson || hasAwardHolder || (has(PERSON_RE) && !anchor()) || (has(OUTLET_RE) && RE_QUALIFIER_RE.test(`${np.join(' ')} ${rest}`)) || (has(SERVICE_RE) && RE_QUALIFIER_RE.test(`${np.join(' ')} ${rest}`)) || (oneThat && RE_QUALIFIER_RE.test(rest))) return true;
    return false;
    return false;
  }

  // "leading" and "highest".
  if (word === 'leading') {
    // a path: "the road leading to the 401", "leading into winter"
    if (/^\s+(?:to|into|up|off|out|toward|towards|onto|away|down|back|through|from|in\s+to)\b/i.test(raw) && !/^\s+in\s+(?:client|customer|seller|buyer|home|sales|listings)/i.test(raw)) return false;
    if (/^\s+edge\s+of\b/i.test(raw)) return false;
    const prevTok = (before.match(/([A-Za-z][\w'’-]*)[ \t]*$/) || [])[1] || '';
    const clauseStart = /(?:^|[,;:.!?|·•\n—–(]\s*)$/.test(before) || /^(?:proudly|consistently|still|always|now|currently|and|are|is|were|was|been)$/i.test(prevTok);
    const marketFirst = /^\s+(?:the\s+(?:[A-Z][\w'’-]*\s+)?(?:resale\s+|real\s+estate\s+|local\s+|housing\s+)?(?:market|way|pack|industry|field|charge)|(?:Milton|Halton|the\s+GTA)\b|across\s+(?:Milton|Halton))/i.test(raw);
    if (marketFirst && !clauseStart && !before.split(/\s+/).some((w, i) => /^[A-Z]/.test(w) && i > 0 && !KNOWN_PLACES.has(w.replace(/['’]s$|[,.]$/g, '').toLowerCase()) && !/^(?:Milton|Halton|Proud|Twelve|Ten|Once|The|Local)$/.test(w)) && !/\b(?:engineers|residents|crews|councillor|staff)\b/i.test(before)) return !anchor();
    // a participle after its subject: "Engineers leading the reconstruction", "one leading the other"
    if (!clauseStart && prevTok && !DETERMINER_RE.test(prevTok) && !POSSESSIVE_RE.test(prevTok) && !/[-‐‑]$/.test(before) && !/ly$/i.test(prevTok) && /^\s+(?:the|a|an|this|that|these|its|their|his|her)\b/i.test(raw)) return false;
    // "Leading the Milton market", "Leading Milton real estate since 2010", "Leading.": the site's, unless anchored
    const verbUse = clauseStart && (/^\s*(?:[.!]|$)/.test(raw) || /^\s+(?:the\s+)?(?:[\w'’-]+\s+){0,3}(?:market|industry|pack|way|field|charts|region|area|resale|sales|real\s+estate|homes|in\s+)(?!\s*(?:websites?|sites?|agents?|teams?|brokerages?|firms?|compan(?:y|ies)|platforms?|guides?|services?|portals?|offices?|reports?|data))/i.test(raw) || /^\s+(?:[A-Z][\w'’-]*|in\s|across\s|throughout\s)/.test(raw));
    const marketObject = /^\s+(?:the\s+(?:[A-Z][\w'’-]*\s+)?(?:resale\s+|real\s+estate\s+|local\s+|housing\s+)?(?:market|way|pack|industry|field|charge)|(?:Milton|Halton|the\s+GTA)\b|across\s+(?:Milton|Halton))/i.test(raw);
    if (!verbUse && marketObject && !before.split(/\s+/).some((w, i, all) => /^[A-Z]/.test(w) && i > 0 && !KNOWN_PLACES.has(w.replace(/['’]s$|[,.]$/g, '').toLowerCase()) && !/^(?:Milton|Halton|Proud|Twelve|Ten|Once|The|Local)$/.test(w))) return !anchor();
    if (verbUse) {
      // "Leading the pack, Walker posted the strongest results": the subject after the phrase leads
      const c = raw.indexOf(',');
      if (c >= 0 && c < rest.length && /^(?!Aamir|Miltonly|We\b|Our\b)[A-Z][\w'’-]*\s+[a-z]+/.test(raw.slice(c + 1).trim())) return false;
      return !anchor();
    }
  }
  // A rating: "highest-rated", "rated highest in Milton", "the highest of any Milton real estate website"
  const rating = COMPOUND_CLAIM_RE.test(compound) || /^(?:rated|ranked|reviewed)$/i.test(np[0] || '') || /\b(?:rated|ranked|reviewed|voted|scored|rank|ranks|rates),?\s+(?:(?:it|them|among|as|the|very|consistently)\s+){0,3}$/i.test(before);
  const cmp = rest.match(COMPARISON_RE);
  if (cmp && (RE_STRICT_RE.test(`${cmp[0]} ${npText}`) || /\b(?:agents?|realtors?|brokers?|brokerages?|teams?|reps?|salespe\w+)\b/i.test(cmp[0])) && !domainAnchors(sentence, before, '', npHeadText, true)) return true;
  if (rating && !has(DATA_HEAD_RE) && !anchored(sentence, before, '', afterNp, npHeadText, true)) return true;
  if (compound && !COMPOUND_CLAIM_RE.test(compound) && !(RE_STRICT_RE.test(npText) && has(OUTLET_RE))) {
    // "highest-priced", "highest-density": the compound ranks its attribute
    if (DATA_HEAD_RE.test(compound) || /^(?:priced|frequency|density|priority|valued|value|traffic)$/i.test(compound)) return false;
  }
  const industry = /(?:industry|market|sector|category|world)[-‐‑\s]$/i.test(before);
  if (anchor() || tradePerson) return false;
  if (plural && !industry && !has(SERVICE_RE)) return false;
  if (!np.length) {
    // predicate position with no phrase: the ranked thing sits elsewhere in the sentence
    const inSentence = (sentence.match(/[A-Za-z][\w-]*/g) || []).some((t) => { const p = t.split('-').pop(); return PERSON_RE.test(p) || SERVICE_RE.test(p); }) || /\b(?:clients?|customers?|HomeStars|reviews?|Google\s+(?:reviews?|rating|stars))\b/i.test(sentence);
    return /^\s*(?:[.!]|$)/.test(raw) && word === 'leading' ? true : inSentence;
  }
  // a claim ranks the registrant, the site, a brokerage, an agent or a team, or their service; any other
  // head (a cause, an indicator, a floor, a trade, a brand) is ordinary (red team 3: the fail-closed
  // default fired on 263 lines of the site's own prose)
  return industry || has(PERSON_RE) || rePerson || hasAwardHolder || has(SERVICE_RE) || (has(OUTLET_RE) && reCtx);
}

// "only" after the word it restricts, closing its phrase ("Miltonly emails only, from Aamir Yaqoob", the
// CASL line on every page; "residents only."; "for general information only and"): a restriction, never
// a rank, so a free idiom that a registrant in the sentence does not void (Aamir's call, 2026-09-28,
// against 1,356 findings from the footer alone). Never after a possessive or "first and" ("Milton's
// only.", "the one and only"), and never before the phrase it restricts ("only from Aamir").
const POSTPOSITIVE_FOLLOW_RE = /^\s*(?:[,.;:!?)]|$)|^\s+(?:and|but|or)\s/i;
const NOT_NOUN_RE = /^(?:is|are|was|were|be|been|am|the|a|an|and|or|not|if|we|i|you|he|she|they|it|us|them|him|her|can|will|may|would|could|should|must|do|does|did|has|have|had|that|this|those|these|our|my|your|their|his|its|one|first|very|single|sole)$/i;
function postpositiveOnly(text, idx, len) {
  if (!POSTPOSITIVE_FOLLOW_RE.test(text.slice(idx + len, idx + len + 12))) return false;
  const m = text.slice(Math.max(0, idx - 40), idx).match(/([A-Za-z][\w'’-]*)\s+$/);
  return !!m && !NOT_NOUN_RE.test(m[1]) && !/['’]s?$/.test(m[1]);
}
// The sentence a registrant must be named in, for "only", "leading" and "highest": the MA-010 sentence
// cut again after an abbreviation that closes one ("... RE/MAX Realty Specialists Inc. Only a handful of
// homes", "at the corner of Main St. Only three homes").
function strictSentence(text, idx, sa, se) {
  let a = sa; const s = text.slice(sa, se + 1); const re = /\b(?:Inc|Ltd|Corp|Co|St|Ave|Rd|Dr|Cres|Blvd|Crt|Ct|Pl)\.\s+(?=[A-Z][a-z])|\s[·•|]\s/g; let m;
  while ((m = re.exec(s))) { if (sa + m.index + m[0].length <= idx) a = sa + m.index + m[0].length; else break; }
  let b = se + 1; re.lastIndex = idx - sa; const n = re.exec(s); if (n) b = sa + n.index + n[0].length;
  return text.slice(a, b);
}
// MA-011. The registrant, named: our names and brand, the first person (and "he"/"his" of a bio), "this
// site", "someone who knows your street", or a role word (agent, realtor, broker, brokerage, team,
// representative, expert, specialist, advisor, professional, pro ...) that no third party's word in front
// of it claims: a trade or owner ("an insurance agent", "a Town representative", "the developer's sales
// agent", "a legal advisor", "the Town's by-law enforcement team"), a capitalised name that is not ours
// or a place ("a Tarion representative", "Milton Hydro representative"), or "another"/"other".
const ROLE_WORD_RE = /\b(?:realtors?(?!\.ca)|brokers?|brokerages?|agents?|specialists?|experts?|advis[oe]rs?|(?:sales\s+)?representatives?|salespersons?|salespeople|negotiators?|(?<!\b(?:local|farm|food|film|music|tv|television|egg|dairy|maple|honey|wine|beef|pork|crop|record)\s)producers?|professionals?(?!\s+(?:home\s+)?(?:inspectors?|engineers?|photographers?|stagers?|cleaners?|movers?|appraisers?|contractors?|designers?|organizers?))|pros?(?![-‐‑]|\s*(?:and|&)\s*cons|\s*#)|teams?)\b/gi;
const THIRD_MARK_RE = /^(?:listing|leasing|buyer['’]s|buyers['’]?|seller['’]s|sellers['’]?|tenant['’]s|landlord['’]s|mortgage|insurance|tax|financial|lender['’]s|lenders?|bank['’]s|banks?|developer['’]s|developers?|builder['’]s|builders?|sales|centre|center|town['’]s|municipal|city|city['’]s|government|legal|structural|asbestos|certified|registered|licensed|qualified|medical|health|inspection|engineering|forestry|by-law|bylaw|enforcement|management|concierge|building|property|maintenance|security|board|school|front|desk|hockey|sports|roads?|construction|design|nursing|coaching|soccer|baseball|basketball|youth|minor|travel|staffing|transportation|environmental|another|other|their|its|condo|hydro|utility|parks|planning|works|operations)$/i;
const NOT_THIRD_CAP_RE = /^(?:The|A|An|Your|Our|My|Every|Each|Any|This|That|Local|Top|Best|Real|Estate|Milton|Halton|Ontario|RE\/MAX|Miltonly|Aamir|Yaqoob|Licensed|Experienced|Trusted|Independent|Professional|Senior|Lead|Hall|Fame|Diamond|Platinum|Titan|Chairman|Chairman's|Club|Award|Awards|President's|Executive|Lifetime|Achievement|Circle|Centurion|Gold|Silver)$/;
function rolesNameRegistrant(t) {
  const title = titleMode(t);
  ROLE_WORD_RE.lastIndex = 0; let m;
  while ((m = ROLE_WORD_RE.exec(t))) {
    const pre = t.slice(Math.max(0, m.index - 60), m.index).split(/[;:!?()\n·•|]|\.\s/).pop().trim().split(/\s+/).filter(Boolean).slice(-3);
    const unknownCap = (w) => /^[A-Z][\w.'’-]*$/.test(w) && !NOT_THIRD_CAP_RE.test(w.replace(/['’]s$|[,.]$/g, '')) && !FUNCTION_WORD_RE.test(w.replace(/[,.]$/, '')) && !KNOWN_PLACES.has(w.replace(/['’]s$|[,.]$/g, '').toLowerCase());
    const third = pre.some((w) => THIRD_MARK_RE.test(w.replace(/[,.]$/, ''))) || pre.filter(unknownCap).length >= (title ? 2 : 1);
    if (!third) return true;
  }
  return false;
}

function properExempt(text, idx, len) {
  const word = text.slice(idx, idx + len);
  if (/^#/.test(word) && hash1Kind(text, idx, len) === 'numbered') return true;
  // A registered street, park or school.
  NAME_RE.lastIndex = Math.max(0, idx - WINDOW); let m;
  while ((m = NAME_RE.exec(text))) {
    if (m.index > idx) break;
    if (idx + len > m.index + m[0].length) continue;
    if (NAME_RANKED_RE.test(text.slice(m.index + m[0].length))) continue;
    if (idx > m.index) return true; // the word sits inside the name ("Brian Best Park")
    const { toks, a } = lineTokens(text, m.index, m.index + 1);
    const prev = toks[a - 1];
    // "the", "a" or a possessive of the town ranks the name; a neighbourhood's possessive introduces
    // it ("Beaty's Best Road is a short residential street").
    if (!prev || !(NAME_OPENER_RE.test(prev.core) || RANKING_POSSESSIVE_RE.test(prev.core))) return true;
    const after = lineTokens(text, m.index + m[0].length - 1, m.index + m[0].length);
    const next = after.toks[after.b + 1];
    if (next && !leads(next) && !/\.$/.test(m[0]) && ATTRIBUTIVE_NEXT_RE.test(next.core.replace(/\.$/, ''))) return true;
  }
  // A feed intersection: both sides are registered street bases; "and" or "&" only after a cue.
  if (/^[A-Z]/.test(word) && REGISTERED.supBases.has(word.toLowerCase())) {
    const known = (w) => !!w && /^[A-Z]/.test(w) && (REGISTERED.bases.has(w.toLowerCase()) || !REGISTERED.fromFiles);
    const after = text.slice(idx + len, idx + len + 40); const before = text.slice(Math.max(0, idx - 40), idx);
    // After the join the hit must close its side ("Ferguson/Best", not "Thompson and Best-rated").
    const closes = INTERSECT_ENDS_RE.test(after);
    const s1 = after.match(INTERSECT_SLASH_AFTER_RE); const s2 = before.match(INTERSECT_SLASH_BEFORE_RE);
    if ((s1 && known(s1[1])) || (s2 && known(s2[1]) && closes)) return true;
    const lineBefore = text.slice(text.lastIndexOf('\n', idx - 1) + 1, idx);
    const a1 = after.match(INTERSECT_AND_AFTER_RE); const a2 = before.match(INTERSECT_AND_BEFORE_RE);
    if (((a1 && known(a1[1])) || (a2 && known(a2[1]) && closes)) && INTERSECT_CUE_RE.test(lineBefore.replace(INTERSECT_AND_BEFORE_RE, ''))) return true;
  }
  if (covers(PREMIER_OFFICE_RE, text, idx)) return true;
  const { toks, a, b } = lineTokens(text, idx, idx + len);
  if (a < 0 || b < 0) return false;
  if (REGISTERED.slugs.some((s) => toks[a].raw.toLowerCase().includes(s))) return true;
  const run = capitalisedRun(toks, a, b);
  if (!run) return false;
  // A company: the run ends in a legal designator and is otherwise a clean name.
  const auditWord = AUDIT_FAIL_CLOSED_RE.test(word);
  if (auditWord ? auditCompanyAt(text, idx, len) : (HARD_DESIGNATOR_RE.test(run[run.length - 1]) && cleanRun(run))) return true;
  // The listing brokerage where the feed attributes one, on the same line or under a label line of its
  // own, two words or more. A feed brokerage's name may carry a claim noun ("Century 21 Premier
  // Service"); it is still the feed's attribution, so only a possessive, a first-person word or our
  // own name disqualifies it.
  const lineStart = text.lastIndexOf('\n', idx - 1) + 1;
  const cue = text.slice(Math.max(lineStart, idx - 160), idx).match(ATTRIBUTION_CUE_RE);
  const prevLine = text.slice(text.lastIndexOf('\n', lineStart - 2) + 1, Math.max(0, lineStart - 1));
  const labelled = !cue && ATTRIBUTION_LABEL_RE.test(prevLine) && toks[a].s === toks[0].s;
  if (cue || labelled) {
    const between = cue && cue[1].trim() ? cue[1].trim().split(/\s+/) : [];
    const tail = run.slice(run.indexOf(toks[a].core));
    const name = [...between, ...tail];
    const attributed = !name.some((t) => POSSESSIVE_RE.test(t) || /^(?:is|are|was|our|my|your|we|I|the)$/i.test(t)) && !OWN_NAMES_RE.test(name.join(' '));
    // MA-011: "#1" and "top producer" are attributed only inside a company's name ("Listed by #1 Choice
    // Realty Inc."), never as a title ("Listed by Top Producer", "Presented by RE/MAX Top Producer Team").
    if (name.length >= 2 && attributed && (!auditWord || DESIGNATOR_TOKEN_RE.test(name[name.length - 1].replace(/,$/, '')) || name.some((t) => /^(?:Inc\.?|Ltd\.?),?$/.test(t)))) return true;
  }
  return false;
}

// Why a superlative hit ranks nothing, or null when it is a claim and fires.
export function superlativeExemption(text, idx, len) {
  const word = text.slice(idx, idx + len);
  if (properExempt(text, idx, len)) return 'proper';
  for (const re of FREE_IDIOM_RES) if (covers(re, text, idx)) return 'idiom';
  if (/^only$/i.test(word) && postpositiveOnly(text, idx, len)) return 'idiom';
  const { a: sa, b: se } = sentenceSpan(text, idx);
  const sentence = text.slice(sa, se + 1);
  const isQuestion = text[se] === '?';
  const answer = isQuestion && se + 1 < text.length ? text.slice(se + 1, sentenceSpan(text, Math.min(text.length - 1, se + 2)).b + 1) : '';
  const named = namesRegistrant(sentence) || namesRegistrant(answer) || (!!answer && SITE_PRODUCT_RE.test(answer.replace(BRAND_SUFFIX_RE, '')));
  for (const re of GUARDED_IDIOM_RES) if (covers(re, text, idx)) return named ? null : 'idiom';
  if (/^#/.test(word) && hash1Kind(text, idx, len) === 'label') return named ? null : 'idiom';
  if (SENSE_WORD_RE.test(word)) {
    // The registrant is named in the strict sentence or the answer; a site product in an answer ("the
    // Milton Transit app") names no one here.
    const namedSense = namesRegistrantSense(strictSentence(text, idx, sa, se)) || namesRegistrantSense(answer);
    return namedSense || claimSense(text, idx, len, sa, se) ? null : 'ordinary';
  }
  if (!/^best$/i.test(word)) return null; // the other constructions are constructions of "best" only
  const { toks, a, b } = lineTokens(text, idx, idx + len);
  if (a < 0) return null;
  const tok = toks[a]; const prev = toks[a - 1]; const next = toks[b + 1]; const next2 = toks[b + 2];
  const tokCore = tok.core.replace(/\.$/, '');
  const bare = a === b && tokCore.toLowerCase() === word.toLowerCase() && !leads(tok);
  const ends = trails(tok) || /\.$/.test(tok.raw);
  const nextWord = next && !leads(next) ? next.core.replace(/\.$/, '') : '';
  // question: the reader is speaking, so only names and roles in the question void it; the answer
  // is the site speaking, so anything that names the registrant there voids it.
  if (isQuestion || INDIRECT_CHOICE_RE.test(text.slice(sa, idx))) {
    const before = text.slice(sa, idx);
    const bestFor = /^best\s+for\b/i.test(text.slice(idx));
    const asks = INDIRECT_CHOICE_RE.test(before)
      || WHICH_ASKS_RE.test(before)
      || (/\b(?:what|who)\b/i.test(before) && /\b(?:is|are)\s+$/i.test(before) && bestFor)
      || (/\bor\b/i.test(before) && (bestFor || /^best\s*\?/i.test(text.slice(idx))))
      || (/^\s*who\b/i.test(sentence) && /^best\s+for\s*\?/i.test(text.slice(idx, se + 1)));
    // A claim noun in the phrase "best" opens ("the best resale value") ranks a claim; "best?" opens none.
    const phrase = [];
    if (!ends) for (let k = b + 1; k < Math.min(toks.length, b + 4); k++) { const c = toks[k].core.replace(/\.$/, ''); if (leads(toks[k]) || /^(?:for|in|on|to|of|at|with|near|right|now)$/i.test(c)) break; phrase.push(c); if (trails(toks[k]) || /\.$/.test(toks[k].raw)) break; }
    const ranksClaim = phrase.some((w) => CLAIM_NOUN_RE.test(w));
    // A choice left to the reader ("decide which condo is best for you", "which streets suit your
    // budget best") is a choice even in a sentence that names Aamir; a choice of agent never is.
    const readerChoice = /\bwhich\s+(?!(?:agent|agents|realtor|realtors|brokerage|brokerages|broker|brokers|team)\b)/i.test(before)
      && (/^best\s+for\s+(?:you|your)\b/i.test(text.slice(idx)) || /\bsuits?\s+(?:you|your(?:\s+\w+)?)\s+$/i.test(before));
    const voided = !readerChoice && (namesRole(sentence) || WE_RE.test(sentence));
    // "we", "us" and "our" in a question are the site asking about itself, not the reader; an answer
    // that names the registrant, a site product or a pick ("This one: four beds") is the site claiming.
    if (asks && !ranksClaim && !QUESTION_PRESUPPOSES_RE.test(sentence) && !voided && !namesRegistrant(answer) && !SITE_PRODUCT_RE.test(answer.replace(BRAND_SUFFIX_RE, '')) && !ANSWER_PICKS_RE.test(answer)) return 'question';
  }
  // A choice that the reader's circumstances decide: "Whether a condo or a freehold is best depends on",
  // "What's best depends on", "The best choice for you comes down to".
  const decides = /^best\s+(?:(?:\w+\s+){0,2}?(?:for\s+(?:you|your\s+\w+)\s+)?)?(?:depends|comes\s+down\s+to)\b/i.test(text.slice(idx));
  if (decides && (/\b(?:whether|which|what)\b[^.?!]*\bis\s+$/i.test(text.slice(sa, idx)) || /\bwhat['’]s\s+$/i.test(text.slice(sa, idx)) || /\bthe\s+$/i.test(text.slice(sa, idx))) && !named) return 'question';
  if (named) return null;
  // adverb: "is best confirmed", "is therefore best characterised", "can best be confirmed", "a market
  // best read road by road", "a building best understood through ...". Up to two adverbs may stand
  // between the copula and "best".
  let pv = a - 1; for (let n = 0; n < 2 && pv >= 0 && !trails(toks[pv]) && ADVERB_RE.test(toks[pv].core); n++) pv--;
  const head = pv >= 0 && !trails(toks[pv]) ? toks[pv] : null;
  const reduced = head && pv >= 1 && /^(?:a|an|the)$/i.test(toks[pv - 1].core) && /^[a-z][a-z'-]*$/.test(head.core) && !ADVERB_RE.test(head.core);
  const neutral = (w, i) => NEUTRAL_PARTICIPLE_RE.test(w) && (!PARTICIPLE_NEEDS[w.toLowerCase()] || PARTICIPLE_NEEDS[w.toLowerCase()].test(text.slice(i)));
  if (bare && !ends && head && (COPULA_RE.test(head.core) || DATA_NOUN_RE.test(head.core) || reduced) && next && neutral(nextWord, next.e)) return 'adverb';
  // the same note as a label: "Best confirmed per listing" under a tile, "Maintenance fee: best
  // confirmed per listing", "(best confirmed per listing)"
  // (also after a comma or "and" before the confirm family: "Fees vary by unit, best confirmed per
  // listing", "not published and best confirmed per listing"; and in quotes)
  const confirmFamily = /^(?:confirmed|verified|checked)$/i.test(nextWord);
  const noteStart = a === 0 || (prev && /:$/.test(prev.raw)) || /^[(“"]best$/i.test(tok.raw) || (confirmFamily && prev && (/,$/.test(prev.raw) || /^and$/i.test(prev.core)));
  if (noteStart && a === b && tokCore.replace(/^[(“"]/, '').toLowerCase() === 'best' && !ends && next && neutral(nextWord, next.e)) return 'adverb';
  if (bare && !ends && head && MODAL_RE.test(head.core) && /^be$/i.test(nextWord) && next2 && neutral(next2.core.replace(/\.$/, ''), next2.e)) return 'adverb';
  // fit: "Best suits", "Best for" (a label), "is best suited to", "is best-suited to", "fits a buyer
  // best", "works best from here", "works best."
  const atLineStart = a === 0;
  if (bare && !ends && /^(?:suits?|suited|fits?)$/i.test(nextWord) && (atLineStart || (head && COPULA_RE.test(head.core)))) return 'fit';
  // "Best for" opening a line is a label ("Best for first-time buyers and downsizers") unless it ranks
  // within a place ("Best for families in Halton: this Timberlea detached").
  const restOfLine = toks.slice(b + 1).map((t) => t.raw).join(' ');
  if (bare && atLineStart && next && /^for:?$/i.test(next.raw) && (b + 1 === toks.length - 1 || /:$/.test(next.raw) || !/\b(?:in|on|across)\s+(?:Milton|Halton|Ontario|the\s+(?:GTA|street|area|town|region))\b|:/i.test(restOfLine))) return 'fit';
  if (a === b && /^best-suited$/i.test(tokCore) && head && COPULA_RE.test(head.core)) return 'fit';
  if (bare && !openerBlocks(prev) && (ends || !next || FIT_FOLLOW_RE.test(nextWord)) && !/^\s+(?:in\s+(?:all|the\s+whole|the\s+entire)|of\s+all)\b/i.test(text.slice(tok.e)) && !FIT_RANKING_RE.test(text.slice(sa, idx)) && !/\b(?:among|compared\s+(?:with|to)|than\s+any|of\s+all)\b/i.test(text.slice(tok.e, se + 1))) {
    const cs = clauseStart(text, idx);
    for (let k = a - 1; k >= Math.max(0, a - 4); k--) { if (toks[k].s < cs) break; if (FIT_VERB_RE.test(toks[k].core)) return 'fit'; }
  }
  // source: "the Ford market is your best guide to what you'd pay"
  SOURCE_RE.lastIndex = Math.max(0, idx - WINDOW); let s;
  while ((s = SOURCE_RE.exec(text))) {
    if (s.index > idx) break;
    if (idx >= s.index + s[0].length) continue;
    // The subject's head noun must be data: "Recent sales on this street" heads on "sales", "For
    // buyers watching the market this home" heads on "home".
    const subject = text.slice(clauseStart(text, s.index), s.index);
    const headNoun = (subject.replace(/\s+(?:on|in|for|of|across|along|at|near|from)\s+[^,;]*$/i, '').trim().split(/\s+/).pop() || '');
    if (DATA_SUBJECT_RE.test(headNoun) && !SITE_PRODUCT_RE.test(subject) && !SOURCE_CLAIM_AFTER_RE.test(text.slice(s.index + s[0].length, se + 1))) return 'source';
  }
  // source, in apposition to a figure: "Condos across Dempsey typically sell around $610K, the best
  // guide to its value until it trades more often" (condoBrief.ts, the building with no typical).
  SOURCE_APPOSITIVE_RE.lastIndex = Math.max(0, idx - WINDOW); let ap;
  while ((ap = SOURCE_APPOSITIVE_RE.exec(text))) {
    if (ap.index > idx) break;
    if (idx >= ap.index + ap[0].length) continue;
    const lead = text.slice(sa, ap.index);
    if (SOURCE_APPOSITIVE_DATA_RE.test(lead) && !SITE_PRODUCT_RE.test(lead) && !SOURCE_CLAIM_AFTER_RE.test(text.slice(ap.index + ap[0].length, se + 1))) return 'source';
  }
  return null;
}

// Every superlative hit in a string with its verdict: { word, match, index, exemption }, exemption
// null for a hit that fires. The report and the fixtures read this; the check reads the first null.
export function superlativeHits(text) {
  const out = [];
  for (const w of SUPERLATIVES) {
    const re = new RegExp(supSource(w), 'gi');
    let m; while ((m = re.exec(text))) out.push({ word: w, match: m[0], index: m.index, exemption: superlativeExemption(text, m.index, m[0].length) });
  }
  return out.sort((x, y) => x.index - y.index);
}
// MA-003. Every catchment word needs school, board, zone or catchment context within twelve words.
// The two bare nouns are S2 and are never a finding in a sentence about the Town polygon or a
// distance ("Schools whose position falls inside the Town of Milton's boundary", "measured
// boundary centre to boundary centre"). The hub's disclaimer sentence is exempt outright.
// Every assignment form (zoned for, feeds into, feeder school) is S1, the locked WS4 rule.
const CATCHMENT_CONTEXT = /\b(schools?|boards?|zones?|catchments?)\b/i;
const POLYGON_OR_DISTANCE_RE = /\b(Town of Milton|Town'?s|Town polygon|polygon|inside the boundary|within the boundary|neighbourhood'?s? boundary|kilometres?|km|metres?|distance|measured|centre to|closest|nearest|within \d)\b/i;
const DISCLAIMER_RE = /a catchment is the school board.s fact/i;
const LABEL_RE = /listing agent.s remarks/i;
export const CATCHMENT = [
  { re: /\bcatchments?\b/gi, sev: 2, bareNoun: true },
  { re: /\bboundar(?:y|ies)\b/gi, sev: 2, bareNoun: true },
  { re: /\bzoned?\s+(?:for|to)\b/gi },
  { re: /\bdraws?\s+from\b/gi },
  { re: /\bdrawing\s+from\b/gi },
  { re: /\bfeeds?\s+into\b/gi },
  { re: /\bfeeding\s+into\b/gi },
  { re: /\bassigned\s+to\b/gi },
  { re: /\bschool\s+zones?\b/gi },
  { re: /\bfeeder\s+schools?\b/gi },
  { re: /\bdraws?\s+to\b/gi },
  { re: /\bdrawing\s+to\b/gi },
  { re: /\bserv(?:es?|ing)\s+the\s+(?:area|street|neighbourhood)\b/gi },
];
// The sentence around an index: from the previous full stop, question mark, exclamation mark,
// colon or line break to the next one.
function sentenceAt(text, idx) {
  const a = Math.max(text.lastIndexOf('.', idx), text.lastIndexOf('!', idx), text.lastIndexOf('?', idx), text.lastIndexOf('\n', idx), text.lastIndexOf(':', idx));
  const ends = ['.', '!', '?', '\n'].map((c) => text.indexOf(c, idx)).filter((i) => i >= 0);
  const b = ends.length ? Math.min(...ends) : text.length;
  return text.slice(a + 1, b);
}
// Feed enumerations as the TRREB feed spells them. Any of these in rendered text means a raw
// field reached the page without passing through a label map. Board attribution ("TRREB", the
// MLS mark) is required by the IDX rules and is not on this list.
export const TREB_STRINGS = [
  'Att/Row/Townhouse', 'Att/Row/Twnhouse', 'Condo Apt', 'Comm Element Condo', 'Co-Op Apt',
  'Co-Ownership Apt', 'Det Condo', 'Semi-Det Condo', 'Vacant Land Condo', 'Leasehold Condo',
  'Det W/Com Elements', 'Rural Resid', 'Multiplex', 'Sq Ft', 'W/O', 'Bsmt', 'Lrg',
  'Interboard', 'Sale Of Business', 'Bungalow-Raised', 'Sidesplit', 'Backsplit',
];
const TREB_RE = new RegExp('(?<![\\w/])(?:' + TREB_STRINGS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w/])', 'g');
// The short tokens are remark shorthand as often as feed fields. They count only next to a slash or
// a comma, and never on a listing page, where the remarks are the seller's words.
const SHORT_FEED_TOKENS = new Set(['Lrg', 'Bsmt', 'W/O', 'Sq Ft']);

// Host leaks: any absolute URL that is not the canonical host.
const LEAK_RE = /https?:\/\/(?:[a-z0-9-]+\.)*(?:vercel\.app|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)|http:\/\/(?:www\.)?miltonly\.com|https:\/\/www\.miltonly\.com/gi;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', copy: '\u00a9', reg: '\u00ae' };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}

// Visible text: the body without scripts, styles, templates and tags. Block tags become
// newlines so words on either side of a tag do not fuse. `spaced` (MA-010) also turns every other tag
// into a space, because the site's markup fuses words across inline elements ("SpecialistBest",
// "BrokerageWorld Class Realty Point") and a fused word hides a superlative from \b.
export function visibleText(html, { spaced = false } = {}) {
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  // Spaced, a <br> is a space too: a heading broken by one is still one sentence ("It's best to
  // list<br/>with Aamir Yaqoob").
  if (spaced) s = s.replace(/<br\b[^>]*>/gi, ' ');
  s = s.replace(/<\/?(p|div|li|h[1-6]|br|tr|td|th|section|article|header|footer|nav|dt|dd|blockquote|figcaption|summary)\b[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, spaced ? ' ' : '');
  return decode(s).replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null; };
const hasAttr = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag);

export function excerpt(text, idx, len = 90) {
  const a = Math.max(0, idx - Math.floor(len / 2)); const b = Math.min(text.length, idx + Math.floor(len / 2));
  return (a > 0 ? '\u2026' : '') + text.slice(a, b).replace(/\s+/g, ' ') + (b < text.length ? '\u2026' : '');
}

// Parse the parts of the document the checks need.
export function parse(html) {
  const bodyAt = html.search(/<body\b/i);
  const head = html.slice(0, bodyAt > 0 ? bodyAt : html.length);
  let body = bodyAt > 0 ? html.slice(bodyAt) : html;
  // MA-003: blocks Core labels as the listing agent's remarks (a data-remarks attribute) are the
  // seller's words. They leave the body before the vocabulary checks; each one must carry the
  // visible label "Listing agent's remarks", inside it or just before it.
  const remarks = [];
  const openRe = /<([a-z][a-z0-9-]*)\b[^>]*\sdata-remarks(?:=|\s|>|\/)[^>]*>/gi;
  let o;
  while ((o = openRe.exec(body))) {
    const tag = o[1].toLowerCase();
    const pair = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    pair.lastIndex = o.index + o[0].length;
    let depth = 1; let end = -1; let p;
    while ((p = pair.exec(body))) { depth += p[1] ? -1 : 1; if (depth === 0) { end = p.index + p[0].length; break; } }
    if (end < 0) end = Math.min(body.length, o.index + o[0].length + 20000);
    const block = body.slice(o.index, end);
    const around = body.slice(Math.max(0, o.index - 300), o.index);
    const lastLine = visibleText(around).split('\n').filter((l) => l.trim()).pop() || '';
    const labelled = LABEL_RE.test(visibleText(block)) || LABEL_RE.test(lastLine);
    remarks.push({ index: remarks.length, labelled, text: visibleText(block).slice(0, 80), full: visibleText(block, { spaced: true }) });
    body = body.slice(0, o.index) + ' '.repeat(end - o.index) + body.slice(end);
    openRe.lastIndex = end;
  }
  const title = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const metaByName = (n) => { const t = metas.find((m) => (attr(m, 'name') || '').toLowerCase() === n || (attr(m, 'property') || '').toLowerCase() === n); return t ? attr(t, 'content') : null; };
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const canonicalTag = links.find((l) => (attr(l, 'rel') || '').toLowerCase() === 'canonical');
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => visibleText(m[1]));
  const jsonld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], 'href')).filter((h) => h != null);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const ids = new Set([...html.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]).concat([...html.matchAll(/\sname\s*=\s*"([^"]+)"/g)].map((m) => m[1])));
  return { heads: { ogTitle: metaByName('og:title'), twTitle: metaByName('twitter:title'), ogDesc: metaByName('og:description'), twDesc: metaByName('twitter:description') }, title: title == null ? null : decode(title).replace(/\s+/g, ' ').trim(), description: metaByName('description'), ogUrl: metaByName('og:url'), robots: metaByName('robots'), canonical: canonicalTag ? attr(canonicalTag, 'href') : null, h1s, jsonld, anchors, imgs, ids, remarks, text: visibleText(body), prose: visibleText(proseOnly(body)), words: visibleText(body, { spaced: true }), social: ['og:title', 'og:description', 'twitter:title', 'twitter:description', 'og:image:alt', 'twitter:image:alt', 'og:site_name'].map(metaByName).filter(Boolean), aria: [...body.matchAll(/<[a-z][a-z0-9-]*\b[^>]*\saria-label\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((m) => decode(m[2] ?? m[3] ?? '')).filter(Boolean) };
}

// MA-010. The em-dash rule is a voice rule about punctuation in prose, so a dash counts only when it
// punctuates running text: content on each side of it ("far more than price — it is about", "rose 4% —
// faster", "Inc. — licensed", "Worth? — Free Valuation"), looking through the inline tags around it
// ("personally — <b>comparable", "MLS<sup>®</sup> — exact", an empty icon span) and through a line break
// after it ("Every street in Milton —<br/>priced"). Out of scope, wherever they are:
//   a value placeholder          "—" standing for a missing or suppressed figure: an element holding
//                                only the dash ("<div class="s-stat-v">—</div>", "is <b>—</b> until five
//                                homes sell"), a dash with a unit or sign glued to it, a space allowed
//                                ("—/mo", "—%", "$—", "~—", "#—", "-—"), in brackets ("Tax (—)"), opening
//                                its own chip ("— vs last year"), or opening a line after a <br> (a
//                                bullet or a line of its own)
//   a link separator             a dash between two links or controls in a row of them ("<a>Privacy</a>
//                                — <a>Terms</a>"; "<a>…</a> — <a>registered with RECO</a> since 2010" is a
//                                sentence and counts)
//   nav, [role=navigation]       navigation labels: menu items, the mega menu's A-Z index ("X—")
//   breadcrumbs                  any element whose class holds "crumb" or whose aria-label is breadcrumb
//   option                       a select option
//   label, legend, th            the HTML label elements, which name a control or a column
// A sentence inside a nav or a label element stays in scope: production's mega menu carries some
// forty sentences of method notes and fine print, and the home valuation form's CASL consent sentence
// sits inside a <label>. Inside a nav, a <p> of eight words or more is prose and is kept, and so is an
// element with only inline content of eight words or more that writes at least four of them itself (a
// menu card whose words all sit in child spans is a label); the nav element itself is never the
// candidate. A label element of eight words or more is kept whole. A word has two letters or more, so
// figures and card abbreviations ("3 bd · 1 ba") do not make a label a sentence. Breadcrumbs keep
// nothing. Everything else in the body stays in scope, headings and cards included, and so do the
// <title> and the meta description. Share-card and JSON-LD strings are read by the superlative check only.
export const PROSE_EXCLUDED = [
  { what: 'option', re: /<(option)\b[^>]*>/gi, keep: 'none' },
  { what: '[role=option|combobox|listbox|menuitem|tab]', re: /<([a-z][a-z0-9-]*)\b[^>]*\srole\s*=\s*["']?(?:option|combobox|listbox|menuitem|menuitemradio|tab)\b[^>]*>/gi, keep: 'none' },
  { what: 'breadcrumbs ([class*=crumb], [aria-label*=breadcrumb])', re: /<([a-z][a-z0-9-]*)\b[^>]*\s(?:class\s*=\s*["'][^"']*crumb[^"']*["']|aria-label\s*=\s*["'][^"']*\bbreadcrumbs?\b[^"']*["'])[^>]*>/gi, keep: 'none' },
  { what: 'nav', re: /<(nav)\b[^>]*>/gi, keep: 'sentences' },
  { what: '[role=navigation]', re: /<([a-z][a-z0-9-]*)\b[^>]*\srole\s*=\s*["']?navigation\b[^>]*>/gi, keep: 'sentences' },
  { what: 'label, legend, th', re: /<(label|legend|th)\b[^>]*>/gi, keep: 'if-sentence' },
];
export const PROSE_WORDS = 8;
// Words of two letters or more in a fragment, tags and entities read as spaces (an apostrophe entity
// splits "Aamir&#x27;s" into "Aamir" and "s", which still counts one word).
const wordCount = (html) => (html.replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ' ').match(/\p{L}[\p{L}'\u2019-]*\p{L}/gu) || []).length;
const KEEP_TAGS = new Set(['p', 'li', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dd', 'dt', 'small', 'em', 'strong', 'b', 'i', 'q', 'cite', 'summary', 'figcaption', 'blockquote', 'address', 'td', 'button', 'label']);
// An element's own text: its outer tags and every child element (with the child's content) removed.
function ownText(html) {
  const inner = html.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '');
  let out = ''; let depth = 0; const re = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*?(\/?)>|[^<]+/gi; let m;
  while ((m = re.exec(inner))) {
    if (m[2] === undefined) { if (depth === 0) out += m[0]; continue; }
    if (m[3] || VOID_TAGS.has(m[2].toLowerCase())) continue;
    depth += m[1] ? -1 : 1; if (depth < 0) depth = 0;
  }
  return out;
}
const BLOCK_NAMES = new Set(['p', 'div', 'ul', 'ol', 'li', 'nav', 'section', 'article', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'dl', 'dt', 'dd', 'blockquote', 'figure', 'form', 'fieldset', 'select']);
const VOID_TAGS = new Set(['br', 'wbr', 'img', 'input', 'hr', 'meta', 'link', 'source', 'area', 'col', 'embed', 'track', 'param', 'base']);
// One pass over a fragment's tags: every closed element with its extent and whether a block tag sits
// inside it. A child left unclosed is dropped from the stack when its parent closes.
function elementTree(html) {
  const els = []; const stack = []; const re = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*?(\/?)>/gi; let m;
  while ((m = re.exec(html))) {
    const tag = m[2].toLowerCase();
    if (m[3] || VOID_TAGS.has(tag)) continue;
    if (!m[1]) { stack.push({ tag, s: m.index, block: false }); continue; }
    let k = stack.length - 1; while (k >= 0 && stack[k].tag !== tag) k--;
    if (k < 0) continue;
    while (stack.length - 1 > k) { const lost = stack.pop(); if (lost.block || BLOCK_NAMES.has(lost.tag)) stack[stack.length - 1].block = true; }
    const el = stack.pop(); el.e = m.index + m[0].length;
    if (stack.length && (el.block || BLOCK_NAMES.has(tag))) stack[stack.length - 1].block = true;
    els.push(el);
  }
  return els;
}
// The prose worth keeping inside an excluded region's inner HTML: each <p>, and each element whose
// content is inline only, of PROSE_WORDS words or more, outermost first, in document order.
function sentencesIn(inner) {
  const found = []; const extra = [];
  for (const el of elementTree(inner)) {
    if (!KEEP_TAGS.has(el.tag)) continue;
    // a container of blocks (not a link, a control or a form row) keeps its own sentence
    if (el.tag !== 'p' && el.block) {
      const html = inner.slice(el.s, el.e);
      if (!/^(?:a|button|label)$/.test(el.tag) && !/<(?:select|input|textarea)\b/i.test(html)) { const own = ownText(html); if (wordCount(own) >= PROSE_WORDS) extra.push(own); }
      continue;
    }
    // an inline element keeps its sentence only if it writes one itself: a card whose words all sit in
    // child spans (price, beds, "Listed by ...") is a label, not prose
    if (el.tag !== 'p' && wordCount(ownText(inner.slice(el.s, el.e))) < PROSE_WORDS / 2) continue;
    if (el.e - el.s < PROSE_WORDS * 3) continue;
    if (wordCount(inner.slice(el.s, el.e)) >= PROSE_WORDS) found.push([el.s, el.e]);
  }
  found.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const keep = [];
  for (const k of found) if (!keep.length || k[0] >= keep[keep.length - 1][1]) keep.push(k);
  return [...keep.map(([s, e]) => inner.slice(s, e)), ...extra].join('\n');
}
// Blank every element an open-tag pattern matches, children included, by depth-matching its own tag,
// keeping the prose inside it as PROSE_EXCLUDED says. An element with no closing tag loses its opening
// tag only, so a malformed page keeps its text in scope rather than dropping it.
function blankElements(html, openRe, keep) {
  let out = html; let o; openRe.lastIndex = 0;
  while ((o = openRe.exec(out))) {
    const pair = new RegExp(`<(/?)${o[1].toLowerCase()}\\b[^>]*>`, 'gi');
    pair.lastIndex = o.index + o[0].length;
    let depth = 1; let end = -1; let closeAt = -1; let p;
    while ((p = pair.exec(out))) { depth += p[1] ? -1 : 1; if (depth === 0) { end = p.index + p[0].length; closeAt = p.index; break; } }
    if (end < 0) { out = out.slice(0, o.index) + ' '.repeat(o[0].length) + out.slice(o.index + o[0].length); openRe.lastIndex = o.index + o[0].length; continue; }
    const whole = out.slice(o.index, end);
    const repl = keep === 'if-sentence' && wordCount(whole) >= PROSE_WORDS ? whole
      : keep === 'sentences' ? ` ${sentencesIn(out.slice(o.index + o[0].length, closeAt))} ` : ' ';
    out = out.slice(0, o.index) + repl + out.slice(end);
    openRe.lastIndex = o.index + repl.length;
  }
  return out;
}
const INLINE_TAGS = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'label', 'mark', 'meter', 'output', 'picture', 'progress', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var']);
const SKIP_CHAR = /[\s     ​ ⁠‎‏︎️()\[\]{}"'“”‘’«»\p{M}]/u;
const CONTENT_CHAR = /[\p{L}\p{N}\p{S}%#&@§*?!…′″\-\uD800-\uDFFF\p{Extended_Pictographic}]/u;
const LONE_DASH_RE = /<([a-z][a-z0-9-]*)\b[^>]*>(?:\s| )*—(?:\s| )*<\/\1\s*>/gi;
const EXTRA_ENTITIES = { ensp: ' ', emsp: ' ', thinsp: ' ', hairsp: ' ', zwsp: ' ', shy: '', laquo: '«', raquo: '»', trade: '™', deg: '°', minus: '−', plusmn: '±', rarr: '→', check: '✓' };
// What is on this side of the dash at i: { ok } when content is found before a block boundary. Walk
// outwards over spaces, brackets and quotes (and, to the left, a full stop that ends an abbreviation)
// and over inline tags. An empty inline element (an icon whose svg was stripped, an anchor target) and
// an <img> are crossed as if absent. Leaving the dash's own wrappers is allowed, and so is entering a
// neighbour ("— <b>comparable"), but not leaving and then entering: that is a hop into a sibling element
// ("<span>+0.5%</span><span>— vs last year</span>"). A <br> is crossed and remembered (viaBr); any
// other tag ends the walk.
function contentOnSide(s, i, dir) {
  let k = dir < 0 ? i - 1 : i + 1; let left = false; let entered = false; let viaBr = false;
  while (k >= 0 && k < s.length) {
    const c = s[k];
    if (SKIP_CHAR.test(c) || (dir < 0 && c === '.' && k > 0 && /[\p{L}\p{N}%]/u.test(s[k - 1]))) { k += dir; continue; }
    // an entity visibleText will decode ("&eacute;", "&sup2;") is content
    if (dir < 0 && c === ';' && /&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+)$/i.test(s.slice(Math.max(0, k - 10), k))) return { ok: true, viaBr };
    if ((dir < 0 && c === '>') || (dir > 0 && c === '<')) {
      const a = dir < 0 ? s.lastIndexOf('<', k) : k; const b = dir < 0 ? k : s.indexOf('>', k);
      if (a < 0 || b < 0) return { ok: false };
      const t = s.slice(a, b + 1).match(/^<(\/?)([a-z][a-z0-9-]*)/i);
      if (t && /^wbr$/i.test(t[2])) { k = dir < 0 ? a - 1 : b + 1; continue; }
      if (t && /^br$/i.test(t[2])) { viaBr = true; k = dir < 0 ? a - 1 : b + 1; continue; }
      if (t && /^img$/i.test(t[2])) { k = dir < 0 ? a - 1 : b + 1; continue; }
      if (!t || !INLINE_TAGS.has(t[2].toLowerCase())) return { ok: false };
      // an empty inline element is crossed whole
      const tag = t[2].toLowerCase();
      if (dir > 0 && !t[1]) { const m = s.slice(b + 1).match(new RegExp(`^(?:[\\s\\u00a0]|<(?:img|wbr)\\b[^>]*>|<([a-z][a-z0-9]*)\\b[^>]*>[\\s\\u00a0]*<\\/\\1\\s*>)*<\\/${tag}\\s*>`, 'i')); if (m) { k = b + 1 + m[0].length; continue; } }
      if (dir < 0 && t[1]) { const m = s.slice(0, a).match(new RegExp(`<${tag}\\b[^>]*>(?:[\\s\\u00a0]|<(?:img|wbr)\\b[^>]*>|<([a-z][a-z0-9]*)\\b[^>]*>[\\s\\u00a0]*<\\/\\1\\s*>)*$`, 'i')); if (m) { k = a - m[0].length - 1; continue; } }
      // Walking left, an opening tag is the dash's own wrapper (leaving) and a closing tag is a
      // neighbour (entering); walking right, the other way round.
      const leaving = dir < 0 ? !t[1] : !!t[1];
      if (leaving) left = true; else entered = true;
      if (left && entered) return { ok: false };
      k = dir < 0 ? a - 1 : b + 1; continue;
    }
    return { ok: CONTENT_CHAR.test(c), viaBr };
  }
  return { ok: false };
}
export function proseOnly(body) {
  let s = body.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  // Entities decoded so quotes and letters read as themselves ("&quot;no fee&quot;"), except the ones
  // that would open or close a tag or be decoded a second time by visibleText ("&amp;mdash;").
  s = s.replace(/&([a-z]+);/gi, (e, n) => (n.toLowerCase() in EXTRA_ENTITIES ? EXTRA_ENTITIES[n.toLowerCase()] : e));
  s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (e) => { const c = decode(e); return c === '<' || c === '>' || c === '&' ? e : c; });
  for (const { re, keep } of PROSE_EXCLUDED) s = blankElements(s, re, keep);
  s = s.replace(LONE_DASH_RE, ' ');
  return s.replace(/—/g, (d, i) => {
    if (s.lastIndexOf('<', i) > s.lastIndexOf('>', i)) return d; // inside a tag: visibleText drops it
    if (/^[\s ]?[%/]/.test(s.slice(i + 1, i + 3)) || /[$~#+±−-][\s ]?$/.test(s.slice(Math.max(0, i - 2), i))) return ' '; // a unit or sign glued to a placeholder
    // a separator between two links or controls in a row of them: the left link opens the row or follows
    // another separator, and the right one is followed by a tag, a separator or nothing ("live from
    // <a>TREB</a> — <a>updated daily</a>" and "<a>RECO</a> since 2010" are sentences)
    if (/(?:^|>|\u2014|\u00b7|\|)[\s\u00a0]*<(a|button)\b[^>]*>(?:(?!<\/?\1\b)[\s\S])*<\/\1\s*>[\s\u00a0]*$/i.test(s.slice(Math.max(0, i - 400), i)) && /^[\s\u00a0]*<(a|button)\b[^>]*>[\s\S]*?<\/\1\s*>[\s\u00a0]*(?:<|\u2014|\u00b7|\||$)/i.test(s.slice(i + 1, i + 400))) return ' ';
    // a dash that opens its own inline element ("<span>— vs last year</span>" after a figure) is a placeholder
    if (/<(?:span|b|strong|em|i|small|mark|label)\b[^>]*>[\s\u00a0]*$/i.test(s.slice(Math.max(0, i - 200), i))) return ' ';
    const L = contentOnSide(s, i, -1); const R = contentOnSide(s, i, 1);
    // a dash that opens a line after a <br> is a bullet or a placeholder line, not punctuation
    return L.ok && R.ok && !L.viaBr ? d : ' ';
  });
}

// Voice checks over a string. `voice` is false on pages whose body is third-party text (listing
// remarks): there the em-dash and superlative checks are off, the catchment check needs school
// context, and the short feed tokens do not count. MA-010: `dashText` is the string the em-dash check
// reads (the body's prose, see proseOnly) and `supText` the one the superlative check reads (the body
// with tags spaced, see visibleText); both default to `text`, as for the title and the meta.
// JSON-LD fields that are the site's own words about itself or its places. Names are not here: a
// JSON-LD name is a proper noun, often a third party's (a listing's brokerage). The feed's listing
// types carry the seller's words, not ours.
const JSONLD_TEXT_FIELDS = /^(?:description|slogan|alternateName|award|awards|knowsAbout|disambiguatingDescription|jobTitle|headline|alternativeHeadline|abstract|articleBody|reviewBody)$/;
const JSONLD_FEED_TYPES = /\b(?:Offer|AggregateOffer|Product|RealEstateListing|Residence|SingleFamilyResidence|House|Apartment|Accommodation)\b/;
export function superlativeFindings(text, where) {
  const out = [];
  for (const w of SUPERLATIVES) {
    const re = new RegExp(supSource(w), 'gi');
    let m; while ((m = re.exec(text))) { if (!superlativeExemption(text, m.index, m[0].length)) { out.push({ code: 'superlative', sev: 3, key: `${where}:${w}`, detail: `"${m[0]}" in ${where}: ${excerpt(text, m.index)}` }); break; } }
  }
  return out;
}
export function vocabularyFindings(text, { voice = true, where = 'text', dashText = text, supText = text } = {}) {
  const out = [];
  if (voice) {
    const dashes = [...dashText.matchAll(/\u2014/g)];
    if (dashes.length) out.push({ code: 'em-dash', sev: 3, key: where, detail: `${dashes.length} in ${where}: ${excerpt(dashText, dashes[0].index)}` });
    out.push(...superlativeFindings(supText, where));
  }
  for (const { re, bareNoun, sev = 1 } of CATCHMENT) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(text))) {
      // MA-003: a catchment word counts only within twelve words of school, board, zone or
      // catchment context, never inside the hub's own disclaimer, and the bare nouns never in a
      // sentence about the Town polygon or a distance.
      // The match itself supplies context when it names a school or a zone ("school zone", "feeder
      // school"); otherwise the twelve words on either side must.
      const before = text.slice(Math.max(0, m.index - 400), m.index).split(/\s+/).slice(-12).join(' ');
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 400).split(/\s+/).slice(0, 13).join(' ');
      if (!CATCHMENT_CONTEXT.test(m[0]) && !CATCHMENT_CONTEXT.test(`${before} ${after}`)) continue;
      const sentence = sentenceAt(text, m.index);
      if (DISCLAIMER_RE.test(sentence)) continue;
      if (bareNoun && POLYGON_OR_DISTANCE_RE.test(sentence)) continue;
      out.push({ code: 'catchment', sev, key: `${where}:${m[0].toLowerCase()}`, detail: `"${m[0]}" in ${where}: ${excerpt(text, m.index)}` }); break;
    }
  }
  TREB_RE.lastIndex = 0; let t; const seen = new Set();
  while ((t = TREB_RE.exec(text))) {
    const s = t[0];
    if (SHORT_FEED_TOKENS.has(s) && (!voice || !/[\/,]/.test(text.slice(Math.max(0, t.index - 2), t.index + s.length + 2)))) continue;
    if (seen.has(s)) continue; seen.add(s);
    out.push({ code: 'treb-string', sev: 2, key: `${where}:${s}`, detail: `"${s}" in ${where}: ${excerpt(text, t.index)}` });
  }
  return out;
}

// All raw-HTML findings for one page. `finalPath` is the path the document was served from.
// `listing` marks a listing page: until Core labels the remarks block, its body is the seller's
// words and the voice checks stand down; once a data-remarks block exists, the block leaves the
// body and everything left is our own copy, checked in full.
// MA-011. The street page head MC-048 shipped (src/lib/streetHead.ts), checked on the page production
// serves; scripts/test-street-head.ts checks the same rules at build time. The head is frozen until
// MC-048's GSC re-read (2026-10-26), so any drift is S2: a change spoils the comparison.
//   title   one of the three rungs, "<name>, Milton: homes, sold history, prices | Miltonly", then without
//           ", prices", then without " | Miltonly", the first that fits 65 characters (a rung the ladder
//           would not pick is a finding); the name is the page's H1
//   meta    at most 155; "<count> addresses on <name>, numbered <low> to <high>. Every one listed, with
//           its sold history for registered readers. Free to register." (the last sentence dropped only
//           when it does not fit), or "<name>, Milton: every address on the street, with sold history for
//           registered readers." where the Town has no range
//   both    no $, "typical", "median" or sales count; no em or en dash
//   share   og:title and twitter:title equal the title; og:description and twitter:description the meta
export const STREET_PAGE_RE = /^\/streets\/[^/?#]+$/;
export const STREET_TITLE_MAX = 65;
export const STREET_META_MAX = 155;
const HEAD_BANNED_RE = /\$|\btypical(?:ly)?\b|\bmedian\b|\b\d[\d,]*\s+(?:recent\s+|recorded\s+|closed\s+)?(?:sales?|sold|transactions?|trades?)\b/i;
export function streetHeadFindings(d) {
  const out = []; const add = (key, detail) => out.push({ code: 'street-head', sev: 2, key, detail });
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  const title = norm(d.title); const meta = norm(d.description); const h1 = norm(d.h1s[0]);
  const m = title.match(/^(.+), Milton: homes, sold history(, prices)?( \| Miltonly)?$/);
  if (!m) add('title-shape', `"${title}" is none of MC-048's three rungs`);
  else {
    const [, name, prices, brand] = m;
    const head = `${name}, Milton: homes, sold history`;
    const want = [`${head}, prices | Miltonly`, `${head} | Miltonly`, head].find((r) => r.length <= STREET_TITLE_MAX) ?? head;
    if (prices && !brand) add('title-shape', `"${title}" keeps ", prices" and drops " | Miltonly"`);
    else if (title !== want) add('title-rung', `"${title}" (${title.length}) where the ladder gives "${want}" (${want.length})`);
    if (h1 && name !== h1) add('title-name', `the title names "${name}", the H1 reads "${h1}"`);
    const lead = meta.match(new RegExp(`^(\\d+) addresses on ${esc(name)}, numbered (\\d+) to (\\d+)\\. Every one listed, with its sold history for registered readers\\.( Free to register\\.)?$`));
    if (lead) {
      const [, count, lo, hi, free] = lead;
      if (!(+count >= 2 && +lo < +hi)) add('meta-shape', `count ${count}, numbered ${lo} to ${hi}: not a range`);
      if (!free && `${meta} Free to register.`.length <= STREET_META_MAX) add('meta-shape', `drops "Free to register." with room for it: "${meta}"`);
    } else if (meta !== `${name}, Milton: every address on the street, with sold history for registered readers.`) add('meta-shape', `"${meta.slice(0, 110)}${meta.length > 110 ? '…' : ''}" is neither MC-048 meta shape`);
  }
  if (title.length > STREET_TITLE_MAX) add('title-length', `${title.length} characters, over ${STREET_TITLE_MAX}: "${title}"`);
  if (meta.length > STREET_META_MAX) add('meta-length', `${meta.length} characters, over ${STREET_META_MAX}`);
  for (const [where, s] of [['title', title], ['meta', meta]]) {
    const b = s.match(HEAD_BANNED_RE); if (b) add(`${where}-banned`, `"${b[0]}" in the ${where}: "${s.slice(0, 110)}"`);
    if (/[–—]/.test(s)) add(`${where}-dash`, `an en or em dash in the ${where}: "${s.slice(0, 110)}"`);
  }
  const h = d.heads;
  for (const [key, got, want, what] of [['og-title', h.ogTitle, title, 'title'], ['twitter-title', h.twTitle, title, 'title'], ['og-description', h.ogDesc, meta, 'meta'], ['twitter-description', h.twDesc, meta, 'meta']]) {
    if (norm(got) !== want) add(key, `${key.replace('-', ':')} ${got == null ? 'missing' : `"${norm(got).slice(0, 90)}"`} is not the ${what}`);
  }
  return out;
}

export function pageFindings({ html, path: finalPath, base, listing = false }) {
  const d = parse(html);
  const f = [];
  const voice = !listing || d.remarks.length > 0;
  for (const r of d.remarks) if (!r.labelled) f.push({ code: 'remarks-unlabelled', sev: 2, key: String(r.index), detail: `data-remarks block ${r.index + 1} has no "Listing agent's remarks" label: "${r.text}"` });
  if (listing && !d.remarks.length) f.push({ code: 'remarks-unmarked', sev: 3, key: '', detail: 'no data-remarks block, so the remarks cannot be told from our copy; voice checks stood down on the body' });
  const host = new URL(base).host;

  if (d.title == null || !d.title) f.push({ code: 'title-missing', sev: 2, key: '', detail: 'no <title>' });
  else if (d.title.length < 20 || d.title.length > 65) f.push({ code: 'title-length', sev: 3, key: '', detail: `${d.title.length} chars: "${d.title}"` });
  if (d.description == null || !d.description.trim()) f.push({ code: 'meta-missing', sev: 2, key: '', detail: 'no meta description' });
  else if (d.description.length < 50 || d.description.length > 165) f.push({ code: 'meta-length', sev: 3, key: '', detail: `${d.description.length} chars: "${d.description.slice(0, 80)}${d.description.length > 80 ? '\u2026' : ''}"` });
  if (STREET_PAGE_RE.test(finalPath)) f.push(...streetHeadFindings(d));
  if (d.h1s.length === 0) f.push({ code: 'h1-missing', sev: 2, key: '', detail: 'no <h1>' });
  else if (d.h1s.length > 1) f.push({ code: 'h1-multiple', sev: 2, key: '', detail: `${d.h1s.length} h1: ${d.h1s.map((h) => `"${h.slice(0, 40)}"`).join(', ')}` });

  const expectCanonical = `${base}${finalPath}`;
  if (!d.canonical) f.push({ code: 'canonical-missing', sev: 2, key: '', detail: 'no rel=canonical' });
  else {
    let c; try { c = new URL(d.canonical, base); } catch { c = null; }
    const got = c ? `${c.origin}${c.pathname.replace(/\/$/, '') || '/'}` : d.canonical;
    if (got !== expectCanonical) f.push({ code: 'canonical-mismatch', sev: 2, key: '', detail: `canonical ${d.canonical}, served at ${finalPath}` });
  }

  d.jsonld.forEach((raw, i) => {
    try { const j = JSON.parse(raw); const types = [].concat(j['@graph'] || j).map((x) => x && x['@type']).filter(Boolean); if (!types.length) f.push({ code: 'jsonld-parse', sev: 1, key: String(i), detail: `block ${i + 1} has no @type` }); }
    catch (e) { f.push({ code: 'jsonld-parse', sev: 1, key: String(i), detail: `block ${i + 1}: ${e.message.slice(0, 80)}` }); }
  });

  const leaks = new Set([...html.matchAll(LEAK_RE)].map((m) => m[0]));
  for (const l of leaks) f.push({ code: 'host-leak', sev: 1, key: l, detail: `${l} in the document` });

  f.push(...vocabularyFindings(d.text, { voice, where: 'text', dashText: d.prose, supText: d.words }));
  // MA-010: the share-card title and description are the site's own words in every social preview;
  // a claim there is a claim, so the superlative check reads the ones that differ from the title and
  // the meta description (the em-dash check does not: it reads prose, and they repeat it).
  const social = [...new Set(d.social)].filter((s) => s !== d.title && s !== d.description);
  if (social.length) { const seen = new Set(); for (const s of social) for (const x of superlativeFindings(s, 'social')) if (!seen.has(x.key)) { seen.add(x.key); f.push(x); } }
  // MA-010: JSON-LD the site writes (descriptions, slogans, awards, job titles, FAQ questions and
  // answers), where the string is not already on the page. A schema-only claim is read by search
  // engines and never by the body check: the homepage's FAQPage carries a question the page does not
  // show. Strings inside arrays count (award and knowsAbout are usually arrays); an untyped child
  // takes its parent's type.
  const ld = [];
  const pageWords = d.words.replace(/\s+/g, ' ');
  const take = (v) => { const s = decode(v).replace(/\s+/g, ' ').trim(); if (s && !pageWords.includes(s)) ld.push(s); };
  // A feed type (a listing, its offer) is skipped unless it hangs off our own agent or business (an
  // Offer under makesOffer is ours). A review is read: published on the site, it is the site's words.
  // A node is feed text only when every one of its types is a feed type ("WebPage|RealEstateListing"
  // is ours). A FAQ question is also read with its answer, as the page would show them together.
  const feedOnly = (t) => !!t && (/\b(?:Residence|SingleFamilyResidence|House|Apartment|Accommodation|Product)\b/.test(t) || t.split('|').every((x) => JSONLD_FEED_TYPES.test(x)));
  const walk = (o, type, key, ours) => {
    if (typeof o === 'string') {
      if (feedOnly(type) && !ours) return;
      // A name is read on a node that is ours ("Aamir Yaqoob | Milton's Premier Realtor"), a review, or
      // a list, article or page the site titles ("The best streets in Milton for families").
      if (JSONLD_TEXT_FIELDS.test(key) || (/\bQuestion\b/.test(type) && key === 'name') || (/\bAnswer\b/.test(type) && key === 'text') || (key === 'name' && (OWN_NAMES_RE.test(o) || /\b(?:Review|ItemList|Article|BlogPosting|WebPage|CollectionPage)\b/.test(type)))) take(o);
      return;
    }
    if (Array.isArray(o)) { o.forEach((x) => walk(x, type, key, ours)); return; }
    if (!o || typeof o !== 'object') return;
    const t = o['@type'] ? [].concat(o['@type']).join('|') : type;
    if (/\bQuestion\b/.test(t) && typeof o.name === 'string') {
      const ans = [].concat(o.acceptedAnswer || o.suggestedAnswer || []).map((x) => (x && typeof x.text === 'string' ? x.text : '')).join(' ').trim();
      // only when both halves are schema-only: a half the page shows is read there
      const onPage = (x) => pageWords.includes(decode(x).replace(/\s+/g, ' ').trim());
      if (ans && !onPage(o.name) && !onPage(ans)) take(`${o.name} ${ans}`);
    }
    const ownNode = /\b(?:RealEstateAgent|LocalBusiness|Organization|Person)\b/.test(t) && !feedOnly(t);
    for (const [k, v] of Object.entries(o)) walk(v, t, k, ownNode ? /^(?:makesOffer|hasOfferCatalog)$/.test(k) : ours && !/\b(?:Residence|SingleFamilyResidence|House|Apartment|Accommodation|RealEstateListing|Product)\b/.test(t));
  };
  for (const raw of d.jsonld) { try { walk(JSON.parse(raw), '', '', false); } catch { /* jsonld-parse reports it */ } }
  if (ld.length) { const seen = new Set(); for (const s of ld) for (const x of superlativeFindings(s, 'jsonld')) if (!seen.has(x.key)) { seen.add(x.key); f.push(x); } }
  // MA-010: a listing of the registrant's own brokerage is the brokerage's advertising, remarks
  // included, and the page presents it as such ("Contact Aamir Yaqoob, RE/MAX Realty Specialists Inc.,
  // the listing brokerage"). RECO holds a brokerage to its salespeople's advertising, so when the page
  // attributes the listing to our brokerage the remarks block is read for superlatives, keyed
  // "remarks:". Every other listing's remarks stay a third party's words (MA-003).
  // MA-011: the listing's own MLS line ("MLS® <its number> · <its brokerage>") decides. Read page-wide,
  // a featured card for one of our listings ("Listed by RE/MAX Realty Specialists Inc., Brokerage", on
  // every listing page) made every listing ours: 61 remarks findings on 2026-09-26, none of them ours.
  // With no own line the page-wide test stands, the direction that reads more remarks, not fewer.
  const mlsId = (finalPath.match(/^\/listings\/([A-Z]?\d+)$/) || [])[1];
  const ownLine = mlsId ? d.words.match(new RegExp(`MLS®?\\s*${mlsId}\\s*·\\s*([^·\\n]{3,80}?)\\s*(?:·|\\n|$)`)) : null;
  const ourListing = listing && (ownLine ? /RE\/MAX\s+Realty\s+Specialists/i.test(ownLine[1]) : /(?:Listed\s+(?:now\s+)?by:?|Brokerage:?|Listing\s+(?:brokerage|office):?|MLS®?\s*[A-Z]?\d+\s*·)\s*RE\/MAX\s+Realty\s+Specialists/i.test(d.words));
  if (ourListing) { const seen = new Set(); for (const r of d.remarks) for (const x of superlativeFindings(r.full, 'remarks')) if (!seen.has(x.key)) { seen.add(x.key); f.push(x); } }
  // MA-010: image alt text is the site's words to a screen reader and to search.
  const alts = d.imgs.map((t) => attr(t, 'alt')).filter(Boolean);
  if (alts.length) { const seen = new Set(); for (const s of alts) for (const x of superlativeFindings(s, 'alt')) if (!seen.has(x.key)) { seen.add(x.key); f.push(x); } }
  // MA-010: an aria-label is the site's words to a screen reader, and often not on the page.
  const aria = [...new Set(d.aria)].filter((s) => !pageWords.includes(s.replace(/\s+/g, ' ').trim()));
  if (aria.length) { const seen = new Set(); for (const s of aria) for (const x of superlativeFindings(s, 'aria')) if (!seen.has(x.key)) { seen.add(x.key); f.push(x); } }
  // The title and the description are always the site's own words, whatever the body is.
  if (d.title) f.push(...vocabularyFindings(d.title, { voice: true, where: 'title' }));
  if (d.description) f.push(...vocabularyFindings(d.description, { voice: true, where: 'meta' }));

  const noAlt = d.imgs.filter((t) => !hasAttr(t, 'alt'));
  if (noAlt.length) f.push({ code: 'img-alt-missing', sev: 3, key: '', detail: `${noAlt.length} <img> without alt, first: ${(attr(noAlt[0], 'src') || '').slice(0, 80)}` });

  // Dead anchors: same-page fragments to no id.
  const dead = new Set();
  for (const h of d.anchors) {
    let frag = null;
    if (h.startsWith('#')) frag = h.slice(1);
    else if (h.startsWith(`${finalPath}#`)) frag = h.slice(finalPath.length + 1);
    else if (h.startsWith(`${base}${finalPath}#`)) frag = h.slice(`${base}${finalPath}#`.length);
    if (frag && frag !== 'top' && frag !== '' && !d.ids.has(decodeURIComponent(frag))) dead.add(h);
  }
  for (const h of dead) f.push({ code: 'dead-anchor', sev: 3, key: h, detail: `${h} matches no id on the page` });

  // Internal links out, normalised to path + search. The run aggregates them by target, so a slug
  // linked from a hundred pages is one finding with a hundred referrers, not a hundred findings.
  const internal = new Map();
  const crossAnchors = [];
  for (const h of d.anchors) {
    if (/^(mailto:|tel:|sms:|javascript:|#)/i.test(h)) continue;
    let u; try { u = new URL(h, base); } catch { continue; }
    if (u.host !== host) continue;
    const p = (u.pathname.replace(/\/+$/, '') || '/') + u.search;
    if (/^\/(_next|api)\//.test(p) || /\.(png|jpe?g|webp|svg|ico|xml|txt|pdf|mp4|webm)$/i.test(u.pathname)) continue;
    internal.set(p, (internal.get(p) || 0) + 1);
    if (u.hash && u.pathname !== finalPath) crossAnchors.push({ path: u.pathname.replace(/\/+$/, '') || '/', frag: decodeURIComponent(u.hash.slice(1)) });
  }
  return { findings: f, internal, crossAnchors, ids: d.ids, meta: { title: d.title, h1: d.h1s[0] ?? null, robots: d.robots } };
}
