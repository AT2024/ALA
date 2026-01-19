---
paths:
  - "backend/src/**/*.ts"
  - "!backend/src/models/**"
  - "!backend/src/migrations/**"
---

# Backend Development Rules - Express Security (CORRECTED)

## Rate Limiting (CRITICAL FIX)

### WRONG: Username-Based Account Lockout (CWE-645 DoS Vector)
```typescript
// DANGEROUS - Allows attacker to lock out legitimate users
if (failedAttempts[username] >= 5) {
  lockAccount(username); // Attacker spam-locks your CEO
}
```

### CORRECT: IP-Based Rate Limiting with Exponential Backoff
```typescript
import rateLimit from 'express-rate-limit';

// IP-based rate limiting (not username-based lockout)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many attempts, try again later' });
  }
});

// Exponential backoff on failure (delay, not lockout)
const loginDelay = async (failedAttempts: number) => {
  const delay = Math.min(1000 * Math.pow(2, failedAttempts), 30000);
  await new Promise(r => setTimeout(r, delay));
};

app.post('/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ where: { email: username } });
  if (!user || !await bcrypt.compare(password, user.password)) {
    await loginDelay(user?.failedAttempts || 0);
    // Increment failed attempts but DON'T LOCK
    if (user) await user.increment('failedAttempts');
    return res.status(401).json({ error: 'Invalid credentials' }); // Same message always
  }

  await user.update({ failedAttempts: 0 }); // Reset on success
  // ... generate token
});
```

### Rate Limiting Best Practices (OWASP)
- RATE LIMIT by IP address, not username
- USE exponential backoff (delay), NOT account lockout
- SAME error message for "user not found" and "wrong password" (prevent enumeration)
- MFA is the PRIMARY defense, not rate limiting
- LOG failed attempts for security analysis

## Input/Output Validation (Zod)

### Validate INPUT and OUTPUT
```typescript
import { z } from 'zod';

// Input schema
const TreatmentInputSchema = z.object({
  patientId: z.string().min(1),
  applicatorSerial: z.string().min(1),
  dosage: z.number().min(1).max(1000),
});

// Output schema (what you return)
const TreatmentOutputSchema = z.object({
  id: z.number(),
  status: z.enum(['SCHEDULED', 'ACTIVE', 'COMPLETED']),
  createdAt: z.string().datetime(),
});

// Usage
app.post('/treatments', async (req, res) => {
  const input = TreatmentInputSchema.parse(req.body); // Throws on invalid
  const treatment = await createTreatment(input);
  const output = TreatmentOutputSchema.parse(treatment); // Validate output too
  res.json(output);
});
```

## Security Headers
```typescript
import helmet from 'helmet';
app.use(helmet());
app.disable('x-powered-by');
```

## SQL Injection Prevention
- ALWAYS use Sequelize parameterized queries
- NEVER use template strings with user input
- FORBIDDEN: `sequelize.literal()` with user input

## Error Handling
```typescript
// Consistent response format
{ success: true, data: {...} }
{ success: false, error: { code: 'NOT_FOUND', message: '...' } }

// NEVER expose stack traces
// NEVER reveal whether username exists (enumeration)
```

## Pre-Commit Checklist
- [ ] Rate limiting is IP-based (not username-based lockout)
- [ ] Input validated with Zod
- [ ] Output validated with Zod
- [ ] Same error message for auth failures (no enumeration)
- [ ] No SQL injection vectors
