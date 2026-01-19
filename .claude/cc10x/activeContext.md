# Active Context - Circular JSON Fix

## Session Date: 2026-01-14

## Current Focus

Fixing "Converting circular structure to JSON" error in production Azure deployment.

## Root Cause

Sequelize model instances with bidirectional associations (Treatment ↔ Applicator ↔ User) are passed directly to `res.json()` without serialization.

## Key Finding (cc10x Review)

**WRONG**: `.get({ plain: true })` - does not exist in Sequelize
**CORRECT**: `.toJSON()` - already used in 10+ places in codebase

## Files to Fix

| File | Line | Function |
|------|------|----------|
| `treatmentController.ts` | 122 | `getTreatments()` |
| `treatmentController.ts` | 134 | `getTreatmentById()` |
| `treatmentController.ts` | 686 | `getRemovalCandidates()` |

## Pattern to Use

```typescript
// For single model
res.json(model.toJSON());

// For array (mixed types from DB/Priority)
res.json(items.map(t => typeof t.toJSON === 'function' ? t.toJSON() : t));
```

## Plan Location

`C:\Users\amitaik\.claude\plans\warm-enchanting-horizon.md`

## Last Updated
2026-01-14
