# Task A — settled. Task B sweep still running.

## Why Anthropic was called: the local shell had `AI_PROVIDER=""`

```
generateStreet.ts:31   "AI_PROVIDER unset OR 'anthropic' -> legacy 300-word Anthropic path (default)"
generateStreet.ts:37   isV2()        -> AI_PROVIDER === "deepseek_v2"   -> false ("")
generateStreet.ts:45   isPhase41V2() -> AI_PROVIDER === "phase41_v2"    -> false ("")
-> falls through to compliance.ts:169 generateStreetDescription
   which calls anthropic.messages.create directly at :183
```

**No DeepSeek attempt was made.** Both DeepSeek entry points are gated behind those flags — `generateLongFormStreetDescription` at `generateStreet.ts:187` sits behind `isV2()`, and the phase-4.1 dispatch (`callDeepSeek` at `compliance.ts:1222`) sits behind `isPhase41V2()`. With an empty flag neither branch was entered, so the credit error came from the *first and only* provider call.

## Production vs the shell

The premise is right about **production** and wrong about **the shell the regeneration ran in**. Production has `AI_PROVIDER` set (Config, 100d old), and `PHASE41_HALT` exists there too — a variable only the phase-4.1 path reads, which is corroborating evidence that production runs `phase41_v2`. The value was not read, per "names only".

Production env, names only:

```
AI_PROVIDER            Config    Production                          100d ago
AI_PROVIDER_FALLBACK   Config    Production                          100d ago
AI_PROVIDER_MARKET     Config    Production                          100d ago
DEEPSEEK_API_KEY       Secret    Production                          100d ago
ANTHROPIC_API_KEY      Config    Production, Preview, Development    147d ago
PHASE41_HALT
```

`DEEPSEEK_API_KEY` **is** set in production. It is also present locally — DeepSeek was available, just never selected.

**Consequence:** the step 5 regeneration would likely have succeeded had it run with production's `AI_PROVIDER`. Worth re-running that way rather than buying Anthropic credits.

## Provider dispatch, for reference

| `AI_PROVIDER` | path | provider |
|---|---|---|
| unset or `""` or `anthropic` | legacy 300-word, `compliance.ts:169` | Anthropic direct (`:183`) |
| `deepseek_v2` | 7-pass long-form, `generateStreet.ts:187` | DeepSeek (`deepseek-v4-flash`) |
| `phase41_v2` | structured 8-section + FAQ (production) | per-section via `AI_PROVIDER_MARKET`/`_AHA`/`_EVAL`, dispatching `callClaude` (`compliance.ts:1215`) or `callDeepSeek` (`:1222`) |

## Task B — first finding, already measured

```
curl -I https://www.miltonly.com/                    -> 308  Location: https://miltonly.com/
curl -I https://www.miltonly.com/listings/W13055010  -> 308  Location: https://miltonly.com/listings/W13055010
curl -I https://miltonly.com/                        -> 200
```

**www already 308s to apex** — so this is not a missing redirect. The remaining question is whether anything still mints www URLs or the GSC data is historical. The four-angle sweep (canonical builders, literal www occurrences, host-derived absolute URLs, and whether the canonical-host flip predates the GSC window) is still running; full Task B report follows.
