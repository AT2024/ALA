# Applicator Status State Diagram

## Overview

The ALA system tracks applicators through an 8-state workflow. The available transitions depend on the treatment type being performed.

## Status Definitions

| Status | Code | Description | Terminal | Requires Comment |
|--------|------|-------------|----------|------------------|
| Sealed | SEALED | Unopened package | No | No |
| Opened | OPENED | Package opened | No | No |
| Loaded | LOADED | Ready for insertion | No | No |
| Inserted | INSERTED | Successfully deployed | Yes | No |
| Faulty | FAULTY | Defective equipment | Yes | Yes |
| Disposed | DISPOSED | Discarded | Yes | Yes |
| Discharged | DISCHARGED | Seeds expelled | Yes | Yes |
| Deployment Failure | DEPLOYMENT_FAILURE | Failed deployment | Yes | Yes |

## Treatment-Specific Workflows

### Pancreas/Prostate Procedure (3-Stage)

```
                         ┌───────────────────────────────────────┐
                         │                                       │
                         │              Stage 1                  │
                         │                                       │
                         │            ┌────────┐                 │
                         │            │ SEALED │                 │
                         │            └────┬───┘                 │
                         │                 │                     │
                         │                 ▼                     │
                         └────────────┬────────────┬─────────────┘
                                      │            │
                         ┌────────────┴────────────┴─────────────┐
                         │                                       │
                         │              Stage 2                  │
                         │                                       │
                         │            ┌────────┐                 │
                         │            │ OPENED │                 │
                         │            └────┬───┘                 │
                         │                 │                     │
                         │      ┌──────────┼──────────┐          │
                         │      │          │          │          │
                         │      ▼          ▼          ▼          │
                         │ ┌────────┐ ┌────────┐ ┌──────────┐    │
                         │ │ LOADED │ │ FAULTY │ │ DISPOSED │    │
                         │ └────┬───┘ └────────┘ └──────────┘    │
                         │      │       (END)       (END)        │
                         └──────┼─────────────────────────────────┘
                                │
                         ┌──────┴──────────────────────────────────┐
                         │                                         │
                         │               Stage 3                   │
                         │                                         │
                         │      ┌──────────┼──────────────┐        │
                         │      │          │              │        │
                         │      ▼          ▼              ▼        │
                         │ ┌──────────┐ ┌───────────┐ ┌──────────────────┐
                         │ │ INSERTED │ │ DISCHARGED│ │DEPLOYMENT_FAILURE│
                         │ └──────────┘ └───────────┘ └──────────────────┘
                         │   (SUCCESS)     (END)          (END)    │
                         │                                         │
                         └─────────────────────────────────────────┘
```

**Transition Map:**
| From | To (Allowed) |
|------|--------------|
| SEALED | OPENED |
| OPENED | LOADED, FAULTY, DISPOSED |
| LOADED | INSERTED, DISCHARGED, DEPLOYMENT_FAILURE |

### Skin Procedure (1-Stage)

```
                    ┌────────┐
                    │ SEALED │
                    └────┬───┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
         ┌──────────┐          ┌────────┐
         │ INSERTED │          │ FAULTY │
         └──────────┘          └────────┘
           (SUCCESS)             (END)
```

**Transition Map:**
| From | To (Allowed) |
|------|--------------|
| SEALED | INSERTED, FAULTY |

### Generic/Fallback Workflow

Used when treatment type is unknown or not specified.

```
         ┌────────┐
         │ SEALED │
         └────┬───┘
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
  ┌────────┐    ┌────────┐
  │ OPENED │    │ FAULTY │──────┐
  └────┬───┘    └────────┘      │
       │                        │
  ┌────┴────┬────────┐          │
  │         │        │          │
  ▼         ▼        ▼          │
┌────────┐┌──────┐┌──────────┐  │
│ LOADED ││FAULTY││ DISPOSED │  │
└────┬───┘└──────┘└──────────┘  │
     │                          │
┌────┴────┬───────────────┐     │
│         │               │     │
▼         ▼               ▼     │
┌────────┐┌────────┐┌────────────────────┐
│INSERTED││ FAULTY ││DEPLOYMENT_FAILURE  │
└────┬───┘└────────┘└────────────────────┘
     │
┌────┴────────────┐
│                 │
▼                 ▼
┌───────────┐┌──────────┐
│ DISCHARGED││ DISPOSED │
└───────────┘└──────────┘
```

**Transition Map:**
| From | To (Allowed) |
|------|--------------|
| SEALED | OPENED, FAULTY |
| OPENED | LOADED, FAULTY, DISPOSED |
| LOADED | INSERTED, FAULTY, DEPLOYMENT_FAILURE |
| INSERTED | DISCHARGED, DISPOSED |
| FAULTY | DISPOSED, DISCHARGED |
| DEPLOYMENT_FAILURE | DISPOSED, FAULTY |

## Visual Status Indicators

### Color Coding

| Status | Background | Text | Meaning |
|--------|------------|------|---------|
| SEALED | White | Gray | Unopened, ready to use |
| OPENED | Light Red | Red | Requires attention |
| LOADED | Light Yellow | Yellow | In progress |
| INSERTED | Light Green | Green | Success |
| FAULTY | Dark Gray | White | Failure - defective |
| DISPOSED | Dark Gray | White | Failure - discarded |
| DISCHARGED | Dark Gray | White | Failure - expelled |
| DEPLOYMENT_FAILURE | Dark Gray | White | Failure - deployment |

### Status Categories

**In-Progress Statuses** (appear in "Choose from List"):
- SEALED
- OPENED
- LOADED

**Terminal Statuses** (appear in "Use List Table"):
- INSERTED (success)
- FAULTY (failure)
- DISPOSED (failure)
- DISCHARGED (failure)
- DEPLOYMENT_FAILURE (failure)

## Audit Trail Requirements

Every status transition generates an audit log entry containing:
- Applicator ID
- Previous status (null for first scan)
- New status
- User who made the change
- Timestamp
- Reason/comment (required for failure statuses)
- Request correlation ID

## Implementation Reference

Status definitions are maintained in a single source of truth:
- File: `shared/applicatorStatuses.ts`
- Used by both frontend and backend
- Includes transition maps, labels, colors, and helper functions
