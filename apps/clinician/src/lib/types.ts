// Clinic types
export type ClinicMembershipRole = 'OWNER' | 'ADMIN' | 'CLINICIAN' | 'STAFF';

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  role: ClinicMembershipRole;
  joinedAt: string;
}

export interface ClinicsResponse {
  clinics: Clinic[];
}

// Patient types
export interface Patient {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  preferences?: Record<string, unknown>;
}

export interface Enrollment {
  id: string;
  status: 'ACTIVE' | 'DISCHARGED';
  isPrimary: boolean;
  enrolledAt: string;
}

export interface PatientWithEnrollment {
  patient: Patient;
  enrollment: Enrollment;
}

// Dashboard types
export interface MeasurementSummary {
  type: string;
  unit: string;
  displayUnit: string;
  latest: { value: number; timestamp: string } | null;
  stats: { min: number; max: number; avg: number; count: number } | null;
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
}

export interface Dashboard {
  weight: MeasurementSummary;
  bloodPressure: {
    systolic: MeasurementSummary;
    diastolic: MeasurementSummary;
  };
  spo2: MeasurementSummary;
  heartRate: MeasurementSummary;
  meta: { timezone: string; generatedAt: string };
}

export interface DashboardResponse {
  dashboard: Dashboard;
}

// Chart types
export interface ChartPoint {
  timestamp: string;
  value: number;
}

export interface BloodPressureChartPoint {
  timestamp: string;
  systolic: number;
  diastolic: number;
}

export interface ChartData {
  type: string;
  unit: string;
  displayUnit: string;
  points: ChartPoint[];
  range: { from: string; to: string };
  meta: { timezone: string; totalCount: number; returnedCount: number; hasMore: boolean };
}

export interface BloodPressureChartData {
  unit: string;
  points: BloodPressureChartPoint[];
  range: { from: string; to: string };
  meta: {
    timezone: string;
    pairingWindowMs: number;
    pairedCount: number;
    unpairedSystolicCount: number;
    unpairedDiastolicCount: number;
  };
}

export interface ChartResponse {
  data: ChartData | null;
  message?: string;
}

export interface BloodPressureChartResponse {
  data: BloodPressureChartData | null;
  message?: string;
}

// Metric types for display
export type MetricType = 'WEIGHT' | 'blood-pressure' | 'SPO2' | 'HEART_RATE';

export const METRIC_CONFIG: Record<MetricType, { label: string; icon: string; color: string }> = {
  'WEIGHT': { label: 'Weight', icon: 'scale', color: 'blue' },
  'blood-pressure': { label: 'Blood Pressure', icon: 'heart', color: 'red' },
  'SPO2': { label: 'SpO2', icon: 'lungs', color: 'purple' },
  'HEART_RATE': { label: 'Heart Rate', icon: 'activity', color: 'orange' },
};

// Alert types
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'DISMISSED';

export interface Alert {
  id: string;
  patientId: string;
  triggeredAt: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  inputs: Record<string, unknown>;
  summaryText?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  patient: {
    id: string;
    name: string;
    email: string;
  };
  clinician?: {
    id: string;
    name: string;
  };
}

export interface AlertsResponse {
  alerts: Alert[];
}

// Note types
export interface ClinicianNote {
  id: string;
  patientId: string;
  clinicianId: string;
  alertId?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  clinician: {
    id: string;
    name: string;
  };
  alert?: {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: AlertSeverity;
  };
}

export interface NotesResponse {
  notes: ClinicianNote[];
}

export interface NoteResponse {
  note: ClinicianNote;
}

// Symptom check-in types
export interface SymptomData {
  edema?: { severity: number; location?: string };
  fatigue?: { severity: number };
  shortnessOfBreath?: { severity: number; atRest?: boolean };
  nausea?: { severity: number };
  appetite?: { level: number };
  pain?: { severity: number; location?: string };
}

export interface SymptomCheckin {
  id: string;
  patientId: string;
  timestamp: string;
  symptoms: SymptomData;
  notes?: string;
  createdAt: string;
}

