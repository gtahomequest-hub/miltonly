This migration was applied with `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1`
set inline for the single `prisma migrate deploy` call.

Reason: Neon free-tier connection routing pools at the edge regardless of
whether DATABASE_URL or DIRECT_DATABASE_URL is used, which causes Prisma's
advisory-lock-based migration serialization to time out. `directUrl` in
the datasource block was attempted first and did not resolve the issue in
our environment.

Future migrations on this project should attempt the standard flow first;
only fall back to advisory-lock bypass if the same symptom recurs.
Long-term resolution: upgrade Neon plan or swap to a hosting provider
that supports proper direct connections for migration tooling.
