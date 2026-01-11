# Nephrawn — Key Decisions

## 2025-01 — Backend-first development
Context: UI designs are incomplete.
Decision: Define domain model and APIs before UI.
Consequence: Faster iteration, fewer redesigns.

## 2025-01 — Rule-based signals before AI models
Context: Limited data, need clinician trust.
Decision: Start with transparent rules.
Consequence: Schema must support explainability.

---

## 2025-01 — Canonical units for measurement storage
Context: Patients may submit weight in lbs or kg; devices use varied units.
Decision: Store all measurements in canonical units (kg, mmHg, %, bpm). Convert at API boundary. Preserve original unit in `inputUnit` field for audit trail.
Consequence: Consistent trend calculations. No mixed-unit math errors. Frontends receive predictable units.

## 2025-01 — Two-layer measurement deduplication
Context: Device syncs may retry; patients may double-tap submit.
Decision:
- Device duplicates: `@@unique([source, externalId])` constraint
- Manual duplicates: 5-minute window + 0.1% value tolerance
Consequence: Clean trends without duplicate data points. API returns `isDuplicate: true` instead of failing.

## 2025-01 — Alert update vs create (de-duplication)
Context: If a patient's weight remains elevated, each new reading would create another alert.
Decision: When a rule triggers and an OPEN alert already exists for the same (patientId, ruleId), update the existing alert's inputs instead of creating a new one.
Consequence: No alert spam. Clinicians see one evolving alert per condition, not hundreds.

## 2025-01 — Transaction boundaries for measurements
Context: Measurement creation must log to InteractionLog atomically to ensure RPM/CCM audit trail.
Decision: Wrap measurement + interaction log in a Prisma transaction. Alert evaluation runs in a separate transaction (isolation).
Consequence: No orphaned records. Alert failures don't block measurement storage.

## 2025-01 — Clinical thresholds for trend detection
Context: Arbitrary percentage-based trends (e.g., "5% change") lack clinical meaning.
Decision: Use clinically significant thresholds for trend calculation:
- Weight: 1 kg (~2.2 lbs)
- BP: 10 mmHg systolic, 5 mmHg diastolic
- SpO2: 2%
- Heart Rate: 10 bpm
Consequence: Trends reflect clinically meaningful changes, not noise.

## 2025-01 — Time-series API guardrails
Context: Unbounded queries could crash the server or overwhelm frontends.
Decision:
- Default limit: 200 points, hard max: 2000
- Default lookback: 30 days (time-series), 90 days (aggregates)
- Max aggregate range: 365 days
- All responses include metadata (timezone, hasMore, totalCount)
Consequence: Predictable performance. Frontends can paginate if needed.

## 2025-01 — Blood pressure pairing window
Context: Systolic and diastolic are submitted as a pair but stored separately.
Decision: 60-second pairing window. Measurements within this window are paired for charting. Unpaired counts reported in metadata.
Consequence: Clean BP charts. Visibility into data quality issues.

## 2025-01 — Trend requires minimum time span
Context: Two readings 5 minutes apart shouldn't determine a "trend".
Decision: Trend calculation requires 4+ data points AND 24+ hour time span.
Consequence: Avoids false trend signals from clustered measurements.

---

## 2025-01 — Clinic-initiated invite model for enrollment
Context: RPM/CCM systems must ensure proper authorization before clinicians access patient data. Three options considered:
1. **Open discovery**: Patient searches for clinicians → privacy risk, enumeration attacks
2. **Patient-initiated requests**: Patient requests enrollment → still allows unauthorized access attempts
3. **Clinic-initiated invites**: Clinician creates invite with patient info → patient claims with verification

Decision: Use clinic-initiated invite model. Clinician creates invite with patient name + DOB. Patient claims using code + DOB verification.

Consequence:
- No global patient/clinician search endpoints (enumeration protection)
- Patients cannot self-enroll without clinic authorization
- Clinician-controlled enrollment aligns with clinical workflows
- DOB verification provides identity assurance without exposing patient data

## 2025-01 — Clinic as organizational boundary
Context: Healthcare organizations need tenant isolation. A patient at Clinic A should not be visible to clinicians at Clinic B.
Decision: Introduce `Clinic` entity. All enrollments reference both `clinicianId` and `clinicId`. Authorization checks include clinic membership.
Consequence:
- Multi-tenant isolation by default
- Clinicians can work at multiple clinics
- Patients can be enrolled at multiple clinics (e.g., nephrology + cardiology)
- Future: billing, NPI, and org-level settings per clinic

## 2025-01 — Cryptographic invite codes
Context: Invite codes must be unguessable to prevent enumeration attacks.
Decision: Use 40-character cryptographically random codes (alphanumeric). Keyspace: ~10^48 combinations.
Consequence:
- Effectively unguessable via brute force
- Short enough to type or share verbally
- Unique index ensures no collisions
- Rate limiting provides additional protection

