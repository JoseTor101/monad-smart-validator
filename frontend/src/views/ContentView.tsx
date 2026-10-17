import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Fingerprint } from "../components";
import { MONAD_TESTNET } from "../config";
import {
  fetchContent,
  resolveContentUrl,
  shortAddr,
  timeAgo,
  type FetchedContent,
} from "../web3";
import type { SamplePost } from "../sampleData";

/**
 * Content detail: fetch the stored file (article text or image), render it, and
 * re-hash it in the browser to confirm it matches the fingerprint sealed
 * on-chain. This is the "anyone can verify" promise made visible.
 */
export function ContentView({
  post,
  onBack,
  onValidate,
}: {
  post: SamplePost;
  onBack: () => void;
  onValidate: (post: SamplePost) => void;
}) {
  const [data, setData] = useState<FetchedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uri = post.uri ?? "";
  const url = resolveContentUrl(uri);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetchContent(uri, post.hash)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uri, post.hash]);

  return (
    <section>
      <div className="section" style={{ marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 18 }}>
          ← Back
        </button>
        <div className="content-head">
          <div>
            <div className="meta" style={{ marginBottom: 6 }}>
              #{post.id} · {post.kind} · v{post.versions}
            </div>
            <h2>{post.title || `Content #${post.id}`}</h2>
          </div>
          {data?.hashMatches === true && (
            <span className="seal verified" title="Re-hashed and matches the chain">
              <VerifyGlyph /> Hash verified
            </span>
          )}
          {data?.hashMatches === false && (
            <span className="seal disputed" title="Re-hash does not match the chain">
              <VerifyGlyph /> Hash mismatch
            </span>
          )}
        </div>
      </div>

      <div className="grid-2">
        <motion.div
          className="panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {loading && <p className="muted">Loading content from storage…</p>}

          {error && (
            <div className="notice risk">
              {error}
              {url && (
                <>
                  {" "}
                  <a href={url} target="_blank" rel="noreferrer">
                    Open the raw file
                  </a>
                  .
                </>
              )}
            </div>
          )}

          {data?.isImage && (
            <img className="content-image" src={data.url} alt={post.title} />
          )}

          {data?.isText && (
            <article className="content-article">
              {data.text?.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </article>
          )}

          {data && !data.isText && !data.isImage && (
            <div className="notice info">
              This content type ({data.contentType || "unknown"}) can't be
              previewed inline.{" "}
              <a href={data.url} target="_blank" rel="noreferrer">
                Open it directly
              </a>
              .
            </div>
          )}
        </motion.div>

        <div>
          <div className="panel">
            <div className="k muted" style={{ fontSize: "0.75rem" }}>
              Provenance
            </div>
            <div style={{ marginTop: 12 }}>
              <Fingerprint hash={post.hash} verified={post.seal === "verified"} />
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="record-row" style={{ borderTop: "none" }}>
                <span className="k">Author</span>
                <span className="v mono">{shortAddr(post.author)}</span>
              </div>
              <div className="record-row">
                <span className="k">Registered</span>
                <span className="v">{timeAgo(post.createdAt)}</span>
              </div>
              <div className="record-row">
                <span className="k">Versions</span>
                <span className="v">v{post.versions}</span>
              </div>
              <div className="record-row">
                <span className="k">Integrity</span>
                <span className="v">
                  {data?.hashMatches === true
                    ? "verified ✓"
                    : data?.hashMatches === false
                    ? "mismatch ✕"
                    : "—"}
                </span>
              </div>
            </div>

            <p className="muted" style={{ fontSize: "0.78rem", marginTop: 14 }}>
              The file above was re-downloaded and hashed in your browser. A match
              proves it's byte-for-byte what the author sealed on Monad.
            </p>

            {url && (
              <a
                className="tx-hash"
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 10 }}
              >
                Open raw file ↗
              </a>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 16 }}
            onClick={() => onValidate(post)}
          >
            Validate this piece
          </button>

          <a
            className="tx-hash"
            href={`${MONAD_TESTNET.blockExplorerUrl}/address/${post.author}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", marginTop: 12, textAlign: "center" }}
          >
            View author on explorer ↗
          </a>
        </div>
      </div>
    </section>
  );
}

function VerifyGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
