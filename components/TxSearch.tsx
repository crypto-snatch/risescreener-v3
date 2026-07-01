"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const FALLBACK = ["0x7c6bf9003ae3ba366883f63a28c4f3fd6a5958a0"];

export default function TxSearch({ big }: { big?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const wallets = useRef<string[]>(FALLBACK);
  const q = v.trim();
  const isTx = /^0x[0-9a-fA-F]{64}$/.test(q);
  const isAddr = /^0x[0-9a-fA-F]{40}$/.test(q);
  const valid = isTx || isAddr;

  useEffect(() => {
    fetch("/api/sample-wallets")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.wallets) && d.wallets.length) wallets.current = d.wallets;
      })
      .catch(() => {});
  }, []);

  function tryWallet() {
    const list = wallets.current;
    setV(list[Math.floor(Math.random() * list.length)]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isTx) router.push(`/tx/${q}`);
    else if (isAddr) router.push(`/address/${q}`);
  }

  return (
    <form onSubmit={submit} data-component="tx-search" style={{ position: "relative", width: "100%" }}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        spellCheck={false}
        placeholder={big ? "Search any tx hash or wallet address  ·  0x…" : "Search tx / address 0x…"}
        className="field"
        style={big ? { padding: "16px 130px 16px 20px", fontSize: 14, borderRadius: "var(--r-pill)" } : { fontSize: 12.5 }}
      />
      {big && (
        <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 6 }}>
          {!q && (
            <button type="button" onClick={tryWallet} className="chip" style={{ cursor: "pointer" }}>
              try a wallet ↺
            </button>
          )}
          <button type="submit" disabled={!valid} className="chip tag-accent" style={{ opacity: valid ? 1 : 0.32, fontWeight: 600, padding: "8px 14px" }}>
            {isTx ? "tx ↵" : isAddr ? "open ↵" : "search ↵"}
          </button>
        </div>
      )}
    </form>
  );
}