## 2025-01 — DOB as identity verification
Context: Need to verify patient identity when claiming invite without creating a global patient search.
Decision: Clinician provides patient DOB when creating invite. Patient must enter matching DOB to claim.
Consequence:
- Simple, familiar verification factor
- No need for email verification (though optional)
- Minimal PII in invite record
- Combined with invite code, provides reasonable assurance

## 2025-01 — Role-based clinic member management
Context: Clinics need to manage their team members with appropriate access controls.
Decision: Implement hierarchical role system (Owner > Admin > Clinician > Staff) with role-based permissions:
- **Owner**: Full control, can assign any role, cannot be removed
- **Admin**: Can add/remove Clinician/Staff, cannot modify other Admins or Owner
- **Clinician/Staff**: No member management access
Consequence:
- Clear permission hierarchy prevents privilege escalation
- Settings access (gear icon) only visible to Owner/Admin
- Role badges in UI provide visibility into permissions
- No clinician invite system needed; add by email is sufficient
- Ownership transfer not supported (keeps model simple)

---

## 2026-01 — Patient profile and care plan architecture
Context: Clinicians need to track patient clinical information (CKD stage, comorbidities, medications) and set individualized targets (dry weight, BP ranges).
Decision: Separate PatientProfile (patient-owned clinical data) from CarePlan (enrollment-scoped clinician-managed targets):
- **PatientProfile**: One per patient, contains demographics, CKD stage, comorbidities, medications
- **CarePlan**: One per enrollment, contains dry weight, BP targets, risk flags, notes
- Both support clinician-verified and patient-reported fields (e.g., ckdStageClinician vs ckdStageSelfReported)
Consequence:
- Profile follows patient across clinics; care plan is clinic-specific
- Clinicians can verify patient-reported data without overwriting it
- Completeness scoring guides clinicians to fill critical fields
- Future: Care plan targets can drive alert thresholds

## 2026-01 — Audit trail for profile and care plan changes
Context: Clinical data changes must be traceable for compliance and accountability.
Decision: Maintain PatientProfileAudit table that records all changes to PatientProfile and CarePlan:
- Captures: entityType, entityId, actorType (PATIENT/CLINICIAN/SYSTEM), actorId, changedFields (JSONB with old/new values), reason, timestamp
- Automatically populated by service layer on every update
- Immutable append-only log
Consequence:
- Complete audit trail for regulatory compliance
- Clinicians can view change history in UI
- Supports "who changed what when" queries
- Change reasons optional but encouraged for clinical context

---

## 2026-01 — Intentional deferral of security hardening

Context: The prototype is being expanded to include Option B features (device integration, lab uploads, email notifications, medication tracking) before production deployment. Security hardening could be done incrementally or holistically.

Decision: **Defer security hardening until prototype is feature-complete.**

Rationale:
1. **End-to-end evaluation**: Clinical workflows cannot be fully evaluated until all data capture features exist. Hardening partial features risks rework.
2. **Feature interactions**: Device data, lab uploads, and notifications interact with existing alert/measurement systems. Understanding these interactions informs security boundaries.
3. **Holistic hardening**: Addressing auth, rate limiting, logging, and validation together ensures consistent security posture across all features.
4. **Time-bounded**: This deferral is intentional and time-bounded to prototype completion (4 vertical slices).

Known issues tracked for hardening phase:
- JWT secret fallback (use ENV or fail)
- Rate limiting on auth endpoints
- Token persistence in web/mobile apps
- Input validation bounds on measurements
- Structured logging with correlation IDs
- CORS configuration for deployment

Consequence:
- Prototype is NOT suitable for real patient data
- All prototype testing uses synthetic/demo data only
- Hardening is Phase 2, immediately after prototype completion
- Security issues are tracked, not ignored

## 2026-01 — Prototype feature scope (Option B)

Context: After MVP feature completion, two paths were considered:
1. Harden MVP and deploy
2. Expand prototype scope to include enhanced data capture, then harden holistically

Decision: Expand prototype to include Option B features before hardening:
- Device integration (Withings)
- Lab result uploads (documents)
- Email notifications for alerts
- Medication tracking

Consequence:
- Four additional vertical slices before hardening
- Each slice: implemented, tested, documented, committed
- No partial slices; no mixing slices
- Hardening happens once, after all features complete

## 2026-01 — Manual-first approach for structured lab results

Context: Lab results are critical for CKD management. Three approaches were considered:
1. **Document-only**: Upload PDFs, defer structured data (limited clinical utility)
2. **Automated parsing**: OCR/ML to extract values from PDFs (complex, error-prone)
3. **Manual-first with extension points**: Structured entry now, automation hooks for later

