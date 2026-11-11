import Image from "next/image";
import Link from "next/link";
import { Jersey_15 } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import "./events.css";
import { Empty } from "@/components/ui";
import Arcade from "@/components/events/Arcade";
import Countdown from "@/components/events/Countdown";
import PixelSprite, { TROPHY } from "@/components/events/PixelSprite";
import { RIXEL_PALETTE, RIXEL_SPRITE, TOKEN } from "@/components/events/games/engine";
import { getMarketRows, isUpcoming } from "@/lib/analytics";
import { COMPETITION_GUIDES, type CompetitionGuide } from "@/lib/competition-guides";
import {
  getCompetitionDetail, getCompetitionLeaderboard, getCompetitions,
  type Competition, type CompetitionDetail, type Leaderboard,
} from "@/lib/competitions";
import { shortAddr, usd } from "@/lib/format";
import { getCandles } from "@/lib/market-data";

export const revalidate = 60;
export const metadata = { title: "Events — RiseScreener" };

// Display face for the events hall: headings, countdown and arcade labels.
// Jersey 15 keeps digits unambiguous (several pixel faces draw 5 like S and 2 like 8).
const pixel = Jersey_15({ subsets: ["latin"], weight: "400", variable: "--font-pixel", display: "swap" });

const RISEX_COMPETITIONS = "https://www.rise.trade/competition";
const ARCADE_MARKETS = 6;
const TOKEN_PALETTE = { G: "#2ee88e", K: "#0b0f0e" };
const TROPHY_PALETTE = { Y: "currentColor", D: "currentColor" };

const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const dayYear = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const windowLabel = (competition: Competition) => `${day.format(competition.start)} – ${dayYear.format(competition.end)}`;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const count = (value: number) => value.toLocaleString("en-US");
// Prize pools and thresholds are round figures: "$50,000" reads better than "$50.0K".
const dollars = (value: number) => (value < 1_000_000 && Number.isInteger(value) ? `$${count(value)}` : usd(value));
const elapsedOf = (competition: Competition, now: number) =>
  Math.max(0, Math.min(1, (now - competition.start) / (competition.end - competition.start)));
