# Nephrawn — Prototype Vertical Slices

This document defines the four vertical slices for Option B prototype features.

**Execution Rules:**
- Each slice must be fully implemented, tested, documented, and committed before starting the next
- No partial slices
- No mixing slices
- All future work references this slice order
- Deviations require explicit justification

---

## Slice Execution Order

| Order | Slice | Rationale |
|-------|-------|-----------|
| 1 | Medication Tracking | Simplest schema; no external dependencies; builds familiarity with patient data patterns |
| 2 | Lab Result Uploads | Introduces document storage; no external APIs; builds on upload patterns |
| 3 | Email Notifications | Introduces external service (email); builds on alert system |
| 4 | Device Integration (Withings) | Most complex; OAuth + external API + background jobs; benefits from patterns established in earlier slices |

---

## Slice 1: Medication Tracking

### Scope
Patients can log their current medications and track adherence. Clinicians can view patient medication lists.

### Non-Goals
- Automated reminders/push notifications (deferred)
- Drug interaction checking
- Prescription management
- Pharmacy integration

### Schema Changes

```prisma
model Medication {
  id          String   @id @default(uuid())
  patientId   String
  patient     Patient  @relation(fields: [patientId], references: [id])

  name        String
  dosage      String?           // e.g., "10mg", "500mg twice daily"
  frequency   String?           // e.g., "daily", "twice daily", "as needed"
  instructions String?          // e.g., "take with food"

  startDate   DateTime?
  endDate     DateTime?         // null = ongoing
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  logs        MedicationLog[]

  @@index([patientId, isActive])
}

model MedicationLog {
  id            String   @id @default(uuid())
  medicationId  String
  medication    Medication @relation(fields: [medicationId], references: [id])

  loggedAt      DateTime @default(now())  // when patient logged this
  scheduledFor  DateTime?                  // optional: when dose was scheduled
  taken         Boolean                    // true = taken, false = skipped
  notes         String?

  createdAt     DateTime @default(now())

  @@index([medicationId, loggedAt])
}
```

### Services

**MedicationService** (`src/services/medication.service.ts`)
- `listMedications(patientId, includeInactive?)` — Get patient's medications
- `getMedication(medicationId, patientId)` — Get single medication
- `createMedication(patientId, data)` — Add new medication
- `updateMedication(medicationId, patientId, data)` — Update medication
- `deleteMedication(medicationId, patientId)` — Soft delete (set isActive=false)
- `logAdherence(medicationId, patientId, data)` — Log taken/skipped
- `getAdherenceHistory(medicationId, patientId, dateRange)` — Get adherence logs
- `getAdherenceSummary(patientId, dateRange)` — Aggregate adherence stats

### API Endpoints

**Patient routes:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patient/medications` | List own medications |
| POST | `/patient/medications` | Add medication |
| GET | `/patient/medications/:id` | Get medication details |
| PUT | `/patient/medications/:id` | Update medication |
| DELETE | `/patient/medications/:id` | Remove medication |
| POST | `/patient/medications/:id/log` | Log adherence |
| GET | `/patient/medications/:id/logs` | Get adherence history |
| GET | `/patient/medications/summary` | Adherence summary |

**Clinician routes:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinician/patients/:patientId/medications` | View patient medications |
| GET | `/clinician/patients/:patientId/medications/summary` | Patient adherence summary |

### Tests

**Unit tests:**
- MedicationService.createMedication — validation, patient ownership
- MedicationService.logAdherence — medication ownership check
- MedicationService.getAdherenceSummary — calculation accuracy

**Integration tests:**
- Patient can CRUD own medications
- Patient cannot access other patient's medications
- Clinician can view enrolled patient's medications
- Clinician cannot view unenrolled patient's medications
- Adherence logging creates correct records
- Soft delete sets isActive=false

### UI Changes

**Patient App (Flutter):**
- Medications screen (list view with add button)
- Add/Edit medication form
- Medication detail screen with adherence log
- Quick log button ("I took this" / "I skipped this")
- Link from profile/dashboard to medications

**Clinician App (React):**
- Medications tab on patient detail page
- Medication list with adherence indicators
- Adherence summary card (% taken last 7/30 days)

### Acceptance Criteria
- [ ] Patient can add, edit, delete medications
- [ ] Patient can log daily adherence (taken/skipped)
- [ ] Clinician can view patient medication list
- [ ] Clinician can see adherence summary
- [ ] All CRUD operations have ownership checks
- [ ] Integration tests pass
- [ ] Documentation updated

---

## Slice 2: Lab Result Uploads

### Scope
Patients can upload lab result documents (PDF, images). Clinicians can view uploaded documents.

