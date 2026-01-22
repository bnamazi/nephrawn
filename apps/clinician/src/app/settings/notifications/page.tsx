'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { NotificationPreference, NotificationPreferenceResponse } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [notifyOnCritical, setNotifyOnCritical] = useState(true);
  const [notifyOnWarning, setNotifyOnWarning] = useState(true);
  const [notifyOnInfo, setNotifyOnInfo] = useState(false);

  const fetchPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get<NotificationPreferenceResponse>('/clinician/notifications/preferences');
      setPreferences(res.preferences);
      setEmailEnabled(res.preferences.emailEnabled);
      setNotifyOnCritical(res.preferences.notifyOnCritical);
      setNotifyOnWarning(res.preferences.notifyOnWarning);
      setNotifyOnInfo(res.preferences.notifyOnInfo);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load notification preferences');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchPreferences();
  }, [isAuthenticated, router, fetchPreferences]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.put<NotificationPreferenceResponse>('/clinician/notifications/preferences', {
        emailEnabled,
        notifyOnCritical,
        notifyOnWarning,
        notifyOnInfo,
      });
      setPreferences(res.preferences);
      setSuccessMessage('Notification preferences saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    preferences &&
    (emailEnabled !== preferences.emailEnabled ||
      notifyOnCritical !== preferences.notifyOnCritical ||
      notifyOnWarning !== preferences.notifyOnWarning ||
      notifyOnInfo !== preferences.notifyOnInfo);

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
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
          <span className="text-gray-500">Loading notification settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/patients"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
          <p className="text-gray-500 mt-1">Configure how you receive alerts about your patients</p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-700">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Email Notifications Toggle */}
      <Card padding="lg" className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email Notifications</h2>
            <p className="text-sm text-gray-500 mt-1">
              Receive email alerts when patient alerts are triggered
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailEnabled}
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              emailEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                emailEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Severity Settings */}
      <Card padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Alert Severity Levels</h2>
        <p className="text-sm text-gray-500 mb-6">
          Choose which alert severity levels trigger email notifications
        </p>

        <div className="space-y-4">
          {/* Critical */}
          <label className="flex items-center justify-between p-4 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-3 h-3 bg-red-500 rounded-full" />
              <div>
                <span className="font-medium text-gray-900">Critical</span>
                <p className="text-sm text-gray-500">Urgent alerts requiring immediate attention</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyOnCritical}
              onChange={(e) => setNotifyOnCritical(e.target.checked)}
              disabled={!emailEnabled}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
            />
          </label>

          {/* Warning */}
          <label className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-3 h-3 bg-yellow-500 rounded-full" />
              <div>
                <span className="font-medium text-gray-900">Warning</span>
                <p className="text-sm text-gray-500">Alerts that may need review soon</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyOnWarning}
              onChange={(e) => setNotifyOnWarning(e.target.checked)}
              disabled={!emailEnabled}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
            />
          </label>

          {/* Info */}
          <label className="flex items-center justify-between p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-3 h-3 bg-blue-500 rounded-full" />
              <div>
                <span className="font-medium text-gray-900">Informational</span>
                <p className="text-sm text-gray-500">Low-priority notifications for awareness</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyOnInfo}
              onChange={(e) => setNotifyOnInfo(e.target.checked)}
              disabled={!emailEnabled}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
            />
          </label>
        </div>

        {!emailEnabled && (
          <p className="mt-4 text-sm text-gray-500 italic">
            Enable email notifications to configure severity levels
          </p>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!hasChanges}
        >
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
