# Nephrawn — Domain Model

## Overview

Nephrawn models relationships over time between patients, clinicians, and clinical observations.
The schema prioritizes:
- Auditability (who did what, when)
- Extensibility (JSONB for evolving structures)
- RPM/CCM compliance (interaction logging)
- Multi-clinic support (clinic as organizational boundary)

---

## 1. Identity & Access

### Patient
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | string | Unique, used for auth |
| passwordHash | string | bcrypt |
| name | string | Display name |
| dateOfBirth | date | For clinical context and invite verification |
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
| role | enum | CLINICIAN, ADMIN |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Clinic
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | string | Organization name |
| slug | string | Unique URL-safe identifier |
| npi | string | Nullable; National Provider Identifier |
| taxId | string | Nullable; EIN for billing |
| address | JSONB | Nullable; structured address |
| phone | string | Nullable |
| fax | string | Nullable |
| email | string | Nullable; clinic contact email |
| website | string | Nullable |
| timezone | string | Default: "America/New_York" |
| settings | JSONB | Nullable; additional configurable settings |
| status | enum | ACTIVE, SUSPENDED |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (slug), Unique (npi) if not null

### ClinicMembership
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| clinicId | UUID | FK → Clinic |
| clinicianId | UUID | FK → Clinician |
| role | enum | OWNER, ADMIN, CLINICIAN, STAFF |
| status | enum | ACTIVE, INACTIVE |
| joinedAt | timestamp | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (clinicId, clinicianId)

### Invite
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| code | string(40) | Cryptographic random code (~10^48 keyspace) |
| clinicId | UUID | FK → Clinic |
| createdById | UUID | FK → Clinician |
| patientName | string | Expected patient name |
| patientDob | date | For identity verification |
| patientEmail | string | Nullable; for notification |
| status | enum | PENDING, CLAIMED, EXPIRED, REVOKED |
| expiresAt | timestamp | Default: 7 days |
| claimedById | UUID | Nullable; FK → Patient who claimed |
| claimedAt | timestamp | Nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (code), Index (status, expiresAt) for cleanup jobs

---

## 2. Clinical Data — Enrollment & Profiles

### Enrollment
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| clinicianId | UUID | FK → Clinician |
| clinicId | UUID | FK → Clinic (organization boundary) |
| status | enum | ACTIVE, PAUSED, DISCHARGED |
| isPrimary | boolean | Supports multi-clinician (default true) |
| enrolledVia | enum | INVITE, MIGRATION, ADMIN |
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
| patientId | UUID | FK → Patient (unique, 1:1) |
| sex | enum | MALE, FEMALE, OTHER, UNKNOWN |
| heightCm | decimal(5,1) | Height in centimeters |
| ckdStageSelfReported | enum | Patient-reported CKD stage |
| ckdStageClinician | enum | Clinician-verified CKD stage (authoritative) |
| ckdStageSetById | UUID | FK → Clinician who set clinician stage |
| ckdStageSetAt | timestamp | When clinician stage was set |
| primaryEtiology | enum | DIABETES, HYPERTENSION, GLOMERULONEPHRITIS, POLYCYSTIC, OBSTRUCTIVE, OTHER, UNKNOWN |
| dialysisStatus | enum | NONE, HEMODIALYSIS, PERITONEAL_DIALYSIS |
| dialysisStartDate | date | Nullable |
| transplantStatus | enum | NONE, PRIOR, CURRENT |
| transplantDate | date | Nullable |
| hasHeartFailure | boolean | |
| heartFailureClass | enum | NYHA CLASS_1, CLASS_2, CLASS_3, CLASS_4 |
| diabetesType | enum | NONE, TYPE_1, TYPE_2 |
| hasHypertension | boolean | |
| otherConditions | JSONB | string[] |
| onDiuretics | boolean | Medication flag |
| onAceArbInhibitor | boolean | Medication flag |
| onSglt2Inhibitor | boolean | Medication flag |
| onNsaids | boolean | Medication flag |
| onMra | boolean | Medication flag |
| onInsulin | boolean | Medication flag |
| medicationNotes | text | Clinician-only notes |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**CKD Stage Enum Values**: STAGE_1, STAGE_2, STAGE_3A, STAGE_3B, STAGE_4, STAGE_5, STAGE_5D, TRANSPLANT, UNKNOWN

**Design Note**: Dual CKD stage tracking (self-reported + clinician) enables safety comparison. Alerts use `ckdStageClinician ?? ckdStageSelfReported` for "effective" stage.

