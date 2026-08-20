import Image from "next/image";
import Link from "next/link";
import { getMarketRows, getProtocol, isUpcoming } from "@/lib/analytics";
import { usd } from "@/lib/format";

export const revalidate = 30;
export const metadata = { title: "RiseScreener — RISEx market intelligence" };

export default async function Landing() {
  const [protocol, rows] = await Promise.all([getProtocol(), getMarketRows()]);
  const liveRows = rows.filter((row) => !isUpcoming(row));
  const rowTotals = liveRows.reduce(
    (total, row) => ({
      volume24h: total.volume24h + row.volume24h,
      openInterest: total.openInterest + row.oiUsd,
    }),
    { volume24h: 0, openInterest: 0 },
  );
  const volume24h = rowTotals.volume24h || protocol.totalVolume24h;
  const openInterest = rowTotals.openInterest || protocol.totalOiUsd;

  return (
    <main className="screen splash-page" data-page="landing">
      <section className="splash-stage" aria-label="RiseScreener entrance">
        <figure className="splash-mascot">
          <Image
            src="/risex-mascot-city.png"
            alt="RISEx mascot in the RISE city"
            fill
            priority
            sizes="(max-width: 720px) calc(100vw - 40px), 440px"
            className="splash-mascot-image"
          />
        </figure>

        <div className="splash-grid">
          <article className="splash-cell splash-metric">
            <span>24h Volume</span>
            <strong className="tnum">{usd(volume24h)}</strong>
          </article>

          <article className="splash-cell splash-metric">
            <span>Open Interest</span>
            <strong className="tnum">{usd(openInterest)}</strong>
          </article>

          <Link href="/overview" className="splash-cell splash-action" data-primary="true">
            <span>Enter dashboard</span>
            <b aria-hidden="true">→</b>
          </Link>

          <a
            href="https://www.rise.trade/invite/risescreener"
            target="_blank"
            rel="noreferrer"
            className="splash-cell splash-action"
          >
            <span>Trade on RISEx</span>
            <b aria-hidden="true">↗</b>
          </a>
        </div>
      </section>
    </main>
  );
}
