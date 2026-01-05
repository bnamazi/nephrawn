'use client';

import { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';

interface InviteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCode: string;
  patientName: string;
  expiresAt: string;
}

export function InviteSuccessModal({
  isOpen,
  onClose,
  inviteCode,
  patientName,
  expiresAt,
}: InviteSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <Card padding="lg">
          <div className="text-center">
            {/* Success icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Invite Created!
            </h2>
            <p className="text-gray-600 mb-6">
              Share this code with <span className="font-medium">{patientName}</span> to
              complete their enrollment.
            </p>

            {/* Invite code display */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Invite Code
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-gray-900 break-all">
                  {inviteCode}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </span>
                  )}
                </Button>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              This code expires on {formatExpiryDate(expiresAt)}
            </p>

            <Button type="button" onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
