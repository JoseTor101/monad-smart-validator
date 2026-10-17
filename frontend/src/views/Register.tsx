import { useState } from "react";
import { Kind, TOPICS, isDeployed, REGISTRY_ADDRESS } from "../config";
import { Fingerprint } from "../components";
import { registryWrite, sha256Hex, sha256Text } from "../web3";

type Mode = "article" | "image";

export function Register({ account }: { account: string | null }) {
  const [mode, setMode] = useState<Mode>("article");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>(TOPICS[0].id);
  const [body, setBody] = useState("");
  const [uri, setUri] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const deployed = isDeployed(REGISTRY_ADDRESS);

  async function recomputeFromText(text: string) {
    setBody(text);
    setHash(text.trim() ? await sha256Text(text) : null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const buf = await file.arrayBuffer();
    setHash(await sha256Hex(buf));
    setUri(file.name);
  }

  async function submit() {
    if (!account) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!hash) {
      setStatus("Add content so we can hash it.");
      return;
    }
    if (!deployed) {
      setStatus(
        "Contracts aren't deployed yet. Run `npm run deploy` and paste the registry address into config.ts to register for real."
      );
      return;
    }
    try {
      setBusy(true);
      setStatus("Registering: confirm in your wallet…");
      const registry = await registryWrite();
      const kind = mode === "article" ? Kind.Article : Kind.Image;
      const tx = await registry.register(hash, uri || title, kind);
      setStatus(`Submitted ${tx.hash.slice(0, 10)}… — waiting for confirmation`);
      await tx.wait();
      setStatus("Registered. Provenance is now on-chain.");
      setTitle("");
      setBody("");
      setUri("");
      setHash(null);
    } catch (err) {
      console.error(err);
      setStatus("Registration failed or was rejected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="section" style={{ marginTop: 8 }}>
        <h2>Register content</h2>
        <p className="sub">
          We hash your work in the browser and record only the fingerprint,
          author, and time on-chain. The content itself stays wherever you host
          it.
        </p>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="row" style={{ marginBottom: 18, gap: 8 }}>
            <button
              className={`btn${mode === "article" ? " btn-primary" : ""}`}
              onClick={() => {
                setMode("article");
                setHash(null);
              }}
            >
              Article
            </button>
            <button
              className={`btn${mode === "image" ? " btn-primary" : ""}`}
              onClick={() => {
                setMode("image");
                setHash(null);
              }}
            >
              Image
            </button>
          </div>

          <label className="field">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this piece"
            />
          </label>

          <label className="field">
            <span>Field</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {mode === "article" ? (
            <label className="field">
              <span>Body</span>
              <textarea
                value={body}
                onChange={(e) => recomputeFromText(e.target.value)}
                placeholder="Paste the article text. Hashing happens as you type."
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>Image file</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              <label className="field">
                <span>Where it's hosted (uri)</span>
                <input
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="ipfs://… or https://…"
                />
              </label>
            </>
          )}

          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
            style={{ width: "100%", marginTop: 4 }}
          >
            {busy ? "Working…" : "Register provenance"}
          </button>

          {status && <div className="notice info">{status}</div>}
        </div>

        <div>
          <div className="panel">
            <div className="k muted" style={{ fontSize: "0.75rem" }}>
              Content fingerprint
            </div>
            <div style={{ marginTop: 12 }}>
              {hash ? (
                <Fingerprint hash={hash} />
              ) : (
                <span className="muted" style={{ fontSize: "0.875rem" }}>
                  Add content to see its hash
                </span>
              )}
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: 16 }}>
              Anyone can later re-hash the published content and check it against
              this fingerprint. If a single character changes, the hash changes,
              and the edit shows up as a new version.
            </p>
          </div>

          {!deployed && (
            <div className="notice warn">
              Preview mode: contracts not deployed. Hashing works locally;
              on-chain registration is disabled until an address is set in
              config.ts.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
