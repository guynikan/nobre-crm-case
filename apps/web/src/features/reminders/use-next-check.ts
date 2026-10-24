"use client";

import { useEffect, useState } from "react";

/**
 * Time left until the scheduler runs again, as "m:ss".
 *
 * A cron of "every N minutes" fires on the minutes past the hour that N divides, so
 * the next run is the next such boundary. It reads the viewer's clock, which makes
 * this an estimate rather than a promise: a browser minutes out of step with the
 * server shows a countdown just as far out of step.
 */
export function useNextCheck(intervalMinutes: number | null | undefined): string | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (!intervalMinutes) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [intervalMinutes]);

  if (!intervalMinutes || now === null) return null;

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(Math.floor(now.getMinutes() / intervalMinutes) * intervalMinutes + intervalMinutes);

  const totalSeconds = Math.max(0, Math.round((next.getTime() - now.getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