export interface CheckinsResponse {
  checkins: SymptomCheckin[];
}

// ============================================
// Profile Types
// ============================================

export type CkdStage =
  | 'STAGE_1' | 'STAGE_2' | 'STAGE_3A' | 'STAGE_3B'
  | 'STAGE_4' | 'STAGE_5' | 'STAGE_5D' | 'TRANSPLANT' | 'UNKNOWN';

export type DialysisStatus = 'NONE' | 'HEMODIALYSIS' | 'PERITONEAL_DIALYSIS';
export type TransplantStatus = 'NONE' | 'LISTED' | 'RECEIVED';
export type DiabetesType = 'NONE' | 'TYPE_1' | 'TYPE_2';
export type NyhaClass = 'CLASS_1' | 'CLASS_2' | 'CLASS_3' | 'CLASS_4';
export type KidneyDiseaseEtiology =
  | 'DIABETES' | 'HYPERTENSION' | 'GLOMERULONEPHRITIS'
  | 'POLYCYSTIC' | 'OBSTRUCTIVE' | 'OTHER' | 'UNKNOWN';
export type Sex = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export interface PatientProfile {
  id: string;
  patientId: string;
  sex: Sex | null;
  heightCm: number | null;
  heightDisplay: string | null;
  ckdStageSelfReported: CkdStage | null;
  ckdStageClinician: CkdStage | null;
  ckdStageEffective: CkdStage | null;
  ckdStageEffectiveLabel: string;
  ckdStageSource: 'clinician' | 'self_reported' | null;
  primaryEtiology: KidneyDiseaseEtiology | null;
  primaryEtiologyLabel: string | null;
  dialysisStatus: DialysisStatus;
  dialysisStatusLabel: string;
  dialysisStartDate: string | null;
  transplantStatus: TransplantStatus;
  transplantDate: string | null;
  hasHeartFailure: boolean;
  heartFailureClass: NyhaClass | null;
  heartFailureLabel: string | null;
  diabetesType: DiabetesType;
  diabetesLabel: string;
  hasHypertension: boolean;
  otherConditions: string[];
  medications: {
    onDiuretics: boolean;
    onAceArbInhibitor: boolean;
    onSglt2Inhibitor: boolean;
    onNsaids: boolean;
    onMra: boolean;
    onInsulin: boolean;
  };
  medicationNotes: string | null;
  updatedAt: string;
}

export interface ProfileCompleteness {
  profileScore: number;
  carePlanScore: number;
  missingCritical: string[];
}

export interface ProfileResponse {
  profile: PatientProfile | null;
  carePlan: CarePlan | null;
  enrollment: {
    id: string;
    clinicId: string;
    clinicName: string;
  } | null;
  completeness: ProfileCompleteness;
  showTargetsBanner: boolean;
  showProfileBanner: boolean;
}

// ============================================
// Care Plan Types
// ============================================

export interface BpRange {
  min: number;
  max: number;
}

export interface CarePlan {
  id: string;
  enrollmentId: string;
  dryWeightKg: number | null;
  dryWeightLbs: number | null;
  targetBpSystolic: BpRange | null;
  targetBpDiastolic: BpRange | null;
  priorHfHospitalizations: number | null;
  fluidRetentionRisk: boolean;
  fallsRisk: boolean;
  notes: string | null;
  updatedAt: string;
}

export interface CarePlanCompleteness {
  carePlanScore: number;
  missingCritical: string[];
  showTargetsBanner: boolean;
}

export interface CarePlanResponse {
  carePlan: CarePlan | null;
  enrollment: {
    id: string;
    clinicId: string;
    clinicName: string;
  };
  completeness: CarePlanCompleteness;
}

// ============================================
// Audit History Types
// ============================================

export interface AuditChange {
  entityType: 'PATIENT_PROFILE' | 'CARE_PLAN';
  changedFields: Record<string, { old: unknown; new: unknown }>;
  actor: {
    type: 'PATIENT' | 'CLINICIAN' | 'SYSTEM';
    name: string;
  };
  timestamp: string;
  reason: string | null;
}

