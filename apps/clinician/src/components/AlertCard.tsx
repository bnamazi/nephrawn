'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/lib/types';
import { formatRelativeTime, formatDate, cn } from '@/lib/utils';
import AlertBadge from './AlertBadge';
import Button from './ui/Button';
import Card from './ui/Card';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

function formatAlertDetails(alert: Alert): string[] {
  const details: string[] = [];
  const inputs = alert.inputs;

  // Weight gain alert
  if (alert.ruleId === 'weight_gain_48h' && inputs) {
    const delta = inputs.delta as number | undefined;
    const oldestValue = inputs.oldestValue as number | undefined;
    const newestValue = inputs.newestValue as number | undefined;
    if (delta !== undefined && oldestValue !== undefined && newestValue !== undefined) {
      details.push(`Weight increased from ${oldestValue.toFixed(1)} to ${newestValue.toFixed(1)} lbs`);
      details.push(`Delta: +${delta.toFixed(1)} lbs over 48 hours`);
    }
  }

  // BP high/low alerts
  if ((alert.ruleId === 'bp_systolic_high' || alert.ruleId === 'bp_systolic_low') && inputs) {
    const measurement = inputs.measurement as { value?: number } | undefined;
    if (measurement?.value) {
      details.push(`Systolic: ${measurement.value} mmHg`);
    }
  }

  // SpO2 alert
  if (alert.ruleId === 'spo2_low' && inputs) {
    const measurement = inputs.measurement as { value?: number } | undefined;
    if (measurement?.value) {
      details.push(`SpO2: ${measurement.value}%`);
    }
  }

  return details;
}

function getAlertSummary(alert: Alert): string {
  const inputs = alert.inputs;

  if (alert.ruleId === 'weight_gain_48h') {
    const delta = inputs.delta as number | undefined;
    if (delta !== undefined) {
      return `+${delta.toFixed(1)} lbs in 48 hours`;
    }
  }

  if (alert.ruleId === 'bp_systolic_high' || alert.ruleId === 'bp_systolic_low') {
    const measurement = inputs.measurement as { value?: number } | undefined;
    if (measurement?.value) {
      return `Systolic: ${measurement.value} mmHg`;
    }
  }

  if (alert.ruleId === 'spo2_low') {
    const measurement = inputs.measurement as { value?: number } | undefined;
    if (measurement?.value) {
      return `SpO2: ${measurement.value}%`;
    }
  }

  return alert.summaryText || '';
}

export default function AlertCard({ alert, onAcknowledge, onDismiss }: AlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAcknowledge = async () => {
    setIsLoading(true);
    try {
      await onAcknowledge(alert.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      await onDismiss(alert.id);
    } finally {
      setIsLoading(false);
    }
  };

  const summary = getAlertSummary(alert);
  const details = formatAlertDetails(alert);
  const isOpen = alert.status === 'OPEN';

  return (
    <Card
      className={cn(
        'transition-all',
        alert.severity === 'CRITICAL' && isOpen && 'border-l-4 border-l-red-500',
        alert.severity === 'WARNING' && isOpen && 'border-l-4 border-l-yellow-500'
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertBadge severity={alert.severity} />
              {alert.status !== 'OPEN' && <AlertBadge status={alert.status} />}
              <span className="font-medium text-gray-900">{alert.ruleName}</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{alert.patient.name}</p>
            {summary && <p className="mt-1 text-sm text-gray-500">{summary}</p>}
            <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(alert.triggeredAt)}</p>
          </div>

          {/* Expand button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={cn('w-5 h-5 transition-transform', isExpanded && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {details.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Details</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-gray-500 space-y-1">
              <p>Triggered: {formatDate(alert.triggeredAt)}</p>
              {alert.clinician && alert.acknowledgedAt && (
                <>
                  <p>
                    {alert.status === 'DISMISSED' ? 'Dismissed' : 'Acknowledged'} by: {alert.clinician.name}
                  </p>
                  <p>
                    {alert.status === 'DISMISSED' ? 'Dismissed' : 'Acknowledged'} at: {formatDate(alert.acknowledgedAt)}
                  </p>
                </>
              )}
            </div>

            <div className="mt-3">
              <Link
                href={`/patients/${alert.patientId}`}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Patient &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Actions */}
        {isOpen && (
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              disabled={isLoading}
              isLoading={isLoading}
            >
              Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAcknowledge}
              disabled={isLoading}
              isLoading={isLoading}
            >
              Acknowledge
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
