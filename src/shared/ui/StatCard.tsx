interface StatCardProps {
  label: string;
  value: string | number;
  detail: string;
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="eyebrow">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}
