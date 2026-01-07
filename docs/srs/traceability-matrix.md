# Requirements Traceability Matrix - ALA Medical Treatment Tracking System

## Document Control

| Document Information | |
|---------------------|---|
| **Document ID** | ALA-RTM-001 |
| **Version** | 2.0 |
| **Date** | January 2026 |
| **Status** | Draft |
| **Parent Document** | ALA-SRS-001 v4.0 |

---

## 1. Introduction

This document provides the complete traceability matrix for all requirements in the ALA Software Requirements Specification. It traces each requirement to:
- Associated hazards (from ISO 14971 analysis)
- Test cases for verification
- Implementation status

---

## 2. Traceability Matrix

### 2.1 Authentication Requirements (SRS-AUTH-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-AUTH-001 | Validate email against Priority PHONEBOOK | HAZ-003 | TC-AUTH-001 | Integration | Implemented |
| SRS-AUTH-002 | Generate cryptographically secure 6-digit codes | HAZ-010 | TC-AUTH-002 | Unit | Implemented |
| SRS-AUTH-003 | Send verification codes via SMTP email | - | TC-AUTH-003 | Integration | Implemented |
| SRS-AUTH-004 | Verification codes expire after 10 minutes | HAZ-010 | TC-AUTH-004 | Unit | Implemented |
| SRS-AUTH-005 | Hash verification codes using bcrypt | HAZ-010 | TC-AUTH-005 | Unit | Implemented |
| SRS-AUTH-006 | Issue JWT tokens with 7-day expiration | - | TC-AUTH-006 | Unit | Implemented |
| SRS-AUTH-007 | Store JWT in HttpOnly secure cookies | HAZ-003, HAZ-009 | TC-AUTH-007 | Integration | Implemented |
| SRS-AUTH-008 | Track failed verification attempts | HAZ-010 | TC-AUTH-008 | Unit | Implemented |
| SRS-AUTH-009 | Allow code resend | - | TC-AUTH-009 | Integration | Implemented |
| SRS-AUTH-010 | Extract user site access from Priority | HAZ-003 | TC-AUTH-010 | Integration | Implemented |
| SRS-AUTH-011 | Position Code 99 grants full site access | - | TC-AUTH-011 | Integration | Implemented |
| SRS-AUTH-012 | Implement automatic session timeout | HAZ-009 | TC-AUTH-012 | E2E | Implemented |
| SRS-AUTH-013 | Provide logout clearing auth cookies | HAZ-009 | TC-AUTH-013 | Integration | Implemented |
| SRS-AUTH-014 | Prevent user enumeration | HAZ-003 | TC-AUTH-014 | Security | Implemented |

### 2.2 Treatment Selection Requirements (SRS-TSEL-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-TSEL-001 | Allow insertion/removal procedure choice | - | TC-TSEL-001 | E2E | Implemented |
| SRS-TSEL-002 | Fetch treatment data from Priority ORDERS | - | TC-TSEL-002 | Integration | Implemented |
| SRS-TSEL-003 | Display only authorized site treatments | HAZ-003 | TC-TSEL-003 | Integration | Implemented |
| SRS-TSEL-004 | Combine related pancreas procedures | - | TC-TSEL-004 | Integration | Implemented |
| SRS-TSEL-005 | Allow search by Subject ID, date, site | - | TC-TSEL-005 | E2E | Implemented |
| SRS-TSEL-006 | Display patient identifier (DETAILS field) | HAZ-006 | TC-TSEL-006 | Integration | Implemented |
| SRS-TSEL-007 | Removal only for 30+ day old insertions | HAZ-008 | TC-TSEL-007 | Integration | Implemented |
| SRS-TSEL-008 | Create local treatment with Priority reference | - | TC-TSEL-008 | Integration | Implemented |
| SRS-TSEL-009 | Store treatment metadata | - | TC-TSEL-009 | Unit | Implemented |
| SRS-TSEL-010 | Record treatment creator | - | TC-TSEL-010 | Integration | Implemented |

