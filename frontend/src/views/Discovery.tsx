import { motion } from "motion/react";
import { TOPICS } from "../config";
import { topicSummary, sealWord } from "../sampleData";
import { timeAgo } from "../web3";

/* Discovery is a hairline-divider list (see R2), not a bento of tinted cards.
   Each field's hue is reduced to a single 8px dot; information lives in the
   columns (entries, status, latest, updated), not in decoration. */

export function Discovery({
  active,
  onPick,
}: {
  active: string | null;
  onPick: (slug: string) => void;
}) {
  return (
    <section>
      <div className="section" style={{ marginTop: 8 }}>
        <div className="discovery-top">
          <div>
            <h2>Browse by field</h2>
            <p className="sub">
              Each field keeps its own reputation. A validator trusted in
              photography carries no extra weight in research — trust stays
              where it was earned.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => onPick("")}>
            Open the full timeline
          </button>
        </div>
      </div>

      <div className="field-list" role="table" aria-label="Content fields">
        <div className="field-row head" role="row">
          <span className="col-head" role="columnheader">Field</span>
          <span className="col-head" role="columnheader">Entries</span>
          <span className="col-head col-status" role="columnheader">Status</span>
          <span className="col-head col-latest" role="columnheader">Latest</span>
          <span className="col-head col-updated" role="columnheader" style={{ textAlign: "right" }}>
            Updated
          </span>
        </div>

        {TOPICS.map((t, i) => {
          const s = topicSummary(t.id);
          const statusClass = s.seal ? `s-${s.seal}` : "s-pending";
          return (
            <motion.button
              key={t.id}
              className="field-row"
              role="row"
              data-active={active === t.id}
              onClick={() => onPick(t.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.3, ease: "easeOut" }}
            >
              <span className="field-name" role="cell">
                <span className={`field-dot d-${t.id}`} aria-hidden />
                <span>
                  <span className="fn-label">{t.label}</span>
                  <span className="fn-blurb">{t.blurb}</span>
                </span>
              </span>

              <span className="field-count" role="cell">
                {s.count}
              </span>

              <span className={`field-status ${statusClass}`} role="cell">
                <span className="sdot" aria-hidden />
                {sealWord(s.seal)}
              </span>

              {s.latestTitle ? (
                <span className="field-latest" role="cell">
                  {s.latestTitle}
                </span>
              ) : (
                <span className="field-latest empty" role="cell">
                  <a onClick={(e) => e.stopPropagation()}>Be the first to register here</a>
                </span>
              )}

              <span className="field-updated" role="cell">
                {s.latestAt ? timeAgo(s.latestAt) : "—"}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
