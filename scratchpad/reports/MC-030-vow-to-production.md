# MC-030

CORE · D:\miltonly · main

1. Pushed `main` (`e606d8b..c83fffb`) once production answered 200; Vercel built `miltonly-82uy36xiw` to Ready in 2m and `/api/build` answers `c83fffb5c642143f08befa75c89d8790fef5a79c`, the pushed head, which carries merge `5994cc7` (the two docs commits on top change no code), so that is the SHA the battery expects.
2. Purged `db2`, `db3` and the 22 hubs through `/api/revalidate` (22/22 answered 200), then the full battery: `FAIL · 21 checks · 644 pages · 910s` (`scratchpad/mc003/battery-mc030-prod-c83fffb.log`), every failing line one street, `dinsmore-drive-milton`, published by the creation cron at 02:01Z one minute after the crawl read a 644-page sitemap (645 rows by the end, 1259 of 1260 URLs read, Beaty's ladder 68 vs 67). Isolated and pre-existing in kind (the creation-cron hour in HANDOFF); the page answers 200.
3. Purged again (tags, hubs, `/`, `/streets`) and reran the four affected checks: `PASS · 4 checks · 645 pages · 596s` on `homepage,hub-page,hub-meta,catchment` (`battery-mc030-prod-c83fffb-rerun.log`). The other 17 checks passed in the full run, `vow-fields` 15 of 15.
4. Anonymous listing page `W13800708` (curl, `x-vercel-cache: MISS`): zero occurrences of the seven VOW keys; the only "days on market" and "price history" text is the sign-in invitation and the market edition's aggregate "after 88 days on market", both listed as kept; `/api/listings/W13800708/vow` answers `{"canSee":false,"needsAcknowledgement":false}`.
5. Signed in and acknowledged, per the battery: the gated route answers the facts (an integer `daysOnMarket`, a string `listedAt`), the listing page island renders them, the grid cards carry them, and carry none anonymously; 16 of 16 public surfaces carry no VOW-only field; 474 listing URLs checked against DB1, 0 lacking `permAdvertise` or off market.
6. Brokerage line: 5 of 5 surfaces measured in the browser, 0 with no brokerage element, 0 brokerage elements differing from their price in size, weight, colour or face; on the listing page the element sits inside `[data-price]` with `font:inherit;color:inherit`.
7. Left on production: one more sign-in email in the desk's inbox from the battery's door sign-in. Nothing else.

Report: scratchpad/reports/MC-030-vow-to-production.md
