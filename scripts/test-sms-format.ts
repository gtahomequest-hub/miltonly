// Regression test for buildAamirSMSBody in src/lib/sms.ts.
//
// The SMS body shape is what Aamir reads on his phone every time a new lead
// arrives. Three cases guard the format:
//   1. Full lead — every field populated, all 4 lines render
//   2. Minimal lead — only phone present, fallbacks fire for type/budget/timeline
//   3. Missing phone — handles `phone: undefined` without literal "undefined"
//
// Pure-function test, zero I/O. Wired into prebuild alongside the other
// regression checks.

import { buildAamirSMSBody } from "@/lib/sms";
import type { LeadData } from "@/lib/email";

interface Case { name: string; input: LeadData; leadId: string; mustInclude?: string[]; mustNotInclude?: string[]; }

const CASES: Case[] = [
  {
    name: "full lead — every field populated",
    input: {
      firstName: "Inbound Lead",
      phone: "+16475550199",
      propertyType: "condo",
      budget: "3500",
      timeline: "asap",
      source: "ads-rentals-lp",
    },
    leadId: "cmp1abcd0000xyz1234567890",
    mustInclude: [
      "🏠 New Milton lead [0199]",
      "condo · $3500 · asap",
      "Call: +16475550199",
      "Lead ID: 34567890",
    ],
  },
  {
    name: "minimal lead — only phone present, fallbacks fire",
    input: {
      phone: "+14165550000",
      source: "homepage-exclusive",
    },
    leadId: "cmp1xxxxxxxxxxxxx0000abc",
    mustInclude: [
      "🏠 New Milton lead [0000]",
      "unknown · $unknown · asap",
      "Call: +14165550000",
      "Lead ID: x0000abc",
    ],
    mustNotInclude: ["undefined", "null"],
  },
  {
    name: "missing phone — graceful fallback, no literal undefined",
    input: {
      propertyType: "townhouse",
      budget: "4500",
      timeline: "1month",
      source: "1hr-booking",
    },
    leadId: "cmp1z9z9z9z9z9z9zzzz1111",
    mustInclude: [
      "🏠 New Milton lead [????]",
      "townhouse · $4500 · 1month",
      "Call: (no phone)",
      "Lead ID: zzzz1111",
    ],
    mustNotInclude: ["undefined", "null", "Call: undefined"],
  },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const c of CASES) {
  const out = buildAamirSMSBody(c.input, c.leadId);
  const issues: string[] = [];

  if (c.mustInclude) {
    for (const needle of c.mustInclude) {
      if (!out.includes(needle)) issues.push(`missing: "${needle}"`);
    }
  }
  if (c.mustNotInclude) {
    for (const forbidden of c.mustNotInclude) {
      if (out.includes(forbidden)) issues.push(`unexpected: "${forbidden}"`);
    }
  }

  if (issues.length === 0) {
    pass++;
  } else {
    fail++;
    failures.push(
      `  FAIL  ${c.name}\n${issues.map((i) => "        " + i).join("\n")}\n        output:\n${out
        .split("\n")
        .map((l) => "          " + l)
        .join("\n")}`,
    );
  }
}

if (fail > 0) {
  console.error(`[sms-format] FAIL — ${fail}/${CASES.length} cases failed:`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`[sms-format] PASS — ${pass}/${CASES.length} cases`);
