# Spec — VIP Classification

Status: implemented on `ws3-staging` (WS3). See ADR 0001. Classifier: `scripts/ws3-backfill.ts` (`classify`).

## Pools

Per **neighbourhood**, two parallel pools:
- **Residential** — `ResidentialStreet` entities in the neighbourhood.
- **Condo** — `CondoBuilding` entities in the neighbourhood.

Only neighbourhoods with `hasVipTier=true` (the 14 `urban_hub`) have VIP tiers.
`rural_hub` and `standard_no_hub` neighbourhoods have no VIP tier.

The pool denominator is **For-Sale-bearing entities only** (`recencyWeightedSold > 0`).
Lease-only / zero-sale entities are excluded from the pool (they remain standard-tier
rows with `currentRank = NULL`, `isVip = false`). This matters: including zero-sale
entities would inflate the 20% count.

## Recency-weighted sold score

For each entity, sum over its **For-Sale** trades (sale-only; lease excluded):

| trade age | weight |
|---|---|
| ≤ 12 months | 1.0 |
| 12–24 months | 0.6 |
| 24–36 months | 0.3 |
| > 36 months | 0.1 |

Stored as `recencyWeightedSold`. `soldCount12mo` (residential) / `saleCount12mo` +
`leaseCount12mo` (condo) are also persisted. Weights are the shipped defaults; tunable.

## Top-20%-or-tied (promote-both)

1. Sort the pool by `recencyWeightedSold` desc.
2. `cutoffIndex = ceil(0.2 * poolSize) - 1` (0-based); `cutoffValue = pool[cutoffIndex].recencyWeightedSold`.
3. **Every entity with `recencyWeightedSold >= cutoffValue` is VIP** — all ties at the
   cutoff value are promoted (no arbitrary tiebreak). Small pools round up (a pool of
   1–5 yields ≥1 VIP).

Observed effect (staging): Dempsey pool 44, nominal ceil = 9 → **10 VIP** (Cooke Cres /
Newell St / Panton Trl E tied at w=4.2); Scott pool 48, nominal 10 → **11 VIP** (Holloway
Terr / Jelinik Terr W / Landsborough Ave tied at w=5.8).

## Sticky VIP vs dynamic rank

- `isVip` is **sticky**: once true it stays true on recompute (re-classification only
  PROMOTES, never demotes). `vipEarnedAt` records first promotion.
- `currentRank` is **dynamic**: the 1-based rank within the For-Sale-bearing pool,
  refreshed every cycle. Powers link-graph prominence in WS5. Zero-sale entities → NULL.

Initial backfill is the first cycle, so nothing is demoted. A future re-classification
cron re-reads sold data, recomputes `recencyWeightedSold`/`currentRank` for all, and
adds any newly-qualifying VIPs while preserving existing ones.

## Result (staging)

139 residential VIP + 15 condo VIP = **154** across the 14 urban_hub neighbourhoods.
Per-neighbourhood VIP names: `scripts/ws3-verify.ts` output (item 3).
