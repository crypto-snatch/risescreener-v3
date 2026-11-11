"use client";

import { useEffect, useState } from "react";

const pad = (value: number) => String(value).padStart(2, "0");

/** Ticking time-left label. `now` is the server render time, used until hydration. */
export default function Countdown({ target, now }: { target: number; now: number }) {
  const [clock, setClock] = useState(now);
  useEffect(() => {
    const update = () => setClock(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const left = Math.max(0, Math.floor((target - clock) / 1000));
  if (left <= 0) return <span className="tnum">Closing…</span>;
  const days = Math.floor(left / 86_400);
  const hours = Math.floor((left % 86_400) / 3_600);
  const minutes = Math.floor((left % 3_600) / 60);
  const seconds = left % 60;
  return (
    <span className="tnum" suppressHydrationWarning>
      {days > 0 ? `${days}d ` : ""}{pad(hours)}h {pad(minutes)}m {pad(seconds)}s
    </span>
  );
}
