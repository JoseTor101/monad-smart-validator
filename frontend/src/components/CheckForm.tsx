import { useState } from "react";
import { hashFile, hashText } from "../lib/hash";
import { CheckResult, checkHash, describeError } from "../lib/registry";
import { formatTime, short } from "../lib/format";

type Props = { onOpen: (id: number) => void };

export default function CheckForm({ onOpen }: Props) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);

  const run = async () => {
    setMessage("");
    setResult(null);
    try {
      setBusy(true);
      const hash = mode === "text" ? await hashText(text) : file ? await hashFile(file) : null;
      if (!hash) return setMessage("Choose an image file.");
      setResult(await checkHash(hash));
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const r = result && result.found ? result : null;
  const version = r ? r.content.versions[r.matched] : null;
  const first = r ? r.content.versions[0] : null;

  return (
    <div className="panel">
      <h2>Check against registry</h2>
      <p className="hint">
        Submit content to see whether this exact content is registered. No wallet needed. A match
        shows who registered it first and when; it does not say the content is accurate.
      </p>
      <div className="row">
        <label>
          <input type="radio" checked={mode === "text"} onChange={() => setMode("text")} /> Text
        </label>
        <label>
          <input type="radio" checked={mode === "image"} onChange={() => setMode("image")} /> Image
        </label>
      </div>
      {mode === "text" ? (
        <textarea rows={8} placeholder="Paste the text to check…" value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      )}
      <button className="primary" onClick={run} disabled={busy}>
        {busy ? "Checking…" : "Check against registry"}
      </button>
      {message && <div className="status">{message}</div>}
      {result && !result.found && <div className="result none">No registered record for this exact content.</div>}
      {r && version && first && (
        <div className="result">
          <div>
            Registered first here by <code>{short(r.content.author)}</code> at {formatTime(first.timestamp)}
          </div>
          <div>
            <strong>{r.unchanged ? "Unchanged" : "Modified (a newer version exists)"}</strong> · matches version {r.matched + 1} of{" "}
            {r.content.versions.length}
          </div>
          <div>
            {version.attestCount} attest / {version.disputeCount} dispute{" "}
            <span className="hint">(unweighted community signals for this version)</span>
          </div>
          {!r.unchanged && <div className="hint">A newer version exists with its own counts.</div>}
          <button className="ghost" onClick={() => onOpen(r.content.id)}>
            Open record #{r.content.id}
          </button>
        </div>
      )}
    </div>
  );
}
