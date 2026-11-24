# Deploying the preview to Vercel

The app is a Next.js 16 project. Vercel detects it automatically. `vercel.json` sets the build command (migrations, then build) and turns off deployments from `main`.

**Live address:** https://chandra-psf.vercel.app
(Vercel project `abrahamlinksus-projects/chandra-psf`)

The site is hidden from search engines: every page has a `noindex` tag, and `/robots.txt` says `Disallow: /`. Any unknown address shows a plain "not found" page.

## Environment variables

This table is for the frozen phase 1 demo (Vercel project `chandra-psf`). The phase 2 preview keys are in the preview checklist below.

Set these in the Vercel project (Settings > Environment Variables) for both **Production** and **Preview**. Never write the values into a tracked file, a commit or the chat. The phase 2 keys are listed in `.env.example`; `NEXT_PUBLIC_DEMO_PASSWORD` is phase 1 only and is not in `.env.example`.

| Name | What it is | Notes |
|---|---|---|
| `NEXT_PUBLIC_DEMO_PASSWORD` | The demo sign-in password | Phase 1 only. Shown on the sign-in screen by design, so it is stored as a plain (non-secret) variable. |
| `NEXT_PUBLIC_DEALER_PHONE` | Dealer phone number shown to customers | Currently a placeholder (`+91 44 0000 0000`). Replace it with the real number before sharing. |
| `APP_URL` | Public address of the app | **Optional, not set on the demo project** (on purpose). If it is missing, the app uses the address the browser is currently on, so links also work on preview deployments. Set it only to pin a fixed address (for example, a custom domain). The key is `APP_URL` (no `NEXT_PUBLIC_` prefix); it is read on the server. |

These values are built into the app at build time. **After changing any of them, redeploy.**

## First-time setup

1. `vercel login` (sign in to your Vercel account).
2. `vercel link --yes --project chandra-psf` (run in the project folder).
3. Add the variables, for each of Production and Preview:
   - `vercel env add NEXT_PUBLIC_DEMO_PASSWORD production` (and `preview`)
   - `vercel env add NEXT_PUBLIC_DEALER_PHONE production` (and `preview`)
   - Or use the dashboard.
4. `vercel deploy --prod`.

## Changing the dealer phone number

1. Remove the old value: `vercel env rm NEXT_PUBLIC_DEALER_PHONE production` and the same with `preview`.
2. Add the new value: `vercel env add NEXT_PUBLIC_DEALER_PHONE production` and the same with `preview`.
3. Redeploy: `vercel deploy --prod`.

## Redeploy

- After a code change: run `scripts/check.sh` first, then `vercel deploy --prod`.
- After an environment variable change: `vercel deploy --prod` (or Redeploy in the Vercel dashboard).

## Roll back

In the Vercel dashboard, open Deployments, pick an earlier deployment and choose **Promote to Production**.

## Verify a deployment

1. The address starts with `https://` and the padlock shows in the browser.
2. `/robots.txt` shows `Disallow: /`.
3. `/nope` shows the not-found page, with no error details or stack trace.
4. On a phone, walk through the flow: sign in, then `/support/new`, then `/f/<token>`, then the thank-you page.

## Keep out of Git

- `.vercel/` (created by `vercel link`) and `.env.local` are git-ignored. Never commit them.
- Never paste environment values into chat, commit messages or issue trackers.

## Preview on a new Vercel project (owner checklist)

This puts a preview of the phase-2 app on its own Vercel project. It does not touch `chandra-psf`. Production deploys stay off until T-28. Never type or paste a secret value into this repo, a commit or the team chat. Copy values straight from Neon and your password manager into Vercel.

