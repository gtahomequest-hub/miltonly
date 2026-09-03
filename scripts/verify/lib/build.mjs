// THE DEPLOYMENT GATE. Every content assertion below this line is a statement about a specific
// build. If the host is serving a different one, those assertions are not wrong — they are
// meaningless, and reporting them as content FAILs sends someone hunting a data bug that does
// not exist.
//
// This is not hypothetical. On 2026-09-03 the hub-meta check failed four consecutive runs on
// `old-milton` and `cobban` with stable, identical numbers. Two mechanisms were proposed and
// both were wrong. The queries never disagreed: the battery was reading a page the CDN had
// cached before the deployment it was meant to be verifying.
//
// The identifier is the Vercel commit SHA, read from /api/ping — an endpoint that already
// exists for exactly this purpose and is Bearer-gated by CRON_SECRET, so nothing new is
// exposed publicly to make the battery work.
import { loadEnv, requireEnv } from './env.mjs';

/** The commit SHA the host is actually serving. Throws with the reason on any failure —
 *  an unreadable identity must never read as "identity matches". */
export async function servedCommit(base) {
  loadEnv();
  requireEnv('CRON_SECRET');
  const r = await fetch(`${base}/api/ping`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'user-agent': 'miltonly-verify' },
    redirect: 'manual',
  });
  if (r.status !== 200) throw new Error(`/api/ping at ${base} returned ${r.status}`);
  const body = await r.json();
  if (!body.commit || body.commit === 'unknown') {
    throw new Error(`/api/ping at ${base} did not report a commit (got ${JSON.stringify(body.commit)})`);
  }
  return body.commit;
}
