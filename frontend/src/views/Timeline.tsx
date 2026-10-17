import { AnimatePresence, motion } from "motion/react";
import { TOPICS } from "../config";
import { SAMPLE_POSTS, type SamplePost } from "../sampleData";
import { Fingerprint, RepMeter, Seal } from "../components";
import { shortAddr, timeAgo } from "../web3";

function topicLabel(slug: string): string {
  return TOPICS.find((t) => t.id === slug)?.label ?? slug;
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
  const posts = filter
    ? SAMPLE_POSTS.filter((p) => p.topic === filter)
    : SAMPLE_POSTS;

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
                    {topicLabel(p.topic)} · {p.kind} · v{p.versions}
                  </div>
                  <h3>{p.title}</h3>
                </div>
                <Seal state={p.seal} />
              </div>

              <p className="desc">{p.description}</p>

              <div className="post-foot">
                <Fingerprint hash={p.hash} verified={p.seal === "verified"} />
                <div style={{ minWidth: 150, flex: "0 1 200px" }}>
                  <RepMeter score={p.reputation} />
                </div>
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
