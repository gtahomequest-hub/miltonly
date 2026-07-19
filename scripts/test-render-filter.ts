// scripts/test-render-filter.ts
// Unit tests for the render-time compliance filter (batch-001 triage +
// WS4 catchment amendment) and the shared catchment vocabulary detector.
// Run: npx tsx --tsconfig tsconfig.test.json scripts/test-render-filter.ts

import {
  filterStreetSectionsForRender,
  filterStreetFaqForRender,
} from "@/lib/ai/streetContentRenderFilter";
import {
  findCatchmentVocabulary,
  hasCatchmentVocabulary,
} from "@/lib/ai/catchmentVocabulary";
import { splitSentences } from "@/lib/ai/trimFaqAnswers";
import type { StreetSection } from "@/types/street-generator";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  [FAIL] ${name}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
  }
}

console.log("=== catchment vocabulary detector ===");
check("catchment fires", hasCatchmentVocabulary("Public elementary catchment draws to Sam Sherratt."), true);
check("catchments plural fires", hasCatchmentVocabulary("strong school catchments here"), true);
check("boundary fires", hasCatchmentVocabulary("inside the HDSB boundary"), true);
check("boundaries fires", hasCatchmentVocabulary("school boundaries shift yearly"), true);
check("zoned for fires", hasCatchmentVocabulary("the street is zoned for Craig Kielburger"), true);
check("zoned to fires", hasCatchmentVocabulary("homes zoned to Bishop Reding"), true);
check("draws from fires", hasCatchmentVocabulary("the school draws from this street"), true);
check("feeds into fires", hasCatchmentVocabulary("the elementary feeds into Milton District"), true);
check("assigned to fires", hasCatchmentVocabulary("students assigned to E.W. Foster"), true);
check("school zone fires", hasCatchmentVocabulary("in a strong school zone"), true);
check("feeder school fires", hasCatchmentVocabulary("the main feeder school for the area"), true);
check(
  "draw to WITH school context fires",
  hasCatchmentVocabulary("older students draw to Craig Kielburger Secondary"),
  true
);
check(
  "draws to WITHOUT school context does not fire",
  hasCatchmentVocabulary("the eye draws to the mature treeline along the crescent"),
  false
);
check("clean distance prose does not fire", hasCatchmentVocabulary(
  "Sam Sherratt Public School is a five-minute drive; St. Scholastica Elementary is a twelve-minute walk."
), false);
check("finding carries excerpt", findCatchmentVocabulary("the catchment here")?.matched ?? null, "catchment");

console.log("\n=== splitSentences (abbreviation safety) ===");
check(
  "St. Scholastica does not split",
  splitSentences("Catholic students attend St. Scholastica Elementary. It is close."),
  ["Catholic students attend St. Scholastica Elementary. ", "It is close."]
);
check(
  "unterminated tail preserved",
  splitSentences("First sentence. trailing fragment without period"),
  ["First sentence. ", "trailing fragment without period"]
);

console.log("\n=== filterStreetSectionsForRender ===");
{
  const sections: StreetSection[] = [
    { id: "about", heading: "About Test Street", paragraphs: ["A clean paragraph."] },
    { id: "schools", heading: "Schools and catchment", paragraphs: [
      "Public elementary catchment draws to Sam Sherratt Public School, serving the west side. Sam Sherratt Public School is a five-minute drive. Craig Kielburger Secondary is eight minutes by car.",
    ]},
    { id: "bestFitFor", heading: "Who this street suits", paragraphs: ["Families settle here."] },
    { id: "differentPriorities", heading: "If different priorities matter more", paragraphs: [
      "The area is zoned for future retail. Other pockets trade differently.",
    ]},
  ];
  const out = filterStreetSectionsForRender(sections);

  check("bestFitFor dropped", out.some((s) => s.id === "bestFitFor"), false);
  check("section count", out.length, 3);
  const schools = out.find((s) => s.id === "schools")!;
  check("catchment heading renamed", schools.heading, "Schools nearby");
  check(
    "catchment sentence scrubbed, distance sentences kept",
    schools.paragraphs[0],
    "Sam Sherratt Public School is a five-minute drive. Craig Kielburger Secondary is eight minutes by car."
  );
  const diff = out.find((s) => s.id === "differentPriorities")!;
  check(
    "zoned-for sentence scrubbed outside schools section too",
    diff.paragraphs[0],
    "Other pockets trade differently."
  );
  check("clean section untouched", out[0].paragraphs[0], "A clean paragraph.");
}
{
  const allCatchment: StreetSection[] = [
    { id: "schools", heading: "Education and schools", paragraphs: [
      "The catchment draws from the whole subdivision.",
    ]},
  ];
  check("section emptied by scrub is dropped", filterStreetSectionsForRender(allCatchment), []);
}

console.log("\n=== filterStreetFaqForRender ===");
{
  const faq = [
    { question: "Who is Test Street a good fit for?", answer: "Families and renters." },
    { question: "Is Test Street in a strong school catchment?", answer: "Yes, it draws to good schools." },
    { question: "Which schools serve Test Street?", answer: "The street is assigned to E.W. Foster Public School." },
    { question: "What is the typical price on Test Street?", answer: "Homes typically trade around $800,000." },
    { question: "How far is Test Street from Toronto?", answer: "About an hour via the GO line." },
  ];
  const out = filterStreetFaqForRender(faq);
  check("who-suits FAQ dropped", out.some((f) => /good fit for/i.test(f.question)), false);
  check("catchment-question FAQ dropped", out.some((f) => /catchment/i.test(f.question)), false);
  check("catchment-answer FAQ dropped", out.some((f) => /assigned to/i.test(f.answer)), false);
  check("clean FAQs kept", out.map((f) => f.question), [
    "What is the typical price on Test Street?",
    "How far is Test Street from Toronto?",
  ]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Failures:", failures.join("; "));
  process.exit(1);
}