### Non-Goals
- OCR/parsing of lab values (deferred to production)
- Structured data extraction
- Lab value trending
- Integration with lab systems

### Schema Changes

```prisma
enum DocumentType {
  LAB_RESULT
  OTHER
}

model Document {
  id          String       @id @default(uuid())
  patientId   String
  patient     Patient      @relation(fields: [patientId], references: [id])

  type        DocumentType @default(LAB_RESULT)
  filename    String                        // original filename
  mimeType    String                        // e.g., "application/pdf", "image/jpeg"
  sizeBytes   Int
  storageKey  String       @unique          // path in storage (S3 key or local path)

  title       String?                       // patient-provided title
  notes       String?                       // patient-provided notes
  documentDate DateTime?                    // date on the lab report

  uploadedAt  DateTime     @default(now())
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([patientId, uploadedAt])
  @@index([patientId, type])
}
```

### Services

**DocumentService** (`src/services/document.service.ts`)
- `generateUploadUrl(patientId, filename, mimeType)` — Get signed upload URL
- `confirmUpload(patientId, storageKey, metadata)` — Create document record
- `listDocuments(patientId, type?, limit?, offset?)` — List documents
- `getDocument(documentId, patientId)` — Get document metadata
- `generateDownloadUrl(documentId, patientId)` — Get signed download URL
- `deleteDocument(documentId, patientId)` — Delete document and file

**StorageAdapter** (`src/adapters/storage.adapter.ts`)
- Interface for S3-compatible storage
- Local filesystem implementation for development
- S3 implementation for production (stubbed)

### API Endpoints

**Patient routes:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/patient/documents/upload-url` | Get signed upload URL |
| POST | `/patient/documents` | Confirm upload, create metadata |
| GET | `/patient/documents` | List own documents |
| GET | `/patient/documents/:id` | Get document metadata |
| GET | `/patient/documents/:id/download-url` | Get signed download URL |
| DELETE | `/patient/documents/:id` | Delete document |

**Clinician routes:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinician/patients/:patientId/documents` | List patient documents |
| GET | `/clinician/patients/:patientId/documents/:id` | Get document metadata |
| GET | `/clinician/patients/:patientId/documents/:id/download-url` | Get download URL |

### Tests

**Unit tests:**
- DocumentService.generateUploadUrl — returns valid signed URL
- DocumentService.confirmUpload — creates document record
- StorageAdapter — file operations work correctly

**Integration tests:**
- Patient can request upload URL
- Patient can confirm upload and create document
- Patient can list own documents
- Patient cannot access other patient's documents
- Clinician can view enrolled patient's documents
- Clinician can get download URLs for patient documents
- Document deletion removes file from storage

### UI Changes

**Patient App (Flutter):**
- Documents screen (list view with upload button)
- Upload flow (pick file, add title/date, upload)
- Document list with thumbnails (for images) or PDF icon
- Document detail screen with download option

**Clinician App (React):**
- Documents tab on patient detail page
- Document list with upload date, type, filename
- Inline PDF viewer or download link
- Document timeline view (chronological)

### Acceptance Criteria
- [ ] Patient can upload PDF and image files
- [ ] Patient can add title, notes, document date
- [ ] Patient can view and download own documents
- [ ] Clinician can view patient documents
- [ ] Files stored securely (not publicly accessible)
- [ ] Signed URLs expire appropriately
- [ ] Integration tests pass
- [ ] Documentation updated

---

## Slice 3: Email Notifications

### Scope
Clinicians receive email notifications for high-priority alerts. Notification preferences are configurable.

### Non-Goals
- SMS notifications (deferred)
- Push notifications (deferred)
- Patient notifications
- Real-time notifications (email is async)

### Schema Changes

```prisma
model NotificationPreference {
  id           String   @id @default(uuid())
  clinicianId  String   @unique
  clinician    Clinician @relation(fields: [clinicianId], references: [id])

  emailEnabled Boolean  @default(true)

  // Alert severity thresholds
  emailOnHigh     Boolean @default(true)   // HIGH severity alerts
  emailOnMedium   Boolean @default(false)  // MEDIUM severity alerts
  emailOnLow      Boolean @default(false)  // LOW severity alerts

  // Digest settings
  digestEnabled   Boolean @default(false)  // batch into daily digest
  digestHour      Int     @default(8)      // hour to send digest (0-23)
  digestTimezone  String  @default("America/New_York")

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model NotificationLog {
  id           String   @id @default(uuid())
  clinicianId  String
  clinician    Clinician @relation(fields: [clinicianId], references: [id])

  alertId      String?
  alert        Alert?   @relation(fields: [alertId], references: [id])

  type         String   // "ALERT_EMAIL", "DIGEST_EMAIL"
  recipient    String   // email address
  subject      String
  sentAt       DateTime @default(now())

  @@index([clinicianId, sentAt])
  @@index([alertId])
}
```

