// Keeps the leaderboard snapshot always fresh on a rolling 24h basis.
// Each indexer run recomputes volume as "now − 24h", so running it on a loop
// means the 24h window is always current.
//
//   npm run index:watch            # default: re-index every 30 min
//   INDEX_INTERVAL_MIN=15 npm run index:watch
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "index-leaderboard.mjs");
const INTERVAL_MIN = Number(process.env.INDEX_INTERVAL_MIN || 30);

function runOnce() {
  return new Promise((resolve) => {
    // Inherit the parent env. If you run this behind a TLS-inspecting network,
    // export NODE_TLS_REJECT_UNAUTHORIZED=0 in your shell (local only).
    const p = spawn(process.execPath, [SCRIPT], { stdio: "inherit", env: process.env });
    p.on("exit", (code) => {
      console.log(`[index:watch] run exited ${code}`);
      resolve();
    });
  });
}

async function loop() {
  for (;;) {
    const t0 = Date.now();
    console.log(`[index:watch] ${new Date().toISOString()} starting 24h re-index…`);
    await runOnce();
    const waitMs = Math.max(0, INTERVAL_MIN * 60_000 - (Date.now() - t0));
    console.log(`[index:watch] next run in ${(waitMs / 60_000).toFixed(1)} min`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

loop();
