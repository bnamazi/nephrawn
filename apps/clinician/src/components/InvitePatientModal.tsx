'use client';

import { useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

interface InvitePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invite: InviteResponse) => void;
  clinicId: string;
}

interface InviteResponse {
  id: string;
  code: string;
  patientName: string;
  patientEmail: string | null;
  status: string;
  expiresAt: string;
}

export function InvitePatientModal({ isOpen, onClose, onSuccess, clinicId }: InvitePatientModalProps) {
  const [patientName, setPatientName] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/clinician/clinic/${clinicId}/invites`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            patientName: patientName.trim(),
            patientDob,
            patientEmail: patientEmail.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invite');
      }

      onSuccess(data.invite);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPatientName('');
    setPatientDob('');
    setPatientEmail('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <Card padding="lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Invite New Patient</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Patient Name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Enter patient's full name"
              required
              autoFocus
            />

            <Input
              label="Date of Birth"
              type="date"
              value={patientDob}
              onChange={(e) => setPatientDob(e.target.value)}
              required
            />

            <Input
              label="Email (optional)"
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="patient@example.com"
            />

            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading} className="flex-1">
                Create Invite
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
