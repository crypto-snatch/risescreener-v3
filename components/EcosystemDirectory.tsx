"use client";

import { useMemo, useState } from "react";
import type { EcoCategory, EcoProject, EcoStatus } from "@/lib/ecosystem";

const STATUS: Record<EcoStatus, { label: string; color: string }> = {
  live: { label: "Live", color: "var(--long)" },
  "coming-soon": { label: "Coming soon", color: "#e6b94a" },
};

function monogram(name: string) {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function EcosystemLogo({ project, hue }: { project: EcoProject; hue: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className="eco-logo"
      style={{
        overflow: "hidden",
        background: `color-mix(in oklab, ${hue} 14%, var(--glass-2))`,
        color: hue,
        borderColor: `color-mix(in oklab, ${hue} 34%, transparent)`,
      }}
    >
      {failed ? (
        monogram(project.name)
      ) : (
        // The source is the exact logo currently published by the official RISE Portal.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.logo}
          alt=""
          width={42}
          height={42}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
        />
      )}
    </span>
  );
}

export default function EcosystemDirectory({
  categories,
  projects,
  updatedAt,
  source,
}: {
  categories: EcoCategory[];
  projects: EcoProject[];
  updatedAt: string;
  source: string;
}) {
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<EcoStatus | "all">("all");
  const [q, setQ] = useState("");
  const hueOf = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.hue])), [categories]);
  const labelOf = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.label])), [categories]);

  const counts = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const project of projects) byCategory[project.type] = (byCategory[project.type] ?? 0) + 1;
    return byCategory;
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects
      .filter((project) => cat === "all" || project.type === cat)
      .filter((project) => status === "all" || project.status === status)
      .filter(
        (project) =>
          !needle ||
          project.name.toLowerCase().includes(needle) ||
          project.desc.toLowerCase().includes(needle) ||
          project.tags.some((tag) => tag.toLowerCase().includes(needle)),
      )
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [projects, cat, status, q]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div className="eco-chips" aria-label="Ecosystem category">
          <button type="button" className="eco-chip" data-active={cat === "all"} onClick={() => setCat("all")}>
            All <span className="eco-chip-n">{projects.length}</span>
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className="eco-chip"
              data-active={cat === category.id}
              onClick={() => setCat(category.id)}
              style={cat === category.id ? { color: category.hue, borderColor: category.hue } : undefined}
            >
              <span style={{ width: 7, height: 7, borderRadius: 2, background: category.hue, display: "inline-block" }} />
              {category.label} <span className="eco-chip-n">{counts[category.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", width: "min(100%, 430px)", justifyContent: "flex-end" }}>
          <div className="eco-chips" aria-label="Ecosystem status">
            {(["all", "live", "coming-soon"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className="eco-chip"
                data-active={status === value}
                onClick={() => setStatus(value)}
              >
                {value === "all" ? "Any status" : STATUS[value].label}
              </button>
            ))}
          </div>
          <input
            className="field"
            style={{ width: "min(100%, 190px)", minHeight: 38 }}
            aria-label="Search ecosystem projects"
            placeholder="Search apps…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass" style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          No official Portal entries match these filters.
        </div>
      ) : (
        <div className="eco-grid">
          {filtered.map((project) => {
            const hue = hueOf[project.type] ?? "var(--accent)";
            const projectStatus = STATUS[project.status];
            return (
              <article
                key={project.name}
                className="glass glow-edge eco-card"
                data-featured={Boolean(project.featured)}
                style={{ ["--hue" as string]: hue, minWidth: 0 }}
              >
                <div className="eco-card-top">
                  <EcosystemLogo project={project} hue={hue} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 750, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {project.name}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: hue }}>{labelOf[project.type]}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: projectStatus.color }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: projectStatus.color, display: "inline-block" }} />
                        {projectStatus.label}
                      </span>
                    </div>
                  </div>
                  {project.featured && <span className="eco-official">FEATURED</span>}
                </div>

                <p className="eco-desc" style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
                  {project.desc}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {project.tags.map((tag) => <span key={tag} className="eco-tag">{tag}</span>)}
                </div>

                <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: "auto", paddingTop: 4 }}>
                  {project.status === "live" ? (
                    <a href={project.url} target="_blank" rel="noreferrer" className="chip" style={{ color: "var(--ink)", borderColor: `color-mix(in oklab, ${hue} 42%, var(--hair))` }}>
                      Launch <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <span className="chip" aria-label={`${project.name} is coming soon`} style={{ color: projectStatus.color, cursor: "default" }}>
                      Coming soon
                    </span>
                  )}
                  {project.twitter && (
                    <a href={project.twitter} target="_blank" rel="noreferrer" className="chip" aria-label={`${project.name} on X`}>
                      X <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
        {projects.length} entries · synced {updatedAt} from the{" "}
        <a href={source} target="_blank" rel="noreferrer" style={{ color: "var(--accent-ink)" }}>
          official RISE Portal ↗
        </a>
      </div>
    </div>
  );
}
