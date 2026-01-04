'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { PatientWithEnrollment } from '@/lib/types';
import PatientHeader from '@/components/PatientHeader';
import TabNav from '@/components/TabNav';

interface PatientLayoutProps {
  children: ReactNode;
}

const TABS = [
  { label: 'Overview', href: '' },
  { label: 'Measurements', href: '/measurements' },
];

export default function PatientLayout({ children }: PatientLayoutProps) {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [data, setData] = useState<PatientWithEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatient = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<PatientWithEnrollment>(
        `/clinician/patients/${patientId}`
      );
      setData(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setError('Patient not found');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load patient');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchPatient();
  }, [isAuthenticated, router, fetchPatient]);

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
          <span className="text-gray-500">Loading patient...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
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
          <p className="text-gray-600">{error || 'Failed to load patient'}</p>
          <button
            onClick={() => router.push('/patients')}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PatientHeader patient={data.patient} enrollment={data.enrollment} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TabNav tabs={TABS} basePath={`/patients/${patientId}`} />
        <div className="py-6">{children}</div>
      </div>
    </div>
  );
}
