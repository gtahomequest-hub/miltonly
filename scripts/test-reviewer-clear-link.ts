// scripts/test-reviewer-clear-link.ts, MC-047 (A6): clearing a held reviewer on /admin/vow sends
// the reviewer a working sign-in link.
//
// TRREB's audit of homesly.ca found a cleared reviewer there was never sent a verification link.
// Here, clearReviewerHold (src/lib/vow/hold.ts), driven with an in-memory row and a recording
// mailer:
//   - a held reviewer: one write that sets the cleared flag and a link-only secret expiring in
//     24 hours; one email, to the row's own address, whose link carries the token whose hash was
//     stored, on the production origin, landing on /sold; the /signin/link verifier accepts that
//     token and the row holds no code;
//   - the email failing: the hold is still cleared and the outcome says the email did not go;
//   - a row that is not held, an unknown id, a malformed id: nothing written, nothing sent.
// And the desk's action still guards on the admin cookie and passes through to it.
import fs from "node:fs";
import { clearReviewerHold, CLEARED_LINK_HOURS, CLEARED_LINK_REDIRECT, type ClearHoldDeps } from "@/lib/vow/hold";
import { hashToken, judgeToken } from "@/lib/portal/door";
import { REVIEW_FLAG } from "@/lib/vow-access";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(msg);
}

const ID = "clreviewer0000000000000001";
const NOW = new Date("2026-09-29T15:00:00Z");

function harness(row: { email: string; reviewFlag: string | null } | null, sendOk = true) {
  const writes: Array<{ userId: string; tokenHash: string; expiry: Date }> = [];
  const mails: Array<{ email: string; link: string; hours: number }> = [];
  const deps: ClearHoldDeps = {
    find: async (id) => (id === ID ? row : null),
    clearAndIssue: async (userId, s) => {
      writes.push({ userId, ...s });
    },
    send: async (m) => {
      mails.push(m);
      return { sent: sendOk };
    },
    now: () => NOW,
  };
  return { deps, writes, mails };
}

async function main() {
  // a held reviewer
  {
    const h = harness({ email: "reviewer@trreb.example", reviewFlag: REVIEW_FLAG.reviewerHeld });
    const out = await clearReviewerHold(ID, h.deps);
    ok(out === "cleared", `a held reviewer clears (${out})`);
    ok(h.writes.length === 1 && h.writes[0].userId === ID, "one write, to that row");
    ok(h.mails.length === 1, "one email");
    const w = h.writes[0], m = h.mails[0];
    if (w && m) {
      ok(m.email === "reviewer@trreb.example", "the email goes to the reviewer's own address");
      ok(w.expiry.getTime() === NOW.getTime() + 24 * 3600 * 1000 && CLEARED_LINK_HOURS === 24 && m.hours === 24, "the link works for 24 hours");
      const u = new URL(m.link);
      ok(u.origin === "https://miltonly.com" && u.pathname === "/signin/link", `the link is the production sign-in link (${u.origin}${u.pathname})`);
      const token = u.searchParams.get("t") ?? "";
      ok(token.length >= 32 && hashToken(token) === w.tokenHash, "the link's token is the one whose hash was stored");
      ok(u.searchParams.get("r") === CLEARED_LINK_REDIRECT && CLEARED_LINK_REDIRECT === "/sold", "the link lands on /sold");
      const stored = { verifyCode: null, verifyTokenHash: w.tokenHash, verifyExpiry: w.expiry, verifyAttempts: 0 };
      const inTime = judgeToken(stored, token, new Date(NOW.getTime() + 23 * 3600 * 1000));
      ok(inTime.ok, "the /signin/link verifier accepts the token 23 hours later");
      const late = judgeToken(stored, token, new Date(NOW.getTime() + 25 * 3600 * 1000));
      ok(!late.ok, "and refuses it after 24 hours");
      ok(!judgeToken(stored, "x".repeat(token.length), NOW).ok, "a different token is refused");
    }
  }
  // the email fails: cleared, and the outcome says so
  {
    const h = harness({ email: "reviewer@trreb.example", reviewFlag: REVIEW_FLAG.reviewerHeld }, false);
    const out = await clearReviewerHold(ID, h.deps);
    ok(out === "cleared-unsent" && h.writes.length === 1, `a failed email still clears, and says the email did not go (${out})`);
  }
  // nothing to clear
  for (const [label, row, id] of [
    ["a registrant hold", { email: "a@b.ca", reviewFlag: "registrant" }, ID],
    ["an already cleared reviewer", { email: "a@b.ca", reviewFlag: REVIEW_FLAG.reviewerCleared }, ID],
    ["an unknown id", null, ID],
    ["a malformed id", { email: "a@b.ca", reviewFlag: REVIEW_FLAG.reviewerHeld }, "bad id!"],
  ] as const) {
    const h = harness(row as { email: string; reviewFlag: string | null } | null);
    const out = await clearReviewerHold(id, h.deps);
    ok(out !== "cleared" && h.writes.length === 0 && h.mails.length === 0, `${label}: nothing written, nothing sent (${out})`);
  }
  // the wiring: the real deps clear and issue in one update, and the desk reports the outcome
  const hold = fs.readFileSync("src/lib/vow/hold.ts", "utf8");
  ok(/data: \{ reviewFlag: REVIEW_FLAG\.reviewerCleared, verifyCode: null, verifyTokenHash: tokenHash, verifyExpiry: expiry, verifyAttempts: 0 \}/.test(hold), "the real write sets the flag and the link-only secret in one update");
  ok(hold.includes("send: sendReviewerClearedEmail,"), "the real mailer is sendReviewerClearedEmail");
  const actions = fs.readFileSync("src/app/admin/vow/actions.ts", "utf8");
  ok(actions.includes("verifyAdminCookieValue") && actions.includes("await clearReviewerHold(String(form.get(\"userId\") ?? \"\"))"), "the desk action guards on the admin cookie and calls clearReviewerHold with the real deps");
  const desk = fs.readFileSync("src/app/admin/vow/page.tsx", "utf8");
  ok(desk.includes('"cleared-unsent":') && /cleared: "Hold cleared, and the reviewer was emailed a sign-in link/.test(desk), "the desk says whether the link went");

  if (failures.length) {
    console.error(`test-reviewer-clear-link: ${failures.length} of ${assertions} assertions failed`);
    for (const f of failures) console.error(`  FAIL ${f}`);
    process.exit(1);
  }
  console.log(`test-reviewer-clear-link: ${assertions} assertions passed`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
