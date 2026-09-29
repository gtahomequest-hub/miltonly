# MH-011
HOME · D:\miltonly-home · feat/street-design

**The new street page is designed on the real stack at `/design-preview/street`, with fictional data for "Aamir Court". It has three palettes and both views, and it is previewed, NOT merged.** Branch `feat/street-design` is cut from `origin/main @ 467dc60`. The work commit is `f5b3bab`: 8 files, 2,229 lines in, 1 out, and nothing under `/streets` or `src/components/street/` changed. The preview is `https://miltonly-afug36ojd-gtahomequest-hubs-projects.vercel.app/design-preview/street` (`dpl_HLEQMBXgTXtkjwY7Twb1sRuiy78k`), the only one (DEC-ONE-PREVIEW). Switch with `?palette=a|b|c` and `?view=visitor|registered`; `?n=12` opens with the finder filled.

- **The page.** It has the 14 sections of the brief, in order:
  - The header carries the registrant line at 14px.
  - The finder answers "No such address on Aamir Court in the Town's records." for a number that is not there.
  - The roster lays the even and odd sides out on either side of a drawn road. A visitor sees "History · sign in" on all 42 rows. A registered reader sees each sale, or "No sale recorded since Sep 2024", and the found row adds "Is this your home? Get its report".
  - There are 14 facts: 8 public and 6 gated.
  - The listing card names its brokerage.
  - "What changed" shows its dated rows, and "Home sold" appears for registered readers only.
  - The sold table and the listing features are gated, with a static SVG map and the video card.
  - The note is three lines, signed and dated.
  - Then the three actions, the links and the full compliance footer.
  - In the visitor view, gated numbers are not in the HTML at all.
- **The palettes.** The brand greens are shared by all three: forest `#073126`, accent `#017848`, and `#00ff80` on lead-capture buttons only. Each palette adds one hue, in three strengths.

| | A · Clay | B · Lake | C · Harvest |
|---|---|---|---|
| Page / card | `#f6f4ef` / `#ffffff` | `#f2f5f4` / `#ffffff` | `#f8f5ec` / `#ffffff` |
| Ink / muted / rule | `#1c2621` / `#535c57` / `#dcd8cf` | `#15231e` / `#505d58` / `#d6dedb` | `#1d2520` / `#555a51` / `#e0d9c6` |
| Support / tint / on forest | `#a3401c` / `#f6e6dc` / `#f4a582` | `#275a86` / `#e1ecf5` / `#9cc8ef` | `#855700` / `#f5e8c8` / `#f2c65a` |
| Ink on page | 14.17:1 | 14.83:1 | 14.40:1 |
| Muted on page / on tint | 6.29 / 5.69:1 | 6.28 / 5.75:1 | 6.49 / 5.82:1 |
| Accent on page | 5.05:1 | 5.06:1 | 5.09:1 |
| Support on page / on tint | 5.78 / 5.22:1 | 6.62 / 6.06:1 | 5.73 / 5.14:1 |
| Support on forest | 7.15:1 | 8.08:1 | 8.81:1 |
| Lowest text element measured in the browser | 5.05:1 | 5.06:1 | 5.09:1 |

  All three share white on forest 14.22:1, soft white `#c3d6cd` on forest 9.36:1, forest on `#00ff80` 10.58:1 and white on accent 5.55:1. The full table is 21 pairs per palette, 0 under 4.5:1, in `scratchpad/mh011/contrast.md`, generated from the same `palettes.ts` the page reads.
- **My pick is A, Clay.**
  - Its page colour is the brand cream `#f6f4ef`, already a site token.
  - Brick red is the one warm note against the greens, and it cannot be mistaken for a link, because links here are green.
  - It ties the page to Milton brick and the escarpment's red shale.
  - Its light version on forest gives the hero edge and the "for sale" dot some life without shouting.
  - **B** is the calmest, but blue beside green links reads as a second link colour, so the dates and the found row look clickable.
  - **C**'s gold on forest sits next to the gold-to-red wordmark and weakens the rule that only the logo uses that gradient, and its text ochre reads brown at 13px.
- **Proof on the preview** (`scratchpad/mh011/verify.mjs`, `verify-preview.log`): **PASS.** All 12 palette, view and width combinations answer 200 with `noindex, nofollow, nocache`. The visitor HTML contains none of the 14 sold prices or the 6 gated values. Every element painted `#00ff80` is a lead-capture button ("Get the home report", "Register free"). No text element is under 4.5:1, and nothing scrolls sideways at 390 or 1280. `/sitemap.xml` and `/` do not mention `design-preview`.
- **The gate:**
  - Local gate: `corepack pnpm build` from Git Bash, exit 0, with the route listed as `ƒ /design-preview/street`.
  - Local battery at `f5b3bab`, with `/api/build` serving that SHA: `--only=homepage,nav,hub-meta,phone-390` `PASS · 4 checks · 719 pages · 154s`.
  - The preview's `/api/build` answers `unknown`, because this CLI deploy did not pass the SHA in, so the battery was not run against it. It was deployed from this worktree with a clean tracked tree at `f5b3bab`.
- **Screenshots:** `scratchpad/mh011/shots/`, 12 full pages (`<palette>-<view>-desktop-1280.png` and `-phone-390.png`) plus `extra-finder-no-match-390-0.png`. They total 19 MB.
- **Choices I made:**
  - The brief's "median price" fact is labelled "Typical sale price", per the voice rule.
  - There is no `/sources` page and no error-report page yet, so "Sources" links to a sources paragraph in the footer, and "Report an error" is a `mailto` with the street in the subject.
  - The footer email is `contactEmail()`, falling back to `config.realtor.email` in this preview only.
  - Action buttons go to `#actions`, so no lead is written.
  - "Watch this street" is forest, not green, so the green stays scarce.
  - `ChromeGate` drops the chat widget and the consent banner on `/design-preview/`.
  - `scripts/test-vow-branding.ts` adds this page to its list of exempt noindex previews. The rule's own comment exempts design previews, and the build failed without the entry. The header carries `data-registrant` hooks, and the page that ships must render `RegistrantStrip` or be added to the header marks that rule accepts.
- **For Core:** nothing to merge. This is a design for review. If it is approved, building the real street page is its own brief, inside the MC-048 heading freeze until 2026-10-26.

Report: scratchpad/reports/MH-011-street-design.md
