import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Avatar, Fingerprint, RepMeter } from "../components";
import { isDeployed, REGISTRY_ADDRESS } from "../config";
import {
  fetchProfile,
  shortAddr,
  timeAgo,
  type ChainContent,
  type ChainProfile,
} from "../web3";
import type { SamplePost } from "../sampleData";

// Map an on-chain registration into the post shape the content view consumes.
function contentToPost(c: ChainContent): SamplePost {
  return {
    id: c.id,
    title: c.title?.trim() || c.uri?.trim() || `Content #${c.id}`,
    description: "",
    author: c.author,
    topic: "",
    kind: c.kind,
    hash: c.hash,
    createdAt: c.createdAt,
    versions: c.versions,
    reputation: 0,
    seal: "pending",
    yesWeight: 0,
    noWeight: 0,
    uri: c.contentUrl ?? c.uri,
  };
}

export function Profile({
  account,
  onOpen,
  refreshKey = 0,
}: {
  account: string | null;
  onOpen: (post: SamplePost) => void;
  refreshKey?: number;
}) {
  const addr = account ?? "0x0000000000000000000000000000000000000000";
  const deployed = isDeployed(REGISTRY_ADDRESS);
  const [data, setData] = useState<ChainProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local nudge so the user can force a re-read (RPC can lag just after a tx).
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    if (!account || !deployed) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProfile(account)
      .then((p) => {
        if (!cancelled) setData(p);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Couldn't read your on-chain record.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, deployed, refreshKey, localRefresh]);

  return (
    <section>
      <div className="section" style={{ marginTop: 8 }}>
        <div className="row wrap" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Your standing</h2>
            <p className="sub">
              Reputation and registrations read straight from Monad. Every
              number here traces back to a transaction anyone can audit.
            </p>
          </div>
          {account && deployed && (
            <button
              className="btn btn-ghost"
              onClick={() => setLocalRefresh((n) => n + 1)}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "↻ Refresh"}
            </button>
          )}
        </div>
      </div>

      <motion.div
        className="profile-head"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Avatar addr={addr} />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "1.4rem" }}>
            {account ? "Connected creator" : "Not connected"}
          </h3>
          <div className="addr" style={{ marginTop: 4 }}>
            {shortAddr(addr)}
          </div>
          {account && (data?.totalReputation ?? 0) > 0 && (
            <div style={{ maxWidth: 260, marginTop: 14 }}>
              <RepMeter score={data!.totalReputation} />
            </div>
          )}
        </div>
      </motion.div>

      {!account && (
        <div className="notice info">
          Connect your wallet to see your registrations and reputation.
        </div>
      )}
      {account && !deployed && (
        <div className="notice warn">
          Contracts aren't deployed, so there's no on-chain record to read yet.
        </div>
      )}
      {loading && (
        <div className="notice info">Reading your record from Monad…</div>
      )}
      {error && <div className="notice risk">{error}</div>}

      {account && deployed && (
        <>
          <div className="stat-row">
            <Stat k="Content registered" v={data?.registered ?? 0} />
            <Stat k="Total reputation" v={data?.totalReputation ?? 0} />
            <Stat k="Fields with reputation" v={data?.reputation.length ?? 0} />
          </div>

          {data && data.reputation.length > 0 && (
            <>
              <div className="section">
                <h2 style={{ fontSize: "1.65rem" }}>Reputation by field</h2>
                <p className="sub">
                  Reputation is earned per field and never transfers between
                  them.
                </p>
              </div>
              <div className="panel">
                {data.reputation.map((r) => (
                  <div
                    key={r.slug}
                    className="txrow"
                    style={{ gap: 16 }}
                  >
                    <span className="tx-kind">{r.label}</span>
                    <div style={{ flex: 1, maxWidth: 260 }}>
                      <RepMeter score={Math.max(0, r.score)} />
                    </div>
                    <span className="mono muted" style={{ marginLeft: "auto" }}>
                      {r.score}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section">
            <h2 style={{ fontSize: "1.65rem" }}>Your registrations</h2>
          </div>
          <div className="panel">
            {data && data.content.length > 0 ? (
              data.content.map((c, i) => (
                <motion.div
                  key={c.id}
                  className="txrow txrow-click"
                  style={{ gap: 16 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.04 * i, duration: 0.3 }}
                  onClick={() => onOpen(contentToPost(c))}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && onOpen(contentToPost(c))
                  }
                >
                  <span className="tx-kind">
                    #{c.id} · {c.kind}
                  </span>
                  <span className="muted">
                    {c.title?.trim() || c.uri?.trim() || "Untitled"}
                  </span>
                  <div style={{ marginLeft: "auto" }} className="row">
                    <Fingerprint hash={c.hash} />
                    <span className="tx-hash">{timeAgo(c.createdAt)}</span>
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                {loading
                  ? "Loading…"
                  : "No registrations from this address yet. Register a piece to see it here."}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
