'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import {
  LabReport,
  LabReportsResponse,
  LAB_SOURCE_LABELS,
  LAB_FLAG_LABELS,
  LabResultFlag,
} from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function LabsPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<LabReportsResponse>(
        `/clinician/patients/${patientId}/labs`
      );
      setLabReports(response.labReports);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load lab results');
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

  const handleVerify = async (reportId: string) => {
    try {
      await api.post(`/clinician/patients/${patientId}/labs/${reportId}/verify`, {});
      // Refresh the data
      fetchData();
    } catch (err) {
      console.error('Failed to verify lab report:', err);
      alert('Failed to verify lab report');
    }
  };

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
          <span className="text-gray-500">Loading lab results...</span>
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Lab Results</h2>
        <span className="text-sm text-gray-500">
          {labReports.length} report{labReports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lab reports list */}
      {labReports.length === 0 ? (
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
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-500">No lab results recorded</p>
            <p className="text-sm text-gray-400">
              The patient hasn&apos;t added any lab results yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {labReports.map((report) => (
            <LabReportCard
              key={report.id}
              report={report}
              onVerify={() => handleVerify(report.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LabReportCardProps {
  report: LabReport;
  onVerify: () => void;
}

function LabReportCard({ report, onVerify }: LabReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const abnormalCount = report.results.filter((r) => r.flag !== null).length;
  const criticalCount = report.results.filter((r) => r.flag === 'C').length;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-600"
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
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">
                {report.labName || 'Lab Report'}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {LAB_SOURCE_LABELS[report.source]}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span>Collected: {formatDate(report.collectedAt)}</span>
              {report.orderingProvider && (
                <>
                  <span>·</span>
                  <span>Provider: {report.orderingProvider}</span>
                </>
              )}
            </div>
            {/* Summary chips */}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {report.results.length} results
              </span>
              {abnormalCount > 0 && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    criticalCount > 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {abnormalCount} abnormal
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report.verifiedAt ? (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Verified
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={onVerify}>
              Verify
            </Button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Results table */}
      {isExpanded && report.results.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Test
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Value
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Reference Range
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.results.map((result) => (
                <tr
                  key={result.id}
                  className={
                    result.flag === 'C'
                      ? 'bg-red-50'
                      : result.flag
                      ? 'bg-orange-50'
                      : ''
                  }
                >
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    {result.analyteName}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">
                    <span
                      className={
                        result.flag === 'C'
                          ? 'text-red-700 font-semibold'
                          : result.flag
                          ? 'text-orange-700 font-semibold'
                          : ''
                      }
                    >
                      {result.value} {result.unit}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {formatReferenceRange(
                      result.referenceRangeLow,
                      result.referenceRangeHigh
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {result.flag && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getFlagClass(
                          result.flag
                        )}`}
                      >
                        {LAB_FLAG_LABELS[result.flag]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes and verification info */}
      {(report.notes || report.verifiedAt) && (
        <div className="mt-4 pt-4 border-t space-y-2">
          {report.notes && (
            <p className="text-sm text-gray-500">
              <span className="font-medium">Notes:</span> {report.notes}
            </p>
          )}
          {report.verifiedAt && (
            <p className="text-sm text-gray-500">
              Verified by {report.verifiedBy?.name || 'Clinician'} on{' '}
              {formatDateTime(report.verifiedAt)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatReferenceRange(
  low: number | null,
  high: number | null
): string {
  if (low !== null && high !== null) {
    return `${low} - ${high}`;
  } else if (low !== null) {
    return `>= ${low}`;
  } else if (high !== null) {
    return `<= ${high}`;
  }
  return '-';
}

function getFlagClass(flag: LabResultFlag): string {
  switch (flag) {
    case 'C':
      return 'bg-red-100 text-red-700';
    case 'H':
    case 'L':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
