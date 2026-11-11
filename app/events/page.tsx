import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import "./events.css";
import PageHeader from "@/components/PageHeader";
import { Empty, Panel, SectionLabel } from "@/components/ui";
import Arcade from "@/components/events/Arcade";
import Countdown from "@/components/events/Countdown";
import { getMarketRows, isUpcoming } from "@/lib/analytics";
import {
  getCompetitionDetail, getCompetitionLeaderboard, getCompetitions,
  type Competition, type CompetitionDetail, type Leaderboard,
} from "@/lib/competitions";
import { COMPETITION_GUIDES } from "@/lib/competition-guides";
import { shortAddr, usd } from "@/lib/format";
import { getCandles } from "@/lib/market-data";

export const revalidate = 60;
export const metadata = { title: "Events — RiseScreener" };

const RISEX_COMPETITIONS = "https://www.rise.trade/competition";
const ARCADE_MARKETS = 6;

const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const dayYear = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const windowLabel = (competition: Competition) => `${day.format(competition.start)} – ${dayYear.format(competition.end)}`;
const pct = (value: number) => `${Math.round(value * 100)}%`;
// Prize pools and thresholds are round figures: "$50,000" reads better than "$50.0K".
const dollars = (value: number) => (value < 1_000_000 && Number.isInteger(value) ? `$${value.toLocaleString("en-US")}` : usd(value));

interface LiveEntry { competition: Competition; detail: CompetitionDetail | null; board: Leaderboard }

