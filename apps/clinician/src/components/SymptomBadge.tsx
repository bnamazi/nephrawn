'use client';

import { cn } from '@/lib/utils';

interface SymptomBadgeProps {
  name: string;
  severity: number;
  isAppetite?: boolean;
  extra?: string;
}

const SEVERITY_CONFIG = {
  0: { label: 'None', color: 'bg-gray-100 text-gray-600' },
  1: { label: 'Mild', color: 'bg-yellow-100 text-yellow-700' },
  2: { label: 'Moderate', color: 'bg-orange-100 text-orange-700' },
  3: { label: 'Severe', color: 'bg-red-100 text-red-700' },
} as const;

const APPETITE_CONFIG = {
  0: { label: 'None', color: 'bg-red-100 text-red-700' },
  1: { label: 'Poor', color: 'bg-orange-100 text-orange-700' },
  2: { label: 'Fair', color: 'bg-yellow-100 text-yellow-700' },
  3: { label: 'Good', color: 'bg-green-100 text-green-700' },
} as const;

export default function SymptomBadge({ name, severity, isAppetite = false, extra }: SymptomBadgeProps) {
  const config = isAppetite ? APPETITE_CONFIG : SEVERITY_CONFIG;
  const level = config[severity as keyof typeof config] || config[0];

  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 mb-1">{name}</span>
      <span className={cn('text-xs px-2 py-1 rounded font-medium inline-block', level.color)}>
        {level.label}
        {extra && <span className="font-normal ml-1">({extra})</span>}
      </span>
    </div>
  );
}

export const SYMPTOM_DISPLAY_NAMES: Record<string, string> = {
  edema: 'Swelling',
  fatigue: 'Fatigue',
  shortnessOfBreath: 'Shortness of Breath',
  nausea: 'Nausea',
  appetite: 'Appetite',
  pain: 'Pain',
};
