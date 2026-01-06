# Nephrawn — UI Contracts

Screen-by-screen API mappings for patient profile, care plan, audit history, and worklist features.

---

## Table of Contents

1. [Patient Profile (Patient App)](#1-patient-profile-patient-app)
2. [Patient Profile (Clinician App)](#2-patient-profile-clinician-app)
3. [Care Plan Editor (Clinician App)](#3-care-plan-editor-clinician-app)
4. [Audit History](#4-audit-history)
5. [Worklist Banners](#5-worklist-banners)
6. [Patient Summary (Clinician Dashboard)](#6-patient-summary-clinician-dashboard)

---

## 1. Patient Profile (Patient App)

### Screen Purpose
Allows patients to view and edit their clinical profile (self-reported CKD stage, comorbidities, medications).

### API Endpoints

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Load profile | GET | `/patient/profile` | Patient |
| Update profile | PUT | `/patient/profile` | Patient |
| View history | GET | `/patient/profile/history` | Patient |

### GET /patient/profile Response

```typescript
{
  profile: {
    id: string;
    patientId: string;

    // Demographics
    sex: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED" | null;
    heightCm: number | null;
    heightDisplay: string | null;  // e.g., "5'10\""

    // CKD Context
    ckdStageSelfReported: CkdStage | null;
    ckdStageClinician: CkdStage | null;
    ckdStageEffective: CkdStage | null;           // Clinician ?? SelfReported
    ckdStageEffectiveLabel: string;               // e.g., "Stage 3b (GFR 30-44)"
    ckdStageSource: "clinician" | "self_reported" | null;

    primaryEtiology: KidneyDiseaseEtiology | null;
    primaryEtiologyLabel: string | null;
    dialysisStatus: DialysisStatus;
    dialysisStatusLabel: string;
    dialysisStartDate: string | null;             // ISO date
    transplantStatus: TransplantStatus;
    transplantDate: string | null;

    // Comorbidities
    hasHeartFailure: boolean;
    heartFailureClass: NyhaClass | null;
    heartFailureLabel: string | null;             // e.g., "Class II - Slight limitation"
    diabetesType: DiabetesType;
    diabetesLabel: string;
    hasHypertension: boolean;
    otherConditions: string[];

    // Medications
    medications: {
      onDiuretics: boolean;
      onAceArbInhibitor: boolean;
      onSglt2Inhibitor: boolean;
      onNsaids: boolean;
      onMra: boolean;
      onInsulin: boolean;
    };
    medicationNotes: string | null;               // Read-only for patient

    updatedAt: string;
  };
  completeness: {
    profileScore: number;                         // 0-100
    missingCritical: string[];
    missingRecommended: string[];
    showProfileBanner: boolean;
  };
}
```

### PUT /patient/profile Request

```typescript
// All fields optional - only send changed fields
{
  sex?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  heightCm?: number;                              // 50-300
  ckdStageSelfReported?: CkdStage;
  primaryEtiology?: KidneyDiseaseEtiology;
  dialysisStatus?: DialysisStatus;
  dialysisStartDate?: string;                     // ISO date
  transplantStatus?: TransplantStatus;
  transplantDate?: string;                        // ISO date, must be in past
  hasHeartFailure?: boolean;
  diabetesType?: DiabetesType;
  hasHypertension?: boolean;
  otherConditions?: string[];                     // Max 20, each max 100 chars
  onDiuretics?: boolean;
  onAceArbInhibitor?: boolean;
  onSglt2Inhibitor?: boolean;
  onNsaids?: boolean;
  onMra?: boolean;
  onInsulin?: boolean;
}
```

### UI Layout - Patient Profile Screen

```
┌─────────────────────────────────────────────────────────┐
│ My Health Profile                    [Save] [Discard]   │
├─────────────────────────────────────────────────────────┤
│ PROFILE COMPLETENESS: ████████░░ 75%                    │
│ Missing: Height                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ KIDNEY HEALTH                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ CKD Stage (my estimate)  [Stage 3b ▼]              │ │
│ │ Primary Cause           [Diabetes ▼]               │ │
│ │ Dialysis Status         [Not on dialysis ▼]        │ │
│ │ Transplant Status       [Not listed ▼]             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ABOUT ME                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Sex                     [Male ▼]                   │ │
│ │ Height                  [___] cm                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ OTHER CONDITIONS                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [ ] Heart Failure                                  │ │
│ │ Diabetes Type           [Type 2 ▼]                 │ │
│ │ [ ] High Blood Pressure                            │ │
│ │ Other: [Gout, Sleep Apnea] [+ Add]                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ MY MEDICATIONS                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [x] Diuretics (water pills)                        │ │
│ │ [x] ACE/ARB Inhibitors                             │ │
│ │ [ ] SGLT2 Inhibitors                               │ │
│ │ [ ] NSAIDs (ibuprofen, etc.) ⚠️                    │ │
│ │ [ ] MRA                                            │ │
│ │ [x] Insulin                                        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View Profile History →]                                │
└─────────────────────────────────────────────────────────┘
```

### Field → API Mapping

| UI Field | API Field | Editable By |
|----------|-----------|-------------|
| CKD Stage (my estimate) | `ckdStageSelfReported` | Patient |
| Primary Cause | `primaryEtiology` | Patient |
| Dialysis Status | `dialysisStatus` | Patient, Clinician |
| Transplant Status | `transplantStatus` | Patient, Clinician |
| Sex | `sex` | Patient |
| Height | `heightCm` | Patient, Clinician |
| Heart Failure checkbox | `hasHeartFailure` | Patient, Clinician |
| Diabetes Type | `diabetesType` | Patient, Clinician |
| High Blood Pressure | `hasHypertension` | Patient, Clinician |
| Other conditions | `otherConditions` | Patient, Clinician |
| Medication checkboxes | `onDiuretics`, etc. | Patient, Clinician |

---

## 2. Patient Profile (Clinician App)

### Screen Purpose
Allows clinicians to view and edit patient clinical profile, including clinician-only fields (verified CKD stage, NYHA class, medication notes).

### API Endpoints

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Load profile + care plan | GET | `/clinician/patients/:patientId/profile` | Clinician |
| Update profile | PUT | `/clinician/patients/:patientId/profile` | Clinician |
| View history | GET | `/clinician/patients/:patientId/profile/history` | Clinician |

### GET /clinician/patients/:patientId/profile Response

```typescript
{
  profile: {
    // Same shape as patient profile response
    // (see Section 1)
  };
  carePlan: {
    // Same shape as care plan response
    // (see Section 3)
  } | null;
  enrollment: {
    id: string;
    clinicId: string;
    clinicName: string;
  } | null;
  completeness: {
    profileScore: number;
    carePlanScore: number;
    missingCritical: string[];                    // Combined from profile + care plan
  };
  showTargetsBanner: boolean;                     // From care plan completeness
  showProfileBanner: boolean;                     // From profile completeness
}
```

### PUT /clinician/patients/:patientId/profile Request

```typescript
// Includes all patient fields PLUS clinician-only fields
{
  // ... all patient fields ...

  // Clinician-only fields
  ckdStageClinician?: CkdStage;                   // Overrides self-reported
  heartFailureClass?: NyhaClass;                  // CLASS_1-4
  medicationNotes?: string;                       // Free-text notes

  _changeReason?: string;                         // Optional audit reason
}
```

### UI Layout - Clinician Patient Profile View

```
┌─────────────────────────────────────────────────────────┐
│ John Smith's Profile                 [Edit] [History]   │
│ Enrolled: Jan 2, 2026 • Kidney Care Clinic              │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────────────┐ │
│ │ PROFILE             │ │ CARE PLAN                   │ │
│ │ ████████░░ 75%      │ │ ████████████ 100%           │ │
│ │ Missing: Verified   │ │ ✓ Complete                  │ │
│ │ CKD Stage           │ │                             │ │
│ └─────────────────────┘ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ KIDNEY STATUS                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ CKD Stage                                          │ │
│ │   Patient reported: Stage 3b                       │ │
│ │   Verified:         [Stage 3b ▼] ← CLINICIAN ONLY  │ │
│ │   Effective:        Stage 3b (clinician-verified)  │ │
│ │                                                    │ │
│ │ Primary Etiology:   Diabetic Nephropathy          │ │
│ │ Dialysis Status:    Not on dialysis               │ │
│ │ Transplant Status:  Listed                        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ COMORBIDITIES                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Heart Failure:      Yes                            │ │
│ │ NYHA Class:         [Class II ▼] ← CLINICIAN ONLY  │ │
│ │                                                    │ │
│ │ Diabetes:           Type 2                         │ │
│ │ Hypertension:       Yes                            │ │
│ │ Other:              Gout, Sleep Apnea              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ MEDICATIONS                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✓ Diuretics    ✓ ACE/ARB    ✓ Insulin             │ │
│ │ ✗ SGLT2i       ✗ NSAIDs     ✗ MRA                 │ │
│ │                                                    │ │
│ │ Notes: Patient on Furosemide 40mg BID, Lisinopril │ │
│ │        10mg daily. Monitor K+ levels.             │ │
│ │        ← CLINICIAN ONLY                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Edit Profile]  [View Care Plan →]  [View History →]    │
└─────────────────────────────────────────────────────────┘
```

### Clinician-Only Fields

| Field | API Field | Purpose |
|-------|-----------|---------|
| Verified CKD Stage | `ckdStageClinician` | Authoritative CKD stage (overrides self-reported) |
| NYHA Class | `heartFailureClass` | Heart failure severity classification |
| Medication Notes | `medicationNotes` | Clinician notes on medications |

---

## 3. Care Plan Editor (Clinician App)

### Screen Purpose
Allows clinicians to set patient-specific targets (dry weight, BP ranges) and risk flags for their enrollment.

### API Endpoints

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Load care plan | GET | `/clinician/patients/:patientId/care-plan` | Clinician |
| Update care plan | PUT | `/clinician/patients/:patientId/care-plan` | Clinician |

### GET /clinician/patients/:patientId/care-plan Response

```typescript
{
  carePlan: {
    id: string;
    enrollmentId: string;

    dryWeightKg: number | null;
    dryWeightLbs: number | null;                  // Converted for display

    targetBpSystolic: {
      min: number;                                // e.g., 110
      max: number;                                // e.g., 140
    } | null;
    targetBpDiastolic: {
      min: number;                                // e.g., 60
      max: number;                                // e.g., 90
    } | null;

    priorHfHospitalizations: number | null;
    fluidRetentionRisk: boolean;
    fallsRisk: boolean;

    notes: string | null;

    updatedAt: string;
  } | null;
  enrollment: {
    id: string;
    clinicId: string;
    clinicName: string;
  };
  completeness: {
    carePlanScore: number;                        // 0-100
    missingCritical: string[];                    // ["dryWeightKg"]
    showTargetsBanner: boolean;
  };
}
```

### PUT /clinician/patients/:patientId/care-plan Request

```typescript
{
  dryWeightKg?: number;                           // 20-300 kg

  targetBpSystolic?: {
    min: number;                                  // 70-200
    max: number;                                  // 80-250, must be >= min
  };
  targetBpDiastolic?: {
    min: number;                                  // 40-120
    max: number;                                  // 50-150, must be >= min
  };

  priorHfHospitalizations?: number;               // 0-50
  fluidRetentionRisk?: boolean;
  fallsRisk?: boolean;

  notes?: string;

  _changeReason?: string;                         // Optional audit reason
}
```

### UI Layout - Care Plan Editor

```
┌─────────────────────────────────────────────────────────┐
│ Care Plan for John Smith              [Save] [Cancel]   │
│ Kidney Care Clinic                                      │
├─────────────────────────────────────────────────────────┤
│ CARE PLAN COMPLETENESS: ████████░░ 67%                  │
│ Missing: Dry Weight                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ WEIGHT TARGETS                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Dry Weight:  [____] kg  ([____] lbs)               │ │
│ │                                                    │ │
│ │ ⚠️ Dry weight is required to calculate fluid       │ │
│ │    retention alerts accurately.                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ BLOOD PRESSURE TARGETS                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Systolic:   [110] to [140] mmHg                    │ │
│ │ Diastolic:  [60]  to [90]  mmHg                    │ │
│ │                                                    │ │
│ │ ℹ️ KDIGO recommends <120/80 for most CKD patients  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ RISK FLAGS                                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [x] Fluid Retention Risk                           │ │
│ │     Increases alert sensitivity for weight gain    │ │
│ │                                                    │ │
│ │ [ ] Falls Risk                                     │ │
│ │     Adds BP monitoring considerations              │ │
│ │                                                    │ │
│ │ Prior HF Hospitalizations: [2] in past year        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ CLINICIAN NOTES                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Patient has history of non-compliance with         │ │
│ │ fluid restrictions. Consider more frequent         │ │
│ │ monitoring during summer months.                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View Change History →]                                 │
└─────────────────────────────────────────────────────────┘
```

### Validation Rules

| Field | Validation | Error Message |
|-------|------------|---------------|
| `dryWeightKg` | 20-300 | "dryWeightKg must be between 20 and 300" |
| `targetBpSystolic.min` | 70-200 | "targetBpSystolic.min must be between 70 and 200" |
| `targetBpSystolic.max` | 80-250, >= min | "targetBpSystolic.max must be >= targetBpSystolic.min" |
| `targetBpDiastolic.min` | 40-120 | "targetBpDiastolic.min must be between 40 and 120" |
| `targetBpDiastolic.max` | 50-150, >= min | "targetBpDiastolic.max must be >= targetBpDiastolic.min" |
| `priorHfHospitalizations` | 0-50 | "priorHfHospitalizations must be between 0 and 50" |

### Multi-Clinic Behavior

- Care plans are **per-enrollment** (one per patient-clinician-clinic tuple)
- Same patient can have different care plans at different clinics
- Each clinic sets their own targets based on their protocols
- Profile is shared across clinics; care plan is not

---

## 4. Audit History

### Screen Purpose
Shows chronological history of profile and care plan changes with who made them and what changed.

### API Endpoints

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Patient viewing own history | GET | `/patient/profile/history` | Patient |
| Clinician viewing patient history | GET | `/clinician/patients/:patientId/profile/history` | Clinician |

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max records to return |
| `offset` | number | 0 | Pagination offset |

### Response

```typescript
{
  changes: Array<{
    entityType: "PATIENT_PROFILE" | "CARE_PLAN";
    changedFields: {
      [fieldName: string]: {
        old: any;                                  // Previous value
        new: any;                                  // New value
      };
    };
    actor: {
      type: "PATIENT" | "CLINICIAN" | "SYSTEM";
      name: string;                               // Display name at time of change
    };
    timestamp: string;                            // ISO datetime
    reason: string | null;                        // Optional change reason
  }>;
}
```

### UI Layout - Audit History

```
┌─────────────────────────────────────────────────────────┐
│ Profile Change History                      [← Back]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Jan 5, 2026 at 2:30 PM                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📋 CARE PLAN updated by Dr. Sarah Chen             │ │
│ │                                                    │ │
│ │ • Dry Weight: 75 kg → 74 kg                        │ │
│ │ • Notes: (changed)                                 │ │
│ │                                                    │ │
│ │ Reason: "Adjusted based on latest labs"           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Jan 3, 2026 at 9:15 AM                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 PROFILE updated by John Smith (Patient)         │ │
│ │                                                    │ │
│ │ • Other Conditions: [] → ["Gout"]                  │ │
│ │ • On NSAIDs: No → Yes                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Dec 28, 2025 at 4:45 PM                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📋 PROFILE updated by Dr. Sarah Chen               │ │
│ │                                                    │ │
│ │ • CKD Stage (Verified): null → Stage 3b            │ │
│ │ • Heart Failure Class: null → Class II             │ │
│ │                                                    │ │
│ │ Reason: "Initial assessment completed"             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Load More]                                             │
└─────────────────────────────────────────────────────────┘
```

### Change Display Formatting

| Field Type | Display Format |
|------------|----------------|
| Enum fields | Show label, not raw value (e.g., "Stage 3b" not "STAGE_3B") |
| Boolean fields | "Yes" / "No" |
| Date fields | Localized date format |
| Array fields | JSON-style display or comma-separated |
| Null → value | "Not set" → value |
| Value → null | value → "Removed" |

### Entity Type Icons

| Entity Type | Icon | Color |
|-------------|------|-------|
| PATIENT_PROFILE | 👤 | Blue |
| CARE_PLAN | 📋 | Green |

### Actor Type Badges

| Actor Type | Display |
|------------|---------|
| PATIENT | "{name} (Patient)" |
| CLINICIAN | "Dr. {name}" or "{name}" |
| SYSTEM | "System" |

---

## 5. Worklist Banners

### Screen Purpose
Alert clinicians to incomplete profiles and care plans that need attention.

### Banner Data Sources

Banners are derived from `completeness` fields in API responses:

| Banner | Condition | Source Field |
|--------|-----------|--------------|
| Profile Banner | `showProfileBanner === true` | `completeness.showProfileBanner` |
| Targets Banner | `showTargetsBanner === true` | `completeness.showTargetsBanner` |

### GET /clinician/patients/:patientId/profile

Returns both banner flags:
```typescript
{
  // ...
  showTargetsBanner: boolean;   // Missing: dry weight or BP targets
  showProfileBanner: boolean;   // Missing: verified CKD stage
}
```

### GET /clinician/patients/:patientId/summary

Comprehensive summary includes:
```typescript
{
  // ...
  banners: {
    showTargetsBanner: boolean;
    showProfileBanner: boolean;
  };
  completeness: {
    profileScore: number;
    carePlanScore: number;
    overallScore: number;
    missingCritical: string[];
  };
}
```

### UI Layout - Patient List with Banners

```
┌─────────────────────────────────────────────────────────┐
│ My Patients                              [Filter] [⚙️]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ John Smith                                    [→]  │ │
│ │ CKD Stage 3b • Enrolled Jan 2, 2026                │ │
│ │ ┌───────────────────────────────────────────────┐  │ │
│ │ │ ⚠️ Set dry weight to enable fluid alerts      │  │ │
│ │ └───────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Mary Johnson                                  [→]  │ │
│ │ CKD Stage 4 • Enrolled Dec 15, 2025                │ │
│ │ ┌───────────────────────────────────────────────┐  │ │
│ │ │ ⚠️ Verify CKD stage for accurate monitoring   │  │ │
│ │ └───────────────────────────────────────────────┘  │ │
│ │ ┌───────────────────────────────────────────────┐  │ │
│ │ │ ⚠️ Set BP targets to personalize alerts       │  │ │
│ │ └───────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Robert Williams                               [→]  │ │
│ │ CKD Stage 3a • Enrolled Nov 8, 2025                │ │
│ │ ✓ Profile complete                                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Banner Content Mapping

| Banner Type | Condition | Message | Action |
|-------------|-----------|---------|--------|
| Targets (dry weight) | `!carePlan?.dryWeightKg` | "Set dry weight to enable fluid alerts" | Navigate to Care Plan |
| Targets (BP) | `!carePlan?.targetBpSystolic` | "Set BP targets to personalize alerts" | Navigate to Care Plan |
| Profile | `!profile?.ckdStageClinician` | "Verify CKD stage for accurate monitoring" | Navigate to Profile |

### Banner Priority

When both banners are shown, display order:
1. Profile banner (CKD stage verification)
2. Targets banner (dry weight / BP targets)

### Banner Dismissal

- Banners are NOT dismissible
- They disappear when the underlying data is completed
- Provides persistent visual reminder until action is taken

---

## 6. Patient Summary (Clinician Dashboard)

### Screen Purpose
One-stop comprehensive view of a patient for clinician review.

### API Endpoint

| Action | Method | Endpoint | Auth |
|--------|--------|----------|------|
| Load summary | GET | `/clinician/patients/:patientId/summary` | Clinician |

### Response

```typescript
{
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;                          // YYYY-MM-DD
  };
  enrollment: {
    id: string;
    clinicId: string;
    clinicName: string;
    isPrimary: boolean;
    enrolledAt: string;
  };
  latestMeasurements: {
    weight: { value: number; unit: string; timestamp: string } | null;
    systolic: { value: number; unit: string; timestamp: string } | null;
    diastolic: { value: number; unit: string; timestamp: string } | null;
    spo2: { value: number; unit: string; timestamp: string } | null;
    heartRate: { value: number; unit: string; timestamp: string } | null;
  };
  measurementSummaries: {
    weight: MeasurementSummary;
    bloodPressure: {
      systolic: MeasurementSummary;
      diastolic: MeasurementSummary;
    };
    spo2: MeasurementSummary;
    heartRate: MeasurementSummary;
  };
  profile: ProfileResponse;                       // See Section 1
  carePlan: CarePlanResponse | null;              // See Section 3
  completeness: {
    profileScore: number;
    carePlanScore: number;
    overallScore: number;                         // Weighted: profile 40% + care plan 60%
    missingCritical: string[];
  };
  banners: {
    showTargetsBanner: boolean;
    showProfileBanner: boolean;
  };
  alerts: {
    openCount: number;
    criticalCount: number;
    latestTriggeredAt: string | null;
  };
  lastActivity: {
    lastCheckinAt: string | null;
    lastMeasurementAt: string | null;
  };
  meta: {
    generatedAt: string;
  };
}
```

### MeasurementSummary Type

```typescript
{
  type: MeasurementType;
  unit: string;
  displayUnit: string;
  count: number;
  latest: { value: number; timestamp: string } | null;
  average: number | null;
  min: number | null;
  max: number | null;
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data";
  range: { from: string; to: string };
  meta: { timezone: string };
}
```

### UI Layout - Patient Summary Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ John Smith                        [← Back to Patients]  │
│ DOB: 1965-03-15 (60y) • Kidney Care Clinic              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────┐ ┌─────────────────────────────┐ │
│ │ ⚠️ 3 OPEN ALERTS     │ │ COMPLETENESS               │ │
│ │ 1 critical          │ │ ████████████████░░ 83%     │ │
│ │ [View Alerts →]     │ │ Missing: Verified CKD      │ │
│ └─────────────────────┘ └─────────────────────────────┘ │
│                                                         │
│ LATEST MEASUREMENTS                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Weight     │ 76.2 kg  │ ↑ gaining  │ 2h ago        │ │
│ │ BP         │ 138/88   │ → stable   │ 2h ago        │ │
│ │ SpO2       │ 96%      │ → stable   │ Yesterday     │ │
│ │ Heart Rate │ 72 bpm   │ → stable   │ 2h ago        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ QUICK ACTIONS                                           │
│ [View Charts] [View Profile] [Edit Care Plan] [Notes]   │
│                                                         │
│ LAST ACTIVITY                                           │
│ Last check-in: Jan 5, 2026 at 2:30 PM                   │
│ Last measurement: Jan 6, 2026 at 8:15 AM                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Enum Reference

### CkdStage
```
STAGE_1, STAGE_2, STAGE_3A, STAGE_3B, STAGE_4, STAGE_5, STAGE_5D, TRANSPLANT, UNKNOWN
```

### DialysisStatus
```
NONE, HEMODIALYSIS, PERITONEAL_DIALYSIS
```

### TransplantStatus
```
NONE, LISTED, RECEIVED
```

### DiabetesType
```
NONE, TYPE_1, TYPE_2
```

### NyhaClass
```
CLASS_1, CLASS_2, CLASS_3, CLASS_4
```

### KidneyDiseaseEtiology
```
DIABETES, HYPERTENSION, GLOMERULONEPHRITIS, POLYCYSTIC, OBSTRUCTIVE, OTHER, UNKNOWN
```

### Sex
```
MALE, FEMALE, OTHER, UNSPECIFIED
```

---

## Error Responses

All endpoints return consistent error format:

```typescript
{
  error: string;                                  // Human-readable message
  details?: Array<{                              // Validation errors (optional)
    path: string[];
    message: string;
  }>;
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Validation error | Invalid field value |
| 401 | Unauthorized | Missing/invalid JWT |
| 403 | Forbidden | Wrong role or not enrolled |
| 404 | Not found | Patient not found or not enrolled |
| 500 | Server error | Unexpected error |

---

## RPM/CCM Compliance Note

All clinician endpoints that access patient data automatically log interactions:

```typescript
// Logged on every GET /clinician/patients/:patientId/* call
{
  patientId: string;
  clinicianId: string;
  interactionType: "CLINICIAN_VIEW";
  metadata: {
    endpoint: string;
    // ... additional context
  };
}
```

This supports RPM/CCM billing documentation requirements.
