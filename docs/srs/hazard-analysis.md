# Hazard Analysis - ALA Medical Treatment Tracking System

## Document Control

| Document Information | |
|---------------------|---|
| **Document ID** | ALA-HA-001 |
| **Version** | 2.0 |
| **Date** | January 2026 |
| **Status** | Draft |
| **Parent Document** | ALA-SRS-001 v4.0 |
| **Standard Reference** | ISO 14971:2019 |

---

## 1. Introduction

### 1.1 Purpose

This document provides the hazard analysis for the Accountability Log Application (ALA) in accordance with ISO 14971:2019. It identifies potential hazards, assesses risks, defines control measures, and traces these controls to specific software requirements in the SRS.

### 1.2 Scope

This analysis covers all software-related hazards for the ALA system, including:
- User authentication and authorization
- Treatment data entry and management
- Applicator tracking and validation
- Data integrity and audit trails
- System availability and recovery

### 1.3 Software Safety Classification

**IEC 62304 Safety Class: B**

**Rationale:** The ALA is a documentation and tracking system that does not directly control medical device operation. However, incorrect tracking could result in:
- Unreported applicator usage affecting regulatory compliance
- Incorrect seed counts in patient documentation
- Treatment documentation errors

The system does not directly cause patient harm but could contribute to hazardous situations if documentation is inaccurate.

---

## 2. Risk Assessment Methodology

### 2.1 Severity Scale

| Level | Category | Definition | Examples |
|-------|----------|------------|----------|
| 5 | Catastrophic | Could result in patient death | Wrong patient receives treatment |
| 4 | Major | Could result in serious injury or major documentation failure | Missing applicators in treatment record |
| 3 | Moderate | Could result in minor injury or significant inconvenience | Treatment documentation incomplete |
| 2 | Minor | Could result in minor inconvenience | UI display errors, slow performance |
| 1 | Negligible | No impact on patient or minimal inconvenience | Cosmetic issues |

### 2.2 Probability Scale

| Level | Category | Definition | Frequency |
|-------|----------|------------|-----------|
| 5 | Almost Certain | Expected to occur | > 1 per month |
| 4 | Likely | Will probably occur | 1 per quarter |
| 3 | Possible | May occur occasionally | 1 per year |
| 2 | Unlikely | Could occur but not expected | 1 per 5 years |
| 1 | Rare | Very unlikely to occur | < 1 per 10 years |

### 2.3 Risk Matrix

| Probability ↓ / Severity → | 1 Negligible | 2 Minor | 3 Moderate | 4 Major | 5 Catastrophic |
|----------------------------|--------------|---------|------------|---------|----------------|
| 5 Almost Certain | Low | Medium | High | Critical | Critical |
| 4 Likely | Low | Medium | High | High | Critical |
| 3 Possible | Low | Low | Medium | High | High |
| 2 Unlikely | Low | Low | Medium | Medium | High |
| 1 Rare | Low | Low | Low | Medium | Medium |

### 2.4 Risk Acceptability Criteria

| Risk Level | Acceptability | Required Action |
|------------|---------------|-----------------|
| **Critical** | Unacceptable | Risk reduction mandatory before release |
| **High** | Unacceptable | Risk reduction required; benefit-risk analysis |
| **Medium** | ALARP | Reduce if reasonably practicable |
| **Low** | Acceptable | No additional controls required |

---

## 3. Hazard Identification and Analysis

