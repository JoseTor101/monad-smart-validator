import { motion } from "motion/react";
import { TOPICS } from "../config";
import { topicCounts } from "../sampleData";

// Asymmetric spans sized so every row fills all 6 columns.
// Row 1: [Journalism span-2 tall][Photography span-4]
// Row 2: [ (Journalism cont.) ][Research span-2][Digital art span-2]
// Row 3: [Opinion span-3][Documentation span-3]
const SPANS = [
  "span-2 tall", // Journalism
  "span-4", // Photography
  "span-2", // Research
  "span-2", // Digital art
  "span-3", // Opinion
  "span-3", // Documentation
];

export function Discovery({
  active,
  onPick,
}: {
  active: string | null;
  onPick: (slug: string) => void;
}) {
  const counts = topicCounts();

  return (
    <section>
      <div className="section" style={{ marginTop: 8 }}>
        <h2>Browse by field</h2>
        <p className="sub">
          Each field keeps its own reputation. A validator trusted in
          photography carries no extra weight in research — trust stays where
          it was earned.
        </p>
      </div>

      <div className="bento">
        {TOPICS.map((t, i) => {
          const count = counts[t.id] ?? 0;
          return (
            <motion.button
              key={t.id}
              className={`tile t-${t.id} ${SPANS[i] ?? "span-2"}`}
              data-active={active === t.id}
              onClick={() => onPick(t.id)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.4, ease: "easeOut" }}
            >
              <span className="corner" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 17L17 7M17 7H9M17 7v8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3>{t.label}</h3>
              <div className="blurb">{t.blurb}</div>
              <div className="tilestat">
                {count} {count === 1 ? "entry" : "entries"} · live
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
