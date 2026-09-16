# MC-024
CORE · D:\miltonly · main

**The Rent menu merged.** `feat/rent-menu @ 91f8ef0` (MH-007 and its addendum: typical rent for the whole home and the basement unit apart, approved) by SHA as `1b2d7d8`, after the MC-025 merges. One conflict, `HANDOFF-home.md` (Core's merged banner against Home's rewrite), resolved to Home's text under a banner that says both chrome branches are merged. Local build exit 0 under Node 22, 149/149; pushed; production serves `1b2d7d8`; battery **`PASS · 19 checks · 569 pages · 694s`**.

**Confirmed at 1024 on production** with puppeteer (`scratchpad/mc003/probe-rent-1024.mjs`, PASS): four triggers in the bar, Buy 250 to 294 px, Rent 322 to 372, Streets 400 to 463, Sell 491 to 535; the bar search 327 px wide (433 to 760) on a street page, where it shows unscrolled (the homepage shows it on scroll, by design); the CTA 796 to 992; nothing overlaps, no horizontal overflow. The Rent panel opens on hover and its Typical rent rail states, from the Board's closed leases over 12 months: Detached, whole home $3,500/mo (309 leases); Detached, basement unit $1,750/mo (191); Semi-detached, whole home $3,300/mo (107); Semi-detached, basement unit $1,500/mo (19); Townhouse, whole home $3,000/mo (606); and on. The panel's "Available now" figure is 1,161.

**Marked done** in QUEUE (the out-of-queue record) and in HANDOFF-home's banner.

Report: scratchpad/reports/MC-024-rent-menu.md
