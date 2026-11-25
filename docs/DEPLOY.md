# Deploying to Vercel (demo, preview and production)

The app is a Next.js 16 project. Vercel detects it automatically. `vercel.json` sets the build command (migrations, then build), the region `sin1` and the daily cron. Since T-28, a push to `main` deploys to Production. The demo project is not connected to GitHub, so that does not touch the demo.

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

This puts a preview of the phase-2 app on its own Vercel project. It does not touch `chandra-psf`. Never type or paste a secret value into this repo, a commit or the team chat. Copy values straight from Neon and your password manager into Vercel.

1. Create a **new** Vercel project from the GitHub repo. Its name must differ from `chandra-psf` (for example `chandra-psf-preview`). In the project settings, check:
   - Framework: **Next.js**.
   - Package manager: **pnpm**. The repo pins `pnpm@11.24.0` in `packageManager`, and Corepack uses that pin.
   - Node.js version: **24.x**.
   - `vercel.json` already sets the build command to `pnpm db:migrate && next build`. Leave it as it is.
   - `vercel.json` also pins functions to region `sin1` (Singapore), next to the Neon database (aws ap-southeast-1). The default `iad1` made sign-in take about 3-4 s.
2. Neon: the production database is the Neon branch `production`. **Do not use it for preview.** Use the `dev` branch. Copy its **pooled** connection URL and its **unpooled (direct)** connection URL.
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
   - **Never run `vercel deploy --prod` on the preview project.** The other `--prod` commands in this file are for the demo project `chandra-psf`. Since T-28 a `main` push builds Production; this project has no Production variables, so such a build fails (no harm to data). Check Settings > Git in the dashboard.
   - **Warning: build rate limit.** On the free Vercel plan every pushed non-`main` branch starts a Preview build, so frequent `wip/*` checkpoint pushes can hit the daily build rate limit. The GitHub status then links to `upgradeToPro=build-rate-limit`. To save builds, open Settings → Git → Ignored Build Step and build only the branch you are testing, for example `[ "$VERCEL_GIT_COMMIT_REF" != "wip/T-23" ]`. The command exits 0 to skip a build, so every other branch is skipped. A skipped build also skips the migrations in the build command.
