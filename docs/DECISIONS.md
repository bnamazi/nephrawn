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