Decision: Implement manual entry with extension points for future automation:
- `LabReport.documentId` — Optional link to source PDF
- `LabReport.source` enum — Distinguishes MANUAL_PATIENT, MANUAL_CLINICIAN, IMPORTED
- `LabResult.analyteCode` — Supports LOINC codes for future standardization
- Clinician verification workflow — Adds trust layer to patient-entered data

Rationale:
- PDF parsing requires OCR/ML infrastructure (deferred complexity)
- Lab API integration requires vendor partnerships (deferred dependency)
- Manual entry works immediately and captures structured data
- Data model supports future automation without schema changes
- Verification workflow ensures clinical accuracy

Consequence:
- Patients and clinicians can enter structured lab data immediately
- Common CKD analytes available as quick-picks (Creatinine, eGFR, BUN, etc.)
- Clinicians can verify patient-entered labs
- Future: OCR can populate drafts for manual verification
- Future: Lab provider APIs can auto-import with source = IMPORTED

## 2026-01 — Device integration with adapter pattern and mock-first development

Context: Withings devices (BPM Pro2, Body Pro 2) need to be integrated for automatic measurement sync. Withings credentials not yet available for testing.

Decision: Implement adapter pattern with mock and real implementations:
- `WithingsAdapter` interface defines OAuth and sync operations
- `MockWithingsAdapter` simulates OAuth flow and returns realistic test data
- `RealWithingsAdapter` implements actual Withings API calls
- Factory selects adapter based on `WITHINGS_MOCK` env var or missing credentials

Design choices:
- **OAuth token encryption**: AES-256-GCM for tokens at rest (ENCRYPTION_KEY env var)
- **In-app browser for OAuth**: Uses `url_launcher` with `LaunchMode.inAppBrowserView`
- **15-minute sync interval**: Background job polls all active connections
- **Forward-only sync**: No historical data import; sync from connection time forward
- **All body composition metrics**: Captures everything Body Pro 2 measures (9 types)
- **CSRF protection**: State parameter with 15-minute cache for OAuth flow

Consequence:
- Full end-to-end testing possible without Withings credentials
- Easy switch to real API when credentials available
- Body composition data (fat %, muscle mass, etc.) enables future health insights
- Alert rules automatically apply to device-synced measurements
- Mock data simulates realistic BPM Pro2 and Body Pro 2 readings

## 2026-01 — Withings measurement type mapping

Context: Withings API returns measurement type codes that need mapping to Nephrawn's schema.

Decision: Extend MeasurementType enum with body composition types and map Withings codes:
| Withings Code | Nephrawn Type | Unit |
|---------------|---------------|------|
| 1 | WEIGHT | kg |
| 5 | FAT_FREE_MASS | kg |
| 6 | FAT_RATIO | % |
| 8 | FAT_MASS | kg |
| 9 | BP_DIASTOLIC | mmHg |
| 10 | BP_SYSTOLIC | mmHg |
| 11 | HEART_RATE | bpm |
| 76 | MUSCLE_MASS | kg |
| 77 | HYDRATION | kg |
| 88 | BONE_MASS | kg |
| 91 | PULSE_WAVE_VELOCITY | m/s |

Value conversion: `value * 10^unit` (Withings sends value=7200, unit=-2 → 72.00 kg)

Consequence:
- Consistent storage in canonical units across manual and device data
- Trend calculations work identically for device-synced measurements
- Units.ts updated with clinical thresholds for new body composition types

---

## 2026-01 — Alert thresholds: fixed defaults with future configurability

Context: Alert rules need clinical thresholds (e.g., BP ≥180 mmHg). Options considered:
1. **Fixed defaults**: Hard-code clinically safe thresholds
2. **Per-patient configuration**: Each patient can have custom thresholds
3. **Per-clinic configuration**: Clinic-wide thresholds as program defaults

Decision: MVP uses fixed clinical defaults. Future enhancement path:
- **Phase 1 (next slice candidate)**: Per-clinic configurable thresholds (one set of defaults per clinic/program)
- **Phase 2 (later)**: Per-patient overrides (only for edge cases requiring patient-specific thresholds)

Current fixed thresholds:
- Weight gain: >2 kg in 48h → CRITICAL severity
- BP systolic high: ≥180 mmHg → CRITICAL severity
- BP systolic low: ≤90 mmHg → WARNING severity
- SpO2 low: ≤92% → CRITICAL severity

Severity enum values: INFO, WARNING, CRITICAL

Consequence:
- MVP has safe, evidence-based defaults
- No per-patient configuration burden for clinicians
- Future: clinic can customize thresholds without patient-level complexity
- Alert rules documented with explicit threshold values

## 2026-01 — Body composition: trend-only, no alerting

