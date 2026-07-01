import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Daily-recap snapshot frozen at UTC 00:00 by scripts/snapshot-summary.mjs.
// The Summary page prefers this (stable for the day); if absent it falls back
// to a live computation. Set SUMMARY_URL to the raw GitHub URL in production,
// else the bundled data/summary.json is read.
export type Kpi = { label: string; value: string; delta?: string; tone?: "pos" | "neg" };
export type Top = { title: string; rows: { m: string; a: string; v: string }[] };
export interface Summary {
  generatedAt: string;
  date: string;
  raw: Record<string, number>;
  kpis24: Kpi[];
  kpisTotal: Kpi[];
  tops: Top[];
  text: string;
}

// Default to the public raw URL so production reads the daily-committed snapshot
// without needing an env var; SUMMARY_URL overrides, local file is last resort.
const RAW_URL = "https://raw.githubusercontent.com/crypto-snatch/risescreener/main/data/summary.json";

let cache: { at: number; data: Summary | null } | null = null;

export async function getSummary(): Promise<Summary | null> {
  if (cache && Date.now() - cache.at < 30_000) return cache.data;
  const url = process.env.SUMMARY_URL || RAW_URL;
  try {
    let raw: string;
    try {
      const r = await fetch(url, { next: { revalidate: 300 } });
      if (!r.ok) throw new Error(`summary ${r.status}`);
      raw = await r.text();
    } catch {
      raw = await readFile(join(process.cwd(), "data", "summary.json"), "utf8");
    }
    const data = JSON.parse(raw) as Summary;
    cache = { at: Date.now(), data };
    return data;
  } catch {
    cache = { at: Date.now(), data: null };
    return null;
  }
}
