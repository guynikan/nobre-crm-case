"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog>: focus trap, Esc to close and backdrop come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="p-5">
        <h2 id="dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}
