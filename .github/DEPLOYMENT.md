# Cloudflare Pages deployment

The frontend (`frontend/`, Vite + React) auto-deploys to **Cloudflare Pages**
on every push/merge to `main` via the GitHub Actions workflow at
`.github/workflows/deploy.yml`.

Pipeline: checkout → Node 20 → `npm ci` → `npm run build` → `wrangler pages deploy frontend/dist`.

---

## One-time setup

### 1. Create the Cloudflare Pages project

You only need to create an empty project once; the CI uploads builds to it.

**Option A — Dashboard**
1. Log in at https://dash.cloudflare.com
2. Go to **Workers & Pages → Create → Pages → Direct Upload (Upload assets)**.
3. Name the project **`monad-hackaton`** (must match `--project-name` in the workflow).
4. Finish creating it (you can upload a placeholder; CI overwrites it).

**Option B — CLI (from the `frontend/` folder)**
```bash
cd frontend
npm run build
npx wrangler login
npx wrangler pages project create monad-hackaton --production-branch=main
npx wrangler pages deploy dist --project-name=monad-hackaton --branch=main
```

> The project name `monad-hackaton` and branch `main` must match the workflow.
> If you choose a different project name, update `--project-name` in
> `.github/workflows/deploy.yml`.

### 2. Get your Cloudflare Account ID

- Dashboard → **Workers & Pages** → the **Account ID** is shown in the right
  sidebar (or in the URL: `dash.cloudflare.com/<ACCOUNT_ID>`).

### 3. Create a Cloudflare API token

1. Dashboard → **My Profile → API Tokens → Create Token**.
2. Use the **"Edit Cloudflare Workers"** template, or create a custom token with:
   - **Account → Cloudflare Pages → Edit**
3. Create the token and copy it (shown only once).

### 4. Add the secrets to GitHub

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret name             | Value                          |
| ----------------------- | ------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | the API token from step 3      |
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID from step 2     |

---

## How it runs

- Push or merge to `main` → the workflow builds and deploys automatically.
- You can also trigger it manually from the repo's **Actions** tab
  (workflow_dispatch).
- Production URL: `https://monad-hackaton.pages.dev` (Cloudflare also creates a
  unique preview URL per deployment).

## Notes

- `frontend/public/_redirects` sends all paths to `index.html` (SPA fallback),
  so client-side navigation and deep links resolve correctly.
- Contract addresses live in `frontend/src/config.ts` and are compiled into the
  bundle at build time. After deploying contracts, update that file and merge to
  `main` to ship the change.
- Node version is pinned to 20 in the workflow; `npm ci` uses
  `frontend/package-lock.json` for reproducible installs.
