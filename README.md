# miltonly

Milton, Ontario's dedicated real estate intelligence site.

**Live:** https://www.miltonly.com

Hyperlocal data layer covering 700+ Milton streets, 23 schools, 7 mosques, 20+ neighbourhoods, with TREB/PropTx MLS listings via IDX agreement #1809031 and VOW agreement #1848370 (closed sales + leases).

---

## Project context — read these first

If you are picking up work on this project, the canonical context lives in four files at the repo root:

| File | What it is |
|---|---|
| [`AI-BRIEFING.md`](./AI-BRIEFING.md) | Current state, phase status, tech stack, routes, APIs, crons, last-15-commits log. The first thing to read in any new session. |
| [`ADVISOR-BRIEFING.md`](./ADVISOR-BRIEFING.md) | Strategy context — vision, what's built and why, growth strategy, locked decisions, open questions, remaining operational to-dos. |
| [`CHANGELOG-DECISIONS.md`](./CHANGELOG-DECISIONS.md) | Strategic + technical decision log. Newest at top. Each entry: decision · reasoning · alternatives. |
| [`DO-NOT-REPEAT.md`](./DO-NOT-REPEAT.md) | Settled rules and architectural locks. Do not re-debate anything in this file unless explicitly reopened. |

Phase 4.1 (8-section AI street descriptions) has its own working docs under [`docs/phase-4.1/`](./docs/phase-4.1/).

The street-page master template data spec is [`docs/street-template-data-spec.md`](./docs/street-template-data-spec.md).

---

## What's currently shipped

- Live MLS pipeline (TREB/Ampre OData sync, daily cron)
- 4-database architecture: DB1 (Prisma, Neon public schema) · DB2 sold (Neon, `sold` schema) · DB3 analytics (Neon, `analytics` schema) · Redis (Upstash)
- VOW pipeline with SSR `VowGate`, k=10 anonymity on aggregate teasers, bona-fide-interest acknowledgement quartet, per-record Brokerage display
- 700+ AI-generated street pages through the compliance gatekeeper, regenerated every 4 hours
- Passwordless auth (email + 6-digit code, 30-day JWT), saved listings, saved searches, deal alert matching
- Paid-traffic landing page at `/rentals/ads` with 2-step form, live TREB listings filtering, Google Ads `gtag` conversion via `/rentals/thank-you`, gclid + UTM persistence
- GA4 site-wide (`NEXT_PUBLIC_GA_ID = G-5G7486M9M9`)

For phase-by-phase detail and current priorities see [`AI-BRIEFING.md`](./AI-BRIEFING.md).

---

## Tech stack

- Next.js 14.2 (App Router), TypeScript 5, Tailwind CSS 3.4
- Prisma 5.22 over PostgreSQL (Neon, public schema) for DB1
- `@neondatabase/serverless` for DB2 + DB3
- `@upstash/redis` for caching + rate-limiting
- Vercel hosting, Vercel Blob for image uploads
- Resend (email), Twilio (SMS — currently stubbed pending A2P 10DLC)
- Anthropic Claude (`claude-opus-4-7` and earlier, all routed through `src/lib/ai/compliance.ts` only)

---

## Local dev

```bash
npm install
vercel env pull .env.local
npm run dev
```

Open http://localhost:3000.

**Always run `npx next build` before pushing to main.** TypeScript-only checks (`tsc`) are not enough — Vercel serves the previous build on a failed deploy, so a broken commit lands silently in production until the next successful build.

---

## Deploy

Auto-deploys from `main` to Vercel project `gtahomequest-hubs-projects/miltonly`. No manual deploy step.

---

## Owner

Aamir Yaqoob — Licensed Realtor, RE/MAX Realty Specialists Inc.

<!-- Phase 2 multi-repo webhook canary 2026-05-04 -->
