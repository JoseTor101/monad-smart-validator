# Cloudflare Pages deployment

The frontend (`frontend/`, Vite + React) deploys to **Cloudflare Pages** using
Cloudflare's **Git integration**. Cloudflare builds and deploys automatically:

- Push/merge to `main` → production deploy at `https://<project>.pages.dev`
- Open a pull request → a unique preview URL is posted on the PR

No GitHub Actions workflow or GitHub secrets are required — Cloudflare pulls the
repo and builds it directly.

---

## One-time setup (Cloudflare dashboard)

### 1. (If a Worker project exists) delete it

A static Vite site must be a **Pages** project, not a **Worker**. If a Worker
named `monad-smart-validator` exists, open it → **Settings** → scroll to the
bottom → **Delete**. This also removes the failing "Workers Builds" PR check.

### 2. Create a Pages project connected to Git

1. **Workers & Pages → Create → Pages tab → Connect to Git**.
2. Authorize GitHub and select the repo (`JoseTor101/monad-smart-validator`).
3. Click **Begin setup**.

### 3. Build configuration

| Field                  | Value                  |
| ---------------------- | ---------------------- |
| Project name           | `monad-smart-validator`|
| Production branch      | `main`                 |
| Framework preset       | `Vite`                 |
| Root directory         | `frontend`             |
| Build command          | `npm run build`        |
| Build output directory | `dist`                 |

### 4. Save and Deploy

The first build runs immediately. After it succeeds you get a
`https://<project>.pages.dev` URL. Subsequent pushes to `main` deploy to
production; pull requests get preview URLs automatically.

---

## Notes

- **Root directory must be `frontend`.** The app lives in a subfolder; building
  from the repo root pulls in the Hardhat/contract tooling and has no web build.
- **Output is `dist`.** The dev `frontend/index.html` references `/src/main.tsx`,
  which only works in Vite dev. The production build in `dist/index.html`
  references compiled `/assets/*.js`. Serving anything other than `dist` leaves
  the page blank with a "Failed to load module script" console error.
- `frontend/public/_redirects` sends all paths to `index.html` (SPA fallback) so
  client-side navigation and deep links resolve on Pages.
- Contract addresses live in `frontend/src/config.ts` and are compiled into the
  bundle at build time. After deploying contracts, update that file and merge to
  `main` to ship the change.

## Manual deploy (optional fallback)

If you ever need to deploy without Git integration:

```bash
cd frontend
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name=monad-smart-validator --branch=main
```

---

## Content uploads (Cloudflare R2)

Registered content (article text / images) is uploaded to an R2 bucket through
a same-origin Pages Function at `frontend/functions/api/upload.ts` (route
`POST /api/upload`). The browser never holds R2 credentials; the function uses
an R2 **binding**. Flow: hash in browser -> upload to R2 (no wallet) -> record
hash + public URL on-chain via `register()`.

### One-time Cloudflare setup

1. **Create the bucket** (done): `monad-smart-validator-cdn`.
2. **Enable public read** on the bucket: R2 bucket -> Settings -> Public access
   -> enable the r2.dev subdomain (or attach a custom domain). This yields a
   public base URL, e.g. `https://pub-<id>.r2.dev`. Public read is required so
   anyone can re-hash the hosted file and verify it against the on-chain hash.
3. **Bind the bucket to the Pages project:** Pages project
   (`monad-smart-validator`) -> Settings -> Bindings (Functions) -> add an
   **R2 bucket binding**:
   - Variable name: `CONTENT_BUCKET` (must match the code)
   - Bucket: `monad-smart-validator-cdn`
   - Add for Production (and Preview if desired).
4. **Set the public base URL env var:** Pages project -> Settings ->
   Variables and Secrets:
   - `PUBLIC_BASE_URL` = the r2.dev/custom-domain base, no trailing slash.

Bindings/vars take effect on the **next deploy**, so redeploy (push to `main`)
after adding them.

### Guardrails (in the function)

- 10 MB max file size (client and server enforced).
- Content-type allowlist: `image/*`, `text/*`, `application/pdf`.
- Objects are content-addressed (`content/<sha256>.<ext>`) so identical files
  dedupe and the key is tamper-evident.
- A per-IP rate limit is a sensible follow-up (needs KV/Durable Objects).

### Local testing

Pages Functions do **not** run under `npm run dev` (plain Vite) — `/api/upload`
will 404 there. Use Wrangler's Pages dev server instead, which serves the built
site + the function together. Two convenience scripts (run from `frontend/`):

```bash
# Against the REAL bucket (needs: npx wrangler login once). Closest to prod.
npm run preview:pages

# Fully local SIMULATED bucket (files land in .wrangler/, nothing hits CF).
npm run preview:pages:local
```

Both build first, then serve on http://localhost:8788.

For the returned upload URL to be clickable against the real bucket, set the
public base for the session before running:

```powershell
# PowerShell
$env:PUBLIC_BASE_URL="https://pub-a4dfb48ef85d4cc4b37460effc162202.r2.dev"
npm run preview:pages
```

```bash
# bash/zsh
PUBLIC_BASE_URL="https://pub-a4dfb48ef85d4cc4b37460effc162202.r2.dev" npm run preview:pages
```

Notes:
- `npm run dev` still works for pure UI work; uploads just won't function there.
- Editing source requires a rebuild (the scripts rebuild on each run).
- On-chain actions (wallet, register, validate) work the same locally since they
  use Monad's public RPC.
