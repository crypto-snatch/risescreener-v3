# RiseScreener

Read-only market and network analytics for RISEx and RISE Chain. Production: https://risescreener.com.

## Local development

Use Node.js 22, then `npm ci` and `npm run dev`. Run `npm run typecheck`, `npm test` and `npm run build` before deploying. The app uses Next.js 16, React 19 and Recharts. Read the installed Next.js documentation referenced in AGENTS.md when editing routes.

## Data and images

- Live market prices, volume, OI and funding use the public RISEx API. Only unlocked, visible markets are presented as tradable.
- `npm run catalog:sync` refreshes the market catalogue and saves official rise.trade SVG icons locally. The daily `refresh-market-catalog.yml` workflow commits new assets. Failed downloads preserve existing icons.
- `npm run refresh:history` collects complete UTC days from RISE public RPC without an API key. The daily `refresh-dune.yml` workflow runs it and refreshes the recap. Historical volume, taker/maker/liquidation fees, trade counts and active traders are decoded from contract events. Current partial UTC days are excluded. Successful complete days are committed atomically; gaps are not silently filled with zeroes. Each run catches up at most three days.
- `data/dune.json` is the historical seed; `data/rpc-history.json` holds incremental completed days. The application merges them idempotently, allowing later Dune snapshots to replace overlapping RPC days.
- Account registrations, historical collateral/TVL and liquidation counts are separate datasets. The free collector does not update these series; the UI displays their source dates. Recent collateral views cover USDC.e and explicitly identify incomplete coverage. Missing upstream data is displayed as unavailable.
- Dune refresh is optional: provide a funded `DUNE_API_KEY` repository secret and manually enable the workflow's `use_dune` input, or set repository variable `ENABLE_DUNE_REFRESH=true`. `npm run refresh:dune` reads cached results; executing fresh paid queries additionally requires `DUNE_EXECUTE_FRESH=1`. No new paid queries run by default. Dune's current free plan does not include ongoing API export: https://docs.dune.com/api-reference/overview/billing.
- Production reads committed historical files from this repository's raw GitHub URLs, cached for five minutes. Existing independent timeseries and leaderboard workflows remain responsible for their own datasets.

## Data validation

The public RPC collector was independently checked against the complete 2026-10-27 Dune day: $147,790,784.93 volume, $31,346.4707 net protocol fees and 145,284 taker events. Maker rebates remain signed; liquidation fees are counted once. Per-market fee charts identify taker versus liquidation components because maker settlement has a different event cadence.

`npm test` covers UTC boundaries, required datasets, icon availability, fee aggregation, ABI decoding, signed fees, contiguous daily merges and overlap handling. To independently compare another stored day without writing history, use `node scripts/snapshot-rpc-history.mjs --verify-day YYYY-MM-DD` (this makes substantial public RPC requests).

Network figures in the explainer distinguish published RISE specifications from measured live chain activity. Sources: https://www.risechain.com and https://docs.risechain.com.