### HAZ-001: Incorrect Applicator Tracking

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-001 |
| **Hazard Description** | Applicator usage not correctly recorded, leading to unreported usage |
| **Hazardous Situation** | Treatment record does not reflect actual applicators used |
| **Potential Harm** | Regulatory non-compliance, incorrect patient documentation |
| **Severity** | 4 (Major) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-001-A | Validate applicator serial numbers against Priority ERP inventory | Inherent Safety | SRS-SCAN-003 |
| RC-001-B | Log all applicator status changes in immutable audit trail | Protective Measure | SRS-AUDT-001, SRS-AUDT-005 |
| RC-001-C | Display confirmation of applicator addition to treatment | Information | SRS-SCAN-006 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-002: Incorrect Seed Count in Documentation

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-002 |
| **Hazard Description** | Seed quantities incorrectly recorded in treatment documentation |
| **Hazardous Situation** | Patient record shows incorrect number of seeds implanted |
| **Potential Harm** | Incorrect radiation dose documentation, follow-up care errors |
| **Severity** | 4 (Major) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-002-A | Retrieve seed quantity from Priority ERP master data | Inherent Safety | SRS-SCAN-007 |
| RC-002-B | Require justification for manual seed quantity override | Protective Measure | SRS-SCAN-008 |
| RC-002-C | Display seed count totals during treatment progress | Information | SRS-PROG-002 |
| RC-002-D | Include seed totals in finalized PDF report | Information | SRS-EXPRT-005 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-003: Unauthorized Access to Patient Treatment Data

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-003 |
| **Hazard Description** | Unauthorized users access or modify patient treatment records |
| **Hazardous Situation** | PHI exposed to unauthorized individuals; treatment records altered |
| **Potential Harm** | HIPAA violation, patient privacy breach, data integrity loss |
| **Severity** | 3 (Moderate) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-003-A | Validate user email against Priority PHONEBOOK | Inherent Safety | SRS-AUTH-001 |
| RC-003-B | Store JWT tokens in HttpOnly secure cookies | Protective Measure | SRS-AUTH-007 |
| RC-003-C | Restrict access to authorized sites only | Protective Measure | SRS-AUTH-010, SRS-TSEL-003 |
| RC-003-D | Implement session timeout after inactivity | Protective Measure | SRS-SEC-016 |
| RC-003-E | Log all data access in audit trail | Protective Measure | SRS-AUDT-001 |
| RC-003-F | Implement rate limiting on authentication | Protective Measure | SRS-SEC-003 |

**Residual Risk:**
- Severity: 3 | Probability: 1 | Risk Level: **Low (Acceptable)**

---

### HAZ-004: Data Loss During Treatment Documentation

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-004 |
| **Hazard Description** | Treatment data lost due to system failure, database corruption, or user error |
| **Hazardous Situation** | Treatment record incomplete or lost entirely |
| **Potential Harm** | Regulatory non-compliance, inability to track patient treatment |
| **Severity** | 4 (Major) |
| **Initial Probability** | 1 (Rare) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-004-A | Use database transactions for multi-step operations | Inherent Safety | SRS-DATA-002 |
| RC-004-B | Implement automated database backups | Protective Measure | SRS-RECV-001 |
| RC-004-C | Define Recovery Time Objective (RTO) | Protective Measure | SRS-RECV-002 |
| RC-004-D | Define Recovery Point Objective (RPO) | Protective Measure | SRS-RECV-003 |
| RC-004-E | Verify backup integrity weekly | Protective Measure | SRS-RECV-004 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-005: Audit Trail Tampering

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-005 |
| **Hazard Description** | Audit logs modified or deleted, hiding compliance issues |
| **Hazardous Situation** | Cannot verify treatment history or investigate discrepancies |
| **Potential Harm** | Regulatory non-compliance, inability to trace treatment issues |
| **Severity** | 4 (Major) |
| **Initial Probability** | 1 (Rare) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-005-A | Design audit log table as append-only (no updates/deletes) | Inherent Safety | SRS-AUDT-005 |
| RC-005-B | Include request ID for correlation | Protective Measure | SRS-AUDT-004 |
| RC-005-C | Retain audit logs for minimum 6 years | Protective Measure | SRS-SEC-014 |
| RC-005-D | Implement log integrity verification | Protective Measure | SRS-SEC-015 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-006: Applicator Used on Wrong Patient

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-006 |
| **Hazard Description** | Applicator scanned and documented for incorrect patient treatment |
| **Hazardous Situation** | Patient receives applicator intended for different patient; documentation mismatch |
| **Potential Harm** | Patient safety risk (wrong treatment), incorrect medical record |
| **Severity** | 5 (Catastrophic) |
| **Initial Probability** | 1 (Rare) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-006-A | Detect applicators assigned to different treatments | Inherent Safety | SRS-SCAN-005 |
| RC-006-B | Detect duplicate applicator scanning | Inherent Safety | SRS-SCAN-004 |
| RC-006-C | Display clear patient identifier during treatment | Information | SRS-TSEL-006 |
| RC-006-D | Validate applicator against Priority inventory | Protective Measure | SRS-SCAN-003 |

**Residual Risk:**
- Severity: 5 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-007: Treatment Finalized Without Proper Verification

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-007 |
| **Hazard Description** | Treatment marked complete without appropriate clinical verification |
| **Hazardous Situation** | Incomplete or incorrect treatment record finalized as official |
| **Potential Harm** | Incorrect patient documentation, regulatory non-compliance |
| **Severity** | 3 (Moderate) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-007-A | Require digital signature for finalization | Inherent Safety | SRS-FINL-001 |
| RC-007-B | Require verification code for AlphaTau signatures | Protective Measure | SRS-FINL-003 |
| RC-007-C | Limit signature verification attempts | Protective Measure | SRS-FINL-005 |
| RC-007-D | Make finalized treatments immutable | Protective Measure | SRS-FINL-009 |
| RC-007-E | Generate PDF with signature details | Information | SRS-EXPRT-004 |

