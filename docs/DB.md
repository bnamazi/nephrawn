# Nephrawn — Domain Model

## Core Concepts

Nephrawn models relationships over time between patients, clinicians, and observations.
The schema prioritizes:
- Auditability (who did what, when)
- Extensibility (JSONB for evolving structures)
- RPM/CCM compliance (interaction logging)

---

## MVP Entities

### Patient
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | string | Unique, used for auth |
| passwordHash | string | bcrypt |
| name | string | Display name |
| dateOfBirth | date | For clinical context |
| preferences | JSONB | Timezone, notification settings |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Clinician
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | string | Unique, used for auth |
| passwordHash | string | bcrypt |
| name | string | Display name |
| role | enum | clinician, admin |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Clinic
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | string | Organization name |
| slug | string | Unique URL-safe identifier |
| npi | string | Nullable; National Provider Identifier |
| address | JSONB | Nullable; structured address |
| phone | string | Nullable |
| status | enum | active, suspended |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (slug), Unique (npi) if not null

### ClinicMembership
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| clinicId | UUID | FK → Clinic |
| clinicianId | UUID | FK → Clinician |
| role | enum | owner, admin, clinician, staff |
| status | enum | active, inactive |
| joinedAt | timestamp | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (clinicId, clinicianId)

### Invite
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| code | string(40) | Cryptographic random code |
| clinicId | UUID | FK → Clinic |
| createdById | UUID | FK → Clinician |
| patientName | string | Expected patient name |
| patientDob | date | For identity verification |
| patientEmail | string | Nullable; for notification |
| status | enum | pending, claimed, expired, revoked |
| expiresAt | timestamp | Default: 7 days |
| claimedById | UUID | Nullable; FK → Patient who claimed |
| claimedAt | timestamp | Nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (code), Index (status, expiresAt) for cleanup jobs

### Enrollment
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| clinicianId | UUID | FK → Clinician |
| clinicId | UUID | FK → Clinic (organization boundary) |
| status | enum | active, paused, discharged |
| isPrimary | boolean | Supports multi-clinician (default true) |
| enrolledVia | enum | invite, migration, admin |
| inviteId | UUID | Nullable; FK → Invite if enrolled via invite |
| enrolledAt | timestamp | When relationship started |
| dischargedAt | timestamp | Nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (patientId, clinicianId, clinicId)

### PatientProfile
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient (unique) |
| sex | enum | male, female, other, unspecified |
| heightCm | decimal(5,1) | Height in centimeters |
| ckdStageSelfReported | enum | Patient-reported CKD stage |
| ckdStageClinician | enum | Clinician-verified CKD stage (authoritative) |
| ckdStageSetById | UUID | FK → Clinician who set clinician stage |
| ckdStageSetAt | timestamp | When clinician stage was set |
| primaryEtiology | enum | diabetes, hypertension, polycystic, etc. |
| dialysisStatus | enum | none, hemodialysis, peritoneal_dialysis |
| dialysisStartDate | date | Nullable |
| transplantStatus | enum | none, listed, received |
| transplantDate | date | Nullable |
| hasHeartFailure | boolean | |
| heartFailureClass | enum | NYHA class (I-IV) |
| diabetesType | enum | none, type_1, type_2 |
| hasHypertension | boolean | |
| otherConditions | string[] | Free-text array |
| onDiuretics | boolean | Medication flag |
| onAceArbInhibitor | boolean | Medication flag |
| onSglt2Inhibitor | boolean | Medication flag |
| onNsaids | boolean | Medication flag |
| onMra | boolean | Medication flag |
| onInsulin | boolean | Medication flag |
| medicationNotes | text | Clinician-only notes |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (patientId)

**CKD Stage Enum Values**: STAGE_1, STAGE_2, STAGE_3A, STAGE_3B, STAGE_4, STAGE_5, STAGE_5D, TRANSPLANT, UNKNOWN

**Design Note**: Dual CKD stage tracking (self-reported + clinician) enables safety comparison. Alerts use `ckdStageClinician ?? ckdStageSelfReported` for "effective" stage.