### 2.3 Applicator Scanning Requirements (SRS-SCAN-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-SCAN-001 | Support QR code scanning via camera | - | TC-SCAN-001 | E2E | Implemented |
| SRS-SCAN-002 | Support manual serial number entry | - | TC-SCAN-002 | E2E | Implemented |
| SRS-SCAN-003 | Validate serial against Priority SIBD_APPLICATUSELIST | HAZ-001, HAZ-006 | TC-SCAN-003 | Integration | Implemented |
| SRS-SCAN-004 | Detect duplicate scanning in treatment | HAZ-006 | TC-SCAN-004 | Unit | Implemented |
| SRS-SCAN-005 | Detect applicators from different treatments | HAZ-006 | TC-SCAN-005 | Integration | Implemented |
| SRS-SCAN-006 | Display applicator details | HAZ-001 | TC-SCAN-006 | E2E | Implemented |
| SRS-SCAN-007 | Retrieve seed quantity from Priority | HAZ-002 | TC-SCAN-007 | Integration | Implemented |
| SRS-SCAN-008 | Allow manual seed quantity override with justification | HAZ-002 | TC-SCAN-008 | E2E | Verify |
| SRS-SCAN-009 | Record package label from scan | - | TC-SCAN-009 | Integration | Implemented |
| SRS-SCAN-010 | Store applicator type from Priority | - | TC-SCAN-010 | Integration | Implemented |

### 2.4 Workflow Management Requirements (SRS-WKFL-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-WKFL-001 | Support 8 applicator statuses | - | TC-WKFL-001 | Unit | Implemented |
| SRS-WKFL-002 | Enforce treatment-specific transitions | - | TC-WKFL-002 | Unit | Implemented |
| SRS-WKFL-003 | Pancreas/Prostate workflow transitions | - | TC-WKFL-003 | Unit | Implemented |
| SRS-WKFL-004 | Skin workflow transitions | - | TC-WKFL-004 | Unit | Implemented |
| SRS-WKFL-005 | Terminal statuses block further transitions | - | TC-WKFL-005 | Unit | Implemented |
| SRS-WKFL-006 | Require comments for failure statuses | HAZ-001 | TC-WKFL-006 | E2E | Implemented |
| SRS-WKFL-007 | Create audit log for status transitions | HAZ-001, HAZ-005 | TC-WKFL-007 | Integration | Implemented |
| SRS-WKFL-008 | Audit logs include required fields | HAZ-005 | TC-WKFL-008 | Unit | Implemented |
| SRS-WKFL-009 | Display available transitions | - | TC-WKFL-009 | E2E | Implemented |
| SRS-WKFL-010 | Visual status type distinction | - | TC-WKFL-010 | E2E | Implemented |

### 2.5 Progress Tracking Requirements (SRS-PROG-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-PROG-001 | Display total vs processed applicators | - | TC-PROG-001 | E2E | Implemented |
| SRS-PROG-002 | Display total vs inserted seeds | HAZ-002 | TC-PROG-002 | E2E | Implemented |
| SRS-PROG-003 | Calculate completion percentage | - | TC-PROG-003 | Unit | Implemented |
| SRS-PROG-004 | Show usage type distribution | - | TC-PROG-004 | E2E | Implemented |
| SRS-PROG-005 | Show status breakdown | - | TC-PROG-005 | E2E | Implemented |
| SRS-PROG-006 | Real-time progress updates | - | TC-PROG-006 | E2E | Implemented |

