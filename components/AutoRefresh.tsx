"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const LIVE_ROUTES = [
  "/overview",
  "/markets",
  "/funding",
  "/open-interest",
  "/rwa",
  "/traders",
  "/liquidations",
  "/heatmap",
];

/** Refreshes server-component data in place while the tab is visible. */
export default function AutoRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isLive = LIVE_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    const intervalMs = isLive ? 30_000 : 120_000;
    let timer: number | undefined;

    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const schedule = () => {
      window.clearInterval(timer);
      timer = window.setInterval(refresh, intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        schedule();
      } else {
        window.clearInterval(timer);
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname, router]);

  return null;
}
