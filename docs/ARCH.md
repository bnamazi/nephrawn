# Nephrawn — Reference Architecture

## System Boundaries

```
┌─────────────────┐     ┌─────────────────┐
│  Patient App    │     │  Clinician App  │
│  (Flutter)      │     │  (React/Next)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   API       │
              │  (Node/TS)  │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Postgres   │
              └─────────────┘
```

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Patient App | Flutter | iOS + Android; data entry focused |
| Clinician App | React / Next.js | Web only; review and decision support |
| API | Node.js + TypeScript | REST, versioned endpoints |
| ORM | Prisma | Type-safe, migration management |
| Database | PostgreSQL | Source of truth; JSONB for flexible fields |
| Auth | JWT | Role-based; enforced at API middleware |

---

## Component Responsibilities

### API Layer (MVP)
- Authentication & session management
- Patient/Clinician/Enrollment CRUD
- Patient clinical profile (demographics, CKD stage, comorbidities, medications)
- Care plan per enrollment (dry weight, BP targets, risk flags)
- Profile/care plan audit trail
- SymptomCheckin and Measurement ingestion
- Alert generation (rule engine)
- Clinician Notes
- Interaction logging (RPM/CCM)
- Time-series query endpoints

### Billing & Reporting Module (MVP)
- Time entry CRUD (clinician-entered billable time)
- Device transmission day calculation
- Billing period aggregation (monthly summaries)
- Eligibility indicator computation (CPT code thresholds)
- Billing report endpoints (per-patient, per-clinic)

### Notification Module (MVP)
- Email dispatch for critical/warning alerts
- Clinician notification preferences
- Rate limiting (prevent alert fatigue)
- Alert escalation for unacknowledged alerts

### Background Jobs (MVP)
- Withings device sync (every 15 minutes) — IMPLEMENTED
- Invite expiration cleanup (daily) — IMPLEMENTED
- Alert escalation check (every 30 minutes) — TO BE IMPLEMENTED
- Email notification dispatch (on alert creation) — TO BE IMPLEMENTED

---

## Current API Surface

### Authentication (`/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/patient/register` | Register new patient |
| POST | `/auth/patient/login` | Patient login → JWT |
| POST | `/auth/clinician/login` | Clinician login → JWT |
| GET | `/auth/invite/:code` | Validate invite code (public) |
| POST | `/auth/invite/:code/claim` | Claim invite with DOB verification |

