'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import {
  TimeEntry,
  TimeEntriesResponse,
  TimeEntryResponse,
  TimeEntrySummaryResponse,
  TimeEntryActivity,
  PerformerType,
  TIME_ENTRY_ACTIVITY_LABELS,
  PatientBillingSummary,
  PatientBillingSummaryResponse,
  CPT_CODE_LABELS,
} from '@/lib/types';
import TimeEntryCard from '@/components/TimeEntryCard';
import TimeEntryForm from '@/components/TimeEntryForm';
import Button from '@/components/ui/Button';

export default function TimeLogPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated } = useAuth();
  const { selectedClinic } = useClinic();
  const { showToast } = useToast();
  const patientId = params.id as string;

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<TimeEntrySummaryResponse['summary'] | null>(null);
  const [billingSummary, setBillingSummary] = useState<PatientBillingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [entriesRes, summaryRes, billingRes] = await Promise.all([
        api.get<TimeEntriesResponse>(`/clinician/patients/${patientId}/time-entries`),
        api.get<TimeEntrySummaryResponse>(`/clinician/patients/${patientId}/time-entries/summary`),
        api.get<PatientBillingSummaryResponse>(`/clinician/patients/${patientId}/billing-summary`),
      ]);
      setEntries(entriesRes.timeEntries);
      setSummary(summaryRes.summary);
      setBillingSummary(billingRes.summary);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
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

  const handleCreateEntry = async (data: {
    entryDate: string;
    durationMinutes: number;
    activity: TimeEntryActivity;
    performerType: PerformerType;
    notes?: string;
  }) => {
    if (!selectedClinic) {
      showToast('Please select a clinic first', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<TimeEntryResponse>(
        `/clinician/patients/${patientId}/time-entries`,
        {
          clinicId: selectedClinic.id,
          entryDate: data.entryDate,
          durationMinutes: data.durationMinutes,
          activity: data.activity,
          performerType: data.performerType,
          notes: data.notes,
        }
      );
      setEntries((prev) => [response.timeEntry, ...prev]);
      setShowForm(false);
      showToast('Time entry logged successfully', 'success');
      // Refresh summaries
      const [summaryRes, billingRes] = await Promise.all([
        api.get<TimeEntrySummaryResponse>(`/clinician/patients/${patientId}/time-entries/summary`),
        api.get<PatientBillingSummaryResponse>(`/clinician/patients/${patientId}/billing-summary`),
      ]);
      setSummary(summaryRes.summary);
      setBillingSummary(billingRes.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create time entry';
      showToast(message, 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEntry = async (
    entryId: string,
    data: { durationMinutes?: number; activity?: string; notes?: string | null }
  ) => {
    try {
      const response = await api.put<TimeEntryResponse>(`/clinician/time-entries/${entryId}`, data);
      setEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? response.timeEntry : entry))
      );
      showToast('Time entry updated', 'success');
      // Refresh summaries
      const [summaryRes, billingRes] = await Promise.all([
        api.get<TimeEntrySummaryResponse>(`/clinician/patients/${patientId}/time-entries/summary`),
        api.get<PatientBillingSummaryResponse>(`/clinician/patients/${patientId}/billing-summary`),
      ]);
      setSummary(summaryRes.summary);
      setBillingSummary(billingRes.summary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update time entry', 'error');
      throw err;
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await api.delete(`/clinician/time-entries/${entryId}`);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      showToast('Time entry deleted', 'success');
      // Refresh summaries
      const [summaryRes, billingRes] = await Promise.all([
        api.get<TimeEntrySummaryResponse>(`/clinician/patients/${patientId}/time-entries/summary`),
        api.get<PatientBillingSummaryResponse>(`/clinician/patients/${patientId}/billing-summary`),
      ]);
      setSummary(summaryRes.summary);
      setBillingSummary(billingRes.summary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete time entry', 'error');
      throw err;
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
          <span className="text-gray-500">Loading time entries...</span>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Time Log</h2>
        {!showForm && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            + Log Time
          </Button>
        )}
      </div>

      {/* Billing Summary Card */}
      {billingSummary && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Monthly Billing Summary</h3>
            <span className="text-xs text-gray-500">
              {new Date(billingSummary.period.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(billingSummary.period.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {/* CPT Eligibility Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* RPM codes */}
            {['99453', '99445', '99454', '99470', '99457', '99458', '99091'].map((code) => {
              const isEligible = billingSummary.eligibleCodes.includes(code);
              const count = billingSummary.eligibleCodes.filter((c) => c === code).length;
              return (
                <div
                  key={code}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                    isEligible
                      ? code === '99091'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                  title={CPT_CODE_LABELS[code]}
                >
                  {isEligible && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {code}{count > 1 ? ` x${count}` : ''}
                </div>
              );
            })}
            {/* CCM codes */}
            {['99490', '99439', '99491', '99437'].map((code) => {
              const isEligible = billingSummary.eligibleCodes.includes(code);
              const count = billingSummary.eligibleCodes.filter((c) => c === code).length;
              if (!isEligible) return null;
              return (
                <div
                  key={code}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800 border border-purple-200"
                  title={CPT_CODE_LABELS[code]}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {code}{count > 1 ? ` x${count}` : ''}
                </div>
              );
            })}
            {/* PCM codes */}
            {['99424', '99425', '99426', '99427'].map((code) => {
              const isEligible = billingSummary.eligibleCodes.includes(code);
              const count = billingSummary.eligibleCodes.filter((c) => c === code).length;
              if (!isEligible) return null;
              return (
                <div
                  key={code}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800 border border-orange-200"
                  title={CPT_CODE_LABELS[code]}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {code}{count > 1 ? ` x${count}` : ''}
                </div>
              );
            })}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{billingSummary.deviceTransmission.totalDays}</p>
              <p className="text-xs text-gray-600">Device Days</p>
              <p className="text-xs text-gray-400 mt-1">2+ for 99445, 16+ for 99454</p>
            </div>
            <div className="bg-white/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{billingSummary.time.rpmMinutes}</p>
              <p className="text-xs text-gray-600">RPM Minutes</p>
              <p className="text-xs text-gray-400 mt-1">10+ for 99470, 20+ for 99457</p>
            </div>
            <div className="bg-white/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{billingSummary.time.ccmClinicalStaffMinutes || 0}</p>
              <p className="text-xs text-gray-600">CCM Staff Min</p>
              <p className="text-xs text-gray-400 mt-1">20+ for 99490</p>
            </div>
            <div className="bg-white/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{billingSummary.time.ccmPhysicianMinutes || 0}</p>
              <p className="text-xs text-gray-600">CCM Physician Min</p>
              <p className="text-xs text-gray-400 mt-1">30+ for 99491</p>
            </div>
            <div className="bg-white/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{summary?.entryCount || 0}</p>
              <p className="text-xs text-gray-600">Time Entries</p>
              <p className="text-xs text-gray-400 mt-1">
                {Math.floor((billingSummary.time.totalMinutes || 0) / 60)}h {(billingSummary.time.totalMinutes || 0) % 60}m logged
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add entry form */}
      {showForm && (
        <div className="mb-6">
          <TimeEntryForm
            onSubmit={handleCreateEntry}
            onCancel={() => setShowForm(false)}
            isLoading={isSubmitting}
          />
        </div>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-gray-500">No time entries yet</p>
            <p className="text-sm text-gray-400">
              Log your billable time for RPM/CCM tracking
            </p>
            {!showForm && (
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Log first time entry
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <TimeEntryCard
              key={entry.id}
              entry={entry}
              currentClinicianId={user?.id || ''}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
