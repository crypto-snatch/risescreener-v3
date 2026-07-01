"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const FALLBACK = ["0x7c6bf9003ae3ba366883f63a28c4f3fd6a5958a0"];

export default function AccountInput() {
  const router = useRouter();
  const [v, setV] = useState("");
  const wallets = useRef<string[]>(FALLBACK);
  const valid = /^0x[0-9a-fA-F]{40}$/.test(v.trim());

  useEffect(() => {
    fetch("/api/sample-wallets")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.wallets) && d.wallets.length) wallets.current = d.wallets;
      })
      .catch(() => {});
  }, []);

  function randomWallet() {
    const list = wallets.current;
    const pick = list[Math.floor(Math.random() * list.length)];
    setV(pick);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (valid) router.push(`/address/${v.trim()}`);
  }

  return (
    <form onSubmit={submit} data-component="account-input" style={{ width: "100%", maxWidth: 540 }}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoFocus
        spellCheck={false}
        placeholder="0x… wallet address"
        className="field"
        style={{ textAlign: "center", padding: "16px 20px", fontSize: 15, borderRadius: "var(--radius)" }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" onClick={randomWallet} className="glass" style={{ flex: "0 0 auto", padding: "12px 16px", color: "var(--muted)", fontSize: 12.5, borderRadius: "var(--radius)" }}>
          random ↺
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="glass"
          style={{
            flex: 1, padding: "13px", borderRadius: "var(--radius)", fontWeight: 700, fontSize: 13.5,
            color: valid ? "var(--accent-ink)" : "var(--muted-2)",
            background: valid ? "var(--accent-soft)" : "var(--glass)",
            borderColor: valid ? "var(--accent-line)" : "var(--hair)",
            opacity: valid ? 1 : 0.6,
          }}
        >
          Track account →
        </button>
      </div>
    </form>
  );
}
