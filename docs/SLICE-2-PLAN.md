# Slice 2: Billing Summary Reports

**Goal**: Complete billing readiness by adding device transmission tracking, monthly summary reports, and CPT code eligibility indicators.

**Builds on**: Slice 1 (Time Entry for RPM/CCM Billing)

---

## Context

Slice 1 implemented manual time entry for clinician interactions. Slice 2 completes billing readiness by adding:
1. **Device transmission day tracking** — Count distinct days with device-sourced measurements (for 99454)
2. **Patient billing summary** — Per-patient monthly billing metrics
3. **Clinic billing report** — Clinic-wide aggregated billing report
4. **CPT eligibility indicators** — Display which codes are billable based on thresholds

---

## Scope

### In Scope
- Device transmission day calculation (distinct days with `source != 'manual'`)
- Patient-level billing summary endpoint
- Clinic-level billing report endpoint
- CPT code eligibility logic (99454, 99457, 99458, 99490)
- Frontend display of billing summaries

### Non-Goals
- Claims submission to clearinghouses
- PDF report generation
- EHR integration
- Automated time capture

---

## CPT Code Eligibility Thresholds

| Code | Requirement | Calculation |
|------|-------------|-------------|
| 99454 | 16+ device transmission days/month | `COUNT(DISTINCT DATE(timestamp)) WHERE source != 'manual'` |
| 99457 | 20+ minutes clinical time/month | `SUM(durationMinutes)` from TimeEntry |
| 99458 | Each additional 20 min block | Count of complete 20-min blocks above 99457 |
| 99490 | 20+ minutes CCM time/month | Same as 99457, using CCM activity types |

**Activity Types for CCM (99490)**:
- CARE_PLAN_UPDATE
- COORDINATION
- PHONE_CALL

**Activity Types for RPM (99457)**:
- All activity types count toward RPM time

---

## Schema Changes

No new tables required. Uses existing:
- `measurements` — Device transmission tracking via `source` field
- `time_entries` — Time tracking (from Slice 1)

---

## Services

### BillingService (`src/services/billing.service.ts`)

```typescript
interface DeviceTransmissionSummary {
  totalDays: number;
  dates: string[];  // ISO date strings
  eligible99454: boolean;
}

interface TimeSummary {
  totalMinutes: number;
  byActivity: Record<TimeEntryActivity, number>;
  rpmMinutes: number;    // All activities
  ccmMinutes: number;    // CCM-specific activities
  eligible99457: boolean;
  eligible99458Count: number;  // Number of additional 20-min blocks
  eligible99490: boolean;
}

interface PatientBillingSummary {
  patientId: string;
  patientName: string;
  period: { from: Date; to: Date };
  deviceTransmission: DeviceTransmissionSummary;
  time: TimeSummary;
  eligibleCodes: string[];  // ['99454', '99457', etc.]
}

interface ClinicBillingReport {
  clinicId: string;
  clinicName: string;
  period: { from: Date; to: Date };
  totalPatients: number;
  patientsWithDeviceData: number;
  patientsWith99454: number;
  patientsWith99457: number;
  patientsWith99490: number;
  totalRpmMinutes: number;
  totalCcmMinutes: number;
  patients: PatientBillingSummary[];
}
```

**Functions**:
- `getDeviceTransmissionDays(patientId, from, to)` — Count distinct device days
- `getPatientBillingSummary(patientId, clinicianId, from, to)` — Full patient summary
- `getClinicBillingReport(clinicId, clinicianId, from, to)` — Clinic-wide report

---

## API Endpoints

### Clinician Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinician/patients/:patientId/billing-summary` | Patient billing summary for period |
| GET | `/clinician/clinics/:clinicId/billing-report` | Clinic-wide billing report |

### Query Parameters

Both endpoints accept:
- `from` — Start date (ISO string), defaults to start of current month
- `to` — End date (ISO string), defaults to today

---

## Response Formats

### Patient Billing Summary

