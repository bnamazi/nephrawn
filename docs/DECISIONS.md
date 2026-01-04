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