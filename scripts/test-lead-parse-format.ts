// Regression test for formatLeadParseTextBody in src/lib/email.ts.
//
// This function builds the plain-text email body that kvCORE/BoldTrail's
// lead parser reads. Universal `Field: Value` format, one per line, no
// HTML/Markdown. If the output drifts, BoldTrail silently fails to create
// lead records — no error visible until the campaign starts and conversions
// don't appear, so this test guards the format shape at build time.
//
// Wired into prebuild alongside the other regression checks. Pure-function
// test, zero API calls, zero DB access.

import { formatLeadParseTextBody, type LeadData } from "@/lib/email";

interface Case { name: string; input: LeadData; mustInclude?: string[]; mustNotInclude?: string[]; }

const CASES: Case[] = [
  {
    name: "full ads-rentals-lp lead with attribution",
    input: {
      firstName: "Jane Doe",
      email: "jane@example.com",
      phone: "+16475550123",
      source: "ads-rentals-lp",
      intent: "renter",
      timeline: "asap",
      bedrooms: "2",
      budget: "2500",
      propertyType: "condo",
      gclid: "Cj0KCQiA-abc123",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "rentals-milton",
      utm_term: "milton+rentals",
      utm_content: "ad-variant-a",
      landingPage: "/rentals/ads",
    },
    mustInclude: [
      "Name: Jane Doe",
      "Email: jane@example.com",
      "Phone: +16475550123",
      "Source: Rentals Landing Page (Paid Ad)",
      "Intent: renter",
      "Timeline: asap",
      "Bedrooms: 2",
      "Budget: 2500",
      "Type: condo",
      "gclid: Cj0KCQiA-abc123",
      "utm_source: google",
      "utm_medium: cpc",
      "utm_campaign: rentals-milton",
      "Page URL: /rentals/ads",
    ],
  },
  {
    name: "exclusive-listing lead (minimal fields, no attribution)",
    input: {
      firstName: "John Smith",
      phone: "+14165550123",
      source: "exclusive-listing",
      intent: "buyer",
      street: "123 Main St, Milton",
      notes: "Interested in showing this weekend",
    },
    mustInclude: [
      "Name: John Smith",
      "Phone: +14165550123",
      "Source: Exclusive Listing Inquiry",
      "Intent: buyer",
      "Property: 123 Main St, Milton",
      "Notes: Interested in showing this weekend",
    ],
    mustNotInclude: ["Email:", "gclid:", "utm_source:", "Bedrooms:"],
  },
  {
    name: "off-market signup with gclid only",
    input: {
      firstName: "Off-Market Subscriber",
      phone: "6475550123",
      source: "homepage-exclusive",
      intent: "buyer",
      propertyType: "Detached",
      budget: "$1.2M – $1.5M",
      bedrooms: "3+",
      gclid: "Cj0KCQ-xyz",
    },
    mustInclude: [
      "Name: Off-Market Subscriber",
      "Phone: 6475550123",
      "Source: Off-Market List (Homepage)",
      "gclid: Cj0KCQ-xyz",
    ],
    mustNotInclude: ["utm_source:", "Page URL:"],
  },
  {
    name: "empty / undefined fields are skipped (no 'undefined' literal)",
    input: {
      firstName: "Test",
      phone: undefined,
      email: "",
      utm_source: "   ",
      gclid: undefined,
    },
    mustInclude: ["Name: Test"],
    mustNotInclude: ["Phone:", "Email:", "utm_source:", "gclid:", "undefined"],
  },
  {
    name: "newlines in values are flattened (no parser line splits)",
    input: {
      firstName: "Test",
      phone: "4165550000",
      notes: "Line one\nLine two\rLine three",
    },
    mustInclude: ["Notes: Line one Line two Line three"],
    mustNotInclude: ["Line one\nLine two"],
  },
  {
    name: "unknown source falls through to raw value (no crash)",
    input: {
      firstName: "Test",
      phone: "4165550000",
      source: "some-new-source-code",
    },
    mustInclude: ["Source: some-new-source-code"],
  },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const c of CASES) {
  const out = formatLeadParseTextBody(c.input);
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
  // Universal sanity: no literal "undefined" / "null" in output
  if (/\b(undefined|null)\b/.test(out)) issues.push(`literal "undefined" or "null" in output`);

  if (issues.length === 0) {
    pass++;
  } else {
    fail++;
    failures.push(`  FAIL  ${c.name}\n${issues.map(i => "        " + i).join("\n")}\n        output:\n${out.split("\n").map(l => "          " + l).join("\n")}`);
  }
}

if (fail > 0) {
  console.error(`[lead-parse-format] FAIL — ${fail}/${CASES.length} cases failed:`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`[lead-parse-format] PASS — ${pass}/${CASES.length} cases`);
