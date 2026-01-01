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
- Patient–clinician relationship management
- Manual measurement entry (weight, BP)
- Time-series visualization
- Manual clinician review
- Basic rule-based alerts (no automation)
- Interaction logging for RPM/CCM compliance

## Non-Goals (MVP)
- Automated clinical decisions
- Black-box AI predictions
- FDA-cleared diagnostic claims
- Full EHR integration
- Device integrations
- Lab result parsing

---

## MVP+ Roadmap (Post-Launch Capabilities)

These capabilities are designed into the architecture but NOT implemented in MVP.

### Phase 1: Enhanced Data Capture
- **Lab Results (Document Upload)**: Patients upload lab PDFs; clinicians view as attachments
- **Device Integration (Withings)**: OAuth-based sync for weight, BP; extensible adapter pattern
- **Medication Tracking**: Patient confirms adherence; optional reminders

### Phase 2: Structured Data & Automation
- **Lab Results (Structured)**: OCR/parsing of uploaded documents; manual correction UI
- **Educational Content Delivery**: Condition-specific articles, nutrition guidance
- **Device Expansion**: Additional vendors via adapter pattern (research use cases)

### Phase 3: AI-Assisted Workflows
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
