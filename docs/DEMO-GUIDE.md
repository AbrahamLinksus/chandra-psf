# Presenter guide

Live demo: **https://chandra-psf.vercel.app** (public, sample data only).
Open it on your own phone for the customer part. Redeploy steps are in `docs/DEPLOY.md`.

## Before you start

1. Open the live link and press **Reset demo data** (small link under the sign-in form, then **Reset**). This gives every demo the same starting data, with dates counted back from today.
2. Use a normal browser window, not a private/incognito one. The two-tab demo needs both tabs to share one browser's storage.
3. Use the public link for anything the customer opens. Links made on `localhost` will not open on a phone.

## Demo logins

| Account | Email | Opens | Status |
|---|---|---|---|
| Support 1 | `support1@chandrahonda.demo` | `/support` (links) | Built |
| Support 2 | `support2@chandrahonda.demo` | `/support` (links) | Built |
| Admin | `admin@chandrahonda.demo` | `/admin` (overview, alerts, responses, audit, users) | Built |

- Password: the value of `NEXT_PUBLIC_DEMO_PASSWORD` in `.env.example`. It is also printed under the sign-in form.
- Quick buttons on the sign-in screen: **Sign in as Admin**, **Sign in as Support 1**, **Sign in as Support 2**. Email and password also work.
- **Sign out** is in the support top bar (and in the admin navigation).

## Fresh job cards to use

These job cards have no link yet, so **Generate link** is always available for them:

| Job card | Customer | Model |
|---|---|---|
| `JC-24-1042` | Ramesh Kumar | Activa 6G |
| `JC-24-1045` | Anil Menon | SP125 |
| `JC-24-1046` | Bharathi S | Unicorn |
| `JC-24-1047` | Chitra Devi | Activa 6G |
| `JC-24-1048` | Dhanush R | Dio |
| `JC-24-1049` | Elango K | Shine |
| `JC-24-1050` | Fathima B | SP125 |
| `JC-24-1051` | Gopal N | Unicorn |
| `JC-24-1052` | Hema Latha | Activa 6G |
| `JC-24-1053` | Imran Khan | Dio |

- The box on **New feedback link** shows "Try:" with the fresh job cards, newest service first.
- Each card you generate a link for is used up for the rest of the demo (until Reset).
- The grey placeholder text in the job card box says `JC-24-1042`. That is a real card, so it works. Do not expect any other number to work unless it is on this list or in the "Try:" hint.
- Numbers such as `jc241042` or `JC 24 1042` also find the card.

## Walk-through: support to customer (about 3 minutes)

1. Sign in as **Support 1**. The **My feedback links** list opens.
2. Press **New feedback link**. Type `JC-24-1049`, press **Look up**. The customer and vehicle details fill in.
3. Check the mobile number. If it is a landline, **Send on WhatsApp** is disabled and says so. Use **Copy link** instead, or enter a mobile number.
4. Press **Generate link**. Then **Send on WhatsApp** opens WhatsApp with the message and link, or **Copy link** copies it.
5. Open the link on a phone (or in a second tab). The personal welcome appears.
6. Go through the steps. Give a rating of 1 or 2 on a question to see its follow-up slide in. Answer **Yes** to the callback question to see "Our team will call you soon" on the thank-you page.
7. Back on the support list, the link shows **Opened**, then **Completed** after submit.

## Two-tab demo (live updates, no reload)

1. Tab A: sign in as **Support 1**, open **New feedback link**, look up `JC-24-1047`, press **Generate link**, press **Copy link**.
2. Tab B (new tab, same browser): paste the copied link and complete the form, then submit.
3. Switch back to tab A. The list shows **Completed** without a reload.
4. In tab A, create another link. Tab B's submitted response is still there. A save in one tab never removes what another tab saved.

## Admin walk-through (about 5 minutes)

Sign in as **Admin**. Every admin page is live; all data is the sample data after a reset.

1. **Overview:** five KPI tiles (Responses received, Response rate, Avg Q12, Recommend rate, Open alerts) and seven analytics blocks. Change the date range or a filter (model, advisor, vehicle type) and see every block move. The filters stay in the address bar.
2. **Alerts:** the badge on the Alerts tab shows the open count. Filter to **Open**, open an alert, set it to **Contacted** and add a note, then set it to **Resolved**. Each change is written to the audit log.
3. **Responses:** open the list and pick a response. Change one answer and save. The save asks for the admin password, which is the demo password above. If the answer was a rating of 1, the related alert is updated or resolved to match.
4. **Delete and restore:** delete a response (confirm, then the admin password). It moves to **Recently deleted**, and Overview's Responses received and Response rate both drop (D-17). Restore it from **Recently deleted** with the admin password; the numbers come back.
5. **Audit:** the log is newest first and shows the actions you just made (for example `response.delete`, `response.restore`, `alert.status`). Filter by action; long values have **Show more**.
6. **Users:** add a support user (name, email, temporary password). Deactivate and reactivate a user from the list. A new user is asked to set their own password at first sign-in.

## Cross-device limitation (say this out loud)

Each browser and device has its own copy of the data.

- A link made on the laptop and opened on a phone still shows the welcome page for that job card. The phone's answers stay on the phone.
- The laptop's list keeps showing **Created** for that link, because it never receives the phone's answers.
- To show the full cycle (Created, Opened, Completed) on one screen, open the link in the same browser.
- There is no backup. If the browser's data is cleared, everything made in it is lost and the sample data comes back.

## Simulate failed save

Two ways to arm it. Either way, the **next save in that tab** fails once; the next save then works.

- **Button:** sign in as **Admin**, press **Simulate failed save** in the sidebar (or under **More** on a phone). A message says "The next save will fail". Sign out, sign in as **Support 1**, and go to the steps below.
- **Address:** sign in as **Support 1** and open `/support/new?demoFail=1` (add `?demoFail=1` to the address). Reloading that address arms it again.

Then:

1. Look up `JC-24-1045` and press **Generate link**.
2. The screen shows **Couldn't save, try again** and keeps the job card number and mobile number you entered.
3. Press **Retry**. The link is created.

If you armed it from the admin side, the first save after the button is the one that fails. Do the support steps before any admin edit, or expect the admin save to fail first.

## Public link and the phone

- Customers only ever see `/f/<token>`. The address of the page they open is used in the WhatsApp message, so the link works on phones.
- The site asks search engines not to index it. Every name and number is made up.
- The dealership phone on the link-state pages is a placeholder (`+91 44 0000 0000`). Say so if asked. The real number is set in the hosting settings (see `docs/DEPLOY.md`).
