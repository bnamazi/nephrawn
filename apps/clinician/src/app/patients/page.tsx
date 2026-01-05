'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import PatientCard from '@/components/PatientCard';
import Button from '@/components/ui/Button';
import { InvitePatientModal } from '@/components/InvitePatientModal';
import { InviteSuccessModal } from '@/components/InviteSuccessModal';

interface Patient {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  enrolledAt: string;
  isPrimary: boolean;
}

interface PatientsResponse {
  patients: Patient[];
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface ClinicsResponse {
  clinics: Clinic[];
}

interface InviteResponse {
  id: string;
  code: string;
  patientName: string;
  patientEmail: string | null;
  status: string;
  expiresAt: string;
}

export default function PatientsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [patientsRes, clinicsRes] = await Promise.all([
        api.get<PatientsResponse>('/clinician/patients'),
        api.get<ClinicsResponse>('/clinician/clinics'),
      ]);
      setPatients(patientsRes.patients);
      setClinics(clinicsRes.clinics);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchPatients();
  }, [isAuthenticated, router, fetchPatients]);

  const handleInviteSuccess = (invite: InviteResponse) => {
    setLastInvite(invite);
    setIsSuccessModalOpen(true);
  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
    setLastInvite(null);
  };

  // Get the first clinic (for MVP, clinicians belong to one clinic)
  const primaryClinic = clinics[0];

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Loading state
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
          <span className="text-gray-500">Loading patients...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
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
          <p className="text-gray-600">{error}</p>
          <Button onClick={fetchPatients}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (patients.length === 0) {
    return (
      <>
        <div className="flex justify-center items-center min-h-[400px]">
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-gray-500">No patients enrolled yet</p>
            {primaryClinic && (
              <Button onClick={() => setIsInviteModalOpen(true)}>
                Invite Your First Patient
              </Button>
            )}
          </div>
        </div>

        {primaryClinic && (
          <>
            <InvitePatientModal
              isOpen={isInviteModalOpen}
              onClose={() => setIsInviteModalOpen(false)}
              onSuccess={handleInviteSuccess}
              clinicId={primaryClinic.id}
            />
            {lastInvite && (
              <InviteSuccessModal
                isOpen={isSuccessModalOpen}
                onClose={handleSuccessClose}
                inviteCode={lastInvite.code}
                patientName={lastInvite.patientName}
                expiresAt={lastInvite.expiresAt}
              />
            )}
          </>
        )}
      </>
    );
  }

  // Patient list
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Patients</h1>
          {primaryClinic && (
            <Button onClick={() => setIsInviteModalOpen(true)}>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Invite Patient
              </span>
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onClick={() => router.push(`/patients/${patient.id}`)}
            />
          ))}
        </div>
      </div>

      {primaryClinic && (
        <>
          <InvitePatientModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            onSuccess={handleInviteSuccess}
            clinicId={primaryClinic.id}
          />
          {lastInvite && (
            <InviteSuccessModal
              isOpen={isSuccessModalOpen}
              onClose={handleSuccessClose}
              inviteCode={lastInvite.code}
              patientName={lastInvite.patientName}
              expiresAt={lastInvite.expiresAt}
            />
          )}
        </>
      )}
    </>
  );
}
