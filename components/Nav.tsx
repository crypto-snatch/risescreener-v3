"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import TxSearch from "@/components/TxSearch";
import { price } from "@/lib/format";

export interface TickerMarket {
  id: string;
  symbol: string;
  mark: number;
  changePct: number;
}

type NavItem = {
  href: string;
  label: string;
  short: string;
  group: "Pulse" | "Markets" | "People" | "Protocol" | "World";
  icon: IconName;
  keywords?: string;
};

// one-line descriptions shown when the rail expands on hover
const RAIL_DESC: Record<string, string> = {
  "/overview": "Live market pulse, volume & OI",
  "/markets": "Prices, OI & 24h screener",
  "/rwa": "Commodities, stocks & ETFs",
  "/traders": "Top wallets by PnL & volume",
  "/liquidations": "Liquidation feed & risk map",
  "/network": "Blocks, TPS & shreds",
  "/global": "Crypto market & chain TVL",
  "/ecosystem": "Apps & projects on RISE",
};

type IconName =
  | "pulse"
  | "markets"
  | "rwa"
  | "funding"
  | "oi"
  | "people"
  | "risk"
  | "network"
  | "world"
  | "ecosystem"
  | "search"
  | "command";

const ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", short: "Pulse", group: "Pulse", icon: "pulse", keywords: "home dashboard live" },
  { href: "/markets", label: "Perp markets", short: "Markets", group: "Markets", icon: "markets", keywords: "price volume screener" },
  { href: "/rwa", label: "RWA markets", short: "RWA", group: "Markets", icon: "rwa", keywords: "commodity gold silver oil stocks etf" },
  { href: "/funding", label: "Funding & carry", short: "Funding", group: "Markets", icon: "funding", keywords: "apr history rate" },
  { href: "/open-interest", label: "Open interest", short: "OI", group: "Markets", icon: "oi", keywords: "positions utilization" },
  { href: "/traders", label: "Trader leaderboard", short: "Traders", group: "People", icon: "people", keywords: "wallet pnl volume" },
  { href: "/cohorts", label: "Trader cohorts", short: "Cohorts", group: "People", icon: "people", keywords: "segments equity leverage" },
  { href: "/liquidations", label: "Liquidations", short: "Risk", group: "People", icon: "risk", keywords: "risk map feed" },
  { href: "/heatmap", label: "Position heat map", short: "Skew", group: "People", icon: "risk", keywords: "long short bias" },
  { href: "/flows", label: "Protocol flows", short: "Flows", group: "Protocol", icon: "pulse", keywords: "deposit withdrawal tvl" },
  { href: "/fees", label: "Fees & revenue", short: "Fees", group: "Protocol", icon: "funding", keywords: "protocol revenue" },
  { href: "/network", label: "RISE network", short: "Network", group: "Protocol", icon: "network", keywords: "blocks tps shreds chain" },
  { href: "/explorer", label: "Account explorer", short: "Explorer", group: "Protocol", icon: "search", keywords: "wallet address transaction" },
  { href: "/summary", label: "Shareable summary", short: "Summary", group: "Protocol", icon: "pulse", keywords: "snapshot social" },
  { href: "/global", label: "Global context", short: "Global", group: "World", icon: "world", keywords: "crypto tvl fear greed" },
  { href: "/ecosystem", label: "RISE ecosystem", short: "Ecosystem", group: "World", icon: "ecosystem", keywords: "apps projects directory" },
];

const RAIL = ["/overview", "/markets", "/rwa", "/traders", "/liquidations", "/network", "/global", "/ecosystem"];
const MOBILE = ["/overview", "/markets", "/rwa", "/ecosystem"];

