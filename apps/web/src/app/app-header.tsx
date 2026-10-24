"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMeta } from "@/shared/api/queries";
import { formatDate } from "@/shared/format";
import { useReminders } from "@/features/reminders/queries";

export function AppHeader() {
  const pathname = usePathname();
  const meta = useMeta();
  const reminders = useReminders("OPEN");
  const openCount = reminders.data?.length;

  const linkClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-white/15 text-white" : "text-nobre-100/80 hover:text-white"}`;

  return (
    <header className="flex h-14 items-center justify-between bg-nobre-900 px-6 text-white">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight">
          Nobre <span className="font-normal text-nobre-100/70">CRM</span>
        </Link>
        <nav className="flex gap-1" aria-label="Principal">
          <Link href="/" className={linkClass(pathname === "/")} aria-current={pathname === "/" ? "page" : undefined}>
            Funil
          </Link>
          <Link href="/lembretes" className={linkClass(pathname === "/lembretes")} aria-current={pathname === "/lembretes" ? "page" : undefined}>
            Lembretes
            {openCount ? (
              <span className="ml-1.5 rounded-full bg-alert-600 px-1.5 py-0.5 text-xs text-white">{openCount}</span>
            ) : null}
          </Link>
        </nav>
      </div>
      {meta.data ? (
        <p className="text-sm text-nobre-100/80" title={meta.data.isTodayFixed ? "Data fixa do case, para os cálculos baterem com o enunciado" : undefined}>
          Hoje: <span className="font-mono text-white">{formatDate(meta.data.today)}</span>
          {meta.data.isTodayFixed ? <span className="ml-1.5 text-xs">(data do case)</span> : null}
        </p>
      ) : null}
    </header>
  );
}
