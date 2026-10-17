import { useState } from "react";
import { Kind, TOPICS, isDeployed, REGISTRY_ADDRESS } from "../config";
import { Fingerprint } from "../components";
import {
  registryIsRegistered,
  registryWrite,
  sha256Hex,
  sha256Text,
  uploadArticleText,
  uploadContent,
  uploadMeta,
} from "../web3";

type Mode = "article" | "image";

// Turn an ethers/wallet error into a short, human message.
function registerErrorMessage(err: unknown): string {
  const e = err as {
    code?: string | number;
    reason?: string;
    shortMessage?: string;
    message?: string;
  };
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) {
    return "you rejected the transaction in your wallet.";
  }
  const reason = e?.reason ?? "";
  if (/already registered/i.test(reason)) {
    return "this exact content is already registered on-chain.";
  }
  if (/insufficient funds/i.test(e?.message ?? "")) {
    return "insufficient MON for gas. Get testnet MON from the faucet.";
  }
  return e?.reason ?? e?.shortMessage ?? e?.message ?? "unknown error.";
}

export function Register({ account }: { account: string | null }) {
  const [mode, setMode] = useState<Mode>("article");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>(TOPICS[0].id);
  const [body, setBody] = useState("");
  const [uri, setUri] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
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
    setImageFile(file);
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

      // 1) Upload the content to R2, then a small metadata JSON (title, field,
      //    content pointer). The on-chain uri points at the metadata so views
      //    can show the real title — the contract itself stores no title.
      //    If a uri was pasted manually (e.g. ipfs://), skip the upload.
      let finalUri = uri;
      const hasContentToUpload =
        (mode === "article" && body.trim()) || (mode === "image" && imageFile);
      const uriLooksExternal = /^(https?:|ipfs:)/i.test(uri.trim());

      if (hasContentToUpload && !uriLooksExternal) {
        setStatus("Uploading content to storage…");
        try {
          const content =
            mode === "article"
              ? await uploadArticleText(title, body)
              : await uploadContent(imageFile!);
          // The server hashes the same bytes, so it must match the local hash.
          if (content.hash.toLowerCase() !== hash.toLowerCase()) {
            console.warn("Server/client hash mismatch", content.hash, hash);
          }
          setStatus("Saving details…");
          const meta = await uploadMeta({
            title: title.trim() || "Untitled",
            field: topic,
            kind: mode === "article" ? "Article" : "Image",
            contentUrl: content.url,
            contentHash: content.hash,
          });
          finalUri = meta.url; // store the metadata path on-chain
          setUri(finalUri);
        } catch (err) {
          console.error(err);
          setStatus(
            `Upload failed: ${(err as Error).message}. You can paste a URL manually and retry.`
          );
          setBusy(false);
          return;
        }
      }

      // 2) Record the fingerprint + uri on-chain (the one wallet transaction).
      // Pre-check the duplicate guard so we give a clear message instead of a
      // generic revert.
      const alreadyRegistered = await registryIsRegistered(hash);
      if (alreadyRegistered) {
        setStatus(
          "This exact content is already registered on-chain. Change the content (even slightly) to register a new piece, or edit the existing one to add a version."
        );
        setBusy(false);
        return;
      }

      setStatus("Registering: confirm in your wallet…");
      const registry = await registryWrite();
      const kind = mode === "article" ? Kind.Article : Kind.Image;
      const tx = await registry.register(hash, finalUri || title, kind);
      setStatus(`Submitted ${tx.hash.slice(0, 10)}… — waiting for confirmation`);
      await tx.wait();
      setStatus("Registered. Provenance is now on-chain.");
      setTitle("");
      setBody("");
      setUri("");
      setImageFile(null);
      setHash(null);
    } catch (err) {
      console.error(err);
      setStatus(`Registration failed: ${registerErrorMessage(err)}`);
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
              On register, your content is uploaded to storage and its fingerprint,
              author and time are sealed on-chain. Anyone can later re-hash the
              hosted file and check it against this fingerprint — if a single
              character changes, so does the hash, and the edit becomes a new
              version.
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
