// AI_PROVIDER must fail closed. There is no default provider.
//
// WHY THIS EXISTS. The dispatch used to read "AI_PROVIDER unset OR anthropic -> legacy Anthropic
// path (default)". A shell with the flag empty therefore ran the legacy single-pass Anthropic path
// silently, while production runs phase41_v2 on DeepSeek. A force-regenerate of
// buckthorn-garden-milton did exactly that and died on an Anthropic credit error having never
// attempted DeepSeek. Nothing in the output said which provider had been chosen; the only signal
// was the billing failure.
//
// The failure mode this guards is not "wrong provider" but "wrong provider, silently". A default
// that is both invisible and expensive is the worst of both.
import { resolveAiProvider } from "../src/lib/generateStreet";

const failures: string[] = [];
const saved = process.env.AI_PROVIDER;

function expectThrow(value: string | undefined, label: string) {
  if (value === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = value;
  try {
    const got = resolveAiProvider();
    failures.push("  " + label + ": returned '" + got + "' instead of throwing");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/AI_PROVIDER/.test(msg)) {
      failures.push("  " + label + ": threw, but the message does not name AI_PROVIDER: " + msg);
    }
  }
}

function expectValue(value: string, want: string, label: string) {
  process.env.AI_PROVIDER = value;
  try {
    const got = resolveAiProvider();
    if (got !== want) failures.push("  " + label + ": returned '" + got + "', want '" + want + "'");
  } catch (e) {
    failures.push("  " + label + ": threw for a valid value — " + (e instanceof Error ? e.message : String(e)));
  }
}

// The bug: empty and unset must be errors, not a silent Anthropic default.
expectThrow("", "empty string");
expectThrow("   ", "whitespace only");
expectThrow(undefined, "unset");

// A typo must not fall back to the most expensive path.
expectThrow("phase41-v2", "typo: hyphen instead of underscore");
expectThrow("deepseek", "typo: bare 'deepseek'");
expectThrow("Anthropic", "wrong case");

// The three real values still resolve.
expectValue("anthropic", "anthropic", "explicit anthropic");
expectValue("deepseek_v2", "deepseek_v2", "deepseek_v2");
expectValue("phase41_v2", "phase41_v2", "phase41_v2");
expectValue("  phase41_v2  ", "phase41_v2", "phase41_v2 with surrounding whitespace");

if (saved === undefined) delete process.env.AI_PROVIDER;
else process.env.AI_PROVIDER = saved;

if (failures.length > 0) {
  console.error("[ai-provider-failclosed] FAIL — " + failures.length + " case(s):");
  failures.forEach((f) => console.error(f));
  console.error("");
  console.error("An unset or unknown AI_PROVIDER must throw before any model call. A silent");
  console.error("default bills the wrong provider and gives the operator nothing to read.");
  process.exit(1);
}
console.log("[ai-provider-failclosed] PASS — 6 refusals (empty, whitespace, unset, 2 typos, wrong case) + 4 valid values.");