**Residual Risk:**
- Severity: 3 | Probability: 1 | Risk Level: **Low (Acceptable)**

---

### HAZ-008: Removal Performed on Wrong Treatment

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-008 |
| **Hazard Description** | Seed removal procedure linked to incorrect insertion treatment |
| **Hazardous Situation** | Removal documentation does not match actual patient treatment |
| **Potential Harm** | Incorrect patient documentation, follow-up care errors |
| **Severity** | 4 (Major) |
| **Initial Probability** | 1 (Rare) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-008-A | Enforce 30-day minimum between insertion and removal | Inherent Safety | SRS-RMVL-001, SRS-TSEL-007 |
| RC-008-B | Display applicators from original insertion | Information | SRS-RMVL-002 |
| RC-008-C | Track removal linked to specific insertion | Inherent Safety | SRS-RMVL-006 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-009: Session Hijacking via Stolen Token

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-009 |
| **Hazard Description** | Authentication token stolen and used by unauthorized party |
| **Hazardous Situation** | Attacker accesses system as legitimate user |
| **Potential Harm** | Unauthorized data access, data modification |
| **Severity** | 3 (Moderate) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-009-A | Store tokens in HttpOnly secure cookies | Inherent Safety | SRS-AUTH-007 |
| RC-009-B | Implement 30-minute session timeout | Protective Measure | SRS-SEC-016 |
| RC-009-C | Use TLS 1.3 for all communications | Protective Measure | SRS-SEC-011 |
| RC-009-D | Implement logout functionality | Protective Measure | SRS-AUTH-013 |

**Residual Risk:**
- Severity: 3 | Probability: 1 | Risk Level: **Low (Acceptable)**

---

### HAZ-010: Brute Force Authentication Attack

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-010 |
| **Hazard Description** | Attacker attempts to guess verification codes through repeated attempts |
| **Hazardous Situation** | Unauthorized access to user account |
| **Potential Harm** | Unauthorized data access |
| **Severity** | 2 (Minor) |
| **Initial Probability** | 3 (Possible) |
| **Initial Risk** | Low |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-010-A | Rate limit authentication attempts | Inherent Safety | SRS-SEC-003 |
| RC-010-B | Expire verification codes after 10 minutes | Protective Measure | SRS-AUTH-004 |
| RC-010-C | Track failed verification attempts | Protective Measure | SRS-AUTH-008 |
| RC-010-D | Hash verification codes with bcrypt | Protective Measure | SRS-AUTH-005 |

**Residual Risk:**
- Severity: 2 | Probability: 1 | Risk Level: **Low (Acceptable)**

---

### HAZ-011: Data Loss During Offline Sync (NEW)

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-011 |
| **Hazard Description** | Offline changes lost or corrupted during synchronization with server |
| **Hazardous Situation** | Treatment data recorded offline not properly saved to server |
| **Potential Harm** | Incomplete treatment records, regulatory non-compliance |
| **Severity** | 4 (Major) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-011-A | Queue offline changes with SHA-256 integrity hashes | Inherent Safety | SRS-OFFL-006 |
| RC-011-B | Detect and store sync conflicts for resolution | Protective Measure | SRS-OFFL-011 |
| RC-011-C | Support idempotent sync to prevent duplicates | Protective Measure | SRS-OFFL-024 |
| RC-011-D | Maintain offline audit log | Protective Measure | SRS-OFFL-013 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-012: Stale Offline Data Used in Treatment (NEW)

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-012 |
| **Hazard Description** | Outdated offline data used for treatment decisions |
| **Hazardous Situation** | Treatment decisions based on expired or superseded data |
| **Potential Harm** | Incorrect treatment documentation, potential patient safety issues |
| **Severity** | 3 (Moderate) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-012-A | Enforce 24-hour bundle expiry | Inherent Safety | SRS-OFFL-010 |
| RC-012-B | Auto-delete expired offline bundles | Protective Measure | SRS-OFFL-018 |
| RC-012-C | Display offline status banner | Information | SRS-OFFL-020 |
| RC-012-D | Sync clock with server | Protective Measure | SRS-OFFL-015 |

**Residual Risk:**
- Severity: 3 | Probability: 1 | Risk Level: **Low (Acceptable)**

---