### CarePlan
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| enrollmentId | UUID | FK → Enrollment (unique, 1:1) |
| dryWeightKg | decimal(5,2) | Target dry weight in kg |
| targetBpSystolic | JSONB | `{ min: number, max: number }` |
| targetBpDiastolic | JSONB | `{ min: number, max: number }` |
| priorHfHospitalizations | integer | Heart failure history |
| fluidRetentionRisk | boolean | Flag for alert sensitivity |
| fallsRisk | boolean | Flag for mobility concerns |
| notes | text | Clinician notes |
| createdAt | timestamp | |
| updatedAt | timestamp | |

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
| actorName | string | Display name at time of change (denormalized) |
| changedFields | JSONB | `{ field: { old: value, new: value } }` |
| reason | text | Nullable; optional explanation |
| timestamp | timestamp | |

**Design Note**: Comprehensive audit trail for clinical data changes. Stores diff of changed fields for explainability.

---

## 3. Clinical Data — Observations

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
| type | enum | See MeasurementType below |
| value | decimal(10,2) | Numeric value in **canonical units** |
| unit | string | Always canonical: kg, mmHg, %, bpm, m/s |
| inputUnit | string | Nullable; original unit if conversion occurred (e.g., "lbs") |
| source | string | 'manual', 'withings', future vendors |
| externalId | string | Nullable; vendor's record ID for dedup |
| createdAt | timestamp | |

**MeasurementType Enum Values**:

| Type | Unit | Description | Patient Entry | Alerts |
|------|------|-------------|---------------|--------|
| WEIGHT | kg | Body weight | ✅ | ✅ |
| BP_SYSTOLIC | mmHg | Systolic blood pressure | ✅ | ✅ |
| BP_DIASTOLIC | mmHg | Diastolic blood pressure | ✅ | ✅ |
| SPO2 | % | Blood oxygen saturation | Backend only* | ✅ |
| HEART_RATE | bpm | Heart rate | Backend only* | ❌ |
| FAT_FREE_MASS | kg | Lean mass (Withings Body Pro 2) | ❌ Device only | ❌ Trend only |
| FAT_RATIO | % | Body fat percentage | ❌ Device only | ❌ Trend only |
| FAT_MASS | kg | Fat mass weight | ❌ Device only | ❌ Trend only |
| MUSCLE_MASS | kg | Muscle mass | ❌ Device only | ❌ Trend only |
| HYDRATION | kg | Body water | ❌ Device only | ❌ Trend only |
| BONE_MASS | kg | Bone mass | ❌ Device only | ❌ Trend only |
| PULSE_WAVE_VELOCITY | m/s | Vascular age indicator | ❌ Device only | ❌ Trend only |

*SpO2 and Heart Rate: Backend supports manual entry; patient app UI deferred.

**Constraints**:
- `@@unique([source, externalId])` — Prevents device duplicate imports
- `@@index([patientId, type, timestamp])` — Time-series queries

---

## 4. Clinical Data — Labs

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

**Verification Workflow**:
- **Who can verify**: Any authenticated clinician enrolled with the patient's clinic
- **What verification means**: "Reviewed and confirmed as accurately transcribed from the source document/lab report" — NOT clinical interpretation, NOT endorsement of treatment decisions
- **Automation when verified**: None in MVP (no auto-alerts, no auto-messages)

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

**LabResultFlag Enum Values**: H (High), L (Low), C (Critical)

### Document
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| type | enum | LAB_RESULT, OTHER |
| filename | string | Original filename |
| mimeType | string | e.g., "application/pdf", "image/jpeg" |
| sizeBytes | int | File size |
| storageKey | string | Unique; path in storage |
| title | string | Nullable; patient-provided title |
| notes | string | Nullable; patient-provided notes |
| documentDate | timestamp | Nullable; date on the document |
| uploadedAt | timestamp | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

## 5. Clinical Data — Medications

### Medication
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| name | string | Medication name |
| dosage | string | Nullable; e.g., "10mg" |
| frequency | string | Nullable; e.g., "twice daily" |
| instructions | string | Nullable; additional instructions |
| startDate | timestamp | Nullable |
| endDate | timestamp | Nullable |
| isActive | boolean | Default: true |
| discontinuedAt | timestamp | Nullable; when medication was stopped |
| discontinuedBy | UUID | Nullable; FK → Clinician who discontinued |
| discontinuedReason | string | Nullable; free-text reason for discontinuation |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Status Logic**:
- Active: `isActive = true` AND `endDate IS NULL OR endDate > now()`
- Discontinued: `isActive = false` OR `discontinuedAt IS NOT NULL`

