# MH-002
HOME · D:\miltonly-home · feat/menu-v2

**Preview:** https://miltonly-p3vklhhp6-gtahomequest-hubs-projects.vercel.app (alias `miltonly-git-feat-menu-v2`)
**Head SHA: `266f0f458a4fe65571242dc0b24f04fe496aedc7`**, not merged. Commits after it are docs only.

- `origin/main` merged twice: at `4a893d3` before MC-006 landed, then at `854ffd3` after it (`339293d` confirmed on main). One conflict, `scripts/verify/run.mjs` + README, both sides adding a check; kept both.
- The menu: `<button>` triggers with `aria-expanded`/`aria-controls`; one full-bleed band under the bar capped at the viewport; hover opens after 120ms of intent (mouse only) and leaving the nav closes; click toggles; Enter/Space/ArrowDown open and move focus into the panel; Escape closes and returns focus; Tab out, outside click, scroll and resize close. All three panels are in the served HTML on every page, closed with `hidden`. Type floor 14px throughout.
- Alive on every page: `src/lib/megaLive.ts` (`composeMegaLive`, the only place a menu string is built; `getMegaLive()` memoised 5 min) behind `SiteNavLive`, swapped into 21 server pages; 3 client pages take `live` from their parents. Each panel opens with one true sentence from live figures. Buy: four listings with photographs through the display gate. Streets: a street search, all 22 hubs with live counts, four posters. Sell: three Board figures with window and sample. Three strips from three queries (active listings by street; GSC impressions, with a 12-month-sales fallback whose label says so; 12-month sales), every link a published page. `/map` and `/book` removed (redirects); `/guides` and `/market-watch` added. Formatters unified in `src/lib/figureFormat.ts`, imported by the Board too.
- Gate: `scripts/verify/checks/nav.mjs` reads five page types statically, then drives Chrome at 380, 1024 and 1440 on `/` and `/streets` (hover, leave, click, outside click, Enter, Tab, Escape, ArrowDown, geometry inside the viewport with no internal scroll, no text under 14px, photographs, phone panel filling the viewport with every desktop link and the same live content). `homepage.mjs` asserts `<button>` triggers and checks the three menu lead figures by value and format.
- `pnpm build` exit 0 at `10536c6` and `266f0f4`, zero `P2024`, 556 static pages. Battery on the preview at `266f0f4`: **`PASS · 14 checks · 456 pages · 187s`**, exit 0.
- Left as is: the footer's `/book` link (a 307, outside this task). The design was checked from screenshots at three widths, not by hand.

Report: scratchpad/reports/MH-002-menu-v2.md
