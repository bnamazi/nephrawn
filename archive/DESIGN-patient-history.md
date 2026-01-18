# Patient History Design Document

## Overview

Patient History provides the clinical context required to interpret measurements, symptoms, and alerts safely. Without it, Nephrawn alerts are generic population-based notifications rather than patient-specific clinical signals.

**Core Principle**: Store what's needed to *interpret* monitoring data safely, not what's needed to *treat* the patient. Treatment decisions happen in the clinical encounter with full EHR access.

---

## Key Design Decisions

### Two-Table Architecture

Patient clinical context is split into two distinct entities:

1. **PatientProfile** - Baseline facts about the patient that are true regardless of which clinic is viewing them (demographics, disease status, comorbidities, medications)

2. **CarePlan** - Per-enrollment clinical targets and workflow settings that may differ across clinics/clinicians (dry weight, BP targets, risk flags)

**Rationale**: A patient enrolled at both a nephrology clinic and a cardiology clinic may have different target BP ranges set by each specialist. Their CKD stage is a fact; their targets are care decisions.

### Dual CKD Stage Tracking

CKD stage is captured from two sources:
- `ckdStageSelfReported` - What the patient reports (may be outdated or incorrect)
- `ckdStageClinician` - Set by a clinician (authoritative)

**Rationale**: Downstream logic can safely choose sources. Self-reported enables onboarding; clinician-set is authoritative for alerts.

---

## 1. Patient History MVP Scope

### PatientProfile (Baseline Facts)

#### Demographics

| Field | Type | Editable By | Rationale |
|-------|------|-------------|-----------|
| sex | enum | Patient | Affects body composition |
| heightCm | decimal | Patient | Required for BMI |

#### CKD Context

| Field | Type | Editable By | Rationale |
|-------|------|-------------|-----------|
| ckdStageSelfReported | enum | Patient | Patient's understanding |
| ckdStageClinician | enum | Clinician | Authoritative clinical assessment |
| ckdStageSetById | uuid | System | Clinician who set ckdStageClinician |
| ckdStageSetAt | timestamp | System | When clinician stage was set |
| primaryEtiology | enum | Both | Cause of kidney disease |
| dialysisStatus | enum | Both | Current dialysis modality |
| dialysisStartDate | date | Both | When dialysis began |
| transplantStatus | enum | Both | Transplant history |
| transplantDate | date | Both | Date of transplant |

#### Comorbidities

| Field | Type | Editable By | Rationale |
|-------|------|-------------|-----------|
| hasHeartFailure | boolean | Both | Affects fluid management |
| heartFailureClass | enum | Clinician | NYHA class requires assessment |
| diabetesType | enum | Both | Affects CKD progression |
| hasHypertension | boolean | Both | Context for BP readings |
| otherConditions | JSONB | Both | Flexible array |

#### Medication Context (Categories Only)

| Field | Type | Editable By | Rationale |
|-------|------|-------------|-----------|
| onDiuretics | boolean | Both | Affects expected weight patterns |
| onAceArbInhibitor | boolean | Both | Affects BP, hyperkalemia risk |
| onSglt2Inhibitor | boolean | Both | Cardio/renal protection, affects volume |
| onNsaids | boolean | Both | Nephrotoxic, affects volume |
| onMra | boolean | Both | Mineralocorticoid receptor antagonist |
| onInsulin | boolean | Both | Diabetes management |
| medicationNotes | text | Clinician | Free text context |

### CarePlan (Per-Enrollment Settings)

| Field | Type | Editable By | Rationale |
|-------|------|-------------|-----------|
| enrollmentId | uuid | FK | Links to specific enrollment |
| dryWeightKg | decimal | Clinician | Target weight for fluid management |
| targetBpSystolic | JSONB | Clinician | { min: 110, max: 140 } |
| targetBpDiastolic | JSONB | Clinician | { min: 60, max: 90 } |
| priorHfHospitalizations | int | Clinician | Count in past 12 months |
| fluidRetentionRisk | boolean | Clinician | Known tendency |
| fallsRisk | boolean | Clinician | Affects BP recommendations |
| notes | text | Clinician | Care plan notes |

### Explicitly Excluded from MVP

| Excluded | Reason |
|----------|--------|
| Lab values | Deferred to MVP+ |
| Full medication list | Reconciliation complexity |
| Dialysis schedule details | Complex; future enhancement |
| Surgical history | Not needed for monitoring |
| Social determinants | Not for alert interpretation |

