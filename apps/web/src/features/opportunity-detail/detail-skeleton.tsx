import { Skeleton } from "@/shared/ui/states";

export function DrawerShell({ children, onClose, labelledBy }: { children: React.ReactNode; onClose?: () => void; labelledBy?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar detalhes" className="flex-1 cursor-default bg-ink/30" onClick={onClose} tabIndex={-1} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="h-full w-[34rem] max-w-full overflow-y-auto border-l border-line bg-panel shadow-2xl"
      >
        {children}
      </aside>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <DrawerShell>
      <div className="space-y-4 p-6" aria-busy>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
        <Skeleton className="h-40" />
        <span className="sr-only">Carregando detalhes da oportunidade</span>
      </div>
    </DrawerShell>
  );
}
