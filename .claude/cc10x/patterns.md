# Common Patterns & Gotchas

## Sequelize Serialization

### ❌ WRONG
```typescript
// Does NOT exist in Sequelize
model.get({ plain: true })
```

### ✅ CORRECT
```typescript
// Convert to plain object
model.toJSON()

// For arrays with mixed types (DB models + plain objects)
items.map(t => typeof t.toJSON === 'function' ? t.toJSON() : t)
```

### Why This Matters
Sequelize models with `include` associations create circular references:
- `Treatment.applicators[0].treatment` → points back to parent
- `JSON.stringify()` fails with "Converting circular structure to JSON"

### Pattern Used In
- `offlineController.ts:202` - downloadBundle
- `applicatorService.ts:194` - applicator serialization
- `treatmentService.ts:438` - treatment response

## Last Updated
2026-01-14
