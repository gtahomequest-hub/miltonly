# Ticket: Audit Upstash no-store fetches breaking static rendering

## Problem
src/lib/sold-data.ts → getMiltonSoldTotals uses no-store fetch 
against Upstash Redis. Any server component that calls this 
function loses static rendering and serves no-store headers on 
every request. Confirmed broken on homepage /.

## Scope
- Audit src/lib/cache.ts and src/lib/sold-data.ts for all 
  no-store fetches
- Identify all server components calling these functions
- Replace no-store with either fetch's next.revalidate option OR 
  unstable_cache wrapping the Upstash read

## Affected routes
- / (homepage) — confirmed
- Any other route importing getMiltonSoldTotals or similar 
  no-store cache helpers — TBD

## Estimated effort
30-60 min once started. Defer to a fresh session.

## Priority
Medium. Functional but expensive — every homepage visit costs 
lambda + Upstash invocation that should be served from CDN.