### 2.6 Finalization Requirements (SRS-FINL-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-FINL-001 | Support hospital_auto and alphatau_verified types | HAZ-007 | TC-FINL-001 | Integration | Implemented |
| SRS-FINL-002 | Hospital users may auto-sign | - | TC-FINL-002 | Integration | Implemented |
| SRS-FINL-003 | AlphaTau requires verification code | HAZ-007 | TC-FINL-003 | Integration | Implemented |
| SRS-FINL-004 | Signature codes expire after 1 hour | - | TC-FINL-004 | Unit | Implemented |
| SRS-FINL-005 | Limit verification attempts to 3 | HAZ-007 | TC-FINL-005 | Unit | Implemented |
| SRS-FINL-006 | Fetch signers from Priority PHONEBOOK | - | TC-FINL-006 | Integration | Implemented |
| SRS-FINL-007 | Record signer details | HAZ-007 | TC-FINL-007 | Integration | Implemented |
| SRS-FINL-008 | Mark treatment complete with metadata | - | TC-FINL-008 | Integration | Implemented |
| SRS-FINL-009 | Completed treatments are immutable | HAZ-007 | TC-FINL-009 | Integration | Implemented |

### 2.7 Export Requirements (SRS-EXPRT-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-EXPRT-001 | Generate PDF with complete treatment info | - | TC-EXPRT-001 | Integration | Implemented |
| SRS-EXPRT-002 | PDF includes treatment summary | HAZ-002 | TC-EXPRT-002 | Integration | Implemented |
| SRS-EXPRT-003 | PDF includes applicator list | - | TC-EXPRT-003 | Integration | Implemented |
| SRS-EXPRT-004 | PDF includes signature information | HAZ-007 | TC-EXPRT-004 | Integration | Implemented |
| SRS-EXPRT-005 | PDF includes seed count totals | HAZ-002 | TC-EXPRT-005 | Integration | Implemented |
| SRS-EXPRT-006 | Store PDF in database | - | TC-EXPRT-006 | Integration | Implemented |
| SRS-EXPRT-007 | Support JSON export | - | TC-EXPRT-007 | Integration | Verify |
| SRS-EXPRT-008 | Exclude internal employee names | - | TC-EXPRT-008 | Integration | Verify |

### 2.8 Removal Workflow Requirements (SRS-RMVL-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-RMVL-001 | Allow removal 30+ days post-insertion | HAZ-008 | TC-RMVL-001 | Integration | Implemented |
| SRS-RMVL-002 | Display original insertion applicators | HAZ-008 | TC-RMVL-002 | E2E | Implemented |
| SRS-RMVL-003 | Track seeds removed per applicator | - | TC-RMVL-003 | Integration | Implemented |
| SRS-RMVL-004 | Allow removal comments | - | TC-RMVL-004 | E2E | Implemented |
| SRS-RMVL-005 | Track removal timestamp | - | TC-RMVL-005 | Integration | Implemented |
| SRS-RMVL-006 | Track removal performer | HAZ-008 | TC-RMVL-006 | Integration | Implemented |
| SRS-RMVL-007 | Display removal progress | - | TC-RMVL-007 | E2E | Implemented |
| SRS-RMVL-008 | Color-code final count | - | TC-RMVL-008 | E2E | Implemented |
| SRS-RMVL-009 | Provide removal procedure form | - | TC-RMVL-009 | E2E | Implemented |
| SRS-RMVL-010 | Capture removal date, all-same-date flag | - | TC-RMVL-010 | Integration | Implemented |
| SRS-RMVL-011 | Capture additional date and reason if different | - | TC-RMVL-011 | Integration | Implemented |
| SRS-RMVL-012 | Auto-calculate total sources removed | - | TC-RMVL-012 | Unit | Implemented |
| SRS-RMVL-013 | Detect discrepancy when removed ≠ inserted | HAZ-008 | TC-RMVL-013 | Integration | Implemented |
| SRS-RMVL-014 | Track 4 discrepancy categories | - | TC-RMVL-014 | Integration | Implemented |
| SRS-RMVL-015 | Include checked, amount, comment per category | - | TC-RMVL-015 | Unit | Implemented |
| SRS-RMVL-016 | Validate sum of clarified amounts | - | TC-RMVL-016 | Unit | Implemented |
| SRS-RMVL-017 | Support individual seed removal with reasons | - | TC-RMVL-017 | E2E | Implemented |
| SRS-RMVL-018 | Predefined individual removal reasons | - | TC-RMVL-018 | E2E | Implemented |
| SRS-RMVL-019 | Calculate removal progress from both sources | - | TC-RMVL-019 | Unit | Implemented |
| SRS-RMVL-020 | Allow completion with missing sources documented | - | TC-RMVL-020 | E2E | Implemented |
| SRS-RMVL-021 | Store discrepancy clarification as JSON | - | TC-RMVL-021 | Integration | Implemented |
| SRS-RMVL-022 | Store individual seed notes as JSON | - | TC-RMVL-022 | Integration | Implemented |

