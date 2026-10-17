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