---

## 2. Data Ownership & Source of Truth

### What Lives Where

| Data | Entity | Notes |
|------|--------|-------|
| CKD stage (patient view) | PatientProfile | Self-reported |
| CKD stage (clinical) | PatientProfile | Clinician-set, authoritative |
| Dry weight | CarePlan | Per-enrollment, may differ |
| BP targets | CarePlan | Per-enrollment, may differ |
| Comorbidities | PatientProfile | Patient-level facts |
| Risk flags | CarePlan | Per-enrollment assessment |

### Multi-Clinic Scenarios

```
Patient: John Smith (CKD Stage 4, Diabetes)
├── PatientProfile (one record)
│   ├── ckdStageSelfReported: STAGE_4
│   ├── ckdStageClinician: STAGE_4 (set by Dr. Nephro)
│   ├── diabetesType: TYPE_2
│   └── hasHeartFailure: true
│
├── Enrollment: Metro Nephrology → CarePlan
│   ├── dryWeightKg: 82.0
│   ├── targetBpSystolic: { min: 120, max: 140 }
│   └── fluidRetentionRisk: true
│
└── Enrollment: City Cardiology → CarePlan
    ├── dryWeightKg: 80.0  (more aggressive target)
    ├── targetBpSystolic: { min: 110, max: 130 }
    └── fallsRisk: true
```

### Source Priority for Alerts

```typescript
function getCkdStage(profile: PatientProfile): CkdStage | null {
  // Clinician-set is authoritative
  if (profile.ckdStageClinician) return profile.ckdStageClinician;
  // Fall back to self-reported with lower confidence
  return profile.ckdStageSelfReported;
}

function getDryWeight(carePlan: CarePlan | null): number | null {
  // CarePlan is per-enrollment; may be null
  return carePlan?.dryWeightKg ?? null;
}
```

---

## 3. Schema Design

### PatientProfile

```prisma
model PatientProfile {
  id        String   @id @default(uuid())
  patientId String   @unique
  patient   Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  // Demographics
  sex      Sex?
  heightCm Decimal? @db.Decimal(5, 1)

  // CKD Context - Dual source
  ckdStageSelfReported CkdStage?
  ckdStageClinician    CkdStage?
  ckdStageSetById      String?    // Clinician who set it
  ckdStageSetAt        DateTime?

  primaryEtiology  KidneyDiseaseEtiology?
  dialysisStatus   DialysisStatus         @default(NONE)
  dialysisStartDate DateTime?             @db.Date
  transplantStatus TransplantStatus       @default(NONE)
  transplantDate   DateTime?              @db.Date

  // Comorbidities
  hasHeartFailure   Boolean    @default(false)
  heartFailureClass NyhaClass?
  diabetesType      DiabetesType @default(NONE)
  hasHypertension   Boolean    @default(false)
  otherConditions   Json?      // string[]

  // Medication Context (categories only)
  onDiuretics       Boolean @default(false)
  onAceArbInhibitor Boolean @default(false)
  onSglt2Inhibitor  Boolean @default(false)
  onNsaids          Boolean @default(false)
  onMra             Boolean @default(false)
  onInsulin         Boolean @default(false)
  medicationNotes   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("patient_profiles")
}

// Enums
enum Sex {
  MALE
  FEMALE
  OTHER
  UNKNOWN
}

enum CkdStage {
  STAGE_1
  STAGE_2
  STAGE_3A
  STAGE_3B
  STAGE_4
  STAGE_5
  STAGE_5D      // on dialysis
  TRANSPLANT
  UNKNOWN
}

enum KidneyDiseaseEtiology {
  DIABETES
  HYPERTENSION
  GLOMERULONEPHRITIS
  POLYCYSTIC
  OBSTRUCTIVE
  OTHER
  UNKNOWN
}

enum DialysisStatus {
  NONE
  HEMODIALYSIS
  PERITONEAL_DIALYSIS
}

enum TransplantStatus {
  NONE
  PRIOR
  CURRENT
}

enum NyhaClass {
  CLASS_1
  CLASS_2
  CLASS_3
  CLASS_4
}

enum DiabetesType {
  NONE
  TYPE_1
  TYPE_2
}
```

### CarePlan (Per-Enrollment)

