'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { InvitePatientModal } from '@/components/InvitePatientModal';
import { InviteSuccessModal } from '@/components/InviteSuccessModal';

interface Invite {
  id: string;
  code: string;
  patientName: string;
  patientEmail: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface InvitesResponse {
  invites: Invite[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
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

export default function InvitesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);

  const primaryClinic = clinics[0];

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const clinicsRes = await api.get<ClinicsResponse>('/clinician/clinics');
      setClinics(clinicsRes.clinics);

      if (clinicsRes.clinics.length > 0) {
        const clinicId = clinicsRes.clinics[0].id;
        const invitesRes = await api.get<InvitesResponse>(
          `/clinician/clinic/${clinicId}/invites?includeExpired=${includeExpired}`
        );
        setInvites(invitesRes.invites);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setIsLoading(false);
    }
  }, [router, includeExpired]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, router, fetchData]);

  const handleRevoke = async (inviteId: string) => {
    if (!primaryClinic) return;

    setRevoking(inviteId);
    try {
      await api.delete(`/clinician/clinic/${primaryClinic.id}/invites/${inviteId}`);
      // Refresh the list
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    } finally {
      setRevoking(null);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleInviteSuccess = (invite: InviteResponse) => {
    setLastInvite(invite);
    setIsSuccessModalOpen(true);
    // Refresh the list after creating a new invite
    fetchData();
  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
    setLastInvite(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();

    if (status === 'CLAIMED') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
          Claimed
        </span>
      );
    }
    if (status === 'REVOKED') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          Revoked
        </span>
      );
    }
    if (status === 'EXPIRED' || isExpired) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
          Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
        Pending
      </span>
    );
  };

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
          <span className="text-gray-500">Loading invites...</span>
        </div>
      </div>
    );
  }

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
          <Button onClick={fetchData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Invites</h1>
            <p className="text-gray-500 mt-1">
              Manage invite codes for new patient enrollments
            </p>
          </div>
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
                New Invite
              </span>
            </Button>
          )}
        </div>

        {/* Filter toggle */}
        <div className="mb-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show expired invites
          </label>
        </div>

        {invites.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-4 text-gray-500">No pending invites</p>
              {primaryClinic && (
                <Button onClick={() => setIsInviteModalOpen(true)} className="mt-4">
                  Create Your First Invite
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => {
              const isPending = invite.status === 'PENDING' && new Date(invite.expiresAt) > new Date();

              return (
                <Card key={invite.id} padding="md">
                  <div className="flex items-center justify-between gap-4">
                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-gray-900 truncate">
                          {invite.patientName}
                        </p>
                        {getStatusBadge(invite.status, invite.expiresAt)}
                      </div>
                      {invite.patientEmail && (
                        <p className="text-sm text-gray-500 truncate">{invite.patientEmail}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Created {formatDate(invite.createdAt)} • Expires {formatDate(invite.expiresAt)}
                      </p>
                    </div>

                    {/* Invite code */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded max-w-[120px] truncate">
                          {invite.code.substring(0, 8)}...
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyCode(invite.code)}
                        >
                          {copiedCode === invite.code ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied
                            </span>
                          ) : (
                            'Copy'
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Actions */}
                    {isPending && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(invite.id)}
                        isLoading={revoking === invite.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
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
