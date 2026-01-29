'use client';

import { useState } from 'react';
import {
  PatientToxinRecord,
  KidneyToxinCategory,
  ToxinRiskLevel,
  TOXIN_RISK_LEVEL_LABELS,
} from '@/lib/types';
import Card from './ui/Card';
import Button from './ui/Button';

interface ToxinCardProps {
  category: KidneyToxinCategory;
  record?: PatientToxinRecord;
  onUpdate: (categoryId: string, data: {
    isEducated?: boolean;
    lastExposureDate?: string | null;
    exposureNotes?: string | null;
    riskOverride?: ToxinRiskLevel | null;
    notes?: string | null;
  }) => Promise<void>;
  onEducate: (categoryId: string) => Promise<void>;
}

const riskColors: Record<ToxinRiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  MODERATE: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  HIGH: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

export default function ToxinCard({
  category,
  record,
  onUpdate,
  onEducate,
}: ToxinCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    lastExposureDate: record?.lastExposureDate?.split('T')[0] || '',
    exposureNotes: record?.exposureNotes || '',
    riskOverride: record?.riskOverride || '',
    notes: record?.notes || '',
  });

  const effectiveRisk = record?.riskOverride || category.riskLevel;
  const colors = riskColors[effectiveRisk];

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onUpdate(category.id, {
        lastExposureDate: editForm.lastExposureDate || null,
        exposureNotes: editForm.exposureNotes || null,
        riskOverride: editForm.riskOverride as ToxinRiskLevel || null,
        notes: editForm.notes || null,
      });
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEducate = async () => {
    setIsLoading(true);
    try {
      await onEducate(category.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({
      lastExposureDate: record?.lastExposureDate?.split('T')[0] || '',
      exposureNotes: record?.exposureNotes || '',
      riskOverride: record?.riskOverride || '',
      notes: record?.notes || '',
    });
    setIsEditing(false);
  };

  return (
    <Card className={`p-4 border-l-4 ${colors.border}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${colors.bg} ${colors.text}`}>
            {effectiveRisk}
          </span>
          <h4 className="font-medium text-gray-900">{category.name}</h4>
          {record?.riskOverride && (
            <span className="text-xs text-gray-500">(override)</span>
          )}
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
        )}
      </div>

      {/* Description */}
      {category.examples && (
        <p className="text-sm text-gray-600 mb-3">{category.examples}</p>
      )}

      {isEditing ? (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          {/* Last Exposure Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Exposure Date
            </label>
            <input
              type="date"
              value={editForm.lastExposureDate}
              onChange={(e) => setEditForm({ ...editForm, lastExposureDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Exposure Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exposure Notes
            </label>
            <input
              type="text"
              value={editForm.exposureNotes}
              onChange={(e) => setEditForm({ ...editForm, exposureNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., CT scan for kidney stone evaluation"
            />
          </div>

          {/* Risk Override */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient-Specific Risk Level
            </label>
            <select
              value={editForm.riskOverride}
              onChange={(e) => setEditForm({ ...editForm, riskOverride: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Use default ({category.riskLevel})</option>
              <option value="LOW">{TOXIN_RISK_LEVEL_LABELS.LOW}</option>
              <option value="MODERATE">{TOXIN_RISK_LEVEL_LABELS.MODERATE}</option>
              <option value="HIGH">{TOXIN_RISK_LEVEL_LABELS.HIGH}</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
              isLoading={isLoading}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Education Status */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleEducate}
              disabled={isLoading || record?.isEducated}
              className={`flex items-center gap-1.5 ${
                record?.isEducated
                  ? 'text-green-600 cursor-default'
                  : 'text-gray-500 hover:text-green-600 cursor-pointer'
              }`}
            >
              {record?.isEducated ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                </svg>
              )}
              <span className="text-sm">
                {record?.isEducated ? (
                  <>
                    Patient educated
                    {record.educatedAt && (
                      <span className="text-gray-500">
                        {' '}({new Date(record.educatedAt).toLocaleDateString()})
                      </span>
                    )}
                  </>
                ) : (
                  'Mark as educated'
                )}
              </span>
            </button>
          </div>

          {/* Last Exposure */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">Last exposure:</span>{' '}
            {record?.lastExposureDate
              ? new Date(record.lastExposureDate).toLocaleDateString()
              : <span className="text-gray-400">Not recorded</span>}
          </div>

          {/* Exposure Notes */}
          {record?.exposureNotes && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Exposure notes:</span>{' '}
              {record.exposureNotes}
            </div>
          )}

          {/* Notes */}
          {record?.notes && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Notes:</span>{' '}
              {record.notes}
            </div>
          )}

          {/* No data yet */}
          {!record && (
            <p className="text-sm text-gray-400 italic">No tracking data yet</p>
          )}
        </div>
      )}
    </Card>
  );
}
