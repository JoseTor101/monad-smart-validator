import { useState } from "react";
import { describeError, getSigner, registerBurst } from "../lib/registry";

const COUNT = 10;

export default function DemoBurst({ account }: { account: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const run = async () => {
    setMessage("");
    if (!account) return setMessage("Connect your wallet first.");
    try {
      setBusy(true);
      const ms = await registerBurst(await getSigner(), COUNT, (done) =>
        setMessage(`${done} / ${COUNT} confirmed…`)
      );
      setMessage(`${COUNT} registrations confirmed in ${(ms / 1000).toFixed(1)} s.`);
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Speed demo</h2>
      <p className="hint">Registers {COUNT} generated test articles back to back to show confirmation speed.</p>
      <button className="primary" onClick={run} disabled={busy}>
        {busy ? "Sending…" : `Register ${COUNT} items`}
      </button>
      {message && <div className="status">{message}</div>}
    </div>
  );
}
