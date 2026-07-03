export default function Panel({ title, right, children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-soc-border bg-soc-panel ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-soc-border px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            {title}
          </h2>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
