import { useState } from "react";
import { hashFile, hashText } from "../lib/hash";
import { KIND_ARTICLE, KIND_IMAGE, describeError, getSigner, registerContent } from "../lib/registry";

type Props = {
  account: string | null;
  onRegistered: (id: number) => void;
};

export default function RegisterForm({ account, onRegistered }: Props) {
  const [kind, setKind] = useState<number>(KIND_ARTICLE);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    setMessage("");
    if (!account) return setMessage("Connect your wallet first.");
    if (uri.trim() === "") return setMessage("A link to where the content can be found is required.");
    try {
      setBusy(true);
      const hash = kind === KIND_ARTICLE ? await hashText(text) : file ? await hashFile(file) : null;
      if (!hash) return setMessage("Choose an image file.");
      setMessage("Waiting for confirmation…");
      const { id, ms } = await registerContent(await getSigner(), hash, uri.trim(), kind);
      setMessage(`Registered as #${id} in ${(ms / 1000).toFixed(1)} s.`);
      onRegistered(id);
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Register content</h2>
      <p className="hint">
        Only a fingerprint (SHA-256) is recorded, together with you as the permanent author and the
        time. The content itself never leaves your device.
      </p>
      <div className="row">
        <label>
          <input type="radio" checked={kind === KIND_ARTICLE} onChange={() => setKind(KIND_ARTICLE)} /> Article
        </label>
        <label>
          <input type="radio" checked={kind === KIND_IMAGE} onChange={() => setKind(KIND_IMAGE)} /> Image
        </label>
      </div>
      {kind === KIND_ARTICLE ? (
        <textarea rows={8} placeholder="Paste the article text…" value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      )}
      <input type="url" placeholder="Link to where this content can be found (required)" value={uri} onChange={(e) => setUri(e.target.value)} />
      <button className="primary" onClick={submit} disabled={busy}>
        {busy ? "Working…" : "Register"}
      </button>
      {message && <div className="status">{message}</div>}
    </div>
  );
}
