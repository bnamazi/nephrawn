# Nephrawn — Product Requirements

## Overview
Nephrawn is a clinician-centered digital health platform designed to support the longitudinal management of patients with chronic kidney disease (CKD).

The platform enables structured collection of patient-reported symptoms, device-derived physiological measurements, and clinical interactions over time.

The primary goal is to help clinicians identify meaningful trends and changes that may indicate worsening fluid status, disease progression, or increased risk of hospitalization.

Nephrawn augments—not replaces—clinical judgment.

## Goals
- Support early identification of patient deterioration
- Reduce preventable hospitalizations and urgent dialysis
- Support RPM and CCM billing workflows
- Emphasize trends over single measurements
- Maintain transparency and explainability

## MVP Scope

MVP enables production deployment to clinics with CMS billing capability.

### Core Patient Capabilities
- Patient symptom tracking
- Clinic-initiated patient enrollment (invite model)
- Manual measurement entry (weight, BP)
- Device-synced measurements (Withings)
- Medication tracking with adherence logging
- Lab result entry (structured, with clinician verification)
- View own history, alerts, enrolled clinics

### Core Clinician Capabilities
- Patient panel review with alert inbox
- Time-series visualization and trend analysis
- Care plan management (dry weight, BP targets, risk flags)
- Clinical notes (standalone and alert-attached)
- Lab result verification workflow
- **Time logging for billable interactions**
- **Monthly billing summary reports**

### Core Platform Capabilities
- Multi-clinic support with role-based access
- Rule-based alerts with fixed clinical thresholds
- Interaction logging for RPM/CCM audit trail
- **Device transmission day tracking (for 99454 eligibility)**
- **Email notifications for critical alerts**
- Structured logging and health checks

### Measurement Types (MVP)
| Type | Patient Entry | Device Sync | Alerts |
|------|---------------|-------------|--------|
| Weight | ✅ | ✅ Withings | ✅ Weight gain rule |
| Blood Pressure (Systolic/Diastolic) | ✅ | ✅ Withings | ✅ High/low BP rules |
| SpO2 | Backend supported | ✅ Withings | ✅ Low SpO2 rule |
| Heart Rate | Backend supported | ✅ Withings | ❌ No rules yet |
| Body Composition (fat %, muscle, etc.) | ❌ | ✅ Withings | ❌ Trend-only |

**Note**: SpO2 and Heart Rate manual entry UI is deferred (patient app). Clinician app displays all measurement types.

### Alert Rules (MVP) — Fixed Clinical Defaults
| Rule | Condition | Severity | Configurable |
|------|-----------|----------|--------------|
| Weight Gain (48h) | >2 kg gain in 48 hours | CRITICAL | No (MVP) |
| BP Systolic High | ≥180 mmHg | CRITICAL | No (MVP) |
| BP Systolic Low | ≤90 mmHg | WARNING | No (MVP) |
| SpO2 Low | ≤92% | CRITICAL | No (MVP) |

**Future Enhancement**: Per-clinic configurable thresholds (preferred next step), then per-patient overrides for edge cases.

**Body Composition Note**: Fat ratio, muscle mass, and other body composition metrics are captured and trended but do NOT trigger alerts in MVP. Alerting thresholds may be introduced later after clinician validation, likely focusing first on fluid-related proxies rather than body fat %.

### Billing Readiness (MVP)
| Capability | CMS Code | MVP Scope |
|------------|----------|-----------|
| Device transmission days | 99454 | Count days with device data per 30-day period |
| Clinical staff time | 99457, 99490 | Manual time entry with activity type |
| Monthly summary report | All | JSON endpoint with eligibility indicators |
| CPT code eligibility | All | Display eligible codes based on thresholds |

**Non-Goals for Billing MVP:**
- Claims submission to clearinghouses
- EHR integration
- PDF report generation
- Automated time capture

---

## Patient Enrollment Workflow

### Overview
Nephrawn uses a **clinic-initiated invite model** for patient enrollment. This ensures:
- Clinicians control who can enroll (regulatory compliance)
- Patients cannot self-enroll without authorization
- No global patient/clinician search (privacy protection)

### Clinician Flow
1. Clinician navigates to Patients → Invite New Patient
2. Enters patient name, date of birth, optional email
3. System generates a unique invite code (40 characters)
4. Clinician shares code with patient (print, email, or verbally)
5. When patient claims, they appear in the enrolled patients list

### Patient Flow
1. Patient opens app → "Join a Clinic" / "I have an invite code"
2. Enters the invite code
3. Sees clinic name confirmation
4. Enters date of birth for identity verification
5. On match: account created (or linked if existing), enrollment activated
6. Patient is now connected to the clinic and assigned clinician(s)

## Non-Goals (MVP)
- Automated clinical decisions
- Black-box AI predictions
- FDA-cleared diagnostic claims
- Full EHR integration
- Claims submission (export only)
- Push notifications (email only)
- Additional device vendors beyond Withings
- AI/ML features (risk scoring, summarization)

---

## Production MVP Features

The following features comprise the production-ready MVP:

### 1. Device Integration (Withings) — IMPLEMENTED
- OAuth-based authorization flow for Withings devices
- Automatic sync of weight and blood pressure measurements
- Device data stored with `source = 'withings'` for traceability
- Existing alert rules apply to device-derived data
- Patient can connect/disconnect devices from settings

