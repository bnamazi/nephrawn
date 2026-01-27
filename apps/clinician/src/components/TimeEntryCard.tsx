'use client';

import { useState } from 'react';
import { TimeEntry, TIME_ENTRY_ACTIVITY_LABELS, PERFORMER_TYPE_LABELS, PerformerType } from '@/lib/types';
import { formatDistanceToNow } from '@/lib/utils';
import Button from '@/components/ui/Button';

interface TimeEntryCardProps {
  entry: TimeEntry;
  currentClinicianId: string;
  onEdit: (id: string, data: { durationMinutes?: number; activity?: string; performerType?: string; notes?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function TimeEntryCard({
  entry,
  currentClinicianId,
  onEdit,
  onDelete,
}: TimeEntryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDuration, setEditDuration] = useState(entry.durationMinutes.toString());
  const [editActivity, setEditActivity] = useState(entry.activity);
  const [editPerformerType, setEditPerformerType] = useState<PerformerType>(entry.performerType || 'CLINICAL_STAFF');
  const [editNotes, setEditNotes] = useState(entry.notes || '');

  const isOwner = entry.clinicianId === currentClinicianId;
  const entryDate = new Date(entry.entryDate);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onEdit(entry.id, {
        durationMinutes: parseInt(editDuration, 10),
        activity: editActivity,
        performerType: editPerformerType,
        notes: editNotes || null,
      });
      setIsEditing(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this time entry?')) return;
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
    } catch {
      // Error handled by parent
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditDuration(entry.durationMinutes.toString());
    setEditActivity(entry.activity);
    setEditPerformerType(entry.performerType || 'CLINICAL_STAFF');
    setEditNotes(entry.notes || '');
  };

  if (isEditing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type
              </label>
              <select
                value={editActivity}
                onChange={(e) => setEditActivity(e.target.value as typeof editActivity)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TIME_ENTRY_ACTIVITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Performed By
              </label>
              <select
                value={editPerformerType}
                onChange={(e) => setEditPerformerType(e.target.value as PerformerType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(PERFORMER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes about this time entry..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {entry.durationMinutes} min
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {TIME_ENTRY_ACTIVITY_LABELS[entry.activity]}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              entry.performerType === 'PHYSICIAN_QHP'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-orange-100 text-orange-800'
            }`}>
              {PERFORMER_TYPE_LABELS[entry.performerType || 'CLINICAL_STAFF']}
            </span>
          </div>
          {entry.notes && (
            <p className="text-sm text-gray-700 mb-2">{entry.notes}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{entryDate.toLocaleDateString()}</span>
            <span>·</span>
            <span>by {entry.clinician.name}</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(entry.createdAt))}</span>
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-gray-600"
              title="Edit"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-600"
              title="Delete"
              disabled={isDeleting}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
