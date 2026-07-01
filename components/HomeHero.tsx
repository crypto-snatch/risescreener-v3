"use client";

import { useEffect, useRef, useState } from "react";
import TxSearch from "@/components/TxSearch";
import StatsStrip from "@/components/StatsStrip";
import { Panel } from "@/components/ui";

function useScramble(text: string) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@/\\<>*=+?Ξ";
    let revealed = 0;
    let holding = 0;
    const id = setInterval(() => {
      if (holding > 0) {
        holding--;
        if (holding === 0) revealed = 0;
        return;
      }
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " ") { s += " "; continue; }
        s += i < revealed ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setOut(s);
      revealed += 0.5;
      if (revealed >= text.length) { setOut(text); holding = 26; }
    }, 55);
    return () => clearInterval(id);
  }, [text]);
  return out;
}

export default function HomeHero({ marketsCount }: { marketsCount: number }) {
  const glowRef = useRef<HTMLDivElement>(null);
  const wm = useScramble("RISE Scan");

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const g = glowRef.current;
    if (g) {
      g.style.opacity = "0.7";
      // large, low-opacity wash → gently diffuse spread that follows the cursor
      g.style.background = `radial-gradient(240px circle at ${x}px ${y}px, color-mix(in oklab, var(--accent) 16%, transparent), transparent 75%)`;
    }
  };
  const onLeave = () => {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  };

  return (
    <>
      {/* spotlight only over the hero — not the stat boxes below */}
      <div className="spotlight-zone" onMouseMove={onMove} onMouseLeave={onLeave} style={{ position: "relative" }}>
        <Panel className="glass-2" style={{ borderRadius: "var(--r-lg)", padding: "30px 30px 26px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <span style={{ width: 132, height: 132, borderRadius: "calc(var(--radius)*0.9)", overflow: "hidden", flexShrink: 0, border: "1px solid var(--hair)", boxShadow: "0 0 0 4px var(--accent-soft), 0 22px 50px -20px rgba(0,0,0,.85)", background: "var(--brand-green)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/rise-avatar.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </span>
              <div>
                <div className="wm" style={{ fontSize: 32 }}>
                  <span className="text-accent">{wm.slice(0, 4)}</span>
                  <span style={{ color: "var(--ink)", marginLeft: "0.1em" }}>{wm.slice(5)}</span>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--muted)", maxWidth: 440, lineHeight: 1.5 }}>
                  The explorer for <span className="text-accent">RISE Chain &amp; RISEx</span> — live blocks, transactions and on-chain perp activity, all public.
                </p>
              </div>
            </div>
            <span className="chip tag-accent">{marketsCount} markets live</span>
          </div>
          <TxSearch big />
        </Panel>
        <div ref={glowRef} aria-hidden="true" className="spotlight-overlay" />
      </div>

      <StatsStrip marketsCount={marketsCount} />
    </>
  );
}
