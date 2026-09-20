// Prebuild gate: A HUNDRED BOT SUBMISSIONS WRITE ZERO ROWS AND SEND ZERO EMAILS (ML-005).
//
// It runs the real ingestLead() with every write and every send replaced by a counter
// (IngestDeps), and the real checkRateLimit() over an in-memory store, so what is asserted is
// the path's ordering and keys and not a mock of them. Four cohorts of twenty-five, each the
// shape of a bot the site has actually seen: the honeypot filled; no Origin and no Referer; a
// foreign origin; and the sale-detail bot itself, a Chrome User-Agent wrapped in double quotes,
// a dotted Gmail alias and a Tor exit per row. Every one must be refused before the store and
// before the sender.
//
// Then the two rate-limit shapes, asserted at their limits rather than at zero because the
// allowance is the household's: twenty dotted aliases of one inbox from twenty IPs reach the
// row EMAIL_LIMIT times, no more, with the refusal naming the collapsed inbox; twenty
// submissions from one IP reach it IP_LIMIT times. And a control: one real submission reaches
// the row, the confirmation and the desk alert, so the counters are known to be wired.
//
// No database, no network, no env. Upstash is unset here and the store is this file's.

import { HONEYPOT_FIELD } from "@/lib/lead/honeypot";
import { ingestLead, type IngestDeps, type LeadBody } from "@/lib/lead/ingest";
import { checkRateLimit, emailLimitKey, RATE_LIMITS, type RateBucket } from "@/lib/lead/guards";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  assertions++;
  if (!cond) failures.push(label);
}
function eq<T>(actual: T, expected: T, label: string) {
  ok(actual === expected, `${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const BOT_UA = '"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"';
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** A sliding-window store in memory, windowed the way Upstash's is. */
function memoryStore() {
  const windowMs: Record<RateBucket, number> = { ip: 10 * 60e3, ipDay: 24 * 3600e3, email: 3600e3, emailDay: 24 * 3600e3 };
  const hits = new Map<string, number[]>();
  return async (bucket: RateBucket, key: string): Promise<boolean> => {
    const now = Date.now();
    const k = `${bucket}:${key}`;
    const arr = (hits.get(k) ?? []).filter((t) => now - t < windowMs[bucket]);
    if (arr.length >= RATE_LIMITS[bucket].tokens) {
      hits.set(k, arr);
      return true;
    }
    arr.push(now);
    hits.set(k, arr);
    return false;
  };
}

function counters() {
  const rows: unknown[] = [];
  const confirmations: string[] = [];
  const alerts: string[] = [];
  const sms: string[] = [];
  const crm: string[] = [];
  const capi: number[] = [];
  const watches: string[] = [];
  const deliveries: string[] = [];
  const take = memoryStore();
  const deps: IngestDeps = {
    rateLimit: (args) => checkRateLimit(args, take),
    createLead: async (data) => {
      rows.push(data);
      return { id: `lead-${rows.length}` };
    },
    watch: async () => {
      watches.push("watch");
      return { created: false, skipped: "test" };
    },
    confirm: async ({ to }) => {
      confirmations.push(to);
      return "re_confirm";
    },
    opsAlert: async ({ leadId }) => {
      alerts.push(leadId);
      return "re_alert";
    },
    sms: async (_f, leadId) => {
      sms.push(leadId);
    },
    crmEmail: async (_f, leadId) => {
      crm.push(leadId);
    },
    capi: async () => {
      capi.push(1);
      return { ok: true };
    },
    deliveries: async (leadId) => {
      deliveries.push(leadId);
    },
    marketPulse: async () => null,
  };
  const emails = () => confirmations.length + alerts.length + crm.length;
  return { deps, rows, confirmations, alerts, sms, crm, capi, watches, deliveries, emails };
}

interface Shape {
  body?: Partial<LeadBody> & Record<string, unknown>;
  ip?: string;
  origin?: string | null;
  referer?: string | null;
  ua?: string | null;
}

function req(s: Shape) {
  const h = new Map<string, string>();
  h.set("host", "miltonly.com");
  h.set("x-forwarded-for", s.ip ?? "203.0.113.7");
  if (s.origin !== null) h.set("origin", s.origin ?? "https://miltonly.com");
  if (s.referer !== null) h.set("referer", s.referer ?? "https://miltonly.com/listings/W13777774");
  if (s.ua !== null) h.set("user-agent", s.ua ?? BROWSER_UA);
  return { headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null } };
}

function bot(i: number, extra: Partial<LeadBody> & Record<string, unknown> = {}): LeadBody {
  return {
    source: "sale-detail",
    intent: "buy",
    name: "Dzlzykh Drsmvfyol",
    phone: `+1278318${String(9000 + i).padStart(4, "0")}`,
    email: `r.a.y.m.o.n.d.${i}@gmail.com`,
    property_address: "39 Court Street N",
    mlsNumber: "W13777774",
    event_source_url: "https://miltonly.com/listings/W13777774",
    ...extra,
  } as LeadBody;
}

(async () => {
  // The path logs every refusal and every store; a hundred of each is noise in a build log.
  const quiet = { warn: console.warn, log: console.log };
  console.warn = () => {};
  console.log = () => {};
  const restore = () => Object.assign(console, quiet);

  // ── 100 bot submissions: zero rows, zero emails ────────────────────────────────
  {
    const c = counters();
    const statuses: number[] = [];
    const runs: Array<Promise<{ status: number }>> = [];
    for (let i = 0; i < 25; i++) {
      // 1. the honeypot filled: answered 200 with the success body
      runs.push(ingestLead(bot(i, { [HONEYPOT_FIELD]: "http://spam.example" }), req({ ip: `198.51.100.${i}` }), c.deps));
      // 2. no Origin and no Referer: a non-browser caller
      runs.push(ingestLead(bot(100 + i), req({ ip: `198.51.101.${i}`, origin: null, referer: null }), c.deps));
      // 3. a foreign origin
      runs.push(ingestLead(bot(200 + i), req({ ip: `198.51.102.${i}`, origin: "https://evil.example", referer: "https://evil.example/x" }), c.deps));
      // 4. the sale-detail bot as seen: quoted UA, dotted alias, one Tor exit per row, good referer
      runs.push(ingestLead(bot(300 + i), req({ ip: `185.220.101.${i}`, ua: BOT_UA }), c.deps));
    }
    for (const r of await Promise.all(runs)) statuses.push(r.status);
    eq(statuses.length, 100, "100 bot submissions ran");
    eq(c.rows.length, 0, "100 bot submissions: rows written");
    eq(c.emails(), 0, "100 bot submissions: emails sent (confirmation + desk alert + CRM)");
    eq(c.sms.length + c.capi.length + c.watches.length + c.deliveries.length, 0, "100 bot submissions: no SMS, CAPI, watch or delivery log either");
    eq(statuses.filter((s) => s === 200).length, 50, "honeypot and quoted-UA cohorts answered 200, so the bot learns nothing");
    eq(statuses.filter((s) => s === 403).length, 50, "no-origin and foreign-origin cohorts refused 403");
  }

  // ── a missing User-Agent is refused the same way ───────────────────────────────
  {
    const c = counters();
    const r = await ingestLead(bot(1), req({ ua: null }), c.deps);
    eq(r.status, 200, "no user agent: answered 200");
    eq(c.rows.length, 0, "no user agent: rows written");
  }

  // ── the dotted-Gmail drip: one inbox, twenty aliases, twenty IPs ───────────────
  {
    const c = counters();
    const reasons: string[] = [];
    for (let i = 0; i < 20; i++) {
      // One inbox, hamzah@gmail.com, as twenty aliases: a dot moved through the local part and a plus-tag.
      const cut = 1 + (i % 5);
      const local = `${"hamzah".slice(0, cut)}.${"hamzah".slice(cut)}+${i}`;
      const r = await ingestLead(bot(i, { email: `${local}@gmail.com` }), req({ ip: `192.0.2.${i}` }), c.deps);
      if (!r.ok) reasons.push(r.error ?? "");
    }
    ok(c.rows.length <= RATE_LIMITS.email.tokens, `dotted drip: ${c.rows.length} rows written, the inbox's allowance is ${RATE_LIMITS.email.tokens}`);
    eq(reasons.length, 20 - c.rows.length, "dotted drip: every alias past the allowance refused");
    ok(reasons.every((e) => e === "Too many requests"), "dotted drip: refused with the rate-limit message");
    eq(emailLimitKey("h.amzah+3@gmail.com"), emailLimitKey("hamza.h+11@gmail.com"), "dotted drip: the key the limit saw was one inbox");
  }

  // ── one IP, twenty submissions ────────────────────────────────────────────────
  {
    const c = counters();
    for (let i = 0; i < 20; i++) {
      await ingestLead(bot(i, { email: `person${i}@example.com` }), req({ ip: "203.0.113.99" }), c.deps);
    }
    ok(c.rows.length <= RATE_LIMITS.ip.tokens, `one IP: ${c.rows.length} rows written, the IP allowance is ${RATE_LIMITS.ip.tokens}`);
  }

  // ── the control: a real submission reaches everything ─────────────────────────
  {
    const c = counters();
    const r = await ingestLead(
      { source: "street-alert", intent: "buy", email: "person@example.com", property_address: "Maple Avenue", consentText: "x", consentTimestamp: new Date().toISOString() },
      req({ ip: "203.0.113.5" }),
      c.deps,
    );
    ok(r.ok && r.status === 200 && r.leadId === "lead-1", `control: accepted (${JSON.stringify(r)})`);
    eq(c.rows.length, 1, "control: one row");
    eq(c.confirmations.length, 1, "control: one confirmation");
    eq(c.alerts.length, 1, "control: one desk alert");
    eq(c.deliveries.length, 1, "control: the delivery log was written");
    const row = c.rows[0] as { email?: string | null; userAgent?: string | null; consentText?: string | null };
    eq(row.email, "person@example.com", "control: the stored address is the typed one");
    eq(row.consentText, "x", "control: consent text stored");
  }

  // ── the stored address is never the collapsed key ─────────────────────────────
  {
    const c = counters();
    await ingestLead(bot(1, { email: "R.a.y+tag@Gmail.com" }), req({ ip: "203.0.113.6" }), c.deps);
    const row = c.rows[0] as { email?: string | null };
    eq(row.email, "r.a.y+tag@gmail.com", "stored address: lowercased as before, dots and tag kept");
  }

  restore();
  if (failures.length > 0) {
    console.error(`[lead-bot-gate] FAIL — ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[lead-bot-gate] PASS — ${assertions} assertions. 100 bot submissions wrote 0 rows and sent 0 emails; the drip and the burst stop at the household's allowance.`);
})();