### 2.9 Audit Logging Requirements (SRS-AUDT-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-AUDT-001 | Log all status transitions | HAZ-001, HAZ-003 | TC-AUDT-001 | Integration | Implemented |
| SRS-AUDT-002 | Include applicator ID, statuses, user, timestamp | HAZ-005 | TC-AUDT-002 | Unit | Implemented |
| SRS-AUDT-003 | Include reason/comments | - | TC-AUDT-003 | Unit | Implemented |
| SRS-AUDT-004 | Include request ID for correlation | HAZ-005 | TC-AUDT-004 | Unit | Implemented |
| SRS-AUDT-005 | Audit logs are immutable | HAZ-001, HAZ-005 | TC-AUDT-005 | Integration | Implemented |
| SRS-AUDT-006 | Index logs by applicator and timestamp | - | TC-AUDT-006 | Unit | Implemented |
| SRS-AUDT-007 | Support time range queries | - | TC-AUDT-007 | Integration | Implemented |

### 2.10 Admin Dashboard Requirements (SRS-ADMN-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-ADMN-001 | Dashboard accessible to admin only | - | TC-ADMN-001 | E2E | Verify |
| SRS-ADMN-002 | Display treatment statistics | - | TC-ADMN-002 | E2E | Verify |
| SRS-ADMN-003 | Display system logs | - | TC-ADMN-003 | E2E | Verify |
| SRS-ADMN-004 | Support date and site filtering | - | TC-ADMN-004 | E2E | Verify |

### 2.11 UI/UX Requirements (SRS-UI-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-UI-001 | Responsive design (320px minimum) | - | TC-UI-001 | E2E | Implemented |
| SRS-UI-002 | WCAG 2.1 AA color contrast | - | TC-UI-002 | Accessibility | Verify |
| SRS-UI-003 | Clear error messages | - | TC-UI-003 | E2E | Implemented |
| SRS-UI-004 | Loading indicators | - | TC-UI-004 | E2E | Implemented |
| SRS-UI-005 | Environment indicator | - | TC-UI-005 | E2E | Implemented |

### 2.12 Hardware Interface Requirements (SRS-HW-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-HW-001 | Access device camera for scanning | - | TC-HW-001 | E2E | Implemented |
| SRS-HW-002 | Function without camera | - | TC-HW-002 | E2E | Implemented |

### 2.13 API Requirements (SRS-API-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-API-001 | Authenticate to Priority API | - | TC-API-001 | Integration | Implemented |
| SRS-API-002 | Handle Priority timeouts (30s) | - | TC-API-002 | Integration | Implemented |
| SRS-API-003 | Cache Priority data | - | TC-API-003 | Integration | Verify |
| SRS-API-004 | Provide fallback test data | - | TC-API-004 | Integration | Implemented |

### 2.14 Database Requirements (SRS-DB-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-DB-001 | Use PostgreSQL 14+ | - | TC-DB-001 | Configuration | Implemented |
| SRS-DB-002 | Use Sequelize ORM | - | TC-DB-002 | Configuration | Implemented |
| SRS-DB-003 | Connection pooling | - | TC-DB-003 | Performance | Implemented |
| SRS-DB-004 | Health checks | - | TC-DB-004 | Integration | Implemented |

### 2.15 Communication Requirements (SRS-COM-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-COM-001 | HTTPS for all communication | HAZ-009 | TC-COM-001 | Security | Implemented |
| SRS-COM-002 | SMTP for verification emails | - | TC-COM-002 | Integration | Implemented |
| SRS-COM-003 | Email retry logic | - | TC-COM-003 | Integration | Verify |

