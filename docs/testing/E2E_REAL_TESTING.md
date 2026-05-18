# Real E2E Testing (ALA)

How to write Playwright tests that drive the **real** app + backend and are
_proven_ to catch regressions — not green theatre.

## Why this exists

A debugging session burned a large amount of effort/tokens rediscovering the
app's flow, selectors, test data, and a rate-limiter trap because none of it was
recorded. This doc + the committed helpers + agent memory fix that. Agents:
Skill `e2e-testing`; memory `ala-e2e-flow`, `ala-test-data-map`,
`ala-auth-rate-limiter`, `ala-e2e-real-testing-method`.

## Boot the environment

1. Postgres on **:5433** (`docker ps` → `ala-db`).
2. `cd backend && npm run dev` → backend **:5000**. Confirm
   `curl http://localhost:5000/api/health` shows `databaseConnected:true`
   (it connects async after boot — poll). If false, **stop** — don't fake it.
3. Frontend Vite runs on **:3000** (Playwright `webServer` auto-starts/reuses).
   The app port is 3000 — stale specs that hardcode 5173 are wrong.

## Dev login bypass (no Priority ERP needed)

`test@example.com` / code `123456` → positionCode-99 **admin** session served
from `backend/test-data.json` (no Priority call, no mocking). Admin
`amitaik@alphatau.com` works the same. Test Mode banner text:
`TEST MODE ACTIVE - Using simulated data`.

## Use the committed harness

`frontend/tests/e2e/helpers/alaFlow.ts` — `login`, `chooseMode`,
`startInsertion`, `selectApplicator`, `applyStatusStep`, `processApplicator`,
`finalizeToUseList`, `summaryTotal`. `alaTestData.ts` — `DEV_LOGIN`, `MAIN_015`
(order `SO25000015`, pancreas/3-stage, applicators A1=2 / A2=3 / A3=3 sources).
Working reference specs: `qa-test-mode.spec.ts`, `qa-seed-count.spec.ts`.

A new spec is typically: `login → chooseMode → startInsertion →
processApplicator(s) → finalizeToUseList → assert summaryTotal`.

## Run

```bash
cd frontend
npx playwright test qa-test-mode qa-seed-count --project=chromium --workers=1
```

`--workers=1` is mandatory: the backend auth limiter is **10 request-codes /
IP / 15 min with no dev bypass**. Symptom of exhaustion: `POST
/api/auth/request-code 429` fails every login (looks like a regression — it
isn't). Reset by restarting the backend (in-memory store).

## Falsifiability — a green test is not trusted until it has failed

MANDATORY before claiming a fix verified (also in `.claude/rules/testing.md`):

1. Spec GREEN against the real app.
2. Revert the fix with a mutation that changes **what the spec asserts**
   (verify the causal chain — a mutation the test can't observe proves nothing).
3. Re-run → RED on the named assertion. Stays green ⇒ the test is not real.
4. Restore the fix → GREEN.

Revert with the **Edit tool, not `git checkout`** (fix files are often
unstaged; checkout destroys uncommitted work). Re-Read before the restoring
Edit — hooks/formatters may reflow the file.

## Verified this way (branch `fix/test-mode-per-session`)

- **Group A — Test Mode per-session** (`qa-test-mode.spec.ts`): banner +
  `X-Test-Mode:true` on real `POST /api/proxy/priority/orders`; reload resets to
  `/mode-select` (not persisted); logout clean. Falsifiability proven: revert
  `api.ts` header → RED; revert `AuthContext` reset → RED; restored GREEN.
- **Group B — seed-count reconciliation** (`qa-seed-count.spec.ts`): partial
  INSERTED (2/3) + partial FAULTY (1/2) → "Total DaRT Sources Inserted" == 3
  (no over-count). Falsifiability proven: FAULTY-over-count mutation →
  `Expected "3", Received "4"` → restored GREEN.
- Unit-level falsifiability for the same fixes: backend 6/6, frontend 23/23
  regression tests each shown RED-on-revert; full suites 194/194, 234/234.
