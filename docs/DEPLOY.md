# Deploying the preview to Vercel

The app is a Next.js 16 project. Vercel detects it automatically, so no `vercel.json` is needed.

**Live address:** https://chandra-psf.vercel.app
(Vercel project `abrahamlinksus-projects/chandra-psf`)

The site is hidden from search engines: every page has a `noindex` tag, and `/robots.txt` says `Disallow: /`. Any unknown address shows a plain "not found" page.

## Environment variables

Set these in the Vercel project (Settings > Environment Variables) for both **Production** and **Preview**. Never write the values into a tracked file, a commit or the chat. The keys are listed in `.env.example`.

| Name | What it is | Notes |
|---|---|---|
| `NEXT_PUBLIC_DEMO_PASSWORD` | The demo sign-in password | Shown on the sign-in screen by design, so it is stored as a plain (non-secret) variable. |
| `NEXT_PUBLIC_DEALER_PHONE` | Dealer phone number shown to customers | Currently a placeholder (`+91 44 0000 0000`). Replace it with the real number before sharing. |
| `NEXT_PUBLIC_APP_URL` | Public address of the app | **Optional, not set.** If it is missing, the app uses the address the browser is currently on, so links also work on preview deployments. Set it only to pin a fixed address (for example, a custom domain). |

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
