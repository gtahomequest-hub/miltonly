#!/usr/bin/env bash
# scripts/vercel-ignore.sh — Vercel's ignoreCommand, out of vercel.json and into a file (MC-040).
#
# EXIT 0 = SKIP the build. EXIT 1 = BUILD. That is Vercel's convention, and it is the wrong way
# round from every other exit code in this repo, so it is written out in words at every exit.
#
# WHY A FILE. The rule lived as a 250-character one-liner against Vercel's 256-character limit, so
# the next exclusion did not fit. It is also the only rule here that could not be read, tested or
# reviewed. `scripts/test-vercel-ignore.ts` runs it against real SHAs from our own history.
#
# THE ASYMMETRY THAT GOVERNS EVERY BRANCH BELOW. A rule that builds when it did not need to costs
# two or three billed minutes and somebody notices at month end. A rule that SKIPS a build it
# should have run ships nothing, silently, and nobody notices until a page is stale. So every
# uncertain path BUILDS: no git, no repository, a base the clone does not carry, a diff that
# errors. MC-034's first attempt diffed the tip commit alone and would have skipped every merge
# that ended in a docs commit, which is every task in this repo.
#
# WHAT IS EXCLUDED, and why each one is safe to skip:
#   scratchpad/     working notes, task evidence, the nightly audit and the morning report; the
#                   app never reads it (CLAUDE.md: never put app input under scratchpad/).
#   docs/           prose for humans, with ONE exception handled above it: docs/phase-4.1/ holds
#                   the prompt files compliance.ts and the generators read AT RUNTIME, so a change
#                   there always builds.
#   *.md            HANDOFF, QUEUE, reports, READMEs anywhere in the tree.
#   scripts/audit/  the Audit worktree's own tooling (CLAUDE.md gives it that path). It runs on a
#                   GitHub runner, never inside the app, so an audit-only push changes nothing
#                   Vercel would serve. Added in MC-040 after one such push built the whole site
#                   for byte-identical app code.
# Everything else builds, including .github/workflows/, package.json, prisma/, public/ and any
# non-Markdown file under scripts/.
#
# BY HAND, without pushing:
#   bash scripts/vercel-ignore.sh                     # VERCEL_GIT_PREVIOUS_SHA (or HEAD^) to HEAD
#   bash scripts/vercel-ignore.sh <base> <head>       # any two commits
#   echo $?                                           # 0 = it would skip, 1 = it would build
set -u

say() { echo "[vercel-ignore] $*"; }
build() { say "BUILD: $1"; exit 1; }
skip() { say "SKIP: $1"; exit 0; }

# 1. Branch. Vercel sets VERCEL_GIT_COMMIT_REF; a run by hand has no branch and is judged as main.
REF="${VERCEL_GIT_COMMIT_REF:-main}"
if [ "$REF" != "main" ]; then
  skip "branch ${REF} is not main; branches take their preview from npx vercel in their worktree"
fi

# 2. The range. An argument wins, then Vercel's previous-deployment SHA, then the parent of HEAD.
#    ${VAR:-…} covers a variable that is set but empty, which Vercel does send.
BASE="${1:-${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}}"
HEAD_AT="${2:-HEAD}"

# 3. Everything uncertain builds.
command -v git >/dev/null 2>&1 || build "git is not on PATH"
git rev-parse --git-dir >/dev/null 2>&1 || build "this is not a git repository"
TOP="$(git rev-parse --show-toplevel 2>/dev/null)" || build "cannot find the repository root"
cd "$TOP" || build "cannot enter the repository root"
git cat-file -e "${BASE}^{commit}" 2>/dev/null || build "base ${BASE} is not in this clone (shallow, or a force-push); building rather than guessing"
git cat-file -e "${HEAD_AT}^{commit}" 2>/dev/null || build "head ${HEAD_AT} is not in this clone; building rather than guessing"

# 4. The runtime prompt files always build.
git diff --quiet "$BASE" "$HEAD_AT" -- docs/phase-4.1
case $? in
  0) ;;
  1) build "docs/phase-4.1 changed; the generators read those prompt files at runtime" ;;
  *) build "git diff failed on docs/phase-4.1" ;;
esac

# 5. Anything outside the excluded paths builds.
git diff --quiet "$BASE" "$HEAD_AT" -- . ':!scratchpad' ':!docs' ':!*.md' ':!scripts/audit'
case $? in
  0) skip "${BASE}..${HEAD_AT} touches only scratchpad/, docs/, *.md or scripts/audit/" ;;
  1) build "$(git diff --name-only "$BASE" "$HEAD_AT" -- . ':!scratchpad' ':!docs' ':!*.md' ':!scripts/audit' | head -3 | tr '\n' ' ')" ;;
  *) build "git diff failed on the main pathspec" ;;
esac
