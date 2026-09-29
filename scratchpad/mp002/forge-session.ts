// MP-006 proof: mint session tokens for the test row with a chosen `act`, using auth.ts's own
// signer and this machine's secret (the dev fallback: .env.local sets no JWT_SECRET), so the
// inactivity rule can be shown on localhost without waiting an hour.
import { signSessionToken, freshClaims, touchedClaims } from "../../src/lib/auth";
const [userId, mode] = process.argv.slice(2);
const now = Math.floor(Date.now() / 1000);
const fresh = freshClaims(userId, now);
const claims = mode === "idle" ? { ...fresh, act: now - 1 } : mode === "ceiling" ? { ...fresh, exp: now - 1 } : fresh;
signSessionToken(claims).then((t) => console.log(t));
