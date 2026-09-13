# MH-001
HOME · D:\miltonly-home · fix/menu-hotfix

**Preview:** https://miltonly-isrc7ku73-gtahomequest-hubs-projects.vercel.app
**Head SHA for Core to merge: `339293de98b56066b7c759c7420efce0b3b30740`** (commits after it are docs only; `git diff 339293d..HEAD -- src scripts` is empty).

- `origin/main` (`00e0eb1`) merged in as `e2a7f19`. One conflict: main deleted `src/components/hub/hub-sections.css` with the reverted hub rebuild (`2e3cc50`), this branch had modified it. Deleted; nothing imports it. The branch's two hub-contrast fixes to that file went with it, and the same defect was found and fixed on the template that is actually on main: `--h-text-faint` in `hub-theme.css` 0.45 -> 0.56 (`339293d`), because every hub hero's small text (tile labels, intent subtitles, crumb) measured 4.05:1 on all 22 hubs. The hub parsers in `scripts/verify` (`90efab8`) stay: they read the `h-` tiles first and only fall through to `hh-`.
- Probes committed under `scripts/`: `probe-mobile-menu.mjs`, `probe-hub-contrast.mjs`, both taking a base URL (`7aa03cf`).
- `pnpm build` exit 0 at `e2a7f19` and again at `339293d`: zero `P2024`, 23/23 prebuild, 549 static pages.
- Battery on the preview at `339293d`: **`PASS · 11 checks · 449 pages · 89s`**, exit 0. The first run at `e2a7f19` failed `hub-meta` on `scott` alone (page 121 sales, live 122); the page served 122 seconds later and the re-run passed. A moving count read across a cache boundary, not a code defect.
- Confirmed on the preview at 380: mobile panel is `position:fixed`, 380x780 from top 0 on `/` and `/streets`, zero containing-block traps; Walker's three tiles print `$1.03M` / `54` / `18` at 30px white with no overflow and no row on the hub under 4.5:1; footer text contains zero em-dashes; Sell panel renders `$924,000` / `28 days` / `98.1%`.

Report: scratchpad/reports/MH-001-menu-hotfix-merge-main.md