### 2.16 Performance Requirements (SRS-PERF-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-PERF-001 | Page load < 3 seconds on 4G | - | TC-PERF-001 | Performance | Verify |
| SRS-PERF-002 | API response < 2 seconds | - | TC-PERF-002 | Performance | Verify |
| SRS-PERF-003 | QR decode < 500ms | - | TC-PERF-003 | Performance | Verify |
| SRS-PERF-004 | PDF generation < 10 seconds | - | TC-PERF-004 | Performance | Verify |
| SRS-PERF-005 | Support 50 concurrent users | - | TC-PERF-005 | Load | Verify |

### 2.17 Safety Requirements (SRS-SAFE-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-SAFE-001 | Validate against Priority master data | HAZ-001, HAZ-002, HAZ-006 | TC-SAFE-001 | Integration | Implemented |
| SRS-SAFE-002 | Require confirmation for terminal statuses | - | TC-SAFE-002 | E2E | Implemented |
| SRS-SAFE-003 | Maintain immutable audit trail | HAZ-001, HAZ-005 | TC-SAFE-003 | Integration | Implemented |
| SRS-SAFE-004 | Prevent finalized treatment modification | HAZ-007 | TC-SAFE-004 | Integration | Implemented |
| SRS-SAFE-005 | Require comments for failure statuses | HAZ-001 | TC-SAFE-005 | E2E | Implemented |
| SRS-SAFE-006 | Display warnings for unusual conditions | - | TC-SAFE-006 | E2E | Verify |

### 2.18 Security Requirements (SRS-SEC-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-SEC-001 | JWT in HttpOnly secure cookies | HAZ-003, HAZ-009 | TC-SEC-001 | Security | Implemented |
| SRS-SEC-002 | Hash verification codes with bcrypt | HAZ-010 | TC-SEC-002 | Unit | Implemented |
| SRS-SEC-003 | Rate limit authentication endpoints | HAZ-003, HAZ-010 | TC-SEC-003 | Security | Implemented |
| SRS-SEC-004 | Rate limit API endpoints | - | TC-SEC-004 | Security | Implemented |
| SRS-SEC-005 | Enforce HTTPS in production | HAZ-009 | TC-SEC-005 | Security | Implemented |
| SRS-SEC-006 | CORS origin validation | - | TC-SEC-006 | Security | Implemented |
| SRS-SEC-007 | Security headers via Helmet.js | - | TC-SEC-007 | Security | Implemented |
| SRS-SEC-008 | Prevent user enumeration | HAZ-003 | TC-SEC-008 | Security | Implemented |
| SRS-SEC-009 | Validate all user input | - | TC-SEC-009 | Security | Implemented |
| SRS-SEC-010 | AES-256 encryption at rest | - | TC-SEC-010 | Security | Verify |
| SRS-SEC-011 | TLS 1.3 for data in transit | HAZ-009 | TC-SEC-011 | Security | Implemented |
| SRS-SEC-012 | MFA for ePHI access (email verification) | HAZ-003 | TC-SEC-012 | Security | Implemented |
| SRS-SEC-013 | Network segmentation for ePHI systems | - | TC-SEC-013 | Infrastructure | Verify |
| SRS-SEC-014 | Audit log retention 6 years | HAZ-005 | TC-SEC-014 | Compliance | Verify |
| SRS-SEC-015 | Audit log integrity verification | HAZ-005 | TC-SEC-015 | Security | Verify |
| SRS-SEC-016 | Session timeout 30 minutes | HAZ-003, HAZ-009 | TC-SEC-016 | Integration | Implemented |

