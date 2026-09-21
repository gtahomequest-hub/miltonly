// MP-006 proof helpers. One row, one operation, printed before and after.
//   node scratchpad/mp002/mp006-state.mjs <email> show
//   node scratchpad/mp002/mp006-state.mjs <email> version <n>        set vowAcknowledgementVersion
//   node scratchpad/mp002/mp006-state.mjs <email> password-age <days> backdate passwordSetAt
//   node scratchpad/mp002/mp006-state.mjs <email> registrant null|true|false
//   node scratchpad/mp002/mp006-state.mjs <email> reset-all          no ack, no password, no answer
//   node scratchpad/mp002/mp006-state.mjs <email> trail              the person's VowAccessLog rows
//   node scratchpad/mp002/mp006-state.mjs <email> consents           the person's VowConsent rows
//   node scratchpad/mp002/mp006-state.mjs <email> delete-unset       delete the row if it has no password
import fs from "node:fs";
import path from "node:path";
function loadEnvLocal() {
  const f = path.join(process.cwd(), ".env.local");
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
loadEnvLocal();
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const [email, op, arg] = process.argv.slice(2);
const sel = {
  email: true, firstName: true, verified: true, homeStreetSlug: true,
  vowAcknowledgedAt: true, vowAcknowledgementVersion: true, passwordSetAt: true,
  isRegistrant: true, registrantAt: true, reviewFlag: true, reviewFlaggedAt: true,
};
const show = async (label) => console.log(label, JSON.stringify(await p.user.findUnique({ where: { email }, select: { ...sel, passwordHash: true } }).then((u) => u && { ...u, passwordHash: u.passwordHash ? `${u.passwordHash.slice(0, 7)}…` : null })));
await show("before:");
if (op === "version") await p.user.update({ where: { email }, data: { vowAcknowledgementVersion: arg === "null" ? null : Number(arg) } });
if (op === "password-age") await p.user.update({ where: { email }, data: { passwordSetAt: new Date(Date.now() - Number(arg) * 86_400_000) } });
if (op === "registrant") await p.user.update({ where: { email }, data: { isRegistrant: arg === "null" ? null : arg === "true", registrantAt: arg === "null" ? null : new Date(), ...(arg !== "true" ? { reviewFlag: null, reviewFlaggedAt: null } : {}) } });
if (op === "reset-all")
  await p.user.update({
    where: { email },
    data: {
      vowAcknowledgedAt: null, vowAcknowledgementText: null, vowAcknowledgementVersion: null, vowAcknowledgementIp: null, vowAcknowledgementUserAgent: null,
      consentText: null, consentTimestamp: null, homeStreetSlug: null, passwordHash: null, passwordSetAt: null,
      isRegistrant: null, registrantAt: null, reviewFlag: null, reviewFlaggedAt: null,
    },
  });
if (op === "trail") {
  const u = await p.user.findUnique({ where: { email }, select: { id: true } });
  const rows = await p.vowAccessLog.findMany({ where: { userId: u.id }, orderBy: { at: "desc" }, take: 12 });
  console.log(`trail rows (latest 12 of ${await p.vowAccessLog.count({ where: { userId: u.id } })}):`);
  for (const r of rows) console.log(`  ${r.at.toISOString()} ${r.kind} ${r.scope ?? ""} n=${r.recordCount} ip=${r.ip} ua=${(r.userAgent ?? "").slice(0, 30)}`);
}
if (op === "consents") {
  const u = await p.user.findUnique({ where: { email }, select: { id: true } });
  const rows = await p.vowConsent.findMany({ where: { userId: u.id }, orderBy: { at: "asc" } });
  console.log(`consents (${rows.length}):`);
  for (const r of rows) console.log(`  v${r.version} ${r.at.toISOString()} ip=${r.ip} lines=${r.text.split("\n").length}`);
}
if (op === "delete-unset") {
  const u = await p.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (!u) console.log("no row");
  else if (u.passwordHash) console.log("REFUSED: the row has a password; credential records are kept 180 days past expiry");
  else {
    await p.user.delete({ where: { id: u.id } });
    console.log("deleted (no password, no credential record)");
  }
}
if (op !== "show" && op !== "trail" && op !== "consents" && op !== "delete-unset") await show("after: ");
await p.$disconnect();
