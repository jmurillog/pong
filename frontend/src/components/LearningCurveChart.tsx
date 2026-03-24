'use client';

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  timestep: number;
  mean_return_1M?: number;
  se_upper_1M?: number;
  se_lower_1M?: number;
  mean_return_5M?: number;
  se_upper_5M?: number;
  se_lower_5M?: number;
}

interface LearningCurveChartProps {
  data: DataPoint[];
  humanBaseline?: number | null;
}

function formatSteps(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return `${value}`;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: number;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, padding: '8px 12px' }} className="text-xs">
      <p className="text-zinc-400 mb-1.5 font-mono">Step: {formatSteps(label ?? 0)}</p>
      {payload.map((entry) => {
        if (entry.name.includes('Band')) return null;
        return (
          <p key={entry.name} style={{ color: entry.color }} className="font-mono">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        );
      })}
    </div>
  );
};

export default function LearningCurveChart({ data, humanBaseline }: LearningCurveChartProps) {
  const has1M = data.some((d) => d.mean_return_1M !== undefined);
  const has5M = data.some((d) => d.mean_return_5M !== undefined);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-zinc-900 border border-zinc-800 rounded-lg">
        <p className="text-sm text-zinc-500">No training data available yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="timestep"
          tickFormatter={formatSteps}
          stroke="#27272a"
          tick={{ fill: '#71717a', fontSize: 11 }}
          label={{
            value: 'Training Steps',
            position: 'insideBottom',
            offset: -5,
            fill: '#71717a',
            fontSize: 11,
          }}
        />
        <YAxis
          domain={[-21, 21]}
          stroke="#27272a"
          tick={{ fill: '#71717a', fontSize: 11 }}
          label={{
            value: 'Mean Episodic Return',
            angle: -90,
            position: 'insideLeft',
            offset: 10,
            fill: '#71717a',
            fontSize: 11,
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ color: '#71717a', fontSize: 11, paddingTop: '12px' }}
          formatter={(value: string) => <span style={{ color: '#71717a' }}>{value}</span>}
        />
        <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 4" />

        {humanBaseline != null && (
          <ReferenceLine
            y={humanBaseline}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            label={{
              value: `Human: ${humanBaseline.toFixed(1)}`,
              position: 'right',
              fill: '#f59e0b',
              fontSize: 11,
            }}
          />
        )}

        {has1M && (
          <>
            <Area
              type="monotone"
              dataKey="se_upper_1M"
              fill="#3b82f6"
              stroke="none"
              fillOpacity={0.2}
              name="1M SE Band"
              legendType="none"
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="se_lower_1M"
              fill="#09090b"
              stroke="none"
              fillOpacity={1}
              name="1M SE Band Lower"
              legendType="none"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="mean_return_1M"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={data.length < 10 ? { fill: '#3b82f6', r: 3 } : false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
              name="1M Budget"
              connectNulls
            />
          </>
        )}

        {has5M && (
          <>
            <Area
              type="monotone"
              dataKey="se_upper_5M"
              fill="#10b981"
              stroke="none"
              fillOpacity={0.2}
              name="5M SE Band"
              legendType="none"
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="se_lower_5M"
              fill="#09090b"
              stroke="none"
              fillOpacity={1}
              name="5M SE Band Lower"
              legendType="none"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="mean_return_5M"
              stroke="#10b981"
              strokeWidth={2}
              dot={data.length < 10 ? { fill: '#10b981', r: 3 } : false}
              activeDot={{ r: 4, fill: '#10b981' }}
              name="5M Budget"
              connectNulls
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
