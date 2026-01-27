'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

// Card configuration for consistent display
interface BillingCard {
  code: string;
  label: string;
  threshold: string;
  getValue: (summary: ClinicBillingReport['summary']) => number;
  colorClass: string;
}

const BILLING_CARDS: BillingCard[][] = [
  // Row 1 - Device/Setup
  [
    { code: '', label: 'Total Patients', threshold: '', getValue: (s) => s.totalPatients, colorClass: 'bg-gray-50 border-gray-200 text-gray-700' },
    { code: '99453', label: 'Initial Setup', threshold: 'One-time setup', getValue: (s) => s.patientsWith99453, colorClass: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { code: '99445', label: 'Device (2-15 days)', threshold: '2-15 transmission days', getValue: (s) => s.patientsWith99445 || 0, colorClass: 'bg-green-50 border-green-200 text-green-600' },
    { code: '99454', label: 'Device (16+ days)', threshold: '16+ transmission days', getValue: (s) => s.patientsWith99454, colorClass: 'bg-green-100 border-green-300 text-green-700' },
  ],
  // Row 2 - RPM Time
  [
    { code: '99470', label: 'RPM (10-19 min)', threshold: '10-19 min RPM time', getValue: (s) => s.patientsWith99470 || 0, colorClass: 'bg-blue-50 border-blue-200 text-blue-600' },
    { code: '99457', label: 'RPM (20+ min)', threshold: '20+ min RPM time', getValue: (s) => s.patientsWith99457, colorClass: 'bg-blue-100 border-blue-300 text-blue-700' },
    { code: '99458', label: 'RPM Add-on', threshold: 'Additional 20 min blocks', getValue: (s) => s.patientsWith99457, colorClass: 'bg-blue-100 border-blue-300 text-blue-800' },
    { code: '99091', label: 'RPM Physician', threshold: '30+ min physician', getValue: (s) => s.patientsWith99091 || 0, colorClass: 'bg-indigo-100 border-indigo-300 text-indigo-700' },
  ],
  // Row 3 - CCM
  [
    { code: '99490', label: 'CCM Staff', threshold: '20+ min staff time', getValue: (s) => s.patientsWith99490 || 0, colorClass: 'bg-purple-50 border-purple-200 text-purple-600' },
    { code: '99439', label: 'CCM Staff Add-on', threshold: 'Per 20 min staff', getValue: (s) => s.patientsWith99439 || 0, colorClass: 'bg-purple-100 border-purple-300 text-purple-700' },
    { code: '99491', label: 'CCM Physician', threshold: '30+ min physician', getValue: (s) => s.patientsWith99491 || 0, colorClass: 'bg-purple-100 border-purple-300 text-purple-800' },
    { code: '99437', label: 'CCM Phys Add-on', threshold: 'Per 30 min physician', getValue: (s) => s.patientsWith99437 || 0, colorClass: 'bg-purple-200 border-purple-400 text-purple-900' },
  ],
  // Row 4 - PCM
  [
    { code: '99424', label: 'PCM Physician', threshold: '30+ min physician', getValue: (s) => s.patientsWith99424 || 0, colorClass: 'bg-orange-50 border-orange-200 text-orange-600' },
    { code: '99425', label: 'PCM Phys Add-on', threshold: 'Per 30 min physician', getValue: (s) => s.patientsWith99425 || 0, colorClass: 'bg-orange-100 border-orange-300 text-orange-700' },
    { code: '99426', label: 'PCM Staff', threshold: '30+ min staff', getValue: (s) => s.patientsWith99426 || 0, colorClass: 'bg-orange-100 border-orange-300 text-orange-800' },
    { code: '99427', label: 'PCM Staff Add-on', threshold: 'Per 30 min staff', getValue: (s) => s.patientsWith99427 || 0, colorClass: 'bg-orange-200 border-orange-400 text-orange-900' },
  ],
];

export default function ClinicBillingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { selectedClinic } = useClinic();

  const [report, setReport] = useState<ClinicBillingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
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

  // Filter patients based on selected code
  const filteredPatients = useMemo(() => {
    if (!report) return [];
    if (!selectedFilter) return report.patients;
    return report.patients.filter((p) => p.eligibleCodes.includes(selectedFilter));
  }, [report, selectedFilter]);

  // Handle card click
  const handleCardClick = (code: string) => {
    if (!code) return; // Total Patients card is not clickable
    setSelectedFilter(selectedFilter === code ? null : code);
  };

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
          {BILLING_CARDS.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {row.map((card) => {
                const isSelected = selectedFilter === card.code;
                const isClickable = card.code !== '';
                return (
                  <button
                    key={card.code || 'total'}
                    onClick={() => handleCardClick(card.code)}
                    disabled={!isClickable}
                    className={`${card.colorClass} border rounded-lg p-4 shadow-sm text-left transition-all ${
                      isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
                    } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    <p className="text-3xl font-bold">{card.getValue(report.summary)}</p>
                    <p className="text-sm font-medium">
                      {card.code ? `${card.code} - ${card.label}` : card.label}
                    </p>
                    {card.threshold && (
                      <p className="text-xs opacity-75 mt-1">{card.threshold}</p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Filter Indicator */}
          {selectedFilter && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm text-blue-700">
                Showing patients eligible for <strong>{selectedFilter}</strong> - {CPT_CODE_LABELS[selectedFilter]}
              </span>
              <button
                onClick={() => setSelectedFilter(null)}
                className="ml-auto text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Clear filter
              </button>
            </div>
          )}

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
              <h3 className="text-sm font-medium text-gray-900">
                Patient Details
                {selectedFilter && (
                  <span className="ml-2 text-gray-500">
                    ({filteredPatients.length} of {report.patients.length} patients)
                  </span>
                )}
              </h3>
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
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        {selectedFilter ? 'No patients match this filter' : 'No patients enrolled'}
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((patient: PatientBillingSummary) => (
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
                                const isHighlighted = selectedFilter === code;
                                return (
                                  <span
                                    key={code}
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      isHighlighted
                                        ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-500'
                                        : 'bg-green-100 text-green-800'
                                    }`}
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
