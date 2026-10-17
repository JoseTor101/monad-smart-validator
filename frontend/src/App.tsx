import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatEther, parseEther } from "ethers";
import { useWallet } from "./useWallet";
import { useTheme } from "./useTheme";
import {
  Phase,
  commitVote,
  findRoundFor,
  getMyVote,
  marketDeployed,
  openRound,
  resolveRound,
  revealVote,
  shortAddr,
  withdrawRound,
  type MyVote,
  type RoundState,
} from "./web3";
import { TOPICS } from "./config";
import { Fingerprint, Seal } from "./components";
import { Discovery } from "./views/Discovery";
import { Timeline } from "./views/Timeline";
import { Register } from "./views/Register";
import { Profile } from "./views/Profile";
import { ContentView } from "./views/ContentView";
import type { SamplePost } from "./sampleData";

type View = "discover" | "timeline" | "register" | "profile" | "content";

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
  const [viewing, setViewing] = useState<SamplePost | null>(null);
  // Bumped whenever a validation action may have changed on-chain state, so
  // the Timeline and Profile re-read fresh round/reputation data.
  const [refreshKey, setRefreshKey] = useState(0);

  function pickTopic(slug: string) {
    setTopicFilter((cur) => (cur === slug ? null : slug));
    setView("timeline");
  }

  function openContent(post: SamplePost) {
    setViewing(post);
    setView("content");
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
          {wallet.account ? (
            <div className="wallet-group">
              <span className="wallet" title={wallet.account}>
                <span className="dot" />
                {shortAddr(wallet.account)}
              </span>
              <button
                className="theme-toggle"
                onClick={wallet.disconnect}
                aria-label="Disconnect wallet"
                title="Disconnect wallet"
              >
                <LogoutIcon />
              </button>
            </div>
          ) : (
            <button
              className="wallet"
              onClick={wallet.connect}
              disabled={wallet.connecting}
            >
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
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
                onOpen={openContent}
                refreshKey={refreshKey}
              />
            )}
            {view === "register" && <Register account={wallet.account} />}
            {view === "profile" && (
              <Profile
                account={wallet.account}
                onOpen={openContent}
                refreshKey={refreshKey}
              />
            )}
            {view === "content" && viewing && (
              <ContentView
                post={viewing}
                onBack={() => setView("timeline")}
                onValidate={setValidating}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {validating && (
          <ValidateModal
            post={validating}
            account={wallet.account}
            onClose={() => setValidating(null)}
            onChanged={() => setRefreshKey((k) => k + 1)}
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

/* --- Validate modal: real commit–reveal against ValidationMarket --------- */

function ValidateModal({
  post,
  account,
  onClose,
  onChanged,
}: {
  post: SamplePost;
  account: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
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
          <h3 style={{ fontSize: "1.25rem" }}>Validate this piece</h3>
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

        <ValidateFlow post={post} account={account} onChanged={onChanged} />
      </motion.div>
    </motion.div>
  );
}

// Window lengths kept short so a hackathon demo can go commit -> reveal ->
// resolve within minutes rather than days.
const COMMIT_WINDOW = 180; // 3 min
const REVEAL_WINDOW = 180; // 3 min

function ValidateFlow({
  post,
  account,
  onChanged,
}: {
  post: SamplePost;
  account: string | null;
  onChanged: () => void;
}) {
  // Sample posts (demo seed) have a non-empty topic and seeded reputation;
  // real on-chain items come through with topic "" and reputation 0.
  const sample = post.topic !== "" && post.reputation > 0;
  const deployed = marketDeployed();

  // For on-chain posts the topic isn't stored on-chain, so the validator picks
  // which field they're judging under (reputation is scoped per field).
  const [topic, setTopic] = useState<string>(post.topic || TOPICS[0].id);
  const [round, setRound] = useState<RoundState | null>(null);
  const [myVote, setMyVote] = useState<MyVote | null>(null);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [stake, setStake] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(deployed && !sample);
  const [, force] = useState(0);

  const refresh = useCallback(async () => {
    if (!deployed || sample) return;
    const r = await findRoundFor(post.id, topic);
    setRound(r);
    if (r && account) setMyVote(await getMyVote(r.roundId, account));
    else setMyVote(null);
  }, [deployed, sample, post.id, topic, account]);

  useEffect(() => {
    let cancelled = false;
    setLoading(deployed && !sample);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, deployed, sample]);

  // Tick so deadline-based phase labels stay current while the modal is open.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (sample) {
    return (
      <p className="notice info" style={{ fontSize: "0.85rem" }}>
        This is sample content for the demo. Register a real piece (or pick one
        from the chain) to open a live validation round.
      </p>
    );
  }
  if (!deployed) {
    return (
      <p className="notice warn" style={{ fontSize: "0.85rem" }}>
        The ValidationMarket contract isn't deployed, so validation is
        unavailable.
      </p>
    );
  }
  if (!account) {
    return (
      <p className="notice info" style={{ fontSize: "0.85rem" }}>
        Connect your wallet to open or join a validation round.
      </p>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const isAuthor =
    !!account &&
    !!post.author &&
    account.toLowerCase() === post.author.toLowerCase();

  async function run(label: string, fn: () => Promise<void>) {
    try {
      setBusy(true);
      setStatus(`${label}: confirm in your wallet...`);
      await fn();
      setStatus(`${label}: confirmed.`);
      await refresh();
      onChanged(); // let Timeline/Profile re-read fresh round + reputation
    } catch (err) {
      console.error(err);
      const msg =
        (err as { shortMessage?: string })?.shortMessage ??
        (err as Error)?.message ??
        "rejected";
      setStatus(`${label} failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="notice info">Reading the round from Monad...</p>;
  }

  // --- No round yet: offer to open one (author can't) ----------------------
  if (!round) {
    return (
      <>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No validation round is open for this piece yet. Opening one starts a{" "}
          {COMMIT_WINDOW / 60}-minute commit window, then a{" "}
          {REVEAL_WINDOW / 60}-minute reveal window.
        </p>
        <label className="field" style={{ marginTop: 14 }}>
          <span>Field (reputation scope)</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Minimum stake (MON)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
        </label>
        {isAuthor && (
          <div className="notice warn" style={{ fontSize: "0.8rem" }}>
            You're the author, so the contract won't let you open a round on your
            own content.
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={busy || isAuthor || !(Number(stake) > 0)}
          onClick={() =>
            run("Open round", () =>
              openRound(
                post.id,
                topic,
                COMMIT_WINDOW,
                REVEAL_WINDOW,
                parseEther(stake || "0")
              ).then(() => undefined)
            )
          }
        >
          {busy ? "Working..." : "Open validation round"}
        </button>
        {status && <div className="notice info">{status}</div>}
      </>
    );
  }

  // --- A round exists: show phase-appropriate action -----------------------
  const inCommit = round.phase === Phase.Commit && now < round.commitDeadline;
  const commitOver = now >= round.commitDeadline;
  const inReveal =
    (round.phase === Phase.Reveal ||
      (round.phase === Phase.Commit && commitOver)) &&
    now < round.revealDeadline;
  const revealOver = now >= round.revealDeadline;
  const resolved = round.phase === Phase.Resolved;

  return (
    <>
      <div className="notice info" style={{ fontSize: "0.8rem" }}>
        Round #{round.roundId} · min stake {formatEther(round.minStake)} MON ·{" "}
        {resolved
          ? `resolved: ${round.outcome ? "original" : "not original"}`
          : inCommit
          ? `commit closes ${new Date(round.commitDeadline * 1000).toLocaleTimeString()}`
          : inReveal
          ? `reveal closes ${new Date(round.revealDeadline * 1000).toLocaleTimeString()}`
          : revealOver
          ? "reveal window over - ready to resolve"
          : "-"}
      </div>

      {inCommit && !myVote?.committed && (
        <>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Your vote is hidden until reveal (commit-reveal), so nobody can copy
            or buy it. Stake backs your judgement: win with the majority and you
            earn the slashed losing stake; lose and you're slashed.
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
            <span>Stake (MON) · min {formatEther(round.minStake)}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
          </label>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={
              busy || choice === null || parseEther(stake || "0") < round.minStake
            }
            onClick={() =>
              run("Commit vote", () =>
                commitVote(
                  round.roundId,
                  choice!,
                  parseEther(stake || "0"),
                  account!
                )
              )
            }
          >
            {busy ? "Working..." : "Commit vote"}
          </button>
        </>
      )}

      {inCommit && myVote?.committed && (
        <p className="notice info" style={{ fontSize: "0.85rem" }}>
          Your vote is committed and staked ({formatEther(myVote.stake)} MON).
          Come back after the commit window to reveal it. Keep using this
          browser; the secret salt needed to reveal is stored here.
        </p>
      )}

      {inReveal && myVote?.committed && !myVote.revealed && (
        <>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Reveal phase. Submit your hidden vote so it counts. If you don't
            reveal, your stake is forfeited.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={busy}
            onClick={() =>
              run("Reveal vote", () => revealVote(round.roundId, account!))
            }
          >
            {busy ? "Working..." : "Reveal my vote"}
          </button>
        </>
      )}

      {inReveal && !myVote?.committed && (
        <p className="notice info" style={{ fontSize: "0.85rem" }}>
          This round is in its reveal phase, so new votes can't be committed.
        </p>
      )}

      {revealOver && !resolved && (
        <>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            The reveal window has closed. Anyone can resolve the round to tally
            the result and adjust reputation.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={busy}
            onClick={() =>
              run("Resolve round", () => resolveRound(round.roundId))
            }
          >
            {busy ? "Working..." : "Resolve round"}
          </button>
        </>
      )}

      {resolved && (
        <>
          <div
            className={`seal ${round.outcome ? "verified" : "disputed"}`}
            style={{ margin: "4px 0 14px" }}
          >
            {round.outcome ? "Verified original" : "Voted not original"}
          </div>
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Yes weight {formatEther(round.yesWeight)} · No weight{" "}
            {formatEther(round.noWeight)} MON.
          </p>
          {myVote?.committed && myVote.revealed && !myVote.claimed && (
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 12 }}
              disabled={busy}
              onClick={() =>
                run("Withdraw", () => withdrawRound(round.roundId))
              }
            >
              {busy ? "Working..." : "Withdraw stake + reward"}
            </button>
          )}
          {myVote?.claimed && (
            <p className="notice info" style={{ fontSize: "0.82rem" }}>
              You've already withdrawn from this round.
            </p>
          )}
        </>
      )}

      {status && <div className="notice info">{status}</div>}
    </>
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

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 12H4m0 0l3.5-3.5M4 12l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h6A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 10 18.5V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
