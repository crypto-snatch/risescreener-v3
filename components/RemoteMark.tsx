"use client";

import { useState } from "react";

export default function RemoteMark({
  src,
  label,
  size = 20,
}: {
  src?: string;
  label: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(!src);
  const monogram = (label.trim()[0] || "?").toUpperCase();

  return (
    <span
      aria-label={`${label} logo`}
      style={{
        width: size,
        height: size,
        display: "inline-grid",
        placeItems: "center",
        flex: "0 0 auto",
        overflow: "hidden",
        border: "1px solid var(--hair)",
        borderRadius: "50%",
        color: "var(--muted)",
        background: "var(--glass-2)",
        fontSize: Math.max(8, size * 0.42),
        fontWeight: 700,
      }}
    >
      {!failed && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
        />
      ) : (
        <span aria-hidden="true">{monogram}</span>
      )}
    </span>
  );
}
