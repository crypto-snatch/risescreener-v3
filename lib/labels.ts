import { shortAddr } from "./format";

// Known RISE Chain / RISEx contracts. RISE is effectively a dedicated app-chain
// for RISEx, so ~99% of transactions target the RISEx Router — labelling these
// makes the otherwise-repetitive "to" column readable.
const CONTRACT_LABELS: Record<string, string> = {
  "0xaadde0cea454f2bcb26f46ed54c5709b7bb34a7e": "RISEx Router",
  "0x53f10facfc8965750494e6965f5d6da39b41d852": "PerpsManager",
  "0xe03c1d5081eb2d0e6bfd62a949c5b12efa44f2cd": "OrdersManager",
  "0x2c03c7d7e2974c6599b6b108879109281ef3f818": "CollateralManager",
  "0x1f92be734731e28f52c20ab0baa73db7cbf521f8": "SpotManager",
  "0x11541dc387b9c307043ea732127df92b80bab52b": "FeeManager",
  "0x8fc4d0cf74cdf595254cb763d4c05d38df0e9503": "Oracle",
  "0x069edf2c2a3c93b54640ae142b9f5375fe4a207a": "FundingRate",
  "0x0d919daa3f12ae715744eb648c00066c5dbd66f0": "Authorization",
  "0xca11bde05977b3631167028862be2a173976ca11": "Multicall3",
  "0x4200000000000000000000000000000000000015": "L1Block · system",
};

// 4-byte selectors we have been able to resolve. The two dominant RISEx trading
// selectors are not in any public DB (contracts unverified) — shown as-is.
const METHOD_LABELS: Record<string, string> = {
  "0x252dba42": "aggregate",
  "0x3db6be2b": "setL1BlockValues",
  "0x41bd64ba": "updateOraclePrices",
};

export function contractLabel(addr: string | null): string {
  if (!addr) return "—";
  return CONTRACT_LABELS[addr.toLowerCase()] ?? shortAddr(addr);
}

export function isKnownContract(addr: string | null): boolean {
  return !!addr && addr.toLowerCase() in CONTRACT_LABELS;
}

export function methodLabel(selectorOrName: string | null): string {
  if (!selectorOrName || selectorOrName === "—") return "—";
  if (selectorOrName === "transfer") return "transfer";
  return METHOD_LABELS[selectorOrName.toLowerCase()] ?? selectorOrName;
}