1. Create a **new** Vercel project from the GitHub repo. Its name must differ from `chandra-psf` (for example `chandra-psf-preview`). In the project settings, check:
   - Framework: **Next.js**.
   - Package manager: **pnpm**. The repo pins `pnpm@11.24.0` in `packageManager`, and Corepack uses that pin.
   - Node.js version: **24.x**.
   - `vercel.json` already sets the build command to `pnpm db:migrate && next build` and turns off deployments from `main`. Leave both as they are.
   - `vercel.json` also pins functions to region `sin1` (Singapore), next to the Neon database (aws ap-southeast-1). The default `iad1` made sign-in take about 3-4 s.
2. Neon: this project's main branch is named `production`. **Do not use it for preview.** Use the `dev` branch. Copy its **pooled** connection URL and its **unpooled (direct)** connection URL.
3. Add these variables for the **Preview** environment only (not Production):
   - `DATABASE_URL`: the `dev` pooled URL. Used at runtime and by the build.
   - `DATABASE_URL_UNPOOLED`: the `dev` direct URL. Used by `db:migrate` and by `pnpm admin`.
   - `IP_HASH_PEPPER`: 32 or more random characters (base64). Generate it on your laptop.
   - `CRON_SECRET`: 32 or more random characters.
   - `APP_URL`: the preview's `https://` address. Leave it empty until step 5. It must start with `https://`.
   - `NEXT_PUBLIC_DEALER_PHONE`, `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_PRIVACY_PHONE`, `NEXT_PUBLIC_PRIVACY_EMAIL`: placeholder text is fine for a preview.
   - `NEXT_PUBLIC_POLL_SECONDS`: `30`.
   - `AUTH_HASH_TIMING` (optional): `1` only while checking sign-in timing (sign in about 20 times, read the log), then unset it. Not a secret; it is not in `.env.example`.
   - How the app checks these values:
     - The strict server rules in `src/server/env.ts` (pglite not allowed, `DATABASE_URL_UNPOOLED`, `CRON_SECRET` and `IP_HASH_PEPPER` required, `APP_URL` required and `https://`) run only when `VERCEL_ENV=production`. A wrong Preview value for those will **not** fail the build, so read each value back after saving and check it.
     - Always enforced, Preview included: `DATABASE_URL` is required, and `APP_URL`, if set, must be a valid URL.
     - These checks run lazily, on the first read of the server settings, not at the start of the build.
     - `src/config/env.ts` requires `NEXT_PUBLIC_DEALER_PHONE` in any `NODE_ENV=production` build, Preview included. Without it the build fails.
4. Push the `wip/...` branch or open a pull request, so that Vercel builds a Preview deployment. That build runs the migrations against `dev`.
   - **Never run `vercel deploy --prod` on the preview project** (the `main` auto-deploy is off). The other `--prod` commands in this file are for the demo project `chandra-psf`.
5. Open the new deployment in the Vercel dashboard and copy its `https://` address. Set `APP_URL` to that address, then redeploy the preview.
6. On your laptop, run `pnpm admin init` with `DATABASE_URL_UNPOOLED` pointing at the **`dev`** direct URL. Never use the `production` URL for this command.
7. Send the team the preview URL only (just the address, for example `https://<name>.vercel.app`), through the Orchestrator conversation. The verify-preview step then checks the first admin sign-in and password, adds a branch and a support user, the sign-in timing (argon2), `noindex`, the security headers and the not-found page.

## Demo (phase 1) — frozen

- Git tag `demo-v1` (annotated) and branch `demo`, both at commit `67ceeb1`, hold the exact code live on https://chandra-psf.vercel.app.
- The demo Vercel project `chandra-psf` is not connected to GitHub (checked 2026-11-22 and confirmed by the owner). It was deployed with the Vercel CLI, so pushes and merges to main never redeploy it.
- To redeploy the demo (only if ever needed): switch a checkout to the `demo` branch, link it to the `chandra-psf` project with the Vercel CLI, and run a production deploy. If the link step edits `.gitignore`, undo that edit.
- To take it offline at launch (D-25): Vercel dashboard → project `chandra-psf` → Settings → Advanced → Delete Project (or pause it).
- Phase-2 production is a separate Vercel project (preview in T-05b, production in T-28), never `chandra-psf`.