const accentStyle = (accent?: string) => (accent ? ({ "--ev": accent } as CSSProperties) : undefined);

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
  const livePrize = live.reduce((sum, competition) => sum + competition.prizePool, 0);
  const guide = featured ? COMPETITION_GUIDES[featured.competition.slug] : undefined;

  return (
    <div className={`screen ev ${pixel.variable}`} data-page="events">
      {/* ── hero ── */}
      <header className="ev-hero">
        <div className="ev-hero-copy">
          <span className="ev-eyebrow">RISE / Events</span>
          <h1 className="ev-pixel">Events <em>&amp;</em> Arcade</h1>
          <p>Trade for the prize pool, then play for the high score. Live RISEx competitions with current standings, and four pixel mini-games built around the RISEx mark.</p>
          <nav className="ev-jump" aria-label="On this page">
            <a href="#competitions">
              <b className="ev-pixel tnum">{live.length}</b>
              <span>live competition{live.length === 1 ? "" : "s"}<i>{livePrize > 0 ? `${dollars(livePrize)} in prizes` : "standings update live"}</i></span>
            </a>
            <a href="#arcade">
              <b className="ev-pixel tnum">4</b>
              <span>mini-games<i>beat your own best</i></span>
            </a>
            {ended.length > 0 && (
              <a href="#past">
                <b className="ev-pixel tnum">{ended.length}</b>
                <span>past competitions<i>winners &amp; prize pools</i></span>
              </a>
            )}
          </nav>
        </div>
        <div className="ev-hero-art" aria-hidden="true">
          <PixelSprite rows={TOKEN} palette={TOKEN_PALETTE} className="ev-float ev-float-a" />
          <PixelSprite rows={TOKEN} palette={TOKEN_PALETTE} className="ev-float ev-float-b" />
          <PixelSprite rows={TOKEN} palette={TOKEN_PALETTE} className="ev-float ev-float-c" />
          <PixelSprite rows={RIXEL_SPRITE} palette={RIXEL_PALETTE} className="ev-mascot" />
          <span className="ev-ground" />
        </div>
      </header>

      {/* ── competitions ── */}
      <section id="competitions" className="ev-section">
        <SectionTitle index="01" title="Live competitions" note={`${live.length} running${upcoming.length ? ` · ${upcoming.length} upcoming` : ""}`} />
        {featured ? (
          <>
            <Poster entry={featured} guide={guide} now={now} />
            <div className="ev-split">
              <LeaderboardPanel board={featured.board} accent={guide?.accent} />
              <RulesPanel detail={featured.detail} guide={guide} />
            </div>
          </>
        ) : (
          <Empty>
            No competition is running right now{competitions.length ? "" : ", or the RISEx competition feed is not responding"}.{" "}
            <a href={RISEX_COMPETITIONS} target="_blank" rel="noreferrer" className="mono-link">Check RISEx ↗</a>
          </Empty>
        )}
        {(others.length > 0 || upcoming.length > 0) && (
          <div className="ev-grid">
            {others.map((entry) => <CompetitionCard key={entry.competition.slug} entry={entry} now={now} />)}
            {upcoming.map((competition) => (
              <article key={competition.slug} className="ev-card" data-phase="upcoming">
                <div className="ev-card-head">
                  <span className="ev-tag">Upcoming</span>
                  <span className="ev-card-time">Starts in <Countdown target={competition.start} now={now} /></span>
                </div>
                <h3>{competition.name}</h3>
                <p className="ev-meta">{windowLabel(competition)}{competition.prizePool > 0 ? ` · ${dollars(competition.prizePool)} prize pool` : ""}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── arcade ── */}
      <section id="arcade" className="ev-section">
        <SectionTitle index="02" title="Pixel arcade" note="Scores are saved in this browser only" />
        <Arcade candleSets={candleSets} />
      </section>

      {/* ── archive ── */}
      {ended.length > 0 && (
        <section id="past" className="ev-section">
          <SectionTitle index="03" title="Hall of fame" note={`${ended.length} finished`} />
          <div className="ev-panel ev-scroll">
            <table className="ev-table" style={{ minWidth: 640 }}>
              <thead>
                <tr><th>Competition</th><th>Window (UTC)</th><th className="r">Prize pool</th><th className="r">Traders</th><th>Winner</th></tr>
              </thead>
              <tbody>
                {ended.map((competition, index) => {
                  const winner = winners[index]?.rows[0];
                  return (
                    <tr key={competition.slug}>
                      <td className="ev-strong">{competition.name}</td>
                      <td className="tnum ev-dim">{windowLabel(competition)}</td>
                      <td className="tnum r">{competition.prizePool > 0 ? <span className="ev-prize-pill">{dollars(competition.prizePool)}</span> : <span className="ev-dim">—</span>}</td>
                      <td className="tnum r">{count(competition.participants)}</td>
                      <td>
                        {winner ? (
                          <span className="ev-winner"><PixelSprite rows={TROPHY} palette={TROPHY_PALETTE} size={12} /><Trader address={winner.address} name={winner.name} /></span>
                        ) : <span className="ev-dim">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

function SectionTitle({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <div className="ev-title">
      <span className="ev-title-index ev-pixel">{index}</span>
      <h2 className="ev-pixel">{title}</h2>
      <span className="ev-title-rule" />
      {note && <span className="ev-title-note">{note}</span>}
    </div>
  );
}

function Trader({ address, name }: { address: string; name: string }) {
  const label = name || shortAddr(address);
  return address ? <Link href={`/address/${address}`} className="ev-trader">{label}</Link> : <span>{label}</span>;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ev-stat"><span>{label}</span><b className="tnum">{children}</b></div>;
}

function scoringNote(detail: CompetitionDetail | null) {
  if (!detail) return null;
  const parts: string[] = [];
  if (!detail.weights.length && detail.tracks.length) parts.push(`Ranked by ${detail.tracks.map((track) => track.toUpperCase()).join(" and ")}`);
  if (detail.qualifyingVolume > 0) parts.push(`Qualify at ${dollars(detail.qualifyingVolume)} volume`);
  if (detail.minVolume > 0) parts.push(`Minimum ${dollars(detail.minVolume)} volume`);
  return parts.length ? parts.join(" · ") : null;
}

// ── featured competition ──
function Poster({ entry, guide, now }: { entry: LiveEntry; guide?: CompetitionGuide; now: number }) {
  const { competition, detail, board } = entry;
  const elapsed = elapsedOf(competition, now);
  const art = guide?.images[guide.keyArt ?? 0];
  const totalDays = Math.max(1, Math.round((competition.end - competition.start) / 86_400_000));
  const dayNumber = Math.min(totalDays, Math.floor((now - competition.start) / 86_400_000) + 1);
  return (
    <article className="ev-poster" style={accentStyle(guide?.accent)}>
      <div className="ev-poster-main">
        <div className="ev-poster-info">
          <div className="ev-poster-tags">
            <span className="ev-live"><i />Live</span>
            <span className="ev-dim tnum">{windowLabel(competition)} UTC</span>
          </div>
          <h3 className="ev-pixel">{competition.name}</h3>
          {competition.prizePool > 0 ? (
            <div className="ev-prize"><b className="ev-pixel tnum">{dollars(competition.prizePool)}</b><span>prize pool</span></div>
          ) : (
            <div className="ev-prize"><b className="ev-pixel tnum">{count(competition.participants)}</b><span>traders competing</span></div>
          )}
          <div className="ev-clock">
            <span>Ends in</span>
            <Countdown target={competition.end} now={now} variant="blocks" />
          </div>
          <div className="ev-actions">
            <a href={RISEX_COMPETITIONS} target="_blank" rel="noreferrer" className="ev-cta">Join on RISEx ↗</a>
            <a href="#rules" className="ev-ghost">How scoring works</a>
          </div>
        </div>
        {art ? (
          <a className="ev-poster-art" href={art.src} target="_blank" rel="noreferrer" aria-label="Open the official card at full size">
            <Image src={art.src} alt={art.alt} width={art.width} height={art.height} sizes="(max-width: 900px) 100vw, 620px" priority />
          </a>
        ) : (
          <div className="ev-poster-art ev-poster-art-empty" aria-hidden="true">
            <PixelSprite rows={TROPHY} palette={TROPHY_PALETTE} />
          </div>
        )}
      </div>
      <div className="ev-poster-foot">
        <div className="ev-progress">
          <div className="ev-progress-bar" role="img" aria-label={`${pct(elapsed)} of the competition window has passed`}><i style={{ width: pct(elapsed) }} /></div>
          <div className="ev-progress-labels tnum">
            <span>{day.format(competition.start)}</span>
            <span>Day {dayNumber} of {totalDays}</span>
            <span>{day.format(competition.end)}</span>
          </div>
        </div>
        <div className="ev-stats">
          <Stat label="Traders">{count(competition.participants)}</Stat>
          <Stat label="Competition volume">{detail && detail.totalVolume > 0 ? usd(detail.totalVolume) : "—"}</Stat>
          <Stat label="Ranked accounts">{board.total > 0 ? count(board.total) : "—"}</Stat>
        </div>
      </div>
    </article>
  );
}

function LeaderboardPanel({ board, accent }: { board: Leaderboard; accent?: string }) {
  // Weighted competitions rank on a composite score; track-based ones publish ROI instead.
  const byScore = board.rows.some((row) => row.score > 0);
  const top = Math.max(1, ...board.rows.map((row) => (byScore ? row.score : Math.abs(row.roiPct))));
  return (
    <div className="ev-panel ev-board" style={accentStyle(accent)}>
      <div className="ev-panel-head">
        <h3 className="ev-pixel">Leaderboard</h3>
        {board.updatedAt > 0 && <span className="tnum">as of {new Date(board.updatedAt).toISOString().slice(11, 16)} UTC</span>}
      </div>
      {board.rows.length ? (
        <>
          <div className="ev-board-cols" aria-hidden="true">
            <span>#</span><span>Trader</span><span className="r">{byScore ? "Score" : "ROI"}</span><span className="r ev-wide">Volume</span><span className="r">PnL</span>
          </div>
          <ol className="ev-board-rows">
            {board.rows.map((row) => {
              const value = byScore ? row.score : row.roiPct;
              return (
                <li key={`${row.rank}-${row.address}`} data-rank={row.rank <= 3 ? row.rank : undefined} data-pending={!row.qualified}>
                  <span className="ev-rank ev-pixel tnum">{row.rank}</span>
                  <span className="ev-board-name"><Trader address={row.address} name={row.name} /></span>
                  <span className="ev-score tnum r">
                    <i style={{ width: pct(Math.max(0.02, Math.abs(value) / top)) }} />
                    <b>{byScore ? value.toFixed(1) : `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`}</b>
                  </span>
                  <span className="tnum r ev-wide ev-dim">{usd(row.volume)}</span>
                  <span className="tnum r" style={{ color: row.pnl >= 0 ? "var(--long)" : "var(--short)" }}>{usd(row.pnl, { sign: true })}</span>
                </li>
              );
            })}
          </ol>
          {board.rows.some((row) => !row.qualified) && <p className="ev-meta">Dimmed rows have not reached the qualifying volume yet.</p>}
        </>
      ) : <p className="ev-meta">Standings are not published yet.</p>}
    </div>
  );
}

function RulesPanel({ detail, guide }: { detail: CompetitionDetail | null; guide?: CompetitionGuide }) {
  const note = scoringNote(detail);
  return (
    <div id="rules" className="ev-panel ev-rules" style={accentStyle(guide?.accent)}>
      <div className="ev-panel-head">
        <h3 className="ev-pixel">{guide?.title ?? "How it works"}</h3>
        {guide && <span>from the official RISEx cards</span>}
      </div>
      {detail && detail.weights.length > 0 && (
        <div className="ev-mix" role="img" aria-label={`Score mix: ${detail.weights.map((entry) => `${entry.label} ${pct(entry.weight)}`).join(", ")}`}>
          {detail.weights.map((entry, index) => (
            <span key={entry.label} style={{ flexGrow: entry.weight }} data-slot={index}><b>{pct(entry.weight)}</b>{entry.label}</span>
          ))}
        </div>
      )}
      {guide ? (
        <ol className="ev-steps">
          {guide.rules.map((rule, index) => (
            <li key={rule.label}>
              <span className="ev-step-n ev-pixel">{index + 1}</span>
              <div><b>{rule.label}</b><p>{rule.text}</p></div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ev-meta">{note ?? "RISEx has not published a scoring breakdown for this competition."}</p>
      )}
      {guide && guide.images.length > 0 && (
        <div className="ev-cards">
          {guide.images.map((image) => (
            <a key={image.src} href={image.src} target="_blank" rel="noreferrer" aria-label="Open the official card at full size">
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 760px) 50vw, 260px" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CompetitionCard({ entry, now }: { entry: LiveEntry; now: number }) {
  const { competition, detail, board } = entry;
  const note = scoringNote(detail);
  const byScore = board.rows.some((row) => row.score > 0);
  return (
    <article className="ev-card">
      <div className="ev-card-head">
        <span className="ev-live"><i />Live</span>
        <span className="ev-card-time">Ends in <Countdown target={competition.end} now={now} /></span>
      </div>
      <h3>{competition.name}</h3>
      <div className="ev-progress-bar" role="img" aria-label={`${pct(elapsedOf(competition, now))} of the competition window has passed`}>
        <i style={{ width: pct(elapsedOf(competition, now)) }} />
      </div>
      <p className="ev-meta">
        {windowLabel(competition)}
        {competition.prizePool > 0 ? ` · ${dollars(competition.prizePool)} prize pool` : ""}
        {` · ${count(competition.participants)} traders`}
        {detail && detail.totalVolume > 0 ? ` · ${usd(detail.totalVolume)} volume` : ""}
      </p>
      {note && <p className="ev-meta">{note}</p>}
      {board.rows.length > 0 ? (
        <ol className="ev-mini">
          {board.rows.map((row) => (
            <li key={`${row.rank}-${row.address}`} data-rank={row.rank}>
              <span className="ev-rank ev-pixel tnum">{row.rank}</span>
              <span className="ev-board-name"><Trader address={row.address} name={row.name} /></span>
              <span className="tnum ev-dim">{usd(row.volume)}</span>
              <b className="tnum">{byScore ? row.score.toFixed(1) : `${row.roiPct >= 0 ? "+" : "−"}${Math.abs(row.roiPct).toFixed(1)}%`}</b>
            </li>
          ))}
        </ol>
      ) : <p className="ev-meta">Standings are not published yet.</p>}
    </article>
  );
}
