# MC-028
CORE · D:\miltonly · main

1. Four merges by SHA, in order, each behind the full local gate on Node 22 (exit 0): `fix/favicon @ 9144b35` as `ea81883`, `feat/street-v3 @ 2553f2e` as `e078e91`, `feat/portal @ 86d5f9f` as `706ce07`, `feat/leads @ 7eeeb79` as `7196623`.
2. Three resolutions, in the merge commits: the prebuild line unioned (`test-hub-truth`, `test-portal-door`); `SoldRecordsIsland` keeps MH-005's gate in the served HTML under MP-002's ack card; `AddressLadder` takes Leads' "listed for sale", and Street v3's new `StreetCapture` was brought under ML-004's consent rule (fine print rendered and sent as `consentText`), which its gate demands.
3. `prisma migrate status` after the portal merge: clean, 30 migrations, `portal_door` already applied.
4. Production serves `7196623`; battery **`PASS · 20 checks · 609 pages · 713s`**.
5. `/favicon.ico` on production is byte-identical to `src/app/favicon.ico` (3,660 bytes, the three-size Miltonly mark).
6. `/streets/main-street-milton` serves the hero capture field (`<form class="s-capture" id="capture">`) and the ladder's "Find a house number" box (`5 to 6895`).
7. Sign-in from that street: the emailed link carries `r=/streets/main-street-milton#sold-records`, the code path answered `redirect: /streets/main-street-milton#sold-records`, and the session then reads `needsAcknowledgement: true`, the inline VOW card.
8. One forced brief send (Resend `01a0b291-c9e2-7233-8992-1bcebee4897c`) carries the CASL footer: sender, brokerage, mailing address, why, one-click unsubscribe; the link disabled the watch (dry run: 0 subscribers).
9. Lighthouse mobile, main-street: perf 90, SEO 100, a11y 100, best-practices 79 (the Meta pixel's `fr` cookie, older than this batch), LCP 3.6 s, CLS 0, TBT 34 ms; MH-006 had perf 71, a11y 91, LCP 6.4 s.
10. Street Page v3, Portal slice 1 and ML-004 marked done in QUEUE; HANDOFF rewritten (main `7196623`, the proofs' two rows left on production); committed and pushed.

Report: scratchpad/reports/MC-028-four-merges.md
