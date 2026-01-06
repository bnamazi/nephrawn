'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { DashboardResponse, SymptomCheckin, CheckinsResponse } from '@/lib/types';
import MetricCard, { BloodPressureCard } from '@/components/MetricCard';
import Card from '@/components/ui/Card';
import SymptomBadge, { SYMPTOM_DISPLAY_NAMES } from '@/components/SymptomBadge';

export default function PatientOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [latestCheckin, setLatestCheckin] = useState<SymptomCheckin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashboardRes, checkinsRes] = await Promise.all([
        api.get<DashboardResponse>(`/clinician/patients/${patientId}/dashboard`),
        api.get<CheckinsResponse>(`/clinician/patients/${patientId}/checkins?limit=1`),
      ]);
      setDashboard(dashboardRes);
      setLatestCheckin(checkinsRes.checkins[0] || null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, router, fetchData]);

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
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
          <span className="text-gray-500">Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
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
          <button
            onClick={fetchData}
            className="text-blue-600 hover:text-blue-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const data = dashboard?.dashboard;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Health Metrics</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          title="Weight"
          summary={data?.weight || null}
          unit="lbs"
          formatValue={(v) => v.toFixed(1)}
          iconColor="blue"
          onClick={() => router.push(`/patients/${patientId}/measurements?metric=WEIGHT`)}
        />

        <BloodPressureCard
          systolic={data?.bloodPressure?.systolic || null}
          diastolic={data?.bloodPressure?.diastolic || null}
          onClick={() => router.push(`/patients/${patientId}/measurements?metric=blood-pressure`)}
        />

        <MetricCard
          title="SpO2"
          summary={data?.spo2 || null}
          unit="%"
          formatValue={(v) => Math.round(v).toString()}
          iconColor="purple"
          onClick={() => router.push(`/patients/${patientId}/measurements?metric=SPO2`)}
        />

        <MetricCard
          title="Heart Rate"
          summary={data?.heartRate || null}
          unit="bpm"
          formatValue={(v) => Math.round(v).toString()}
          iconColor="orange"
          onClick={() => router.push(`/patients/${patientId}/measurements?metric=HEART_RATE`)}
        />
      </div>

      {/* Latest Symptoms */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4 mt-8">Latest Symptoms</h2>
      <Card
        padding="md"
        hover
        onClick={() => router.push(`/patients/${patientId}/symptoms`)}
        className="cursor-pointer"
      >
        {latestCheckin ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {new Date(latestCheckin.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-xs text-blue-600">View all &rarr;</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {latestCheckin.symptoms.edema && (
                <SymptomBadge
                  name={SYMPTOM_DISPLAY_NAMES.edema}
                  severity={latestCheckin.symptoms.edema.severity}
                  extra={latestCheckin.symptoms.edema.location}
                />
              )}
              {latestCheckin.symptoms.fatigue && (
                <SymptomBadge
                  name={SYMPTOM_DISPLAY_NAMES.fatigue}
                  severity={latestCheckin.symptoms.fatigue.severity}
                />
              )}
              {latestCheckin.symptoms.shortnessOfBreath && (
                <SymptomBadge
                  name={SYMPTOM_DISPLAY_NAMES.shortnessOfBreath}
                  severity={latestCheckin.symptoms.shortnessOfBreath.severity}
                  extra={latestCheckin.symptoms.shortnessOfBreath.atRest ? 'at rest' : undefined}
                />
              )}
              {latestCheckin.symptoms.nausea && (
                <SymptomBadge
                  name={SYMPTOM_DISPLAY_NAMES.nausea}
                  severity={latestCheckin.symptoms.nausea.severity}
                />
              )}
              {latestCheckin.symptoms.appetite && (
                <SymptomBadge
                  name={SYMPTOM_DISPLAY_NAMES.appetite}
                  severity={latestCheckin.symptoms.appetite.level}
                  isAppetite
                />
              )}
              {latestCheckin.symptoms.pain && (
                <SymptomBadge
                  name={SYMPTOM_DISPLAY_NAMES.pain}
                  severity={latestCheckin.symptoms.pain.severity}
                  extra={latestCheckin.symptoms.pain.location}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">No symptom check-ins yet</p>
            <p className="text-xs text-gray-400 mt-1">Click to view symptoms page</p>
          </div>
        )}
      </Card>

      {data?.meta && (
        <p className="text-xs text-gray-400 mt-6 text-center">
          Last updated: {new Date(data.meta.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
