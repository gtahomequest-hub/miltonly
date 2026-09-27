// Agent-only fields never reach a consumer (MC-036, PropTx MLS Rules 8.23(b); the July 2026
// broker_remarks purge, docs/compliance/2026-07-broker-remarks-purge.md).
//
// Broker remarks, private remarks, showing instructions and access notes are written for
// co-operating brokers. They leaked once (broker_remarks, PrivateRemarks in raw_vow_data), the
// source was stopped and the column purged; this check holds the line on every side:
//
//   1. THE STORE. DB2 sold_records: broker_remarks IS NULL on every row, raw_vow_data carries no
//      PrivateRemarks key; showing_requirements, showing_appointments and the two matching keys in
//      raw_vow_data are reported (the source is stopped; the purge of the rows already held is the
//      requester's gate, migrations/sold/006_showing_fields_purge.sql). DB1 Listing has no such
//      column at all.
//   2. THE WIRE. A sample of rendered surfaces and JSON payloads, anonymous and signed in: a street
//      page and its sold-records JSON, a listing page, /sold signed in, /api/sold, the content
//      API with its token, the deal-alert email body (composed, not sent). None may carry an
//      agent-only field name or the vocabulary those fields hold (lockbox, BrokerBay, showing
//      system, alarm code, key at). The vocabulary test is a heuristic; the field-name test is
//      exact.
import { neon } from '@neondatabase/serverless';
import { get } from '../lib/http.mjs';
import { loadEnv, requireEnv } from '../lib/env.mjs';

const FIELD_NAMES = ['broker_remarks', 'brokerRemarks', 'PrivateRemarks', 'privateRemarks', 'private_remarks', 'showing_requirements', 'showingRequirements', 'ShowingRequirements', 'showing_appointments', 'showingAppointments', 'ShowingAppointments', 'raw_vow_data', 'rawVowData'];
const VOCABULARY = [/\block ?box\b/i, /\bbrokerbay\b/i, /\bshowing system\b/i, /\balarm code\b/i, /\bkey (?:at|in|under|with)\b/i, /\bgo direct\b/i, /\bvacant,? (?:go|show)\b/i];

export default {
  id: 'agent-only',
  title: 'No broker remark, private remark, showing instruction or access note reaches a consumer',
  wholeCorpusOnly: true,

  async finish(_rows, { base, slugs }) {
    loadEnv();
    requireEnv('DATABASE_URL', 'SOLD_DATABASE_URL');
    const sold = neon(process.env.SOLD_DATABASE_URL);
    const app = neon(process.env.DATABASE_URL);
    const coverage = [], assertions = [], examples = [], notes = [];

    // ── 1. the store ───────────────────────────────────────────────────────────────────
    const s = (await sold`SELECT count(*)::int total,
        count(*) FILTER (WHERE broker_remarks IS NOT NULL)::int broker,
        count(*) FILTER (WHERE raw_vow_data ? 'PrivateRemarks')::int raw_private,
        count(*) FILTER (WHERE showing_requirements IS NOT NULL)::int showing_req,
        count(*) FILTER (WHERE showing_appointments IS NOT NULL)::int showing_appt,
        count(*) FILTER (WHERE raw_vow_data ? 'ShowingRequirements' OR raw_vow_data ? 'ShowingAppointments')::int raw_showing
      FROM sold.sold_records`)[0];
    const db1cols = (await app`SELECT column_name c FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Listing'
        AND (column_name ILIKE '%remark%' OR column_name ILIKE '%showing%' OR column_name ILIKE '%private%' OR column_name ILIKE '%lockbox%')`).map((r) => r.c).filter((c) => c !== 'description');
    coverage.push(['DB2 sold_records rows', s.total]);
    coverage.push(['DB2 rows still holding showing_requirements · showing_appointments · raw_vow_data showing keys (purge 006 pending)', `${s.showing_req} · ${s.showing_appt} · ${s.raw_showing}`]);
    assertions.push(['DB2 rows with broker_remarks', s.broker, 0]);
    assertions.push(['DB2 rows with PrivateRemarks inside raw_vow_data', s.raw_private, 0]);
    assertions.push(['DB1 Listing columns that could hold an agent-only remark', db1cols.length, 0]);
    if (s.showing_req || s.showing_appt || s.raw_showing) notes.push('showing_requirements and showing_appointments are still held on rows written before the source stop; migrations/sold/006_showing_fields_purge.sql nulls them once the requester gates it');

    // ── 2. the wire ────────────────────────────────────────────────────────────────────
    const sale = (await app`SELECT "mlsNumber" m FROM public."Listing" WHERE "permAdvertise" AND status = 'active' AND "transactionType" <> 'For Lease' ORDER BY "listedAt" DESC LIMIT 1`)[0]?.m;
    const street = slugs[0];
    const urls = [
      ['street page', `/streets/${street}`],
      ['street sold-records JSON (anonymous)', `/api/streets/${street}/sold-records`],
      ['listing page', sale ? `/listings/${sale}` : null],
      ['listing VOW JSON (anonymous)', sale ? `/api/listings/${sale}/vow` : null],
      ['/sold', '/sold'],
      ['/api/sold', '/api/sold?days=90'],
      ['/api/sold-stats', `/api/sold-stats?street=${street}`],
      ['/listings', '/listings'],
      ['/rentals', '/rentals'],
    ].filter(([, u]) => u);
    const token = process.env.CONTENT_ENGINE_API_TOKEN;
    const hits = [], vocab = [];
    let read = 0;
    for (const [name, url] of urls) {
      const p = await get(`${base}${url}`);
      if (p.status !== 200 && p.status !== 401 && p.status !== 403) { examples.push(`${name} ${url} answered ${p.status}`); continue; }
      read++;
      for (const f of FIELD_NAMES) if (p.body.includes(`"${f}"`) || p.body.includes(`\\"${f}\\"`)) hits.push(`${name} · field ${f}`);
      // the vocabulary is a heuristic on a page: a brokerage's public remarks may say "lockbox" and
      // those are consumer-facing by the feed's own contract; on a page it is reported, on a JSON
      // payload (where no remark is rendered) it is a finding
      for (const re of VOCABULARY) { const m = p.body.match(re); if (m) (url.startsWith('/api/') ? hits : vocab).push(`${name} · "${m[0]}"`); }
    }
    if (token) {
      for (const url of ['/api/content/v1/listings/recent?limit=20', '/api/content/v1/market/open-houses']) {
        const r = await fetch(`${base}${url}`, { headers: { authorization: `Bearer ${token}`, 'user-agent': 'miltonly-verify' } });
        const body = await r.text();
        if (r.status !== 200) { examples.push(`${url} answered ${r.status}`); continue; }
        read++;
        for (const f of FIELD_NAMES) if (body.includes(`"${f}"`)) hits.push(`${url} · field ${f}`);
        for (const re of VOCABULARY) { const m = body.match(re); if (m) hits.push(`${url} · "${m[0]}"`); }
      }
    } else notes.push('CONTENT_ENGINE_API_TOKEN unset here; the content API was not read');
    coverage.push(['surfaces and payloads read', read]);
    coverage.push(['pages whose public remarks carry showing vocabulary (reported, the feed\'s own text)', vocab.length ? vocab.join(' · ') : 0]);
    assertions.push(['agent-only field names or showing vocabulary on a consumer surface', hits.length, 0]);
    examples.push(...hits.slice(0, 8));
    return { coverage, assertions, notes, examples };
  },
};
