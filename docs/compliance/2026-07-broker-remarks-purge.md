# Compliance remediation — VOW broker-only remarks purge

**Status:** source stopped + purge PREPARED on `feat/compliance-remarks-purge`. The data-destructive
purge is **NOT YET EXECUTED** — it runs on prod only after the requester's gate.

## What / why
`sold.sold_records.broker_remarks` (ingested from AMPRE `PrivateRemarks`) held **broker-only VOW
data** — showing instructions and lockbox/access references — not licensed for retention under the
PropTx/VOW data agreement, plus a security exposure (access-code language in free text). The same
`PrivateRemarks` was also retained inside the `raw_vow_data` jsonb catch-all. Remediation is a
**purge** (not quarantine — relocating retained data does not cure the retention violation; not
selective-null — a regex cannot reliably catch every lockbox string in free text from hundreds of
agents, and a miss leaves the violation while looking clean).

## Verification (read-only) — corrects the incident description
| Item | Incident description | Verified (2026-07) |
|------|----------------------|--------------------|
| Column name | `private_remarks` | **No such column.** Actual: **`broker_remarks`** (text). |
| Population | ~1,100 rows / 64% | **7,244 / 8,165 (89%)** |
| Lockbox/showing language | (the concern) | **1,009 rows** carry lockbox/showing/access-code text (≈ the "~1,100" figure) |
| Also retained | — | `PrivateRemarks` inside `raw_vow_data` (~7,234 rows) |

Sample `broker_remarks`: *"Lockbox For Easy Showing, Book Via BrokerBay. Please Email Offers To:
…@gmail.com…"* — confirms broker-only showing instructions + PII in free text.

## Remediation order (source first, so the purge cannot refill)
1. **Source stopped** (this branch, `src/lib/vow-sync.ts`): `PrivateRemarks` removed from the AMPRE
   `$select` (`SELECT_FIELDS`); `broker_remarks` column hard-nulled in the column map;
   `PrivateRemarks` stripped from the `raw_vow_data` blob (`stripPrivateRemarks`). Future syncs
   never populate it.
2. **This log** — the durable audit record (column, row count, date `2026-07-26`, reason).
3. **Read audit** — `broker_remarks` has zero readers; only `vow-sync` writes it (see the report).
4. **Purge** — `migrations/sold/005_broker_remarks_purge.sql` (NULLs `broker_remarks` across all rows
   + strips `PrivateRemarks` from `raw_vow_data`; optional DROP form included). **Not executed yet.**
5. **Confirm clean** — `SELECT COUNT(*) … WHERE broker_remarks IS NOT NULL` → 0 (post-execution).

## Rows the purge WILL affect (read-only counts at prep time)
- `broker_remarks` non-null: **7,244**
- `raw_vow_data` carrying a `PrivateRemarks` key: **~7,234**
