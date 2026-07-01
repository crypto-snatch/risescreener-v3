import Link from "next/link";
import ChainStream from "@/components/ChainStream";

export const metadata = { title: "Explorer — RiseScreener" };

export default function ExplorerPage() {
  return (
    <div className="screen" data-page="explorer" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Explorer</h1>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Live RISE blocks &amp; transactions (shred stream) · search any wallet above or in{" "}
          <Link href="/account" className="mono-link">Account Explorer</Link>
        </span>
      </div>
      <ChainStream />
    </div>
  );
}
