# RiseScan v2 — Data Catalog & Structure

A comprehensive **analytics / risk dashboard** for RISE Chain & RISEx (hyperscreener-style).
Separate project from v1 (the explorer). Design comes later — this is the data + skeleton.

## 1. What data we can pull (verified, with live sample values)

### A. Markets — `GET /v1/markets` (one call returns all 13 markets)
Per market: `open_interest`, `open_interest_limit`, `mark_price`, `index_price`, `last_price`,
`change_24h`, `high_24h`, `low_24h`, `quote_volume_24h`, `current_funding_rate`,
`funding_rate_8h`, `predicted_funding_rate`, `next_funding_time`, `funding_interval`,
`max_leverage`, `maintenance_margin_factor`, `max_position_size`, `accumulated_funding`.
- Derived: **OI in $** (oi×mark), **OI utilization %** (oi/oi_limit), **basis** (mark−index),
  **funding APR**, 24h range.
- Live sample: NEAR OI util **71.7%** (near cap), HYPE OI $3.98M, BTC vol $37.7M/24h.

### B. Time series (per market)
- `GET /v1/markets/id/{id}/trading-view-data?resolution=…` → **OHLCV candles**.
- `GET /v1/markets/id/{id}/funding-rate-history` → **funding history** (rate, accumulated, index, time, tx).
- `GET /v1/markets/id/{id}/trade-history` → recent market trades.

### C. Protocol / global
- **Total 24h volume** = Σ `quote_volume_24h` → **~$80.8M** (computed from /v1/markets).
- **Total OI** = Σ oi×mark → **~$9.88M**.
- **TVL** = CollateralManager USDC.e balance (Blockscout token-balances) → **~$6.42M**.
- **Wallets** — `GET /v1/stats/wallets` → `{total_traders:3836, bot_wallets:3748, mm_wallets:4, real_wallets:84}`.
- ⚠️ `/v1/stats/volume` & `/v1/stats/trades` exist but currently return **500** (server-side broken) — derive from /v1/markets instead.

### D. Chain metrics — Blockscout `GET /api/v2/stats` + RPC
- `transactions_today` (23.1M), `total_transactions` (595M), `total_addresses` (4.8k),
  `average_block_time` (1s), `gas_prices`, `network_utilization`.
- Live blocks/tx via **shred WebSocket** (reused from v1) — TPS, throughput.

### E. Per-account / trader (by address — public, no auth)
- `/v1/positions?account=`, `/v1/account/cross-margin-balance?account=` (collateral+uPnL),
  `/v1/orders/open?account=`, `/v1/trade-history?account=` (fills),
  `/v1/account/funding-payments?account=`.
- Derived risk: leverage, **liquidation distance**, margin ratio.

### F. On-chain events (Blockscout logs / RPC) — for aggregates the API doesn't expose
- CollateralManager `DepositedCollateral` / `WithdrawnCollateral` → **flows, new accounts, account universe (5,271)**.
- PerpsManager `OnTakeLevel` / `OnSettleMakerChunk` → trades.
- OrdersManager `PlaceOrder` / `CancelOrder` → order flow.
- FundingRate, FeeManager → funding, **protocol fees/revenue**.
- Indexer (reused from v1) aggregates accounts → **long/short OI skew per market, leverage
  distribution, near-liquidation wallets, top traders by OI/volume/PnL**.

## 2. Proposed v2 structure (pages / sections)

1. **Overview** — protocol KPIs row (TVL, total OI, 24h volume, total trades, traders real/bot,
   TPS) + trend sparklines + top movers.
2. **Markets** — full risk table: OI / OI-util / funding (cur·8h·pred·APR) / 24h vol·change·range /
   basis / leverage / next-funding countdown. Sortable. Row → **Market detail** (candles +
   funding history + trades + OI).
3. **Funding** — all-market funding board + APR + history + predicted; funding heatmap.
4. **Open Interest** — OI by market, utilization (near-cap alerts), **long/short skew** (indexer),
   OI trend.
5. **Traders / Risk** — leaderboards (volume / PnL / OI), high-leverage & **near-liquidation**
   wallets, real-vs-bot split.
6. **Liquidations** — live liq feed (fills `is_liquidation` / shreds), recent liqs by market.
7. **Flows** — deposits / withdrawals / net flow, TVL trend, new accounts/day.

(Chain metrics fold into Overview. Each section is data-backed by §1.)

## 3. Reuse from v1
`lib/risex.ts`, `lib/chain.ts`, `lib/constants.ts`, `lib/format.ts`, design tokens
(`globals.css`), UI primitives — all copied in. Build new analytics `lib/` + pages on top.
