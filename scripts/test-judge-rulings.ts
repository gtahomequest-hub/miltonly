// Prebuild case for the three MC-011 judge rulings (2026-09-11).
//
//   1. The investor-fit question is out of the FAQ bank, in the validator and in both prompt
//      docs, and the lease-count question is in, K-gated: offered only when leaseActivity is
//      present and the 12-month lease count meets the publish floor.
//   2. Both prompt docs say it: commute and amenity sentences describe the option, never what
//      residents do or prefer.
//   3. The judge asks once more on an unparseable reply and only then fails closed; a parsed
//      refusal is never retried.
//
// The judge half runs the real retry logic with an injected caller, so no model is involved.
import { readFileSync } from "node:fs";
import {
  FAQ_BANK_TEMPLATES, LEASE_COUNT_FAQ_TEMPLATE, OWN_PRICE_FAQ_TEMPLATES,
  offersLeaseCountFaq, eligibleFaqTemplatesFor, allowedFaqQuestionsFor,
} from "../src/lib/ai/validateStreetGeneration";
import { judgeWithOneRetry, parseJudgeReply } from "../src/lib/ai/compliance";
import type { StreetGeneratorInput } from "../src/types/street-generator";

let assertions = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { assertions++; if (!cond) failures.push(label); };

const INVESTOR = "Is {Street} a good fit for investors?";
const evalDoc = readFileSync("docs/phase-4.1/03-evaluative-prompt.md", "utf8");
const sysDoc = readFileSync("docs/phase-4.1/01-system-prompt.md", "utf8");

// ── 1. the bank ──────────────────────────────────────────────────────────────────────────────
ok(!FAQ_BANK_TEMPLATES.includes(INVESTOR), "validator bank: the investor question is out");
ok(!(OWN_PRICE_FAQ_TEMPLATES as readonly string[]).includes(INVESTOR), "own-price list: the investor question is out");
ok(FAQ_BANK_TEMPLATES.includes(LEASE_COUNT_FAQ_TEMPLATE), "validator bank: the lease-count question is in");
ok(!evalDoc.includes(INVESTOR) && !sysDoc.includes(INVESTOR), "prompt docs: the investor question is out of both");
ok(evalDoc.includes(`- "${LEASE_COUNT_FAQ_TEMPLATE}"`) && sysDoc.includes(`- "${LEASE_COUNT_FAQ_TEMPLATE}"`), "prompt docs: the lease-count question is in both");
ok(!/INVESTOR cluster/.test(evalDoc) && /LEASE COUNT cluster: include one if `leaseActivity` is present/.test(evalDoc), "evaluative prompt: the cluster rule is the lease-count rule");
ok(/Never a share, a percentage, a ratio against sales/.test(evalDoc), "evaluative prompt: the answer is a count, never a share");

function base(): StreetGeneratorInput {
  return {
    street: { name: "Jasper Street", slug: "jasper-street-milton", type: "street", identityKey: "jasper|street", siblingSlugs: ["jasper-street-milton"], direction: "" },
    neighbourhoods: ["Old Milton"],
    aggregates: { salesCount: 12, leasesCount: 0, typicalPrice: 900_000, priceRange: { low: 800_000, high: 1_000_000 }, daysOnMarket: 14, kAnonLevel: "full" },
    byType: {},
    nearby: { parks: [], schoolsPublic: [], schoolsCatholic: [], mosques: [], grocery: [] },
    commute: {
      toTorontoDowntown: { method: "car", minutes: 60 }, toMississauga: { method: "car", minutes: 30 },
      toOakville: { method: "car", minutes: 25 }, toBurlington: { method: "car", minutes: 25 }, toPearson: { method: "car", minutes: 35 },
    },
    activeListingsCount: 1,
    crossStreets: [
      { slug: "maple-avenue-milton", name: "Maple Avenue", distinctivePattern: "x", typicalPrice: 693_000 },
      { slug: "wilson-drive-milton", name: "Wilson Drive", distinctivePattern: "x", typicalPrice: 718_000 },
    ],
  } as StreetGeneratorInput;
}
const noLease = base();
ok(!offersLeaseCountFaq(noLease), "gate: no leaseActivity, no lease-count question");
ok(!eligibleFaqTemplatesFor(noLease).includes(LEASE_COUNT_FAQ_TEMPLATE), "gate: withdrawn from the eligible set without leaseActivity");
const thinLease = base();
thinLease.aggregates.leasesCount = 3;
thinLease.leaseActivity = { byBed: {} };
ok(!offersLeaseCountFaq(thinLease), "gate: a lease count under the floor does not offer the question");
const kLease = base();
kLease.aggregates.leasesCount = 5;
kLease.leaseActivity = { byBed: { "2": { count: 5, typicalRent: 2600 } } };
ok(offersLeaseCountFaq(kLease), "gate: leaseActivity with five leases offers the question");
ok(allowedFaqQuestionsFor(kLease).has("How many homes on Jasper Street were leased in the last year?"), "gate: the rendered question is allowed on a K-lease street");
ok(!allowedFaqQuestionsFor(kLease).has("Is Jasper Street a good fit for investors?"), "gate: the investor question is allowed nowhere");

