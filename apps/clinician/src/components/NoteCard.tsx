'use client';

import { useState } from 'react';
import { ClinicianNote } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import AlertBadge from './AlertBadge';
import Button from './ui/Button';
import Card from './ui/Card';

interface NoteCardProps {
  note: ClinicianNote;
  currentClinicianId: string;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function NoteCard({
  note,
  currentClinicianId,
  onEdit,
  onDelete,
}: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = note.clinicianId === currentClinicianId;

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setIsLoading(true);
    try {
      await onEdit(note.id, editContent.trim());
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    setIsDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <span className="font-medium text-gray-900">{note.clinician.name}</span>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-sm text-gray-500">{formatRelativeTime(note.createdAt)}</span>
        </div>
        {isAuthor && !isEditing && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={isDeleting}
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="text-sm text-red-600 hover:text-red-800"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="Enter your note..."
            disabled={isLoading}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveEdit}
              disabled={isLoading || !editContent.trim()}
              isLoading={isLoading}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
      )}

      {/* Alert badge */}
      {note.alert && !isEditing && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Attached to:</span>
            <AlertBadge severity={note.alert.severity} />
            <span>{note.alert.ruleName}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
