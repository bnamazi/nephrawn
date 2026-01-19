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
  latest: { value: number; timestamp: string; source: string } | null;
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
  source: string;
}

export interface BloodPressureChartPoint {
  timestamp: string;
  systolic: number;
  diastolic: number;
  source: string;
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

// Device types
export type DeviceVendor = 'WITHINGS';
export type DeviceStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR';

export interface DeviceConnection {
  id: string;
  vendor: DeviceVendor;
  status: DeviceStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface DeviceTypeInfo {
  id: string;
  name: string;
  connected: boolean;
  source: string | null;
  lastSync: string | null;
}

export interface PatientDevicesResponse {
  devices: DeviceConnection[];
  deviceTypes: DeviceTypeInfo[];
}

// Source display helpers
export const SOURCE_LABELS: Record<string, string> = {
  'manual': 'Manual',
  'withings': 'Withings',
};

export function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] || source;
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

// ============================================
// Lab Result Types
// ============================================

export type LabSource = 'MANUAL_PATIENT' | 'MANUAL_CLINICIAN' | 'IMPORTED';
export type LabResultFlag = 'H' | 'L' | 'C';

export interface LabResult {
  id: string;
  analyteName: string;
  analyteCode: string | null;
  value: number;
  unit: string;
  referenceRangeLow: number | null;
  referenceRangeHigh: number | null;
  flag: LabResultFlag | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabReport {
  id: string;
  patientId: string;
  documentId: string | null;
  collectedAt: string;
  reportedAt: string | null;
  labName: string | null;
  orderingProvider: string | null;
  notes: string | null;
  source: LabSource;
  verifiedAt: string | null;
  verifiedById: string | null;
  verifiedBy: { id: string; name: string } | null;
  results: LabResult[];
  document: { id: string; filename: string; storageKey: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabReportsResponse {
  labReports: LabReport[];
}

export interface LabReportResponse {
  labReport: LabReport;
}

export const LAB_SOURCE_LABELS: Record<LabSource, string> = {
  MANUAL_PATIENT: 'Entered by Patient',
  MANUAL_CLINICIAN: 'Entered by Clinician',
  IMPORTED: 'Imported',
};

export const LAB_FLAG_LABELS: Record<LabResultFlag, string> = {
  H: 'High',
  L: 'Low',
  C: 'Critical',
};

// Common CKD analytes for quick-pick
export const CKD_ANALYTES = [
  { name: 'Creatinine', unit: 'mg/dL', code: '2160-0' },
  { name: 'eGFR', unit: 'mL/min/1.73m2', code: '33914-3' },
  { name: 'BUN', unit: 'mg/dL', code: '3094-0' },
  { name: 'Potassium', unit: 'mEq/L', code: '2823-3' },
  { name: 'Sodium', unit: 'mEq/L', code: '2951-2' },
  { name: 'CO2/Bicarbonate', unit: 'mEq/L', code: '1963-8' },
  { name: 'Albumin', unit: 'g/dL', code: '1751-7' },
  { name: 'Hemoglobin', unit: 'g/dL', code: '718-7' },
  { name: 'Phosphorus', unit: 'mg/dL', code: '2777-1' },
  { name: 'Calcium', unit: 'mg/dL', code: '17861-6' },
  { name: 'PTH', unit: 'pg/mL', code: '2731-8' },
  { name: 'ACR', unit: 'mg/g', code: '13705-9' },
] as const;

// ============================================
// Time Entry Types (Billing)
// ============================================

export type TimeEntryActivity =
  | 'PATIENT_REVIEW'
  | 'CARE_PLAN_UPDATE'
  | 'PHONE_CALL'
  | 'COORDINATION'
  | 'DOCUMENTATION'
  | 'OTHER';

export interface TimeEntry {
  id: string;
  patientId: string;
  clinicianId: string;
  clinicId: string;
  entryDate: string;
  durationMinutes: number;
  activity: TimeEntryActivity;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  clinician: { id: string; name: string };
}

export interface TimeEntriesResponse {
  timeEntries: TimeEntry[];
}

export interface TimeEntryResponse {
  timeEntry: TimeEntry;
}

export interface TimeEntrySummary {
  totalMinutes: number;
  entryCount: number;
  byActivity: Record<TimeEntryActivity, number>;
  byClinician: Record<string, number>;
  period: { from: string; to: string };
}

export interface TimeEntrySummaryResponse {
  summary: TimeEntrySummary;
}

export const TIME_ENTRY_ACTIVITY_LABELS: Record<TimeEntryActivity, string> = {
  PATIENT_REVIEW: 'Patient Review',
  CARE_PLAN_UPDATE: 'Care Plan Update',
  PHONE_CALL: 'Phone Call',
  COORDINATION: 'Care Coordination',
  DOCUMENTATION: 'Documentation',
  OTHER: 'Other',
};
