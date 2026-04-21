// Phase 4.1 Step 10 — end-to-end smoke test for a single street.
//
// Exercises the full pipeline in live mode on `main-st-e-milton`:
//
//   1. Pre-cleanup: delete any existing StreetGeneration + Review rows for
//      this slug so the test is re-runnable.
//   2. buildGeneratorInput(slug)  — real DB reads, no API.
//   3. generateWithRetry(input, generateStreetDescription)  — real API,
//      up to 3 attempts.
//   4. validateStreetGeneration(output, input)  — final-pass assertion.
//   5. Write StreetGeneration row as status=succeeded with full payload.
//   6. Boot a local Next.js dev server on port 3000 if one isn't already
//      running (detected via GET /).
//   7. Fetch http://localhost:3000/streets/main-st-e-milton .
//   8. Assert: <h1>, all 8 section IDs, ≥6 FAQ Question schema entries,
//      JSON-LD block present, no em-dashes in visible prose.
//   9. Post-cleanup (finally): delete the StreetGeneration row so the
//      next run starts from the same baseline.
//   10. Print pass/fail report with HTML snippets for manual voice eyeball.
//
// Cost ceiling (soft): $3. Each attempt ~$0.85 uncached / ~$0.60 cached.
//
// Run:
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/smoke-test.ts

import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";

const SLUG = "main-st-e-milton";
const PAGE_URL = `http://localhost:3000/streets/${SLUG}`;
const HEALTH_URL = "http://localhost:3000/";
const EXPECTED_SECTION_IDS = [
  "about",
  "homes",
  "amenities",
  "market",
  "gettingAround",
  "schools",
  "bestFitFor",
  "differentPriorities",
];
const MIN_FAQ_ITEMS = 6;
const COST_CEILING_USD = 3;
const DEV_SERVER_READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1000;

// Pricing (claude-opus-4-7 with prompt caching).
const PRICE_IN_PER_MTOK = 15;
const PRICE_OUT_PER_MTOK = 75;
const PRICE_CACHE_WRITE_PER_MTOK = 18.75;
const PRICE_CACHE_READ_PER_MTOK = 1.5;

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]+?)["']?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n$/, "");
    }
  } catch {
    /* ignore */
  }
}

