'use client';

import { useState } from 'react';
import { TimeEntryActivity, TIME_ENTRY_ACTIVITY_LABELS } from '@/lib/types';
import Button from '@/components/ui/Button';

interface TimeEntryFormProps {
  onSubmit: (data: {
    entryDate: string;
    durationMinutes: number;
    activity: TimeEntryActivity;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function TimeEntryForm({ onSubmit, onCancel, isLoading }: TimeEntryFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [entryDate, setEntryDate] = useState(today);
  const [durationMinutes, setDurationMinutes] = useState('20');
  const [activity, setActivity] = useState<TimeEntryActivity>('PATIENT_REVIEW');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration < 1 || duration > 120) {
      setError('Duration must be between 1 and 120 minutes');
      return;
    }

    const selectedDate = new Date(entryDate);
    const now = new Date();
    if (selectedDate > now) {
      setError('Entry date cannot be in the future');
      return;
    }

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (selectedDate < sevenDaysAgo) {
      setError('Entry date cannot be more than 7 days in the past');
      return;
    }

    try {
      await onSubmit({
        entryDate,
        durationMinutes: duration,
        activity,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create time entry');
    }
  };

  // Calculate max date (today) and min date (7 days ago)
  const maxDate = today;
  const sevenDaysAgoDate = new Date(new Date(today).getTime() - 7 * 24 * 60 * 60 * 1000);
  const minDate = sevenDaysAgoDate.toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-medium text-gray-900 mb-4">Log Billable Time</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            type="date"
            value={entryDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Activity Type
          </label>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as TimeEntryActivity)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {Object.entries(TIME_ENTRY_ACTIVITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe the interaction or activity..."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Log Time'}
        </Button>
      </div>
    </form>
  );
}
