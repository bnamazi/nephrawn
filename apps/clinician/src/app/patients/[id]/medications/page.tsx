'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import {
  Medication,
  MedicationsResponse,
  AdherenceSummary,
  AdherenceSummaryResponse,
} from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function MedicationsPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [medications, setMedications] = useState<Medication[]>([]);
  const [summary, setSummary] = useState<AdherenceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [medsResponse, summaryResponse] = await Promise.all([
        api.get<MedicationsResponse>(`/clinician/patients/${patientId}/medications`),
        api.get<AdherenceSummaryResponse>(
          `/clinician/patients/${patientId}/medications/summary`
        ),
      ]);
      setMedications(medsResponse.medications);
      setSummary(summaryResponse.summary);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load medications');
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

  // Loading state
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
          <span className="text-gray-500">Loading medications...</span>
        </div>
      </div>
    );
  }

  // Error state
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
          <Button onClick={fetchData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Medications</h2>

      {/* Adherence Summary Card */}
      {summary && (
        <Card className="mb-6">
          <div className="flex items-center gap-6">
            <div
              className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${
                summary.adherenceRate >= 0.8
                  ? 'bg-green-100 text-green-700'
                  : summary.adherenceRate >= 0.6
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              <span className="text-lg font-bold">
                {Math.round(summary.adherenceRate * 100)}%
              </span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                Adherence ({summary.days} days)
              </h3>
              <p className="text-sm text-gray-500">
                {summary.takenCount} taken, {summary.skippedCount} skipped of{' '}
                {summary.totalLogs} logged doses
              </p>
              <p className="text-sm text-gray-500">
                {summary.totalMedications} active medication
                {summary.totalMedications !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Medications list */}
      {medications.length === 0 ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <svg
              className="h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <p className="text-gray-500">No medications recorded</p>
            <p className="text-sm text-gray-400">
              The patient hasn&apos;t added any medications yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {medications.map((medication) => (
            <MedicationCard key={medication.id} medication={medication} />
          ))}
        </div>
      )}
    </div>
  );
}

interface MedicationCardProps {
  medication: Medication;
}

function MedicationCard({ medication }: MedicationCardProps) {
  const lastLog = medication.logs?.[0];

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{medication.name}</h3>
            {!medication.isActive && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                Inactive
              </span>
            )}
          </div>
          <div className="mt-1 space-y-0.5 text-sm text-gray-500">
            {medication.dosage && <p>Dosage: {medication.dosage}</p>}
            {medication.frequency && <p>Frequency: {medication.frequency}</p>}
            {medication.instructions && (
              <p className="text-gray-400">Instructions: {medication.instructions}</p>
            )}
          </div>
          {lastLog && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded ${
                  lastLog.taken
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {lastLog.taken ? 'Taken' : 'Skipped'}
              </span>
              <span className="text-gray-400">
                {formatTimeAgo(new Date(lastLog.loggedAt))}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}