### 2. Lab Result Uploads
- Patients upload lab result documents (PDF, images)
- Secure storage with signed URLs
- Clinicians view documents inline in patient timeline
- Document metadata tracked (upload date, document type, notes)
- **Non-goal**: OCR/parsing of lab values (deferred to production)

### 3. Email Notifications for Alerts — TO BE IMPLEMENTED
- Clinicians receive email when CRITICAL/WARNING alerts trigger
- Configurable notification preferences per clinician
- Email contains alert summary with link to patient detail
- Rate-limited to prevent alert fatigue (1 email per patient per hour)
- Alert escalation for unacknowledged alerts (4-hour threshold)
- **Non-goal**: SMS notifications, push notifications (deferred)

### 4. Medication Tracking
- Patients log current medications with dosage
- Adherence confirmation (daily check-in option)
- Clinicians view medication list in patient profile
- Medication history tracked over time
- Discontinuation tracking: reason (free text), date, and clinician recorded for audit trail
- **Non-goal**: Automated reminders/push notifications (deferred)
- **Non-goal**: Structured discontinuation reason codes (deferred)

### 5. Structured Lab Results (Slice 2.5)
- Separate Labs tab with structured lab results (individual analyte rows)
- Manual entry with extension points for future automation
- Patient-entered labs with clinician verification workflow
- Common CKD analytes for quick-pick (Creatinine, eGFR, BUN, Potassium, etc.)
- Reference ranges and abnormal flags (High/Low/Critical)
- LOINC code support for future standardization
- Optional link to source document (PDF)

**Verification Workflow**:
- **Who can verify**: Any authenticated clinician enrolled with the patient's clinic
- **What verification means**: "Reviewed and confirmed as accurately transcribed from the source document/lab report" — NOT clinical interpretation, NOT endorsement of treatment decisions
- **Automation when verified**: None in MVP (no auto-alerts, no auto-messages)

- **Non-goal**: OCR/parsing of lab documents (deferred to production)
- **Non-goal**: Lab provider API integration (deferred)

### 6. Billing Readiness — TO BE IMPLEMENTED
- Clinician time logging (manual entry per patient interaction)
- Activity type classification (patient review, care plan update, alert response, phone call, lab review)
- Device transmission day counting (for RPM 99454 eligibility)
- Monthly billing summary report (per-patient, per-clinic)
- CPT code eligibility indicators (99454, 99457, 99458, 99490)
- **Non-goal**: Claims submission, PDF generation, EHR integration

### MVP Completion Criteria
- All six features implemented, tested, and documented
- End-to-end clinical workflows exercisable (symptom → alert → notification → response)
- Billing reports generatable for sample patients
- Security hardening complete (no critical vulnerabilities)
- Ready for production deployment

---

## Production Roadmap

### Phase 2: Automation & Efficiency
- **Per-clinic alert thresholds**: Configurable thresholds per clinic
- **Alert escalation enhancements**: Multi-level escalation, supervisor notification
- **Push notifications**: Mobile push for patients and clinicians
- **Lab OCR**: Extract values from uploaded PDFs
- **Additional devices**: Fitbit, Apple Health via adapter pattern

### Phase 3: AI-Assisted Workflows
- **LLM summarization**: Natural language explanations for trends
- **Risk scoring**: Explainable patient prioritization
- **Intelligent alerts**: ML-based threshold personalization
- **Care gap detection**: Automated identification of missing data

### Phase 4: Integration & Scale
- **EHR integration**: Read patient demographics, write notes
- **Claims submission**: Direct integration with clearinghouses
- **Multi-region deployment**: HIPAA-compliant scaling
- **API for third parties**: External developer access

---

## RPM/CCM Requirements

The system must support Remote Patient Monitoring (RPM) and Chronic Care Management (CCM) workflows:

### MVP Scope (Audit Trail + Billing Readiness)

| Requirement | Implementation |
|-------------|----------------|
| Device transmission days (99454) | Count distinct days with device-sourced measurements per patient per 30-day period |
| Clinical staff time (99457, 99490) | Manual time entry with activity type, duration, notes |
| Monthly summary report | JSON endpoint with per-patient aggregates and eligibility indicators |
| Interaction audit trail | InteractionLog with timestamps, types, optional duration |

### Billing API Endpoints (MVP)
- `POST /clinician/patients/:patientId/time-entries` — Log billable time
- `GET /clinician/patients/:patientId/time-entries` — List time entries
- `GET /clinician/patients/:patientId/billing-summary` — Monthly summary for patient
- `GET /clinician/clinic/:clinicId/billing-report` — Clinic-wide monthly report

### Eligibility Thresholds (Display Only)
| Code | Requirement | System Calculation |
|------|-------------|-------------------|
| 99454 | 16+ device days/month | `COUNT(DISTINCT DATE(timestamp)) WHERE source != 'manual'` |
| 99457 | 20+ minutes clinical time | `SUM(durationMinutes) WHERE month = X` |
| 99458 | Each additional 20 min | Same as above, display count of 20-min blocks |
| 99490 | 20+ minutes CCM time | Same query, filtered by CCM activity types |

### Phase 2 Scope (Future)
- PDF report generation
- Claims file export (837P format)
- Automated time tracking via activity inference
- EHR-based demographic sync

---

## Non-Goals (All Phases)
- Automated clinical decisions without clinician review
- Black-box predictions without explainability
- Direct EHR write-back (read integrations may come later)
- Autonomous medication changes
- Diagnostic claims requiring FDA clearance
