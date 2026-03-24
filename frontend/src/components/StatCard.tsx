interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

export default function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-2xl font-mono font-semibold text-white">{value}</div>
      {subtitle && (
        <div className="text-xs text-zinc-600 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