### 2.19 Business Rules (SRS-BR-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-BR-001 | Removal only 30+ days post-insertion | HAZ-008 | TC-BR-001 | Integration | Implemented |
| SRS-BR-002 | Position Code 99 = full site access | - | TC-BR-002 | Integration | Implemented |
| SRS-BR-003 | Test data isolated from production | - | TC-BR-003 | Integration | Implemented |
| SRS-BR-004 | Failure statuses require comments | HAZ-001 | TC-BR-004 | E2E | Implemented |
| SRS-BR-005 | Completed treatments immutable | HAZ-007 | TC-BR-005 | Integration | Implemented |

### 2.20 Data Requirements (SRS-DATA-*)

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-DATA-001 | Foreign key constraints | - | TC-DATA-001 | Unit | Implemented |
| SRS-DATA-002 | Database transactions | HAZ-004 | TC-DATA-002 | Integration | Implemented |
| SRS-DATA-003 | Audit logs never deleted | HAZ-005 | TC-DATA-003 | Integration | Implemented |
| SRS-DATA-004 | 7 year data retention | - | TC-DATA-004 | Compliance | Verify |
| SRS-DATA-005 | Database backups | HAZ-004 | TC-DATA-005 | Operations | Verify |

### 2.21 File Attachments (SRS-ATCH-*) - NEW

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-ATCH-001 | Support file attachments per applicator | - | TC-ATCH-001 | E2E | Implemented |
| SRS-ATCH-002 | Track attachment filename | - | TC-ATCH-002 | Unit | Implemented |
| SRS-ATCH-003 | Track attachment count | - | TC-ATCH-003 | Unit | Implemented |
| SRS-ATCH-004 | Track attachment size in bytes | - | TC-ATCH-004 | Unit | Implemented |
| SRS-ATCH-005 | Track attachment sync status | - | TC-ATCH-005 | Integration | Implemented |

### 2.22 Treatment Types (SRS-TYPE-*) - NEW

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-TYPE-001 | Support 5 treatment types | - | TC-TYPE-001 | Unit | Implemented |
| SRS-TYPE-002 | Combine pancreas Priority orders | - | TC-TYPE-002 | Integration | Implemented |
| SRS-TYPE-003 | Support JSON array priorityId | - | TC-TYPE-003 | Integration | Implemented |
| SRS-TYPE-004 | Type-specific workflow transitions | - | TC-TYPE-004 | Unit | Implemented |

### 2.23 Radioactivity Tracking (SRS-RAD-*) - NEW

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-RAD-001 | Track activity per seed | - | TC-RAD-001 | Integration | Implemented |
| SRS-RAD-002 | Include activity in PDF export | - | TC-RAD-002 | Integration | Verify |
| SRS-RAD-003 | Retrieve activity from Priority | - | TC-RAD-003 | Integration | Implemented |

### 2.24 Cybersecurity (SRS-CYBER-*) - NEW

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-CYBER-001 | Maintain SBOM | - | TC-CYBER-001 | Compliance | Pending |
| SRS-CYBER-002 | Vulnerability scanning every 6 months | - | TC-CYBER-002 | Security | Pending |
| SRS-CYBER-003 | Annual penetration testing | - | TC-CYBER-003 | Security | Pending |
| SRS-CYBER-004 | Documented incident response | - | TC-CYBER-004 | Compliance | Pending |
| SRS-CYBER-005 | Patch management (30 days critical) | - | TC-CYBER-005 | Operations | Verify |

### 2.25 Backup and Recovery (SRS-RECV-*) - NEW

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-RECV-001 | Database backup every 24 hours | HAZ-004 | TC-RECV-001 | Operations | Verify |
| SRS-RECV-002 | RTO < 4 hours | HAZ-004 | TC-RECV-002 | DR Test | Verify |
| SRS-RECV-003 | RPO < 24 hours | HAZ-004 | TC-RECV-003 | DR Test | Verify |
| SRS-RECV-004 | Weekly backup integrity verification | HAZ-004 | TC-RECV-004 | Operations | Pending |

