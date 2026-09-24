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

// Vocabulary. Mirrors src/lib/ai/validateStreetGeneration.ts (SUPERLATIVE_PHRASES) and
// src/lib/ai/catchmentVocabulary.ts (BAN_PATTERNS) so the audit judges rendered text by the same
// lists the validators judge generated text. Kept in sync by hand; the audit cannot import TS.
export const SUPERLATIVES = [
  'best', 'unbeatable', 'nothing comes close', 'premier', 'second to none', 'finest',
  'most desirable', 'top-tier', 'world-class', 'unparalleled', 'unmatched',
];

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
const HYPHEN = '[-\\u2010\\u2011\\u2012\\u2013\\s]+';
const supPattern = (w) => w.replace(/[-\s]+/g, HYPHEN);
const SUP_ALT = SUPERLATIVES.map(supPattern).join('|');
const SUP_WORD = new RegExp(`\\b(?:${SUP_ALT})\\b`, 'i');
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
const ATTRIBUTION_CUE_RE = /(?:\b[Ll]isted\s+(?:now\s+)?by:?|\b[Ll]isting\s+(?:[Bb]rokerage|[Oo]ffice):?|\blisting\s+brokerage\s*\(|(?:^|[·|])[ \t]*Brokerage:?|\b(?:[Ll]isting\s+)?[Cc]ourtesy\s+of:?|\b[Pp]resented\s+by:?|MLS®?\s*[A-Z]?\d+\s*·)[ \t]*((?:[A-Z0-9][\w'’&./®-]*[ \t]+){0,4})$/;
const ATTRIBUTION_LABEL_RE = /^\s*(?:Listed\s+(?:now\s+)?by|Listing\s+(?:brokerage|office)|Brokerage|Courtesy\s+of|Presented\s+by):?\s*$/i;
// The registrant, the agent, the brokerage or the site. A third party's agent, brokerage or team is not.
const THIRD = '(?<!\\b(?:the|a|an|each|that|another|their|other|your)\\s+(?:listing|leasing|buyer[\'’]s|seller[\'’]s|tenant[\'’]s|landlord[\'’]s|mortgage|builder[\'’]s|builder[\'’]s\\s+sales)\\s)';
const TEAM = '(?<!\\b(?:management|concierge|building|property|maintenance|security|board|leasing|front[\\s-]desk|builder[\'’]s\\s+sales)\\s)\\bteams?\\b';
const ROLE_ALT = `\\b(?:Miltonly|Aamir|Yaqoob)\\b|\\brealtors?\\b(?!\\.ca)|(?<!\\bmortgage\\s)\\bbrokers?\\b|Realty Specialists|RE\\/?MAX|${THIRD}\\bbrokerages?\\b|${THIRD}\\bagents?\\b|${THIRD}\\b(?:specialists?|experts?|professionals?|advis[oe]rs?|sales\\s+representatives?|representatives?|salespersons?|negotiators?|producers?|pros?)\\b|\\bsomeone\\s+who\\s+(?:knows|has\\s+sold|sells|lives|works)\\b|${TEAM}|\\b(?:this|our)\\s+(?:site|website|platform)\\b`;
const ROLE_RE = new RegExp(ROLE_ALT, 'i');
const PRONOUN_RE = /\b(?:we|we're|we’re|we've|we’ve|we'll|we’ll|us|ours|me|my|mine|he|him|his)\b|\bour\b(?!\s+Lady\b)/i;
const ANSWER_PICKS_RE = /^\s*(?:this|that)\s+(?:one|home|house|condo|listing|property|building|street|townhome|townhouse)\b|^\s*ours\b/i;
const WE_RE = /\b(?:we|we're|we’re|we've|we’ve|we'll|we’ll|us|ours)\b|\bour\b(?!\s+Lady\b)/i;
const FIRST_PERSON_I_RE = /(?<![\w.])I(?:'m|’m|'ve|’ve|'ll|’ll|'d|’d)?(?![\w.])/;
const BRAND_SUFFIX_RE = /\s*[|–—-]\s*Miltonly(?:\.com)?\s*$/i;
const namesRegistrant = (s) => { const t = s.replace(BRAND_SUFFIX_RE, ''); return ROLE_RE.test(t) || PRONOUN_RE.test(t) || FIRST_PERSON_I_RE.test(t); };
const namesRole = (s) => ROLE_RE.test(s.replace(BRAND_SUFFIX_RE, ''));
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
const CAP_TOKEN_RE = /^(?:[A-Z][\w'’&./®-]*|&)$/;
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

function properExempt(text, idx, len) {
  const word = text.slice(idx, idx + len);
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
  if (HARD_DESIGNATOR_RE.test(run[run.length - 1]) && cleanRun(run)) return true;
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
    if (name.length >= 2 && attributed) return true;
  }
  return false;
}

// Why a superlative hit ranks nothing, or null when it is a claim and fires.
export function superlativeExemption(text, idx, len) {
  const word = text.slice(idx, idx + len);
  if (properExempt(text, idx, len)) return 'proper';
  for (const re of FREE_IDIOM_RES) if (covers(re, text, idx)) return 'idiom';
  const { a: sa, b: se } = sentenceSpan(text, idx);
  const sentence = text.slice(sa, se + 1);
  const isQuestion = text[se] === '?';
  const answer = isQuestion && se + 1 < text.length ? text.slice(se + 1, sentenceSpan(text, Math.min(text.length - 1, se + 2)).b + 1) : '';
  const named = namesRegistrant(sentence) || namesRegistrant(answer) || (!!answer && SITE_PRODUCT_RE.test(answer.replace(BRAND_SUFFIX_RE, '')));
  for (const re of GUARDED_IDIOM_RES) if (covers(re, text, idx)) return named ? null : 'idiom';
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
    const re = new RegExp(`\\b${supPattern(w)}\\b`, 'gi');
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
  return { title: title == null ? null : decode(title).replace(/\s+/g, ' ').trim(), description: metaByName('description'), ogUrl: metaByName('og:url'), robots: metaByName('robots'), canonical: canonicalTag ? attr(canonicalTag, 'href') : null, h1s, jsonld, anchors, imgs, ids, remarks, text: visibleText(body), prose: visibleText(proseOnly(body)), words: visibleText(body, { spaced: true }), social: ['og:title', 'og:description', 'twitter:title', 'twitter:description', 'og:image:alt', 'twitter:image:alt', 'og:site_name'].map(metaByName).filter(Boolean), aria: [...body.matchAll(/<[a-z][a-z0-9-]*\b[^>]*\saria-label\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((m) => decode(m[2] ?? m[3] ?? '')).filter(Boolean) };
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
    const re = new RegExp(`\\b${supPattern(w)}\\b`, 'gi');
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
  const ourListing = listing && /(?:Listed\s+(?:now\s+)?by:?|Brokerage:?|Listing\s+(?:brokerage|office):?|MLS®?\s*[A-Z]?\d+\s*·)\s*RE\/MAX\s+Realty\s+Specialists/i.test(d.words);
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