### Patient Routes (`/patient`) — requires patient role
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patient/me` | Get own profile |
| GET | `/patient/profile` | Get clinical profile + completeness |
| PUT | `/patient/profile` | Update clinical profile (patient-editable fields) |
| GET | `/patient/profile/history` | Get profile change history |
| GET | `/patient/clinics` | List enrolled clinics |
| POST | `/patient/clinics/:clinicId/leave` | Self-discharge from clinic |
| POST | `/patient/checkins` | Submit symptom check-in |
| GET | `/patient/checkins` | List own check-ins |
| POST | `/patient/measurements` | Submit single measurement |
| POST | `/patient/measurements/blood-pressure` | Submit BP pair (systolic + diastolic) |
| GET | `/patient/measurements` | List own measurements |
| GET | `/patient/alerts` | List own alerts |
| GET | `/patient/dashboard` | Dashboard overview (all summaries) |
| GET | `/patient/charts/:type` | Time-series data for charting |
| GET | `/patient/summary/:type` | Measurement summary with trend |
| GET | `/patient/body-composition` | All body composition measurements |
| GET | `/patient/medications` | List own medications |
| POST | `/patient/medications` | Create medication |
| GET | `/patient/medications/:id` | Get single medication |
| PUT | `/patient/medications/:id` | Update medication |
| DELETE | `/patient/medications/:id` | Soft delete medication |
| POST | `/patient/medications/:id/log` | Log adherence (taken/skipped) |
| GET | `/patient/medications/:id/logs` | Get adherence history |
| GET | `/patient/medications/summary` | Adherence summary |
| GET | `/patient/labs` | List own lab reports |
| POST | `/patient/labs` | Create lab report with results |
| GET | `/patient/labs/:id` | Get single lab report |
| PUT | `/patient/labs/:id` | Update lab report |
| DELETE | `/patient/labs/:id` | Delete lab report |
| POST | `/patient/labs/:id/results` | Add result to report |
| PUT | `/patient/labs/:id/results/:resultId` | Update result |
| DELETE | `/patient/labs/:id/results/:resultId` | Delete result |

### Clinician Routes (`/clinician`) — requires clinician/admin role
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinician/me` | Get own profile |
| GET | `/clinician/patients` | List enrolled patients |
| GET | `/clinician/patients/:patientId` | Get patient details |
| GET | `/clinician/patients/:patientId/checkins` | Patient's check-ins |
| GET | `/clinician/patients/:patientId/measurements` | Patient's measurements |
| GET | `/clinician/patients/:patientId/dashboard` | Patient dashboard overview |
| GET | `/clinician/patients/:patientId/charts/:type` | Patient time-series data |
| GET | `/clinician/patients/:patientId/summary/:type` | Patient measurement summary |
| GET | `/clinician/patients/:patientId/profile` | Patient clinical profile + care plan |
| PUT | `/clinician/patients/:patientId/profile` | Update patient profile (clinician fields) |
| GET | `/clinician/patients/:patientId/care-plan` | Get care plan + completeness |
| PUT | `/clinician/patients/:patientId/care-plan` | Update care plan (targets, risk flags) |
| GET | `/clinician/patients/:patientId/profile/history` | Profile change audit trail |
| GET | `/clinician/patients/:patientId/notes` | Patient's notes |
| POST | `/clinician/patients/:patientId/notes` | Create note for patient |
| GET | `/clinician/patients/:patientId/medications` | Patient's medications |
| GET | `/clinician/patients/:patientId/medications/summary` | Patient's adherence summary |
| GET | `/clinician/patients/:patientId/labs` | Patient's lab reports |
| POST | `/clinician/patients/:patientId/labs` | Create lab for patient |
| GET | `/clinician/patients/:patientId/labs/:id` | Get lab report |
| PUT | `/clinician/patients/:patientId/labs/:id` | Update lab report |
| POST | `/clinician/patients/:patientId/labs/:id/verify` | Verify lab report |
| POST | `/clinician/patients/:patientId/labs/:id/results` | Add result |
| PUT | `/clinician/patients/:patientId/labs/:id/results/:resultId` | Update result |
| DELETE | `/clinician/patients/:patientId/labs/:id/results/:resultId` | Delete result |
| GET | `/clinician/patients/:patientId/devices` | Patient device connections |
| GET | `/clinician/alerts` | All alerts for enrolled patients |
| GET | `/clinician/alerts/:alertId` | Single alert details |
| POST | `/clinician/alerts/:alertId/acknowledge` | Acknowledge alert |
| POST | `/clinician/alerts/:alertId/dismiss` | Dismiss alert |
| GET | `/clinician/alerts/:alertId/notes` | Notes attached to alert |
| GET | `/clinician/notes/:noteId` | Get single note |
| PUT | `/clinician/notes/:noteId` | Update note (author only) |
| DELETE | `/clinician/notes/:noteId` | Delete note (author only) |
| GET | `/clinician/enrollments` | List all enrollments (across clinics) |
| GET | `/clinician/audit-logs` | List audit logs (Owner/Admin) |

### Clinic & Enrollment Routes (`/clinician/clinic`) — requires clinician role
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinician/clinics` | List clinician's clinic memberships |
| GET | `/clinician/clinic/:clinicId` | Get clinic details (Owner/Admin) |
| PUT | `/clinician/clinic/:clinicId` | Update clinic info (Owner/Admin) |
| GET | `/clinician/clinic/:clinicId/members` | List clinic members (Owner/Admin) |
| POST | `/clinician/clinic/:clinicId/members` | Add clinician to clinic (Owner/Admin) |
| PUT | `/clinician/clinic/:clinicId/members/:clinicianId/role` | Update member role (Owner/Admin) |
| DELETE | `/clinician/clinic/:clinicId/members/:clinicianId` | Remove member from clinic (Owner/Admin) |
| GET | `/clinician/clinic/:clinicId/invites` | List pending invites for clinic |
| POST | `/clinician/clinic/:clinicId/invites` | Create new patient invite |
| DELETE | `/clinician/clinic/:clinicId/invites/:inviteId` | Revoke pending invite |
| GET | `/clinician/clinic/:clinicId/enrollments` | List active enrollments |
| DELETE | `/clinician/clinic/:clinicId/enrollments/:enrollmentId` | Discharge patient |

### Billing Routes (`/clinician`) — requires clinician role
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/clinician/patients/:patientId/time-entries` | Log billable time |
| GET | `/clinician/patients/:patientId/time-entries` | List time entries (with date filter) |
| PUT | `/clinician/time-entries/:id` | Update time entry (author only) |
| DELETE | `/clinician/time-entries/:id` | Delete time entry (author only) |
| GET | `/clinician/patients/:patientId/billing-summary` | Monthly summary for patient |
| GET | `/clinician/clinic/:clinicId/billing-report` | Clinic-wide monthly report |
| GET | `/clinician/clinic/:clinicId/billing-report/export` | Export as CSV |

