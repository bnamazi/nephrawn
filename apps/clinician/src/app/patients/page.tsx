'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
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
  clinic: {
    id: string;
    name: string;
  };
}

interface PatientsResponse {
  patients: Patient[];
}

interface PatientProfileData {
  showProfileBanner: boolean;
  showTargetsBanner: boolean;
  ckdStage: string | null;
  completenessScore: number;
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
  const { selectedClinic, isLoading: isClinicLoading } = useClinic();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);

  // Profile data for banners
  const [profileData, setProfileData] = useState<Record<string, PatientProfileData>>({});

  const fetchPatients = useCallback(async () => {
    if (!selectedClinic) {
      setPatients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Filter patients by selected clinic
      const response = await api.get<PatientsResponse>(
        `/clinician/patients?clinicId=${selectedClinic.id}`
      );
      setPatients(response.patients);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  }, [router, selectedClinic]);

  // Fetch profile data for all patients to show banners
  const fetchProfileData = useCallback(async (patientIds: string[]) => {
    const results: Record<string, PatientProfileData> = {};

    await Promise.all(
      patientIds.map(async (patientId) => {
        try {
          const response = await api.get<{
            showProfileBanner: boolean;
            showTargetsBanner: boolean;
            profile: { ckdStageClinician: string | null } | null;
            completeness: { profileScore: number };
          }>(`/clinician/patients/${patientId}/profile`);

          results[patientId] = {
            showProfileBanner: response.showProfileBanner,
            showTargetsBanner: response.showTargetsBanner,
            ckdStage: response.profile?.ckdStageClinician || null,
            completenessScore: response.completeness.profileScore,
          };
        } catch {
          // Silently fail for individual patients - just don't show banners
          results[patientId] = {
            showProfileBanner: false,
            showTargetsBanner: false,
            ckdStage: null,
            completenessScore: 0,
          };
        }
      })
    );

    setProfileData(results);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!isClinicLoading) {
      fetchPatients();
    }
  }, [isAuthenticated, router, fetchPatients, isClinicLoading]);

  // Fetch profile data after patients load
  useEffect(() => {
    if (patients.length > 0) {
      fetchProfileData(patients.map(p => p.id));
    }
  }, [patients, fetchProfileData]);

  const handleInviteSuccess = (invite: InviteResponse) => {
    setLastInvite(invite);
    setIsSuccessModalOpen(true);
    // Refresh patient list after invite
    fetchPatients();
  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
    setLastInvite(null);
  };

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Loading state
  if (isLoading || isClinicLoading) {
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
            {selectedClinic && (
              <Button onClick={() => setIsInviteModalOpen(true)}>
                Invite Your First Patient
              </Button>
            )}
          </div>
        </div>

        {selectedClinic && (
          <>
            <InvitePatientModal
              isOpen={isInviteModalOpen}
              onClose={() => setIsInviteModalOpen(false)}
              onSuccess={handleInviteSuccess}
              clinicId={selectedClinic.id}
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
          {selectedClinic && (
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
              showProfileBanner={profileData[patient.id]?.showProfileBanner}
              showTargetsBanner={profileData[patient.id]?.showTargetsBanner}
              ckdStage={profileData[patient.id]?.ckdStage}
              completenessScore={profileData[patient.id]?.completenessScore}
            />
          ))}
        </div>
      </div>

      {selectedClinic && (
        <>
          <InvitePatientModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            onSuccess={handleInviteSuccess}
            clinicId={selectedClinic.id}
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
