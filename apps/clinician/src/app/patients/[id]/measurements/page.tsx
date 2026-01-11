'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import {
  ChartResponse,
  BloodPressureChartResponse,
  MetricType,
} from '@/lib/types';
import MeasurementChart, { BloodPressureChart } from '@/components/MeasurementChart';
import Button from '@/components/ui/Button';

// Core vitals
const CORE_METRICS: { value: string; label: string }[] = [
  { value: 'WEIGHT', label: 'Weight' },
  { value: 'blood-pressure', label: 'Blood Pressure' },
  { value: 'SPO2', label: 'SpO2' },
  { value: 'HEART_RATE', label: 'Heart Rate' },
];

// Body composition metrics (from smart scale)
const BODY_COMP_METRICS: { value: string; label: string }[] = [
  { value: 'FAT_RATIO', label: 'Body Fat %' },
  { value: 'MUSCLE_MASS', label: 'Muscle Mass' },
  { value: 'FAT_MASS', label: 'Fat Mass' },
  { value: 'FAT_FREE_MASS', label: 'Lean Mass' },
  { value: 'HYDRATION', label: 'Hydration' },
  { value: 'BONE_MASS', label: 'Bone Mass' },
  { value: 'PULSE_WAVE_VELOCITY', label: 'Pulse Wave Velocity' },
];

const DATE_RANGES = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
];

const METRIC_COLORS: Record<string, string> = {
  'WEIGHT': '#3B82F6',
  'blood-pressure': '#EF4444',
  'SPO2': '#8B5CF6',
  'HEART_RATE': '#F97316',
  'FAT_RATIO': '#10B981',
  'MUSCLE_MASS': '#6366F1',
  'FAT_MASS': '#F59E0B',
  'FAT_FREE_MASS': '#14B8A6',
  'HYDRATION': '#06B6D4',
  'BONE_MASS': '#8B5CF6',
  'PULSE_WAVE_VELOCITY': '#EC4899',
};

const METRIC_UNITS: Record<string, string> = {
  'WEIGHT': 'lbs',
  'blood-pressure': 'mmHg',
  'SPO2': '%',
  'HEART_RATE': 'bpm',
  'FAT_RATIO': '%',
  'MUSCLE_MASS': 'kg',
  'FAT_MASS': 'kg',
  'FAT_FREE_MASS': 'kg',
  'HYDRATION': 'kg',
  'BONE_MASS': 'kg',
  'PULSE_WAVE_VELOCITY': 'm/s',
};

export default function MeasurementsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const initialMetric = searchParams.get('metric') || 'WEIGHT';
  const [selectedMetric, setSelectedMetric] = useState<string>(initialMetric);
  const [dateRange, setDateRange] = useState('30');
  const [chartData, setChartData] = useState<ChartResponse | BloodPressureChartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(dateRange));

      const endpoint = `/clinician/patients/${patientId}/charts/${selectedMetric}?from=${from.toISOString()}`;
      const response = await api.get<ChartResponse | BloodPressureChartResponse>(endpoint);
      setChartData(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, selectedMetric, dateRange, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchChartData();
  }, [isAuthenticated, router, fetchChartData]);

  if (!isAuthenticated) {
    return null;
  }

  const isBP = selectedMetric === 'blood-pressure';

  return (
    <div>
      {/* Controls */}
      <div className="space-y-4 mb-6">
        {/* Core Vitals */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Vitals</p>
          <div className="flex flex-wrap gap-2">
            {CORE_METRICS.map((metric) => (
              <Button
                key={metric.value}
                variant={selectedMetric === metric.value ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric(metric.value)}
              >
                {metric.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Body Composition */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Body Composition</p>
          <div className="flex flex-wrap gap-2">
            {BODY_COMP_METRICS.map((metric) => (
              <Button
                key={metric.value}
                variant={selectedMetric === metric.value ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric(metric.value)}
              >
                {metric.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Time Range</p>
          <div className="flex gap-2">
            {DATE_RANGES.map((range) => (
              <Button
                key={range.value}
                variant={dateRange === range.value ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDateRange(range.value)}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-col items-center gap-4">
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-500">Loading chart...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-col items-center gap-4 text-center">
            <svg
              className="h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-gray-600">{error}</p>
            <button onClick={fetchChartData} className="text-blue-600 hover:text-blue-800">
              Try again
            </button>
          </div>
        </div>
      ) : isBP ? (
        <BloodPressureChart
          data={(chartData as BloodPressureChartResponse)?.data?.points || []}
          title="Blood Pressure Over Time"
        />
      ) : (
        <MeasurementChart
          data={(chartData as ChartResponse)?.data?.points || []}
          unit={METRIC_UNITS[selectedMetric] || ''}
          color={METRIC_COLORS[selectedMetric] || '#3B82F6'}
          title={`${[...CORE_METRICS, ...BODY_COMP_METRICS].find((m) => m.value === selectedMetric)?.label || selectedMetric} Over Time`}
        />
      )}

      {/* Stats summary */}
      {chartData?.data && !isLoading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Data Points</p>
            <p className="text-xl font-semibold text-gray-900">
              {isBP
                ? (chartData as BloodPressureChartResponse).data?.points.length || 0
                : (chartData as ChartResponse).data?.points.length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Date Range</p>
            <p className="text-xl font-semibold text-gray-900">
              {dateRange} days
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Metric</p>
            <p className="text-xl font-semibold text-gray-900">
              {[...CORE_METRICS, ...BODY_COMP_METRICS].find((m) => m.value === selectedMetric)?.label}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