```prisma
model CarePlan {
  id           String     @id @default(uuid())
  enrollmentId String     @unique
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  // Weight Target
  dryWeightKg Decimal? @db.Decimal(5, 2)

  // BP Targets (structured ranges)
  targetBpSystolic  Json?  // { min: number, max: number }
  targetBpDiastolic Json?  // { min: number, max: number }

  // Risk Assessment
  priorHfHospitalizations Int?    @default(0)
  fluidRetentionRisk      Boolean @default(false)
  fallsRisk               Boolean @default(false)

  // Notes
  notes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("care_plans")
}
```

### Audit Table

```prisma
model PatientProfileAudit {
  id        String   @id @default(uuid())

  // What was changed
  entityType  AuditEntityType  // PATIENT_PROFILE or CARE_PLAN
  entityId    String           // profile.id or carePlan.id
  patientId   String           // For easy querying

  // Who changed it
  actorType   ActorType
  actorId     String           // patient.id or clinician.id
  actorName   String           // Denormalized for display

  // What changed
  changedFields Json           // { fieldName: { old: value, new: value } }
  reason        String?        // Optional explanation

  timestamp DateTime @default(now())

  @@index([patientId, timestamp])
  @@index([entityType, entityId, timestamp])
  @@index([actorId, actorType])
  @@map("patient_profile_audits")
}

enum AuditEntityType {
  PATIENT_PROFILE
  CARE_PLAN
}

enum ActorType {
  PATIENT
  CLINICIAN
  SYSTEM
}
```

### Schema Relationships

```
Patient ─────────────── PatientProfile (1:1)
    │
    └── Enrollment ──── CarePlan (1:1)
           │
           └── Clinic
```

---

## 4. API Design

### Patient Endpoints

#### GET /patient/profile

```typescript
Response: {
  profile: PatientProfileResponse | null;
  completeness: {
    score: number;           // 0-100
    missingCritical: string[];
    missingRecommended: string[];
  };
}
```

#### PUT /patient/profile

Patient-editable fields only:
```typescript
Request: {
  sex?: Sex;
  heightCm?: number;
  ckdStageSelfReported?: CkdStage;
  primaryEtiology?: KidneyDiseaseEtiology;
  dialysisStatus?: DialysisStatus;
  dialysisStartDate?: string;
  transplantStatus?: TransplantStatus;
  transplantDate?: string;
  hasHeartFailure?: boolean;
  diabetesType?: DiabetesType;
  hasHypertension?: boolean;
  otherConditions?: string[];
  onDiuretics?: boolean;
  onAceArbInhibitor?: boolean;
  onSglt2Inhibitor?: boolean;
  onNsaids?: boolean;
  onMra?: boolean;
  onInsulin?: boolean;
}
```

### Clinician Endpoints

#### GET /clinician/patients/:patientId/profile

Returns profile + care plan for this enrollment.

```typescript
Response: {
  profile: PatientProfileResponse | null;
  carePlan: CarePlanResponse | null;
  completeness: {
    profileScore: number;
    carePlanScore: number;
    missingCritical: string[];
  };
  // UI hint
  showTargetsBanner: boolean; // true if dryWeight or BP targets missing
}
```

#### PUT /clinician/patients/:patientId/profile

All profile fields + clinician-only fields:
```typescript
Request: {
  // All patient fields plus:
  ckdStageClinician?: CkdStage;
  heartFailureClass?: NyhaClass;
  medicationNotes?: string;

  _changeReason?: string;  // Optional audit note
}
```

#### GET /clinician/patients/:patientId/care-plan

```typescript
Response: {
  carePlan: CarePlanResponse | null;
  enrollment: { id: string; clinicName: string };
}
```

#### PUT /clinician/patients/:patientId/care-plan

```typescript
Request: {
  dryWeightKg?: number;
  targetBpSystolic?: { min: number; max: number };
  targetBpDiastolic?: { min: number; max: number };
  priorHfHospitalizations?: number;
  fluidRetentionRisk?: boolean;
  fallsRisk?: boolean;
  notes?: string;

  _changeReason?: string;
}
```

#### GET /clinician/patients/:patientId/profile/history

```typescript
Response: {
  changes: Array<{
    entityType: 'PATIENT_PROFILE' | 'CARE_PLAN';
    changedFields: Record<string, { old: any; new: any }>;
    actor: { type: 'PATIENT' | 'CLINICIAN'; name: string };
    timestamp: string;
    reason?: string;
  }>;
}
```