export interface AuditHistoryResponse {
  changes: AuditChange[];
}

// ============================================
// Patient Summary Types
// ============================================

export interface PatientSummary {
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;
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
  profile: PatientProfile | null;
  carePlan: CarePlan | null;
  completeness: {
    profileScore: number;
    carePlanScore: number;
    overallScore: number;
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

// ============================================
// Medication Types
// ============================================

export interface MedicationLog {
  id: string;
  medicationId: string;
  loggedAt: string;
  scheduledFor: string | null;
  taken: boolean;
  notes: string | null;
  createdAt: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  logs?: MedicationLog[];
}

export interface MedicationsResponse {
  medications: Medication[];
}

export interface MedicationAdherenceSummary {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  logsCount: number;
  takenCount: number;
  skippedCount: number;
  lastLog: MedicationLog | null;
}

export interface AdherenceSummary {
  totalMedications: number;
  totalLogs: number;
  takenCount: number;
  skippedCount: number;
  adherenceRate: number;
  days: number;
  medications: MedicationAdherenceSummary[];
}

export interface AdherenceSummaryResponse {
  summary: AdherenceSummary;
}

// ============================================
// Display Labels
// ============================================

export const CKD_STAGE_LABELS: Record<CkdStage, string> = {
  STAGE_1: 'Stage 1 (GFR ≥90)',
  STAGE_2: 'Stage 2 (GFR 60-89)',
  STAGE_3A: 'Stage 3a (GFR 45-59)',
  STAGE_3B: 'Stage 3b (GFR 30-44)',
  STAGE_4: 'Stage 4 (GFR 15-29)',
  STAGE_5: 'Stage 5 (GFR <15)',
  STAGE_5D: 'Stage 5D (Dialysis)',
  TRANSPLANT: 'Transplant',
  UNKNOWN: 'Unknown',
};

export const DIALYSIS_STATUS_LABELS: Record<DialysisStatus, string> = {
  NONE: 'Not on dialysis',
  HEMODIALYSIS: 'Hemodialysis',
  PERITONEAL_DIALYSIS: 'Peritoneal Dialysis',
};

export const TRANSPLANT_STATUS_LABELS: Record<TransplantStatus, string> = {
  NONE: 'None',
  LISTED: 'Listed for transplant',
  RECEIVED: 'Transplant received',
};

export const DIABETES_LABELS: Record<DiabetesType, string> = {
  NONE: 'None',
  TYPE_1: 'Type 1',
  TYPE_2: 'Type 2',
};

export const NYHA_LABELS: Record<NyhaClass, string> = {
  CLASS_1: 'Class I - No limitation',
  CLASS_2: 'Class II - Slight limitation',
  CLASS_3: 'Class III - Marked limitation',
  CLASS_4: 'Class IV - Severe limitation',
};

export const ETIOLOGY_LABELS: Record<KidneyDiseaseEtiology, string> = {
  DIABETES: 'Diabetic Nephropathy',
  HYPERTENSION: 'Hypertensive Nephrosclerosis',
  GLOMERULONEPHRITIS: 'Glomerulonephritis',
  POLYCYSTIC: 'Polycystic Kidney Disease',
  OBSTRUCTIVE: 'Obstructive Uropathy',
  OTHER: 'Other',
  UNKNOWN: 'Unknown',
};

export const SEX_LABELS: Record<Sex, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  UNSPECIFIED: 'Not specified',
};

// ============================================
// Document Types
// ============================================

export type DocumentType = 'LAB_RESULT' | 'OTHER';

export interface PatientDocument {
  id: string;
  patientId: string;
  type: DocumentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  title: string | null;
  notes: string | null;
  documentDate: string | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentsResponse {
  documents: PatientDocument[];
}

export interface DocumentDownloadResponse {
  document: PatientDocument;
  downloadUrl: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  LAB_RESULT: 'Lab Result',
  OTHER: 'Other',
};
