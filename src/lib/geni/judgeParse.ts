// src/lib/geni/judgeParse.ts
// GENI Phase 1 — STAGE 3: OHRC semantic judge on the PARSE. Adapts the street judge
// (compliance.ts FAIR_HOUSING_JUDGE_PROMPT) to the area-finder: same Ontario Human Rights
// Code banned-class taxonomy, framing swapped from "this street" to "an area / neighbourhood",
// and it judges the USER SENTENCE + the parsed criteria (not generated prose). It catches a
// proxy that slipped past the Stage-1 deterministic scan. temperature 0, FAIL-CLOSED.
import { callDeepSeek } from "@/lib/ai/compliance";
import type { GeniCriteria } from "./parsePrompt";

const AREA_JUDGE_PROMPT = `You are a fair-housing compliance judge for a Milton neighbourhood-finder in Ontario, Canada. You judge the USER'S search sentence (and the criteria parsed from it). Judge ONE question: does the request characterize WHO lives in, belongs in, or should live in / buy in an AREA — i.e. does it try to select neighbourhoods by the people rather than by objective housing facts?

Banned characterization classes (Ontario Human Rights Code grounds and their proxies): family status ("family area/neighbourhood", "good for families/kids", "family-friendly"), age or life stage ("young professionals", "retirees", "downsizers", "first-time buyers" AS the area's people), occupation/income/class ("where professionals/wealthy/educated people live", "upscale/posh/classy area", "nice/good/bad part of town"), religion, ethnicity, race or origin, tenure characterization ("owner-occupied area", "no renters"), safety/crime as an area-quality proxy ("safe/unsafe neighbourhood", "sketchy area"), community-closeness or composition proxies ("people like us", "our kind", "close-knit"), and buyer-class suitability ("an area for families and professionals", "where the right kind of people settle").

NOT violations (leave these alone): objective housing facts — price / budget, property type, bedrooms, bathrooms, square footage, lot size, distance to the GO station, sales activity (fast-selling / high-volume), sale vs rent. Plain factual asks about those PASS.

Calibration — FAIL: "safe family neighbourhood" (family status + safety proxy). "an area where established professionals put down roots" (occupation/buyer-class). "a nicer part of town under $1M" (area-quality proxy). "somewhere our kind of people would feel at home" (community composition). Versus PASS: "detached under $1.1M near the GO" (objective). "3-bed townhouse, high sales volume" (objective). "condo under $800k for rent" (objective).

Return ONLY a JSON object: {"pass": boolean, "findings": [{"span": "<verbatim offending text, <=140 chars>", "class": "<banned class>"}]}. Empty findings when pass is true. No commentary.`;

export interface ParseVerdict {
  pass: boolean;
  findings: Array<{ span: string; class: string }>;
  judgeError?: string;
}

export async function judgeParse(sentence: string, criteria: GeniCriteria): Promise<ParseVerdict> {
  try {
    const body = `SENTENCE: ${sentence}\nPARSED CRITERIA: ${JSON.stringify(criteria)}`;
    const res = await callDeepSeek({
      systemPrompt: AREA_JUDGE_PROMPT,
      userPrompt: body,
      maxTokens: 500,
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
    // Fail-closed: a judge error is a FAIL, never a silent pass.
    return { pass: false, findings: [], judgeError: (e as Error).message.slice(0, 200) };
  }
}