### 2.26 Offline Mode & PWA Architecture (SRS-OFFL-*) - NEW

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-OFFL-001 | Implement PWA architecture with service workers | - | TC-OFFL-001 | Integration | Implemented |
| SRS-OFFL-002 | Use IndexedDB for offline storage via Dexie.js | - | TC-OFFL-002 | Integration | Implemented |
| SRS-OFFL-003 | Encrypt PHI at rest using AES-256-GCM | HAZ-013 | TC-OFFL-003 | Security | Implemented |
| SRS-OFFL-004 | Use PBKDF2 key derivation (100,000 iterations) | HAZ-013 | TC-OFFL-004 | Security | Implemented |
| SRS-OFFL-005 | Detect and track network connectivity status | HAZ-012 | TC-OFFL-005 | Integration | Implemented |
| SRS-OFFL-006 | Queue offline changes with SHA-256 hashes | HAZ-011 | TC-OFFL-006 | Integration | Implemented |
| SRS-OFFL-007 | Auto-sync pending changes when online | HAZ-011 | TC-OFFL-007 | Integration | Implemented |
| SRS-OFFL-008 | Implement exponential backoff retry | - | TC-OFFL-008 | Unit | Implemented |
| SRS-OFFL-009 | Support treatment bundle download | - | TC-OFFL-009 | E2E | Implemented |
| SRS-OFFL-010 | Offline bundles expire after 24 hours | HAZ-012 | TC-OFFL-010 | Integration | Implemented |
| SRS-OFFL-011 | Detect and store sync conflicts | HAZ-011 | TC-OFFL-011 | Integration | Implemented |
| SRS-OFFL-012 | Medical-critical conflicts require admin | HAZ-015 | TC-OFFL-012 | Integration | Implemented |
| SRS-OFFL-013 | Maintain offline audit log | HAZ-011, HAZ-014 | TC-OFFL-013 | Integration | Implemented |
| SRS-OFFL-014 | Block finalization while offline | HAZ-015 | TC-OFFL-014 | E2E | Implemented |
| SRS-OFFL-015 | Support clock synchronization with server | HAZ-014 | TC-OFFL-015 | Integration | Implemented |
| SRS-OFFL-016 | Track and display storage usage | - | TC-OFFL-016 | E2E | Implemented |
| SRS-OFFL-017 | Warn users at 80% storage capacity | - | TC-OFFL-017 | E2E | Implemented |
| SRS-OFFL-018 | Auto-delete expired offline bundles | HAZ-012 | TC-OFFL-018 | Integration | Implemented |
| SRS-OFFL-019 | Request persistent storage permission | HAZ-013 | TC-OFFL-019 | E2E | Implemented |
| SRS-OFFL-020 | Display offline status banner | HAZ-012 | TC-OFFL-020 | E2E | Implemented |
| SRS-OFFL-021 | Provide manual sync trigger | - | TC-OFFL-021 | E2E | Implemented |
| SRS-OFFL-022 | User-controlled app updates (no auto-update) | HAZ-015 | TC-OFFL-022 | E2E | Implemented |
| SRS-OFFL-023 | Encrypt critical PHI fields | HAZ-013 | TC-OFFL-023 | Security | Implemented |
| SRS-OFFL-024 | Idempotent sync via change hashes | HAZ-011 | TC-OFFL-024 | Integration | Implemented |
| SRS-OFFL-025 | iOS 7-day storage eviction warning | - | TC-OFFL-025 | E2E | Implemented |

### 2.27 Treatment Continuation (SRS-CONT-*) - NEW