### Services

**NotificationService** (`src/services/notification.service.ts`)
- `getPreferences(clinicianId)` — Get notification preferences
- `updatePreferences(clinicianId, data)` — Update preferences
- `notifyOnAlert(alert)` — Check preferences, send if configured
- `sendAlertEmail(clinicianId, alert)` — Send individual alert email
- `generateDigest(clinicianId)` — Create digest email content
- `sendDigest(clinicianId)` — Send daily digest
- `shouldNotify(clinicianId, alertSeverity)` — Check if notification should be sent
- `logNotification(clinicianId, alertId, type, recipient, subject)` — Record sent notification

**EmailAdapter** (`src/adapters/email.adapter.ts`)
- Interface for email sending
- Console implementation for development (logs to console)
- Resend implementation for production (stubbed)

### API Endpoints

**Clinician routes:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinician/notifications/preferences` | Get notification settings |
| PUT | `/clinician/notifications/preferences` | Update notification settings |
| GET | `/clinician/notifications/history` | Get notification history |

### Background Jobs

**sendAlertNotifications** (triggered by alert creation)
- On alert creation, check assigned clinician's preferences
- If email enabled and severity matches, queue email
- Rate limit: max 1 email per patient per hour (prevents spam)

**sendDailyDigests** (scheduled job)
- Run hourly
- For clinicians with digest enabled and matching digestHour
- Aggregate unacknowledged alerts from last 24h
- Send digest email

### Tests

**Unit tests:**
- NotificationService.shouldNotify — preference logic
- NotificationService.notifyOnAlert — rate limiting
- EmailAdapter — email formatting

**Integration tests:**
- Clinician can get/update notification preferences
- Alert creation triggers notification check
- Email sent for HIGH severity with emailOnHigh=true
- Email NOT sent for LOW severity with emailOnLow=false
- Rate limiting prevents duplicate emails
- Notification log created on send

### UI Changes

**Clinician App (React):**
- Notification settings page (accessible from profile/settings)
- Toggle for email notifications
- Checkboxes for severity levels (High, Medium, Low)
- Digest settings (enable, time, timezone)
- Notification history list

### Acceptance Criteria
- [ ] Clinician can enable/disable email notifications
- [ ] Clinician can configure severity thresholds
- [ ] Clinician can enable daily digest mode
- [ ] High-priority alerts trigger email (when configured)
- [ ] Emails contain alert details and link to patient
- [ ] Rate limiting prevents notification spam
- [ ] Notification history is logged
- [ ] Integration tests pass
- [ ] Documentation updated

---

## Slice 4: Device Integration (Withings)

### Scope
Patients can connect Withings devices (scale, BP monitor) and sync measurements automatically.

### Non-Goals
- Other device vendors (Fitbit, Apple Health) — deferred
- Real-time sync (polling-based)
- Device setup guidance
- Troubleshooting device issues

### Schema Changes

```prisma
enum DeviceVendor {
  WITHINGS
}

model DeviceConnection {
  id          String       @id @default(uuid())
  patientId   String
  patient     Patient      @relation(fields: [patientId], references: [id])

  vendor      DeviceVendor

  // OAuth tokens (encrypted in production)
  accessToken  String
  refreshToken String
  tokenExpiry  DateTime

  // Withings-specific
  withingsUserId String?

  // Sync state
  lastSyncAt   DateTime?
  lastSyncError String?

  connectedAt  DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@unique([patientId, vendor])
  @@index([patientId])
}
```

**Measurement model update:**
- `source` field already exists — will use `'withings'` value
- `externalId` field already exists — will store Withings measurement ID

### Services

**DeviceService** (`src/services/device.service.ts`)
- `getConnections(patientId)` — List connected devices
- `initiateOAuth(patientId, vendor)` — Generate OAuth authorization URL
- `handleOAuthCallback(patientId, vendor, code)` — Exchange code for tokens
- `refreshToken(connectionId)` — Refresh expired OAuth token
- `disconnect(patientId, vendor)` — Remove device connection
- `syncMeasurements(connectionId)` — Fetch and store new measurements

**WithingsAdapter** (`src/adapters/withings.adapter.ts`)
- `getAuthorizationUrl(state)` — Build OAuth URL
- `exchangeCode(code)` — Exchange auth code for tokens
- `refreshToken(refreshToken)` — Refresh access token
- `getMeasurements(accessToken, since)` — Fetch measurements from API
- `normalizeWeight(withingsMeasure)` — Convert to canonical Measurement
- `normalizeBloodPressure(withingsMeasure)` — Convert to canonical Measurement

### API Endpoints

**Patient routes:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patient/devices` | List connected devices |
| POST | `/patient/devices/withings/authorize` | Initiate OAuth flow |
| GET | `/patient/devices/withings/callback` | OAuth callback handler |
| DELETE | `/patient/devices/withings` | Disconnect Withings |
| POST | `/patient/devices/withings/sync` | Manual sync trigger |