function activeFor(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export default function Nav({ ticker = [] }: { ticker?: TickerMarket[] }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((item) =>
      `${item.label} ${item.short} ${item.group} ${item.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "/" && !open) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA") {
          event.preventDefault();
          setOpen(true);
        }
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => setCursor(0), [query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(results.length - 1, value + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter" && results[cursor]) {
      event.preventDefault();
      go(results[cursor].href);
    }
  };

  const railItems = RAIL.map((href) => ITEMS.find((item) => item.href === href)!).filter(Boolean);
  const mobileItems = MOBILE.map((href) => ITEMS.find((item) => item.href === href)!).filter(Boolean);
  const tape = ticker.length ? [...ticker, ...ticker] : [];

  return (
    <>
      <aside className="atlas-rail" aria-label="Primary navigation">
        <Link href="/" className="rail-mark" aria-label="Open the RiseScreener entrance">
          <span className="rail-mark-ico" aria-hidden="true">
            <Image src="/risex-logo.png" alt="" width={38} height={38} priority />
          </span>
          <span className="rail-mark-wm"><b>RISE</b>SCREENER</span>
        </Link>
        <div className="rail-route-list">
          {railItems.map((item, index) => (
            <div key={item.href} className={index === 5 ? "rail-route-wrap rail-route-break" : "rail-route-wrap"}>
              <Link
                href={item.href}
                className="rail-route"
                aria-label={item.label}
                aria-current={activeFor(path, item.href) ? "page" : undefined}
                data-active={activeFor(path, item.href)}
              >
                <span className="rail-ico"><Icon name={item.icon} /></span>
                <span className="rail-text">
                  <span className="rail-text-label">{item.label}</span>
                  <span className="rail-text-desc">{RAIL_DESC[item.href] ?? item.short}</span>
                </span>
              </Link>
            </div>
          ))}
        </div>
        <button className="rail-command" onClick={() => setOpen(true)} aria-label="Open command palette">
          <span className="rail-ico"><Icon name="command" /></span>
          <span className="rail-text">
            <span className="rail-text-label">Command palette</span>
            <span className="rail-text-desc">Search & jump · ⌘K</span>
          </span>
        </button>
      </aside>

      <header className="atlas-topbar">
        <Link href="/" className="atlas-mobile-brand" aria-label="Open the RiseScreener entrance">
          <span className="brand-pip" aria-hidden="true">
            <Image src="/risex-logo.png" alt="" width={26} height={26} priority />
          </span>
          <span className="wm"><b>RISE</b>SCREENER</span>
        </Link>
        <div className="market-ribbon" aria-label="Live RISEx market ticker">
          <div className="ribbon-status">
            <span className="live-dot"><i className="ping" /><i /></span>
            <span>RISEx</span>
          </div>
          {tape.length ? (
            <div className="ribbon-mask">
              <div className="ribbon-track">
                {tape.map((market, index) => (
                  <Link href={`/markets/${market.id}`} className="ribbon-quote" key={`${market.id}-${index}`}>
                    <b>{market.symbol}</b>
                    <span className="tnum">${price(market.mark)}</span>
                    <span className="tnum" data-tone={market.changePct >= 0 ? "up" : "down"}>
                      {market.changePct >= 0 ? "+" : ""}{market.changePct.toFixed(2)}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <span className="ribbon-empty">market feed reconnecting</span>
          )}
        </div>
        <div className="atlas-tools">
          <div className="atlas-tx-search"><TxSearch /></div>
          <button className="command-trigger" onClick={() => setOpen(true)}>
            <Icon name="search" />
            <span>Explore</span>
            <kbd>⌘K</kbd>
          </button>
          <ThemeToggle />
          <a href="https://www.rise.trade/invite/risescreener" target="_blank" rel="noreferrer" className="trade-action">
            Trade <span>↗</span>
          </a>
        </div>
      </header>

      <nav className="mobile-dock" aria-label="Mobile navigation">
        {mobileItems.map((item) => (
          <Link key={item.href} href={item.href} className="dock-route" data-active={activeFor(path, item.href)}>
            <Icon name={item.icon} />
            <span>{item.short}</span>
          </Link>
        ))}
        <button className="dock-route" onClick={() => setOpen(true)} data-active="false">
          <Icon name="command" />
          <span>More</span>
        </button>
      </nav>

      {open && (
        <div className="command-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="command-panel" role="dialog" aria-modal="true" aria-label="Navigate RiseScreener">
            <div className="command-input-wrap">
              <Icon name="search" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search markets, risk, network…"
                aria-label="Search destinations"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="command-results">
              {results.length ? (
                results.map((item, index) => {
                  const showGroup = index === 0 || results[index - 1]?.group !== item.group;
                  return (
                    <div key={item.href}>
                      {showGroup && <div className="command-group">{item.group}</div>}
                      <button
                        className="command-result"
                        data-active={cursor === index}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => go(item.href)}
                      >
                        <span className="command-result-icon"><Icon name={item.icon} /></span>
                        <span>
                          <b>{item.label}</b>
                          <small>{item.keywords?.split(" ").slice(0, 4).join(" · ")}</small>
                        </span>
                        <span className="command-arrow">↗</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="command-zero">
                  <span>No matching destination.</span>
                  <small>Try “funding”, “wallet” or “network”.</small>
                </div>
              )}
            </div>
            <footer className="command-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
              <span><kbd>↵</kbd> open</span>
              <span>RISE market atlas</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2.2-6 4.2 12 2.1-6H21" /></svg>;
  if (name === "markets") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 19h21" /></svg>;
  if (name === "rwa") return <svg {...common}><path d="M4 20V9M10 20V4M16 20v-7M22 20H2" /><path d="m3 8 6-4 6 7 6-5" /></svg>;
  if (name === "funding") return <svg {...common}><path d="M12 3v18M16.5 7.2c-.8-1-2.2-1.7-4.1-1.7-2.3 0-4 1.2-4 3 0 4.6 8.3 1.8 8.3 6.5 0 1.8-1.7 3.2-4.5 3.2-2 0-3.7-.8-4.7-2" /></svg>;
  if (name === "oi") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 8 8h-8z" /></svg>;
  if (name === "people") return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3.5 2.4-5.2 5.5-5.2s4.9 1.7 5.5 5.2M15 5.3a3 3 0 0 1 0 5.5M16.2 14c2.4.4 3.8 2 4.3 5" /></svg>;
  if (name === "risk") return <svg {...common}><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4M12 16.5h.01" /></svg>;
  if (name === "network") return <svg {...common}><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="m7.2 10.8 9.5-4.7M7.2 13.2l9.5 4.7M19 7.5v9" /></svg>;
  if (name === "world") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3c2.3 2.4 3.5 5.4 3.5 9S14.3 18.6 12 21c-2.3-2.4-3.5-5.4-3.5-9S9.7 5.4 12 3Z" /></svg>;
  if (name === "ecosystem") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M17.5 14v7M14 17.5h7" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>;
  return <svg {...common}><path d="M7 8 3 12l4 4M17 8l4 4-4 4M14 4l-4 16" /></svg>;
}
