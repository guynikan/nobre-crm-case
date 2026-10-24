"use client";

import { useEffect, useState } from "react";

/**
 * Time left until the scheduler runs again, rounded up to whole minutes.
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
    const update = () => setNow(new Date());
    update();

    const untilNextMinute = 60_000 - (Date.now() % 60_000);
    const firstTick = setTimeout(() => {
      update();
      const timer = setInterval(update, 60_000);
      tickTimer = timer;
    }, untilNextMinute);
    let tickTimer: ReturnType<typeof setInterval> | undefined;

    return () => {
      clearTimeout(firstTick);
      if (tickTimer) clearInterval(tickTimer);
    };
  }, [intervalMinutes]);

  if (!intervalMinutes || now === null) return null;

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(Math.floor(now.getMinutes() / intervalMinutes) * intervalMinutes + intervalMinutes);

  const minutes = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}
