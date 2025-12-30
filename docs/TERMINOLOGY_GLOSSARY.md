# ALA Terminology Glossary

## Purpose
This document maps internal code terminology to display terminology for regulatory compliance audits. The ALA (Accountability Log Application) uses NRC (Nuclear Regulatory Commission) compliant terminology in the user interface while maintaining backward-compatible internal code names.

## Regulatory Basis
- **NRC 10 CFR 35**: Uses "source" terminology for brachytherapy radioactive materials
- **HIPAA**: No requirement for matching internal and display terminology
- **IEC 62304**: Medical device software standard - does not mandate terminology alignment
- **FDA 21 CFR Part 11**: Electronic records regulation - does not require specific field naming

## Terminology Mapping

| UI Display (NRC Compliant) | Internal Code | Database Column | Description |
|---------------------------|---------------|-----------------|-------------|
| Source | seed | seed | A single radioactive brachytherapy source |
| Sources | seeds | seeds | Multiple radioactive sources |
| Source Qty. | seedQuantity | seed_quantity | Number of sources in an applicator |
| Source Length | seedLength | seed_length | Physical length of source in mm |
| Sources Inserted | seedsInserted | seeds_inserted | Count of sources inserted during treatment |
| Sources Remaining | seedsRemaining | N/A | Calculated: total - inserted |
| Activity Per Source | activityPerSeed | activity_per_seed | Radioactivity per source in microCuries |
| Total Sources | totalSeeds | N/A | Calculated total sources for treatment |
| Sources Expelled | seeds expelled | N/A | Status description for discharged applicators |

## File Reference

### Frontend Components (UI Display)
- `frontend/src/pages/Treatment/SeedRemoval.tsx` - Source Removal workflow
- `frontend/src/pages/Treatment/TreatmentDocumentation.tsx` - Treatment forms
- `frontend/src/pages/Treatment/UseList.tsx` - Usage list display
- `frontend/src/pages/Treatment/TreatmentSelection.tsx` - Treatment selection
- `frontend/src/components/ProgressTracker.tsx` - Progress display
- `frontend/src/components/PackageManager.tsx` - Package management

### Backend Services
- `backend/src/services/pdfGenerationService.ts` - PDF report generation

### Shared Definitions
- `shared/applicatorStatuses.ts` - Status descriptions

### Constants
- `frontend/src/constants/terminology.ts` - Centralized terminology helper

## Priority ERP Field Mapping

Priority ERP uses its own field naming convention. These are NOT changed:

| Priority Field | Description | UI Display |
|---------------|-------------|------------|
| SBD_SEEDQTY | Seed quantity in order | Sources: {value} |
| SIBD_SEEDLEN | Seed length | Source Length |
| SIBD_ACTIVITYPERSEED | Activity per seed | Activity Per Source |

## Audit Trail

All database records maintain the original "seed" terminology in columns for:
1. Backward compatibility with existing data
2. Consistency with Priority ERP integration
3. Audit trail integrity

The UI translation layer ensures users see NRC-compliant terminology without affecting data integrity.

## Change History

| Date | Change | Reason |
|------|--------|--------|
| 2025-12-30 | Initial terminology mapping | NRC compliance for brachytherapy terminology |

## References

- NRC 10 CFR Part 35 - Medical Use of Byproduct Material
- HIPAA Privacy Rule - 45 CFR Part 160 and Part 164
- IEC 62304:2006 - Medical device software lifecycle
- FDA 21 CFR Part 11 - Electronic Records and Signatures
