'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { CarePlanResponse, BpRange } from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function CarePlanPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [data, setData] = useState<CarePlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    dryWeightKg: '',
    targetBpSystolicMin: '',
    targetBpSystolicMax: '',
    targetBpDiastolicMin: '',
    targetBpDiastolicMax: '',
    priorHfHospitalizations: '',
    fluidRetentionRisk: false,
    fallsRisk: false,
    notes: '',
  });

  const fetchCarePlan = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<CarePlanResponse>(
        `/clinician/patients/${patientId}/care-plan`
      );
      setData(response);
      // Initialize edit form with current values
      const cp = response.carePlan;
      setEditForm({
        dryWeightKg: cp?.dryWeightKg?.toString() || '',
        targetBpSystolicMin: cp?.targetBpSystolic?.min?.toString() || '',
        targetBpSystolicMax: cp?.targetBpSystolic?.max?.toString() || '',
        targetBpDiastolicMin: cp?.targetBpDiastolic?.min?.toString() || '',
        targetBpDiastolicMax: cp?.targetBpDiastolic?.max?.toString() || '',
        priorHfHospitalizations: cp?.priorHfHospitalizations?.toString() || '',
        fluidRetentionRisk: cp?.fluidRetentionRisk || false,
        fallsRisk: cp?.fallsRisk || false,
        notes: cp?.notes || '',
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load care plan');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchCarePlan();
  }, [isAuthenticated, router, fetchCarePlan]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updateData: Record<string, unknown> = {};

      if (editForm.dryWeightKg) {
        updateData.dryWeightKg = parseFloat(editForm.dryWeightKg);
      }

      if (editForm.targetBpSystolicMin && editForm.targetBpSystolicMax) {
        updateData.targetBpSystolic = {
          min: parseInt(editForm.targetBpSystolicMin),
          max: parseInt(editForm.targetBpSystolicMax),
        } as BpRange;
      }

      if (editForm.targetBpDiastolicMin && editForm.targetBpDiastolicMax) {
        updateData.targetBpDiastolic = {
          min: parseInt(editForm.targetBpDiastolicMin),
          max: parseInt(editForm.targetBpDiastolicMax),
        } as BpRange;
      }

      if (editForm.priorHfHospitalizations) {
        updateData.priorHfHospitalizations = parseInt(editForm.priorHfHospitalizations);
      }

      updateData.fluidRetentionRisk = editForm.fluidRetentionRisk;
      updateData.fallsRisk = editForm.fallsRisk;

      if (editForm.notes !== data?.carePlan?.notes) {
        updateData.notes = editForm.notes;
      }

      await api.put(`/clinician/patients/${patientId}/care-plan`, updateData);
      await fetchCarePlan();
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save care plan');
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
          <span className="text-gray-500">Loading care plan...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchCarePlan}>Try again</Button>
        </div>
      </div>
    );
  }

  const carePlan = data?.carePlan;
  const completeness = data?.completeness;

  return (
    <div className="space-y-6">
      {/* Completeness Banner */}
      {completeness?.showTargetsBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800">Set Care Plan Targets</p>
            <p className="text-sm text-amber-700">
              {completeness.missingCritical.includes('dryWeightKg')
                ? 'Dry weight is required to enable fluid retention alerts.'
                : 'Configure BP targets for personalized monitoring.'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Care Plan</h2>
          <p className="text-sm text-gray-500">
            Care plan completeness: {completeness?.carePlanScore ?? 0}%
            {data?.enrollment && (
              <span className="ml-2 text-gray-400">({data.enrollment.clinicName})</span>
            )}
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
              Edit Care Plan
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

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {saveError}
        </div>
      )}

      {/* Weight Targets */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Weight Targets</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Dry Weight (kg)</label>
            {isEditing ? (
              <Input
                type="number"
                step="0.1"
                min="20"
                max="300"
                value={editForm.dryWeightKg}
                onChange={(e) => setEditForm({ ...editForm, dryWeightKg: e.target.value })}
                placeholder="e.g., 75.0"
              />
            ) : (
              <p className={`text-lg ${carePlan?.dryWeightKg ? 'text-gray-900 font-medium' : 'text-amber-600'}`}>
                {carePlan?.dryWeightKg ? `${carePlan.dryWeightKg} kg` : 'Not set'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Dry Weight (lbs)</label>
            <p className="text-lg text-gray-500">
              {carePlan?.dryWeightLbs ? `${carePlan.dryWeightLbs} lbs` : '—'}
            </p>
          </div>
        </div>
        {!carePlan?.dryWeightKg && !isEditing && (
          <p className="mt-3 text-sm text-amber-600">
            Setting dry weight enables fluid retention alerts.
          </p>
        )}
      </Card>

      {/* Blood Pressure Targets */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Blood Pressure Targets</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-500 mb-2">Systolic (mmHg)</label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="70"
                  max="200"
                  value={editForm.targetBpSystolicMin}
                  onChange={(e) => setEditForm({ ...editForm, targetBpSystolicMin: e.target.value })}
                  placeholder="Min"
                  className="w-24"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="number"
                  min="80"
                  max="250"
                  value={editForm.targetBpSystolicMax}
                  onChange={(e) => setEditForm({ ...editForm, targetBpSystolicMax: e.target.value })}
                  placeholder="Max"
                  className="w-24"
                />
              </div>
            ) : (
              <p className="text-lg text-gray-900">
                {carePlan?.targetBpSystolic
                  ? `${carePlan.targetBpSystolic.min} - ${carePlan.targetBpSystolic.max}`
                  : <span className="text-gray-400">Not set</span>}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-2">Diastolic (mmHg)</label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="40"
                  max="120"
                  value={editForm.targetBpDiastolicMin}
                  onChange={(e) => setEditForm({ ...editForm, targetBpDiastolicMin: e.target.value })}
                  placeholder="Min"
                  className="w-24"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="number"
                  min="50"
                  max="150"
                  value={editForm.targetBpDiastolicMax}
                  onChange={(e) => setEditForm({ ...editForm, targetBpDiastolicMax: e.target.value })}
                  placeholder="Max"
                  className="w-24"
                />
              </div>
            ) : (
              <p className="text-lg text-gray-900">
                {carePlan?.targetBpDiastolic
                  ? `${carePlan.targetBpDiastolic.min} - ${carePlan.targetBpDiastolic.max}`
                  : <span className="text-gray-400">Not set</span>}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          KDIGO recommends &lt;120/80 for most CKD patients. Adjust based on individual risk factors.
        </p>
      </Card>

      {/* Risk Flags */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Risk Flags</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            {isEditing ? (
              <input
                type="checkbox"
                checked={editForm.fluidRetentionRisk}
                onChange={(e) => setEditForm({ ...editForm, fluidRetentionRisk: e.target.checked })}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            ) : (
              <RiskIndicator active={carePlan?.fluidRetentionRisk} />
            )}
            <div>
              <p className="font-medium text-gray-900">Fluid Retention Risk</p>
              <p className="text-sm text-gray-500">Increases alert sensitivity for weight gain.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            {isEditing ? (
              <input
                type="checkbox"
                checked={editForm.fallsRisk}
                onChange={(e) => setEditForm({ ...editForm, fallsRisk: e.target.checked })}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            ) : (
              <RiskIndicator active={carePlan?.fallsRisk} />
            )}
            <div>
              <p className="font-medium text-gray-900">Falls Risk</p>
              <p className="text-sm text-gray-500">Adds BP monitoring considerations for mobility.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Prior HF Hospitalizations (past year)</label>
            {isEditing ? (
              <Input
                type="number"
                min="0"
                max="50"
                value={editForm.priorHfHospitalizations}
                onChange={(e) => setEditForm({ ...editForm, priorHfHospitalizations: e.target.value })}
                placeholder="0"
                className="w-24"
              />
            ) : (
              <p className="text-gray-900">
                {carePlan?.priorHfHospitalizations ?? 0}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card padding="md">
        <h3 className="font-medium text-gray-900 mb-4">Clinician Notes</h3>
        {isEditing ? (
          <textarea
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder="Add care plan notes..."
          />
        ) : (
          <p className="text-gray-700 whitespace-pre-wrap">
            {carePlan?.notes || <span className="text-gray-400 italic">No notes</span>}
          </p>
        )}
      </Card>

      {/* Last Updated */}
      {carePlan?.updatedAt && (
        <p className="text-xs text-gray-400 text-center">
          Last updated: {new Date(carePlan.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function RiskIndicator({ active }: { active?: boolean }) {
  return active ? (
    <span className="flex items-center justify-center w-5 h-5 bg-amber-100 rounded-full">
      <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </span>
  ) : (
    <span className="flex items-center justify-center w-5 h-5 bg-gray-100 rounded-full">
      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}
