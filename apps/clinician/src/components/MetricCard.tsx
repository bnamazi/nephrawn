'use client';

import Card from './ui/Card';
import { MeasurementSummary, getSourceLabel } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

function SourceBadge({ source }: { source: string }) {
  const isDevice = source.toLowerCase() !== 'manual';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
      isDevice ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {isDevice && (
        <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {getSourceLabel(source)}
    </span>
  );
}

interface MetricCardProps {
  title: string;
  summary: MeasurementSummary | null;
  unit?: string;
  formatValue?: (value: number) => string;
  onClick?: () => void;
  iconColor?: string;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'increasing') {
    return (
      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  if (trend === 'decreasing') {
    return (
      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  }
  if (trend === 'stable') {
    return (
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    );
  }
  return null;
}

export default function MetricCard({
  title,
  summary,
  unit,
  formatValue,
  onClick,
  iconColor = 'blue',
}: MetricCardProps) {
  const hasData = summary?.latest !== null;
  const displayUnit = unit || summary?.displayUnit || summary?.unit || '';
  const value = summary?.latest?.value;
  const formattedValue = value !== undefined
    ? (formatValue ? formatValue(value) : value.toFixed(1))
    : '--';

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
  };

  return (
    <Card hover={!!onClick} onClick={onClick} padding="md">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[iconColor] || colorClasses.blue}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        {hasData && summary && <TrendIcon trend={summary.trend} />}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="flex items-baseline mt-1">
          <span className="text-2xl font-bold text-gray-900">{formattedValue}</span>
          {hasData && <span className="ml-1 text-sm text-gray-500">{displayUnit}</span>}
        </div>
        {hasData && summary?.latest && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">
              {formatRelativeTime(summary.latest.timestamp)}
            </p>
            <SourceBadge source={summary.latest.source} />
          </div>
        )}
        {!hasData && (
          <p className="text-xs text-gray-400 mt-1">No data</p>
        )}
      </div>
    </Card>
  );
}

// Special card for blood pressure (two values)
interface BloodPressureCardProps {
  systolic: MeasurementSummary | null;
  diastolic: MeasurementSummary | null;
  onClick?: () => void;
}

export function BloodPressureCard({ systolic, diastolic, onClick }: BloodPressureCardProps) {
  const hasData = systolic?.latest !== null && diastolic?.latest !== null;
  const sysValue = systolic?.latest?.value;
  const diaValue = diastolic?.latest?.value;

  return (
    <Card hover={!!onClick} onClick={onClick} padding="md">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-red-100 text-red-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </div>
        {hasData && systolic && <TrendIcon trend={systolic.trend} />}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">Blood Pressure</p>
        <div className="flex items-baseline mt-1">
          <span className="text-2xl font-bold text-gray-900">
            {sysValue !== undefined ? Math.round(sysValue) : '--'}
            /
            {diaValue !== undefined ? Math.round(diaValue) : '--'}
          </span>
          {hasData && <span className="ml-1 text-sm text-gray-500">mmHg</span>}
        </div>
        {hasData && systolic?.latest && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">
              {formatRelativeTime(systolic.latest.timestamp)}
            </p>
            <SourceBadge source={systolic.latest.source} />
          </div>
        )}
        {!hasData && (
          <p className="text-xs text-gray-400 mt-1">No data</p>
        )}
      </div>
    </Card>
  );
}
