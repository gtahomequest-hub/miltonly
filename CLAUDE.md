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
- Local `DATABASE_URL` carries `connection_limit=10`. At 1 the build failed 5 to 17 prerenders on `P2024` pool timeouts and passed on identical code, so the gate could not be trusted.
- Read schemas and files before writing code. Never guess a field name.
- No merge to main without a Vercel preview URL and explicit approval.

## Decisions

- **DEC-MERGE-CORE-ONLY:** only Core (`D:\miltonly`, `main`) merges to `main`, by SHA, never by branch name, after confirming the SHA against the Builder's report.
- **DEC-ONE-PREVIEW:** a task that changes code deploys one preview (`npx vercel deploy --yes` from its worktree, after the local gate and a local battery); a second needs a sentence in the report naming the check only Vercel can run; a task that changes no code deploys none and takes the production build as its proof.
- **DEC-BATCH-MERGE (MC-035):** Core merges approved SHAs in batches of two or three: one battery, one production deploy per batch. Builders keep working in parallel; only the merge cadence changes. SHAs waiting for a batch are listed in `HANDOFF.md` under "held for the next batch". **The exception:** a fix for a live production defect merges and deploys immediately, alone. MA-007 measured why: seven production deploys in 24 hours, each wiping the street ISR entries, were most of the route's origin renders.
- Prod verification is `npx vercel ls --prod` plus `BASE=https://miltonly.com node scripts/verify/run.mjs` with the expected SHA.
- **Stop-on-failure** means: stop, diagnose, and continue only if the failure is isolated and pre-existing, saying so explicitly. Systemic failures halt the run.

## Working discipline

- Read with grep, head, and line ranges. Never whole files.
- Build logs go to a file. Return the exit code and grep hits only.
- Full report to `scratchpad/reports/`, named and opened per **Reporting** below. The terminal gets 10 lines or fewer.
- End every task by rewriting `HANDOFF.md`, marking `QUEUE.md`, committing, and pushing.

## Reporting

- **Every task prompt begins with a task ID.** `MC-` core, `MH-` home, `MCT-` content, `ML-` leads, `MA-` audit.
- At the end of every task, write the final summary **verbatim** to
  `scratchpad/reports/<TASK-ID>-<slug>.md`. Verbatim means the file and the reply say the same
  thing: write the file first, then paste it into the reply, so the two cannot drift.
- The file is **tracked in git**. It is committed with the task's work, not left untracked.
- Its first line is `# <TASK-ID>` and nothing else on that line.
- The **last line of the reply** is `Report: <path>`. Nothing opens the editor.
- **No clipboard writes from any session.**

## Worktrees and the nightly audit

- `D:\miltonly` (main) is Core. `D:\miltonly-home`, `D:\miltonly-content`, `D:\miltonly-leads` own their tiers. `D:\miltonly-audit` (`feat/audit`) is Audit: it owns `scripts/audit/`, `.github/workflows/nightly-audit.yml` and `scratchpad/audit/nightly/`, reads production and previews, and never edits a page, a component, a library file or the schema.
- The nightly audit runs on a GitHub runner at 03:00 Toronto and commits `scratchpad/audit/nightly/<date>.md` and `state.json` to `main` as `audit(nightly): <date>`. Pull before you branch or push; that commit lands without a human.
- `vercel.json` `ignoreCommand` lets a Git-triggered build run only on `main`, and on `main` only when the push changes something outside `scratchpad/`, `docs/` and `*.md` (MC-034) since the last successful deployment (`VERCEL_GIT_PREVIOUS_SHA`, so a docs commit on top of a merge still builds the merge); `docs/phase-4.1/` is the exception and always builds, because the generators read those prompt files at runtime. A push to any other branch is cancelled; a branch gets its preview from `npx vercel` in its worktree (CLI deploys do not run the command). A docs-only push (HANDOFF, QUEUE, a report, the nightly audit) does not build; a non-Markdown file under `src/`, `scripts/`, `prisma/`, `public/` or a config file does, and a `.md` anywhere skips unless it is under `docs/phase-4.1/`. Never put app input under `scratchpad/` or `docs/` outside `phase-4.1/`.
- Audit secrets are repository Actions secrets `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, the `.env.local` values.

## Windows and PowerShell

- Heredocs use `@'...'@`.
- Scripts need `loadEnvLocal()` and a dynamic import of `@prisma/client`.
- `NODE_OPTIONS="--conditions=react-server"` for scripts that import server modules.
