import longShort from "./longshort";
import shredSprint from "./shred";
import liqDodge from "./liqdodge";
import bookStacker from "./stacker";
import type { GameDef } from "./engine";

export const GAMES: GameDef[] = [longShort, shredSprint, liqDodge, bookStacker];
export const ICON_PALETTE: Record<string, string> = {
  G: "#2ee88e", D: "#22b36e", K: "#0b0f0e", W: "#e9edf1", R: "#e46a7b", L: "#3a4541",
};
