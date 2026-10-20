import type { Metadata } from "next";
import { Suspense } from "react";
import { RemindersPage } from "@/features/reminders/reminders-page";
import { Spinner } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Lembretes · Nobre CRM" };

export default function Reminders() {
  return (
    <Suspense fallback={<div className="p-6"><Spinner /></div>}>
      <RemindersPage />
    </Suspense>
  );
}