5. Open the new deployment in the Vercel dashboard and copy its **Preview deployment** `https://` address (not the project's production address). Set `APP_URL` to that address, then redeploy the preview.
6. On your laptop, run `pnpm admin init` with `DATABASE_URL_UNPOOLED` pointing at the **`dev`** direct URL. Never use the `production` URL for this command.
7. Send the team the preview URL only (just the address, for example `https://<name>.vercel.app`), through the Orchestrator conversation. Sign in on a Preview deployment's address for sign-in tests. The project's own address (for example `chandra-psf-preview.vercel.app`) serves a Production deployment; this project has no Production environment variables, so it fails with a server ZodError. The verify-preview step then checks the first admin sign-in and password, adds a branch and a support user, the sign-in timing (argon2), `noindex`, the security headers and the not-found page.

### Clear feedback for questionnaire v2 (CR-2, maintainer step)

Run this **once**, after the build with questionnaire v2 is live on the preview project. It is a maintainer step (it needs the Neon `dev` direct URL); the owner does not run it. It deletes all feedback data on the database that `DATABASE_URL_UNPOOLED` points at, and installs questionnaire v2.

```powershell
$env:DATABASE_URL_UNPOOLED = '<dev direct URL>'
pnpm admin clear-feedback --confirm-delete-all-feedback
Remove-Item Env:DATABASE_URL_UNPOOLED
```

- **Dev or preview only.** The command refuses when `VERCEL_ENV` or `NODE_ENV` is `production`, and refuses without `--confirm-delete-all-feedback`. The refusal depends on those settings only, not on which database is reached, so the URL must be the `dev` branch, never `production`.
- **Deletes:** every alert, answer (response), link and visit, the old v1 questionnaire and the rate-limit counters. Then it installs v2 and writes one audit entry (`system.cleanup`, "CR-2: feedback cleared, questionnaire v2 installed").
- **Keeps:** branches, advisors, users and their sessions, job cards, the audit log and the erasure journal.
- **Output:** `Cleared: <n> alert(s), <n> response(s) with answers, <n> link(s), <n> visit(s), <n> old questionnaire(s). Questionnaire v2 installed.`
- Running it again deletes the feedback made since the last run, so run it only once per cut-over.

## Demo (phase 1) — frozen

- Git tag `demo-v1` (annotated) and branch `demo`, both at commit `67ceeb1`, hold the exact code live on https://chandra-psf.vercel.app.
- The demo Vercel project `chandra-psf` is not connected to GitHub (checked 2026-11-22 and confirmed by the owner). It was deployed with the Vercel CLI, so pushes and merges to main never redeploy it.
- To redeploy the demo (only if ever needed): switch a checkout to the `demo` branch, link it to the `chandra-psf` project with the Vercel CLI, and run a production deploy. If the link step edits `.gitignore`, undo that edit.
- To take it offline at launch (D-25): Vercel dashboard → project `chandra-psf` → Settings → Advanced → Delete Project (or pause it).
- Phase-2 production is a separate Vercel project (preview in T-05b, production in T-28), never `chandra-psf`.

## Production (phase 2): step by step

Run the PowerShell commands in your project folder (your clone). Never paste a secret into chat, a commit or a file in the project. Keep values in your password manager.

**Neon branch name:** older docs call the production branch `main`. The real Neon production branch is named **`production`**. Use that name everywhere below.

### 0. Tools (once)
```powershell
corepack enable
pnpm install
```
You need Node.js 24 (`node -v` shows v24.x).

### 1. Neon production database
1. Neon console > your project > branch **`production`**. Create the project first if it does not exist.
2. Click Connect on the `production` branch. Copy the **pooled** URL (for `DATABASE_URL`) and the **direct (unpooled)** URL (for `DATABASE_URL_UNPOOLED`). Button names may differ; the Neon console is the reference.

### 2. Make two secrets (run twice, one value each)
```powershell
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```
Use one value for `CRON_SECRET` and a different one for `IP_HASH_PEPPER`.

### 3. Vercel Production variables
Vercel > project > Settings > Environment Variables. Add each one for **Production** only (names only; values from steps 1 and 2):

| Name | Value |
|---|---|
| `DATABASE_URL` | pooled production URL |
| `DATABASE_URL_UNPOOLED` | direct production URL (migrations use it) |
| `CRON_SECRET` | 32+ characters |
| `IP_HASH_PEPPER` | 32+ characters |
| `APP_URL` | `https://` address of the project, for example `https://<project>.vercel.app` |
| `NEXT_PUBLIC_DEALER_PHONE` | dealership phone number (the build fails without it) |

Recommended: `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_PRIVACY_PHONE`, `NEXT_PUBLIC_PRIVACY_EMAIL`. Optional: `NEXT_PUBLIC_POLL_SECONDS` (default 30).
- Placeholder values are flagged by the go-live check: run `pnpm golive:check` (see the Go-live gate section at the end of this file).
- `NEXT_PUBLIC_*` values and `APP_URL` are built into the app. After changing any of them, redeploy.
- Preview deployments run `db:migrate` too, so they need their own Neon branch (for example `dev`) with both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set. Leaving those keys unset makes the build fail.

### 4. Deploy
- Production deploys on every push to `main`. Before pushing, run `bash scripts/check.sh` (needs Git Bash).
- The build runs the migrations first (`pnpm db:migrate`), then `next build`. Migrations only move forward.
- Check: the address opens the sign-in page over `https://`, and `/robots.txt` shows `Disallow: /`.

### 5. Cron check (daily clean-up)
The cron runs at 21:30 UTC (03:00 IST) on `/api/cron/daily`. Expected result: HTTP 200 and an audit row `system.cleanup`.
- Vercel > project > Settings > Cron Jobs: find `/api/cron/daily` and click **Run**.
- Or in PowerShell (paste the `CRON_SECRET` value when asked):
```powershell
$env:CRON_SECRET = '<paste CRON_SECRET>'
curl.exe -i -H "Authorization: Bearer $env:CRON_SECRET" https://<your-app-address>/api/cron/daily
Remove-Item Env:CRON_SECRET
```
- Expect `HTTP/2 200`. Without the header the answer is 401.
- Sign in as the main admin > Audit > filter action `system.cleanup`. One row with actor "System" must exist.

### 6. First admin (once, on your PC)
Setting the variables here only lives in this PowerShell window. Set both to the **direct** production URL:
```powershell
$env:DATABASE_URL = '<direct production URL>'
$env:DATABASE_URL_UNPOOLED = '<direct production URL>'
pnpm admin init --name "Your Name" --email "you@your-dealer.example"
```
- It prints the email, a one-time password (16 characters) and "Valid until" (72 hours). Give the password to the admin through your password manager, never in chat.
- If it says "Users already exist; nothing changed", an admin already exists. Do nothing.
- After it runs, the database holds only question set v1 and one main admin.
- Open `https://<your-app-address>/sign-in`, sign in with the one-time password, and set a new password. Then add branches, advisors and users in the app (Branches > Advisors > Users).
- Close the PowerShell window, or run `Remove-Item Env:DATABASE_URL, Env:DATABASE_URL_UNPOOLED`.

### 7. Re-issue and recovery
Use the same two variables as step 6, and close the window afterwards.
- **Forgotten password (account works):** another main admin opens Users > Reset password. A main admin cannot reset their own password; they use Change password (in the app).
- **One-time password expired (after 72 hours) or never used:**
  ```powershell
  pnpm admin reissue --email "<email>"
  ```
  It prints a new one-time password. It only works for users who have not set a password yet, and it signs them out everywhere.
- **No main admin can sign in at all:**
  ```powershell
  pnpm admin recover --email "<email>" --no-admin-can-sign-in
  ```
  The flag is required; the command refuses without it. It refuses for a deactivated main admin (reactivating one is an owner decision). It prints a new one-time password and clears that email's sign-in lock. It is recorded in the audit log as "system".

### 8. Free to paid (before any real customer data)
This costs money and uses the owner's accounts. Nothing in the app changes.
1. Vercel: upgrade the account to **Pro** (Billing). Pro is needed for commercial use. Hobby is for non-commercial use only.
2. Neon: upgrade the project to a **paid** plan (Billing).
3. Neon: project settings > history retention (restore window) > set it to **7 days**. Free keeps a shorter window (about 6 hours), which is accepted only while no real customer data is held.
4. Before launch, rehearse one partial restore (section 9) on the paid plan. The full go-live checklist is in PRODUCTION.md ("Owner checklist: go-live gate").

### 9. Partial restore into a branch (damaged rows)
Use this for a few rows. Production is not overwritten.
1. Neon console > production branch > restore from a point in time, **as a new branch** (for example `restore-2026-11-25`). Choose a time just before the damage.
2. Copy the new branch's direct URL. Look at the rows in the Neon SQL editor on that branch and find the damaged ones.
3. Before copying a row back, check that its customer was not erased after the restore point (the table `erasure_journal` lists erased job cards). If it was, do not copy it back.
4. Copy the damaged rows back into `production`, by SQL that you have reviewed. If you are not sure, stop and ask the developer.
5. Check in the app that the data is right.
6. Delete the restore branch in Neon when done. It holds personal data.

### 10. Full rollback (owner's written go-ahead needed)
Use this only when the whole production database must go back to a point in time. This restores the database (data and its structure) to that time; it does not change the code. To roll back code, use Vercel > Deployments > Promote to Production on an earlier deployment.
1. Note the time point. Neon console > production branch > restore to that time point. Neon keeps the state from before the restore as a **backup branch**. Find it and copy its **direct** URL. If you cannot find it, stop.
2. Set both variables to the **restored production** direct URL, then re-apply the erasures. The source is the **backup branch**, which holds the newer erasure journal:
  ```powershell
  $env:DATABASE_URL = '<restored production direct URL>'
  $env:DATABASE_URL_UNPOOLED = '<restored production direct URL>'
  pnpm admin reapply-erasures --from '<backup branch direct URL>'
  ```
  Expect `Re-erased N job card(s).` N can be 0. Running it again changes nothing.
3. In the app, search Customers for an erased customer: the row shows "Erased customer".
4. When the owner confirms, delete the backup branch in Neon (it still holds personal data erased after the restore point).
5. Close the PowerShell window.

## Go-live gate (before the first real customer link)

Run the check against the production settings, in the same way as section 6 (set the values only in the PowerShell window, then close it). Owner steps are in PRODUCTION.md ("Owner checklist: go-live gate").

```powershell
pnpm golive:check
```

`scripts/golive-check.ts` fails when any of these is true, and prints the setting or table name with a count (never a value):
- `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_PRIVACY_PHONE`, `NEXT_PUBLIC_PRIVACY_EMAIL` or `NEXT_PUBLIC_DEALER_PHONE` is empty or still the placeholder.
- `APP_URL` is missing, is not `https://`, or is a local address.
- `DATABASE_URL` is the local pglite database.
- The production database holds rows in `job_cards`, `visits`, `link_tokens`, `responses` or `alerts` (customer data). Branches, advisors and staff users are allowed before launch (D-43).

The check does not cover the other SPEC §12.1 items (paid plans, restore rehearsal, legal check, demo offline, first admin). Those are in PRODUCTION.md. Branch rows are not counted by the check.

Note: section 6 and the production steps tell you to add branches, advisors and staff accounts in the app. The check allows them (D-43); it fails only when customer data exists.
