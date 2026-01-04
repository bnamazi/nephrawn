'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Alert, AlertStatus, AlertsResponse } from '@/lib/types';
import AlertCard from '@/components/AlertCard';
import Button from '@/components/ui/Button';

type FilterStatus = 'ALL' | AlertStatus;

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export default function AlertsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<AlertsResponse>('/clinician/alerts');
      setAlerts(response.alerts);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchAlerts();
  }, [isAuthenticated, router, fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.post(`/clinician/alerts/${alertId}/acknowledge`, {});
      // Optimistic update
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? { ...alert, status: 'ACKNOWLEDGED' as AlertStatus, acknowledgedAt: new Date().toISOString() }
            : alert
        )
      );
    } catch (err) {
      // Revert on error by refetching
      fetchAlerts();
      throw err;
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await api.post(`/clinician/alerts/${alertId}/dismiss`, {});
      // Optimistic update
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? { ...alert, status: 'DISMISSED' as AlertStatus, acknowledgedAt: new Date().toISOString() }
            : alert
        )
      );
    } catch (err) {
      // Revert on error by refetching
      fetchAlerts();
      throw err;
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'ALL') return true;
    return alert.status === filter;
  });

  // Count open alerts
  const openCount = alerts.filter((a) => a.status === 'OPEN').length;

  if (!isAuthenticated) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Alerts</h1>
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
            <span className="text-gray-500">Loading alerts...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Alerts</h1>
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
            <Button onClick={fetchAlerts}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Alerts</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_OPTIONS.map((option) => {
          const count =
            option.value === 'ALL'
              ? alerts.length
              : option.value === 'OPEN'
              ? openCount
              : alerts.filter((a) => a.status === option.value).length;

          return (
            <Button
              key={option.value}
              variant={filter === option.value ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              {count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Alert list */}
      {filteredAlerts.length === 0 ? (
        <div className="flex justify-center items-center min-h-[300px]">
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
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-gray-500">
              {filter === 'ALL'
                ? 'No alerts'
                : `No ${filter.toLowerCase()} alerts`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