**Discontinuation Note**: Reason tracking is free-text for minimal auditability. Structured reason codes deferred.

### MedicationLog
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| medicationId | UUID | FK → Medication |
| loggedAt | timestamp | When logged |
| scheduledFor | timestamp | Nullable; scheduled dose time |
| taken | boolean | Whether dose was taken |
| notes | string | Nullable; patient notes |
| createdAt | timestamp | |

---

## 6. Alerts

### Alert
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| triggeredAt | timestamp | When rule fired |
| ruleId | string | Identifier (e.g., 'weight_gain_48h') |
| ruleName | string | Human-readable name |
| severity | enum | INFO, WARNING, CRITICAL |
| status | enum | OPEN, ACKNOWLEDGED, DISMISSED |
| inputs | JSONB | Data that triggered alert (explainability) |
| summaryText | text | Nullable; LLM-generated explanation |
| acknowledgedBy | UUID | Nullable; FK → Clinician |
| acknowledgedAt | timestamp | Nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Alert Rules (MVP) — Fixed Clinical Defaults**:
| Rule ID | Condition | Severity |
|---------|-----------|----------|
| weight_gain_48h | >2 kg gain in 48h | CRITICAL/WARNING (based on delta) |
| bp_systolic_high | Systolic ≥180 mmHg | CRITICAL/WARNING (based on value) |
| bp_systolic_low | Systolic ≤90 mmHg | CRITICAL/WARNING (based on value) |
| spo2_low | SpO2 ≤92% | CRITICAL/WARNING (based on value) |

**Severity Enum Values**: INFO, WARNING, CRITICAL

**Deduplication**: Alerts deduplicated by `patientId + ruleId + date`. Subsequent triggers update existing OPEN alert rather than creating duplicates.

**Future Enhancement**: Per-clinic configurable thresholds (preferred), then per-patient overrides.

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
  "thresholdKg": 2.0,
  "windowHours": 48
}
```

---

## 7. RPM/CCM Audit Trail

### InteractionLog
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| clinicianId | UUID | Nullable; FK → Clinician (null for patient actions) |
| timestamp | timestamp | When interaction occurred |
| interactionType | enum | See below |
| durationSeconds | integer | Nullable; for timed reviews (MVP+) |
| metadata | JSONB | Additional context |
| createdAt | timestamp | |

**InteractionType Values**:
- `PATIENT_CHECKIN` — Patient submitted symptom checkin
- `PATIENT_MEASUREMENT` — Patient submitted measurement
- `PATIENT_MEDICATION` — Patient created/updated medication
- `PATIENT_ADHERENCE_LOG` — Patient logged medication adherence
- `PATIENT_DOCUMENT` — Patient uploaded document
- `PATIENT_LAB_REPORT` — Patient created lab report
- `CLINICIAN_VIEW` — Clinician viewed patient data
- `CLINICIAN_ALERT_ACK` — Clinician acknowledged alert
- `CLINICIAN_NOTE` — Clinician added note
- `CLINICIAN_CALL` — Phone call logged (future)
- `CLINICIAN_MESSAGE` — Message sent (future)
- `CLINICIAN_MEDICATION_VIEW` — Clinician viewed medications
- `CLINICIAN_DOCUMENT_VIEW` — Clinician viewed document
- `CLINICIAN_LAB_VIEW` — Clinician viewed lab
- `CLINICIAN_LAB_VERIFY` — Clinician verified lab
- `CLINICIAN_LAB_CREATE` — Clinician created lab for patient

**MVP vs MVP+ Scope**:
- **MVP**: Interaction logs exist for audit trail (timestamp, type)
- **MVP+**: Time tracking (durationSeconds), billing report generation, CPT code mapping

### ClinicianNote
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| clinicianId | UUID | FK → Clinician |
| alertId | UUID | Nullable; FK → Alert (attach note to alert) |
| content | text | Note body |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### AuditLog
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| action | string | e.g., 'invite.created', 'enrollment.created' |
| actorType | string | 'clinician', 'patient', 'system' |
| actorId | string | Nullable; ID of actor |
| resourceType | string | 'invite', 'enrollment', 'clinic', etc. |
| resourceId | string | ID of affected resource |
| metadata | JSONB | Additional context |
| ipAddress | string | Nullable; for security auditing |
| userAgent | string | Nullable; for security auditing |
| createdAt | timestamp | |

---

## 8. Device Integrations

### DeviceConnection
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| vendor | enum | WITHINGS (future: FITBIT, APPLE_HEALTH) |
| accessToken | string | Encrypted (AES-256-GCM) |
| refreshToken | string | Encrypted (AES-256-GCM) |
| tokenExpiresAt | timestamp | When access token expires |
| scope | string | Nullable; OAuth scopes granted |
| withingsUserId | string | Nullable; vendor user ID for API calls |
| status | enum | ACTIVE, EXPIRED, REVOKED, ERROR |
| lastSyncAt | timestamp | Nullable; last successful sync |
| lastSyncError | string | Nullable; error message from last sync |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**DeviceConnectionStatus Values**:
- ACTIVE — Connection working, tokens valid
- EXPIRED — Access token expired, needs re-auth
- REVOKED — User disconnected device
- ERROR — Persistent sync errors

**Design Notes**:
- OAuth tokens encrypted at rest using AES-256-GCM
- Token refresh happens automatically before expiry (5-minute buffer)
- Background job syncs every 15 minutes for active connections
- Synced measurements stored with `source = 'withings'` and `externalId` for dedup

---

## Entity Relationships

```
Clinic ──────┬───── many ClinicMemberships ───── Clinician
             ├───── many Enrollments
             └───── many Invites

