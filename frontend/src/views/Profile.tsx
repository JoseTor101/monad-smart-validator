import { motion } from "motion/react";
import { Avatar, RepMeter } from "../components";
import { SAMPLE_PROFILE } from "../sampleData";
import { MONAD_TESTNET } from "../config";
import { shortAddr } from "../web3";

export function Profile({ account }: { account: string | null }) {
  const addr = account ?? "0x0000000000000000000000000000000000000000";
  const p = SAMPLE_PROFILE;

  return (
    <section>
      <div className="section" style={{ marginTop: 8 }}>
        <h2>Your standing</h2>
        <p className="sub">
          Reputation, registrations, and the on-chain record behind them. Every
          number here traces back to a transaction anyone can audit.
        </p>
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
          <div style={{ maxWidth: 260, marginTop: 14 }}>
            <RepMeter score={p.reputation} />
          </div>
        </div>
      </motion.div>

      <div className="stat-row">
        <Stat k="Reputation" v={p.reputation} />
        <Stat k="Content registered" v={p.registered} />
        <Stat k="Validations cast" v={p.validations} />
        <Stat k="Disputes won" v={p.disputesWon} />
      </div>

      <div className="section">
        <h2 style={{ fontSize: "1.65rem" }}>Activity</h2>
      </div>
      <div className="panel">
        {p.txs.map((tx, i) => (
          <motion.div
            key={i}
            className="txrow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.3 }}
          >
            <span className="tx-kind">{tx.kind}</span>
            <span className="muted">{tx.detail}</span>
            <a
              className="tx-hash"
              href={`${MONAD_TESTNET.blockExplorerUrl}/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
              title="Open in explorer"
            >
              {tx.hash} · {tx.when}
            </a>
          </motion.div>
        ))}
      </div>
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