Context: Withings Body Pro 2 captures body composition metrics (fat %, muscle mass, bone mass, hydration, pulse wave velocity). Should these trigger alerts?

Decision: Body composition metrics are captured and trended but do NOT trigger alerts in MVP.

Rationale:
- Clinical significance of body composition changes requires validation
- Fluid-related proxies (e.g., hydration) may be relevant but need clinician input
- Alert fatigue risk if adding unvalidated thresholds
- Trend data valuable for longitudinal assessment without alerting

Future path:
- Alerting thresholds introduced after clinician validation
- Likely focus first on fluid-related proxies rather than body fat %
- May require per-patient or per-condition thresholds

Consequence:
- All 9 body composition types stored and displayed in charts
- Clinicians can review trends manually
- No alert rules for body composition in MVP

## 2026-01 — RPM/CCM scope: audit trail MVP, billing MVP+

Context: RPM/CCM workflows require interaction logging for compliance. Full billing support requires time tracking and report generation.

Decision: Split RPM/CCM into MVP (audit trail) and MVP+ (billing):

**MVP Scope (Audit Trail)**:
- Interaction logging with timestamps and type classification
- Patient activity records (symptom check-ins, measurements, document uploads)
- Clinician activity records (views, note creation, alert acknowledgment)
- Device data with source attribution

**MVP+ Scope (Billing)**:
- Time tracking per interaction (durationSeconds field exists but not populated)
- Monthly activity summaries and aggregation
- CPT code mapping
- Billing report generation
- Minimum interaction threshold validation

Next slice candidate: Monthly aggregation summaries and time entry UI for billable interactions.

Consequence:
- InteractionLog table populated for audit trail
- durationSeconds remains nullable in MVP
- Billing reports not available until MVP+
- Data model supports billing without schema changes

## 2026-01 — Lab verification: transcription accuracy only

Context: Labs entered by patients need clinician review. What does "verification" mean?

Decision: Lab verification confirms transcription accuracy, not clinical interpretation:
- **Who can verify**: Any authenticated clinician enrolled with the patient's clinic
- **What verification means**: "Reviewed and confirmed as accurately transcribed from the source document/lab report"
- **What it does NOT mean**: Clinical interpretation, endorsement of treatment decisions, or assessment of normal/abnormal status
- **Automation when verified**: None in MVP (no auto-alerts, no auto-messages)

Consequence:
- Verified labs display verification badge in UI
- Verification adds trust layer without implying clinical judgment
- Future: verified labs could trigger clinical decision support (not in MVP)

## 2026-01 — Medication discontinuation tracking

Context: When medications are stopped, the reason should be recorded for audit trail.

Decision: Add minimal discontinuation tracking to Medication model:
- `discontinuedAt` — timestamp when stopped
- `discontinuedBy` — FK to clinician who discontinued (nullable)
- `discontinuedReason` — free-text reason (nullable)

Rationale:
- Structured reason codes add complexity without clear benefit yet
- Free-text captures context for audit trail
- Optional fields don't burden data entry

Consequence:
- Medication history shows when and why medications were stopped
- Audit trail for medication changes
- Future: structured reason codes can be added if needed

## 2026-01 — SpO2 and Heart Rate: backend supported, patient UI deferred

Context: SpO2 and Heart Rate exist as measurement types. Should patient app support manual entry?

Decision: Backend supports manual entry for all measurement types. Patient app UI for SpO2 and Heart Rate is deferred:
- SpO2 and Heart Rate can be synced via Withings devices
- Backend API accepts manual entry for these types
- Patient app shows Weight and Blood Pressure entry only
- Clinician app displays all measurement types

Rationale:
- Device sync provides primary data source for these measurements
- Manual entry UI adds complexity without clear clinical workflow need
- Can be added if pulse oximeter users need manual fallback

Consequence:
- No patient UI blocker for device integration
- Data model complete for all vital types
- Future: patient UI can be added without backend changes

## 2026-01 — Email notifications: deferred to MVP+

Context: Alert notifications were planned as prototype scope. Should email be implemented now?

Decision: Email notifications are NOT IMPLEMENTED in MVP. Deferred to MVP+ with documented extension points.

Rationale:
- Email infrastructure requires provider integration (Resend, SendGrid, or SMTP)
- Notification preferences need schema additions (NotificationPreference, NotificationLog)
- Alert-to-email mapping adds complexity to alert service
- Core alert functionality works without notifications
- Can be added as future slice without blocking clinical workflows

Extension point documented in ARCH.md:
- Background worker/job pattern with pluggable email provider adapter
- NotificationService for preference checking and rate limiting

Consequence:
- Alerts visible in clinician app only (no email/push)
- No notification preferences UI needed
- Schema additions deferred (NotificationPreference, NotificationLog)
- Future slice: "Email Notifications for Alerts"