export default async function EventsPage() {
  const now = Date.now();
  const competitions = await getCompetitions(now);
  const live = competitions
    .filter((competition) => competition.phase === "live")
    .sort((a, b) => b.prizePool - a.prizePool || b.participants - a.participants);
  const upcoming = competitions.filter((competition) => competition.phase === "upcoming").sort((a, b) => a.start - b.start);
  const ended = competitions.filter((competition) => competition.phase === "ended").sort((a, b) => b.end - a.end);

  const [liveEntries, winners, candleSets] = await Promise.all([
    Promise.all(live.map(async (competition, index): Promise<LiveEntry> => {
      const [detail, board] = await Promise.all([
        getCompetitionDetail(competition.slug),
        getCompetitionLeaderboard(competition.slug, index === 0 ? 10 : 3),
      ]);
      return { competition, detail, board };
    })),
    // Final standings never change, so the winner lookups are cached for an hour.
    Promise.all(ended.map((competition) => getCompetitionLeaderboard(competition.slug, 1, 3600))),
    loadArcadeCandles(),
  ]);
  const [featured, ...others] = liveEntries;

  return (
    <div className="screen" data-page="events" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="RISE / Events"
        title="Events & arcade"
        description="Live RISEx trading competitions with current standings, plus four pixel mini-games built around the RISEx mark."
        cadence="Auto refresh · 2m"
      >
        <a href={RISEX_COMPETITIONS} target="_blank" rel="noreferrer" className="chip">Competitions on RISEx ↗</a>
      </PageHeader>

      <section>
        <SectionLabel right={<span className="events-count tnum">{live.length} running{upcoming.length ? ` · ${upcoming.length} upcoming` : ""}</span>}>
          Trading competitions
        </SectionLabel>
        {featured ? (
          <FeaturedCompetition entry={featured} now={now} />
        ) : (
          <Empty>
            No competition is running right now{competitions.length ? "" : ", or the RISEx competition feed is not responding"}.{" "}
            <a href={RISEX_COMPETITIONS} target="_blank" rel="noreferrer" className="mono-link">Check RISEx ↗</a>
          </Empty>
        )}
        {(others.length > 0 || upcoming.length > 0) && (
          <div className="events-grid">
            {others.map((entry) => <CompetitionCard key={entry.competition.slug} entry={entry} now={now} />)}
            {upcoming.map((competition) => (
              <Panel key={competition.slug} className="events-card">
                <div className="events-card-head">
                  <span className="chip events-tag">Upcoming</span>
                  <span className="events-card-time">Starts in <Countdown target={competition.start} now={now} /></span>
                </div>
                <h3>{competition.name}</h3>
                <p className="events-card-meta">{windowLabel(competition)}{competition.prizePool > 0 ? ` · ${dollars(competition.prizePool)} prize pool` : ""}</p>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel right={<span className="events-count">Scores are saved in this browser only</span>}>Pixel arcade</SectionLabel>
        <Panel>
          <Arcade candleSets={candleSets} />
        </Panel>
      </section>

      {ended.length > 0 && (
        <section>
          <SectionLabel right={<span className="events-count tnum">{ended.length} finished</span>}>Past competitions</SectionLabel>
          <Panel style={{ overflowX: "auto" }}>
            <table className="events-table" style={{ minWidth: 620 }}>
              <thead>
                <tr><th>Competition</th><th>Window (UTC)</th><th className="r">Prize pool</th><th className="r">Traders</th><th>Winner</th></tr>
              </thead>
              <tbody>
                {ended.map((competition, index) => {
                  const winner = winners[index]?.rows[0];
                  return (
                    <tr key={competition.slug}>
                      <td>{competition.name}</td>
                      <td className="tnum muted">{windowLabel(competition)}</td>
                      <td className="tnum r">{competition.prizePool > 0 ? dollars(competition.prizePool) : "—"}</td>
                      <td className="tnum r">{competition.participants.toLocaleString("en-US")}</td>
                      <td>{winner ? <Trader address={winner.address} name={winner.name} /> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </section>
      )}
    </div>
  );
}

// Real 5-minute candles for the "Long or Short" cabinet: the busiest markets,
// 24 hours each. Fails soft — the game falls back to a practice tape.
async function loadArcadeCandles() {
  try {
    const rows = (await getMarketRows())
      .filter((row) => !isUpcoming(row) && row.mark > 0)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, ARCADE_MARKETS);
    const sets = await Promise.all(rows.map(async (row) => ({
      symbol: row.symbol,
      candles: (await getCandles(row.marketId, "5m", 288).catch(() => [])).map((candle) => ({
        o: candle.o, h: candle.h, l: candle.l, c: candle.c,
      })),
    })));
    return sets.filter((set) => set.candles.length >= 60);
  } catch {
    return [];
  }
}

function Trader({ address, name }: { address: string; name: string }) {
  const label = name || shortAddr(address);
  return address ? <Link href={`/address/${address}`} className="events-trader">{label}</Link> : <span>{label}</span>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="events-fact"><span>{label}</span><b className="tnum">{children}</b></div>;
}

function scoringNote(detail: CompetitionDetail | null) {
  if (!detail) return null;
  const parts: string[] = [];
  if (!detail.weights.length && detail.tracks.length) parts.push(`Ranked by ${detail.tracks.map((track) => track.toUpperCase()).join(" and ")}`);
  if (detail.qualifyingVolume > 0) parts.push(`Qualify at ${dollars(detail.qualifyingVolume)} volume`);
  if (detail.minVolume > 0) parts.push(`Minimum ${dollars(detail.minVolume)} volume`);
  return parts.length ? parts.join(" · ") : null;
}

function Standings({ board, compact }: { board: Leaderboard; compact?: boolean }) {
  if (!board.rows.length) return <p className="events-card-meta">Standings are not published yet.</p>;
  // Weighted competitions rank on a composite score; track-based ones publish ROI instead.
  const byScore = board.rows.some((row) => row.score > 0);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="events-table" style={compact ? undefined : { minWidth: 520 }}>
        <thead>
          <tr>
            <th style={{ width: 34 }}>#</th><th>Trader</th>
            <th className="r">{byScore ? "Score" : "ROI"}</th>
            <th className="r">Volume</th>
            {!compact && <th className="r">Realized PnL</th>}
          </tr>
        </thead>
        <tbody>
          {board.rows.map((row) => (
            <tr key={`${row.rank}-${row.address}`} data-pending={!row.qualified}>
              <td className="tnum muted">{row.rank}</td>
              <td><Trader address={row.address} name={row.name} /></td>
              <td className="tnum r">{byScore ? row.score.toFixed(1) : `${row.roiPct >= 0 ? "+" : "−"}${Math.abs(row.roiPct).toFixed(1)}%`}</td>
              <td className="tnum r">{usd(row.volume)}</td>
              {!compact && <td className="tnum r" style={{ color: row.pnl >= 0 ? "var(--long)" : "var(--short)" }}>{usd(row.pnl, { sign: true })}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeaturedCompetition({ entry, now }: { entry: LiveEntry; now: number }) {
  const { competition, detail, board } = entry;
  const elapsed = Math.max(0, Math.min(1, (now - competition.start) / (competition.end - competition.start)));
  const note = scoringNote(detail);
  const guide = COMPETITION_GUIDES[competition.slug];
  return (
    <Panel className="events-hero">
      <div className="events-hero-top">
        <div>
          <span className="chip tag-accent events-tag"><span className="live-dot"><i className="ping" /><i /></span>Live</span>
          <h2>{competition.name}</h2>
          <p className="events-card-meta">{windowLabel(competition)} UTC</p>
        </div>
        <div className="events-hero-clock">
          <span>Ends in</span>
          <b><Countdown target={competition.end} now={now} /></b>
          <a href={RISEX_COMPETITIONS} target="_blank" rel="noreferrer" className="trade-action events-join">Join on RISEx ↗</a>
        </div>
      </div>

      <div className="events-progress" role="img" aria-label={`${pct(elapsed)} of the competition window has passed`}>
        <i style={{ width: pct(elapsed) }} />
      </div>

      <div className="events-facts">
        <Fact label="Prize pool">{competition.prizePool > 0 ? dollars(competition.prizePool) : "—"}</Fact>
        <Fact label="Traders">{competition.participants.toLocaleString("en-US")}</Fact>
        <Fact label="Competition volume">{detail && detail.totalVolume > 0 ? usd(detail.totalVolume) : "—"}</Fact>
        <Fact label="Ranked accounts">{board.total > 0 ? board.total.toLocaleString("en-US") : "—"}</Fact>
      </div>

      {detail && detail.weights.length > 0 && (
        <div className="events-weights">
          <span className="events-weights-label">Score mix</span>
          <div className="events-weights-bar">
            {detail.weights.map((entry, index) => (
              <span key={entry.label} style={{ flexGrow: entry.weight }} data-slot={index}>{entry.label} {pct(entry.weight)}</span>
            ))}
          </div>
        </div>
      )}
      {note && <p className="events-card-meta">{note}</p>}

      {guide && (
        <div className="events-guide">
          <div className="events-board-head"><span>{guide.title}</span><span>Official RISEx cards</span></div>
          <div className="events-guide-images">
            {guide.images.map((image) => (
              <a key={image.src} href={image.src} target="_blank" rel="noreferrer" aria-label="Open the full-size card">
                <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 760px) 100vw, 560px" />
              </a>
            ))}
          </div>
          <dl className="events-guide-rules">
            {guide.rules.map((rule) => (
              <div key={rule.label}><dt>{rule.label}</dt><dd>{rule.text}</dd></div>
            ))}
          </dl>
        </div>
      )}

      <div className="events-board">
        <div className="events-board-head">
          <span>Top {board.rows.length || 10}</span>
          {board.updatedAt > 0 && <span className="tnum">Standings as of {new Date(board.updatedAt).toISOString().slice(11, 16)} UTC</span>}
        </div>
        <Standings board={board} />
        {board.rows.some((row) => !row.qualified) && <p className="events-card-meta">Dimmed rows have not reached the qualifying volume yet.</p>}
      </div>
    </Panel>
  );
}

function CompetitionCard({ entry, now }: { entry: LiveEntry; now: number }) {
  const { competition, detail, board } = entry;
  const note = scoringNote(detail);
  return (
    <Panel className="events-card">
      <div className="events-card-head">
        <span className="chip tag-accent events-tag">Live</span>
        <span className="events-card-time">Ends in <Countdown target={competition.end} now={now} /></span>
      </div>
      <h3>{competition.name}</h3>
      <p className="events-card-meta">
        {windowLabel(competition)}
        {competition.prizePool > 0 ? ` · ${dollars(competition.prizePool)} prize pool` : ""}
        {` · ${competition.participants.toLocaleString("en-US")} traders`}
        {detail && detail.totalVolume > 0 ? ` · ${usd(detail.totalVolume)} volume` : ""}
      </p>
      {note && <p className="events-card-meta">{note}</p>}
      <Standings board={board} compact />
    </Panel>
  );
}