// ── 2. the option, never the resident ────────────────────────────────────────────────────────
ok(/\*\*Describe the option, never the resident\.\*\*/.test(evalDoc), "evaluative prompt: the commute rule is stated");
ok(/never states what residents do, use, prefer, rely on or build their day around/.test(evalDoc), "evaluative prompt: the rule names the forbidden verbs");
ok(/\*\*Describe the option, never the resident\.\*\*/.test(sysDoc), "descriptive prompt: the amenity rule is stated");
ok(/never states what residents do, use, prefer or rely on/.test(sysDoc), "descriptive prompt: the rule names the forbidden verbs");

// ── 3. one retry on an unparseable reply ─────────────────────────────────────────────────────
const GOOD_PASS = '{"pass": true, "findings": []}';
const GOOD_FAIL = '{"pass": false, "findings": [{"span": "For families, the schools are close", "class": "family status"}]}';
const TRUNCATED = '{"pass": true, "findings';
async function run() {
  let calls = 0;
  const seq = (replies: string[]) => async () => replies[calls++] ?? "";

  calls = 0;
  const r1 = await judgeWithOneRetry(seq([TRUNCATED, GOOD_PASS]));
  ok(r1.pass && r1.retried && !r1.judgeError && calls === 2, "truncated then clean: the second reply decides, retried once");

  calls = 0;
  const r2 = await judgeWithOneRetry(seq([TRUNCATED, TRUNCATED]));
  ok(!r2.pass && r2.retried && !!r2.judgeError && calls === 2, "truncated twice: fail-closed after exactly one retry");

  calls = 0;
  const r3 = await judgeWithOneRetry(seq([GOOD_FAIL, GOOD_PASS]));
  ok(!r3.pass && !r3.retried && r3.findings.length === 1 && calls === 1, "a parsed refusal is never retried");

  calls = 0;
  const r4 = await judgeWithOneRetry(seq([GOOD_PASS]));
  ok(r4.pass && !r4.retried && calls === 1, "a clean pass makes one call");

  calls = 0;
  const r5 = await judgeWithOneRetry(async () => { calls++; throw new Error("ECONNRESET"); });
  ok(!r5.pass && !r5.retried && r5.judgeError === "ECONNRESET" && calls === 1, "a transport error is not a parse error: fail-closed, no retry");

  let threw = false;
  try { parseJudgeReply(TRUNCATED); } catch { threw = true; }
  ok(threw, "parseJudgeReply throws on a truncated reply");
  ok(parseJudgeReply(GOOD_FAIL).findings[0].class === "family status", "parseJudgeReply reads the findings");

  if (failures.length > 0) {
    console.error(`[judge-rulings] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[judge-rulings] PASS: ${assertions} assertions; the investor question is out and the K-gated lease count in, both prompts describe the option not the resident, and the judge retries once on an unparseable reply.`);
}
run();