function log(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[smoke] ${line}`);
}

function hashInput(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 12);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Dev-server lifecycle ──────────────────────────────────────────────────

async function isDevServerUp(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { method: "HEAD" });
    return res.ok || res.status === 404; // 404 is fine — server is responding
  } catch {
    return false;
  }
}

async function bootDevServer(): Promise<ChildProcess> {
  log("no dev server on :3000 — spawning `npm run dev`");
  const child = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    env: { ...process.env, BROWSER: "none", NEXT_TELEMETRY_DISABLED: "1" },
  });

  child.stdout?.on("data", () => {
    /* silent — dev output is noisy */
  });
  child.stderr?.on("data", () => {
    /* silent */
  });

  const deadline = Date.now() + DEV_SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isDevServerUp()) {
      log("dev server is ready");
      return child;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  child.kill("SIGTERM");
  throw new Error("dev server did not become ready within 120s");
}

// ─── Main flow ─────────────────────────────────────────────────────────────

interface AttemptUsage {
  tokensIn: number;
  tokensOut: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

function installGenLogCapture() {
  const origLog = console.log;
  let buffer: AttemptUsage[] = [];
  console.log = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.startsWith("[gen] ")) {
      try {
        const p = JSON.parse(first.slice("[gen] ".length));
        if (typeof p.tokensIn === "number" && typeof p.tokensOut === "number") {
          buffer.push({
            tokensIn: p.tokensIn,
            tokensOut: p.tokensOut,
            cacheCreationTokens: p.cacheCreationTokens ?? 0,
            cacheReadTokens: p.cacheReadTokens ?? 0,
          });
        }
      } catch {
        /* ignore */
      }
    }
    origLog(...args);
  };
  return {
    take: () => {
      const out = buffer;
      buffer = [];
      return out;
    },
    restore: () => {
      console.log = origLog;
    },
  };
}

function costOf(usage: AttemptUsage[]): number {
  let c = 0;
  for (const u of usage) {
    c += (u.tokensIn / 1_000_000) * PRICE_IN_PER_MTOK;
    c += (u.tokensOut / 1_000_000) * PRICE_OUT_PER_MTOK;
    c += (u.cacheCreationTokens / 1_000_000) * PRICE_CACHE_WRITE_PER_MTOK;
    c += (u.cacheReadTokens / 1_000_000) * PRICE_CACHE_READ_PER_MTOK;
  }
  return c;
}

async function main() {
  loadEnvLocal();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing — check .env.local");
  }

  const { prisma } = await import("@/lib/prisma");
  const { buildGeneratorInput } = await import("@/lib/ai/buildGeneratorInput");
  const { generateStreetDescription } = await import(
    "@/lib/ai/generateStreetDescription"
  );
  const {
    generateWithRetry,
    validateStreetGeneration,
    StreetGenerationFailure,
  } = await import("@/lib/ai/validateStreetGeneration");

  const runStart = Date.now();

  // Step 1 — Pre-cleanup.
  log("step 1: pre-cleanup");
  await prisma.streetGeneration
    .delete({ where: { streetSlug: SLUG } })
    .catch(() => undefined);
  await prisma.streetGenerationReview
    .delete({ where: { streetSlug: SLUG } })
    .catch(() => undefined);

  // Step 2 — Build input.
  log("step 2: buildGeneratorInput");
  const input = await buildGeneratorInput(SLUG);
  const inputHash = hashInput(input);
  log(`  inputHash=${inputHash}`);

  // Step 3 — Generate with retry (live API).
  log("step 3: generateWithRetry (real API)");
  const capture = installGenLogCapture();
  let output;
  let attemptCount;
  try {
    const genStart = Date.now();
    const r = await generateWithRetry(input, generateStreetDescription);
    output = r.output;
    attemptCount = r.attemptCount;
    log(`  attempts=${attemptCount} elapsedMs=${Date.now() - genStart}`);
  } catch (err) {
    capture.restore();
    const failureUsage = capture.take();
    const failureCost = costOf(failureUsage);
    if (err instanceof StreetGenerationFailure) {
      log(`  FAILED after 3 attempts. cost=$${failureCost.toFixed(4)}`);
      log(`  violations (${err.violations.length}):`);
      for (const v of err.violations) {
        const ex = (v.excerpt ?? "").slice(0, 180);
        log(`    - ${v.rule}${v.sectionId ? ` [${v.sectionId}]` : ""}: ${ex}`);
      }
    } else {
      log(`  FAILED with non-StreetGenerationFailure error. cost=$${failureCost.toFixed(4)}`);
    }
    throw err;
  } finally {
    capture.restore();
  }
  const usage = capture.take();
  const cost = costOf(usage);
  log(`  cost=$${cost.toFixed(4)} tokens=${JSON.stringify(usage)}`);

  if (cost > COST_CEILING_USD) {
    throw new Error(`cost $${cost.toFixed(2)} exceeded ceiling $${COST_CEILING_USD}`);
  }

  // Step 4 — Re-validate.
  log("step 4: validateStreetGeneration (final-pass)");
  const violations = validateStreetGeneration(output, input);
  if (violations.length > 0) {
    throw new Error(
      `validator returned ${violations.length} violations on final output: ${JSON.stringify(violations)}`,
    );
  }
  log(`  0 violations`);

  // Step 5 — Write StreetGeneration.
  log("step 5: write StreetGeneration row");
  const wordCounts: Record<string, number> = {};
  let totalWords = 0;
  for (const s of output.sections) {
    let n = 0;
    for (const p of s.paragraphs) n += p.split(/\s+/).filter(Boolean).length;
    wordCounts[s.id] = n;
    totalWords += n;
  }
  const tokensIn = usage.reduce((s, r) => s + r.tokensIn, 0);
  const tokensOut = usage.reduce((s, r) => s + r.tokensOut, 0);
  await prisma.streetGeneration.create({
    data: {
      streetSlug: SLUG,
      sectionsJson: output.sections as unknown as object,
      faqJson: output.faq as unknown as object,
      inputHash,
      status: "succeeded",
      generatedAt: new Date(),
      attemptCount,
      wordCounts,
      totalWords,
      tokensIn,
      tokensOut,
      costUsd: cost,
    },
  });
  log(`  totalWords=${totalWords}`);

  // Step 6 — Dev server (boot if not running).
  log("step 6: ensure dev server on :3000");
  let childProcess: ChildProcess | null = null;
  const alreadyRunning = await isDevServerUp();
  if (!alreadyRunning) {
    childProcess = await bootDevServer();
  } else {
    log("  dev server already running");
  }

  try {
    // Tiny settle delay to let Next dev mode pick up the new row.
    await sleep(1500);

    // Step 7 — Fetch page HTML.
    log(`step 7: GET ${PAGE_URL}`);
    const fetchStart = Date.now();
    const res = await fetch(PAGE_URL);
    const html = await res.text();
    log(`  status=${res.status} bytes=${html.length} elapsedMs=${Date.now() - fetchStart}`);
    if (res.status !== 200) {
      throw new Error(`page fetch returned status ${res.status}`);
    }

    // Step 8 — Assertions.
    log("step 8: assertions");
    const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    if (!h1Match) throw new Error("no <h1> in rendered HTML");
    const h1Text = h1Match[1].replace(/<[^>]+>/g, "").trim();
    if (!h1Text) throw new Error("<h1> is empty");
    log(`  <h1> OK → "${h1Text.slice(0, 80)}"`);

    for (const id of EXPECTED_SECTION_IDS) {
      if (!html.includes(`id="${id}"`)) {
        throw new Error(`section id="${id}" missing from rendered HTML`);
      }
    }
    log(`  all 8 section IDs present`);

    const faqQuestionCount = (html.match(/"@type":"Question"/g) || []).length;
    if (faqQuestionCount < MIN_FAQ_ITEMS) {
      throw new Error(
        `expected ≥${MIN_FAQ_ITEMS} FAQ Question entries in JSON-LD, found ${faqQuestionCount}`,
      );
    }
    log(`  FAQ Question schema entries: ${faqQuestionCount}`);

    if (!/<script[^>]+type=["']application\/ld\+json["']/.test(html)) {
      throw new Error("no <script type=application/ld+json> block in rendered HTML");
    }
    log(`  JSON-LD script block present`);

    // Extract + parse the first JSON-LD @graph block for the extra assertions.
    // These are non-blocking warnings per Step 10b spec — they log but don't
    // fail the test if the relevant schema block is absent or miswired.
    const ldMatch = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (ldMatch) {
      let graph: Array<Record<string, unknown>> = [];
      try {
        const parsed = JSON.parse(ldMatch[1]) as { "@graph"?: Array<Record<string, unknown>> };
        graph = parsed["@graph"] ?? [];
      } catch {
        log(`  WARN: JSON-LD failed to parse`);
      }

      const place = graph.find((g) => g["@type"] === "Place");
      if (place) {
        const addr = place.address as Record<string, unknown> | undefined;
        log(
          `  [Place] name="${place.name}" addr.locality="${addr?.addressLocality}" addr.region="${addr?.addressRegion}"`,
        );
      } else {
        log(`  WARN: Place block not found in JSON-LD @graph`);
      }

      // RealEstateAgent is embedded under LocalBusiness.founder.
      const localBiz = graph.find((g) => g["@type"] === "LocalBusiness");
      const founder = localBiz?.founder as Record<string, unknown> | undefined;
      if (founder && founder["@type"] === "RealEstateAgent") {
        const agentName = founder.name;
        if (agentName !== "Aamir Yaqoob") {
          log(`  WARN: RealEstateAgent.name="${agentName}" (expected "Aamir Yaqoob")`);
        } else {
          log(`  [RealEstateAgent] name="Aamir Yaqoob" (matches locked decision)`);
        }
      } else {
        log(`  WARN: RealEstateAgent not found embedded in LocalBusiness.founder`);
      }

      const offers = graph.filter((g) => g["@type"] === "AggregateOffer");
      for (const o of offers) {
        const price = o.price;
        const lowPrice = o.lowPrice;
        const highPrice = o.highPrice;
        const priceIsFloat =
          typeof price === "number" && !Number.isInteger(price);
        log(
          `  [AggregateOffer] name="${(o.name as string ?? "").slice(0, 50)}" price=${price} lowPrice=${lowPrice} highPrice=${highPrice}${priceIsFloat ? " WARN:float-precision" : ""}`,
        );
      }
      if (offers.length === 0) log(`  [AggregateOffer] none emitted (k-anon gate)`);

      // Sanity snippet: the first FAQPage.Question text.
      const faqPage = graph.find((g) => g["@type"] === "FAQPage");
      const questions = (faqPage?.mainEntity as Array<Record<string, unknown>> | undefined) ?? [];
      if (questions[0]) {
        log(`  FIRST FAQ JSON-LD Q: "${String(questions[0].name ?? "").slice(0, 120)}"`);
      }
    }

    // Em-dash check applies to AI-generated prose only — not UI chrome.
    // AI content lives in two rendered regions:
    //   .description-body  — the 8 generated sections (paragraphs)
    //   .faq-item          — generated FAQ questions (<summary>) + answers (.answer)
    // UI stat grids render "—" as a legitimate empty-value placeholder and
    // must be excluded.
    const descBodyMatch = /<div\s+class="description-body"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/.exec(html);
    const descBodyHtml = descBodyMatch ? descBodyMatch[1] : "";
    const faqItemRe = /<details[^>]*class="faq-item"[^>]*>([\s\S]*?)<\/details>/g;
    const faqBlocks: string[] = [];
    let faqM;
    while ((faqM = faqItemRe.exec(html)) !== null) faqBlocks.push(faqM[1]);

    const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const descBodyText = stripTags(descBodyHtml);
    const faqText = faqBlocks.map(stripTags).join(" ");

    // Safety — ensure we actually extracted real AI content (guards against
    // vacuous em-dash passes if a selector drift left regions empty).
    if (descBodyText.length < 500) {
      throw new Error(
        `description-body extract is too short (${descBodyText.length} chars) — selector probably drifted`,
      );
    }
    if (faqBlocks.length < MIN_FAQ_ITEMS) {
      throw new Error(
        `faq-item blocks count=${faqBlocks.length}, expected ≥${MIN_FAQ_ITEMS}`,
      );
    }
    log(
      `  AI content regions: description-body=${descBodyText.length} chars, faq-items=${faqBlocks.length}`,
    );

    const emDashRe = /[\u2013\u2014]/;
    const descEm = emDashRe.exec(descBodyText);
    if (descEm) {
      const ctx = descBodyText.slice(Math.max(0, descEm.index - 40), descEm.index + 40);
      throw new Error(`em-dash/en-dash in description-body (AI prose): "...${ctx}..."`);
    }
    const faqEm = emDashRe.exec(faqText);
    if (faqEm) {
      const ctx = faqText.slice(Math.max(0, faqEm.index - 40), faqEm.index + 40);
      throw new Error(`em-dash/en-dash in FAQ (AI prose): "...${ctx}..."`);
    }
    log(`  no em-dashes in AI-generated prose (description-body + FAQ)`);

    // Snippets for manual voice eyeball (step 10 report surface).
    const firstSectionHeading = /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(html);
    const faqSummary = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(html);
    const firstFaqQuestion = faqSummary
      ? faqSummary[1].replace(/<[^>]+>/g, "").trim()
      : null;
    log(`  FIRST SECTION HEADING: "${firstSectionHeading ? firstSectionHeading[1].replace(/<[^>]+>/g, "").trim().slice(0, 120) : "<not found>"}"`);
    log(`  FIRST FAQ QUESTION:    "${firstFaqQuestion ? firstFaqQuestion.slice(0, 120) : "<not found>"}"`);

    log(`DONE — all steps passed in ${Date.now() - runStart}ms`);
    log(`  totalWords=${totalWords} attempts=${attemptCount} cost=$${cost.toFixed(4)}`);
  } finally {
    // Step 9 — Post-cleanup (always, even if assertions failed mid-flow).
    log("step 9: post-cleanup");
    await prisma.streetGeneration
      .delete({ where: { streetSlug: SLUG } })
      .catch(() => undefined);
    await prisma.streetGenerationReview
      .delete({ where: { streetSlug: SLUG } })
      .catch(() => undefined);

    if (childProcess) {
      log("  stopping spawned dev server");
      childProcess.kill("SIGTERM");
      // Give it a beat to shut down.
      await sleep(500);
      if (!childProcess.killed) childProcess.kill("SIGKILL");
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[smoke] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
