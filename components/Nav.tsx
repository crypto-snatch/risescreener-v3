"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { href: string; label: string; desc?: string };
type Group = { label: string; href?: string; items?: Item[] };

// Grouped top-center navigation (Hyperliquid-style dropdowns).
const GROUPS: Group[] = [
  { label: "Overview", href: "/overview" },
  {
    label: "Markets",
    items: [
      { href: "/markets", label: "Perp Markets", desc: "Live prices, OI & 24h" },
      { href: "/funding", label: "Funding", desc: "Rates, APR & predicted" },
      { href: "/open-interest", label: "Open Interest", desc: "OI by market & over time" },
    ],
  },
  {
    label: "Traders",
    items: [
      { href: "/traders", label: "Leaderboard", desc: "Top by volume · PnL · OI" },
      { href: "/cohorts", label: "Cohorts", desc: "Segments by equity" },
    ],
  },
  {
    label: "Risk",
    items: [
      { href: "/liquidations", label: "Liquidations", desc: "Liq flow & at-risk" },
      { href: "/heatmap", label: "Position Heat Map", desc: "Long / short bias by market" },
      { href: "/flows", label: "Flows", desc: "Deposits & withdrawals" },
    ],
  },
  {
    label: "Protocol",
    items: [
      { href: "/fees", label: "Fees & Revenue", desc: "Fees, revenue & breakdown" },
      { href: "/network", label: "Network", desc: "RISE chain metrics" },
      { href: "/explorer", label: "Explorer", desc: "Any wallet, positions & fills" },
    ],
  },
  { label: "Summary", href: "/summary" },
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // close on route change
  useEffect(() => setOpen(null), [path]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const isActive = (g: Group) =>
    g.href ? (g.href === "/" ? path === "/" : path.startsWith(g.href)) : !!g.items?.some((i) => path.startsWith(i.href));

  return (
    <div className="navbar" data-component="nav" ref={ref}>
      {GROUPS.map((g) =>
        g.href ? (
          <Link key={g.label} href={g.href} className="navtrigger" data-active={isActive(g)}>
            {g.label}
          </Link>
        ) : (
          <div
            key={g.label}
            className="navgroup"
            onMouseEnter={() => setOpen(g.label)}
            onMouseLeave={() => setOpen((o) => (o === g.label ? null : o))}
          >
            <button
              className="navtrigger"
              data-active={isActive(g)}
              data-open={open === g.label}
              onClick={() => setOpen((o) => (o === g.label ? null : g.label))}
            >
              {g.label}
              <svg className="navcaret" width="9" height="9" viewBox="0 0 10 10" aria-hidden>
                <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open === g.label && g.items && (
              <div className="navmenu">
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} className="navitem" data-active={path.startsWith(i.href)}>
                    <span className="navitem-label">{i.label}</span>
                    {i.desc && <span className="navitem-desc">{i.desc}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}
