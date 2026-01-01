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

### Enrollment
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK → Patient |
| clinicianId | UUID | FK → Clinician |
| status | enum | active, paused, discharged |
| isPrimary | boolean | Supports multi-clinician (default true) |
| enrolledAt | timestamp | When relationship started |
| dischargedAt | timestamp | Nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraints**: Unique (patientId, clinicianId)

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
| value | decimal | Numeric value |
| unit | string | lbs, kg, mmHg, %, bpm |
| source | string | 'manual', 'withings', future vendors |
| externalId | string | Nullable; vendor's record ID for dedup |
| createdAt | timestamp | |

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

**inputs JSONB structure** (example):
```json
{
  "measurements": [
    { "id": "uuid1", "value": 185, "timestamp": "..." },
    { "id": "uuid2", "value": 190, "timestamp": "..." }
  ],
  "delta": 5,
  "threshold": 3,
  "windowHours": 48
}
```

### Note
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| enrollmentId | UUID | FK → Enrollment |
| authorId | UUID | FK → Clinician |
| content | text | Note body |
| linkedAlertId | UUID | Nullable; FK → Alert |
| createdAt | timestamp | |

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
Patient ─────┬───── many SymptomCheckins
             ├───── many Measurements
             ├───── many Alerts
             ├───── many InteractionLogs
             └───── many Enrollments ───── Clinician
                           │
                           └───── many Notes

Alert ─────── optional Note (via linkedAlertId)
Clinician ─── many InteractionLogs
```

---

## Indexes (MVP)

| Table | Index | Purpose |
|-------|-------|---------|
| Enrollment | (clinicianId, status) | List active patients for clinician |
| Measurement | (patientId, type, timestamp) | Time-series queries |
| SymptomCheckin | (patientId, timestamp) | Timeline queries |
| Alert | (patientId, status, triggeredAt) | Alert inbox |
| InteractionLog | (patientId, timestamp) | RPM/CCM monthly summaries |
| InteractionLog | (clinicianId, timestamp) | Clinician activity reports |

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

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| JSONB for symptoms | Schema evolution without migrations |
| JSONB for alert inputs | Explainability; store what triggered |
| InteractionLog separate from actions | Clean audit trail; supports billing queries |
| source + externalId on Measurement | Device integration without breaking changes |
| isPrimary on Enrollment | Multi-clinician support without restructure |
| preferences JSONB on Patient | Avoids migrations for settings changes |
