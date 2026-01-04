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
}

export default function PatientCard({ patient, onClick }: PatientCardProps) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{patient.name}</h3>
          <p className="text-sm text-gray-500">{patient.email}</p>
        </div>
        {patient.isPrimary && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Primary
          </span>
        )}
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
      </div>
    </Card>
  );
}
