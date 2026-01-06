'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { SymptomCheckin, CheckinsResponse, SymptomData } from '@/lib/types';
import Card from '@/components/ui/Card';
import SymptomBadge, { SYMPTOM_DISPLAY_NAMES } from '@/components/SymptomBadge';

export default function SymptomsPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [checkins, setCheckins] = useState<SymptomCheckin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<CheckinsResponse>(
        `/clinician/patients/${patientId}/checkins?limit=50`
      );
      setCheckins(response.checkins);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load symptoms');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchCheckins();
  }, [isAuthenticated, router, fetchCheckins]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderSymptomBadges = (symptoms: SymptomData) => {
    const badges: React.ReactElement[] = [];

    if (symptoms.edema) {
      badges.push(
        <SymptomBadge
          key="edema"
          name={SYMPTOM_DISPLAY_NAMES.edema}
          severity={symptoms.edema.severity}
          extra={symptoms.edema.location}
        />
      );
    }

    if (symptoms.fatigue) {
      badges.push(
        <SymptomBadge
          key="fatigue"
          name={SYMPTOM_DISPLAY_NAMES.fatigue}
          severity={symptoms.fatigue.severity}
        />
      );
    }

    if (symptoms.shortnessOfBreath) {
      badges.push(
        <SymptomBadge
          key="sob"
          name={SYMPTOM_DISPLAY_NAMES.shortnessOfBreath}
          severity={symptoms.shortnessOfBreath.severity}
          extra={symptoms.shortnessOfBreath.atRest ? 'at rest' : undefined}
        />
      );
    }

    if (symptoms.nausea) {
      badges.push(
        <SymptomBadge
          key="nausea"
          name={SYMPTOM_DISPLAY_NAMES.nausea}
          severity={symptoms.nausea.severity}
        />
      );
    }

    if (symptoms.appetite) {
      badges.push(
        <SymptomBadge
          key="appetite"
          name={SYMPTOM_DISPLAY_NAMES.appetite}
          severity={symptoms.appetite.level}
          isAppetite
        />
      );
    }

    if (symptoms.pain) {
      badges.push(
        <SymptomBadge
          key="pain"
          name={SYMPTOM_DISPLAY_NAMES.pain}
          severity={symptoms.pain.severity}
          extra={symptoms.pain.location}
        />
      );
    }

    return badges;
  };

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
          <span className="text-gray-500">Loading symptoms...</span>
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
          <button onClick={fetchCheckins} className="text-blue-600 hover:text-blue-800">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Symptom Check-ins</h2>

      {checkins.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="mt-4 text-gray-500">No symptom check-ins yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Check-ins will appear here when the patient submits them
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {checkins.map((checkin) => (
            <Card key={checkin.id} padding="md">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateTime(checkin.timestamp)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {renderSymptomBadges(checkin.symptoms)}
                </div>

                {checkin.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Notes: </span>
                      {checkin.notes}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
