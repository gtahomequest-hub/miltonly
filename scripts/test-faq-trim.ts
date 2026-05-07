// scripts/test-faq-trim.ts
// Unit tests for trimFaqAnswersToSentenceCap.
// Run: npx tsx scripts/test-faq-trim.ts

import {
  trimFaqAnswersToSentenceCap,
  countSentences,
} from "@/lib/ai/trimFaqAnswers";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  [✓] ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  [✗] ${name}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
  }
}

console.log("=== countSentences ===");
check("empty string → 0", countSentences(""), 0);
check("whitespace → 0", countSentences("   "), 0);
check("simple 1 sentence", countSentences("Hello world."), 1);
check("3 sentences", countSentences("First. Second. Third."), 3);
check("question + statement", countSentences("Why? Because."), 2);
check("Dr. Smith abbrev (1 sentence)", countSentences("Dr. Smith built it."), 1);
check("Mt. Royal abbrev (1 sentence)", countSentences("The home is on Mt. Royal Crescent."), 1);
check("decimal $1.2 (1 sentence)", countSentences("Average price is $1.2 million."), 1);
check("mixed abbrevs", countSentences("Dr. Smith and Mr. Jones own the home on Mt. Royal Crescent."), 1);
check("e.g. abbrev (1 sentence)", countSentences("There are perks, e.g. mature trees, that buyers value."), 1);

console.log("\n=== trimFaqAnswersToSentenceCap ===");

// Test 1: 3-sentence answer (no trim)
{
  const input = [{ question: "Q1", answer: "First sentence. Second sentence. Third sentence." }];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "3 sentences → no trim (returns input unchanged)",
    out[0].answer,
    "First sentence. Second sentence. Third sentence.",
  );
}

// Test 2: 6-sentence answer (trims to 4)
{
  const input = [{ question: "Q2", answer: "One. Two. Three. Four. Five. Six." }];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "6 sentences → trims to 4",
    out[0].answer,
    "One. Two. Three. Four.",
  );
}

// Test 3: 5-sentence answer with abbreviations in middle
{
  const input = [{
    question: "Q3",
    answer: "Dr. Smith built it. The home is on Mt. Royal Crescent. The lot is large. Schools nearby. Property taxes are reasonable.",
  }];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "5 sentences with Dr./Mt. abbrevs → trims to 4, abbrevs preserved",
    out[0].answer,
    "Dr. Smith built it. The home is on Mt. Royal Crescent. The lot is large. Schools nearby.",
  );
}

// Test 4: Decimal $1.2 million in middle (3 sentences total, no trim)
{
  const input = [{
    question: "Q4",
    answer: "Average price is $1.2 million. Days on market are 30. Inventory is tight.",
  }];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "decimal $1.2 doesn't trigger split → 3 sentences, no trim",
    out[0].answer,
    "Average price is $1.2 million. Days on market are 30. Inventory is tight.",
  );
}

// Test 5: Exactly 4 sentences (no trim, no fragment)
{
  const input = [{ question: "Q5", answer: "One. Two. Three. Four." }];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "exactly 4 sentences → no trim",
    out[0].answer,
    "One. Two. Three. Four.",
  );
}

// Test 6: 6-sentence with abbreviations followed by real sentence boundaries.
// Note: "Cres." is in the abbrev list, so "Mt. Royal Cres. The lot is large."
// counts as one sentence (the period after Cres is masked). To verify abbrev
// preservation across a trim boundary, write the input so the abbrev sits
// inside one of the kept sentences but a real period follows.
{
  const input = [{
    question: "Q6",
    answer: "Dr. Smith owns it. The home sits at Mt. Royal Crescent corner. The lot is large. Schools nearby. Property taxes are reasonable. Bus routes are frequent.",
  }];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "6 sentences with Dr./Mt. inside kept sentences → trims to 4, abbrevs preserved",
    out[0].answer,
    "Dr. Smith owns it. The home sits at Mt. Royal Crescent corner. The lot is large. Schools nearby.",
  );
}

// Test 7: question mark and exclamation mix
{
  const input = [{
    question: "Q7",
    answer: "Why does it sell? Because schools are good. Buyers love it! Inventory turns weekly. Recent sales support this. Year-over-year up 5%.",
  }];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "6 sentences with ? and ! → trims to 4, terminators preserved",
    out[0].answer,
    "Why does it sell? Because schools are good. Buyers love it! Inventory turns weekly.",
  );
}

// Test 8: Input array preserved order, untouched answers untouched
{
  const input = [
    { question: "Short", answer: "One. Two." },
    { question: "Long", answer: "A. B. C. D. E. F." },
    { question: "Medium", answer: "X. Y. Z." },
  ];
  const out = trimFaqAnswersToSentenceCap(input);
  check(
    "mixed: short and medium preserved, long trimmed",
    out.map(i => i.answer),
    ["One. Two.", "A. B. C. D.", "X. Y. Z."],
  );
}

// Test 9: Trim doesn't mutate input
{
  const input = [{ question: "Q9", answer: "A. B. C. D. E. F." }];
  const before = input[0].answer;
  trimFaqAnswersToSentenceCap(input);
  check(
    "input not mutated",
    input[0].answer,
    before,
  );
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`Failed tests: ${failures.join(", ")}`);
  process.exit(1);
}
process.exit(0);
