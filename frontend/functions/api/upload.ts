/// <reference types="@cloudflare/workers-types" />

// Cloudflare Pages Function: POST /api/upload
//
// Receives a file (multipart/form-data, field "file") and stores it in the R2
// bucket bound as `CONTENT_BUCKET`. Returns the object key + a public URL.
//
// Why a Function (not direct-from-browser): R2 credentials must never ship in
// the frontend bundle. The binding keeps writes server-side, same-origin (no
// CORS), and the file simply passes through this function.
//
// Guardrails (Option A, anonymous upload):
//   - hard size cap (MAX_BYTES)
//   - content-type allowlist (articles as text, images)
// A per-IP rate limit is a sensible follow-up (needs KV or Durable Objects).

interface Env {
  // R2 bucket binding — configure in Pages → Settings → Functions → R2 bindings
  CONTENT_BUCKET: R2Bucket;
  // Public base URL for reads, e.g. the bucket's r2.dev URL or a custom domain.
  // Set as a Pages environment variable. No trailing slash.
  PUBLIC_BASE_URL?: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_PREFIXES = ["image/", "text/", "application/pdf"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function extFor(name: string, type: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()! : "";
  if (fromName) return fromName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  if (type.startsWith("image/")) return type.slice(6);
  if (type === "text/plain") return "txt";
  return "bin";
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (!env.CONTENT_BUCKET) {
    return json({ error: "Storage not configured (missing R2 binding)." }, 500);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Expected multipart/form-data." }, 400);
  }

  const entry = form.get("file");
  // In the Workers runtime a file field is a File/Blob with arrayBuffer().
  // Duck-type rather than `instanceof File` (not reliably typed in this lib).
  const file = entry as unknown as {
    name?: string;
    type?: string;
    size?: number;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  } | null;
  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "No file provided (field 'file')." }, 400);
  }
  const fileName = file.name ?? "upload";
  const fileSize = file.size ?? 0;

  if (fileSize === 0) return json({ error: "Empty file." }, 400);
  if (fileSize > MAX_BYTES) {
    return json(
      { error: `File too large. Max ${MAX_BYTES / (1024 * 1024)} MB.` },
      413
    );
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED_PREFIXES.some((p) => type.startsWith(p))) {
    return json({ error: `Unsupported content type: ${type}` }, 415);
  }

  // Content-addressed key: hash the bytes so identical files dedupe and the
  // key itself is tamper-evident. Mirrors the on-chain fingerprint scheme.
  const buf = await file.arrayBuffer!();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hashHex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const key = `content/${hashHex}.${extFor(fileName, type)}`;

  try {
    await env.CONTENT_BUCKET.put(key, buf, {
      httpMetadata: { contentType: type },
    });
  } catch (err) {
    return json({ error: `Upload failed: ${(err as Error).message}` }, 502);
  }

  const base = (env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const url = base ? `${base}/${key}` : key;

  return json({ key, url, hash: `0x${hashHex}`, size: fileSize, contentType: type });
};
