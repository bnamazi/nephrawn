'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import {
  ProfileResponse,
  CkdStage,
  NyhaClass,
  CKD_STAGE_LABELS,
  DIALYSIS_STATUS_LABELS,
  DIABETES_LABELS,
  NYHA_LABELS,
  ETIOLOGY_LABELS,
  SEX_LABELS,
  TRANSPLANT_STATUS_LABELS,
} from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function PatientProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<{
    ckdStageClinician: CkdStage | '';
    heartFailureClass: NyhaClass | '';
    medicationNotes: string;
  }>({
    ckdStageClinician: '',
    heartFailureClass: '',
    medicationNotes: '',
  });

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ProfileResponse>(
        `/clinician/patients/${patientId}/profile`
      );
      setData(response);
      // Initialize edit form with current values
      setEditForm({
        ckdStageClinician: response.profile?.ckdStageClinician || '',
        heartFailureClass: response.profile?.heartFailureClass || '',
        medicationNotes: response.profile?.medicationNotes || '',
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchProfile();
  }, [isAuthenticated, router, fetchProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: Record<string, unknown> = {};
      if (editForm.ckdStageClinician) {
        updateData.ckdStageClinician = editForm.ckdStageClinician;
      }
      if (editForm.heartFailureClass) {
        updateData.heartFailureClass = editForm.heartFailureClass;
      }
      if (editForm.medicationNotes !== data?.profile?.medicationNotes) {
        updateData.medicationNotes = editForm.medicationNotes;
      }

      if (Object.keys(updateData).length > 0) {
        await api.put(`/clinician/patients/${patientId}/profile`, updateData);
        await fetchProfile();
      }
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-500">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchProfile}>Try again</Button>
        </div>
      </div>
    );
  }

  const profile = data?.profile;

  return (
    <div className="space-y-6">
      {/* Completeness Banners */}
      {data?.showProfileBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800">Verify CKD Stage</p>
            <p className="text-sm text-amber-700">Set the clinician-verified CKD stage for accurate monitoring.</p>
          </div>
        </div>
      )}

      {data?.showTargetsBanner && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium text-blue-800">Set Care Plan Targets</p>
            <p className="text-sm text-blue-700">
              Configure dry weight and BP targets in the{' '}
              <button
                onClick={() => router.push(`/patients/${patientId}/care-plan`)}
                className="underline hover:no-underline"
              >
                Care Plan tab
              </button>.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Clinical Profile</h2>
          <p className="text-sm text-gray-500">
            Profile completeness: {data?.completeness.profileScore ?? 0}%
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/patients/${patientId}/profile/history`)}
          >
            View History
          </Button>
          {!isEditing ? (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} isLoading={isSaving}>
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* CKD Status */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Kidney Status</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-500 mb-1">CKD Stage (Patient Reported)</label>
            <p className="text-gray-900">
              {profile?.ckdStageSelfReported ? CKD_STAGE_LABELS[profile.ckdStageSelfReported] : 'Not set'}
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">CKD Stage (Verified)</label>
            {isEditing ? (
              <select
                value={editForm.ckdStageClinician}
                onChange={(e) => setEditForm({ ...editForm, ckdStageClinician: e.target.value as CkdStage })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select stage...</option>
                {Object.entries(CKD_STAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            ) : (
              <p className={`${profile?.ckdStageClinician ? 'text-gray-900 font-medium' : 'text-amber-600'}`}>
                {profile?.ckdStageClinician ? CKD_STAGE_LABELS[profile.ckdStageClinician] : 'Not verified'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Primary Etiology</label>
            <p className="text-gray-900">
              {profile?.primaryEtiology ? ETIOLOGY_LABELS[profile.primaryEtiology] : 'Not set'}
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Dialysis Status</label>
            <p className="text-gray-900">
              {profile?.dialysisStatus ? DIALYSIS_STATUS_LABELS[profile.dialysisStatus] : 'Not set'}
            </p>
          </div>
          {profile?.dialysisStartDate && (
            <div>
              <label className="block text-sm text-gray-500 mb-1">Dialysis Start Date</label>
              <p className="text-gray-900">
                {new Date(profile.dialysisStartDate).toLocaleDateString()}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Transplant Status</label>
            <p className="text-gray-900">
              {profile?.transplantStatus ? TRANSPLANT_STATUS_LABELS[profile.transplantStatus] : 'None'}
            </p>
          </div>
        </div>
      </Card>

      {/* Demographics */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Demographics</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Sex</label>
            <p className="text-gray-900">{profile?.sex ? SEX_LABELS[profile.sex] : 'Not set'}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Height</label>
            <p className="text-gray-900">
              {profile?.heightCm ? `${profile.heightCm} cm (${profile.heightDisplay})` : 'Not set'}
            </p>
          </div>
        </div>
      </Card>

      {/* Comorbidities */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Comorbidities</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Heart Failure</label>
            <p className="text-gray-900">{profile?.hasHeartFailure ? 'Yes' : 'No'}</p>
          </div>
          {profile?.hasHeartFailure && (
            <div>
              <label className="block text-sm text-gray-500 mb-1">NYHA Class</label>
              {isEditing ? (
                <select
                  value={editForm.heartFailureClass}
                  onChange={(e) => setEditForm({ ...editForm, heartFailureClass: e.target.value as NyhaClass })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select class...</option>
                  {Object.entries(NYHA_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900">
                  {profile?.heartFailureClass ? NYHA_LABELS[profile.heartFailureClass] : 'Not classified'}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Diabetes</label>
            <p className="text-gray-900">
              {profile?.diabetesType ? DIABETES_LABELS[profile.diabetesType] : 'None'}
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Hypertension</label>
            <p className="text-gray-900">{profile?.hasHypertension ? 'Yes' : 'No'}</p>
          </div>
          {profile?.otherConditions && profile.otherConditions.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-500 mb-1">Other Conditions</label>
              <div className="flex flex-wrap gap-2">
                {profile.otherConditions.map((condition, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700">
                    {condition}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Medications */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Medications</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <MedicationItem label="Diuretics" value={profile?.medications.onDiuretics} />
          <MedicationItem label="ACE/ARB Inhibitors" value={profile?.medications.onAceArbInhibitor} />
          <MedicationItem label="SGLT2 Inhibitors" value={profile?.medications.onSglt2Inhibitor} />
          <MedicationItem label="NSAIDs" value={profile?.medications.onNsaids} warning />
          <MedicationItem label="MRA" value={profile?.medications.onMra} />
          <MedicationItem label="Insulin" value={profile?.medications.onInsulin} />
        </div>
        <div className="mt-4">
          <label className="block text-sm text-gray-500 mb-1">Medication Notes (Clinician Only)</label>
          {isEditing ? (
            <textarea
              value={editForm.medicationNotes}
              onChange={(e) => setEditForm({ ...editForm, medicationNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Add notes about medications..."
            />
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">
              {profile?.medicationNotes || <span className="text-gray-400 italic">No notes</span>}
            </p>
          )}
        </div>
      </Card>

      {/* Last Updated */}
      {profile?.updatedAt && (
        <p className="text-xs text-gray-400 text-center">
          Last updated: {new Date(profile.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function MedicationItem({ label, value, warning }: { label: string; value?: boolean; warning?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={`text-sm ${value && warning ? 'text-amber-600 font-medium' : 'text-gray-700'}`}>
        {label}
        {value && warning && ' (!)'}
      </span>
    </div>
  );
}