### CarePlan
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| enrollmentId | UUID | FK → Enrollment (unique) |
| dryWeightKg | decimal(5,2) | Target dry weight in kg |
| targetBpSystolic | JSONB | `{ min: number, max: number }` |
| targetBpDiastolic | JSONB | `{ min: number, max: number }` |
| priorHfHospitalizations | integer | Heart failure history |
| fluidRetentionRisk | boolean | Flag for alert sensitivity |
| fallsRisk | boolean | Flag for mobility concerns |
| notes | text | Clinician notes |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (enrollmentId)

**Design Note**: CarePlan is per-enrollment, allowing different targets across clinics. This supports multi-clinic patients with different care protocols.

### PatientProfileAudit
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| entityType | enum | PATIENT_PROFILE, CARE_PLAN |
| entityId | UUID | ID of the modified entity |
| actorType | enum | PATIENT, CLINICIAN, SYSTEM |
| actorId | UUID | Who made the change |
| actorName | string | Display name at time of change |
| changedFields | JSONB | `{ field: { old: value, new: value } }` |
| reason | text | Nullable; optional explanation |
| timestamp | timestamp | |

**Design Note**: Comprehensive audit trail for clinical data changes. Stores diff of changed fields for explainability.

### SymptomCheckin
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| timestamp | timestamp | When patient reported |
| symptoms | JSONB | Structured symptom data |
| notes | text | Free-text from patient |
| createdAt | timestamp | |

**symptoms JSONB structure** (example):
```json
{
  "edema": { "severity": 2, "location": "ankles" },
  "fatigue": { "severity": 3 },
  "shortnessOfBreath": { "severity": 1, "atRest": false }
}
```

### Measurement
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| timestamp | timestamp | When measured |
| type | enum | weight, bp_systolic, bp_diastolic, spo2, heart_rate |
| value | decimal(10,2) | Numeric value in **canonical units** |
| unit | string | Always canonical: kg, mmHg, %, bpm |
| inputUnit | string | Nullable; original unit if conversion occurred (e.g., "lbs") |
| source | string | 'manual', 'withings', future vendors |
| externalId | string | Nullable; vendor's record ID for dedup |
| createdAt | timestamp | |

**Canonical Units**: All measurements are stored in canonical units for consistency:
- WEIGHT → kg (lbs converted at ingestion)
- BP_SYSTOLIC, BP_DIASTOLIC → mmHg
- SPO2 → %
- HEART_RATE → bpm

**Constraints**:
- `@@unique([source, externalId])` — Prevents device duplicate imports
- `@@index([patientId, type, timestamp])` — Time-series queries
- `@@index([patientId, type, source, timestamp])` — Manual dedup window checks

### Alert
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| triggeredAt | timestamp | When rule fired |
| ruleId | string | Identifier for the rule (e.g., 'weight_gain_48h') |
| ruleName | string | Human-readable name |
| severity | enum | info, warning, critical |
| status | enum | open, acknowledged, dismissed |
| inputs | JSONB | Data that triggered alert (explainability) |
| summaryText | text | Nullable; LLM-generated explanation |
| acknowledgedBy | UUID | Nullable; FK → Clinician |
| acknowledgedAt | timestamp | Nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**inputs JSONB structure** (example for weight_gain_48h):
```json
{
  "measurements": [
    { "id": "uuid1", "value": 83.91, "unit": "kg", "timestamp": "..." },
    { "id": "uuid2", "value": 85.27, "unit": "kg", "timestamp": "..." }
  ],
  "oldestValue": 83.91,
  "newestValue": 85.27,
  "delta": 1.36,
  "thresholdKg": 1.36,
  "windowHours": 48
}
```

**Alert De-duplication**: When a rule triggers and an OPEN alert already exists for the same (patientId, ruleId), the existing alert is **updated** with new inputs rather than creating a duplicate. This prevents alert spam for ongoing conditions.

### ClinicianNote
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| clinicianId | UUID | FK → Clinician |
| alertId | UUID | Nullable; FK → Alert (attach note to specific alert) |
| content | text | Note body |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Indexes**:
- `@@index([patientId, createdAt])` — Patient timeline queries
- `@@index([alertId])` — Notes by alert

