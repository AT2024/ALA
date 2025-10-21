# Priority OData Query Patterns

## Context
When querying the Priority ERP system via OData API for patient data, treatments, and applicator information.

## Problem
Priority OData queries have specific syntax requirements and common pitfalls that can cause silent failures or performance issues.

## Solution

### Basic Query Pattern
```typescript
const query = `$filter=${filterExpression}&$select=${fields}&$top=${limit}&$orderby=${sortField}`;
const url = `${PRIORITY_BASE_URL}/${entity}?${query}`;
```

### Filter Operators
- **Equality**: `CUSTNAME eq '${value}'`
- **Not equal**: `CUSTNAME ne '${value}'`
- **Greater than**: `ORDNUM gt ${number}`
- **Less than**: `ORDNUM lt ${number}``
- **Logical AND**: `CUSTNAME eq '${value}' and STATUS eq 'A'`
- **Logical OR**: `STATUS eq 'A' or STATUS eq 'B'`

### Common Patterns

#### Pattern 1: Single Record Lookup
```typescript
// Get specific customer by ID
const query = `$filter=CUSTNAME eq '${customerId}'&$select=CUSTNAME,CUSTDES`;
const url = `${PRIORITY_BASE_URL}/CUSTOMERS?${query}`;
```

#### Pattern 2: List with Pagination
```typescript
// Always paginate list queries to prevent timeouts
const query = `$filter=${filter}&$select=${fields}&$top=100&$skip=${skip}`;
const url = `${PRIORITY_BASE_URL}/${entity}?${query}`;
```

#### Pattern 3: Filtered List
```typescript
// Get active treatments for a site
const query = `$filter=SITENAME eq '${siteId}' and STATUS eq 'A'&$select=ORDNUM,CUSTNAME,ORDDATE&$top=50&$orderby=ORDDATE desc`;
```

#### Pattern 4: Nested Navigation
```typescript
// Get customer with related orders
const query = `$filter=CUSTNAME eq '${customerId}'&$expand=ORDERS&$select=CUSTNAME,CUSTDES`;
```

## Benefits
- Prevents timeout errors on large datasets
- Clear, maintainable query construction
- Proper field selection (only fetch needed data)
- Correct operator usage

## Tradeoffs
- More verbose than ad-hoc queries
- Requires knowledge of Priority field names
- Case-sensitive field names can trip you up

## Common Mistakes to Avoid

### ❌ Missing Pagination
```typescript
// BAD - No pagination, will timeout on large tables
const query = `$filter=STATUS eq 'A'`;
```

### ✅ With Pagination
```typescript
// GOOD - Always include $top for lists
const query = `$filter=STATUS eq 'A'&$top=100`;
```

### ❌ Wrong Operators
```typescript
// BAD - Using JavaScript operators
const query = `$filter=CUSTNAME == '${id}'`; // Wrong!
const query = `$filter=ORDNUM > ${num}`;     // Wrong!
```

### ✅ Correct Operators
```typescript
// GOOD - OData operators
const query = `$filter=CUSTNAME eq '${id}'`;
const query = `$filter=ORDNUM gt ${num}`;
```

### ❌ Fetching All Fields
```typescript
// BAD - Fetching everything
const url = `${PRIORITY_BASE_URL}/CUSTOMERS`;
```

### ✅ Select Only Needed Fields
```typescript
// GOOD - Only fetch what you need
const query = `$select=CUSTNAME,CUSTDES,PHONE`;
const url = `${PRIORITY_BASE_URL}/CUSTOMERS?${query}`;
```

## Security Considerations
- Always sanitize user input before building queries
- Use parameterized queries when possible
- Validate field names against whitelist

## Performance Tips
- Use `$select` to limit fields
- Always use `$top` for lists
- Add `$orderby` for consistent results
- Consider caching frequent queries

## Examples in Codebase

### Treatment List Query
[backend/src/services/priorityService.ts:125](backend/src/services/priorityService.ts#L125)
```typescript
async getTreatments(siteId: string, limit: number = 100): Promise<Treatment[]> {
  const query = `$filter=SITENAME eq '${siteId}' and STATUS eq 'A'&$select=ORDNUM,CUSTNAME,ORDDATE,ORDERDES&$top=${limit}&$orderby=ORDDATE desc`;
  return this.fetch(`ORDERS?${query}`);
}
```

### Applicator Lookup Query
[backend/src/services/applicatorService.ts:45](backend/src/services/applicatorService.ts#L45)
```typescript
async validateApplicator(barcode: string): Promise<Applicator> {
  const query = `$filter=APPLICATORDES eq '${barcode}'&$select=APPLICATORDES,SONICSERIALNO,APPORDER&$top=1`;
  return this.fetch(`SIBD_APPLICATUSELIST?${query}`);
}
```

## Related Patterns
- [Priority Error Handling](priority-error-handling.md)
- [Priority Data Synchronization](priority-data-sync.md)

## References
- [Priority OData Documentation](https://prioritysoftware.github.io/api/Web_SDK_Reference)
- [docs/PRIORITY_INTEGRATION.md](../../PRIORITY_INTEGRATION.md)
- OData v4 Specification

## Enforcement
This pattern is checked by the `priority-api-reviewer` agent.
