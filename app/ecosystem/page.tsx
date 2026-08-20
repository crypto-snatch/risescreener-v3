import { getEcosystem } from "@/lib/ecosystem";
import EcosystemDirectory from "@/components/EcosystemDirectory";

export const revalidate = 3600;
export const metadata = { title: "Ecosystem — official RISE Portal directory | RiseScreener" };

export default async function EcosystemPage() {
  const eco = await getEcosystem();
  const live = eco.projects.filter((project) => project.status === "live").length;
  const comingSoon = eco.projects.length - live;

  const links = [
    { label: "Official Portal ↗", href: eco.source },
    { label: "RISE Chain ↗", href: "https://www.risechain.com" },
    { label: "Docs ↗", href: "https://docs.risechain.com" },
    { label: "Explorer ↗", href: "https://explorer.risechain.com" },
  ];

  return (
    <div className="screen" data-page="ecosystem" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="glass glow-edge grad-frame" style={{ borderRadius: "var(--r-lg)", padding: "20px 22px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ maxWidth: 580 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>
              The <span className="grad-text">RISE</span> ecosystem
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
              Apps, collections and tooling listed by the official RISE Portal. Search the exact current directory or filter by type and launch status.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
              {links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="chip" style={{ fontSize: 11 }}>{l.label}</a>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
            {[["Entries", eco.projects.length, true], ["Live", live, false], ["Coming soon", comingSoon, false]].map(([label, val, acc]) => (
              <div key={label as string} style={{ textAlign: "right" }}>
                <div className={"tnum" + (acc ? " grad-text" : "")} style={{ fontSize: 26, fontWeight: 800, color: acc ? undefined : "var(--ink)" }}>{val as number}</div>
                <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted-2)" }}>{label as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <EcosystemDirectory categories={eco.categories} projects={eco.projects} updatedAt={eco.updatedAt} source={eco.source} />
    </div>
  );
}
