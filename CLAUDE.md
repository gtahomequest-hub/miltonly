# Miltonly

**Read `HANDOFF.md` and `QUEUE.md` before any task.**

## The three rules

Every page must have best-in-class SEO, best-in-class conversion, and a layout unlike industry norms. A page that cannot meet all three is not built.

## Compliance

- `src/lib/ai/compliance.ts` is the only file that makes external LLM calls, and `assertPromptSafe` runs on every call site.
- No MLS identifiers and no broker-private remarks in any prompt, ever.
- `AI_PROVIDER` must be set (`phase41_v2` in prod). Unset throws; there is no silent default.

## k-anonymity (VOW)

- k5 for a point "typical", k10 for a range.
- Suppression returns `null`, never `0`. Individual sold prices are never served unauthenticated.

## Names

- `src/lib/streetName.ts` `resolveStreetName` is the only source of a street name on any surface, on **both** upsert branches (create and update).
- The Town registry is the authority. `shortName` never appears in prose or headings.

## Invariants

- **DEC-PH41-DUALWRITE:** a `StreetContent` row must exist for every published street. Five non-renderer read paths depend on it.
- **Publish floor = entity floor:** no page for a street absent from both the registry and the off-registry allowlist.
- Every successful `StreetContent` write triggers on-demand revalidation of its page, `/streets`, and its hub.

## Voice

No em-dashes. En-dash only between numerals. No superlatives. Say "typical", never "median".

## Design tokens

`#073126` base, `#017848` accent, `#00ff80` CTA only, `#f6f4ef` cream. Fraunces via `var(--font-fraunces)`, Inter, JetBrains Mono.

## Build and gates

- **pnpm only.** Local gate is `pnpm build > build.log 2>&1`, judged by **exit code**, never a log grep. Never `npm run build`.
- Read schemas and files before writing code. Never guess a field name.
- No merge to main without a Vercel preview URL and explicit approval.
- Prod verification is `npx vercel ls --prod` plus `BASE=https://miltonly.com node scripts/verify/run.mjs` with the expected SHA.
- **Stop-on-failure** means: stop, diagnose, and continue only if the failure is isolated and pre-existing, saying so explicitly. Systemic failures halt the run.

## Working discipline

- Read with grep, head, and line ranges. Never whole files.
- Build logs go to a file. Return the exit code and grep hits only.
- Full report to `scratchpad/reports/NNN-slug.md`. The terminal gets 10 lines or fewer.
- End every task by rewriting `HANDOFF.md`, marking `QUEUE.md`, committing, and pushing.

## Windows and PowerShell

- Heredocs use `@'...'@`.
- Scripts need `loadEnvLocal()` and a dynamic import of `@prisma/client`.
- `NODE_OPTIONS="--conditions=react-server"` for scripts that import server modules.
- Final response copied with `Set-Clipboard`.