### HAZ-013: Unauthorized Offline PHI Access (NEW)

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-013 |
| **Hazard Description** | Protected Health Information accessed by unauthorized party from offline storage |
| **Hazardous Situation** | PHI stored in IndexedDB accessed without authentication |
| **Potential Harm** | HIPAA violation, patient privacy breach |
| **Severity** | 4 (Major) |
| **Initial Probability** | 2 (Unlikely) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-013-A | Encrypt PHI at rest using AES-256-GCM | Inherent Safety | SRS-OFFL-003 |
| RC-013-B | Use PBKDF2 key derivation with 100,000 iterations | Protective Measure | SRS-OFFL-004 |
| RC-013-C | Encrypt critical fields (patientName, subjectId, surgeon, etc.) | Protective Measure | SRS-OFFL-023 |
| RC-013-D | Request persistent storage permission | Protective Measure | SRS-OFFL-019 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-014: Clock Skew Causing Timestamp Errors (NEW)

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-014 |
| **Hazard Description** | Device clock drift causes incorrect timestamps on treatment records |
| **Hazardous Situation** | Treatment timestamps inaccurate, affecting medical record integrity |
| **Potential Harm** | Incorrect treatment timing documentation |
| **Severity** | 2 (Minor) |
| **Initial Probability** | 3 (Possible) |
| **Initial Risk** | Low |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-014-A | Sync clock with server (5-minute tolerance) | Inherent Safety | SRS-OFFL-015 |
| RC-014-B | Record both offline timestamp and sync timestamp | Protective Measure | SRS-OFFL-013 |

**Residual Risk:**
- Severity: 2 | Probability: 1 | Risk Level: **Low (Acceptable)**

---

### HAZ-015: Treatment Finalized Offline Without Verification (NEW)

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-015 |
| **Hazard Description** | Treatment marked complete while offline without proper signature verification |
| **Hazardous Situation** | Treatment finalized without required digital signature |
| **Potential Harm** | Invalid treatment records, regulatory non-compliance |
| **Severity** | 4 (Major) |
| **Initial Probability** | 1 (Rare) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-015-A | Block treatment finalization while offline | Inherent Safety | SRS-OFFL-014 |
| RC-015-B | Medical-critical status conflicts require admin resolution | Protective Measure | SRS-OFFL-012 |
| RC-015-C | User-controlled app updates (no auto-update during treatment) | Protective Measure | SRS-OFFL-022 |

**Residual Risk:**
- Severity: 4 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

### HAZ-016: Continuation on Wrong Patient (NEW)

| Attribute | Value |
|-----------|-------|
| **Hazard ID** | HAZ-016 |
| **Hazard Description** | Continuation treatment created for wrong patient or wrong parent treatment |
| **Hazardous Situation** | New treatment linked to incorrect parent, documenting applicators for wrong patient |
| **Potential Harm** | Incorrect patient documentation, potential patient safety risk |
| **Severity** | 5 (Catastrophic) |
| **Initial Probability** | 1 (Rare) |
| **Initial Risk** | Medium |

**Risk Control Measures:**
| Control ID | Control Measure | Type | Related Requirements |
|------------|-----------------|------|----------------------|
| RC-016-A | Track parent-child relationship via parentTreatmentId | Inherent Safety | SRS-CONT-003 |
| RC-016-B | Inherit patient info from parent treatment | Protective Measure | SRS-CONT-004 |
| RC-016-C | Require same patient + site for continuation | Protective Measure | SRS-CONT-001 |
| RC-016-D | Display parent treatment details in confirmation modal | Information | SRS-CONT-007 |

**Residual Risk:**
- Severity: 5 | Probability: 1 | Risk Level: **Medium (Acceptable with ALARP)**

---

## 4. Risk Summary

### 4.1 Risk Overview

| Hazard ID | Description | Initial Risk | Residual Risk | Status |
|-----------|-------------|--------------|---------------|--------|
| HAZ-001 | Incorrect applicator tracking | Medium | Medium | ALARP |
| HAZ-002 | Incorrect seed count | Medium | Medium | ALARP |
| HAZ-003 | Unauthorized access | Medium | Low | Acceptable |
| HAZ-004 | Data loss | Medium | Medium | ALARP |
| HAZ-005 | Audit trail tampering | Medium | Medium | ALARP |
| HAZ-006 | Wrong patient applicator | Medium | Medium | ALARP |
| HAZ-007 | Improper finalization | Medium | Low | Acceptable |
| HAZ-008 | Wrong removal treatment | Medium | Medium | ALARP |
| HAZ-009 | Session hijacking | Medium | Low | Acceptable |
| HAZ-010 | Brute force attack | Low | Low | Acceptable |
| HAZ-011 | Data loss during offline sync | Medium | Medium | ALARP |
| HAZ-012 | Stale offline data | Medium | Low | Acceptable |
| HAZ-013 | Unauthorized offline PHI access | Medium | Medium | ALARP |
| HAZ-014 | Clock skew timestamp errors | Low | Low | Acceptable |
| HAZ-015 | Offline finalization | Medium | Medium | ALARP |
| HAZ-016 | Continuation wrong patient | Medium | Medium | ALARP |