### Validation Rules

```typescript
const VALIDATION = {
  heightCm: { min: 50, max: 300 },
  dryWeightKg: { min: 20, max: 300 },
  targetBpSystolic: { min: { min: 70, max: 200 }, max: { min: 80, max: 250 } },
  targetBpDiastolic: { min: { min: 40, max: 120 }, max: { min: 50, max: 150 } },
  priorHfHospitalizations: { min: 0, max: 50 },
  otherConditions: { maxItems: 20, maxLength: 100 },
};
```

---

## 5. UI Contracts

### PatientProfileResponse

```typescript
interface PatientProfileResponse {
  // Demographics
  sex: Sex | null;
  heightCm: number | null;
  heightDisplay: string | null;  // "5'10\""

  // CKD Context
  ckdStageSelfReported: CkdStage | null;
  ckdStageClinician: CkdStage | null;
  ckdStageEffective: CkdStage | null;        // Resolved: clinician > self
  ckdStageEffectiveLabel: string;            // "Stage 4" or "Unknown"
  ckdStageSource: 'clinician' | 'self_reported' | null;

  primaryEtiology: KidneyDiseaseEtiology | null;
  primaryEtiologyLabel: string | null;
  dialysisStatus: DialysisStatus;
  dialysisStatusLabel: string;
  dialysisStartDate: string | null;
  transplantStatus: TransplantStatus;
  transplantDate: string | null;

  // Comorbidities
  hasHeartFailure: boolean;
  heartFailureClass: NyhaClass | null;
  heartFailureLabel: string | null;
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
  medicationNotes: string | null;
}
```

### CarePlanResponse

```typescript
interface CarePlanResponse {
  id: string;
  enrollmentId: string;

  dryWeightKg: number | null;
  dryWeightLbs: number | null;  // Computed

  targetBpSystolic: { min: number; max: number } | null;
  targetBpDiastolic: { min: number; max: number } | null;

  priorHfHospitalizations: number;
  fluidRetentionRisk: boolean;
  fallsRisk: boolean;

  notes: string | null;

  updatedAt: string;
}
```

### Completeness & Banners

```typescript
interface Completeness {
  profileScore: number;      // 0-100
  carePlanScore: number;     // 0-100

  missingCritical: string[]; // e.g., ['ckdStage', 'dialysisStatus']
  missingRecommended: string[];

  // UI hints
  showTargetsBanner: boolean;    // "Set dry weight and BP targets"
  showProfileBanner: boolean;    // "Complete patient profile"
}

// Critical fields (affect safety)
const CRITICAL_PROFILE_FIELDS = ['ckdStageClinician', 'dialysisStatus'];
const CRITICAL_CAREPLAN_FIELDS = ['dryWeightKg'];
```

### Banner Contract

When `showTargetsBanner: true`, clinician UI displays:

```
┌────────────────────────────────────────────────────────────┐
│ ⚠️ Clinical targets not set                                │
│ Set dry weight and BP targets for personalized alerting.  │
│                                        [Set Targets →]    │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Clinical Safety & Alert Interaction

### MVP Rule: Informational Only

Alerts continue to use **population thresholds**. History provides context, not threshold overrides.

```typescript
// Current alert behavior (unchanged)
const POPULATION_THRESHOLDS = {
  weightGain48h: 1.36,     // kg
  bpSystolicHigh: 180,     // mmHg
  bpSystolicLow: 90,
  spo2Low: 92,
};

