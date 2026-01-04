'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { ClinicianNote, NotesResponse, NoteResponse } from '@/lib/types';
import NoteCard from '@/components/NoteCard';
import NoteForm from '@/components/NoteForm';
import Button from '@/components/ui/Button';

export default function NotesPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const patientId = params.id as string;

  const [notes, setNotes] = useState<ClinicianNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<NotesResponse>(`/clinician/patients/${patientId}/notes`);
      setNotes(response.notes);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchNotes();
  }, [isAuthenticated, router, fetchNotes]);

  const handleCreateNote = async (content: string) => {
    setIsSubmitting(true);
    try {
      const response = await api.post<NoteResponse>(`/clinician/patients/${patientId}/notes`, {
        content,
      });
      setNotes((prev) => [response.note, ...prev]);
      setShowForm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create note', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditNote = async (noteId: string, content: string) => {
    try {
      const response = await api.put<NoteResponse>(`/clinician/notes/${noteId}`, { content });
      setNotes((prev) =>
        prev.map((note) => (note.id === noteId ? response.note : note))
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update note', 'error');
      throw err;
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/clinician/notes/${noteId}`);
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete note', 'error');
      throw err;
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
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
          <span className="text-gray-500">Loading notes...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
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
          <Button onClick={fetchNotes}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
        {!showForm && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            + Add Note
          </Button>
        )}
      </div>

      {/* Add note form */}
      {showForm && (
        <div className="mb-6">
          <NoteForm
            onSubmit={handleCreateNote}
            onCancel={() => setShowForm(false)}
            isLoading={isSubmitting}
          />
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="flex justify-center items-center min-h-[200px]">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500">No notes yet</p>
            {!showForm && (
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Add the first note
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentClinicianId={user?.id || ''}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
