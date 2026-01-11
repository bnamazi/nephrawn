'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartPoint, BloodPressureChartPoint, getSourceLabel } from '@/lib/types';

interface MeasurementChartProps {
  data: ChartPoint[];
  unit: string;
  color?: string;
  title?: string;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MeasurementChart({
  data,
  unit,
  color = '#3B82F6',
  title,
}: MeasurementChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    date: formatDate(point.timestamp),
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
            domain={['auto', 'auto']}
            unit={` ${unit}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload[0]) {
                const point = payload[0].payload as ChartPoint & { date: string };
                const isDevice = point.source?.toLowerCase() !== 'manual';
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateTime(point.timestamp)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {typeof payload[0].value === 'number'
                        ? `${payload[0].value.toFixed(1)} ${unit}`
                        : payload[0].value}
                    </p>
                    <p className={`text-xs mt-1 ${isDevice ? 'text-blue-600' : 'text-gray-500'}`}>
                      {getSourceLabel(point.source)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Blood Pressure Chart with two lines
interface BloodPressureChartProps {
  data: BloodPressureChartPoint[];
  title?: string;
}

export function BloodPressureChart({ data, title }: BloodPressureChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No blood pressure data available</p>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    date: formatDate(point.timestamp),
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
            domain={['auto', 'auto']}
            unit=" mmHg"
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length >= 2) {
                const point = payload[0].payload as BloodPressureChartPoint & { date: string };
                const isDevice = point.source?.toLowerCase() !== 'manual';
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateTime(point.timestamp)}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-sm">
                        <span className="text-red-600">Systolic:</span>{' '}
                        <span className="font-medium">{Math.round(point.systolic)} mmHg</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-blue-600">Diastolic:</span>{' '}
                        <span className="font-medium">{Math.round(point.diastolic)} mmHg</span>
                      </p>
                    </div>
                    <p className={`text-xs mt-1 ${isDevice ? 'text-blue-600' : 'text-gray-500'}`}>
                      {getSourceLabel(point.source)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="systolic"
            name="Systolic"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            name="Diastolic"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
