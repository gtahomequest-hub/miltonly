# MC-051

CORE · D:\miltonly · main

**Five unused local sync scripts are out of the repo. The MC-051 branch @ `94c8afd` merged by SHA (`--no-ff`) as `82bef24`. Production `miltonly-9bjov6p8h` serves it, and `/api/build` answers `82bef2410b2cb1468f50313fc119e4860570819a`. Production battery `PASS · 25 checks · 719 pages · 929s`, leak test `CLEAN · 6,155 responses · 0 findings`.** There was no preview, because nothing under `src/` changes behaviour.

## 1. The scheduled tasks: neither existed

- `Get-ScheduledTask` found neither of the two scheduled tasks: "Miltonly Neon Sync" and the local sync's daily task.
- Two cross-checks found no task whose name carried the local sync's name, neon or miltonly: `schtasks /query`, and the Task Scheduler COM root folder with hidden tasks included.
- There is no `logs/` directory, which is where the wrapper wrote its dated logs.
- With nothing to unregister, there was no UAC prompt.

## 2. Removed

- **Five unused local sync scripts deleted** (1,260 lines):
  - the sync script itself, in `scripts/`, named after the removed system
  - `scripts/sync-neon-to-local.mjs`
  - `scripts/test-vow-sync-prospect.ts`
  - `scripts/scheduled-sync-wrapper.ps1`
  - `scripts/install-scheduled-task.ps1`
- **Nothing depended on them.** Outside docs, a `git grep` for the five names hits only the files themselves and the comment. No `package.json` script, prebuild step or workflow ran them.
- **The comment at `src/lib/vow-sync.ts:4` is gone** (1 line).
- **The local sync's env variable was already absent, so no file changed:**
  - 0 lines in all 15 `.env*` files across the six worktrees: `.env.local` ×6, `.env.example` ×6, `.env` ×2 (Core, Content) and Leads' `.env.vercel-prod`.
  - Not set in the Process, User or Machine environment.
  - No Vercel env name carries the removed system's name.
  - No value was printed.

## 3. The local Postgres: not on this machine

The scripts targeted a database named `prospect` on localhost, and `sync-neon-to-local` refused any other host. None of these exist here:

- a Postgres service or `postgres` process;
- a listener on ports 5432–5434;
- an install under Program Files, `psql`, or `pgpass.conf`;
- a `PG_VERSION` or `postgres.exe` under `C:\ProgramData`, both Program Files folders, the user profile or `D:\` (searched 6 levels deep, skipping `node_modules`, `.git` and `.next`);
- Docker, or a WSL distro.

So there is no size to report: 0 servers, 0 databases. Nothing was touched.

## 4. A case-insensitive whole-tree `git grep` for the removed system's name: 7 hits, every one the ordinary word

| file | line | use |
|---|---|---|
| `scripts/town/assign-neighbourhoods.ts` | 23 | the Town as a position source, not a naming authority |
| `scripts/town/fetch-layers.mjs` | 35 | the same, for the 26 Town polygons |
| `scripts/town/gen-neighbourhood-polygons.ts` | 48 | the same |
| `src/data/townNeighbourhoodMap.ts` | 5 | the same |
| `src/data/townNeighbourhoods.ts` | 12 | the same |
| `src/lib/hubSchools.ts` | 8 | the same, for school placement |
| `src/lib/portal/door.ts` | 135 | the sign-in form must not reveal who has an account |

Zero hits name the sync system.

## 5. Gate, merge, deploy

- **Gate: `pnpm build > build.log 2>&1` exited 0**, with 841/841 static pages, 0 FAIL and 0 `P2024`. It ran on Node 22.23.2 through Node 22's own corepack (HANDOFF line 786).
  - The first attempt, from `cmd`, exited 1 before building anything, because `pnpm` is not on cmd's PATH here.
- **Commit:** `94c8afd`, on the MC-051 branch (pushed).
- **`main` moved while the build ran,** from the branch point `f0b8bb7` to `55462de` (the 2026-10-03 morning report, scratchpad only). No app input changed, so the gate still holds.
- **Merge:** `82bef24` = `55462de` + `94c8afd`, `--no-ff`, pushed at 14:42:57Z. Nothing was held for a batch.
- **Production:** `miltonly-9bjov6p8h` is Ready after a 12-minute build, and `npx vercel ls --prod` lists it first.
  - `/api/build` answers `{"commit":"82bef2410b2cb1468f50313fc119e4860570819a","builtAt":"2026-10-03T14:43:46.459Z","env":"production"}`, served from 14:54:39Z.
  - `miltonly-cjgm67aik`, the morning report commit, was canceled by the ignore rule as designed.
- **Battery** (`scratchpad/mc051/battery-prod-82bef24.log`, started 14:55:22Z): `PASS · 25 checks · 719 pages · 929s`, `82bef24 served == expected`, leak test `CLEAN · 6,155 responses · 0 findings`.
