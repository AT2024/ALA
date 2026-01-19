---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/__tests__/**"
---

# Testing Rules

## Critical Path Tests (MANDATORY 100%)
- Local-before-ERP safety validation
- Applicator reuse prevention
- Treatment state transitions
- Rate limiting behavior
- ERP offline fail-safe behavior

## Test the Safety Logic

### Reuse Prevention
```typescript
describe('Applicator Safety Validation', () => {
  it('should BLOCK reuse even if ERP says available', async () => {
    // Setup: Local DB shows USED, ERP shows AVAILABLE (sync delay)
    await db.ApplicatorUsage.create({
      serialNumber: 'TEST-001',
      usedAt: new Date()
    });
    mockERP.returns({ status: 'AVAILABLE' }); // Simulated sync delay

    // Act & Assert: Should still block
    await expect(validateApplicatorUsage('TEST-001', 'INSERTION'))
      .rejects.toThrow('SAFETY CRITICAL');
  });

  it('should allow use if neither local nor ERP show usage', async () => {
    mockERP.returns({ status: 'AVAILABLE', SIBD_EXPIRY: '2030-01-01' });

    const result = await validateApplicatorUsage('NEW-001', 'INSERTION');
    expect(result).toBe(true);
  });
});
```

### Fail-Safe When ERP Offline
```typescript
describe('ERP Offline Behavior', () => {
  it('should BLOCK when ERP offline and no cache', async () => {
    mockERP.rejects(new Error('Network error'));

    await expect(validateApplicatorUsage('NEW-001', 'INSERTION'))
      .rejects.toThrow('SAFETY BLOCK');
  });

  it('should BLOCK when cache is stale (>24h)', async () => {
    mockERP.rejects(new Error('Network error'));
    await db.ApplicatorCache.create({
      serialNumber: 'CACHED-001',
      cachedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
    });

    await expect(validateApplicatorUsage('CACHED-001', 'INSERTION'))
      .rejects.toThrow('stale');
  });

  it('should ALLOW with fresh cache when ERP offline', async () => {
    mockERP.rejects(new Error('Network error'));
    await db.ApplicatorCache.create({
      serialNumber: 'CACHED-001',
      SIBD_EXPIRY: '2030-01-01',
      SIBD_NOUSE: 'N',
      cachedAt: new Date() // Fresh cache
    });

    const result = await validateApplicatorUsage('CACHED-001', 'INSERTION');
    expect(result).toBe(true);
  });
});
```

## Test Rate Limiting
```typescript
describe('Login Rate Limiting', () => {
  it('should rate limit by IP, not lock by username', async () => {
    // Attacker from IP-A tries to lock out victim@example.com
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '1.2.3.4') // Attacker IP
        .send({ username: 'victim@example.com', password: 'wrong' });
    }

    // Victim from different IP should still be able to login
    const res = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '5.6.7.8') // Victim's real IP
      .send({ username: 'victim@example.com', password: 'correct' });

    expect(res.status).toBe(200); // NOT locked out
  });
});
```

## Test Structure

### Naming Convention
```typescript
describe('TreatmentService', () => {
  describe('updateStatus', () => {
    it('should transition from SCHEDULED to ACTIVE', async () => {});
    it('should prevent invalid transition SCHEDULED -> COMPLETED', async () => {});
    it('should create audit log on state change', async () => {});
  });
});
```

### AAA Pattern
- ARRANGE: Set up test data
- ACT: Execute the function
- ASSERT: Verify the result

## Database Testing

### Migration Testing
```typescript
it('should enforce dosage range constraint', async () => {
  expect(() => Treatment.create({ dosage: -10 }))
    .rejects.toThrow('check constraint');
});
```

### Referential Integrity
```typescript
it('should prevent orphaned treatments', async () => {
  expect(() => patient.destroy())
    .rejects.toThrow('foreign key constraint');
});
```

## Mock Data

### Isolation
- NEVER use production data in tests
- USE factories for test data generation
- RESET database between test suites

### Priority API Mocks
- MOCK all external API calls
- TEST error scenarios (401, 500, timeout, offline)
- VERIFY retry behavior

## Pre-Commit Checklist
- [ ] Safety validation tests pass
- [ ] ERP offline tests verify fail-safe behavior
- [ ] Rate limiting tests verify IP-based (not username lockout)
- [ ] State transition tests cover all valid/invalid paths
