# FreeLLM Hub — Free LLM API Directory

**FreeLLM Hub** is a fast, minimalist, developer-tool web directory that indexes exclusively **free-tier LLM APIs** from [`open-free-llm-api/awesome-freellm-apis`](https://github.com/open-free-llm-api/awesome-freellm-apis).

- **100% Static & Fast**: Pure HTML5, modern CSS3 (dark-mode default), and lightweight vanilla ES6+ JS. Zero build step, zero heavy dependencies, <50ms initial load.
- **Strict Free-Tier Scope**: Only indexes providers with verified free tiers (Permanent Free or Renewable Free Credits). Strictly excludes paid-only providers and paid tiers.
- **Dynamic Access Detection**: Zero hardcoded provider overrides. Automatically detects anonymous / unauthenticated vs. key-required tiers using generic rate-limit and auth pattern matching.
- **Developer Tooling**: Real-time search across providers and model names/IDs, multi-facet filtering (Modality, Auth type, Tier type), instant Cards ↔ Table view toggle, one-click copy for Base URLs and Model IDs, and ready-to-use Python (OpenAI SDK) and cURL snippets.
- **Zero Overhead**: No backend, no database, no user accounts, no payments, no tracking, and no ads.

---

## Quick Start & Local Preview

You can preview FreeLLM Hub locally in seconds using Python's built-in HTTP server or Node:

### 1. (Optional) Run the Parser
The repository includes pre-built `data.json`. To fetch and parse the latest data directly from the upstream repository:
```bash
python3 scripts/parse_data.py
```

### 2. Start the Local Server
```bash
# Using Python 3
python3 -m http.server 8080
```
*(Or if using Node.js: `npx serve .`)*

### 3. Open in Browser
Navigate to [http://localhost:8080](http://localhost:8080) to explore the directory.

---

## Pushing to GitHub & Activating Daily Auto-Update

The local project is initialized with Git on the `main` branch. To make the daily GitHub Actions pipeline operational, push it to your GitHub account:

### Option A: Using GitHub CLI (`gh`) — Recommended (1 command)
```bash
cd /home/sid/.gemini/antigravity/scratch/freellm-hub
gh repo create freellm-hub --public --source=. --remote=origin --push
```

### Option B: Using Standard Git Remote
```bash
cd /home/sid/.gemini/antigravity/scratch/freellm-hub
git remote add origin https://github.com/<your-username>/freellm-hub.git
git push -u origin main
```

---

## Required Post-Push Setup (GitHub Pages & Actions)

After pushing the repository to GitHub, configure two settings in your repository:

### 1. Enable Workflow Commit Permissions
The daily cron workflow uses GitHub's built-in `GITHUB_TOKEN` to commit `data.json`.
1. Go to your repository on GitHub: **Settings** → **Actions** → **General**.
2. Scroll to **Workflow permissions**.
3. Select **Read and write permissions**.
4. Click **Save**.

*(Or via CLI: `gh api -X PUT repos/{owner}/{repo}/actions/permissions/workflow -f default_workflow_permissions=write`)*

### 2. Enable GitHub Pages
1. Go to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **Deploy from a branch**.
3. Under **Branch**, select `main` and folder `/ (root)`.
4. Click **Save**.

Your directory is now live, and GitHub Actions will automatically refresh `data.json` daily at 06:00 UTC and redeploy.

---

## How the Daily Auto-Update Pipeline Works

```
┌────────────────────────┐
│ upstream GitHub Repo   │
│ awesome-freellm-apis   │
└───────────┬────────────┘
            │ 1. Daily cron (06:00 UTC) triggers
            ▼
┌────────────────────────┐
│ GitHub Actions Runner  │
│ .github/workflows/     │
│ update-data.yml        │
│                        │
│ - Runs parse_data.py   │
│ - Validates tables     │
│ - Updates data.json    │
└───────────┬────────────┘
            │ 2. git diff detected
            ▼
┌────────────────────────┐
│ Git Commit & Push      │
│ uses GITHUB_TOKEN      │
│ (permissions: write)   │
└───────────┬────────────┘
            │ 3. Push triggers auto-deploy
            ▼
┌────────────────────────┐
│ Hosting Platform       │
│ GitHub Pages / Vercel  │
│ Live site updated!     │
└────────────────────────┘
```

1. **Scheduled Trigger**: GitHub Actions runs `.github/workflows/update-data.yml` daily at 06:00 UTC (`cron: '0 6 * * *'`) and on manual `workflow_dispatch`.
2. **Selective Parsing**: `scripts/parse_data.py` downloads the upstream repository's `README.md` and parses only the verified free-tier comment blocks:
   - `<!-- BEGIN_PERMANENT_FREE -->`: Tagged as `tier_type: "permanent"` ("Always Free").
   - `<!-- BEGIN_RENEWABLE -->`: Tagged as `tier_type: "renewable"` ("Free Credits, renews periodically").
   - `<!-- BEGIN_QUICK_REF -->`: Resolves endpoint base URLs and API key signup links.
   - `<!-- BEGIN_BEST_MODELS -->`: Extracts model IDs, context windows, and rate limits.
   - *Generic Auth Rule*: Dynamically flags unauthenticated/anonymous access whenever rate limits or auth columns match anonymous indicators.
   - *Exclusion Rule*: Any paid tiers, paid pricing tables, or paid-only providers outside these blocks are strictly discarded.
3. **Automated Commit**: If `data.json` has changed, the workflow commits and pushes using GitHub's built-in `GITHUB_TOKEN` with write permissions (`permissions: contents: write`). No personal access token (PAT) or manual secret configuration is required.
4. **Instant Downstream Deployment**: The git push to `main` automatically triggers your hosting platform's deploy hook (GitHub Pages, Vercel, Netlify, or Cloudflare Pages) to update the live site.

---

## Alternative Deployment Options

### Vercel
1. Import your repository in [vercel.com](https://vercel.com).
2. Framework Preset: `Other`, Root Directory: `./`.
3. Click **Deploy**. Vercel will auto-deploy on every push from the daily update action.

### Netlify
1. Import repository in Netlify.
2. Publish directory: `.`, Build command: *(blank)*.
3. Click **Deploy Site**.

### Cloudflare Pages
1. Workers & Pages > Create application > Pages > Connect to Git.
2. Build output directory: `/`, Framework preset: `None`.
3. Click **Save and Deploy**.

---

## License

MIT License. Data sourced from [open-free-llm-api/awesome-freellm-apis](https://github.com/open-free-llm-api/awesome-freellm-apis).
