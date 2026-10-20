import type { ReactNode } from "react";

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-nobre-500" aria-hidden />
      {label}
    </span>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string | undefined; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger-600/30 bg-danger-100 p-6 text-danger-600">
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-1 text-sm">{detail}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-4 rounded-md bg-danger-600 px-3 py-1.5 text-sm font-medium text-white">
          Tentar de novo
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel/60 p-8 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line/60 ${className}`} aria-hidden />;
}
