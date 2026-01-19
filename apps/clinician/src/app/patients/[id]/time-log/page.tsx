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
  TIME_ENTRY_ACTIVITY_LABELS,
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        api.get<TimeEntriesResponse>(`/clinician/patients/${patientId}/time-entries`),
        api.get<TimeEntrySummaryResponse>(`/clinician/patients/${patientId}/time-entries/summary`),
      ]);
      setEntries(entriesRes.timeEntries);
      setSummary(summaryRes.summary);
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
          notes: data.notes,
        }
      );
      setEntries((prev) => [response.timeEntry, ...prev]);
      setShowForm(false);
      showToast('Time entry logged successfully', 'success');
      // Refresh summary
      const summaryRes = await api.get<TimeEntrySummaryResponse>(
        `/clinician/patients/${patientId}/time-entries/summary`
      );
      setSummary(summaryRes.summary);
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
      // Refresh summary
      const summaryRes = await api.get<TimeEntrySummaryResponse>(
        `/clinician/patients/${patientId}/time-entries/summary`
      );
      setSummary(summaryRes.summary);
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
      // Refresh summary
      const summaryRes = await api.get<TimeEntrySummaryResponse>(
        `/clinician/patients/${patientId}/time-entries/summary`
      );
      setSummary(summaryRes.summary);
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

      {/* Summary Card */}
      {summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-900 mb-3">Last 30 Days Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold text-blue-900">{summary.totalMinutes}</p>
              <p className="text-xs text-blue-700">Total Minutes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{summary.entryCount}</p>
              <p className="text-xs text-blue-700">Entries</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m
              </p>
              <p className="text-xs text-blue-700">Time Logged</p>
            </div>
            <div>
              <p className="text-sm text-blue-700">
                {Object.entries(summary.byActivity)
                  .filter(([, mins]) => mins > 0)
                  .slice(0, 2)
                  .map(([act, mins]) => `${TIME_ENTRY_ACTIVITY_LABELS[act as TimeEntryActivity]}: ${mins}m`)
                  .join(', ')}
              </p>
              <p className="text-xs text-blue-700">By Activity</p>
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
