# Preview wire-up run (T-23): owner's runbook

This suite runs only against the deployed preview and the Neon `dev` database. You run it from your own terminal (PowerShell). The password is never written to a file, a command line or the shell history, and nobody else sees it.

What it proves:

- A support laptop makes a link; a 360 px phone opens it; the laptop shows Opened within 30 s, then Completed after submit, with no reload.
- A Q15 = Yes answer raises an alert for that branch: Velachery's admin sees it, Tambaram's does not.
- A laptop tab left idle for 15+ minutes makes no requests, and refreshes at once when you press a key.

## 1. Before you start

1. In the Vercel dashboard, open the preview project (not `chandra-psf`), go to Deployments, and open the preview build of branch `wip/T-23`. Copy its `https://...vercel.app` address. This is `PREVIEW_URL`.
2. The preview project's `APP_URL` must be that same address, or empty. If it points somewhere else, the generated links point there and the phone step opens the wrong site. The test records whether the generated link's origin matches `PREVIEW_URL`.
3. Vercel "Deployment Protection" must let the address be opened without a Vercel login, or the phone (an anonymous browser) is stopped at the Vercel login page.
4. The main admin must already have chosen their own password (the one-time password is replaced).
5. Open PowerShell in the T-23 worktree folder (`cd C:\Users\Jake\chandraProject-wt\T-23`) and run every command below from there. Its dependencies must be installed and the browser must be available (`pnpm exec playwright install chromium`).

## 2. Set the variables (this PowerShell session only)

Run this from the T-23 worktree folder, `C:\Users\Jake\chandraProject-wt\T-23`.

```powershell
$env:PREVIEW_URL = "https://<your-preview>.vercel.app"
$env:PREVIEW_ADMIN_EMAIL = "<main admin email>"
$secure = Read-Host -Prompt "Main admin password" -AsSecureString
$env:PREVIEW_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password
Remove-Variable secure
```

The password prompt hides what you type. Do not put the password on a command line.

## 3. Run

The loop and alert checks (about 3 minutes):

```powershell
pnpm exec playwright test -c tests/e2e/preview/playwright.preview.config.ts --grep-invert @idle
```

Then the idle check on its own (about 20 minutes; leave the window alone, do not use the keyboard in the browser it opens, and keep the computer awake):

```powershell
pnpm exec playwright test -c tests/e2e/preview/playwright.preview.config.ts --grep @idle
```

To see the tests without running them: add `--list`.

The preview enforces real limits (300 requests an hour per IP for anonymous users, 5 sign-in failures per email, 5 submits per link). A wrong `PREVIEW_ADMIN_PASSWORD` counts as a failure; do not retry more than twice.

## 4. Results

Everything lands in `.results/T-23/` (git-ignored):

- screenshots: `1-laptop-generated.png` to `7-tambaram-admin-alerts.png`, `idle-1-start.png`, `idle-2-after-15min.png`, `idle-3-returned.png`
- `loop-timings.json`: how long Opened and Completed took to appear, and the no-reload result
- `idle-requests.json`: every `/api/rpc` request the idle tab made, with time since load, and the quiet window (15 min + 10 s, for 60 s) which must be empty

No traces, videos or HAR files are recorded, because the sign-in requests carry passwords. Send the files in `.results/T-23/` back to the team. For the idle goal you may also compare with the Vercel logs (Logs, filter `/api/rpc`) or Neon's monitoring for the same time window.

## 5. Clean up

```powershell
Remove-Item Env:PREVIEW_ADMIN_PASSWORD
Remove-Item Env:PREVIEW_ADMIN_EMAIL
Remove-Item Env:PREVIEW_URL
```

## 6. What the run leaves behind

Every run adds throwaway data to the Neon `dev` database (never production): the branches "Velachery" and "Tambaram" (reused if they exist), an advisor, one support user and two branch admins (emails ending `@example.invalid`, random passwords nobody knows), one job card, one visit and one response with an alert. The idle run adds one support user and an advisor. Remove them from the admin console (Users) when you are done, or leave them on `dev`.

## 7. If the admin sign-in is locked or the password is lost

`scripts/admin.ts` needs both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set to the Neon `dev` direct (unpooled) connection URL, never production. Paste the URL at the hidden prompt, without quotes:

```powershell
$u = Read-Host -Prompt "Neon dev direct URL" -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new("", $u).Password
$env:DATABASE_URL_UNPOOLED = $env:DATABASE_URL
Remove-Variable u
```

Then one of:

```powershell
# the admin never set an own password (the one-time password expired or was lost)
pnpm admin reissue --email <main admin email>
# the admin set a password and it is lost or locked out
pnpm admin recover --email <main admin email> --no-admin-can-sign-in
```

`recover` gives the main admin a new one-time password, replaces the current password, ends their sessions and clears their failed sign-in count. `--no-admin-can-sign-in` is only your confirmation that no main admin can currently sign in; it does not lock anyone out. Either command prints the new one-time password: sign in on the preview, choose your own password, then repeat step 2. Finally:

```powershell
Remove-Item Env:DATABASE_URL
Remove-Item Env:DATABASE_URL_UNPOOLED
```
