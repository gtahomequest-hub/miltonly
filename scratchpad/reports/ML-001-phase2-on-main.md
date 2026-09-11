# ML-001

LEADS · D:\miltonly-leads · feat/leads

1. **Phase 2 is on main.** `git merge-base --is-ancestor 26381f9 origin/main` passes; Core merged it as `543ef99`, and main is now `00e0eb1`.
2. Merged `origin/main` into `feat/leads`: a fast-forward to `00e0eb1`. `git diff --stat origin/main HEAD` is empty, so the trees match.
3. `BRIEF_UNSUBSCRIBE_SECRET` set in Production and Preview as a sensitive variable via stdin, 32 random bytes hex, one value for both. It binds on each environment's next deploy; until then the running builds still sign with `CRON_SECRET`. Production brief watches are 0, so no live link breaks at the switch.
4. `HANDOFF-leads.md` rewritten to the merged state; the Phase 2 line in `QUEUE.md` marked done. No build was run: the branch carries no code change over main.
5. Pushed. Nothing for Core to merge from this branch.

Report: scratchpad/reports/ML-001-phase2-on-main.md
