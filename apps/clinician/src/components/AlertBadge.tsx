import { AlertSeverity, AlertStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AlertBadgeProps {
  severity?: AlertSeverity;
  status?: AlertStatus;
  className?: string;
}

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  INFO: 'bg-blue-100 text-blue-800',
};

const STATUS_STYLES: Record<AlertStatus, string> = {
  OPEN: 'bg-red-100 text-red-800',
  ACKNOWLEDGED: 'bg-green-100 text-green-800',
  DISMISSED: 'bg-gray-100 text-gray-600',
};

export default function AlertBadge({ severity, status, className }: AlertBadgeProps) {
  if (severity) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
          SEVERITY_STYLES[severity],
          className
        )}
      >
        {severity}
      </span>
    );
  }

  if (status) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
          STATUS_STYLES[status],
          className
        )}
      >
        {status}
      </span>
    );
  }

  return null;
}
