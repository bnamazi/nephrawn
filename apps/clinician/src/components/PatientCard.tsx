'use client';

import Card from './ui/Card';
import { formatDate, formatDateOfBirth } from '@/lib/utils';

interface Patient {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  enrolledAt: string;
  isPrimary: boolean;
}

interface PatientCardProps {
  patient: Patient;
  onClick?: () => void;
  showProfileBanner?: boolean;
  showTargetsBanner?: boolean;
  ckdStage?: string | null;
  completenessScore?: number;
}

export default function PatientCard({
  patient,
  onClick,
  showProfileBanner,
  showTargetsBanner,
  ckdStage,
  completenessScore,
}: PatientCardProps) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{patient.name}</h3>
          <p className="text-sm text-gray-500">{patient.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {patient.isPrimary && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Primary
            </span>
          )}
          {ckdStage && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {formatCkdStage(ckdStage)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center text-sm">
          <svg
            className="h-4 w-4 text-gray-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-gray-600">
            DOB: {formatDateOfBirth(patient.dateOfBirth)}
          </span>
        </div>

        <div className="flex items-center text-sm">
          <svg
            className="h-4 w-4 text-gray-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-gray-600">
            Enrolled: {formatDate(patient.enrolledAt)}
          </span>
        </div>

        {/* Completeness indicator */}
        {completenessScore !== undefined && (
          <div className="flex items-center text-sm">
            <svg
              className="h-4 w-4 text-gray-400 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className={`${completenessScore < 50 ? 'text-amber-600' : 'text-gray-600'}`}>
              {completenessScore}% complete
            </span>
          </div>
        )}
      </div>

      {/* Banners */}
      {(showProfileBanner || showTargetsBanner) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {showProfileBanner && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Verify CKD stage
            </div>
          )}
          {showTargetsBanner && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2 py-1.5 rounded">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Set care plan targets
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function formatCkdStage(stage: string): string {
  const labels: Record<string, string> = {
    STAGE_1: 'CKD 1',
    STAGE_2: 'CKD 2',
    STAGE_3A: 'CKD 3a',
    STAGE_3B: 'CKD 3b',
    STAGE_4: 'CKD 4',
    STAGE_5: 'CKD 5',
    STAGE_5D: 'CKD 5D',
    TRANSPLANT: 'Transplant',
    UNKNOWN: 'Unknown',
  };
  return labels[stage] || stage;
}
