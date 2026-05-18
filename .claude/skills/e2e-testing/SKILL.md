---
name: e2e-testing
description: Use when writing, running, or debugging real Playwright E2E tests for the ALA app (UI flow, treatment/applicator workflow, Test Mode, seed counts) — covers the live app flow, dev login, test-data map, the auth rate-limiter trap, and the falsifiability check.
allowed-tools: Bash(npx playwright:*) Bash(npm run:*)
---

# ALA Real E2E Testing

Drive the **real** app + backend (no mocking the thing under test). Do not copy
the stale specs `applicator-workflow.spec.ts` / `seed-removal-workflow.spec.ts`
(wrong port, wrong login, mocked).

## Use the committed harness — don't re-discover

Helpers: `frontend/tests/e2e/helpers/alaFlow.ts` (`login`, `chooseMode`,
`startInsertion`, `selectApplicator`, `applyStatusStep`, `processApplicator`,
`finalizeToUseList`, `summaryTotal`). Data map: `alaTestData.ts`
(`DEV_LOGIN`, `MAIN_015`, `TEST_MODE_BANNER`). Reference specs that pass and are
falsifiability-proven: `qa-test-mode.spec.ts`, `qa-seed-count.spec.ts`.

A new spec is usually: `login` → `chooseMode` → `startInsertion` →
`processApplicator`(s) → `finalizeToUseList` → assert `summaryTotal`.

Full flow/selectors/ports + worked test-data example live in memory
`ala-e2e-flow` and `ala-test-data-map` — read those before driving the app.

## Pre-flight

Postgres :5433 up; backend `:5000` with `GET /api/health` →
`databaseConnected:true`; frontend `:3000` (Playwright `webServer` reuses it).
Use the Playwright config `baseURL` — never hardcode a port.

## Gotcha: auth rate limiter

10 logins/IP/15 min, no dev bypass → `POST /api/auth/request-code 429` makes
every login fail (looks like a regression; it isn't). Run
`npx playwright test --project=chromium --workers=1`; reset by restarting the
backend (in-memory store). Detail: memory `ala-auth-rate-limiter`.

## Mandatory: prove the test is real (falsifiability)

A green E2E is not trusted until: revert the fix (Edit, **not** `git checkout`)
→ spec goes RED on the named assertion → restore → GREEN. The mutation must
change what the test actually asserts. See rule `.claude/rules/testing.md`
(Test Falsifiability) and memory `ala-e2e-real-testing-method`.
