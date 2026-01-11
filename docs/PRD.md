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
- Patient symptom tracking
- Clinic-initiated patient enrollment (invite model)
- Patient–clinician relationship management
- Manual measurement entry (weight, BP)
- Time-series visualization
- Manual clinician review
- Basic rule-based alerts with fixed clinical thresholds (no automation)
- Interaction logging for RPM/CCM audit trail (time tracking deferred)
- Patient clinical profile (CKD stage, comorbidities, medications)
- Care plan management (dry weight, BP targets, risk flags)
- Profile/care plan audit trail with change history

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

---

## Prototype Scope (Option B Features)

**Intent**: Before production hardening, the prototype will include enhanced data capture features to enable end-to-end clinical workflow evaluation.

The following features are in-scope for the prototype phase:

### 1. Device Integration (Withings)
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

### 3. Email Notifications for Alerts — ⚠️ NOT IMPLEMENTED
- Clinicians receive email when high-priority alerts trigger
- Configurable notification preferences per clinician
- Email contains alert summary with link to patient detail
- Rate-limited to prevent alert fatigue (daily digest option)
- **Status**: Deferred to MVP+. No email service, templates, or notification preferences exist yet.
- **Non-goal**: SMS notifications (deferred)

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

### Prototype Completion Criteria
- All five features implemented, tested, and documented
- End-to-end clinical workflows exercisable
- Feature interactions understood and documented
- Ready for holistic security hardening

---

## Production Roadmap (Post-Prototype)

After prototype completion and security hardening, these capabilities extend the platform.

### Production Phase 1: Hardening & Deployment
- Security hardening (auth, rate limiting, logging)
- Production deployment configuration
- Performance optimization
- Compliance documentation

### Production Phase 2: Structured Data & Automation
- **Lab Results (Structured)**: OCR/parsing of uploaded documents; manual correction UI
- **Educational Content Delivery**: Condition-specific articles, nutrition guidance
- **Device Expansion**: Additional vendors via adapter pattern (Fitbit, Apple Health)
- **Push Notifications**: Medication reminders, appointment alerts

### Production Phase 3: AI-Assisted Workflows
- **LLM Summarization**: Natural language explanations for alerts, trends
- **Patient Education Generation**: Personalized explanations of lab results, trends
- **Clinician Prioritization**: Risk-informed patient list ordering (explainable scores)

---

## RPM/CCM Requirements

The system must support Remote Patient Monitoring (RPM) and Chronic Care Management (CCM) workflows:

### MVP Scope (Audit Trail)
- Interaction logging with timestamps and type classification
- Device-derived data with timestamps and source attribution
- Patient activity records (symptom check-ins, measurements)
- Clinician note creation timestamps

### MVP+ Scope (Billing)
- Time tracking per interaction (billable minutes)
- Monthly activity summaries per patient
- Clinician review attestation
- Minimum interaction thresholds per billing period
- CPT code mapping and billing report generation

**Next Slice Candidate**: Monthly aggregation summaries and time entry for billable interactions.

---

## Non-Goals (All Phases)
- Automated clinical decisions without clinician review
- Black-box predictions without explainability
- Direct EHR write-back (read integrations may come later)
- Autonomous medication changes
- Diagnostic claims requiring FDA clearance
