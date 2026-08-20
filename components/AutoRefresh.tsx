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

    // A refresh re-renders the whole (chart-heavy) tree. Landing one on top of a
    // tap makes the bottom dock feel unresponsive, so drop a tick that arrives
    // right after the user touched the screen — the next one picks it up.
    let lastTouch = 0;
    const onInteract = () => { lastTouch = performance.now(); };

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (performance.now() - lastTouch < 1500) return;
      router.refresh();
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
    window.addEventListener("pointerdown", onInteract, { passive: true });
    window.addEventListener("touchstart", onInteract, { passive: true });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("touchstart", onInteract);
    };
  }, [pathname, router]);

  return null;
}