```json
{
  "summary": {
    "patientId": "uuid",
    "patientName": "John Smith",
    "period": {
      "from": "2026-01-01T00:00:00Z",
      "to": "2026-01-31T23:59:59Z"
    },
    "deviceTransmission": {
      "totalDays": 18,
      "dates": ["2026-01-01", "2026-01-02", ...],
      "eligible99454": true
    },
    "time": {
      "totalMinutes": 45,
      "byActivity": {
        "PATIENT_REVIEW": 20,
        "CARE_PLAN_UPDATE": 15,
        "PHONE_CALL": 10
      },
      "rpmMinutes": 45,
      "ccmMinutes": 25,
      "eligible99457": true,
      "eligible99458Count": 1,
      "eligible99490": true
    },
    "eligibleCodes": ["99454", "99457", "99458", "99490"]
  }
}
```

### Clinic Billing Report

```json
{
  "report": {
    "clinicId": "uuid",
    "clinicName": "Demo Kidney Care Center",
    "period": {
      "from": "2026-01-01T00:00:00Z",
      "to": "2026-01-31T23:59:59Z"
    },
    "summary": {
      "totalPatients": 25,
      "patientsWithDeviceData": 18,
      "patientsWith99454": 12,
      "patientsWith99457": 20,
      "patientsWith99490": 8,
      "totalRpmMinutes": 450,
      "totalCcmMinutes": 180
    },
    "patients": [
      { /* PatientBillingSummary */ },
      ...
    ]
  }
}
```

---

## Tests

### Integration Tests

1. **Device transmission tracking**
   - Patient with 16+ device days → eligible99454 = true
   - Patient with 15 device days → eligible99454 = false
   - Manual entries don't count toward device days
   - Multiple measurements same day count as 1 day

2. **Time entry aggregation**
   - 20+ minutes → eligible99457 = true
   - 40+ minutes → eligible99458Count = 1
   - CCM activities counted separately for 99490
   - Time entries from multiple clinicians aggregated

3. **Authorization**
   - Clinician can only access enrolled patients
   - Clinic report requires OWNER/ADMIN role
   - Unenrolled clinician gets 403

4. **Edge cases**
   - No measurements → deviceTransmission shows 0
   - No time entries → time shows 0
   - Empty clinic → report shows empty patients array

---

## UI Changes

### Clinician App

#### 1. Patient Time Log Enhancement
Update the existing Time Log page to show:
- Device transmission day count for current period
- Monthly time total with breakdown by activity
- CPT eligibility badges (green checkmark if eligible)

#### 2. Clinic Billing Report Page (New)
Add `/clinic/billing` route accessible from clinic dropdown:
- Period selector (month picker, defaults to current month)
- Summary cards: Total patients, 99454 eligible, 99457 eligible
- Patient table with columns:
  - Patient name
  - Device days
  - RPM minutes
  - CCM minutes
  - Eligible codes (badges)
- Export button (exports table as CSV) — optional stretch goal

---

## Implementation Tasks

### Backend (3-4 hours)

1. **Create billing.service.ts**
   - Implement `getDeviceTransmissionDays()`
   - Implement `getPatientBillingSummary()`
   - Implement `getClinicBillingReport()`

2. **Add routes to clinician.routes.ts**
   - `GET /clinician/patients/:patientId/billing-summary`
   - `GET /clinician/clinics/:clinicId/billing-report`

3. **Write integration tests**
   - Device transmission counting
   - Time aggregation
   - Eligibility logic
   - Authorization checks

### Frontend (2-3 hours)

1. **Update Time Log page**
   - Add billing summary section
   - Show device days and eligibility indicators

2. **Create Clinic Billing Report page**
   - Add route and navigation
   - Period selector
   - Summary cards
   - Patient table

3. **Add types and API calls**
   - BillingSummary types
   - API client methods

---

## Acceptance Criteria

- [ ] Device transmission days counted correctly (distinct days, device source only)
- [ ] Patient billing summary endpoint returns all metrics
- [ ] Clinic billing report aggregates all enrolled patients
- [ ] CPT eligibility thresholds correctly applied (99454: 16 days, 99457/99490: 20 min)
- [ ] Authorization enforced (enrollment check, clinic admin check)
- [ ] Time Log page shows billing summary with eligibility badges
- [ ] Clinic billing report page accessible to clinic admins
- [ ] Integration tests pass
- [ ] Documentation updated

---

## Definition of Done

- [ ] All backend endpoints implemented and tested
- [ ] Frontend displays billing summaries correctly
- [ ] All acceptance criteria met
- [ ] Tests pass (backend integration)
- [ ] Changes committed with clear message
