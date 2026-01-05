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
