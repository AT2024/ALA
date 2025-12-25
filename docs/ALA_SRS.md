# Software Requirements Specification

## Accountability Log Application (ALA)
### Medical Treatment Tracking System

---

| Document Information | |
|---------------------|---|
| **Document ID** | ALA-SRS-001 |
| **Version** | 3.0 |
| **Date** | December 2025 |
| **Status** | Draft |
| **Classification** | Internal |
| **Safety Classification** | IEC 62304 Class B |
| **FDA Documentation Level** | Enhanced |

---

## Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author | | | |
| Technical Review | | | |
| QA Review | | | |
| Project Manager | | | |

---

## Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2024 | - | Initial SRS for ALA |
| 2.0 | December 2025 | - | Complete rewrite reflecting current implementation |
| 3.0 | December 2025 | - | Full overhaul: Added risk integration (ISO 14971), HIPAA 2025 compliance, cybersecurity section, missing features (attachments, treatment types, radioactivity), populated traceability matrix |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Verification and Validation](#7-verification-and-validation)
8. [Risk Management Integration](#8-risk-management-integration)
9. [Cybersecurity Requirements](#9-cybersecurity-requirements)
10. [Appendices](#appendices)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document describes the functional and non-functional requirements for the Accountability Log Application (ALA), version 2.0. This document is intended for:

- Software developers implementing and maintaining the system
- Quality Assurance personnel validating system compliance
- Project managers overseeing development
- Clinical operations personnel using the system
- Regulatory affairs for compliance documentation

### 1.2 Scope

The Accountability Log Application (ALA) is a web-based medical treatment tracking system designed to replace paper-based accountability logs (QSR-4001-01) for seed applicator procedures used in brachytherapy treatments.

**In Scope:**
- User authentication and authorization via Priority ERP integration
- Treatment session management (insertion and removal procedures)
- Real-time applicator tracking with 8-state workflow management
- Barcode/QR code scanning for applicator identification
- Digital signature capture for treatment finalization
- PDF generation for regulatory documentation
- Comprehensive audit logging for regulatory compliance
- Integration with Alpha Tau Medical's Priority ERP system

**Out of Scope:**
- Medical device control or operation
- Patient medical records management
- Billing or insurance processing
- Inventory management (handled by Priority ERP)

### 1.3 Product Overview

The ALA system digitizes the tracking of seed applicator usage during brachytherapy procedures. The system consists of:

- **Frontend**: React/TypeScript single-page application optimized for mobile and tablet use
- **Backend**: Express/TypeScript REST API server
- **Database**: PostgreSQL for treatment and audit data persistence
- **Integration**: Priority ERP OData API for patient data, site access, and applicator validation

### 1.4 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| ALA | Accountability Log Application |
| Applicator | Medical device used to deploy radioactive seeds during brachytherapy |
| Brachytherapy | Cancer treatment using radioactive seeds implanted near tumors |
| ERP | Enterprise Resource Planning |
| HttpOnly Cookie | Secure cookie type inaccessible to JavaScript (XSS protection) |
| JWT | JSON Web Token - standard for secure authentication tokens |
| OData | Open Data Protocol - REST-based data access protocol |
| Position Code | Priority ERP user classification (99 = admin) |
| Priority | Alpha Tau Medical's ERP system |
| QR Code | Quick Response Code - 2D barcode format |
| Seed | Radioactive implant used in brachytherapy |
| Subject ID | Unique patient treatment identifier from Priority ORDERS |
| Treatment | A single brachytherapy procedure (insertion or removal) |

### 1.5 References

| ID | Document | Description |
|----|----------|-------------|
| REF-01 | IEEE/ISO/IEC 29148:2018 | Systems and software engineering - Life cycle processes - Requirements engineering |
| REF-02 | IEC 62304:2006+AMD1:2015 | Medical device software - Software life cycle processes |
| REF-03 | ISO 14971:2019 | Medical devices - Application of risk management to medical devices |
| REF-04 | QSR-4001-01 | Accountability Log (paper form being replaced) |
| REF-05 | Priority ERP OData API | Integration specification for Priority system |
| REF-06 | OWASP Top 10 | Web application security risks |
| REF-07 | HIPAA Security Rule 2025 | Updated cybersecurity requirements (Federal Register 2025-01-06) |
| REF-08 | FDA Cybersecurity Guidance | Content of Premarket Submissions for Management of Cybersecurity in Medical Devices |

### 1.6 Document Conventions

- Requirements are identified using format: **SRS-[MODULE]-[NUMBER]**
- Priority levels: **Critical**, **High**, **Medium**, **Low**
- "Shall" indicates mandatory requirements
- "Should" indicates recommended but optional requirements
- "May" indicates optional features

---

## 2. Overall Description

### 2.1 Product Perspective

The ALA operates as a standalone web application that integrates with Alpha Tau Medical's existing Priority ERP system. It does not replace Priority but extends it with specialized treatment tracking capabilities.

**System Context:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile/Tablet │────▶│   ALA Frontend  │────▶│   ALA Backend   │
│   (Browser)     │     │   (React SPA)   │     │   (Express API) │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────┐
                        │                                │                │
                        ▼                                ▼                ▼
                ┌───────────────┐              ┌─────────────────┐ ┌─────────────┐
                │  PostgreSQL   │              │  Priority ERP   │ │ Email SMTP  │
                │   Database    │              │   OData API     │ │   Service   │
                └───────────────┘              └─────────────────┘ └─────────────┘
```

### 2.2 Product Functions

The ALA provides the following high-level functions:

| Function | Description |
|----------|-------------|
| Authentication | Email-based verification with JWT session management |
| Treatment Selection | Choose patient treatments from Priority ERP data |
| Applicator Scanning | QR code/barcode scanning with validation |
| 8-State Workflow | Track applicator status through procedure stages |
| Progress Tracking | Real-time visualization of treatment completion |
| Treatment Finalization | Digital signature capture and PDF generation |
| Removal Tracking | Track seed removal procedures (30+ days post-insertion) |
| Audit Logging | Comprehensive audit trail for regulatory compliance |

### 2.3 User Classes and Characteristics

| User Class | Role | Permissions | Technical Expertise |
|------------|------|-------------|---------------------|
| Hospital Worker | Clinical staff performing treatments | View/edit treatments at assigned sites only | Basic - familiar with medical procedures |
| AlphaTau Employee | Clinical operations support | View/edit all treatments, approve applicator exceptions | Intermediate - trained on ALA system |
| Administrator | System management | Full access including logs and configuration | Advanced - IT/technical background |

**Position Code 99**: Users with Priority position code 99 receive full administrative access regardless of assigned role.

### 2.4 Operating Environment

| Component | Requirement |
|-----------|-------------|
| **Client Devices** | Modern web browser (Chrome 90+, Safari 14+, Firefox 88+, Edge 90+) on mobile phones, tablets, or desktop computers |
| **Screen Size** | Minimum 320px width (responsive design) |
| **Network** | Internet connection required for Priority ERP integration |
| **Camera** | Device camera required for QR code scanning (optional manual entry available) |
| **Server** | Azure Virtual Machine (Ubuntu 20.04 LTS) |
| **Database** | PostgreSQL 14+ |
| **Runtime** | Node.js 18 LTS |

### 2.5 Design and Implementation Constraints

| Constraint | Description |
|------------|-------------|
| C-01 | System shall integrate with existing Priority ERP OData API without modifications to Priority |
| C-02 | All patient-identifiable data shall remain in Priority ERP; ALA stores only Subject IDs |
| C-03 | System shall be accessible on mobile devices in clinical environments |
| C-04 | System shall support concurrent users performing treatments at different sites |
| C-05 | System shall maintain audit trail for regulatory compliance (IEC 62304) |
| C-06 | Authentication tokens shall be stored in HttpOnly secure cookies (XSS protection) |

### 2.6 Assumptions and Dependencies

**Assumptions:**
- Users have valid Priority ERP accounts with appropriate site access
- Clinical environment has WiFi or cellular data connectivity
- Applicators have valid QR codes/barcodes matching Priority inventory
- Users are trained on brachytherapy procedures and ALA usage

**Dependencies:**
- Priority ERP system availability for authentication and data
- Azure cloud infrastructure availability
- Email delivery service for verification codes
- PostgreSQL database availability

### 2.7 Regulatory Context (IEC 62304)

**Software Safety Classification:** Class B

**Rationale:** The ALA is a documentation and tracking system that does not directly control medical device operation. However, incorrect tracking could lead to:
- Unreported applicator usage
- Incorrect seed counts in patient documentation
- Compliance documentation errors

The system implements the following safety measures:
- Comprehensive audit logging of all status changes
- Validation against Priority ERP master data
- Digital signature requirements for finalization
- Immutable audit trail for regulatory review

---

## 3. System Features

### 3.1 Authentication and Authorization

#### 3.1.1 Description and Priority
**Priority:** Critical

The system shall authenticate users via email verification codes and authorize access based on Priority ERP user data and role assignments.

#### 3.1.2 Stimulus/Response Sequences

**Login Flow:**
1. User enters email address
2. System validates email against Priority PHONEBOOK
3. System sends 6-digit verification code via email
4. User enters verification code
5. System validates code and creates authenticated session
6. User redirected to procedure selection

**Session Management:**
1. Authenticated user makes request
2. System validates JWT from HttpOnly cookie
3. If valid, request proceeds
4. If expired/invalid, user redirected to login

#### 3.1.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-AUTH-001 | The system shall validate user email addresses against Priority ERP PHONEBOOK table | Critical |
| SRS-AUTH-002 | The system shall generate cryptographically secure 6-digit verification codes | Critical |
| SRS-AUTH-003 | The system shall send verification codes via email using configured SMTP service | Critical |
| SRS-AUTH-004 | Verification codes shall expire after 10 minutes | High |
| SRS-AUTH-005 | The system shall hash verification codes using bcrypt before storage | Critical |
| SRS-AUTH-006 | The system shall issue JWT tokens with 7-day expiration upon successful verification | High |
| SRS-AUTH-007 | JWT tokens shall be stored in HttpOnly secure cookies (not accessible to JavaScript) | Critical |
| SRS-AUTH-008 | The system shall track failed verification attempts per user | High |
| SRS-AUTH-009 | The system shall allow users to request code resend | Medium |
| SRS-AUTH-010 | The system shall extract user site access from Priority metadata | Critical |
| SRS-AUTH-011 | Users with Position Code 99 shall receive full access to all sites | High |
| SRS-AUTH-012 | The system shall implement automatic session timeout after inactivity | Medium |
| SRS-AUTH-013 | The system shall provide logout functionality that clears authentication cookies | High |
| SRS-AUTH-014 | The system shall prevent user enumeration by returning generic error messages | High |

---

### 3.2 Treatment Selection

#### 3.2.1 Description and Priority
**Priority:** Critical

The system shall allow users to select treatment procedures (insertion or removal) from Priority ERP data based on their site access permissions.

#### 3.2.2 Stimulus/Response Sequences

**Insertion Selection:**
1. User selects "Insertion" procedure type
2. System fetches available treatments from Priority ORDERS
3. System filters treatments by user's authorized sites
4. User selects patient/treatment from list
5. System creates local treatment record linked to Priority

**Removal Selection:**
1. User selects "Removal" procedure type
2. System fetches completed insertion treatments eligible for removal
3. User selects treatment to perform removal
4. System creates removal treatment linked to original insertion

#### 3.2.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-TSEL-001 | The system shall allow users to choose between insertion and removal procedure types | Critical |
| SRS-TSEL-002 | The system shall fetch treatment data from Priority ERP ORDERS table | Critical |
| SRS-TSEL-003 | The system shall display only treatments at sites the user is authorized to access | Critical |
| SRS-TSEL-004 | The system shall combine related Priority procedures for pancreas treatments | High |
| SRS-TSEL-005 | The system shall allow treatment search by Subject ID, date, and site | High |
| SRS-TSEL-006 | The system shall display patient identifier (DETAILS field) from Priority | High |
| SRS-TSEL-007 | For removal procedures, the system shall only show insertions completed at least 30 days prior | High |
| SRS-TSEL-008 | The system shall create a local treatment record with reference to Priority ID | Critical |
| SRS-TSEL-009 | The system shall store treatment metadata: type, site, date, Subject ID, surgeon | High |
| SRS-TSEL-010 | The system shall record the user who created the treatment | High |

---

### 3.3 Applicator Scanning and Validation

#### 3.3.1 Description and Priority
**Priority:** Critical

The system shall scan and validate applicator QR codes/barcodes against Priority ERP inventory data.

#### 3.3.2 Stimulus/Response Sequences

**Scan Flow:**
1. User initiates barcode scan (camera or manual entry)
2. System decodes QR code to extract serial number
3. System validates serial number against Priority SIBD_APPLICATUSELIST
4. System checks for duplicate scanning
5. System displays applicator details and validation result
6. User confirms or rejects applicator

#### 3.3.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-SCAN-001 | The system shall support QR code scanning using device camera | Critical |
| SRS-SCAN-002 | The system shall support manual serial number entry as fallback | Critical |
| SRS-SCAN-003 | The system shall validate applicator serial numbers against Priority SIBD_APPLICATUSELIST | Critical |
| SRS-SCAN-004 | The system shall detect and notify if an applicator was already scanned for the current treatment | High |
| SRS-SCAN-005 | The system shall detect applicators assigned to different treatments | High |
| SRS-SCAN-006 | The system shall display applicator details: serial number, seed quantity, applicator type | High |
| SRS-SCAN-007 | The system shall retrieve seed quantity from Priority based on serial number | Critical |
| SRS-SCAN-008 | The system shall allow users to manually override seed quantity with justification | Medium |
| SRS-SCAN-009 | The system shall record package label from scanned data when available | Medium |
| SRS-SCAN-010 | The system shall store applicator type (PARTS.PARTDES) from Priority | Medium |

---

### 3.4 Applicator 8-State Workflow Management

#### 3.4.1 Description and Priority
**Priority:** Critical

The system shall track applicators through an 8-state workflow that varies by treatment type.

#### 3.4.2 Stimulus/Response Sequences

**State Transition (Pancreas/Prostate):**
1. Applicator scanned → Status: SEALED
2. User opens package → Status: OPENED
3. User loads applicator → Status: LOADED
4. User deploys seeds → Status: INSERTED (or FAULTY/DISCHARGED/DEPLOYMENT_FAILURE)

**State Transition (Skin):**
1. Applicator scanned → Status: SEALED
2. User deploys seeds → Status: INSERTED (or FAULTY)

#### 3.4.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-WKFL-001 | The system shall support 8 applicator statuses: SEALED, OPENED, LOADED, INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE | Critical |
| SRS-WKFL-002 | The system shall enforce treatment-specific transition rules (Pancreas/Prostate vs. Skin vs. Generic) | Critical |
| SRS-WKFL-003 | For Pancreas/Prostate: SEALED→OPENED→LOADED→(INSERTED\|DISCHARGED\|DEPLOYMENT_FAILURE) | Critical |
| SRS-WKFL-004 | For Skin: SEALED→(INSERTED\|FAULTY) | Critical |
| SRS-WKFL-005 | Terminal statuses (INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE) shall not allow further transitions | Critical |
| SRS-WKFL-006 | The system shall require comments for all failure terminal statuses (FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE) | High |
| SRS-WKFL-007 | The system shall create audit log entries for every status transition | Critical |
| SRS-WKFL-008 | Audit logs shall record: old status, new status, user, timestamp, reason, request ID | Critical |
| SRS-WKFL-009 | The system shall display available transitions based on current status and treatment type | High |
| SRS-WKFL-010 | The system shall visually distinguish status types: success (green), failure (dark), in-progress (yellow/red) | Medium |

---

### 3.5 Real-Time Progress Tracking

#### 3.5.1 Description and Priority
**Priority:** High

The system shall display real-time progress of treatment completion.

#### 3.5.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-PROG-001 | The system shall display total applicators vs. processed applicators | High |
| SRS-PROG-002 | The system shall display total seeds vs. inserted seeds | High |
| SRS-PROG-003 | The system shall calculate and display completion percentage | High |
| SRS-PROG-004 | The system shall show usage type distribution (full, faulty, none) | Medium |
| SRS-PROG-005 | The system shall show applicator status breakdown by state | Medium |
| SRS-PROG-006 | Progress display shall update in real-time as applicators are processed | High |

---

### 3.6 Treatment Finalization and Digital Signatures

#### 3.6.1 Description and Priority
**Priority:** Critical

The system shall support treatment finalization with digital signature verification.

#### 3.6.2 Stimulus/Response Sequences

**Hospital Auto-Signature:**
1. Hospital user clicks "Finalize"
2. System auto-captures user information as signature
3. PDF generated with signature
4. Treatment marked complete

**AlphaTau Verification:**
1. User initiates finalization
2. User selects signer from site users list
3. System sends verification code to signer's email
4. Signer enters verification code
5. System validates code (3 attempts max, 1-hour expiration)
6. PDF generated with verified signature
7. Treatment marked complete

#### 3.6.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-FINL-001 | The system shall support two finalization types: hospital_auto and alphatau_verified | Critical |
| SRS-FINL-002 | Hospital users may auto-sign treatments using their authenticated identity | High |
| SRS-FINL-003 | AlphaTau finalization shall require verification code sent to signer's email | Critical |
| SRS-FINL-004 | Signature verification codes shall expire after 1 hour | High |
| SRS-FINL-005 | The system shall limit signature verification attempts to 3 per code | High |
| SRS-FINL-006 | The system shall fetch available signers from Priority PHONEBOOK for the treatment site | High |
| SRS-FINL-007 | The system shall record signer name, email, position, and signature timestamp | Critical |
| SRS-FINL-008 | Finalization shall mark treatment as complete with completedBy and completedAt | Critical |
| SRS-FINL-009 | Completed treatments shall be immutable (no further applicator changes) | Critical |

---

### 3.7 PDF Generation and Export

#### 3.7.1 Description and Priority
**Priority:** High

The system shall generate comprehensive treatment documentation in PDF format.

#### 3.7.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-EXPRT-001 | The system shall generate PDF documents containing complete treatment information | High |
| SRS-EXPRT-002 | PDF shall include: treatment summary, site, date, Subject ID, surgeon | High |
| SRS-EXPRT-003 | PDF shall include complete applicator list with serial numbers, statuses, seed quantities | High |
| SRS-EXPRT-004 | PDF shall include signature information (name, position, timestamp) | Critical |
| SRS-EXPRT-005 | PDF shall include seed count totals (inserted, removed, remaining) | High |
| SRS-EXPRT-006 | The system shall store generated PDF in database (BYTEA field) | High |
| SRS-EXPRT-007 | The system shall support JSON export of treatment data | Medium |
| SRS-EXPRT-008 | Exported documents shall not include internal Alpha Tau employee names | Medium |

---

### 3.8 Removal Workflow

#### 3.8.1 Description and Priority
**Priority:** High

The system shall support tracking of seed removal procedures.

#### 3.8.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-RMVL-001 | The system shall allow removal procedures for treatments at least 30 days post-insertion | High |
| SRS-RMVL-002 | The system shall display applicators from the original insertion treatment | High |
| SRS-RMVL-003 | The system shall track number of seeds removed per applicator | High |
| SRS-RMVL-004 | The system shall allow removal comments per applicator | Medium |
| SRS-RMVL-005 | The system shall track removal timestamp | High |
| SRS-RMVL-006 | The system shall track who performed each removal | High |
| SRS-RMVL-007 | The system shall display removal progress (seeds removed vs. total seeds) | High |
| SRS-RMVL-008 | The system shall color-code final count: green if zero seeds remain, red otherwise | Medium |

---

### 3.9 Audit Logging

#### 3.9.1 Description and Priority
**Priority:** Critical

The system shall maintain comprehensive audit logs for regulatory compliance.

#### 3.9.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-AUDT-001 | The system shall log all applicator status transitions in ApplicatorAuditLog table | Critical |
| SRS-AUDT-002 | Audit log entries shall include: applicator ID, old status, new status, user, timestamp | Critical |
| SRS-AUDT-003 | Audit log entries shall include reason/comments when provided | High |
| SRS-AUDT-004 | Audit log entries shall include request ID for correlation | High |
| SRS-AUDT-005 | Audit logs shall be immutable (no updates or deletes) | Critical |
| SRS-AUDT-006 | The system shall index audit logs by applicator ID and timestamp for efficient retrieval | High |
| SRS-AUDT-007 | The system shall support audit log queries by time range and applicator | High |

---

### 3.10 Admin Dashboard

#### 3.10.1 Description and Priority
**Priority:** Medium

The system shall provide administrative dashboard for system monitoring.

#### 3.10.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-ADMN-001 | The system shall provide dashboard accessible only to admin users | Medium |
| SRS-ADMN-002 | Dashboard shall display treatment statistics | Medium |
| SRS-ADMN-003 | Dashboard shall display system logs | Medium |
| SRS-ADMN-004 | Dashboard shall support filtering by date range and site | Low |

---

### 3.11 File Attachments

#### 3.11.1 Description and Priority
**Priority:** Medium

The system shall support file attachments per applicator for documenting images, certificates, or other relevant files.

#### 3.11.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-ATCH-001 | The system shall support file attachments per applicator | Medium |
| SRS-ATCH-002 | The system shall track attachment filename for each upload | Medium |
| SRS-ATCH-003 | The system shall track attachment count per applicator | Medium |
| SRS-ATCH-004 | The system shall track attachment size in bytes | Medium |
| SRS-ATCH-005 | The system shall track attachment sync status (pending, syncing, synced, failed) | Medium |

---

### 3.12 Treatment Type Handling

#### 3.12.1 Description and Priority
**Priority:** Critical

The system shall support multiple treatment types with type-specific workflow behaviors.

#### 3.12.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-TYPE-001 | The system shall support treatment types: insertion, removal, pancreas_insertion, prostate_insertion, skin_insertion | Critical |
| SRS-TYPE-002 | Pancreas treatments shall combine related Priority orders via reference chain detection | High |
| SRS-TYPE-003 | Treatment priorityId shall support JSON array format for combined/referenced orders | High |
| SRS-TYPE-004 | Each treatment type shall have type-specific workflow transitions per SRS-WKFL-002 | Critical |

---

### 3.13 Radioactivity Tracking

#### 3.13.1 Description and Priority
**Priority:** High

The system shall track radioactivity levels (activity per seed) for treatment documentation.

#### 3.13.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-RAD-001 | The system shall track activity per seed (radioactivity level) for treatments | High |
| SRS-RAD-002 | Activity per seed shall be included in PDF export per SRS-EXPRT-002 | High |
| SRS-RAD-003 | Activity per seed shall be retrieved from Priority ORDERS data | High |

---

## 4. External Interface Requirements

### 4.1 User Interfaces

#### 4.1.1 General UI Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-UI-001 | The system shall be responsive and function on mobile devices (320px minimum width) | High |
| SRS-UI-002 | The system shall use accessible color contrast ratios (WCAG 2.1 AA) | Medium |
| SRS-UI-003 | The system shall provide clear error messages for all user actions | High |
| SRS-UI-004 | The system shall display loading indicators during async operations | Medium |
| SRS-UI-005 | The system shall display environment indicator (staging/production) | Medium |

#### 4.1.2 Key Screens

| Screen | Purpose | Key Elements |
|--------|---------|--------------|
| Login | User authentication | Email input, verification code input |
| Procedure Type | Select insertion/removal | Two prominent selection buttons |
| Treatment Selection | Choose patient/treatment | Search filters, treatment list, selection |
| Treatment Documentation | Scan and process applicators | Scanner, applicator form, progress display |
| Use List | Review applicators, finalize | Applicator table, edit, finalize button |
| Seed Removal | Track removal procedure | Applicator list, removal inputs, progress |

### 4.2 Hardware Interfaces

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-HW-001 | The system shall access device camera for QR code scanning via browser APIs | High |
| SRS-HW-002 | The system shall function without camera using manual entry | Critical |

### 4.3 Software Interfaces

#### 4.3.1 Priority ERP OData API

| Endpoint | Purpose | Data |
|----------|---------|------|
| PHONEBOOK | User authentication, site access | Email, position code, authorized sites |
| ORDERS | Treatment/patient data | Subject ID, patient details, site, date |
| SIBD_APPLICATUSELIST | Applicator inventory | Serial number, seed quantity, applicator type |

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-API-001 | The system shall authenticate to Priority API using configured credentials | Critical |
| SRS-API-002 | The system shall handle Priority API timeouts (30 second default) | High |
| SRS-API-003 | The system shall cache Priority data to reduce API calls | Medium |
| SRS-API-004 | The system shall provide fallback test data when Priority is unavailable (development only) | Medium |

#### 4.3.2 Database Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-DB-001 | The system shall use PostgreSQL 14+ for data persistence | Critical |
| SRS-DB-002 | The system shall use Sequelize ORM for database operations | High |
| SRS-DB-003 | The system shall implement database connection pooling | High |
| SRS-DB-004 | The system shall implement health checks for database connectivity | High |

### 4.4 Communication Interfaces

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-COM-001 | The system shall use HTTPS for all client-server communication | Critical |
| SRS-COM-002 | The system shall use SMTP for sending verification emails | High |
| SRS-COM-003 | The system shall implement email retry logic for delivery failures | Medium |

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| ID | Requirement | Priority | Metric |
|----|-------------|----------|--------|
| SRS-PERF-001 | Page load time shall be under 3 seconds on 4G connection | High | < 3000ms |
| SRS-PERF-002 | API response time shall be under 2 seconds for standard operations | High | < 2000ms |
| SRS-PERF-003 | QR code scanning shall decode within 500ms | High | < 500ms |
| SRS-PERF-004 | PDF generation shall complete within 10 seconds | Medium | < 10000ms |
| SRS-PERF-005 | System shall support 50 concurrent users | Medium | 50 users |

### 5.2 Safety Requirements (IEC 62304)

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| SRS-SAFE-001 | The system shall validate all applicator data against Priority master data | Critical | Prevent incorrect tracking |
| SRS-SAFE-002 | The system shall require confirmation before terminal status transitions | High | Prevent accidental state changes |
| SRS-SAFE-003 | The system shall maintain immutable audit trail of all status changes | Critical | Regulatory compliance |
| SRS-SAFE-004 | The system shall prevent modification of finalized treatments | Critical | Data integrity |
| SRS-SAFE-005 | The system shall require comments for failure statuses | High | Documentation of issues |
| SRS-SAFE-006 | The system shall display clear warnings for unusual conditions | High | User awareness |

### 5.3 Security Requirements

| ID | Requirement | Priority | Implementation |
|----|-------------|----------|----------------|
| SRS-SEC-001 | The system shall store JWT tokens in HttpOnly secure cookies | Critical | XSS protection |
| SRS-SEC-002 | The system shall hash verification codes using bcrypt | Critical | Password security |
| SRS-SEC-003 | The system shall implement rate limiting on authentication endpoints | Critical | Brute-force protection |
| SRS-SEC-004 | The system shall implement rate limiting on API endpoints | High | DoS protection |
| SRS-SEC-005 | The system shall enforce HTTPS in production | Critical | Transport security |
| SRS-SEC-006 | The system shall implement CORS origin validation | High | Cross-origin protection |
| SRS-SEC-007 | The system shall implement security headers via Helmet.js | High | Security hardening |
| SRS-SEC-008 | The system shall prevent user enumeration via generic error messages | High | Information disclosure |
| SRS-SEC-009 | The system shall validate all user input | Critical | Injection prevention |
| SRS-SEC-010 | The system shall use AES-256 encryption for data at rest | Critical | Data protection |
| SRS-SEC-011 | The system shall use TLS 1.3 for all data in transit | Critical | Transport security |
| SRS-SEC-012 | Multi-factor authentication shall be used for ePHI access (email verification code) | Critical | HIPAA 2025 |
| SRS-SEC-013 | Network segmentation shall isolate ePHI systems | High | HIPAA 2025 |
| SRS-SEC-014 | Audit logs shall be retained for minimum 6 years per HIPAA | Critical | Regulatory compliance |
| SRS-SEC-015 | Audit log integrity shall be verified via immutability controls | High | Data integrity |
| SRS-SEC-016 | Session timeout shall occur after 30 minutes of inactivity | High | Access control |

**Rate Limiting Configuration:**

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 20 requests | 15 minutes |
| Code Request | 10 requests | 15 minutes |
| Verification | 15 requests | 15 minutes |
| Token Validation | 50 requests | 15 minutes |
| General API | 100 requests | 15 minutes |

### 5.4 Software Quality Attributes

| Attribute | Requirement |
|-----------|-------------|
| **Availability** | System shall be available 99.5% during business hours |
| **Reliability** | System shall recover from crashes within 5 minutes |
| **Maintainability** | System shall use TypeScript for type safety |
| **Portability** | System shall run in Docker containers |
| **Scalability** | System shall support horizontal scaling via Docker Swarm |

### 5.5 Business Rules

| ID | Rule | Priority |
|----|------|----------|
| SRS-BR-001 | Removal procedures are only allowed 30+ days after insertion | High |
| SRS-BR-002 | Position Code 99 users have full site access | High |
| SRS-BR-003 | Test data (test@example.com) is isolated from production | Critical |
| SRS-BR-004 | Failure statuses require explanatory comments | High |
| SRS-BR-005 | Completed treatments cannot be modified | Critical |

### 5.6 Backup and Recovery Requirements

| ID | Requirement | Priority | Metric |
|----|-------------|----------|--------|
| SRS-RECV-001 | The system shall support automated database backup every 24 hours | High | Daily backup |
| SRS-RECV-002 | Recovery Time Objective (RTO) shall be less than 4 hours | High | < 4 hours |
| SRS-RECV-003 | Recovery Point Objective (RPO) shall be less than 24 hours | High | < 24 hours |
| SRS-RECV-004 | Backup integrity shall be verified weekly | Medium | Weekly verification |

---

## 6. Data Requirements

### 6.1 Logical Data Model

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────┐
│    Users    │       │   Treatments    │       │  Applicators │
├─────────────┤       ├─────────────────┤       ├──────────────┤
│ id (PK)     │──┐    │ id (PK)         │──┐    │ id (PK)      │
│ name        │  │    │ type            │  │    │ serialNumber │
│ email       │  │    │ subjectId       │  │    │ seedQuantity │
│ phoneNumber │  │    │ patientName     │  │    │ usageType    │
│ role        │  └───▶│ userId (FK)     │  └───▶│ treatmentId  │
│ metadata    │       │ completedBy (FK)│       │ status       │
└─────────────┘       │ site            │       │ addedBy (FK) │
                      │ date            │       │ comments     │
                      │ isComplete      │       └──────┬───────┘
                      └─────────────────┘              │
                                                       │
┌────────────────────┐     ┌─────────────────────┐    │
│  TreatmentPdfs     │     │ ApplicatorAuditLog  │    │
├────────────────────┤     ├─────────────────────┤    │
│ id (PK)            │     │ id (PK)             │◀───┘
│ treatmentId (FK)   │     │ applicatorId (FK)   │
│ pdfData (BYTEA)    │     │ oldStatus           │
│ signatureType      │     │ newStatus           │
│ signerName         │     │ changedBy           │
│ signerEmail        │     │ changedAt           │
└────────────────────┘     │ reason              │
                           └─────────────────────┘
```

### 6.2 Data Dictionary

#### 6.2.1 Users Table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique user identifier |
| name | VARCHAR(255) | NOT NULL | User's display name |
| email | VARCHAR(255) | UNIQUE | User's email address |
| phoneNumber | VARCHAR(50) | UNIQUE | User's phone number |
| role | ENUM | NOT NULL, default 'hospital' | User role (hospital, alphatau, admin) |
| verificationCode | VARCHAR(255) | nullable | Hashed verification code |
| verificationExpires | TIMESTAMP | nullable | Code expiration time |
| failedAttempts | INTEGER | NOT NULL, default 0 | Failed verification count |
| lastLogin | TIMESTAMP | nullable | Last successful login |
| metadata | JSON | nullable | Priority user data (position, sites) |

#### 6.2.2 Treatments Table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique treatment identifier |
| type | ENUM | NOT NULL | Treatment type (insertion, removal) |
| subjectId | VARCHAR(100) | NOT NULL, indexed | Priority Subject ID |
| patientName | VARCHAR(255) | nullable | Patient identifier from Priority |
| site | VARCHAR(100) | NOT NULL | Treatment site |
| date | TIMESTAMP | NOT NULL, indexed | Treatment date |
| isComplete | BOOLEAN | NOT NULL, default false | Completion status |
| priorityId | VARCHAR(100) | nullable | Reference to Priority system |
| userId | UUID | FK→users, NOT NULL | Creating user |
| completedBy | UUID | FK→users, nullable | Completing user |
| completedAt | TIMESTAMP | nullable | Completion timestamp |
| seedQuantity | INTEGER | nullable | Total seed count |
| activityPerSeed | FLOAT | nullable | Radiation activity per seed (Bq) |
| surgeon | VARCHAR(255) | nullable | Performing surgeon |

**Note:** The `priorityId` field may contain a JSON array when treatments combine multiple Priority orders (e.g., pancreas multi-stage treatments).

#### 6.2.3 Applicators Table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique applicator identifier |
| serialNumber | VARCHAR(100) | NOT NULL, indexed | Applicator serial number |
| seedQuantity | INTEGER | NOT NULL, default 0 | Seeds in applicator |
| usageType | ENUM | NOT NULL, default 'full' | Usage outcome (full, faulty, none) |
| status | VARCHAR(50) | nullable, validated | Workflow status |
| packageLabel | VARCHAR(10) | nullable | Package identifier |
| insertionTime | TIMESTAMP | NOT NULL | When applicator was used |
| comments | TEXT | nullable | Usage comments |
| treatmentId | UUID | FK→treatments, NOT NULL | Parent treatment |
| addedBy | UUID | FK→users, NOT NULL | User who added |
| isRemoved | BOOLEAN | NOT NULL, default false | Removal tracking |
| removalTime | TIMESTAMP | nullable | When removed |
| removedBy | UUID | FK→users, nullable | User who removed |
| applicatorType | VARCHAR(255) | nullable | Type from Priority PARTS |
| attachmentFilename | VARCHAR(255) | nullable | Uploaded file name |
| attachmentFileCount | INTEGER | NOT NULL, default 0 | Number of attached files |
| attachmentSizeBytes | BIGINT | NOT NULL, default 0 | Total attachment size |
| attachmentSyncStatus | ENUM | NOT NULL, default 'pending' | Sync state (pending, syncing, synced, failed) |

#### 6.2.4 ApplicatorAuditLog Table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique log entry identifier |
| applicatorId | UUID | FK→applicators, NOT NULL | Related applicator |
| oldStatus | VARCHAR(50) | nullable | Previous status |
| newStatus | VARCHAR(50) | NOT NULL, validated | New status |
| changedBy | VARCHAR(255) | NOT NULL | User email who made change |
| changedAt | TIMESTAMP | NOT NULL, default NOW() | When change occurred |
| reason | TEXT | nullable | Reason for change |
| requestId | VARCHAR(100) | nullable | Correlation ID |

### 6.3 Data Integrity and Retention

| ID | Requirement | Priority |
|----|-------------|----------|
| SRS-DATA-001 | The system shall use foreign key constraints for referential integrity | Critical |
| SRS-DATA-002 | The system shall use database transactions for multi-step operations | Critical |
| SRS-DATA-003 | Audit log records shall never be deleted | Critical |
| SRS-DATA-004 | Treatment data shall be retained for minimum 7 years (regulatory requirement) | Critical |
| SRS-DATA-005 | The system shall implement database backups | High |

---

## 7. Verification and Validation

### 7.1 Verification Methods

| Requirement Category | Verification Method |
|---------------------|---------------------|
| Authentication (SRS-AUTH-*) | Unit tests, integration tests, security penetration testing |
| Treatment Selection (SRS-TSEL-*) | Integration tests with Priority API mocks |
| Applicator Scanning (SRS-SCAN-*) | Unit tests, E2E tests with test barcodes |
| Workflow (SRS-WKFL-*) | Unit tests for state machine, integration tests |
| Progress (SRS-PROG-*) | Frontend component tests |
| Finalization (SRS-FINL-*) | E2E tests, manual QA verification |
| Export (SRS-EXPRT-*) | Integration tests, manual PDF review |
| Removal (SRS-RMVL-*) | Integration tests |
| Audit (SRS-AUDT-*) | Database queries, integration tests |
| Security (SRS-SEC-*) | Security scanning, penetration testing |
| Performance (SRS-PERF-*) | Load testing, performance monitoring |

### 7.2 Traceability Matrix

The complete requirements traceability matrix is maintained in a separate document:

**See:** [srs/traceability-matrix.md](srs/traceability-matrix.md)

The traceability matrix includes:
- All 162 requirements with unique IDs
- Hazard linkage (from ISO 14971 analysis)
- Test case references
- Implementation status

**Summary Statistics:**
- Total Requirements: 162
- Implemented: 130 (80.2%)
- Needs Verification: 27 (16.7%)
- Pending Implementation: 5 (3.1%)

---

## 8. Risk Management Integration

This section documents the integration of ISO 14971:2019 risk management with software requirements.

### 8.1 Risk Management File Reference

The complete hazard analysis is maintained in a separate document:

**See:** [srs/hazard-analysis.md](srs/hazard-analysis.md)

### 8.2 Software Safety Classification

**IEC 62304 Safety Class: B**

**Rationale:** The ALA is a documentation and tracking system that does not directly control medical device operation. However, incorrect tracking could result in:
- Unreported applicator usage affecting regulatory compliance
- Incorrect seed counts in patient documentation
- Treatment documentation errors

### 8.3 Hazard Summary

| Hazard ID | Description | Initial Risk | Residual Risk | Related Requirements |
|-----------|-------------|--------------|---------------|---------------------|
| HAZ-001 | Incorrect applicator tracking | Medium | ALARP | SRS-SCAN-003, SRS-AUDT-001 |
| HAZ-002 | Incorrect seed count | Medium | ALARP | SRS-SCAN-007, SRS-SCAN-008 |
| HAZ-003 | Unauthorized access to patient data | Medium | Low | SRS-AUTH-*, SRS-SEC-* |
| HAZ-004 | Data loss during documentation | Medium | ALARP | SRS-DATA-002, SRS-RECV-* |
| HAZ-005 | Audit trail tampering | Medium | ALARP | SRS-AUDT-005, SRS-SEC-015 |
| HAZ-006 | Applicator used on wrong patient | Medium | ALARP | SRS-SCAN-004, SRS-SCAN-005 |
| HAZ-007 | Treatment finalized without verification | Medium | Low | SRS-FINL-003, SRS-FINL-009 |
| HAZ-008 | Removal on wrong treatment | Medium | ALARP | SRS-RMVL-001, SRS-TSEL-007 |
| HAZ-009 | Session hijacking | Medium | Low | SRS-AUTH-007, SRS-SEC-016 |
| HAZ-010 | Brute force attack | Low | Low | SRS-SEC-003, SRS-AUTH-004 |

### 8.4 Safety-Critical Requirements

The following requirements are classified as safety-critical based on their role in risk control:

| Requirement ID | Description | Related Hazards |
|---------------|-------------|-----------------|
| SRS-SCAN-003 | Validate applicator against Priority | HAZ-001, HAZ-006 |
| SRS-SCAN-005 | Detect wrong treatment applicator | HAZ-006 |
| SRS-AUDT-005 | Immutable audit logs | HAZ-001, HAZ-005 |
| SRS-AUTH-007 | HttpOnly secure cookies | HAZ-003, HAZ-009 |
| SRS-FINL-009 | Immutable finalized treatments | HAZ-007 |
| SRS-SEC-003 | Rate limiting on authentication | HAZ-003, HAZ-010 |

### 8.5 Risk Control Verification

All risk control measures shall be verified through:
1. Code review confirming implementation
2. Unit tests for control logic
3. Integration tests for end-to-end validation
4. Security testing for access controls

---

## 9. Cybersecurity Requirements

This section addresses FDA cybersecurity guidance and HIPAA 2025 security requirements.

### 9.1 Cybersecurity Framework

| ID | Requirement | Priority | Reference |
|----|-------------|----------|-----------|
| SRS-CYBER-001 | The system shall maintain a Software Bill of Materials (SBOM) | High | FDA Guidance |
| SRS-CYBER-002 | The system shall undergo vulnerability scanning every 6 months | High | HIPAA 2025 |
| SRS-CYBER-003 | The system shall undergo annual penetration testing | High | HIPAA 2025 |
| SRS-CYBER-004 | The system shall have documented incident response procedures | High | HIPAA 2025 |
| SRS-CYBER-005 | The system shall have patch management process (critical patches within 30 days) | High | FDA Guidance |

### 9.2 Software Bill of Materials (SBOM)

The system shall maintain an SBOM documenting:
- All open-source dependencies
- Version numbers for each component
- Known vulnerabilities (CVEs)
- License information

### 9.3 Vulnerability Management

| Activity | Frequency | Responsible |
|----------|-----------|-------------|
| Vulnerability scanning | Every 6 months | DevOps |
| Penetration testing | Annual | Third-party security firm |
| Dependency updates | Monthly review | Development team |
| Critical patch deployment | Within 30 days | DevOps |

### 9.4 Incident Response

The system shall support incident response through:
- Comprehensive audit logging (per SRS-AUDT-*)
- User session management (per SRS-AUTH-*)
- Network monitoring integration capability
- Forensic data preservation

---

## Appendices

### Appendix A: Applicator Status State Diagram

See [docs/srs/applicator-state-diagram.md](srs/applicator-state-diagram.md)

```
                    ┌─────────┐
                    │ SEALED  │
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │ OPENED  │     │INSERTED │     │ FAULTY  │
    │(Panc/Pr)│     │ (Skin)  │     │ (Skin)  │
    └────┬────┘     └─────────┘     └─────────┘
         │
    ┌────┴────┬───────────┐
    │         │           │
    ▼         ▼           ▼
┌────────┐ ┌───────┐ ┌──────────┐
│ LOADED │ │FAULTY │ │ DISPOSED │
└────┬───┘ └───────┘ └──────────┘
     │
┌────┴────┬────────────────┬─────────────────┐
│         │                │                 │
▼         ▼                ▼                 ▼
┌────────┐ ┌───────────┐ ┌────────────────────┐
│INSERTED│ │DISCHARGED │ │DEPLOYMENT_FAILURE  │
└────────┘ └───────────┘ └────────────────────┘
```

**Legend:**
- Terminal states: INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE
- In-progress states: SEALED, OPENED, LOADED
- Green highlight: INSERTED (success)
- Black highlight: All failure terminal states

### Appendix B: User Role Permission Matrix

| Permission | Hospital | AlphaTau | Admin |
|------------|----------|----------|-------|
| Login | Yes | Yes | Yes |
| View treatments (own sites) | Yes | Yes | Yes |
| View treatments (all sites) | No | Yes | Yes |
| Create insertion treatment | Yes | Yes | Yes |
| Create removal treatment | Yes | Yes | Yes |
| Add applicators | Yes | Yes | Yes |
| Edit applicators | Yes | Yes | Yes |
| Finalize treatment (auto) | Yes | No | Yes |
| Finalize treatment (verified) | N/A | Yes | Yes |
| View admin dashboard | No | No | Yes |
| View system logs | No | No | Yes |

**Note:** Position Code 99 overrides all restrictions and grants full admin access.

### Appendix C: Priority API Integration Details

#### Authentication
- Method: Basic Authentication
- Credentials: Configured via environment variables

#### PHONEBOOK Query
```
GET /PHONEBOOK?$filter=EMAIL eq '{email}'
&$select=EMAIL,NAME,POSITION,PHONE,SITES
```

#### ORDERS Query
```
GET /ORDERS?$filter=SITE eq '{site}' and DATE ge {startDate}
&$select=ORDNAME,DETAILS,SIESSION,SITE,DATE,SURGEON
```

#### SIBD_APPLICATUSELIST Query
```
GET /SIBD_APPLICATUSELIST?$filter=SERIALNUMBER eq '{serialNumber}'
&$select=SERIALNUMBER,SEEDQTY,PARTDES
```

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| Applicator | Medical device used to deploy brachytherapy seeds |
| Brachytherapy | Internal radiation therapy using implanted radioactive sources |
| HttpOnly Cookie | Cookie with HttpOnly flag preventing JavaScript access |
| JWT | JSON Web Token for stateless authentication |
| OData | Open Data Protocol for REST APIs |
| Position Code | Priority ERP user classification number |
| Subject ID | Unique patient/treatment identifier in Priority ERP |
| Terminal Status | Applicator status that does not allow further transitions |

---

## Export to Word Document

To export this document to Word format for QA review:

```bash
# Run the conversion script from project root
node docs/convert-to-docx.js
```

This generates `docs/ALA_SRS.docx` using the `docx` npm library.

---

*Document generated in compliance with IEEE/ISO/IEC 29148:2018 and IEC 62304:2006+AMD1:2015*
