import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatEther } from "ethers";
import { TOPICS, isDeployed, REGISTRY_ADDRESS } from "../config";
import { SAMPLE_POSTS, type SamplePost } from "../sampleData";
import { Fingerprint, RepMeter, Seal } from "../components";
import {
  fetchAllContent,
  latestRoundsByContent,
  sealForRound,
  shortAddr,
  timeAgo,
  type ChainContent,
  type RoundState,
} from "../web3";

function topicLabel(slug: string): string {
  return TOPICS.find((t) => t.id === slug)?.label ?? slug;
}

// Describe the seal in plain language for the post body.
const SEAL_DESC: Record<string, string> = {
  verified: "Validators staked that this is original. Verified on Monad.",
  disputed: "Validators voted this is not original.",
  contested: "A validation round is underway — votes revealed so far.",
  pending: "Fingerprint, author and timestamp sealed on Monad. Awaiting community validation.",
};

// A registered item becomes a post, enriched with its latest validation round
// (if any) so the seal, support meter and body reflect real on-chain state.
function toPost(c: ChainContent, round?: RoundState): SamplePost {
  const label = c.title?.trim() || c.uri?.trim() || `Untitled #${c.id}`;
  const seal = sealForRound(round);
  // Support % = yes weight / total revealed weight, for the meter.
  let support = 0;
  if (round) {
    const yes = Number(formatEther(round.yesWeight));
    const no = Number(formatEther(round.noWeight));
    const total = yes + no;
    support = total > 0 ? Math.round((yes / total) * 100) : 0;
  }
  return {
    id: c.id,
    title: label,
    description:
      c.parentId > 0
        ? `Derivative of #${c.parentId}. ${SEAL_DESC[seal]}`
        : SEAL_DESC[seal],
    author: c.author,
    topic: "", // no on-chain topic field yet
    kind: c.kind,
    hash: c.hash,
    createdAt: c.createdAt,
    versions: c.versions,
    reputation: round && seal !== "pending" ? support : 0,
    seal,
    yesWeight: round ? Number(formatEther(round.yesWeight)) : 0,
    noWeight: round ? Number(formatEther(round.noWeight)) : 0,
    uri: c.contentUrl ?? c.uri,
  };
}

export function Timeline({
  filter,
  onClearFilter,
  onValidate,
  onOpen,
  refreshKey = 0,
}: {
  filter: string | null;
  onClearFilter: () => void;
  onValidate: (post: SamplePost) => void;
  onOpen: (post: SamplePost) => void;
  refreshKey?: number;
}) {
  const deployed = isDeployed(REGISTRY_ADDRESS);
  const [chain, setChain] = useState<SamplePost[] | null>(null);
  const [loading, setLoading] = useState(deployed);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [items, rounds] = await Promise.all([
      fetchAllContent(),
      latestRoundsByContent(),
    ]);
    return items.map((c) => toPost(c, rounds.get(c.id)));
  }, []);

  useEffect(() => {
    if (!deployed) return;
    let cancelled = false;
    setLoading(true);
    load()
      .then((posts) => {
        if (cancelled) return;
        setChain(posts);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Couldn't read registrations from the chain.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deployed, load, refreshKey]);

  // Prefer real on-chain content; fall back to sample data only when the
  // registry is empty or undeployed, so the demo still has something to show.
  const usingChain = deployed && chain !== null && chain.length > 0;
  const base = usingChain ? chain! : SAMPLE_POSTS;
  const posts = filter ? base.filter((p) => p.topic === filter) : base;

  return (
    <section>
      <div className="section" style={{ marginTop: 8 }}>
        <div className="row wrap" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>{filter ? topicLabel(filter) : "Recent provenance"}</h2>
            <p className="sub">
              Newest registrations and the community's standing on each. The dot
              turns teal once a piece clears validation.
            </p>
          </div>
          {filter && (
            <button className="btn btn-ghost" onClick={onClearFilter}>
              Clear filter
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="notice info">Reading registrations from Monad…</div>
      )}
      {error && <div className="notice risk">{error}</div>}
      {deployed && !loading && !usingChain && !error && (
        <div className="notice info">
          No on-chain registrations yet — showing sample content. Register a
          piece and it appears here.
        </div>
      )}

      <div className="timeline">
        <AnimatePresence mode="popLayout">
          {posts.map((p, i) => (
            <motion.article
              key={p.id}
              layout
              className={`post${p.seal === "verified" ? " is-verified" : ""}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.35, ease: "easeOut" }}
            >
              <div className="post-head">
                <div>
                  <div className="meta" style={{ marginBottom: 6 }}>
                    {[p.topic ? topicLabel(p.topic) : null, p.kind, `v${p.versions}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <h3
                    className="post-title-link"
                    onClick={() => onOpen(p)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onOpen(p)}
                  >
                    {p.title}
                  </h3>
                </div>
                <Seal state={p.seal} />
              </div>

              <p className="desc">{p.description}</p>

              <div className="post-foot">
                <Fingerprint hash={p.hash} verified={p.seal === "verified"} />
                {p.reputation > 0 && (
                  <div style={{ minWidth: 150, flex: "0 1 200px" }}>
                    <RepMeter score={p.reputation} />
                  </div>
                )}
                <span className="meta">
                  {shortAddr(p.author)} · {timeAgo(p.createdAt)}
                </span>
                <div className="row" style={{ marginLeft: "auto", gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => onOpen(p)}>
                    View
                  </button>
                  <button className="btn" onClick={() => onValidate(p)}>
                    {p.seal === "disputed" ? "View dispute" : "Validate"}
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
