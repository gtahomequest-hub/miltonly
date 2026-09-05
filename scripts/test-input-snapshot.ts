// Every StreetGeneration write records the input the prose was written from.
//
// WHY THIS EXISTS. The 2026-09-04 corpus audit could not judge 461 of 474 published
// generations, because the only thing persisted beside the prose was a hash. A hash
// proves two inputs differ; it cannot say which grain moved, and a shape change to
// StreetGeneratorInput moves every row at once. So a four-month-old figure had to be
// scored against today's data, and a fabricated price and a stale one look identical
// under that test.
//
// The column fixes that only if EVERY write path fills it. There are two — the API/cron
// path in src/lib/generateStreet.ts and the bulk path in scripts/backfill-descriptions.ts
// — and each writes the row more than once (an atomic claim, then a terminal update on
// success and on failure). A path that writes inputHash without inputJson beside it
// reintroduces exactly the row this audit could not read, so this asserts the pairing at
// every site rather than merely that the column is referenced somewhere in the file.
//
// This is the same shape as the name guard's lesson (HANDOFF item 6): asserting that a
// file MENTIONS the right thing is not asserting that every consumer inside it uses it.
import { readFileSync } from "node:fs";

const failures: string[] = [];

/** Every line writing inputHash must have inputJson within a few lines of it. */
function assertPaired(path: string) {
  const lines = readFileSync(path, "utf-8").split("\n");
  let hashSites = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A write, not a read or a comparison: `inputHash,` in an object literal, or
    // `"inputHash" = EXCLUDED` / an INSERT column list in raw SQL.
    const isWrite =
      /^\s*inputHash,\s*$/.test(line) ||
      /"inputHash"\s*=\s*EXCLUDED/.test(line) ||
      /"inputHash",\s*$/.test(line) ||
      /"inputHash",\s*"inputJson"/.test(line);
    if (!isWrite) continue;
    hashSites++;
    const window = lines.slice(Math.max(0, i - 3), i + 5).join("\n");
    if (!/inputJson/.test(window)) {
      failures.push(`${path}:${i + 1} writes inputHash with no inputJson beside it: ${line.trim()}`);
    }
  }
  if (hashSites === 0) failures.push(`${path}: found no inputHash write sites — the guard is looking at the wrong shape`);
  return hashSites;
}

const a = assertPaired("src/lib/generateStreet.ts");
const b = assertPaired("scripts/backfill-descriptions.ts");

// The hash must digest the same bytes that are stored. generateStreet serializes once
// and uses the string for both; a second JSON.stringify would let the pair disagree.
const gen = readFileSync("src/lib/generateStreet.ts", "utf-8");
if (!/const inputSerialized = JSON\.stringify\(phase41Input\);/.test(gen) ||
    !/createHash\("sha256"\)\.update\(inputSerialized\)/.test(gen)) {
  failures.push("src/lib/generateStreet.ts: inputHash must be the digest of the exact string stored in inputJson");
}

// The column is nullable on purpose: pre-2026-09-05 rows have no snapshot and never will.
const schema = readFileSync("prisma/schema.prisma", "utf-8");
if (!/inputJson\s+Json\?/.test(schema)) {
  failures.push("prisma/schema.prisma: StreetGeneration.inputJson must exist and be nullable (Json?)");
}

if (failures.length) {
  console.error("test-input-snapshot: FAIL");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`test-input-snapshot: PASS (${a + b} inputHash write sites paired across 2 paths, 2 invariants)`);