### InteractionLog (RPM/CCM)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| clinicianId | UUID | Nullable; FK → Clinician (null for patient actions) |
| timestamp | timestamp | When interaction occurred |
| interactionType | enum | See below |
| durationSeconds | integer | Nullable; for timed reviews |
| metadata | JSONB | Additional context |
| createdAt | timestamp | |

**interactionType values**:
- `patient_checkin` — Patient submitted symptom checkin
- `patient_measurement` — Patient submitted measurement
- `clinician_view` — Clinician viewed patient data
- `clinician_alert_ack` — Clinician acknowledged alert
- `clinician_note` — Clinician added note
- `clinician_call` — Phone call logged (future)
- `clinician_message` — Message sent (future)

---

## Relationships

```
Clinic ──────┬───── many ClinicMemberships ───── Clinician
             ├───── many Enrollments
             └───── many Invites

Clinician ───┬───── many ClinicMemberships ───── Clinic
             ├───── many Invites (created)
             ├───── many InteractionLogs
             ├───── many ClinicianNotes
             └───── many Alerts (via acknowledgedBy)

Patient ─────┬───── one PatientProfile
             ├───── many SymptomCheckins
             ├───── many Measurements
             ├───── many Alerts
             ├───── many InteractionLogs
             ├───── many ClinicianNotes
             ├───── many PatientProfileAudits
             ├───── many Enrollments ───── Clinician + Clinic
             └───── many Invites (claimed)

Enrollment ──┬───── one CarePlan
             └───── many PatientProfileAudits (via entityId)

Invite ──────┬───── one Clinic
             ├───── one Clinician (createdBy)
             └───── one Patient (claimedBy, nullable)

Alert ─────── many ClinicianNotes (via alertId)

LabReport ───┬───── one Patient
             ├───── one Document (optional)
             ├───── one Clinician (verifiedBy, optional)
             └───── many LabResults

LabResult ──── one LabReport
```

---

## Prototype Entities (Implemented)

### LabReport
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| documentId | UUID | Nullable; FK → Document (source PDF link) |
| collectedAt | timestamp | Date/time of blood draw |
| reportedAt | timestamp | Nullable; when lab reported results |
| labName | string | Nullable; e.g., "Quest Diagnostics" |
| orderingProvider | string | Nullable |
| notes | text | Nullable |
| source | enum | MANUAL_PATIENT, MANUAL_CLINICIAN, IMPORTED |
| verifiedAt | timestamp | Nullable; when clinician verified |
| verifiedById | UUID | Nullable; FK → Clinician |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Indexes**:
- `@@index([patientId, collectedAt])` — Patient lab timeline
- `@@index([documentId])` — Document lookup

### LabResult
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| reportId | UUID | FK → LabReport (cascade delete) |
| analyteCode | string | Nullable; LOINC code for standardization |
| analyteName | string | Display name (e.g., "Creatinine") |
| value | decimal(10,4) | Numeric result |
| unit | string | Unit of measurement |
| referenceRangeLow | decimal(10,4) | Nullable; lower bound |
| referenceRangeHigh | decimal(10,4) | Nullable; upper bound |
| flag | enum | Nullable; H (High), L (Low), C (Critical) |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**:
- `@@unique([reportId, analyteName])` — One result per analyte per report
- `@@index([reportId])` — Results by report

**LabSource Enum Values**: MANUAL_PATIENT, MANUAL_CLINICIAN, IMPORTED

**LabResultFlag Enum Values**: H (High), L (Low), C (Critical)

**Design Notes**:
- `source` distinguishes patient-entered from clinician-entered labs
- `verifiedAt`/`verifiedById` enables clinician verification workflow
- `analyteCode` supports future LOINC standardization
- `documentId` optionally links to source PDF (Document entity)
- Cascade delete ensures orphan cleanup when report is deleted

---

## Indexes (MVP)

