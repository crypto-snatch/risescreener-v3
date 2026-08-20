import Link from "next/link";

export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? 60 : size === "sm" ? 30 : 38;
  const txt = size === "lg" ? 30 : size === "sm" ? 15 : 19;
  return (
    <Link
      href="/"
      data-component="logo"
      style={{ display: "inline-flex", alignItems: "center", gap: 11, flexShrink: 0 }}
    >
      <span
        style={{
          width: dim,
          height: dim,
          borderRadius: "calc(var(--radius) * 0.62)",
          overflow: "hidden",
          flexShrink: 0,
          border: "1px solid var(--accent-line)",
          background: "var(--brand-green)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/risex-logo.png" alt="RISEx" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", padding: Math.max(3, Math.round(dim * 0.16)) }} />
      </span>
      <span className="wm" style={{ fontSize: txt }}>
        <span className="text-accent">RISE</span>
        <span style={{ color: "var(--ink)", marginLeft: "0.1em" }}>Scan</span>
      </span>
    </Link>
  );
}
