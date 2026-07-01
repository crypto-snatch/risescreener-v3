import { WAD } from "./constants";

// Convert a 1e18-scaled decimal string to a JS number (display precision only).
export function fromWad(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return n / WAD;
}

export function num(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function usd(n: number, opts: { sign?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = opts.sign && n > 0 ? "+" : n < 0 ? "−" : "";
  const a = Math.abs(n);
  let body: string;
  if (a >= 1e9) body = (a / 1e9).toFixed(2) + "B";
  else if (a >= 1e6) body = (a / 1e6).toFixed(2) + "M";
  else if (a >= 1e3) body = (a / 1e3).toFixed(1) + "K";
  else body = a.toFixed(2);
  return `${sign}$${body}`;
}

export function usdFull(n: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? "+" : "";
  return `${sign}$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function price(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function shortAddr(a: string): string {
  if (!a || a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h: string): string {
  return h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—";
}

export function isAddress(a: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(a.trim());
}

// RISEx timestamps come in nanoseconds (string). Convert to ms.
export function nsToMs(ns: string | number): number {
  const n = typeof ns === "number" ? ns : Number(ns);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n / 1_000_000);
}

// millisecond-precision "ago" for the fast block/tx explorer feed.
// Shows raw ms (e.g. "342 ms ago") up to 10s so the feed reads like the
// reference explorer; falls back to s / m / h beyond that.
export function msAgo(ms: number): string {
  if (!ms) return "";
  const d = Math.max(0, Date.now() - ms);
  if (d < 1000) return `${d}ms ago`;
  if (d < 60_000) return `${(d / 1000).toFixed(1)}s ago`;
  if (d < 3.6e6) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3.6e6)}h ago`;
}

export function timeAgo(ms: number): string {
  if (!ms) return "";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
