import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav, { type TickerMarket } from "@/components/Nav";
import { getMarketRows } from "@/lib/analytics";
import AutoRefresh from "@/components/AutoRefresh";

export const metadata: Metadata = {
  metadataBase: new URL("https://risescreener.com"),
  title: "RiseScreener — RISE Chain analytics, ecosystem & markets",
  description:
    "The home for RISE Chain — RISEx perps analytics (markets, OI, funding, liquidations, traders, flows), the full ecosystem directory, and global crypto-market context.",
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
  themeColor: "#0b0f0e",
};

export const revalidate = 30;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let ticker: TickerMarket[] = [];
  try {
    ticker = (await getMarketRows())
      .filter((market) => market.active && market.mark > 0)
      .slice(0, 12)
      .map((market) => ({
        id: market.marketId,
        symbol: market.symbol,
        mark: market.mark,
        changePct: market.changePct,
      }));
  } catch {
    ticker = [];
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
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
          <Nav ticker={ticker} />
          <AutoRefresh />

          <main className="page-main">{children}</main>

          <footer className="page-foot" style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.6 }}>
            Data from RISEx public API, RiseScan, Dune and RISE Chain. Live views refresh every 30 seconds
            while visible; historical datasets follow their stated source cadence. Unofficial, read-only.
          </footer>
        </div>
      </body>
    </html>
  );
}
