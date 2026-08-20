import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type EcoStatus = "live" | "coming-soon";
export type EcoType = "project" | "nft-collection" | "tooling";

export interface EcoCategory {
  id: EcoType;
  label: string;
  hue: string;
}

export interface EcoProject {
  type: EcoType;
  name: string;
  status: EcoStatus;
  desc: string;
  logo: string;
  banner?: string;
  url: string;
  twitter?: string;
  tags: string[];
  featured?: boolean;
}

export interface Ecosystem {
  updatedAt: string;
  source: string;
  categories: EcoCategory[];
  projects: EcoProject[];
}

export async function getEcosystem(): Promise<Ecosystem> {
  const raw = await readFile(join(process.cwd(), "data", "ecosystem.json"), "utf8");
  return JSON.parse(raw) as Ecosystem;
}
