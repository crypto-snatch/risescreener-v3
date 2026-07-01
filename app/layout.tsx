import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import Nav from "@/components/Nav";
import TxSearch from "@/components/TxSearch";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  metadataBase: new URL("https://risescreener.com"),
  title: "RiseScreener — RISE Chain & RISEx analytics",
  description:
    "Analytics & risk screener for RISE Chain and the RISEx perps DEX — live markets, open interest, funding, fees, liquidations, traders and protocol flows.",
  openGraph: {
    title: "RiseScreener — RISE Chain & RISEx analytics",
    description:
      "Analytics & risk screener for RISE Chain and the RISEx perps DEX — markets, open interest, funding, fees, liquidations, traders and protocol flows.",
    url: "https://risescreener.com",
    siteName: "RiseScreener",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RiseScreener — RISE Chain & RISEx analytics",
    description: "Analytics & risk screener for RISE Chain and the RISEx perps DEX.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070e0c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('rs-theme')==='light')document.body.dataset.theme='light';}catch(e){}`,
          }}
        />
        <div className="bg-atmos" />
        <div className="shell">
          <header className="sticky-head">
            <div className="glass" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
              <div className="topbar-inner" style={{ padding: "6px 22px" }}>
                <div className="topbar-side">
                  <Link href="/" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                    <span className="wm" style={{ fontSize: 17 }}>
                      <span className="text-accent">RISE</span>
                      <span style={{ color: "var(--ink)" }}>SCREENER</span>
                    </span>
                  </Link>
                </div>
                <div className="navbar-wrap"><Nav /></div>
                <div className="topbar-side topbar-right">
                  <ThemeToggle />
                  <div className="search-wrap" style={{ flexShrink: 1, width: 150 }}>
                    <TxSearch />
                  </div>
                  <a
                    href="https://www.rise.trade/invite/risescreener"
                    target="_blank"
                    rel="noreferrer"
                    className="chip tag-accent hide-mobile"
                    style={{ padding: "6px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/risex.png" alt="" width={14} height={14} style={{ display: "block", borderRadius: 3 }} />
                    Trade ↗
                  </a>
                </div>
              </div>
            </div>
          </header>

          <main className="page-main">{children}</main>

          <footer className="page-foot" style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.6 }}>
            Data from RISEx public API + RISE Chain (RPC / Blockscout). Unofficial, read-only. Not
            affiliated with RISE. Figures are estimates; trend charts build from periodic snapshots.
          </footer>
        </div>
      </body>
    </html>
  );
}
