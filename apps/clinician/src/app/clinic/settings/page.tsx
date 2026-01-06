'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { api, ApiError } from '@/lib/api';
import { ClinicMembershipRole } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface ClinicDetails {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  timezone: string | null;
}

interface Member {
  id: string;
  clinicianId: string;
  name: string;
  email: string;
  role: ClinicMembershipRole;
  joinedAt: string;
}

interface ClinicResponse {
  clinic: ClinicDetails;
}

interface MembersResponse {
  members: Member[];
}

const ROLE_COLORS: Record<ClinicMembershipRole, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  CLINICIAN: 'bg-gray-100 text-gray-600',
  STAFF: 'bg-gray-100 text-gray-600',
};

const ROLE_LABELS: Record<ClinicMembershipRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  CLINICIAN: 'Clinician',
  STAFF: 'Staff',
};

export default function ClinicSettingsPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { selectedClinic, isLoading: isClinicLoading } = useClinic();

  const [clinic, setClinic] = useState<ClinicDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member modal state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ClinicMembershipRole>('CLINICIAN');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Role change and remove state
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const isOwner = selectedClinic?.role === 'OWNER';
  const isAdmin = selectedClinic?.role === 'ADMIN';
  const canManageMembers = isOwner || isAdmin;

  const fetchData = useCallback(async () => {
    if (!selectedClinic) {
      setIsLoading(false);
      return;
    }

    // Check authorization
    if (!canManageMembers) {
      router.push('/patients');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [clinicRes, membersRes] = await Promise.all([
        api.get<ClinicResponse>(`/clinician/clinic/${selectedClinic.id}`),
        api.get<MembersResponse>(`/clinician/clinic/${selectedClinic.id}/members`),
      ]);
      setClinic(clinicRes.clinic);
      setMembers(membersRes.members);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load clinic settings');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClinic, canManageMembers, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!isClinicLoading) {
      fetchData();
    }
  }, [isAuthenticated, router, fetchData, isClinicLoading]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic) return;

    setIsAddingMember(true);
    setAddMemberError(null);

    try {
      await api.post(`/clinician/clinic/${selectedClinic.id}/members`, {
        email: newMemberEmail.trim().toLowerCase(),
        role: newMemberRole,
      });
      setIsAddMemberOpen(false);
      setNewMemberEmail('');
      setNewMemberRole('CLINICIAN');
      await fetchData();
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRoleChange = async (clinicianId: string, newRole: ClinicMembershipRole) => {
    if (!selectedClinic) return;

    setChangingRole(clinicianId);
    try {
      await api.put(`/clinician/clinic/${selectedClinic.id}/members/${clinicianId}/role`, {
        role: newRole,
      });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemoveMember = async (clinicianId: string, memberName: string) => {
    if (!selectedClinic) return;

    if (!confirm(`Are you sure you want to remove ${memberName} from this clinic?`)) {
      return;
    }

    setRemovingMember(clinicianId);
    try {
      await api.delete(`/clinician/clinic/${selectedClinic.id}/members/${clinicianId}`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get available roles for dropdown based on current user's role
  const getAvailableRoles = (targetMember: Member): ClinicMembershipRole[] => {
    // Can't change owner's role
    if (targetMember.role === 'OWNER') return [];
    // Can't change own role
    if (targetMember.clinicianId === user?.id) return [];

    if (isOwner) {
      // Owner can assign any role except OWNER
      return ['ADMIN', 'CLINICIAN', 'STAFF'];
    }
    if (isAdmin) {
      // Admin can only assign Clinician or Staff (not Admin)
      if (targetMember.role === 'ADMIN') return []; // Can't demote other admins
      return ['CLINICIAN', 'STAFF'];
    }
    return [];
  };

  const canRemoveMember = (targetMember: Member): boolean => {
    // Can't remove owner
    if (targetMember.role === 'OWNER') return false;
    // Can't remove yourself
    if (targetMember.clinicianId === user?.id) return false;
    // Admin can't remove other admins
    if (isAdmin && targetMember.role === 'ADMIN') return false;

    return canManageMembers;
  };

  if (!isAuthenticated) {
    return null;
  }

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
          <span className="text-gray-500">Loading clinic settings...</span>
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

  if (!clinic) {
    return null;
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/patients"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clinic Settings</h1>
            <p className="text-gray-500 mt-1">Manage your clinic and team members</p>
          </div>
        </div>

        {/* Clinic Info */}
        <Card padding="lg" className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinic Information</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-20">Name:</dt>
                  <dd className="text-gray-900 font-medium">{clinic.name}</dd>
                </div>
                {clinic.phone && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-20">Phone:</dt>
                    <dd className="text-gray-900">{clinic.phone}</dd>
                  </div>
                )}
                {clinic.email && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-20">Email:</dt>
                    <dd className="text-gray-900">{clinic.email}</dd>
                  </div>
                )}
                {clinic.timezone && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-20">Timezone:</dt>
                    <dd className="text-gray-900">{clinic.timezone}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Card>

        {/* Team Members */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            {canManageMembers && (
              <Button onClick={() => setIsAddMemberOpen(true)} size="sm">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Add Member
                </span>
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {members.map((member) => {
              const availableRoles = getAvailableRoles(member);
              const canRemove = canRemoveMember(member);
              const isCurrentUser = member.clinicianId === user?.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded font-medium',
                          ROLE_COLORS[member.role]
                        )}
                      >
                        {ROLE_LABELS[member.role]}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-gray-400">(You)</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Joined {formatDate(member.joinedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {availableRoles.length > 0 && (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.clinicianId, e.target.value as ClinicMembershipRole)
                        }
                        disabled={changingRole === member.clinicianId}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value={member.role}>{ROLE_LABELS[member.role]}</option>
                        {availableRoles
                          .filter((r) => r !== member.role)
                          .map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                      </select>
                    )}

                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.clinicianId, member.name)}
                        isLoading={removingMember === member.clinicianId}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {members.length === 0 && (
              <p className="text-gray-500 text-center py-8">No team members found</p>
            )}
          </div>
        </Card>
      </div>

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsAddMemberOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md mx-4">
            <Card padding="lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Team Member</h2>
              <p className="text-sm text-gray-500 mb-4">
                Add an existing clinician to this clinic by their email address.
              </p>

              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="clinician@example.com"
                    required
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as ClinicMembershipRole)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {isOwner && <option value="ADMIN">Admin</option>}
                    <option value="CLINICIAN">Clinician</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </div>

                {addMemberError && (
                  <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                    {addMemberError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddMemberOpen(false);
                      setNewMemberEmail('');
                      setAddMemberError(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isAddingMember} className="flex-1">
                    Add Member
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
