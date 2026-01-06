'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { AuditHistoryResponse, AuditChange } from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function ProfileHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [data, setData] = useState<AuditChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchHistory = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<AuditHistoryResponse>(
        `/clinician/patients/${patientId}/profile/history?limit=${limit}&offset=${currentOffset}`
      );
      if (reset) {
        setData(response.changes);
        setOffset(limit);
      } else {
        setData(prev => [...prev, ...response.changes]);
        setOffset(currentOffset + limit);
      }
      setHasMore(response.changes.length === limit);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router, offset]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router, patientId]);

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Profile Change History</h2>
          <p className="text-sm text-gray-500">
            Audit trail of all profile and care plan changes
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/patients/${patientId}/profile`)}
        >
          Back to Profile
        </Button>
      </div>

      {/* Loading state for initial load */}
      {isLoading && data.length === 0 && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-gray-500">Loading history...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-red-600">{error}</p>
            <Button onClick={() => fetchHistory(true)}>Try again</Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && data.length === 0 && (
        <Card padding="lg">
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-500">No changes recorded yet</p>
            <p className="text-sm text-gray-400">Changes to profile and care plan will appear here</p>
          </div>
        </Card>
      )}

      {/* History list */}
      {data.length > 0 && (
        <div className="space-y-4">
          {data.map((change, index) => (
            <HistoryCard key={index} change={change} />
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                onClick={() => fetchHistory(false)}
                isLoading={isLoading}
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ change }: { change: AuditChange }) {
  const isCarePlan = change.entityType === 'CARE_PLAN';
  const changedFieldsEntries = Object.entries(change.changedFields);

  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isCarePlan ? 'bg-green-100' : 'bg-blue-100'
        }`}>
          {isCarePlan ? (
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                isCarePlan ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {isCarePlan ? 'CARE PLAN' : 'PROFILE'}
              </span>
              <span className="ml-2 text-sm text-gray-600">
                updated by{' '}
                <span className="font-medium">
                  {change.actor.type === 'PATIENT'
                    ? `${change.actor.name} (Patient)`
                    : change.actor.type === 'CLINICIAN'
                    ? change.actor.name
                    : 'System'}
                </span>
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {formatTimestamp(change.timestamp)}
            </span>
          </div>

          {/* Changed fields */}
          <div className="space-y-1">
            {changedFieldsEntries.map(([field, values]) => (
              <div key={field} className="text-sm">
                <span className="text-gray-500">{formatFieldName(field)}:</span>{' '}
                <span className="text-gray-400">{formatValue(values.old)}</span>
                <span className="mx-1 text-gray-400">&rarr;</span>
                <span className="text-gray-900 font-medium">{formatValue(values.new)}</span>
              </div>
            ))}
          </div>

          {/* Reason */}
          {change.reason && (
            <div className="mt-2 text-sm text-gray-600 italic bg-gray-50 px-3 py-2 rounded">
              &ldquo;{change.reason}&rdquo;
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  if (diffDays < 7) {
    const days = Math.floor(diffDays);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFieldName(field: string): string {
  const names: Record<string, string> = {
    ckdStageClinician: 'CKD Stage (Verified)',
    ckdStageSelfReported: 'CKD Stage (Self-Reported)',
    heartFailureClass: 'NYHA Class',
    medicationNotes: 'Medication Notes',
    dryWeightKg: 'Dry Weight',
    targetBpSystolic: 'Systolic BP Target',
    targetBpDiastolic: 'Diastolic BP Target',
    fluidRetentionRisk: 'Fluid Retention Risk',
    fallsRisk: 'Falls Risk',
    priorHfHospitalizations: 'Prior HF Hospitalizations',
    notes: 'Notes',
    hasHeartFailure: 'Heart Failure',
    hasHypertension: 'Hypertension',
    diabetesType: 'Diabetes Type',
    dialysisStatus: 'Dialysis Status',
    transplantStatus: 'Transplant Status',
    primaryEtiology: 'Primary Etiology',
    sex: 'Sex',
    heightCm: 'Height',
    onDiuretics: 'On Diuretics',
    onAceArbInhibitor: 'On ACE/ARB',
    onSglt2Inhibitor: 'On SGLT2i',
    onNsaids: 'On NSAIDs',
    onMra: 'On MRA',
    onInsulin: 'On Insulin',
  };
  return names[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    // BP range
    if ('min' in value && 'max' in value) {
      const range = value as { min: number; max: number };
      return `${range.min}-${range.max}`;
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    // Enum labels
    const enumLabels: Record<string, string> = {
      STAGE_1: 'Stage 1',
      STAGE_2: 'Stage 2',
      STAGE_3A: 'Stage 3a',
      STAGE_3B: 'Stage 3b',
      STAGE_4: 'Stage 4',
      STAGE_5: 'Stage 5',
      STAGE_5D: 'Stage 5D',
      TRANSPLANT: 'Transplant',
      UNKNOWN: 'Unknown',
      CLASS_1: 'Class I',
      CLASS_2: 'Class II',
      CLASS_3: 'Class III',
      CLASS_4: 'Class IV',
      NONE: 'None',
      TYPE_1: 'Type 1',
      TYPE_2: 'Type 2',
      HEMODIALYSIS: 'Hemodialysis',
      PERITONEAL_DIALYSIS: 'Peritoneal Dialysis',
      LISTED: 'Listed',
      RECEIVED: 'Received',
      MALE: 'Male',
      FEMALE: 'Female',
      OTHER: 'Other',
      UNSPECIFIED: 'Not specified',
    };
    return enumLabels[value] || value;
  }
  return String(value);
}
