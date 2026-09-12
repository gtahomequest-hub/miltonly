# Handoff — audit worktree

AUDIT · D:\miltonly-audit · feat/audit

_Created 2026-09-12 (MA-001): the street page audited on production._

## What this worktree is

It owns `scripts/audit/` only. It reads production and previews and writes reports. It never edits a
page, a component, a library file or the schema. Reports open with `code D:\miltonly-audit <path>`.

## READ THIS FIRST

**MA-001 is done and its report is the record:** `scratchpad/reports/MA-001-street-page-audit.md`.
Thirty defects ranked S1 to S4, a benchmark against Rightmove, Zoopla, HouseSigma, Zolo, Realtor.ca and
Zillow, and ten changes in priority order. Nothing was built; the ten changes are for core to take.

**The five S1 findings, in one line each.** (1) 427 of 490 street pages answer `REVALIDATED` at TTFB
p50 2.5 s because `revalidate = 3600` outlives the traffic, and 47 pages are outside the prerender
manifest and served `no-store` on every request. (2) Listing tiles load the raw 3,840 px TRREB photo as a
CSS background: Main Street is 16.3 MB on a phone. (3) Mobile LCP 4.5 to 6.4 s on all ten, render delay
dominated by 328 KB of fonts, the pixel and GTM. (4) The only on-page capture is the last block; every
seller CTA is a hop to `/sell`, four of five without `?street=`. (5) The VOW sold-records gate is at
screen 4 to 9 with no mention above it and a gold button.

**The cache sweep is the number to re-run after any fix to (1):**
`BASE=https://miltonly.com node scripts/audit/cache-sweep.mjs` prints the HIT / REVALIDATED / MISS split
and TTFB percentiles over every published page, and lists the pages matched by `/streets/[slug]`.

## Tooling (all under `scripts/audit/`, all read-only against the host)

| script | what it does |
|---|---|
| `streets.json` | the ten audit streets and their shapes |
| `pick-streets.mjs` | picks shapes from the record (DB1 + DB2), for re-selecting the sample |
| `street-page.mjs` | Puppeteer: head, headings, JSON-LD, links, images, video, CTAs and forms against the fold, sections, tap targets, font floors, contrast, fold text, ladder, road facts, screenshots, at 1440 and 390. `--only=slug` |
| `lighthouse.mjs` | Lighthouse mobile + desktop per street; `LH_BIN` points at an installed CLI (not a repo dependency; the session installed lighthouse@12 in its scratchpad) |
| `inbound-links.mjs` | crawls the sitemap and counts pages linking to each audit street |
| `bytes.mjs` | bytes on the wire per resource type via CDP at 390 px; `--throttle` for slow 4G |
| `cache-sweep.mjs` | one GET per published street: `x-vercel-cache`, `x-matched-path`, TTFB |
| `crops.mjs` | per-section screenshots at 390 px for visual review |

Chrome: the puppeteer cache on this machine has no `chrome.exe`; every script uses the installed Chrome at
`C:/Program Files/Google/Chrome/Application/chrome.exe`, overridable with `CHROME_PATH`.

Raw output lives in `scratchpad/audit/MA-001/` and is untracked (about 120 MB with the Lighthouse JSON).

## Where things stand

| | |
|---|---|
| `feat/audit` | MA-001 report and tooling, nothing else |
| production audited | `f01a96a`, 2026-09-12 |
| pages edited | none |
| next | whatever the next `MA-` prompt asks; the ten changes belong to core |
