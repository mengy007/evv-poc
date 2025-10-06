export default function DeviceCard({
  label,
  value,
  copy = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b last:border-b-0">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="text-right break-all text-sm font-mono">
        <span>{value || "—"}</span>
        {copy && value ? (
          <button
            className="ml-2 text-xs rounded-md px-2 py-1 bg-slate-200 hover:bg-slate-300 active:bg-slate-400"
            onClick={() => navigator.clipboard?.writeText(value)}
          >
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}
