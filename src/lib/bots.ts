// THE FOUR WASTE BOTS (MC-035, from MA-007's request log). PetalBot, SemrushBot, Amazonbot and
// AhrefsBot were about 1,590 requests a day with no return, and Ahrefs and Semrush are how a
// competitor profiles our backlinks and keywords. Disallowed in robots.txt (src/app/robots.ts)
// and denied at the Vercel Firewall by a custom rule matching these User-Agent substrings (a
// robots rule is voluntary; the firewall is not). NEVER on this list: OAI-SearchBot,
// PerplexityBot, Googlebot, bingbot, Applebot, DuckDuckBot. AI search is a growth channel here;
// OAI-SearchBot is the largest crawler on the site. The substrings are the vendors' own
// User-Agent tokens; a firewall match on "SemrushBot" also covers its suffixed variants.
export const BLOCKED_BOTS = ["PetalBot", "SemrushBot", "Amazonbot", "AhrefsBot"] as const;

/** The crawlers that must never be blocked, for the tests that guard the two lists. */
export const WELCOME_BOTS = ["OAI-SearchBot", "PerplexityBot", "Googlebot", "bingbot", "Applebot", "DuckDuckBot"] as const;
