/// <reference types="@cloudflare/workers-types" />

// Cloudflare Pages Function: GET /content/*
//
// Serves objects straight from the R2 bucket bound as `CONTENT_BUCKET`. This
// makes reads work identically in local `wrangler pages dev` and in production,
// without depending on the bucket's public r2.dev URL or on SPA-fallback
// routing (which would otherwise return index.html for /content/<key>).
//
// The route lives under functions/content/ so it is matched BEFORE the SPA
// catch-all in _redirects.

interface Env {
  CONTENT_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env, params } = ctx;

  if (!env.CONTENT_BUCKET) {
    return new Response("Storage not configured.", { status: 500 });
  }

  // params.path is the catch-all segment(s) after /content/.
  const parts = params.path;
  const rel = Array.isArray(parts) ? parts.join("/") : String(parts ?? "");
  if (!rel) return new Response("Not found", { status: 404 });

  const key = `content/${rel}`;
  const object = await env.CONTENT_BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // Content is immutable (content-addressed key) — cache aggressively.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
};