### 4.2 Benefit-Risk Analysis

All identified hazards have been reduced to acceptable or ALARP levels through the implementation of control measures specified in the SRS requirements. The benefits of the ALA system (replacing error-prone paper logs, enabling real-time tracking, providing comprehensive audit trails) outweigh the residual risks.

---

## 5. Requirements Traceability

### 5.1 Hazard to Requirements Matrix

| Hazard ID | Related SRS Requirements |
|-----------|-------------------------|
| HAZ-001 | SRS-SCAN-003, SRS-AUDT-001, SRS-AUDT-005, SRS-SCAN-006 |
| HAZ-002 | SRS-SCAN-007, SRS-SCAN-008, SRS-PROG-002, SRS-EXPRT-005 |
| HAZ-003 | SRS-AUTH-001, SRS-AUTH-007, SRS-AUTH-010, SRS-TSEL-003, SRS-SEC-016, SRS-AUDT-001, SRS-SEC-003 |
| HAZ-004 | SRS-DATA-002, SRS-RECV-001, SRS-RECV-002, SRS-RECV-003, SRS-RECV-004 |
| HAZ-005 | SRS-AUDT-005, SRS-AUDT-004, SRS-SEC-014, SRS-SEC-015 |
| HAZ-006 | SRS-SCAN-005, SRS-SCAN-004, SRS-TSEL-006, SRS-SCAN-003 |
| HAZ-007 | SRS-FINL-001, SRS-FINL-003, SRS-FINL-005, SRS-FINL-009, SRS-EXPRT-004 |
| HAZ-008 | SRS-RMVL-001, SRS-TSEL-007, SRS-RMVL-002, SRS-RMVL-006 |
| HAZ-009 | SRS-AUTH-007, SRS-SEC-016, SRS-SEC-011, SRS-AUTH-013 |
| HAZ-010 | SRS-SEC-003, SRS-AUTH-004, SRS-AUTH-008, SRS-AUTH-005 |
| HAZ-011 | SRS-OFFL-006, SRS-OFFL-011, SRS-OFFL-024, SRS-OFFL-013 |
| HAZ-012 | SRS-OFFL-010, SRS-OFFL-018, SRS-OFFL-020, SRS-OFFL-015 |
| HAZ-013 | SRS-OFFL-003, SRS-OFFL-004, SRS-OFFL-023, SRS-OFFL-019 |
| HAZ-014 | SRS-OFFL-015, SRS-OFFL-013 |
| HAZ-015 | SRS-OFFL-014, SRS-OFFL-012, SRS-OFFL-022 |
| HAZ-016 | SRS-CONT-003, SRS-CONT-004, SRS-CONT-001, SRS-CONT-007 |

### 5.2 Safety-Critical Requirements

The following requirements are classified as safety-critical based on their role in risk control:

| Requirement ID | Description | Related Hazards |
|---------------|-------------|-----------------|
| SRS-SCAN-003 | Validate applicator against Priority | HAZ-001, HAZ-006 |
| SRS-SCAN-005 | Detect wrong treatment applicator | HAZ-006 |
| SRS-AUDT-005 | Immutable audit logs | HAZ-001, HAZ-005 |
| SRS-AUTH-007 | HttpOnly secure cookies | HAZ-003, HAZ-009 |
| SRS-FINL-009 | Immutable finalized treatments | HAZ-007 |
| SRS-SEC-003 | Rate limiting on auth | HAZ-003, HAZ-010 |
| SRS-OFFL-003 | Encrypt PHI at rest using AES-256-GCM | HAZ-013 |
| SRS-OFFL-006 | Queue offline changes with SHA-256 integrity hashes | HAZ-011 |
| SRS-OFFL-014 | Block treatment finalization while offline | HAZ-015 |
| SRS-CONT-003 | Track parent-child treatment relationship | HAZ-016 |

---

## 6. Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | December 2025 | - | Initial hazard analysis |
| 2.0 | January 2026 | - | Added HAZ-011 to HAZ-016 for Offline Mode and Treatment Continuation features |

---

*Document generated in compliance with ISO 14971:2019 - Medical devices - Application of risk management to medical devices*
