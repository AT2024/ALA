---
paths:
  - "backend/src/**/*.ts"
  - "!backend/src/models/**"
  - "!backend/src/migrations/**"
---

# Backend API Rules

## Rate Limiting (CRITICAL — CWE-645)

- RATE LIMIT by IP address, NOT username lockout (attacker can lock out legitimate users)
- USE exponential backoff delay, NOT account lockout
- SAME error message for "user not found" and "wrong password" (prevent enumeration)

```typescript
import rateLimit from "express-rate-limit";
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ error: "Too many attempts, try again later" }),
});
```

## Input/Output Validation

- USE Zod for both input AND output validation
- NEVER expose stack traces or reveal whether username exists

## Security

- USE `helmet()` middleware
- NEVER use `sequelize.literal()` with user input
- ALWAYS use parameterized queries

## Response Format

```typescript
{ success: true, data: {...} }
{ success: false, error: { code: 'NOT_FOUND', message: '...' } }
```
