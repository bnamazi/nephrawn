'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { PatientDevicesResponse, getSourceLabel } from '@/lib/types';
import Card from '@/components/ui/Card';

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function DeviceIcon({ type }: { type: string }) {
  if (type === 'blood_pressure_monitor') {
    return (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    );
  }
  // Smart scale
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Connected', className: 'bg-green-100 text-green-800' },
    EXPIRED: { label: 'Expired', className: 'bg-yellow-100 text-yellow-800' },
    REVOKED: { label: 'Disconnected', className: 'bg-gray-100 text-gray-800' },
    ERROR: { label: 'Error', className: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status] || statusConfig.ERROR;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

export default function DevicesPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [data, setData] = useState<PatientDevicesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<PatientDevicesResponse>(
        `/clinician/patients/${patientId}/devices`
      );
      setData(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchDevices();
  }, [isAuthenticated, router, fetchDevices]);

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-8 w-8 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-500">Loading devices...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-gray-600">{error}</p>
          <button onClick={fetchDevices} className="text-blue-600 hover:text-blue-800">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasAnyDevice = data?.devices && data.devices.length > 0;
  const activeConnection = data?.devices?.find(d => d.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {hasAnyDevice && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Vendor Connection</h3>
              <p className="text-sm text-gray-500 mt-1">
                {activeConnection ? 'Withings account is connected' : 'No active device connection'}
              </p>
            </div>
            {data?.devices?.[0] && <StatusBadge status={data.devices[0].status} />}
          </div>
          {activeConnection && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Connected Since</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(activeConnection.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Last Sync</dt>
                  <dd className="font-medium text-gray-900">
                    {activeConnection.lastSyncAt
                      ? formatRelativeTime(activeConnection.lastSyncAt)
                      : 'Never'}
                  </dd>
                </div>
              </dl>
              {activeConnection.lastSyncError && (
                <p className="mt-2 text-sm text-red-600">
                  Last sync error: {activeConnection.lastSyncError}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Device Types */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Connected Devices</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.deviceTypes?.map((device) => (
            <Card key={device.id} className={device.connected ? 'border-green-200 bg-green-50' : ''}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${device.connected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  <DeviceIcon type={device.id} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{device.name}</h4>
                  {device.connected ? (
                    <>
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Connected via {getSourceLabel(device.source || '')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Last data: {device.lastSync ? formatRelativeTime(device.lastSync) : 'No data yet'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Not connected</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* No devices message */}
      {!hasAnyDevice && (
        <Card className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">No devices connected</h3>
          <p className="mt-2 text-sm text-gray-500">
            This patient has not connected any health devices yet.
          </p>
        </Card>
      )}
    </div>
  );
}
