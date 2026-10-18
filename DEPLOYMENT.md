# Cloudflare Pages Deployment Guide

This guide walks you through deploying your **OmniSearch Google Search Console Dashboard** to **Cloudflare Pages** with a **Cloudflare D1 SQLite database**.

---

## ⚡ Option 1: Direct CLI Deployment (Fastest)

If you have the Cloudflare CLI (`wrangler`) logged into your Cloudflare account, you can deploy directly from your terminal in 3 steps:

### Step 1: Login to Cloudflare (one-time)
```bash
npx wrangler login
```

### Step 2: Create your remote D1 database
```bash
npx wrangler d1 create gsc-database
```
Wrangler will output something like:
```toml
[[d1_databases]]
binding = "DB"
database_name = "gsc-database"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Copy that `database_id` into your `wrangler.toml` file under `database_id`.

### Step 3: Run the database migration
```bash
npm run d1:migrate:remote
```

### Step 4: Build and Deploy to Cloudflare Pages
```bash
npm run deploy
```
When prompted for a project name on your first deploy, accept `gsc-dashboard`. Wrangler will build your SolidJS app and Cloudflare Pages Functions, deploy to Cloudflare's global edge network, and provide you with your live `*.pages.dev` URL!

---

## 🌐 Option 2: Git-Connected Deployment (Recommended for Teams & CI/CD)

### Step 1: Push project to GitHub or GitLab
```bash
git init
git add .
git commit -m "Initial commit of OmniSearch GSC Dashboard"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### Step 2: Create Pages Project in Cloudflare Dashboard
1. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the sidebar, navigate to **Compute (Workers) > Workers & Pages**.
3. Click **Create** > **Pages** tab > **Connect to Git**.
4. Select your repository and configure the build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Click **Save and Deploy**.

### Step 3: Create & Bind the D1 Database
1. In Cloudflare Dashboard, navigate to **Storage & Databases > D1 SQL Database**.
2. Click **Create database**, name it `gsc-database`, and create it.
3. Click on your new database > **Console** tab, paste the contents of `schema.sql`, and click **Execute**.
4. Navigate back to **Workers & Pages** > select your `gsc-dashboard` project.
5. Go to **Settings > Functions > D1 database bindings**:
   - Click **Add binding**.
   - **Variable name**: `DB`
   - **D1 database**: select `gsc-database`.
   - Click **Save**.

---

## 🔑 Setting Up Google OAuth 2.0 (for Live Data)

To connect with live Google Search Console data:

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Google Search Console API** (Search for "Google Search Console API" in APIs & Services > Library, and click **Enable**).
3. Go to **APIs & Services > Credentials** > **Create Credentials** > **OAuth client ID**:
   - **Application type**: Web application
   - **Name**: OmniSearch Console
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `https://<your-project>.pages.dev`
   - **Authorized redirect URIs**:
     - Local development: `http://localhost:5173/api/auth/callback`
     - Production: `https://<your-project>.pages.dev/api/auth/callback`
4. Copy your **Client ID** and **Client Secret**.
5. Add these environment variables to Cloudflare Pages:
   - In Cloudflare Dashboard > `gsc-dashboard` > **Settings > Environment variables**:
     - `GOOGLE_CLIENT_ID`: `your-client-id.apps.googleusercontent.com`
     - `GOOGLE_CLIENT_SECRET`: `your-client-secret`
     - `SESSION_SECRET`: Any random 32+ character string

---

## 🧪 Testing Locally with Cloudflare Pages Functions

To run both the frontend and Cloudflare Pages edge functions locally with SQLite:

```bash
# Initialize local D1 database
npm run d1:migrate:local

# Run full-stack Cloudflare Pages emulator
npm run dev:pages
```
The app will be available at `http://localhost:8788`.