### Notification Routes (`/clinician`) — requires clinician role
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinician/notifications/preferences` | Get own notification preferences |
| PUT | `/clinician/notifications/preferences` | Update notification preferences |

### Patient App (MVP)
- Login / session management
- Clinical profile self-entry (CKD stage self-reported, comorbidities, medications)
- Symptom check-in form
- Measurement entry (weight, BP)
- Medication tracking (CRUD, adherence logging, summary)
- Lab results entry (structured analyte data with reference ranges)
- View own history (read-only)
- View enrolled clinics, self-discharge

### Clinician App (MVP)
- Login / session management
- Clinic switcher (multi-clinic support)
- Clinic settings (Owner/Admin only): member management, role changes
- Patient list (enrolled patients)
- Patient detail with tabs: Overview, Measurements, Symptoms, Labs, Medications, Documents, Profile, Care Plan, Notes
- Patient clinical profile (CKD stage, comorbidities, medications)
- Patient medication list with adherence summary
- Patient lab results with verification workflow
- Care plan management (dry weight, BP targets, risk flags)
- Profile completeness banners (showTargetsBanner, showProfileBanner)
- Symptom check-in history with severity badges
- Alert inbox
- Acknowledge alerts, add notes
- Time-series charts

---

## Prototype Extension Points (Option B Features)

These features are in active development as part of prototype scope.

### 1. Device Integration (Withings) — IMPLEMENTED

**Schema additions:**
- `DeviceConnection` — OAuth tokens (encrypted) and sync state per patient/vendor
- `MeasurementType` enum extended with body composition types (FAT_FREE_MASS, FAT_RATIO, FAT_MASS, MUSCLE_MASS, HYDRATION, BONE_MASS, PULSE_WAVE_VELOCITY)
- `Measurement.source` — Uses `'withings'` value for device-synced data

**Services:**
- `DeviceService` — OAuth flow, token refresh, connection management, sync orchestration
- `WithingsAdapter` — Interface with mock and real implementations (factory pattern)
- Mock adapter enabled when `WITHINGS_MOCK=true` or credentials missing

**APIs:**
- `GET /patient/devices` — List connected devices
- `GET /patient/devices/withings` — Get Withings connection details
- `POST /patient/devices/withings/authorize` — Initiate OAuth (returns auth URL)
- `GET /patient/devices/withings/callback` — OAuth callback (exchanges code for tokens)
- `DELETE /patient/devices/withings` — Disconnect device
- `POST /patient/devices/withings/sync` — Manual sync trigger

**Background jobs:**
- `syncWithingsDevices` — Every 15 minutes, syncs all active connections

**Supported devices:**
- Withings BPM Pro2 — Blood pressure (systolic, diastolic, heart rate)
- Withings Body Pro 2 — Weight + full body composition (fat %, muscle mass, bone mass, hydration, pulse wave velocity)

**Flutter:**
- `DevicesScreen` — Manage device connections
- `DevicesProvider` — State management for device operations
- In-app browser OAuth flow using `url_launcher`

### 2. Lab Result Uploads

**Schema additions:**
- `Document` — Metadata for uploaded files (patientId, type, uploadedAt, storageKey)
- `DocumentType` enum — LAB_RESULT, OTHER

**Services:**
- `DocumentService` — Upload URL generation, metadata management
- Storage adapter — S3-compatible blob storage (local filesystem for dev)

**APIs:**
- `POST /patient/documents/upload-url` — Get signed upload URL
- `POST /patient/documents` — Confirm upload, create metadata
- `GET /patient/documents` — List own documents
- `GET /clinician/patients/:patientId/documents` — List patient documents
- `GET /documents/:documentId/download-url` — Get signed download URL

### 3. Email Notifications — ⚠️ NOT IMPLEMENTED

**Status**: Deferred to MVP+. This section describes the planned design.

**Schema additions (planned):**
- `NotificationPreference` — Per-clinician email settings
- `NotificationLog` — Sent notification history (for rate limiting)

**Services (planned):**
- `NotificationService` — Alert-to-notification mapping, preference checking
- `EmailAdapter` — Email sending (Resend, SendGrid, or SMTP)

**APIs (planned):**
- `GET /clinician/notifications/preferences` — Get notification settings
- `PUT /clinician/notifications/preferences` — Update notification settings

**Triggers (planned):**
- Alert creation → NotificationService.notifyIfConfigured()

**Future Extension Point**: Background worker/job pattern with pluggable email provider adapter.

### 4. Medication Tracking

**Schema additions:**
- `Medication` — Patient medications (name, dosage, frequency, startDate, endDate)
- `MedicationLog` — Adherence confirmations (medicationId, takenAt, skipped, notes)

**Services:**
- `MedicationService` — CRUD operations, adherence tracking

**APIs:**
- `GET /patient/medications` — List own medications
- `POST /patient/medications` — Add medication
- `PUT /patient/medications/:id` — Update medication
- `DELETE /patient/medications/:id` — Remove medication
- `POST /patient/medications/:id/log` — Log adherence
- `GET /patient/medications/:id/logs` — Adherence history
- `GET /clinician/patients/:patientId/medications` — View patient medications

### 5. Structured Lab Results (Slice 2.5)

**Schema additions:**
- `LabReport` — Lab report metadata (patientId, collectedAt, labName, source, verification)
- `LabResult` — Individual analyte results (analyteName, value, unit, referenceRange, flag)
- `LabSource` enum — MANUAL_PATIENT, MANUAL_CLINICIAN, IMPORTED
- `LabResultFlag` enum — H (High), L (Low), C (Critical)

**Services:**
- `LabService` — CRUD for lab reports and results, verification workflow

**APIs:**
- `GET /patient/labs` — List own lab reports
- `POST /patient/labs` — Create lab report with results
- `PUT /patient/labs/:id` — Update lab report
- `DELETE /patient/labs/:id` — Delete lab report
- `POST /patient/labs/:id/results` — Add result to report
- `GET /clinician/patients/:patientId/labs` — View patient labs
- `POST /clinician/patients/:patientId/labs` — Create lab for patient
- `POST /clinician/patients/:patientId/labs/:id/verify` — Verify lab report

**Extension points:**
- `documentId` — Optional link to source PDF for future OCR parsing
- `analyteCode` — LOINC code support for future lab provider API integration
- `source = IMPORTED` — Reserved for future automated imports

---

## Security Hardening Checklist

The following items are **required before production deployment**:

| Item | Status | Action |
|------|--------|--------|
| JWT secret | ⚠️ Has fallback | Remove fallback; require ENV |
| Rate limiting | ✅ Implemented | Verify on auth endpoints |
| Token persistence (web) | ⚠️ In-memory | Implement httpOnly cookie or localStorage |
| Input validation | ✅ Implemented | Verify bounds on measurements |
| Structured logging | ✅ Implemented | Verify no PHI in logs |
| CORS | ⚠️ Hardcoded | Environment-based configuration |
| Error handling | ✅ Implemented | Verify 4xx vs 5xx differentiation |

See HARDENING_PLAN.md for detailed remediation steps.

---

## Future Extension Points (Post-Prototype)

| Capability | Integration Pattern | Notes |
|------------|---------------------|-------|
| Lab OCR/Parsing | Background job → structured data | Manual correction UI |
| LLM Summaries | Async job → cache result on entity | No real-time generation in UI path |
| Prioritization | Background scoring → sort order field | Must be explainable |
| Push Notifications | FCM/APNs adapter | Medication reminders |
| Additional Devices | Adapter pattern | Fitbit, Apple Health |

---

## Alert Rule Engine

### Current Rules (MVP) — Fixed Clinical Defaults
| Rule ID | Trigger Condition | Severity | Hard-coded |
|---------|-------------------|----------|------------|
| `weight_gain_48h` | >2 kg gain within 48 hours | CRITICAL/WARNING | Yes |
| `bp_systolic_high` | Systolic ≥180 mmHg | CRITICAL/WARNING | Yes |
| `bp_systolic_low` | Systolic ≤90 mmHg | CRITICAL/WARNING | Yes |
| `spo2_low` | SpO2 ≤92% | CRITICAL/WARNING | Yes |

**Severity Enum**: INFO, WARNING, CRITICAL (rules use dynamic severity based on threshold exceeded)

### Deduplication
- Alerts deduplicated by `patientId + alertType + date` (one per day per type)
- Subsequent triggers on same day do not create new alerts

### Body Composition
- Fat ratio, muscle mass, and other body composition metrics are captured and trended
- **No alert rules** for body composition in MVP (trend-only)
- Future: Alerting thresholds may be introduced after clinician validation, likely focusing on fluid-related proxies

### Future Enhancement: Configurable Thresholds
1. **Per-clinic defaults** (preferred next step): One set of thresholds per clinic/program
2. **Per-patient overrides** (later): Only for edge cases requiring patient-specific thresholds

---

## Data Flow Patterns

### Observation Ingestion (MVP)
1. Patient submits SymptomCheckin or Measurement via API
2. API validates, persists to Postgres
3. Rule engine evaluates thresholds → creates Alert if triggered
4. Interaction logged automatically
5. Clinician queries patient timeline

### Clinician Review (MVP)
1. Clinician views patient list
2. Selects patient → sees timeline of checkins, measurements, alerts
3. Acknowledges alert → Interaction logged
4. Adds note → Interaction logged
5. All interactions timestamped for RPM/CCM

### Patient Enrollment (MVP)
1. Clinician creates invite with patient name + DOB + optional email
2. System generates 40-char cryptographic code
3. Clinician shares code with patient (verbally, print, or email)
4. Patient enters code in app → shown clinic name (masked DOB prompt)
5. Patient enters DOB for verification
6. On match: Patient account created/linked, Enrollment created
7. Clinician sees patient in enrolled list

### Document Upload (MVP+)
1. Patient uploads file via signed URL
2. API creates Document entity (metadata only)
3. Clinician views document inline
4. (Later) Background job extracts structured data

### Device Sync (MVP+)
1. Patient authorizes Withings via OAuth
2. Background job polls vendor API
3. Normalized Measurement entities created with `source = 'withings'`
4. Same rule engine evaluates data

---

## Time-Series API Guarantees

The `/charts/:type` and `/summary/:type` endpoints provide frontend-ready data with predictable behavior:

### Response Structure
All time-series responses include:
- `type` — Measurement type (WEIGHT, BP_SYSTOLIC, etc.)
- `unit` — Canonical storage unit
- `displayUnit` — Unit for display (may differ from storage)
- `range.from` / `range.to` — Actual query range
- `meta.timezone` — Timezone used for bucketing (default: UTC)

### Guardrails
| Parameter | Default | Maximum | Notes |
|-----------|---------|---------|-------|
| limit | 200 | 2000 | Points per query |
| from | 30 days ago | — | Default lookback |
| to | now | — | Upper bound |
| aggregate range | 90 days | 365 days | Daily aggregates capped |

### Trend Calculation
Summary endpoints compute trend using clinical thresholds:
- Requires **4+ data points** AND **24+ hour time span**
- Compares recent half vs older half averages
- Uses clinically significant thresholds (not arbitrary percentages):
  - Weight: 1 kg
  - BP: 10 mmHg (systolic), 5 mmHg (diastolic)
  - SpO2: 2%
  - Heart Rate: 10 bpm
- Returns `insufficient_data` if criteria not met

### Blood Pressure Pairing
BP is stored as separate systolic/diastolic measurements:
- Paired within 60-second window
- Response includes `meta.unpairedSystolicCount` and `meta.unpairedDiastolicCount`
- Frontend receives ready-to-chart `{timestamp, systolic, diastolic}` points

---

## Extension Contracts (Define Now, Implement Later)

### Device Adapter Interface
```
authorize(patientId, vendorCode) → OAuth redirect URL
sync(patientId, vendorCode, since) → Measurement[]
disconnect(patientId, vendorCode) → void
```

### LLM Summary Interface
```
Input: entityType (alert|measurement_series|lab_result) + entityId
Output: { markdown: string, confidence: number, citations: string[] }
Constraint: Must be cacheable; never blocks UI render
```

---

## Billing & Reporting Architecture

### Time Tracking Model

Time is tracked in two complementary ways:

1. **Explicit time entries** (TimeEntry table): Clinician manually logs billable time with activity type, duration, and notes. Editable. Used for billing calculations.

2. **Implicit interaction logging** (InteractionLog.durationSeconds): System records duration when available (e.g., time spent on patient detail page). Read-only audit trail. Not used for billing.

### Device Day Calculation

Device transmission days are calculated as:
```sql
SELECT COUNT(DISTINCT DATE(timestamp))
FROM measurements
WHERE patientId = :patientId
  AND source != 'manual'
  AND timestamp >= :periodStart
  AND timestamp < :periodEnd
