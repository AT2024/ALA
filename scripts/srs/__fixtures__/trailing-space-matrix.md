# Fixture traceability matrix (test data — obviously fake)

Used by verify-integrity.test.ts. Mirrors the real column-aligned table
format, where status cells are padded with trailing spaces.

| Requirement  | Description                             | Hazard  | Test Case   | Type        | Status      |
| ------------ | --------------------------------------- | ------- | ----------- | ----------- | ----------- |
| SRS-TEST-001 | Tight single-space status cell          | HAZ-001 | TC-TEST-001 | Unit        | Implemented |
| SRS-TEST-002 | Padded status cell with trailing spaces | HAZ-002 | TC-TEST-002 | E2E         | Verify      |
| SRS-TEST-003 | Another padded Verify row               | -       | TC-TEST-003 | Integration | Verify      |
