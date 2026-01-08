'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import {
  PatientDocument,
  DocumentsResponse,
  DocumentDownloadResponse,
  DOCUMENT_TYPE_LABELS,
} from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function DocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const patientId = params.id as string;

  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<DocumentsResponse>(
        `/clinician/patients/${patientId}/documents`
      );
      setDocuments(response.documents);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, router, fetchData]);

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
          <span className="text-gray-500">Loading documents...</span>
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
          <Button onClick={fetchData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <span className="text-sm text-gray-500">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
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
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <p className="text-gray-500">No documents uploaded</p>
            <p className="text-sm text-gray-400">
              The patient hasn&apos;t uploaded any documents yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((document) => (
            <DocumentCard key={document.id} document={document} patientId={patientId} />
          ))}
        </div>
      )}
    </div>
  );
}

interface DocumentCardProps {
  document: PatientDocument;
  patientId: string;
}

function DocumentCard({ document, patientId }: DocumentCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleView = async () => {
    setIsDownloading(true);
    try {
      const response = await api.get<DocumentDownloadResponse>(
        `/clinician/patients/${patientId}/documents/${document.id}/download-url`
      );
      // Open the download URL in a new tab
      window.open(response.downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to get download URL:', err);
      alert('Failed to get download URL');
    } finally {
      setIsDownloading(false);
    }
  };

  const isPdf = document.mimeType === 'application/pdf';
  const isImage = document.mimeType.startsWith('image/');

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
            isPdf ? 'bg-red-100' : isImage ? 'bg-blue-100' : 'bg-gray-100'
          }`}
        >
          {isPdf ? (
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          ) : isImage ? (
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-gray-600"
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
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate">
              {document.title || document.filename}
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
              {DOCUMENT_TYPE_LABELS[document.type]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
            <span>{formatFileSize(document.sizeBytes)}</span>
            <span>·</span>
            <span>Uploaded {formatDate(document.uploadedAt)}</span>
            {document.documentDate && (
              <>
                <span>·</span>
                <span>Document date: {formatDate(document.documentDate)}</span>
              </>
            )}
          </div>
          {document.notes && (
            <p className="mt-2 text-sm text-gray-500">{document.notes}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleView}
            disabled={isDownloading}
          >
            {isDownloading ? 'Loading...' : 'View'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
