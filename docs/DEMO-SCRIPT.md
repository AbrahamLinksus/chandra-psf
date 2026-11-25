# Running a local demo alone

This runs the phase 2 app on your own computer with a local database (PGlite, stored in the `.pglite` folder). Nothing leaves your computer. It takes about 20 minutes. For the owner's check on the deployed site, see [OWNER.md](../OWNER.md).

## 0. Set up (first time only)

Follow [README.md](../README.md#how-to-run): `pnpm install`, `cp .env.example .env`, `pnpm db:migrate`, then:

```bash
pnpm admin init --name "Your Name" --email you@example.com
```

Copy the one-time password it prints. It is shown once and expires after 72 hours.

## 1. Start the app

```bash
pnpm dev
```

Open http://localhost:8000.

## 2. Sign in as the first admin

1. Sign in with your email and the one-time password.
2. Set your own password when asked.
3. The home screen shows **Add your first branch**.

## 3. Add a branch, an advisor and a support user

1. **Branches:** add a branch (any name and city).
2. **Advisors:** in that branch, add one advisor. Job cards need an advisor.
3. **Users:** add a support user for the branch. The app shows a temporary password for that user; note it.
4. Sign out.

## 4. Create a job card and a feedback link as support

1. Sign in as the support user with the temporary password. Set a new password when asked.
2. Open **New feedback link**. Type in a job card (customer, vehicle and service details). Use the vehicle model **Activa**, so the Overview has a model to filter on.
3. Generate the link and copy it.

Sending on WhatsApp opens WhatsApp with the message ready. The demo does not send anything by itself.

## 5. Open the link as the customer

A phone cannot reach `localhost` on your computer, so use a **private (incognito) window** on the same computer. Paste the link there.

On the support list, the link shows **Opened** once the page loads. Screens refresh on their own (about every 30 seconds, `NEXT_PUBLIC_POLL_SECONDS`), so you may need to wait a moment.

## 6. Fill in the form

In the private window: read the privacy notice, press **Start**, and answer the six steps (questionnaire v2). For the demo alert, do this:

1. Questionnaire step 1, **Overall service** (Q1): rate it **1**, then pick one concern.
2. Questionnaire step 6, **Callback** (Q10): answer **Yes**, then pick the slot **Evening**.

Submit. The thank-you page says our team will call the customer in the Evening slot.

The response raises an alert whose reasons include the callback (Evening 3 PM–6 PM) and the rating of 1.

## 7. Check the results

Keep the support list open in the first window:

- **Support list:** the link shows **Completed** (within about 30 seconds, without a reload).
- **Alerts** (admin): a new alert for the branch, status Open. Change it to Contacted, then Resolved.
- **Overview** (admin): walk through it in this order (Overview v2, D-47):
  1. **Tiles, read them in words:** Avg overall satisfaction (1.0 for the rating you gave), Recommend rate, Responses (1), Response rate, **Callbacks requested** (1), Open alerts (1). A change arrow appears only when the previous period has data.
  2. **Categories:** five rows (the five steps), each with a score out of 100. Click one, for example "Service Quality & Complaint Resolution", to expand it: the answer counts for each question, with its follow-up answers under it.
  3. **Advisors:** the table has a weighted advisor score. Q4 (advisor behaviour) counts most (30 of 100). An advisor needs at least 3 responses before a score shows, so with one response the score is "—". Say so to the audience; do not read it as 0.
  4. Try a filter (date range, branch or model **Activa**).
- **Responses** (admin): the response is listed. Open it to see the answers.
- **Audit** (admin): newest first. Look for the link, response, alert and user entries you made.

## Start again

Stop the server (Ctrl+C). Delete the `.pglite` folder, then repeat from `pnpm db:migrate` in step 0. This deletes everything in the local demo, so do it only on your own computer.
