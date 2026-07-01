import Link from "next/link";
import { getDune } from "@/lib/dune";
import { usd, compact } from "@/lib/format";

export const revalidate = 120;
export const metadata = { title: "RiseScreener — RISE Chain & RISEx analytics" };

const FEATURES = [
  { k: "Gigagas throughput", d: "A parallel-EVM L2 targeting ~100k TPS — the fastest EVM settling to Ethereum." },
  { k: "~2ms preconfirmations", d: "Shreds (sub-blocks) confirm your trade in milliseconds, not seconds. Full blocks seal in ~1s." },
  { k: "Parallel EVM (pEVM)", d: "Transactions execute in parallel across CPU cores, then settle to Ethereum for L1 security." },
  { k: "RISEx perps DEX", d: "A fully on-chain orderbook perps exchange. RiseScreener tracks its markets, funding, OI, liquidations & traders." },
];

export default async function Welcome() {
  const dune = await getDune();
  const kpis = [
    { label: "TVL", value: usd(dune?.totals.tvl ?? 0) },
    { label: "Cumulative volume", value: usd(dune?.totals.cumVolume ?? 0) },
    { label: "Accounts", value: compact(dune?.totals.accounts ?? 0) },
    { label: "Protocol fees", value: usd(dune?.totals.cumFees ?? 0) },
  ];

  return (
    <div className="screen" data-page="welcome" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, padding: "36px 0 20px", textAlign: "center" }}>
      {/* hero */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 22, maxWidth: 760 }}>
        <div style={{ position: "absolute", top: -30, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 22%, transparent), transparent 62%)", filter: "blur(18px)", pointerEvents: "none" }} />
        <span style={{ position: "relative", width: 132, height: 132, borderRadius: 26, overflow: "hidden", border: "1px solid var(--accent-line)", boxShadow: "0 0 0 6px var(--accent-soft), 0 30px 70px -22px rgba(0,0,0,.85)", background: "var(--brand-green)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.png" alt="RiseScreener mascot" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </span>

        <h1 className="wm" style={{ margin: 0, fontSize: 44, letterSpacing: "0.02em", lineHeight: 1.04 }}>
          <span className="text-accent">RISE</span>
          <span style={{ color: "var(--ink)" }}>SCREENER</span>
        </h1>

        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "var(--muted)", maxWidth: 620 }}>
          Analytics &amp; risk screener for <b style={{ color: "var(--ink)", fontWeight: 600 }}>RISE Chain</b> and the{" "}
          <b style={{ color: "var(--ink)", fontWeight: 600 }}>RISEx</b> perps DEX — the fastest EVM on Ethereum.
          Live markets, open interest, funding, liquidations, cohorts, trader flows and protocol revenue, all in one place.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
          <Link href="/overview" className="chip tag-accent" style={{ padding: "11px 20px", fontSize: 13.5, fontWeight: 600 }}>Enter dashboard →</Link>
          <Link href="/markets" className="chip" style={{ padding: "11px 18px", fontSize: 13.5 }}>Explore markets</Link>
          <a href="https://www.rise.trade/invite/risescreener" target="_blank" rel="noreferrer" className="chip" style={{ padding: "11px 18px", fontSize: 13.5 }}>Trade on RISEx ↗</a>
        </div>
      </div>

      {/* live KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10, width: "100%", maxWidth: 760 }}>
        {kpis.map((k) => (
          <div key={k.label} className="glass glow-edge" style={{ borderRadius: "var(--radius)", padding: "14px 16px", textAlign: "left" }}>
            <div style={{ fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-2)" }}>{k.label}</div>
            <div className="tnum" style={{ fontSize: 20, fontWeight: 700, marginTop: 6, letterSpacing: "-.015em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* what is RISE */}
      <div style={{ width: "100%", maxWidth: 960, marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <span className="rule" />
          <h2 style={{ margin: 0, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted-2)", fontWeight: 500, whiteSpace: "nowrap" }}>What is RISE</h2>
          <span className="rule" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))", gap: 12 }}>
          {FEATURES.map((f) => (
            <div key={f.k} className="glass glow-edge glass-raise" style={{ borderRadius: "var(--r-lg)", padding: "18px 18px", textAlign: "left" }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>{f.k}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 8, maxWidth: 620, lineHeight: 1.6 }}>
        Unofficial, read-only. Data from RISEx public API, RISE Chain (RPC / Blockscout) &amp; Dune. Not affiliated with RISE.
      </p>
    </div>
  );
}