// History adds context to alert.inputs
async function enrichAlertWithContext(
  alert: Alert,
  profile: PatientProfile | null,
  carePlan: CarePlan | null
): Promise<void> {
  const context: Record<string, unknown> = {};

  if (profile) {
    context.ckdStage = profile.ckdStageClinician ?? profile.ckdStageSelfReported;
    context.ckdStageSource = profile.ckdStageClinician ? 'clinician' : 'self_reported';
    context.dialysisStatus = profile.dialysisStatus;
    context.hasHeartFailure = profile.hasHeartFailure;
  }

  if (carePlan) {
    context.dryWeightKg = carePlan.dryWeightKg;
    context.targetBpSystolic = carePlan.targetBpSystolic;

    // Add deviation from target
    if (alert.ruleId === 'weight_gain_48h' && carePlan.dryWeightKg) {
      const currentWeight = (alert.inputs as any).newestValue;
      context.deviationFromDry = currentWeight - Number(carePlan.dryWeightKg);
    }
  }

  context.contextComplete = !!(profile?.ckdStageClinician && carePlan?.dryWeightKg);

  // Merge into alert inputs
  await prisma.alert.update({
    where: { id: alert.id },
    data: {
      inputs: { ...(alert.inputs as object), _context: context }
    }
  });
}
```

### Alert Display with Context

```typescript
// Alert card shows context when available
{
  ruleName: "Rapid Weight Gain",
  severity: "WARNING",
  inputs: {
    delta: 2.1,
    newestValue: 84.5,
    // Added context:
    _context: {
      ckdStage: "STAGE_4",
      ckdStageSource: "clinician",
      dialysisStatus: "NONE",
      dryWeightKg: 82.0,
      deviationFromDry: 2.5,
      hasHeartFailure: true,
      contextComplete: true
    }
  }
}
```

### Missing Context Warnings

When `_context.contextComplete === false`:
```
⚠️ Limited clinical context
This alert uses population thresholds. Set patient profile and care plan for personalized interpretation.
```

---

## 7. Acceptance Criteria

### Backend

- [ ] PatientProfile table with all fields including dual CKD stage
- [ ] CarePlan table linked to Enrollment
- [ ] PatientProfileAudit with proper structure
- [ ] All enums created
- [ ] Patient can view/edit allowed profile fields
- [ ] Clinician can view/edit full profile + care plan
- [ ] Clinic boundary enforced (enrollment required)
- [ ] Audit log captures all changes with proper payload
- [ ] Completeness scores calculated
- [ ] `showTargetsBanner` flag returned correctly

### Clinical Safety

- [ ] Alerts work with null profile/care plan
- [ ] Alert inputs include `_context` when available
- [ ] `contextComplete` flag accurate
- [ ] Clinician CKD stage takes precedence over self-reported

### Tests

- [ ] Profile CRUD operations
- [ ] Care plan CRUD operations
- [ ] Field-level permission enforcement
- [ ] Audit log creation
- [ ] Completeness calculation
- [ ] Cross-clinic isolation

---

## 8. Implementation Order

1. **Prisma schema** - Add all models and enums
2. **Migration** - Run `prisma migrate dev`
3. **profile.service.ts** - Profile CRUD + audit
4. **careplan.service.ts** - CarePlan CRUD + audit
5. **Patient routes** - GET/PUT /patient/profile
6. **Clinician routes** - GET/PUT profile and care plan
7. **Alert enrichment** - Add `_context` to alert inputs
8. **Tests** - Integration tests
9. **Seed script** - Demo profiles and care plans
10. **Documentation** - Update DB.md and ARCH.md

---

## Appendix: Display Labels

### CKD Stage

| Value | Label |
|-------|-------|
| STAGE_1 | Stage 1 (GFR ≥90) |
| STAGE_2 | Stage 2 (GFR 60-89) |
| STAGE_3A | Stage 3a (GFR 45-59) |
| STAGE_3B | Stage 3b (GFR 30-44) |
| STAGE_4 | Stage 4 (GFR 15-29) |
| STAGE_5 | Stage 5 (GFR <15) |
| STAGE_5D | Stage 5D (on dialysis) |
| TRANSPLANT | Kidney Transplant |
| UNKNOWN | Unknown |

### Dialysis Status

| Value | Label |
|-------|-------|
| NONE | Not on dialysis |
| HEMODIALYSIS | Hemodialysis |
| PERITONEAL_DIALYSIS | Peritoneal Dialysis |

### NYHA Class

| Value | Label |
|-------|-------|
| CLASS_1 | Class I - No limitation |
| CLASS_2 | Class II - Slight limitation |
| CLASS_3 | Class III - Marked limitation |
| CLASS_4 | Class IV - Severe limitation |

### Medication Categories

| Field | Label | Clinical Relevance |
|-------|-------|-------------------|
| onDiuretics | Diuretics | Affects weight/volume |
| onAceArbInhibitor | ACE/ARB | BP, hyperkalemia |
| onSglt2Inhibitor | SGLT2 Inhibitor | Volume, renal protection |
| onNsaids | NSAIDs | Nephrotoxic |
| onMra | MRA | Hyperkalemia, HF |
| onInsulin | Insulin | Diabetes management |