| Table | Index | Purpose |
|-------|-------|---------|
| Clinic | (slug) | Lookup by URL-safe identifier |
| ClinicMembership | (clinicId, clinicianId) | Membership lookup |
| ClinicMembership | (clinicianId, status) | Clinician's active clinics |
| Invite | (code) | Invite claim lookup |
| Invite | (status, expiresAt) | Cleanup job for expired invites |
| Invite | (clinicId, status) | Pending invites for clinic |
| Enrollment | (clinicianId, clinicId, status) | List active patients for clinician in clinic |
| Enrollment | (patientId, clinicId) | Patient's enrollments per clinic |
| Measurement | (patientId, type, timestamp) | Time-series queries |
| SymptomCheckin | (patientId, timestamp) | Timeline queries |
| Alert | (patientId, status, triggeredAt) | Alert inbox |
| InteractionLog | (patientId, timestamp) | RPM/CCM monthly summaries |
| InteractionLog | (clinicianId, timestamp) | Clinician activity reports |
| PatientProfile | (patientId) | One-to-one with Patient |
| CarePlan | (enrollmentId) | One-to-one with Enrollment |
| PatientProfileAudit | (patientId, timestamp) | Profile change history |

---

## Extensibility Hooks (Schema Reserved, Not Implemented)

### Document (MVP+ Phase 1)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| uploadedAt | timestamp | |
| filename | string | Original filename |
| mimeType | string | application/pdf, image/jpeg, etc. |
| storageUrl | string | S3/GCS path |
| documentType | enum | lab_result, imaging, other |
| parsedData | JSONB | Nullable; structured extraction (Phase 2) |
| status | enum | uploaded, processing, parsed, failed |

### DeviceConnection (MVP+ Phase 1)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| vendor | enum | withings, (future vendors) |
| accessToken | string | Encrypted |
| refreshToken | string | Encrypted |
| expiresAt | timestamp | |
| status | enum | active, revoked, expired |
| lastSyncAt | timestamp | Nullable |

### MedicationReminder (MVP+ Phase 1)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| medicationName | string | |
| dosage | string | |
| schedule | JSONB | Cron-like or structured times |
| isActive | boolean | |

---

## Deferred (No Schema Now)

- Billing/claims entities (CPT codes, claim status)
- Risk scores (derived at query time initially)
- Caregiver accounts
- Educational content catalog
- LLM prompt/response audit logs
- Message threads (clinician-patient messaging)

---

## Measurement Deduplication Strategy

Two-layer deduplication prevents duplicate data from corrupting trends:

### Device Duplicates
- **Mechanism**: `@@unique([source, externalId])` constraint
- **Behavior**: If a device syncs the same reading twice, the unique constraint prevents insertion
- **Handling**: API returns existing measurement with `isDuplicate: true`

### Manual Duplicates
- **Mechanism**: 5-minute time window + 0.1% value tolerance
- **Behavior**: If patient submits similar value within window, treated as duplicate
- **Thresholds**:
  - Time window: 5 minutes before/after timestamp
  - Value tolerance: max(0.1% of value, 0.1 absolute)
- **Handling**: API returns existing measurement with `isDuplicate: true`

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| JSONB for symptoms | Schema evolution without migrations |
| JSONB for alert inputs | Explainability; store what triggered |
| InteractionLog separate from actions | Clean audit trail; supports billing queries |
| source + externalId on Measurement | Device integration without breaking changes |
| isPrimary on Enrollment | Multi-clinician support without restructure |
| preferences JSONB on Patient | Avoids migrations for settings changes |
| Canonical units for Measurement | Consistent storage; convert at boundaries |
| inputUnit preserves original | Audit trail of what user submitted |
| Alert update vs create | Prevents alert spam for ongoing conditions |
| Transaction for Measurement + Log | Atomicity; no orphaned records |
| Clinic as organization boundary | Multi-tenant isolation; HIPAA compliance |
| Invite code (40 chars) | ~10^48 combinations; unguessable |
| DOB verification on claim | Identity verification without global patient search |
| enrolledVia on Enrollment | Audit trail for how enrollment was created |
| PatientProfile separate from Patient | Clinical data evolves separately from auth; better audit trail |
| CarePlan per-enrollment | Multi-clinic patients can have different targets per clinic |
| Dual CKD stage tracking | Safety: clinician can verify self-reported stage |
| BP targets as min/max range | Supports personalized targets per KDIGO guidelines |
| PatientProfileAudit with changedFields | Explainability: see exactly what changed |
| actorName in audit | Preserves identity even if clinician is deleted |