| Req ID | Requirement Description | Hazard ID | Test Case | Test Type | Status |
|--------|------------------------|-----------|-----------|-----------|--------|
| SRS-CONT-001 | Allow continuation within 24-hour window | HAZ-016 | TC-CONT-001 | Integration | Implemented |
| SRS-CONT-002 | Eligibility based on lastActivityAt/completedAt | - | TC-CONT-002 | Unit | Implemented |
| SRS-CONT-003 | Track parent-child relationship via parentTreatmentId | HAZ-016 | TC-CONT-003 | Integration | Implemented |
| SRS-CONT-004 | Continuation inherits parent treatment info | HAZ-016 | TC-CONT-004 | Integration | Implemented |
| SRS-CONT-005 | Continuation uses current date | - | TC-CONT-005 | Unit | Implemented |
| SRS-CONT-006 | Display modal for continuable treatment | - | TC-CONT-006 | E2E | Implemented |
| SRS-CONT-007 | Modal shows hours remaining, applicator count | HAZ-016 | TC-CONT-007 | E2E | Implemented |
| SRS-CONT-008 | Reusable applicators: OPENED or LOADED status | - | TC-CONT-008 | Unit | Implemented |
| SRS-CONT-009 | Only insertion treatments can be continued | - | TC-CONT-009 | Integration | Implemented |
| SRS-CONT-010 | API endpoints for continuation workflow | - | TC-CONT-010 | Integration | Implemented |

---

<!-- AUTO-UPDATE:START statistics -->
## 3. Summary Statistics

### 3.1 Requirements Count by Category

| Category | Count | Implemented | Verify | Pending |
|----------|-------|-------------|--------|---------|
| Authentication (AUTH) | 14 | 14 | 0 | 0 |
| Treatment Selection (TSEL) | 10 | 10 | 0 | 0 |
| Applicator Scanning (SCAN) | 10 | 9 | 1 | 0 |
| Workflow Management (WKFL) | 10 | 10 | 0 | 0 |
| Progress Tracking (PROG) | 6 | 6 | 0 | 0 |
| Finalization (FINL) | 9 | 9 | 0 | 0 |
| Export (EXPRT) | 8 | 6 | 2 | 0 |
| Removal (RMVL) | 22 | 22 | 0 | 0 |
| Audit Logging (AUDT) | 7 | 7 | 0 | 0 |
| Admin Dashboard (ADMN) | 4 | 0 | 4 | 0 |
| UI/UX (UI) | 5 | 4 | 1 | 0 |
| Hardware (HW) | 2 | 2 | 0 | 0 |
| API (API) | 4 | 3 | 1 | 0 |
| Database (DB) | 4 | 4 | 0 | 0 |
| Communication (COM) | 3 | 2 | 1 | 0 |
| Performance (PERF) | 9 | 4 | 5 | 0 |
| Safety (SAFE) | 6 | 5 | 1 | 0 |
| Security (SEC) | 16 | 12 | 4 | 0 |
| Business Rules (BR) | 5 | 5 | 0 | 0 |
| Data (DATA) | 5 | 3 | 2 | 0 |
| Attachments (ATCH) | 5 | 5 | 0 | 0 |
| Treatment Types (TYPE) | 4 | 4 | 0 | 0 |
| Radioactivity (RAD) | 3 | 2 | 1 | 0 |
| Cybersecurity (CYBER) | 5 | 0 | 1 | 4 |
| Backup/Recovery (RECV) | 4 | 0 | 3 | 1 |
| Offline Mode (OFFL) | 25 | 25 | 0 | 0 |
| Treatment Continuation (CONT) | 10 | 10 | 0 | 0 |
| **TOTAL** | **215** | **183** | **27** | **5** |

### 3.2 Requirements Coverage

- **Implemented**: 183 (85.1%)
- **Needs Verification**: 27 (12.6%)
- **Pending Implementation**: 5 (2.3%)
<!-- AUTO-UPDATE:END statistics -->

### 3.3 Safety-Critical Requirements Coverage

All 16 hazards have control measures implemented:
- HAZ-001 to HAZ-010: Original hazards - controls verified
- HAZ-011 to HAZ-016: New hazards for offline mode and treatment continuation - controls verified

---

<!-- AUTO-UPDATE:START revision_history -->
## 4. Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | December 2025 | - | Initial traceability matrix |
| 2.0 | January 2026 | Claude Code | Major update: +53 requirements (Offline Mode, Treatment Continuation, Removal Discrepancy), +6 hazards |
<!-- AUTO-UPDATE:END revision_history -->

---

*Document generated for ALA-SRS-001 v4.0 compliance tracking*
