'use client';

import Link from 'next/link';
import { Patient, Enrollment } from '@/lib/types';
import { formatDateOfBirth } from '@/lib/utils';

interface PatientHeaderProps {
  patient: Patient;
  enrollment: Enrollment;
}

export default function PatientHeader({ patient, enrollment }: PatientHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Back link */}
        <Link
          href="/patients"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Patients
        </Link>

        {/* Patient info */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{patient.email}</p>
            <p className="text-sm text-gray-500 mt-1">
              DOB: {formatDateOfBirth(patient.dateOfBirth)}
            </p>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            {enrollment.isPrimary && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Primary
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                enrollment.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {enrollment.status === 'ACTIVE' ? 'Active' : 'Discharged'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
