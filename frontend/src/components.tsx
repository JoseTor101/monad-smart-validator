import { useMemo, useState } from "react";
import { shortHash } from "./web3";

/* -------------------------------------------------------------------------
   Fingerprint — a content hash rendered as a functional chip. The little bar
   glyphs are derived deterministically from the hash itself, so each hash has
   a recognisable silhouette. Click to copy. Turns teal when verified.
   ------------------------------------------------------------------------- */

export function Fingerprint({
  hash,
  verified = false,
}: {
  hash: string;
  verified?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  // Map the hash into 8 bar heights (4–16px) for a stable visual signature.
  const glyphs = useMemo(() => {
    const clean = hash.replace(/^0x/, "");
    const out: number[] = [];
    for (let i = 0; i < 8; i++) {
      const byte = parseInt(clean.slice(i * 2, i * 2 + 2) || "0", 16);
      out.push(4 + (byte % 13));
    }
    return out;
  }, [hash]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  };

  return (
    <button
      type="button"
      className={`fingerprint${verified ? " verified" : ""}`}
      onClick={copy}
      title={hash}
    >
      <span className="glyphs" aria-hidden>
        {glyphs.map((h, i) => (
          <i key={i} style={{ height: `${h}px` }} />
        ))}
      </span>
      <span>{copied ? "copied" : shortHash(hash)}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------
   Seal — the single semantic trust signal. Teal only when verified.
   ------------------------------------------------------------------------- */

export type SealState = "verified" | "contested" | "disputed" | "pending";

const SEAL_LABEL: Record<SealState, string> = {
  verified: "Verified original",
  contested: "Under review",
  disputed: "Disputed",
  pending: "Awaiting validation",
};

export function Seal({ state }: { state: SealState }) {
  return (
    <span className={`seal ${state}`}>
      {state === "verified" ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2l2.4 1.8 3 .1 1 2.8 2.3 1.9-.8 2.9.8 2.9-2.3 1.9-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.3 15l.8-2.9-.8-2.9 2.3-1.9 1-2.8 3-.1L12 2z"
            fill="currentColor"
            opacity="0.18"
          />
          <path
            d="M8 12.5l2.5 2.5L16 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.5" />
          <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
        </svg>
      )}
      {SEAL_LABEL[state]}
    </span>
  );
}

/* -------------------------------------------------------------------------
   Reputation meter — normalises a score onto a 0–100 track.
   ------------------------------------------------------------------------- */

export function RepMeter({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="repmeter" title={`Reputation ${score}`}>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="num">{score}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Deterministic gradient avatar from an address (no external service).
   ------------------------------------------------------------------------- */

export function Avatar({ addr, size = 64 }: { addr: string; size?: number }) {
  const { a, b } = useMemo(() => {
    const h = addr.replace(/^0x/, "");
    const n1 = parseInt(h.slice(0, 6) || "6c4df5", 16) % 360;
    const n2 = parseInt(h.slice(6, 12) || "22c5a8", 16) % 360;
    return { a: n1, b: n2 };
  }, [addr]);
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from 210deg, hsl(${a} 72% 58%), hsl(${b} 65% 50%), hsl(${a} 72% 58%))`,
      }}
      aria-hidden
    />
  );
}
