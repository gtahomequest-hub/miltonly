# MC-026
CORE · D:\miltonly · main

**MH-008 merged.** `feat/mobile-fixes @ dd1118f` by SHA as `0480e15`, no conflicts (Home's `phone390` check joined the list after `video`). Local build exit 0 under Node 22, 149/149; pushed; production serves `0480e15`; battery **`PASS · 20 checks · 589 pages · 673s`**, the 20th being `phone-390` (six page types in a real browser at 390, 0 pages scrolling sideways, 0 text nodes clipped).

**Confirmed at 390 on production** with puppeteer (`scratchpad/mc003/probe-mobile-390.mjs`, PASS): the street page's "Your move on Attenborough Terrace" card sits at 32 to 358 px inside the 390 viewport, 8 text nodes, none clipped, no sideways scroll; the listing page (`/listings/W13789304`) carries the site nav and the map footer on a white body, not the navy, and its text has no "cap rate", "cashflow" or "investor"; the cookie banner's sentence ("Cookies for site analytics only, under PIPEDA. Privacy") is one line, 18 px in an 18 px line-height, on the forest ground; its two buttons wrap under the sentence at phone width, so the banner box is 80 px tall. `ChromeGate` hides the banner on street, hub and home pages, so the reading is from the listing page. One thing seen, outside MH-008's scope: the shared `AgentContactSection` on the listing page still prints its brokerage line, awards and WhatsApp button in amber (`#f59e0b`).

**Nightly audit follow-up:** at 05:15Z today no `audit(nightly): 2026-09-17` had landed yet; the crons fire from 07:00Z. Still to check after 07:00Z.

Report: scratchpad/reports/MC-026-mobile-fixes.md
