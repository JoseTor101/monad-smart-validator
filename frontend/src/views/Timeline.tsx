import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TOPICS, isDeployed, REGISTRY_ADDRESS } from "../config";
import { SAMPLE_POSTS, type SamplePost } from "../sampleData";
import { Fingerprint, RepMeter, Seal } from "../components";
import { fetchAllContent, shortAddr, timeAgo, type ChainContent } from "../web3";

function topicLabel(slug: string): string {
  return TOPICS.find((t) => t.id === slug)?.label ?? slug;
}

// A registered item becomes a post. On-chain we only have hash / uri / kind /
// time / versions — no title, description, topic, or reputation yet. We show
// the uri as the heading (that's the label the author supplied) and mark the
// piece "pending" until validation reads are wired up.
function toPost(c: ChainContent): SamplePost {
  const label = c.uri?.trim() || `Untitled #${c.id}`;
  return {
    id: c.id,
    title: label,
    description:
      c.parentId > 0
        ? `Derivative of #${c.parentId}. Fingerprint sealed on Monad; awaiting community validation.`
        : "Fingerprint, author and timestamp sealed on Monad. Awaiting community validation.",
    author: c.author,
    topic: "", // no on-chain topic field yet
    kind: c.kind,
    hash: c.hash,
    createdAt: c.createdAt,
    versions: c.versions,
    reputation: 0,
    seal: "pending",
    yesWeight: 0,
    noWeight: 0,
  };
}

export function Timeline({
  filter,
  onClearFilter,
  onValidate,
}: {
  filter: string | null;
  onClearFilter: () => void;
  onValidate: (post: SamplePost) => void;
}) {
  const deployed = isDeployed(REGISTRY_ADDRESS);
  const [chain, setChain] = useState<SamplePost[] | null>(null);
  const [loading, setLoading] = useState(deployed);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deployed) return;
    let cancelled = false;
    setLoading(true);
    fetchAllContent()
      .then((items) => {
        if (cancelled) return;
        setChain(items.map(toPost));
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
  }, [deployed]);

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
                  <h3>{p.title}</h3>
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
                <button
                  className="btn"
                  style={{ marginLeft: "auto" }}
                  onClick={() => onValidate(p)}
                >
                  {p.seal === "disputed" ? "View dispute" : "Validate"}
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
