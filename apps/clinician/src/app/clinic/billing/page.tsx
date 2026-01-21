'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { api, ApiError } from '@/lib/api';
import {
  ClinicBillingReport,
  ClinicBillingReportResponse,
  PatientBillingSummary,
  CPT_CODE_LABELS,
} from '@/lib/types';
import Button from '@/components/ui/Button';

export default function ClinicBillingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { selectedClinic } = useClinic();

  const [report, setReport] = useState<ClinicBillingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchReport = useCallback(async () => {
    if (!selectedClinic) return;

    setIsLoading(true);
    setError(null);

    // Parse selected month to get date range
    const [year, month] = selectedMonth.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    try {
      const response = await api.get<ClinicBillingReportResponse>(
        `/clinician/clinics/${selectedClinic.id}/billing-report?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      setReport(response.report);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setError('You need OWNER or ADMIN role to view billing reports');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load billing report');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClinic, selectedMonth, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (selectedClinic) {
      fetchReport();
    }
  }, [isAuthenticated, selectedClinic, router, fetchReport]);

  // Generate month options for the last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { value, label };
  });

  if (!isAuthenticated) {
    return null;
  }

  if (!selectedClinic) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Please select a clinic to view billing reports</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
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
            <span className="text-gray-500">Loading billing report...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
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
            <Button onClick={fetchReport}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Report</h1>
          <p className="text-sm text-gray-500">{report?.clinicName}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-3xl font-bold text-gray-900">{report.summary.totalPatients}</p>
              <p className="text-sm text-gray-600">Total Patients</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-sm">
              <p className="text-3xl font-bold text-yellow-700">{report.summary.patientsWith99453 || 0}</p>
              <p className="text-sm text-yellow-600">Eligible for 99453</p>
              <p className="text-xs text-yellow-500 mt-1">Initial setup (one-time)</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
              <p className="text-3xl font-bold text-green-700">
                {(report.summary.patientsWith99445 || 0) + report.summary.patientsWith99454}
              </p>
              <p className="text-sm text-green-600">Eligible for 99445/99454</p>
              <p className="text-xs text-green-500 mt-1">
                {report.summary.patientsWith99454} (16+ days) / {report.summary.patientsWith99445 || 0} (2-15 days)
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
              <p className="text-3xl font-bold text-blue-700">
                {(report.summary.patientsWith99470 || 0) + report.summary.patientsWith99457}
              </p>
              <p className="text-sm text-blue-600">Eligible for 99470/99457</p>
              <p className="text-xs text-blue-500 mt-1">
                {report.summary.patientsWith99457} (20+ RPM) / {report.summary.patientsWith99470 || 0} (10-19 RPM)
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 shadow-sm">
              <p className="text-3xl font-bold text-purple-700">{report.summary.patientsWith99490}</p>
              <p className="text-sm text-purple-600">Eligible for 99490</p>
              <p className="text-xs text-purple-500 mt-1">{report.summary.totalCcmMinutes} total CCM min</p>
            </div>
          </div>

          {/* CPT Code Legend */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">CPT Code Reference</h3>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {Object.entries(CPT_CODE_LABELS).map(([code, label]) => (
                <span key={code}>
                  <strong>{code}</strong>: {label}
                </span>
              ))}
            </div>
          </div>

          {/* Patient Table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">Patient Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device Days
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RPM Min
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CCM Min
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Eligible Codes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.patients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No patients enrolled
                      </td>
                    </tr>
                  ) : (
                    report.patients.map((patient: PatientBillingSummary) => (
                      <tr key={patient.patientId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/patients/${patient.patientId}/time-log`)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {patient.patientName}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-sm ${
                              patient.deviceTransmission.eligible99454
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {patient.deviceTransmission.totalDays}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-sm ${
                              patient.time.eligible99457
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {patient.time.rpmMinutes}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-sm ${
                              patient.time.eligible99490
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {patient.time.ccmMinutes}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {patient.eligibleCodes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {[...new Set(patient.eligibleCodes)].map((code) => {
                                const count = patient.eligibleCodes.filter((c) => c === code).length;
                                return (
                                  <span
                                    key={code}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                  >
                                    {code}{count > 1 ? ` x${count}` : ''}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">None</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
