import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWallet } from "./useWallet";
import { useTheme } from "./useTheme";
import { shortAddr } from "./web3";
import { Fingerprint, Seal } from "./components";
import { Discovery } from "./views/Discovery";
import { Timeline } from "./views/Timeline";
import { Register } from "./views/Register";
import { Profile } from "./views/Profile";
import type { SamplePost } from "./sampleData";

type View = "discover" | "timeline" | "register" | "profile";

const NAV: { id: View; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "timeline", label: "Timeline" },
  { id: "register", label: "Register" },
  { id: "profile", label: "Profile" },
];

export default function App() {
  const wallet = useWallet();
  const { theme, toggle } = useTheme();
  const [view, setView] = useState<View>("discover");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [validating, setValidating] = useState<SamplePost | null>(null);

  function pickTopic(slug: string) {
    setTopicFilter((cur) => (cur === slug ? null : slug));
    setView("timeline");
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <SealMark />
            SmartValidator
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                data-active={view === n.id}
                onClick={() => setView(n.id)}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <span className="spacer" />
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <ThemeIcon theme={theme} />
          </button>
          <button
            className="wallet"
            onClick={wallet.connect}
            disabled={wallet.connecting}
          >
            {wallet.account && <span className="dot" />}
            {wallet.account
              ? shortAddr(wallet.account)
              : wallet.connecting
              ? "Connecting…"
              : "Connect wallet"}
          </button>
        </div>
      </header>

      <main className="shell">
        {view === "discover" && <Hero onStart={() => setView("register")} />}

        {!wallet.installed && (
          <div className="notice warn">
            No wallet detected. Install{" "}
            <a href="https://metamask.io" target="_blank" rel="noreferrer">
              MetaMask
            </a>{" "}
            to register content or cast validations.
          </div>
        )}
        {wallet.error && <div className="notice risk">{wallet.error}</div>}

        <AnimatePresence mode="wait">
          <motion.div
            key={view + (topicFilter ?? "")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {view === "discover" && (
              <Discovery active={topicFilter} onPick={pickTopic} />
            )}
            {view === "timeline" && (
              <Timeline
                filter={topicFilter}
                onClearFilter={() => setTopicFilter(null)}
                onValidate={setValidating}
              />
            )}
            {view === "register" && <Register account={wallet.account} />}
            {view === "profile" && <Profile account={wallet.account} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {validating && (
          <ValidateModal
            post={validating}
            account={wallet.account}
            onClose={() => setValidating(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* --- Hero: the first, most characteristic thing a visitor sees ----------- */

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            Proof of who made it, and every change since.
          </motion.h1>
          <motion.p
            className="lede"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5, ease: "easeOut" }}
          >
            Register an article or image and its fingerprint, author and
            timestamp are sealed on Monad. Validators stake their reputation on
            what's original, and anything can be disputed.
          </motion.p>
          <motion.div
            className="hero-actions row wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <button className="btn btn-primary" onClick={onStart}>
              Register your work
            </button>
            <a href="#how" onClick={(e) => e.preventDefault()}>
              How validation works
            </a>
          </motion.div>
        </div>

        <motion.div
          className="record"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.5, ease: "easeOut" }}
        >
          <div className="record-top">
            <span>Record #7 / research</span>
            <Seal state="verified" />
          </div>
          <h3>Water telemetry report</h3>
          <Fingerprint
            hash="0x8f2a1c93be77d4e5a0b1c2d3e4f50617a8b9c0d1e2f3041526378490abcdef12"
            verified
          />
          <div style={{ marginTop: 16 }}>
            <div className="record-row">
              <span className="k">Author</span>
              <span className="v">0x4be1…a07c</span>
            </div>
            <div className="record-row">
              <span className="k">Registered</span>
              <span className="v">block 4,812,077</span>
            </div>
            <div className="record-row">
              <span className="k">Versions</span>
              <span className="v">v3</span>
            </div>
            <div className="record-row">
              <span className="k">Validators</span>
              <span className="v">31 staked · 82% original</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* --- Validate modal: commit–reveal explained in plain language ----------- */

function ValidateModal({
  post,
  account,
  onClose,
}: {
  post: SamplePost;
  account: string | null;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [stake, setStake] = useState("0.1");
  const disputed = post.seal === "disputed";

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 6 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "1.25rem" }}>
            {disputed ? "Dispute in progress" : "Validate this piece"}
          </h3>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="muted" style={{ fontSize: "0.9rem", marginTop: 6 }}>
          {post.title}
        </p>

        <div style={{ margin: "16px 0" }}>
          <Fingerprint hash={post.hash} verified={post.seal === "verified"} />
        </div>

        {disputed ? (
          <div className="notice risk">
            An escalated round is open at double the original stake. Majority by
            staked weight settles it; the losing side is slashed.
          </div>
        ) : (
          <>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Your vote is hidden until the reveal phase (commit–reveal), so no
              one can copy the leader or buy a visible vote. Stake backs your
              judgement — vote with the outcome and you earn, against it and
              you're slashed.
            </p>

            <div className="row" style={{ gap: 10, margin: "16px 0" }}>
              <button
                className={`btn${choice === true ? " btn-teal" : ""}`}
                onClick={() => setChoice(true)}
                style={{ flex: 1 }}
              >
                Original / true
              </button>
              <button
                className={`btn${choice === false ? " btn-primary" : ""}`}
                onClick={() => setChoice(false)}
                style={{ flex: 1 }}
              >
                Not original
              </button>
            </div>

            <label className="field">
              <span>Stake (MON)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
              />
            </label>
          </>
        )}

        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={!account || (!disputed && choice === null)}
          onClick={onClose}
        >
          {!account
            ? "Connect wallet to continue"
            : disputed
            ? "Join the dispute"
            : "Commit vote"}
        </button>

        <p
          className="muted"
          style={{ fontSize: "0.75rem", marginTop: 12, textAlign: "center" }}
        >
          Preview: wiring to the ValidationMarket contract activates once
          deployed.
        </p>
      </motion.div>
    </motion.div>
  );
}

function ThemeIcon({ theme }: { theme: "dark" | "light" }) {
  // Show the icon for the mode you'd switch TO: a sun while in dark, a moon
  // while in light.
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SealMark() {
  return (
    <svg className="seal-mark" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l2.4 1.8 3 .1 1 2.8 2.3 1.9-.8 2.9.8 2.9-2.3 1.9-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.3 15l.8-2.9-.8-2.9 2.3-1.9 1-2.8 3-.1L12 2z"
        fill="#6c4df5"
        opacity="0.22"
      />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="#22c5a8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
