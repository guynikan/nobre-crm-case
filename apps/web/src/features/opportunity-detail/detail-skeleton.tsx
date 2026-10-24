"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Skeleton } from "@/shared/ui/states";

export function DrawerShell({
  children,
  onClose,
  labelledBy,
  label,
  dialogRef,
}: {
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
  label?: string;
  dialogRef?: RefObject<HTMLDialogElement | null>;
}) {
  const internalRef = useRef<HTMLDialogElement>(null);
  const ref = dialogRef ?? internalRef;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [ref]);

  function requestClose() {
    if (ref.current?.open) ref.current.close();
    else onClose?.();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className="fixed inset-y-0 right-0 m-0 h-dvh max-h-dvh w-[34rem] max-w-full overflow-y-auto rounded-none border-y-0 border-r-0 border-b-0 border-l border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-ink/30"
    >
      {children}
    </dialog>
  );
}

export function DetailSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <DrawerShell onClose={onClose} label="Carregando detalhes da oportunidade">
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