### Background Jobs

**syncWithingsDevices** (scheduled job)
- Run every 15 minutes
- For each active DeviceConnection with vendor=WITHINGS
- Refresh token if expired
- Fetch measurements since lastSyncAt
- Create Measurement records with source='withings'
- Update lastSyncAt
- Alert rules evaluate device data same as manual entry

### Tests

**Unit tests:**
- WithingsAdapter.normalizeWeight — unit conversion
- WithingsAdapter.normalizeBloodPressure — BP pairing
- DeviceService.syncMeasurements — deduplication logic

**Integration tests:**
- OAuth flow creates DeviceConnection
- Disconnect removes DeviceConnection
- Sync creates Measurement records
- Duplicate measurements not created
- Token refresh works when expired
- Device data triggers alert rules

### UI Changes

**Patient App (Flutter):**
- Connected Devices screen (accessible from settings)
- "Connect Withings" button with OAuth flow
- Connected device card showing last sync time
- Manual "Sync Now" button
- Disconnect option
- Sync status/error display

**Clinician App (React):**
- Device indicator on patient card (icon if devices connected)
- Measurement source indicator in measurement list
- Filter measurements by source (manual vs device)

### External Dependencies

**Withings API:**
- OAuth 2.0 authorization
- Measure - Getmeas endpoint
- Rate limits: 120 requests/minute

**Environment variables:**
- `WITHINGS_CLIENT_ID`
- `WITHINGS_CLIENT_SECRET`
- `WITHINGS_CALLBACK_URL`

### Acceptance Criteria
- [ ] Patient can initiate Withings OAuth flow
- [ ] OAuth callback creates DeviceConnection
- [ ] Background job syncs measurements periodically
- [ ] Weight and BP measurements created with source='withings'
- [ ] Duplicate measurements deduplicated
- [ ] Token refresh works when expired
- [ ] Patient can disconnect device
- [ ] Alert rules apply to device data
- [ ] Integration tests pass
- [ ] Documentation updated

---

## Prototype Completion Criteria

The prototype is complete when:

1. **All slices implemented**: Medication, Documents, Notifications, Devices
2. **All acceptance criteria met**: Every checkbox above is checked
3. **All tests passing**: Unit and integration tests for all slices
4. **Documentation updated**: ARCH.md, API docs reflect new endpoints
5. **End-to-end workflows verified**:
   - Patient can log medications and track adherence
   - Patient can upload lab results
   - Clinician receives email for high-priority alerts
   - Patient can connect Withings and see synced measurements
6. **No slice mixing**: Each slice committed separately
7. **Feature interactions documented**: Any unexpected interactions noted

---

## Hardening Phase (Phase 2) — DO NOT IMPLEMENT YET

After prototype completion, the following hardening tasks will be executed:

### Security
- [ ] JWT secret: Fail startup if `JWT_SECRET` ENV not set
- [ ] Rate limiting: Implement on `/auth/*` endpoints (5 login attempts/minute)
- [ ] Token persistence: Implement secure storage in web (httpOnly cookies) and mobile (secure storage)
- [ ] Input validation: Add bounds checking on all measurement values
- [ ] CORS: Environment-based configuration
- [ ] Secrets audit: Ensure no hardcoded secrets in codebase

### Observability
- [ ] Structured logging: Replace console.log with structured logger
- [ ] Correlation IDs: Add request ID to all logs
- [ ] Error categorization: Distinguish 4xx vs 5xx errors
- [ ] Health endpoint: Add `/health` with dependency checks
- [ ] Metrics foundation: Basic request timing and counts

### Deployment
- [ ] Environment configuration: Validate all required ENV vars
- [ ] Database migrations: Ensure idempotent and reversible
- [ ] Container configuration: Dockerfile optimization
- [ ] CI/CD: Automated test and build pipeline

### Compliance
- [ ] PHI audit: Verify no PHI in logs or error messages
- [ ] Data retention: Document retention policies
- [ ] Access audit: Verify authorization on all endpoints

This phase begins immediately after prototype completion.
