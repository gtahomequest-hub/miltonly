# MC-001

**Worktree:** `D:\miltonly` (CORE) · **Branch:** `main`

`CLAUDE.md` gains a **Reporting** section and loses the `Set-Clipboard` rule. Docs only: no code, no build, no deploy.

- **Reporting** added between *Working discipline* and *Windows and PowerShell*: task-ID prefixes (`MC-` core, `MH-` home, `MCT-` content, `ML-` leads), the verbatim summary written to `scratchpad/reports/<TASK-ID>-<slug>.md` and tracked in git, first line `# <TASK-ID>`, `code <path>` to open it, and `Report: <path>` as the reply's last line. "No clipboard writes from any session" is stated there as a standing prohibition, not only as a deleted rule.
- **`- Final response copied with `Set-Clipboard`.`** removed from *Windows and PowerShell*, which now carries three lines.
- **One line changed beyond the brief, to stop two rules disagreeing.** *Working discipline* said `Full report to scratchpad/reports/NNN-slug.md`, and the new scheme is `<TASK-ID>-<slug>`. Left alone it would have named a numbering the Reporting section replaces, so it now reads "named and opened per **Reporting** below". The NNN files already on disk (058, 065–068) are untouched.
- **Verified** `scratchpad/reports/` is tracked and carries no `.gitignore` entry, so "tracked in git" needs no further change.
- This report is the first file written under the new rule.

Committed as `chore: reporting rule` and pushed. Production is unchanged and green at `8db80da`, `PASS · 11 checks · 449 pages`.