Clinician ───┬───── many ClinicMemberships ───── Clinic
             ├───── many Invites (created)
             ├───── many InteractionLogs
             ├───── many ClinicianNotes
             ├───── many LabReports (verified)
             └───── many Alerts (acknowledged)

Patient ─────┬───── one PatientProfile
             ├───── many SymptomCheckins
             ├───── many Measurements
             ├───── many Alerts
             ├───── many InteractionLogs
             ├───── many ClinicianNotes
             ├───── many PatientProfileAudits
             ├───── many Medications
             ├───── many Documents
             ├───── many LabReports
             ├───── many Enrollments ───── Clinician + Clinic
             ├───── many Invites (claimed)
             └───── many DeviceConnections

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

Medication ─── many MedicationLogs
```

---

## Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| Clinic | (slug) | Lookup by URL-safe identifier |
| Clinic | (status) | Filter active clinics |
| ClinicMembership | (clinicId, clinicianId) | Membership lookup |
| ClinicMembership | (clinicianId, status) | Clinician's active clinics |
| Invite | (code) | Invite claim lookup |
| Invite | (status, expiresAt) | Cleanup job for expired invites |
| Invite | (clinicId, status) | Pending invites for clinic |
| Enrollment | (clinicianId, clinicId, status) | List active patients |
| Enrollment | (patientId, clinicId) | Patient's enrollments per clinic |
| Measurement | (patientId, type, timestamp) | Time-series queries |
| Measurement | (patientId, type, source, timestamp) | Manual dedup window |
| SymptomCheckin | (patientId, timestamp) | Timeline queries |
| Alert | (patientId, status, triggeredAt) | Alert inbox |
| InteractionLog | (patientId, timestamp) | RPM/CCM summaries |
| InteractionLog | (clinicianId, timestamp) | Clinician activity |
| PatientProfile | (patientId) | 1:1 with Patient |
| CarePlan | (enrollmentId) | 1:1 with Enrollment |
| PatientProfileAudit | (patientId, timestamp) | Profile history |
| Medication | (patientId, isActive) | Active medications |
| MedicationLog | (medicationId, loggedAt) | Adherence history |
| Document | (patientId, uploadedAt) | Document timeline |
| Document | (patientId, type) | Filter by type |
| LabReport | (patientId, collectedAt) | Lab timeline |
| DeviceConnection | (status, lastSyncAt) | Sync job queries |

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
| Clinic as organization boundary | Multi-tenant isolation; HIPAA compliance |
| Invite code (40 chars) | ~10^48 combinations; unguessable |
| DOB verification on claim | Identity verification without global search |
| PatientProfile separate from Patient | Clinical data evolves separately; better audit |
| CarePlan per-enrollment | Multi-clinic patients get different targets |
| Dual CKD stage tracking | Safety: clinician can verify self-reported |
| BP targets as min/max range | Supports personalized targets per KDIGO |
| PatientProfileAudit with changedFields | Explainability: see exactly what changed |
| Medication discontinuation tracking | Audit trail for medication changes |
| Lab verification workflow | Confirms transcription accuracy (not clinical) |

---

## Deferred (No Schema Yet)

- Billing/claims entities (CPT codes, claim status) — MVP+
- Risk scores (derived at query time initially)
- Caregiver accounts
- Educational content catalog
- LLM prompt/response audit logs
- Message threads (clinician-patient messaging)
- Notification preferences (email settings) — MVP+
- Notification logs (rate limiting) — MVP+
