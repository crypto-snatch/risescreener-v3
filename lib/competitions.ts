// RISEx trading competitions — public, unauthenticated endpoints on api.rise.trade.
//   /v1/competitions                      list (id, slug, name, window, prize pool, state)
//   /v1/competitions/{slug}               detail (prize table, scoring config, total volume)
//   /v1/competitions/{slug}/leaderboard   ranked rows
// Lookups are by slug; the numeric id returns 404. Every call fails soft so the
// Events page still renders when RISEx is slow or changes a field.

import { RISEX_API } from "./constants";

const nz = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

async function get<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const response = await fetch(`${RISEX_API}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return ((await response.json()) as { data?: T }).data ?? null;
  } catch {
    return null;
  }
}

function parseJson(text: unknown): Record<string, unknown> {
  if (typeof text !== "string" || !text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type CompetitionPhase = "live" | "upcoming" | "ended";

export interface Competition {
  slug: string;
  name: string;
  start: number; // ms
  end: number; // ms
  prizePool: number; // USD, 0 when RISEx does not publish one
  participants: number;
  phase: CompetitionPhase;
}

export interface ScoreWeight {
  label: "Volume" | "PnL" | "Open interest";
  weight: number; // 0..1
}

export interface CompetitionDetail {
  totalVolume: number;
  weights: ScoreWeight[];
  tracks: string[];
  qualifyingVolume: number;
  minVolume: number;
}

export interface LeaderRow {
  rank: number;
  address: string;
  name: string;
  score: number;
  volume: number;
  pnl: number;
  roiPct: number;
  qualified: boolean;
}

export interface Leaderboard {
  rows: LeaderRow[];
  total: number;
  updatedAt: number; // ms
}

// Internal test brackets RISEx leaves in the public list.
const HIDDEN = /(^|-)internal($|-)/;

interface RawCompetition {
  slug?: string;
  name?: string;
  start_time?: string;
  end_time?: string;
  prize_pool?: string;
  participant_count?: number;
}

function phaseOf(start: number, end: number, now: number): CompetitionPhase {
  if (now < start) return "upcoming";
  return now >= end ? "ended" : "live";
}

export async function getCompetitions(now = Date.now()): Promise<Competition[]> {
  const data = await get<{ competitions?: RawCompetition[] }>("/v1/competitions", 60);
  const list = Array.isArray(data?.competitions) ? data.competitions : [];
  return list
    .filter((raw) => raw.slug && raw.name && !HIDDEN.test(raw.slug))
    .map((raw) => {
      const start = nz(raw.start_time) * 1000;
      const end = nz(raw.end_time) * 1000;
      return {
        slug: String(raw.slug),
        name: String(raw.name).trim(),
        start,
        end,
        prizePool: nz(raw.prize_pool),
        participants: nz(raw.participant_count),
        // The API keeps "live" for a while after the window closes; trust the clock.
        phase: phaseOf(start, end, now),
      };
    })
    .filter((competition) => competition.start > 0 && competition.end > competition.start)
    .sort((a, b) => b.start - a.start);
}

export async function getCompetitionDetail(slug: string, revalidate = 120): Promise<CompetitionDetail | null> {
  const data = await get<{ scoring_config_json?: string; total_volume?: string }>(
    `/v1/competitions/${encodeURIComponent(slug)}`,
    revalidate,
  );
  if (!data) return null;
  const scoring = parseJson(data.scoring_config_json);
  const weights: ScoreWeight[] = (
    [
      { label: "Volume", weight: nz(scoring.volume_weight) },
      { label: "PnL", weight: nz(scoring.pnl_weight) },
      { label: "Open interest", weight: nz(scoring.oi_weight) },
    ] satisfies ScoreWeight[]
  ).filter((entry) => entry.weight > 0);
  return {
    totalVolume: nz(data.total_volume),
    weights,
    tracks: Array.isArray(scoring.tracks) ? scoring.tracks.map(String) : [],
    qualifyingVolume: nz(scoring.qualifying_volume),
    minVolume: nz(scoring.min_volume_usd),
  };
}

interface RawRow {
  rank?: string;
  address?: string;
  username?: string;
  trading_score?: string;
  window_volume?: string;
  realized_pnl?: string;
  roi_percent?: string;
  qualified?: boolean;
}

export async function getCompetitionLeaderboard(slug: string, limit = 10, revalidate = 60): Promise<Leaderboard> {
  const data = await get<{ rows?: RawRow[]; total?: number; updated_at?: number | string }>(
    `/v1/competitions/${encodeURIComponent(slug)}/leaderboard?limit=${Math.max(1, Math.min(100, limit))}`,
    revalidate,
  );
  const rows = (Array.isArray(data?.rows) ? data.rows : []).slice(0, limit).map((raw, index) => ({
    rank: nz(raw.rank) || index + 1,
    address: String(raw.address ?? ""),
    name: String(raw.username ?? "").trim(),
    score: nz(raw.trading_score),
    volume: nz(raw.window_volume),
    pnl: nz(raw.realized_pnl),
    roiPct: nz(raw.roi_percent),
    qualified: raw.qualified !== false,
  }));
  return { rows, total: nz(data?.total), updatedAt: nz(data?.updated_at) * 1000 };
}
