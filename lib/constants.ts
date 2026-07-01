// RISEx / RISE Chain constants — verified against api.rise.trade + Blockscout (June 2026)

export const RISEX_API = "https://api.rise.trade";
export const EXPLORER_API = "https://explorer.risechain.com/api/v2";
export const EXPLORER_UI = "https://explorer.risechain.com";
export const RISE_RPC = "https://rpc.risechain.com";
// RISE Shred API — real-time (~2ms) sub-block stream over WebSocket.
// CORS/origin-open, so the browser subscribes directly (no server proxy).
export const RISE_WS = "wss://rpc.risechain.com/ws";
export const RISE_CHAIN_ID = 4153;

// Mainnet deployment addresses (docs.risechain.com/docs/risex/contracts/deployments)
export const CONTRACTS = {
  PerpsManager: "0x53f10fAcFC8965750494E6965F5d6dA39B41d852",
  OrdersManager: "0xE03C1D5081eb2d0E6bFd62A949C5b12eFa44F2cD",
  SpotManager: "0x1F92be734731e28F52C20AB0BAA73Db7cBf521F8",
  CollateralManager: "0x2C03C7d7e2974C6599b6B108879109281ef3F818",
  FeeManager: "0x11541dc387b9C307043ea732127DF92b80bab52b",
  RISExOracle: "0x8fC4D0Cf74cdF595254cB763d4C05D38Df0e9503",
  FundingRate: "0x069eDF2C2A3c93b54640Ae142B9f5375fe4A207a",
} as const;

// Known perp-matching event signatures (resolved via openchain signature DB)
export const EVENT_SIGS: Record<string, string> = {
  "0x3e92827023687af833e2eb9abe60e0726acfc9f7f82839dec79cf9e138b983ff":
    "OnTakeLevel", // taker fill against a price level
  "0x572a85e40cc9183c961148c546e88431898ab9938b85992ea5f6577ea06d9888":
    "OnSettleMakerChunk", // maker settlement
};

export const WAD = 1e18;
