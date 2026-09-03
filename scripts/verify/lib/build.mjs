// THE DEPLOYMENT GATE. Every content assertion in this battery is a statement about a specific
// build. If the host is serving a different one, those assertions are not wrong — they are
// meaningless, and reporting them as content FAILs sends someone hunting a data bug that does
// not exist.
//
// This is not hypothetical. On 2026-09-03 the hub-meta check failed four consecutive runs on
// `old-milton` and `cobban` with stable, identical numbers. Two mechanisms were proposed and
// both were wrong. The queries never disagreed: the battery was reading pages the CDN had
// cached from an older build.
//
// The identifier is the Vercel commit SHA from /api/build, which needs no credential. The
// obvious alternative, /api/ping, already returns the same SHA — but its Bearer CRON_SECRET is
// configured for Production only, so it answers 401 on every preview, and a probe that cannot
// verify a preview cannot gate one.

/** The commit SHA the host is actually serving. Throws with the reason on any failure — an
 *  unreadable identity must never read as "identity matches". */
export async function servedCommit(base) {
  const r = await fetch(`${base}/api/build`, {
    headers: { 'user-agent': 'miltonly-verify' },
    redirect: 'manual',
  });
  if (r.status !== 200) throw new Error(`/api/build at ${base} returned ${r.status}`);
  const body = await r.json();
  if (!body.commit || body.commit === 'unknown') {
    throw new Error(`/api/build at ${base} did not report a commit (got ${JSON.stringify(body.commit)})`);
  }
  return body.commit;
}
