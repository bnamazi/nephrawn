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
- Basic rule-based alerts (no automation)
- Interaction logging for RPM/CCM compliance
- Patient clinical profile (CKD stage, comorbidities, medications)
- Care plan management (dry weight, BP targets, risk flags)
- Profile/care plan audit trail with change history

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

### 3. Email Notifications for Alerts
- Clinicians receive email when high-priority alerts trigger
- Configurable notification preferences per clinician
- Email contains alert summary with link to patient detail
- Rate-limited to prevent alert fatigue (daily digest option)
- **Non-goal**: SMS notifications (deferred)

### 4. Medication Tracking
- Patients log current medications with dosage
- Adherence confirmation (daily check-in option)
- Clinicians view medication list in patient profile
- Medication history tracked over time
- **Non-goal**: Automated reminders/push notifications (deferred)

### Prototype Completion Criteria
- All four features implemented, tested, and documented
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

The system must support Remote Patient Monitoring (RPM) and Chronic Care Management (CCM) billing:

- Time-logged patient interactions (billable events)
- Monthly activity summaries per patient
- Device-derived data with timestamps (when available)
- Clinician review attestation
- Minimum interaction thresholds per billing period

These requirements inform schema design. MVP includes basic interaction logging; full billing reports are MVP+.

---

## Non-Goals (All Phases)
- Automated clinical decisions without clinician review
- Black-box predictions without explainability
- Direct EHR write-back (read integrations may come later)
- Autonomous medication changes
- Diagnostic claims requiring FDA clearance
