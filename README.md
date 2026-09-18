# FreeLLM Hub — Free LLM API Directory

**FreeLLM Hub** is a fast, minimalist, developer-tool web directory that indexes exclusively **free-tier LLM APIs** from [`open-free-llm-api/awesome-freellm-apis`](https://github.com/open-free-llm-api/awesome-freellm-apis).

- **100% Static & Fast**: Pure HTML5, modern CSS3 (dark-mode default), and lightweight vanilla ES6+ JS. Zero build step, zero heavy dependencies, <50ms initial load.
- **Strict Free-Tier Scope**: Only indexes providers with verified free tiers (Permanent Free or Renewable Free Credits). Strictly excludes paid-only providers and paid tiers.
- **Developer Tooling**: Real-time search across providers and model names/IDs, multi-facet filtering (Modality, Auth type, Tier type), instant Cards ↔ Table view toggle, one-click copy for Base URLs and Model IDs, and ready-to-use Python (OpenAI SDK) and cURL snippets.
- **Zero Overhead**: No backend, no database, no user accounts, no payments, no tracking, and no ads.

---

## Quick Start & Local Preview

You can preview FreeLLM Hub locally in seconds using Python's built-in HTTP server or Node:

### 1. (Optional) Run the Parser
The repository includes pre-built `data.json`. If you want to fetch and parse the latest data directly from the upstream repository:
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

## Project Structure

```
freellm-hub/
├── .github/
│   └── workflows/
│       └── update-data.yml    # Daily cron workflow for automated data updates
├── css/
│   └── style.css              # Minimal developer-tool dark theme
├── js/
│   └── app.js                 # Search, filtering, view toggle & snippet generator
├── scripts/
│   └── parse_data.py          # Python parsing engine for upstream README
├── data.json                  # Structured dataset of free-tier providers & models
├── index.html                 # Single-page static directory
└── README.md                  # Project documentation & deployment guide
```

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

1. **Scheduled Trigger**: GitHub Actions runs `.github/workflows/update-data.yml` daily at 06:00 UTC (`cron: '0 6 * * *'`). It can also be triggered manually anytime via the `workflow_dispatch` button in the GitHub Actions UI.
2. **Selective Parsing**: `scripts/parse_data.py` downloads the upstream repository's `README.md` and parses only the verified free-tier comment blocks:
   - `<!-- BEGIN_PERMANENT_FREE -->`: Tagged as `tier_type: "permanent"` ("Always Free").
   - `<!-- BEGIN_RENEWABLE -->`: Tagged as `tier_type: "renewable"` ("Free Credits, renews periodically").
   - `<!-- BEGIN_QUICK_REF -->`: Resolves endpoint base URLs and API key signup links.
   - `<!-- BEGIN_BEST_MODELS -->`: Extracts model IDs, context windows, and rate limits.
   - *Exclusion Rule*: Any paid tiers, paid pricing tables, or paid-only providers outside these blocks are strictly discarded.
3. **Automated Commit**: If `data.json` has changed, the workflow commits and pushes using GitHub's built-in `GITHUB_TOKEN` with write permissions (`permissions: contents: write`). No personal access token (PAT) or manual secret configuration is required.
4. **Instant Downstream Deployment**: The git push to `main` automatically triggers your hosting platform's deploy hook (GitHub Pages, Vercel, Netlify, or Cloudflare Pages) to update the live site.

---

## Deployment Guide

Because FreeLLM Hub is 100% static, you can deploy it to any static hosting service for free:

### Option 1: GitHub Pages (Recommended)

1. Push this repository to GitHub.
2. In your repository on GitHub, navigate to **Settings** > **Pages**.
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main` and folder `/ (root)`.
   - Click **Save**.
4. In **Settings** > **Actions** > **General**:
   - Scroll down to **Workflow permissions**.
   - Ensure **Read and write permissions** is selected (enabling the daily update workflow to commit `data.json`).
5. Your site is live! Whenever the daily workflow updates `data.json`, GitHub Pages will automatically publish the new version.

### Option 2: Vercel

1. Push this repository to GitHub.
2. Log into [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository:
   - **Framework Preset**: `Other` (or None).
   - **Root Directory**: `./`
   - **Build Command**: *(leave blank)*
   - **Output Directory**: `./`
4. Click **Deploy**. Vercel will auto-deploy on every push made by the daily GitHub Action.

### Option 3: Netlify

1. Push this repository to GitHub.
2. In Netlify, click **Add new site** > **Import an existing project**.
3. Select your repository:
   - **Branch to deploy**: `main`
   - **Publish directory**: `.` (leave build command blank).
4. Click **Deploy Site**. Netlify will auto-deploy on every commit.

### Option 4: Cloudflare Pages

1. In the Cloudflare dashboard, navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Select your repository:
   - **Framework preset**: `None`
   - **Build output directory**: `/`
3. Click **Save and Deploy**.

---

## License

MIT License. Data sourced from [open-free-llm-api/awesome-freellm-apis](https://github.com/open-free-llm-api/awesome-freellm-apis).
