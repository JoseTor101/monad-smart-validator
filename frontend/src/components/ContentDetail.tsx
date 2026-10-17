import { useCallback, useEffect, useState } from "react";
import { hashFile, hashText } from "../lib/hash";
import {
  ContentInfo,
  KIND_ARTICLE,
  attestVersion,
  describeError,
  getSigner,
  hasVoted,
  loadContent,
  updateContent,
} from "../lib/registry";
import { formatTime, kindLabel, short } from "../lib/format";

type Props = { id: number; account: string | null };

export default function ContentDetail({ id, account }: Props) {
  const [content, setContent] = useState<ContentInfo | null>(null);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uri, setUri] = useState("");

  const refresh = useCallback(async () => {
    try {
      const c = await loadContent(id);
      setContent(c);
      if (account) {
        const flags: Record<number, boolean> = {};
        for (const v of c.versions) flags[v.index] = await hasVoted(id, v.index, account);
        setVoted(flags);
      } else {
        setVoted({});
      }
    } catch (err) {
      setContent(null);
      setMessage(describeError(err));
    }
  }, [id, account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (label: string, action: () => Promise<void>) => {
    setMessage("");
    try {
      setBusy(true);
      setMessage(`${label}: waiting for confirmation…`);
      await action();
      setMessage(`${label}: confirmed.`);
      await refresh();
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const vote = (version: number, supports: boolean) =>
    run(supports ? "Attest" : "Dispute", async () => attestVersion(await getSigner(), id, version, supports));

  const submitUpdate = () => {
    if (uri.trim() === "") return setMessage("A link to where the content can be found is required.");
    run("Update", async () => {
      const hash = content!.kind === KIND_ARTICLE ? await hashText(text) : file ? await hashFile(file) : null;
      if (!hash) throw new Error("Choose an image file.");
      await updateContent(await getSigner(), id, hash, uri.trim());
      setText("");
      setFile(null);
      setUri("");
    });
  };

  if (!content) return <div className="panel">{message || "Loading…"}</div>;

  const isAuthor = !!account && account.toLowerCase() === content.author.toLowerCase();
  const latest = content.versions.length - 1;

  return (
    <div className="panel">
      <h2>
        {kindLabel(content.kind)} #{content.id}
      </h2>
      <p className="hint">
        Registered first here by <code>{short(content.author)}</code> at {formatTime(content.versions[0].timestamp)}
      </p>
      <ol className="timeline">
        {content.versions.map((v) => (
          <li key={v.index}>
            <div>
              <strong>Version {v.index + 1}</strong>
              {v.index === latest && " (latest)"} · {formatTime(v.timestamp)}
            </div>
            <div className="hint">
              fingerprint <code>{short(v.hash, 10, 6)}</code> ·{" "}
              <a href={v.uri} target="_blank" rel="noreferrer">
                link
              </a>
            </div>
            <div>
              {v.attestCount} attest / {v.disputeCount} dispute{" "}
              <span className="hint">(unweighted community signals)</span>
            </div>
            {account && (
              <div className="row">
                <button className="ghost" disabled={busy || voted[v.index]} onClick={() => vote(v.index, true)}>
                  Attest
                </button>
                <button className="ghost" disabled={busy || voted[v.index]} onClick={() => vote(v.index, false)}>
                  Dispute
                </button>
                {voted[v.index] && <span className="hint">You already voted on this version.</span>}
              </div>
            )}
          </li>
        ))}
      </ol>
      {isAuthor && (
        <div className="subpanel">
          <h3>Publish a new version</h3>
          {content.kind === KIND_ARTICLE ? (
            <textarea rows={6} placeholder="Updated article text…" value={text} onChange={(e) => setText(e.target.value)} />
          ) : (
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          )}
          <input type="url" placeholder="Link to the updated content (required)" value={uri} onChange={(e) => setUri(e.target.value)} />
          <button className="primary" onClick={submitUpdate} disabled={busy}>
            Publish version
          </button>
        </div>
      )}
      {message && <div className="status">{message}</div>}
    </div>
  );
}