```

This count is computed on-demand (not cached) to ensure accuracy. Caching may be added in Phase 2 if performance requires it.

### Monthly Summary Structure

```json
{
  "patientId": "uuid",
  "clinicId": "uuid",
  "period": { "start": "2026-01-01", "end": "2026-01-31" },
  "deviceDays": 18,
  "manualDays": 5,
  "totalMeasurements": 42,
  "clinicalMinutes": 35,
  "timeEntries": [
    { "date": "2026-01-05", "minutes": 15, "activity": "PATIENT_REVIEW" },
    { "date": "2026-01-12", "minutes": 20, "activity": "CARE_PLAN_UPDATE" }
  ],
  "eligibility": {
    "99454": { "eligible": true, "deviceDays": 18, "threshold": 16 },
    "99457": { "eligible": true, "minutes": 35, "threshold": 20 },
    "99458": { "eligible": false, "additionalBlocks": 0, "threshold": 20 }
  }
}
```

---

## Notification Architecture

### Email Dispatch Flow

1. Alert created → AlertService.create()
2. After commit → NotificationService.notifyOnAlert(alert)
3. Check clinician preferences → shouldNotify(clinicianId, severity)
4. If yes → EmailService.sendAlertEmail(clinicianId, alert)
5. Log to NotificationLog table

### Rate Limiting

- Maximum 1 email per patient per hour per clinician
- Check: `SELECT COUNT(*) FROM notification_logs WHERE clinicianId = X AND patientId = Y AND sentAt > NOW() - INTERVAL '1 hour'`

### Escalation Flow

1. Background job runs every 30 minutes
2. Query: `SELECT * FROM alerts WHERE status = 'OPEN' AND triggeredAt < NOW() - INTERVAL '4 hours' AND escalationLevel = 0`
3. For each: increment escalationLevel, update escalatedAt, trigger notification

### Preference Model

```json
{
  "emailEnabled": true,
  "emailOnCritical": true,
  "emailOnWarning": true,
  "emailOnInfo": false
}
```

---

## RPM/CCM Architectural Considerations

### MVP Scope (Audit Trail + Billing)
- All clinician actions log `interactionType` and timestamp
- Patient data submissions create implicit Interaction records
- Device data retains original source timestamp
- Clinician "review" and "acknowledge" actions create auditable events
- Interaction table provides audit trail for RPM/CCM evidence
- **TimeEntry table for explicit billable time logging**
- **Monthly billing summary endpoints for eligibility verification**

---

## Security Model

### Authentication
- JWT tokens with role claim (patient | clinician | admin)
- Short-lived access tokens; refresh token rotation
- Tokens never stored in localStorage (httpOnly cookies for web)
- Invite codes: 40-character cryptographic random strings (~10^48 keyspace)

### Authorization
- Enforced at API middleware, not UI
- Patients can only access own data
- Clinicians can only access enrolled patients **within their clinic(s)**
- Clinic boundary: clinicians only see patients enrolled in clinics they belong to
- Admin role for user management (MVP+)

### Enrollment Security
- **Clinic-initiated invites**: Clinician creates invite with patient name + DOB
- **DOB verification**: Patient must provide matching DOB to claim invite
- **No global search**: Patients cannot search for clinics/clinicians; must have invite code
- **Invite expiration**: Default 7 days; configurable per invite
- **Rate limiting**: 50 invites/day per clinician; 5 claim attempts/hour per IP

### Threat Mitigations
| Threat | Mitigation |
|--------|------------|
| Invite code enumeration | 40-char random codes; rate limiting |
| Patient impersonation | DOB verification; IP rate limiting |
| Unauthorized enrollment | Clinic-initiated only; no self-enrollment |
| Cross-clinic data access | clinicId in Enrollment; enforced at query level |
| Invite spam | Per-clinician daily limits |

### Data Protection
- No PHI in logs or error messages
- Encryption at rest (Postgres)
- TLS in transit
- Audit trail for sensitive operations
- Patient name/DOB in invites: minimal PII for verification only

---

## Deployment (MVP)

- Single-region deployment
- Managed Postgres (e.g., Supabase, RDS, Neon)
- API on containerized platform (e.g., Railway, Render, ECS)
- Clinician app: Vercel or similar
- Patient app: App Store / Play Store

Horizontal scaling and multi-region are deferred.
