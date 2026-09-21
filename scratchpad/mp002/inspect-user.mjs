import fs from 'node:fs'; import path from 'node:path';
function loadEnvLocal(){const f=path.join(process.cwd(),'.env.local');for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m||process.env[m[1]]!=null)continue;process.env[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}}
loadEnvLocal();
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();
const email = process.argv[2]; const reset = process.argv.includes('--reset-ack');
const u = await p.user.findUnique({ where: { email }, select: { email:true, firstName:true, verified:true, lastLoginAt:true, homeStreetSlug:true, vowAcknowledgedAt:true, vowAcknowledgementIp:true, vowAcknowledgementUserAgent:true, consentText:true, consentTimestamp:true, verifyCode:true, verifyTokenHash:true, verifyExpiry:true, verifyAttempts:true } });
console.log(JSON.stringify({ ...u, vowAcknowledgementText: undefined, vowAcknowledgementUserAgent: u?.vowAcknowledgementUserAgent?.slice(0,40) }, null, 1));
if (reset && u) { await p.user.update({ where: { email }, data: { vowAcknowledgedAt: null, vowAcknowledgementText: null, vowAcknowledgementIp: null, vowAcknowledgementUserAgent: null, consentText: null, consentTimestamp: null, homeStreetSlug: null } }); console.log('acknowledgement reset for the re-proof'); }
console.log('User rows total:', await p.user.count());
await p.$disconnect();
