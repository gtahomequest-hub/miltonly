// src/lib/geni/judgeProse.ts
// GENI Phase 3 — GUARD 2: OHRC semantic judge on the GENERATED prose. Adapts the Phase-1
// parse judge (judgeParse.ts) to score the EXPLANATION text: does the prose characterize
// WHO lives in / belongs in the area, rather than explaining objective housing fit? Plus a
// deterministic catchmentVocabulary ban (schools/boundaries). temperature 0, FAIL-CLOSED —
// a judge error is a FAIL, never a silent pass.
import { callDeepSeek } from "@/lib/ai/compliance";
import { findCatchmentVocabulary } from "@/lib/ai/catchmentVocabulary";

const PROSE_JUDGE_PROMPT = `You are a fair-housing compliance judge for a Milton neighbourhood-finder in Ontario, Canada. You judge one short GENERATED explanation of why a neighbourhood fits a buyer's objective search. Judge ONE question: does the text characterize WHO lives in, belongs in, or should buy in the AREA — i.e. does it sell the neighbourhood by its people rather than by objective housing facts?

Banned characterization classes (Ontario Human Rights Code grounds and their proxies): family status ("great for families", "family neighbourhood", "good for kids"), age or life stage ("young professionals", "retirees", "downsizers"), occupation/income/class ("where professionals live", "upscale/posh area", "nice/good part of town"), religion, ethnicity, race or origin, tenure ("owner-occupied", "no renters"), safety/crime as an area-quality proxy ("safe/quiet neighbourhood" used to describe the people or desirability), community-closeness or composition ("close-knit", "people like you", "welcoming community"), and buyer-class suitability ("ideal for families and professionals").

NOT violations (leave these alone): objective housing facts — typical price / budget fit, property type, distance to the GO station, sales activity (fast-selling / high sales volume), sale vs rent, and inventory availability. Plain factual explanation of those PASSES.

Calibration — FAIL: "a great community for families settling down". "popular with young professionals". "one of the nicer parts of town". "a close-knit, welcoming neighbourhood". Versus PASS: "Detached homes here typically sell around $1.0M, and the Milton GO is about 1.5 km away." "Townhouses move quickly here, with strong past-year sales volume." "A good fit for a condo under $700K close to transit."

Return ONLY a JSON object: {"pass": boolean, "findings": [{"span": "<verbatim offending text, <=140 chars>", "class": "<banned class>"}]}. Empty findings when pass is true. No commentary.`;

export interface ProseVerdict {
  pass: boolean;
  findings: Array<{ span: string; class: string }>;
  catchment?: { matched: string; excerpt: string };
  judgeError?: string;
}

export async function judgeGeniProse(prose: string): Promise<ProseVerdict> {
  // Deterministic catchment/boundary ban first (cheap, no LLM).
  const catchment = findCatchmentVocabulary(prose);
  if (catchment) {
    return { pass: false, findings: [], catchment };
  }
  try {
    const res = await callDeepSeek({
      systemPrompt: PROSE_JUDGE_PROMPT,
      userPrompt: `EXPLANATION: ${prose}`,
      responseFormat: { type: "json_object" },
      maxTokens: 400,
      temperature: 0,
    });
    const m = res.text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`no JSON in judge response: ${res.text.slice(0, 120)}`);
    const parsed = JSON.parse(m[0]) as { pass?: unknown; findings?: unknown };
    return {
      pass: parsed.pass === true,
      findings: Array.isArray(parsed.findings)
        ? (parsed.findings as Array<{ span?: unknown; class?: unknown }>)
            .filter((f) => typeof f?.span === "string")
            .map((f) => ({ span: String(f.span).slice(0, 140), class: String(f.class ?? "unspecified") }))
        : [],
    };
  } catch (e) {
    // Fail-closed: judge error is a FAIL.
    return { pass: false, findings: [], judgeError: (e as Error).message.slice(0, 200) };
  }
}
