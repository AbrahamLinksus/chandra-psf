# SPEC — Post-Service Feedback (PSF) System · Chandra Honda

> Written by the planner from the owner's answers, round by round. Approved before any design.
> Lines marked *(assumed)* were decided by the planner because the owner chose "decide for me" or has not answered yet; each can be overruled.
> Source: owner's input spec `docs/SPEC-input.md` (2026-11-21). Its IDs (Q1–Q15, Q1a…Q13a, AC-1…AC-11) are kept unchanged.
> **CR-1 (2026-11-22): production phase 2.** Owner: "production phase 2: server, database, real auth"; "i want to clear all existing data and start fresh, the real production thing". Answers: job cards typed in by support; keep click-to-send WhatsApp; several branches at launch; start completely empty with one admin created at setup. Each story in §3 has a **Change** column: Kept · Changed · New · Demo only.
> **CR-1 spec-2 (2026-11-22):** the owner's answers to the six open questions (cited **Q-1…Q-6**, not to be confused with the questionnaire codes Q1–Q15) and to the product-critic's gaps (cited **G-1…G-15**, `.results/CR-1/critique-product-critic.md`; scenarios S-16…S-30 in `docs/scenarios.md`) are folded in. Team-decidable gaps use the critic's option A. The decisions are summarised in "Resolved decisions" at the end.

## 0. Phases

- **Phase 1 — Demo (done, 2026-11-22):** a clickable UI of every screen on mock data, data kept only in the browser that made it, live at https://chandra-psf.vercel.app. Its behaviour is specified by the phase-1 version of this file (git history before CR-1).
- **Phase 2 — Production (this change):** the same screens and questionnaire, now backed by a **server and a shared database**, with **real sign-in** (passwords checked and stored only on the server, sessions that expire, role and branch checks on the server for every request), **several branches** whose data is kept apart, **job cards typed in by support**, and customer feedback links that work on any device. The system starts **completely empty**: no sample data, one admin account created at setup, who then adds branches, advisors and staff.
- **Free first, paid before real customers (Q-1):** production is built and tested on free plans (Vercel Hobby + Neon free) and moves to paid plans (Vercel Pro + Neon paid) as a **go-live gate** (§12.1) before any real customer's data enters it. The design must fit the free plans' limits, and the upgrade must need no code change. Until the gate passes, only staff-made test data is used.
- **Demo goes offline at launch (Q-6, G-10):** the phase-1 demo stays frozen at its current link until production launches, then that address is taken offline. Production lives at a **new `….vercel.app` address** with its own database (Q-5); it does not take over the demo address, so demo data left in staff browsers never meets production and nothing needs clearing. Nothing is copied from the demo (demo data only ever lived in individual browsers). Demo-only features do not exist in production (see §0.1). A custom domain can be added later without a code change (Q-5).
- **Design rule kept:** every screen still talks only to the data-access layer; phase 2 adds a server implementation of it. Questions, triggers (`show_if`), alert rules and metric formulas stay in shared config / pure functions and now also run on the server, which is the one that decides.

### 0.1 Demo-only features (not in production)
| Phase 1 feature | Production | Demo build (offline at launch, Q-6) |
|---|---|---|
| Seed data (30 xlsx responses, job cards, advisors, users) and seed dates moving with the load day (S-07) | Removed: production starts empty | Unchanged until taken offline |
| "Reset demo data" (US-22, F-8) | Removed | Unchanged until taken offline |
| "Simulate failed save" menu item / `?demoFail=1` | Removed: real failures show the same "Couldn't save, try again" (S-13) | Unchanged until taken offline |
| "Demo — sample data" label on staff screens | Removed | Unchanged until taken offline |
| Quick "Sign in as Admin / Support 1 / Support 2" picker and the public demo password hint | Removed: email + password only, no password shown anywhere | Unchanged until taken offline |
| Presenter hint listing fresh seeded job cards on `/support/new` | Removed (no seeded job cards) | Unchanged until taken offline |
| Link that carries the visit details inside it (D-11) | Removed: random-only link, stored only as a hash | Unchanged until taken offline |
| Live sync between tabs of one browser (S-06) | Replaced by shared data on every device (§4 Rules) | Unchanged until taken offline |
| Search engines asked not to index the site | Kept for staff and form pages *(assumed)* | Unchanged until taken offline |

## 1. Goal
Chandra Honda (two-wheeler dealership with several branches, scooters and motorcycles) replaces its paper/Excel post-service feedback questionnaire with a digital flow used with real customers. After a vehicle is serviced and delivered, a support staff member at a branch types in the job card (or finds one already entered), the system creates a single-use feedback link (valid 7 days) and opens WhatsApp with a prefilled message. The customer answers a short, friendly, mobile-first form (14 base questions + conditional follow-ups + a callback question) on any phone. Answers are stored on the dealership's server and visible only to admins: a branch admin sees their branch, a main admin sees every branch. Admins get an analytics dashboard, a callback/complaint alerts queue and an audit log of every change. Support staff never see answers or analytics, only link status. Customer personal data is handled under India's DPDP Act basics: notice, limited retention (3 years), access and erasure on request (answered by head office), backups.

## 2. Users
| User | What they want | How often |
|---|---|---|
| Customer (vehicle owner) | Answer quickly on their phone from a WhatsApp link, no login; know who gets the answers; ask for a call back if unhappy | Once per service visit (~2 min) |
| Support staff (several per branch) | Enter or find a job card, generate a link, send it on WhatsApp in one tap, see whether the customer opened/completed it | Many times a day, at the delivery desk, phone or laptop |
| Branch admin (one or more per branch) (Q-2) | Full admin for their own branch only: analytics, alerts, responses, audit, their branch's advisors and support users; customer privacy requests go to head office (G-4) | Daily on laptop, alerts on phone |
| Main admin ("all branches", head office, at least one; the first is created at setup) | Everything a branch admin can do, across every branch, plus manage branches and admin accounts, and answer customer privacy requests (G-4) | Daily / weekly |
| Maintainer (technical person who deploys; not an app role) | Create the first main admin at setup, run restores, recover access when no main admin can sign in | Rarely |

**Role rules:** Customer: open own link, submit once, nothing else. Support: belongs to exactly one branch; sign in; find or enter job cards **of their branch**; generate/regenerate/resend/cancel **any link of their branch** (links belong to the branch, not to the person who made them, G-8); see link status (Created / Opened / Completed / Expired / Cancelled); cannot see answers, ratings, comments or analytics. Branch admin (Q-2): every admin screen except Customers (privacy requests) and Branches, limited to their branch; adds and manages their branch's support users and advisors. Main admin: every admin screen for all branches (with a branch filter), plus Branches, admin accounts and Customers (privacy requests across all branches, G-4). Every rule is enforced **on the server**: a request outside your role or branch gets "Not allowed" (403) or "Not found" and no data. Any edit, delete or restore of feedback data and any customer-data erasure needs the admin to re-enter their password and is written to the audit log with old and new values.

## 3. User stories
| ID | As a… | I want to… | So that… | Acceptance (checkable) | Change |
|---|---|---|---|---|---|
| US-01 | Staff | sign in with my email and password and land on my portal | only staff get in, and a stolen or shared laptop doesn't stay signed in | Sign-in form only (no picker, no password hint); support → `/support`, admin → `/admin`; password checked on the server; wrong email or password → "Email or password is incorrect"; 5 wrong tries for one email within 15 min → "Too many attempts. Try again in 15 minutes." *(assumed)*, and an admin password reset clears that lock (G-13); a limit per network address also stops scripted guessing (G-13); session ends after **2 h** without activity for support and **12 h** for admins, and at most 7 days after sign-in (G-13), then the next action goes to sign-in; "Sign out" is visible in the support top bar and the admin menu and ends the session on the server (G-13); a support user calling any admin page or data request gets "Not allowed" / 403 and no data (AC-6) | Changed |
| US-02 | Support | enter a job card number and see its details if it was already entered at my branch | I don't retype data | Entering a job card number entered earlier at my branch shows name, phone, reg. no, model, vehicle type, service type, service date, advisor (AC-1); lookup ignores case, spaces and dashes (S-02); a number not found at my branch shows "No job card JC-… at this branch yet" with a "New job card" button that opens the form with the number filled in; a job card of another branch is never shown | Changed |
| US-03 | Support | generate a feedback link for that visit | the customer gets a personal form | "Generate link" shows a short `/f/<random code>` link that opens that customer's form on any phone (AC-2); the link contains no customer details and the server keeps only a scrambled (hashed) copy of it (D-11); status **Created**, expires 7 days later | Changed |
| US-04 | Support | send the link on WhatsApp in one tap, or copy it | sending is fast | "Send on WhatsApp" opens `wa.me/<phone>?text=…` with the template filled (name, model, reg. no, link) (AC-2); "Copy link" copies and shows "Copied"; Copy is offered only while the link is on screen right after Generate, Regenerate or Resend, because the server keeps only the hash (G-1); no mobile number → Send disabled, Copy still works (S-03) | Changed |
| US-05 | Support | see my branch's visits with their status only | I can chase unopened links | `/support` shows **My links** by default with an **All branch links** toggle (G-8): customer, reg. no, date, created by, coloured status badge; no ratings/answers anywhere; search by job card / reg. no; a customer opening or completing the form on their own phone shows as Opened / Completed on my screen within 30 s without reload while the tab is visible and I've used it in the last 15 min, and at once when I return to the tab (G-6); a user moved to another branch sees only the new branch's links (G-8) | Changed |
| US-06 | Support | regenerate, resend or cancel a link of my branch | a lost, expired or wrongly sent link can be replaced or withdrawn | Any support user of the branch can act on any of its links (G-8). "Regenerate" creates a new link with a new 7-day expiry; the old one shows the Expired page with "A newer link was sent to you on WhatsApp" (S-05). "Resend" issues a **fresh code for the same visit**, keeps the original expiry date, opens WhatsApp with the new link and offers Copy; the previous code shows "A newer link was sent to you on WhatsApp" (G-1). "Cancel link" (confirm) sets **Cancelled**, the link shows "Link not valid", the visit is left out of response rate; actions audited (S-14) | Changed |
| US-07 | Customer | open my link and see a personal welcome and who will see my answers | I trust it and know it's quick | Welcome shows "Hi {name}, how was your {model}'s service on {date}?", "Takes about 2 minutes" and the short privacy notice of §9 with a "How we use your answers" link to `/privacy`; opening the page in a browser sets **Opened** (AC-3); WhatsApp's link preview alone does **not** set Opened *(assumed)* | Changed |
| US-08 | Customer | answer one category per step with face ratings and big Yes/No chips | it's quick on a phone | 5 category steps + callback step, progress "Step 2 of 6"; faces 1–5 with label; Next disabled until the step is complete; Back keeps answers; works at 360 px (AC-11) | Kept |
| US-09 | Customer | get short follow-up questions only when something went wrong | I can explain without a long form | Every trigger in §4 F-3 shows/hides its follow-up with a slide animation (AC-4); hidden follow-up answers are discarded on submit (and again by the server); chips required, text optional | Kept |
| US-10 | Customer | ask for a call back and see a thank-you | I know someone will help | Q15 is always last; Thank-you shows a success animation, and "Our team will call you soon" when Q15 = Yes; status **Completed** (AC-3) | Kept |
| US-11 | Customer | not lose answers on refresh, and not submit twice | it's reliable | Refresh mid-form restores answers (this phone's browser storage, best effort); the server accepts only one submission per link, even if Submit is tapped twice or on two phones at once: another phone sees "Thank you — already submitted"; a retry of the same submission from the same phone (e.g. the reply was lost) is treated as success and shows the normal thank-you, with "Our team will call you soon" when Q15 = Yes (G-15); a link older than 7 days shows the Expired page (AC-5); the server checks every answer again (required, triggers, 1,000-char limit) | Changed |
| US-12 | Admin | get an alert for every unhappy customer or callback request | nobody is missed | On submit the **server** creates one alert when any of Q1/Q6/Q11/Q12 = 1 or Q15 = Yes, listing all reasons (e.g. "Callback requested · Q12 rated 1") (AC-7); Q3 = Yes alone creates none; the alert belongs to the visit's branch and shows on that branch admin's and the main admins' dashboards | Changed |
| US-13 | Admin | work the alerts queue | callbacks get done | `/admin/alerts` newest first, filter by status (and branch for main admins), rows coloured by status; Open → Contacted → Resolved with notes; nav badge shows my scope's open count; each change audited (AC-8); if another admin changed the same alert since I opened it, saving shows "Someone else changed this alert. Reload to see the latest." and nothing is lost *(assumed)* | Changed |
| US-14 | Admin | see KPI tiles with change vs previous period | I know how we're doing at a glance | Tiles: Responses received, Response rate, Avg Q12, Recommend rate, Open alerts, each with green/red arrow vs the previous same-length period; computed only from my branch scope | Kept |
| US-15 | Admin | see category scores, trend, advisor table, problem breakdown, question detail, recent comments | I know where to improve | All 7 blocks of §4 F-5 render (AC-10); advisor table sortable; problem breakdown has a follow-up selector; with no data yet (launch day) every block shows its "No responses for these filters" state (S-10) | Kept |
| US-16 | Admin | filter Overview and Responses by date range, branch, vehicle type, model, advisor | I can drill in and compare branches | Every filter changes every block and the responses table (AC-10); the **Branch** filter ("All branches" or one) is shown only to main admins; a branch admin's numbers are always their branch only; the advisor list follows the chosen branch | Changed |
| US-17 | Admin | browse all responses and open one | I can read the full feedback | `/admin/responses` (filterable, my scope) → detail with every answer incl. follow-ups, visit + vehicle info and branch; opening another branch's response URL as a branch admin shows "Not found" | Kept |
| US-18 | Admin | edit or delete a response after re-entering my password | data can be corrected safely | Edit/delete/restore asks for my password, checked on the server; wrong password → "Password incorrect", nothing saved; change logged with old and new values (AC-9); alert rules re-run after an edit (S-08) | Changed |
| US-19 | Admin | see the audit log | every change is traceable | `/admin/audit` lists time (IST), actor, branch, action, entity, old → new, newest first, filter by action; branch admins see their branch's entries, main admins all; no edit/delete controls; also records sign-ins, sign-in lockouts, password resets, job card creation/edits, link resends, branch/advisor/user changes (incl. role, branch, name and email edits), customer-data downloads and erasures, one-time password re-issues and maintainer recoveries (actor "system"), and automatic retention clean-ups | Changed |
| US-20 | Admin | add, edit, move and deactivate staff accounts | staff turnover, promotions and typos are handled | `/admin/users`: add a user (name, email, role, branch, temporary password); a branch admin adds only support users of their branch, a main admin adds any role for any branch (Q-2); **edit** (G-9): a main admin can change the name, email, role and branch of any user except themself, a branch admin the name and email of their branch's support users; a role or branch change ends that user's sessions; deactivate/reactivate; deactivating ends that user's sessions at once; a new user signing in with the temporary password must set their own before going further (S-15); duplicate email → "Email already in use"; nobody can deactivate or demote themself, or deactivate or demote the last active main admin; changes audited | Changed |
| US-21 | Admin | restore a response I deleted from a "Recently deleted" list | a mistaken delete can be undone | Deleting moves the response (with its alert) to `/admin/responses/deleted`; it leaves responses, analytics and alerts; "Restore" (password) brings back answers and alert with its previous status; items still there **30 days** after deletion are removed for good by the daily clean-up *(assumed)*, and the list shows "Removed for good on {date}" per row; all audited | Changed |
| US-22 | Owner / presenter | reset the demo to its original seed data | each demo starts clean | Not in production. Unchanged in the frozen demo build, which is taken offline at production launch (Q-6) | Demo only |
| US-23 | Main admin | have one admin account ready at setup and be guided to fill an empty system | we can start from nothing | The maintainer creates the first main admin (name, email, one-time password) during setup, not through any public page; setup refuses to run when any user already exists (G-14); the one-time password expires after **72 h**, and the maintainer can re-issue it, audited (G-14); first sign-in forces "Set your password"; with no branches yet, `/admin` shows "Add your first branch" and the empty states lead to Branches → Advisors → Users; no other data exists | New |
| US-24 | Main admin | add and rename branches, and close one | each branch's data is kept apart | `/admin/branches`: add (name, city), rename, deactivate/reactivate; a deactivated branch keeps its data and history but its support users can't sign in and no new job cards can be entered there; duplicate name → "A branch with this name already exists"; branches are never deleted; audited | New |
| US-25 | Admin | manage the service advisors of a branch | job cards and the advisor table use real names | On a branch's page: add advisor (name), rename, deactivate/reactivate; active advisors appear in the New job card form of that branch; deactivated advisors keep their past results in analytics; branch admins manage only their branch; audited | New |
| US-26 | Support | type in a new job card when it isn't in the system yet | I can send feedback links without a DMS | "New job card" form: job card no, customer name, mobile, reg. no, model, vehicle type, service type, service date, advisor (rules in F-2); saving shows the details card ready for "Generate link"; the same job card number can't be entered twice in one branch ("JC-… already exists at this branch" + "Open it"), but a retry of my own save with the same details (reply lost) shows the saved card (G-15); I can correct the details until the customer has completed the feedback, each correction audited with old and new values *(assumed)* | New |
| US-27 | Admin | reset a staff member's forgotten password | nobody is locked out for long | At launch the **only** password reset is by an admin (G-2; email reset links are Later, §11): "Reset password" on a user row → I type a temporary password → that user's sessions end, any sign-in lock on their email is cleared (G-13), and their next sign-in requires a new password of their own (S-15); a branch admin resets only their branch's support users; a main admin resets anyone except their own (they use "Change password"); audited, password never shown in the log | New |
| US-28 | Staff | change my own password | I can keep my account safe | "My account" → current password, new password, confirm; wrong current password → "Password incorrect"; new password ≥ 8 characters and not one of the most common passwords *(assumed)*; my other sessions end; audited | New |
| US-29 | Staff | see only my branch's data, or every branch if I'm a main admin | branches don't see each other's customers | Every staff screen and every server request is limited to the user's branch: support of Branch A can't find, list or act on Branch B's job cards or links; a branch admin can't see Branch B's responses, alerts, analytics, audit, deleted items or users (opening their URLs → "Not found"), and has no Customers screen ("Not allowed", G-4); a main admin sees all, with a Branch filter on lists and the Overview | New |
| US-30 | Main admin | find everything we hold about one customer across all branches, download it or erase it | we can answer a customer's privacy request completely | `/admin/customers` is **main-admin only** (G-4): search by mobile number or reg. no across **all branches** → one row per job card (branch, date, name, reg. no, link status, response yes/no), each with a **tick box**, none ticked at first *(assumed)* so family members sharing a phone aren't included by mistake; "Download" gives a readable file (spreadsheet/CSV) of the ticked rows with their links and responses; "Erase personal data" (confirm + password) removes for good, for the ticked rows only, the name, phone, reg. no and every free-text answer, keeping ratings and chip answers without identity for analytics; erased rows show "Erased customer"; download and erasure are audited without the personal values; each erasure also writes the erased job card ids (no personal data) to the host's logs, outside the database, so it can be re-applied after a restore (G-5) | New |
| US-31 | Owner | have personal data removed automatically when we no longer need it | we follow the retention promise in the privacy notice | A daily clean-up: links never answered lose the customer's personal data **90 days** after their service date; answered visits lose personal data **3 years** after the service date (Q-4), as in US-30 erasure; Recently deleted items older than 30 days are removed for good (US-21); expired sessions and sign-in attempts older than 24 h *(assumed)* are removed (G-11); each run writes one audit entry with counts (actor "system") | New |
| US-32 | Owner | have the data backed up and restorable | a mistake or outage doesn't lose our feedback history | The database has automatic backups; on the paid database plan they restore to any moment in the last **7 days** (Q-1; the free plan's shorter window is accepted only while there is no real customer data); restore steps in `docs/DEPLOY.md` follow the G-5 rule: restore into a **separate copy** and copy back only the damaged rows; a **full rollback** needs the owner's go-ahead and is followed by re-applying every erasure made after the restore point from the erasure list in the host's logs (US-30); a restore is rehearsed on the paid plan before launch (§12.1); the database structure is created and changed only by versioned migrations | New |

Counts: 32 stories; 31 in production (US-22 is demo only).

## 4. Main flows

### Rules for every flow
- **Branch scope (US-29):** every staff request is checked on the server against the signed-in user's role and branch. Support and branch admins only ever receive their branch's data; main admins receive all branches. Data outside scope is answered as "Not found" (detail pages) or "Not allowed" / 403 (admin areas for support; Customers for branch admins), never partially.
- **Shared data on every device (G-6):** all data lives on the server. Lists, badges, statuses and dashboards refresh every 30 s **only while the tab is visible and someone used it in the last 15 minutes**; otherwise they refresh once when the user returns to the tab. A screen left open overnight never wakes the database, so the free database plan can sleep when nobody works (and a paid plan isn't billed for idle screens). The first request after a quiet period may take a few seconds while the database wakes; screens show their normal loading state *(assumed)*.
- **Two people changing the same thing** *(assumed)*: alert status changes and response edits are refused if the item changed since the screen loaded ("Someone else changed this. Reload to see the latest."); notes are added, never overwritten.
- **Saving and failed saves (S-13):** every write shows a saving state; if it fails (server or network) the screen shows "Couldn't save, try again", keeps what the user entered and lets them retry. No simulated failure in production. A retry of a save that actually reached the server is treated as success (G-15).
- **Signed out while working:** if the session has ended, the next save shows "Your session has ended. Sign in again." and after signing in the user returns to the same page; unsaved typing on that page is kept where the screen already keeps drafts (customer form) *(assumed)*.
- **Audit:** every change listed in US-19 writes an append-only audit entry with actor, branch, time, old and new values; passwords and tokens are never written to the audit log or server logs.

### F-1 · Sign in and accounts (US-01, US-20, US-23, US-27, US-28)
1. Staff opens the app → sign-in screen: email + password, "Sign in". No picker, no password hint, no reset link (G-2).
2. Server checks the password; on success: `mustSetPassword` → "Set your password" (new + confirm) → then the role's landing page (support → `/support`, admin → `/admin`).
3. Session (G-13): ends after 2 h idle for support, 12 h idle for admins, or 7 days at most; "Sign out" (support top bar, admin menu) ends it on the server; deactivating a user, resetting their password, changing their role or branch (G-9) or the user changing their own password ends their other sessions.
4. "My account" (both portals): name, email, branch, role; "Change password" (US-28).
5. Forgotten password (G-2): the sign-in screen says "Forgot your password? Ask your admin to reset it." → admin uses "Reset password" (US-27). A main admin who forgets their password is reset by another main admin; only when **no** main admin can sign in does the maintainer recover access with a setup command, audited with actor "system" (G-14).
- Errors / edge cases: wrong email or password → "Email or password is incorrect" (same message for unknown email); deactivated user or deactivated branch → "Account disabled, contact admin"; 5 failures for an email within 15 minutes → "Too many attempts. Try again in 15 minutes." *(assumed)*, cleared early by an admin reset (G-13); a separate limit per network address catches scripts (G-13); one-time password older than 72 h → "This one-time password has expired. Ask for a new one." (G-14); support opening an admin URL → "Not allowed" page (D-15), and the server returns 403 for every response/analytics/admin request (AC-6).

### F-2 · Find or enter a job card, then create and send a link (US-02 – US-06, US-26)
1. Support taps "New feedback link" → `/support/new`.
2. Enters the job card number → if it exists at their branch, the details card shows it with the **status** of any current link (the link itself can't be shown again, G-1) and offers Resend / Regenerate; lookup ignores case, spaces and dashes (S-02).
3. Not found → "No job card JC-… at this branch yet" + "New job card" → form, number prefilled:
   | Field | Rule *(assumed unless stated)* |
   |---|---|
   | Job card no | required, 3–20 letters, digits, spaces or dashes; unique within the branch after ignoring case, spaces and dashes |
   | Customer name | required, up to 80 characters |
   | Mobile | optional; if given must be an Indian mobile (10 digits starting 6–9, with or without +91); without one, Send on WhatsApp is disabled and Copy link works (S-03) |
   | Reg. no | required, shown in capitals, 6–12 letters/digits after removing spaces and dashes |
   | Model | pick list of Honda two-wheeler models (Activa 6G, Activa 125, Dio, Dio 125, Shine, Shine 100, SP125, Unicorn, Hornet 2.0, CB350, Livo, Other) *(assumed; list kept in config)*; "Other" asks for the model name |
   | Vehicle type | filled from the model (scooter / motorcycle); asked only for "Other" |
   | Service type | pick: Free service · Paid service · Running repair · Accident repair · Other |
   | Service date | required, today or earlier, at most 60 days ago |
   | Advisor | pick from the branch's active advisors; required (no advisors yet → "Ask your admin to add advisors for this branch") |
4. The phone on the details card can still be edited before sending; the edited number is saved on the job card and audited (S-03).
5. "Generate link" → visit created, **Created**, expires in 7 days; short link shown with Send on WhatsApp and Copy link.
6. "Send on WhatsApp" → `wa.me/<phone>?text=<template>`; or "Copy link". Once the user leaves this screen the link can't be copied again; Resend gives a fresh one (G-1).
7. `/support` lists the visit (My links / All branch links, G-8); later Regenerate / Resend / Cancel link (US-06) by any support user of the branch.
- Errors / edge cases: a link already exists for this job card → show its status and offer Resend or Regenerate, not a duplicate; feedback already Completed → "Feedback already received", no new link, and job card details can no longer be edited; another branch's job card number → treated as not found at this branch (the same number may exist in two branches); saving a new job card whose reply was lost and retrying with the same details → the saved card, not "already exists" (G-15); a support user moved to another branch keeps no access to the old branch's links, which stay with that branch (G-8); WhatsApp not installed → `wa.me` opens WhatsApp Web.

### F-3 · Customer feedback form (US-07 – US-11)
1. Customer opens `/f/<code>` on any phone → the server finds the visit by the code's hash → Welcome with name, model, service date and the privacy notice (§9) → status **Opened** once the page shows in a real browser (link-preview robots don't count) *(assumed)*.
2. Steps (one category per screen, progress bar "Step n of 6"):
   1. Service Quality & Complaint Resolution: Q1–Q3
   2. Customer Interaction & Communication: Q4–Q6
   3. Timelines & Vehicle Delivery: Q7–Q9
   4. Pricing & Value for Money: Q10–Q11
   5. Overall Satisfaction & Loyalty: Q12–Q14
   6. Callback: Q15
3. Submit → server re-checks answers, stores them, runs alert rules → Thank-you (status **Completed**, visible to support on any device).
- **Text length (S-13):** Q14, Q2a, Q13a and every "Tell us more" box are limited to 1,000 characters with a visible counter (also enforced by the server); emoji and Tamil text accepted.
- **Abuse limits (G-7):** limits are **per link**: 30 opens and 5 submit attempts per link per hour; a generous per-network-address limit (300 requests per hour) only stops floods, so customers sharing the showroom Wi-Fi or a mobile carrier's address are never blocked (links are 32 random bytes, so guessing is already infeasible); an over-limit request sees "Too many requests, try again in a few minutes".
- Errors / edge cases: unknown or cancelled code → "Link not valid"; expired (> 7 days) → Expired page; replaced by Regenerate or Resend → Expired page with "A newer link was sent to you on WhatsApp" (S-05, G-1); already completed from another phone → "Thank you — already submitted"; retry from the same phone after a lost reply → normal thank-you (G-15); refresh → answers restored from this phone's storage; the job card's personal data erased (US-30/31) → "Link not valid"; deactivated branch → link still works until it expires *(assumed)*; changing a parent answer so a trigger no longer matches → follow-up hides and its answer is discarded.

**Base questions** (all ratings 1–5; base questions always shown):
| Code | Category | Question | Type | Required |
|---|---|---|---|---|
| Q1 | Service Quality & Complaint Resolution | Are you satisfied with the quality of work carried out on your vehicle? | rating_5 | Yes |
| Q2 | Service Quality & Complaint Resolution | Were all the complaints reported by you rectified? | yes_partial_no | Yes |
| Q3 | Service Quality & Complaint Resolution | Did you face any issues after taking delivery of your vehicle? | yes_no | Yes |
| Q4 | Customer Interaction & Communication | Did the Service Advisor explain the work completed on your vehicle? | yes_no | Yes |
| Q5 | Customer Interaction & Communication | Were you informed about the next service due date? | yes_no | Yes |
| Q6 | Customer Interaction & Communication | Were you satisfied with the behaviour of the Service Advisor? | rating_5 | Yes |
| Q7 | Timelines & Vehicle Delivery | Was your vehicle delivered on the promised time? | yes_no | Yes |
| Q8 | Timelines & Vehicle Delivery | Was the vehicle properly washed and cleaned? | yes_no | Yes |
| Q9 | Timelines & Vehicle Delivery | Was the vehicle delivered in good condition? | yes_no | Yes |
| Q10 | Pricing & Value for Money | Were the service charges explained clearly? | yes_no | Yes |
| Q11 | Pricing & Value for Money | Were the service charges affordable? | rating_5 (changed from 1–10) | Yes |
| Q12 | Overall Satisfaction & Loyalty | Were you satisfied with the overall service experience? | rating_5 | Yes |
| Q13 | Overall Satisfaction & Loyalty | Would you recommend Chandra Honda to your friends and family? | yes_no | Yes |
| Q14 | Overall Satisfaction & Loyalty | Do you have any additional feedback or suggestions? | text | No |
| Q15 | Overall Satisfaction & Loyalty | Would you like someone from our service team to call you? | yes_no | Yes (always last) |

**Conditional follow-ups** (broad category chips + optional "Tell us more" text; chips required when shown):
| Code | Parent | Trigger | Question | Type | Options |
|---|---|---|---|---|---|
| Q1a | Q1 | ≤ 3 | What was wrong with the work? | multi_select + text | Problem not fixed · Same problem came back · New problem appeared · Other |
| Q2a | Q2 | Partially / No | Which complaint wasn't fixed? | text | — |
| Q3a | Q3 | Yes | What issue did you face? | multi_select + text | Engine · Brakes · Electrical · Body & paint · Other |
| Q6a | Q6 | ≤ 3 | What was the problem with the advisor? | multi_select + text | Rude · Not attentive · Didn't answer queries · Other |
| Q7a | Q7 | No | How late was the delivery? | single_select | Same day · 1 day late · 2+ days late |
| Q9a | Q9 | No | What was the problem? | multi_select + text | Scratch or dent · Missing item · Dirty · Other |
| Q11a | Q11 | ≤ 3 | What felt expensive? | multi_select + text | Labour · Parts · Extra work not agreed · Other |
| Q13a | Q13 | No | What's the main reason? | text | — |

- Q2a and Q13a are text-only: their text is required when shown *(assumed — otherwise the follow-up has no required part)*.
- Triggers live in question config (`show_if`, e.g. `{"op":"lte","value":3}`, `{"op":"in","value":["Partially","No"]}`), not in screen code. Question set version 1 is installed with the app at setup (it is configuration, not sample data).

**Form UX (owner §6.3):** Welcome → 5 category steps → Callback → Thank you; faces for ratings (very unhappy → very happy) with label under the selected one; Yes/No as large chips; follow-ups slide open under their parent; Next enabled only when the step is complete; Back keeps answers; tap targets ≥ 48 px; sticky thumb-reachable Next on mobile; success animation; works at 360 px; centred card (max ~560 px) on laptop; vehicle and customer name shown throughout.

### F-4 · Alerts (US-12, US-13)
1. On submit the server creates an alert when any rating (Q1, Q6, Q11, Q12) = 1, or Q15 = Yes. One alert per response, all matching reasons listed. Q3 = Yes alone raises none. The alert belongs to the visit's branch.
2. Admin sees the open-count badge (their scope) → `/admin/alerts` (newest first, filter by status; main admins also by branch, rows show the branch).
3. Admin opens an alert (customer, phone, vehicle, branch, reasons, link to the response) → Contacted / Resolved, adds notes. Each status change and note is audited.
4. **After an admin edit (S-08):** alert rules re-run on the edited answers: reasons updated; a newly due alert is created (Open); if no reason remains the alert is **Resolved** with the note "Auto-resolved: no alert reason after edit". Each change audited.
- Errors / edge cases: no alerts → "No alerts — all customers happy"; Resolved can be reopened to Open; concurrent change → "Someone else changed this alert. Reload to see the latest." *(assumed)*; alerts of an erased customer stay with "Erased customer" in place of name and phone.

### F-5 · Analytics (US-14 – US-16)
Filter bar (Overview and Responses): date range · **branch (main admins only)** · vehicle type · model · advisor. Single column on mobile, 2–3 column grid on laptop. Branch admins' numbers are always their branch; main admins default to "All branches".

| # | Block | Shows | Chart |
|---|---|---|---|
| 1 | KPI tiles | Responses received · Response rate · Avg overall satisfaction (Q12) · Recommend rate (Q13 % Yes) · Open alerts — each with change vs previous period | Number tiles |
| 2 | Category scores | Score /100 for each of the 5 categories | Horizontal bar |
| 3 | Trend | Avg Q12 and recommend rate per week/month | Line |
| 4 | Advisor performance | Per advisor: responses, avg Q6, % Q4 Yes, % Q7 Yes, avg Q12 (main admins on "All branches": advisor name with branch) | Sortable table |
| 5 | Problem breakdown | Counts per follow-up category (Q1a, Q3a, Q6a, Q9a, Q11a; Q7a lateness split) | Bar, with follow-up selector |
| 6 | Question-level detail | Yes/No (Yes/Partially/No) split for Q2–Q5, Q7–Q10, Q13, Q15 | Small stacked bars |
| 7 | Recent comments | Latest Q14 + follow-up text, with Q12 rating beside each | List |

**Metric definitions (owner §10, exact):**
- **Filter date (S-11):** the visit's **service date** drives every block, the KPI tiles, the trend and the Responses table.
- Response rate = completed visits ÷ visits whose service date is in the period (expired counted as not responded). A response in Recently deleted does not count as completed, so deleting a response lowers the rate and restoring raises it back (S-09, D-17); a Cancelled or replaced visit is left out of both numbers (S-14). A Resend (G-1) keeps the same visit, so it doesn't change either number.
- Rating → score: `(rating − 1) ÷ 4 × 100`.
- Yes/No → score: Yes = 100, No = 0. Q3 is reversed (No issues = 100). Q2: Yes = 100, Partially = 50, No = 0.
- Category score = mean of its question scores (Q14, Q15 excluded).
- Recommend rate = % of Q13 = Yes.
- "Change vs previous period" compares with the same-length period immediately before.
- Default date range: last 30 days; trend weekly for ranges ≤ 90 days, monthly beyond.
- "Open alerts" tile counts Open alerts in the user's scope (and chosen branch) regardless of date filter.
- **No data (S-10):** a block or tile with no matching responses shows "—" and "No responses for these filters" (never 0 %, NaN or ∞); the change arrow is hidden when the previous period has no data. This is the normal launch-day state.
- Anonymised (erased or retention-cleaned) responses still count in every number; their comments are gone, so they drop out of Recent comments.

### F-6 · Responses, edits and audit (US-17 – US-19, US-21)
1. Admin opens `/admin/responses` (filters as F-5) → row → detail.
2. "Edit" → change answers → "Save" → password prompt (checked on the server) → saved; audit entry with old and new values; alert rules re-run (F-4 step 4).
3. "Delete" → confirm + password → moved to **Recently deleted** (`/admin/responses/deleted`: customer, branch, date, deleted at, "Removed for good on {deleted at + 30 days}", Restore); audit `response.delete` with old value.
4. "Restore" → password → response, answers and alert (previous status) back everywhere; audit `response.restore`.
5. `/admin/audit` shows the user's scope, append-only.
- Errors / edge cases: wrong password → "Password incorrect", nothing saved; 5 wrong step-up passwords in 15 min sign the admin out *(assumed)*; edits follow the same follow-up rules as the form; a deleted response's visit stays **Completed** for support; empty list → "Nothing deleted"; edits have no one-click undo, old values stay in the audit log.

### F-7 · Manage staff users (US-20, US-27)
1. Admin opens `/admin/users` → list (name, email, role, branch, active, last sign-in, created); main admins can filter by branch.
2. "Add user" → name, email, role (branch admins: Support only), branch (branch admins: their own, fixed), temporary password → appears in list; the admin passes the temporary password to the person outside the app.
3. "Edit" (G-9) → main admins: name, email, role, branch of any user except themself; branch admins: name and email of their support users; a role or branch change ends that user's sessions. Deactivate / reactivate; Reset password (US-27). All audited.
4. A support user moved to another branch: their links stay with the old branch, where any support user there can act on them (G-8).
- Errors / edge cases: duplicate email → "Email already in use"; can't deactivate or demote yourself, or deactivate or demote the last active main admin; temporary password shorter than 8 characters → rejected.

### F-8 · Reset demo data (US-22) — demo build only
Unchanged in the frozen demo until it is taken offline at launch (Q-6); not present in production.

### F-9 · Setup and branches (US-23 – US-25)
1. Setup (maintainer): production database created, migrations applied, question set v1 installed, first main admin created with a one-time password valid 72 h (G-14). Setup refuses to create an admin when any user exists (G-14). Nothing else.
2. Main admin signs in → sets own password → `/admin` empty state "Add your first branch" → `/admin/branches` → "Add branch" (name, city).
3. Opens a branch → "Advisors" list → "Add advisor" (name).
4. `/admin/users` → adds branch admins and support users for that branch.
5. Support signs in → `/support` empty state "No feedback links yet. Tap New feedback link to start." → F-2.
- Errors / edge cases: Add user with no branches yet → "Add a branch first"; New job card with no advisors → message in F-2; one-time password expired → maintainer re-issues it (audited, actor "system").

### F-10 · Customer privacy requests and retention (US-30, US-31)
1. A customer asks (phone/visit, at any branch) to see or delete their data → the request goes to head office; a **main admin** opens `/admin/customers` and searches by mobile or reg. no (G-4).
2. Result lists every matching job card **across all branches**, one row each with a tick box (branch, date, name, reg. no, link status, response yes/no). The admin ticks the rows that belong to this customer (a family sharing one mobile shows several names).
3. "Download" → file with the ticked rows, their links and responses; audited (`customer.export`).
4. "Erase personal data" → confirm ("This can't be undone", with the number of ticked rows) + password → for the ticked rows: name, phone, reg. no and all free-text answers removed for good, including from Recently deleted and from audit old/new values (replaced by "[erased]"); ratings and chips kept anonymously; open links of those job cards stop working; audited (`customer.erase`, no personal values); the erased job card ids are written to the host's logs (G-5).
5. Daily clean-up (US-31) applies the same erasure automatically by age (unanswered 90 days, answered 3 years); one audit entry per run with counts.
- Errors / edge cases: no match → "No customer found with that number"; no row ticked → Download and Erase disabled; branch admin opens `/admin/customers` → "Not allowed"; backups still hold erased data until they age out (7 days on the paid plan) *(assumed)*, which the privacy notice states; after a full rollback the maintainer re-applies the logged erasures (US-32, G-5).

## 5. Inputs and outputs (concrete examples)
Examples use fictional people and branches *(assumed: "Velachery" and "Tambaram" as example branch names)*.
| Flow | Example input | Expected output |
|---|---|---|
| F-9 | Fresh production, main admin `owner@chandrahonda.in` signs in with the one-time password | "Set your password" → `/admin` shows "Add your first branch"; Overview tiles all "—" |
| F-9 | Main admin first signs in 80 h after setup | "This one-time password has expired. Ask for a new one."; maintainer re-issues it; audit shows actor "system" |
| F-9 | Maintainer runs setup again after the main admin exists | Setup stops: "Users already exist; nothing changed" |
| F-9 | Add branch "Velachery", city "Chennai"; add advisor "Suresh" | Branch listed; Suresh appears in Velachery's New job card advisor list |
| F-1 | Support `priya@chandrahonda.in` (Velachery) signs in | Lands on `/support` "My links", empty state |
| F-1 | 6th wrong password for one email within 15 min | "Too many attempts. Try again in 15 minutes." |
| F-1 | Someone locks `owner@chandrahonda.in` on purpose; a second main admin resets the owner's password | Lock cleared; owner signs in with the temporary password → "Set your password" |
| F-1 | Admin signed in at 09:00, no activity until 21:30 | Next action → sign-in screen, "Your session has ended. Sign in again." |
| F-1 | Support Priya leaves the shared desk laptop at 14:00; next person uses it at 16:15 | Sign-in screen; nothing is done as Priya |
| F-2 | Job card `JC-24-1042` at Velachery, not entered yet | "No job card JC-24-1042 at this branch yet" + New job card |
| F-2 | Form: Ramesh Kumar · 98400 12345 · tn09bx4521 · Activa 6G · Paid service · 14 Nov 2026 · Suresh | Saved; details card: Ramesh Kumar · +91 98400 12345 · TN 09 BX 4521 · Activa 6G · Scooter · Paid service · 14 Nov 2026 · Advisor: Suresh |
| F-2 | Same number ` jc241042` entered again at Velachery | Finds the existing job card (S-02); "New job card" for it says "JC-24-1042 already exists at this branch" |
| F-2 | Support of Tambaram looks up `JC-24-1042` | "No job card JC-24-1042 at this branch yet" (Velachery's is invisible) |
| F-2 | Service date 25 Nov 2026 entered on 22 Nov 2026 | "Service date can't be in the future" |
| F-2 | Generate + Send on WhatsApp | Opens `https://wa.me/919840012345?text=Hi%20Ramesh%20Kumar%2C%20thank%20you%20for%20servicing%20your%20Activa%206G%20(TN%2009%20BX%204521)%20at%20Chandra%20Honda.%20Please%20share%20your%20feedback%20(2%20mins)%3A%20https%3A%2F%2F<domain>%2Ff%2F<code>` where `<code>` is ~43 random characters with no customer data |
| F-2 | Link generated 15 Nov 2026 (expires 22 Nov); support taps Resend on 18 Nov | New code; WhatsApp opens with the new link; it still expires 22 Nov; the 15 Nov link shows "A newer link was sent to you on WhatsApp" (G-1) |
| F-2 | Support Arun (Velachery) opens `/support`, toggles All branch links, taps Resend on a link Priya made | WhatsApp opens with a fresh link; audit shows Arun as actor (G-8) |
| F-3 | Customer opens the link on their phone; support's laptop shows `/support` | Laptop shows **Opened** within 30 s; after submit, **Completed** |
| F-3 | Staff laptop left on `/support` from 19:00 to 09:00 the next day | No refreshes overnight; on first use at 09:00 the list refreshes at once (G-6) |
| F-3 | 45 customers submit from the showroom Wi-Fi within one hour | All 45 accepted (G-7) |
| F-3 | Q1 = 2 | Q1a slides open: chips Problem not fixed · Same problem came back · New problem appeared · Other + "Tell us more" |
| F-3 | Q7 = No, then changed to Yes | Q7a appears, then hides; its answer is not saved |
| F-3 | Q12 = 1, Q15 = Yes, submit | Thank-you with "Our team will call you soon"; one alert "Callback requested · Q12 rated 1" for Velachery |
| F-3 | Submit tapped on two phones with the same link | One response stored; the other phone shows "Thank you — already submitted" |
| F-3 | Submit with Q15 = Yes reaches the server but the reply is lost; the customer taps Submit again on the same phone | Thank-you with "Our team will call you soon"; still one response (G-15) |
| F-3 | Opening a link created 8 days ago | Expired page: "This feedback link has expired. Please contact Chandra Honda." |
| F-4 | Alert for Priya S. → Contacted, note "Called, bike rechecked 22 Nov" | Row turns amber; audit: `admin · alert.status · open → contacted` + note |
| F-5 | Q1 ratings 4, 5, 3 | Scores 75, 100, 50 |
| F-5 | Q2 answers Yes, Partially, No | Scores 100, 50, 0 |
| F-5 | Velachery 40 visits, 30 completed; Tambaram 10 visits, 5 completed | Velachery admin: response rate 75%; main admin "All branches": 70%; main admin "Tambaram": 50% |
| F-6 | Change Q6 from 2 → 4, password correct | Q6a removed; audit `response.edit` old `{Q6:2,Q6a:{options:["Rude"]}}` new `{Q6:4}` (D-16) |
| F-6 | Edit Q12 1 → 4 on a response whose only alert reason was "Q12 rated 1" | Alert Resolved; audit `response.edit` and `alert.status · open → resolved` "Auto-resolved: no alert reason after edit" (S-08) |
| F-6 | Delete a response on 1 Dec 2026 | In Recently deleted with "Removed for good on 31 Dec 2026"; on 31 Dec it is gone and the audit shows a system clean-up entry |
| F-7 | Velachery admin adds `arun@chandrahonda.in`, role Support | Role picker offers only Support, branch fixed to Velachery |
| F-7 | Main admin corrects `arun@chandrahonda.in` to `arun.k@chandrahonda.in` and promotes him to Branch admin | Saved; Arun's open sessions end; audit shows old → new email and role (G-9) |
| F-7 | Admin resets Priya's password while she is signed in on a phone | Her phone's next action → sign-in; she signs in with the temporary password → "Set your password" |
| F-10 | Main admin searches mobile `98400 12345` | Two rows: Ramesh Kumar (Velachery, 14 Nov 2026) and Lakshmi Kumar (Tambaram, 2 Dec 2026), none ticked |
| F-10 | Ticks only Ramesh's row → Erase personal data, password correct | Ramesh's job card shows "Erased customer", reg. no and phone gone, Q14 text gone; Lakshmi's row untouched; Overview counts unchanged; audit `customer.erase` without the number |
| F-10 | Velachery branch admin opens `/admin/customers` | "Not allowed" |
| F-10 | Visit served 14 Nov 2026, never answered | On 12 Feb 2027 its name, phone and reg. no are erased by the daily clean-up |
| F-10 | Visit served 14 Nov 2026, answered | On 14 Nov 2029 its personal data is erased by the daily clean-up |
| — | Branch admin of Tambaram opens `/admin/responses/<Velachery response id>` | "Not found"; no data sent |
| — | Support session calls an analytics request directly | 403, no data (AC-6) |

## 6. Data
- **Entities:** branches (name, city, active); advisors (branch, name, active); users (name, email, password hash, role support / branch_admin / main_admin, branch — empty for main admins, active, must-set-password, one-time password expires at, last sign-in); sessions (user, created, last active, ends); sign-in attempts (for rate limits); job_cards (branch, job card no unique per branch, customer name, phone, reg. no, model, vehicle type, service type, service date, advisor, created by, personal-data-erased at) — replaces `mock_dms`; vehicles are not a separate entity *(assumed: reg. no and model live on the job card)*; service_visits (job card, current link hash, status created/opened/completed/expired/cancelled, expires at, created by, replaced by, opened/completed/cancelled at; a Resend replaces the link hash and keeps the visit, G-1; visits belong to the branch, G-8); questions (versioned, `show_if`, parent); responses (one per visit, questions version, submitted at, deleted at); answers (value_num / value_text / value_options by type); alerts (reasons, status, notes, updated by); audit_log (append-only, actor, branch, old/new values). Owner's §8 model is the starting point; the architect finalises it.
- **Answer storage by type:** ratings → number; yes/no, yes/partial/no, single_select → text; multi_select → options list (+ text for "Tell us more"); text → text.
- **Questions are versioned:** editing wording creates a new version; old answers keep pointing at the old version (question editing UI itself is Later).
- **Start data (owner, CR-1):** completely empty. Setup installs only the question set v1 and one main admin. No seed script runs against production; nothing is imported from the demo.
- **Volume** *(assumed)*: up to 10 branches, ~50 staff accounts, up to 3,000 visits/month across branches (≈ 36,000/year, ≈ 400,000 answers/year; ≈ 1.2 million answers over the 3-year retention).
- **Retention (Q-4):** personal data (name, phone, reg. no, free text) of answered visits kept **3 years** from service date, unanswered visits 90 days, then erased automatically; anonymous ratings kept for analytics; Recently deleted kept 30 days; expired sessions and sign-in attempts older than 24 h removed daily (G-11); audit entries kept as long as the system runs, with personal values erased alongside the customer's.
- **Time:** store UTC, display IST.
- **Where data lives:** one production database in the region closest to India offered by the provider *(assumed)*; the hosting and database providers may store data outside India, which the notice says (G-12); the demo has no database.

## 7. Screens (UI projects)
| Screen | Purpose | Key elements | Wireframe |
|---|---|---|---|
| sign-in | Staff login | Email + password, "Forgot your password? Ask your admin to reset it.", error / lockout / session-ended / one-time-password-expired messages. **Removed:** picker, password hint, Reset demo data | docs/wireframes/sign-in.html (update) |
| set-password | First sign-in or after reset | New password, confirm, Save | (in sign-in) |
| my-account | Own details + change password | Name, email, role, branch; current / new / confirm password | docs/wireframes/my-account.html (new) |
| support-list `/support` | Branch links + status | "New feedback link", **My links / All branch links** toggle, search, rows with status badge and created-by, Resend / Regenerate / Cancel; empty state; refresh while in use (G-6); Sign out in top bar | docs/wireframes/support-list.html (update) |
| support-new `/support/new` | Find or enter job card + generate + send | Job card input; found card (editable phone, current link status, Resend / Regenerate) or "No job card … at this branch yet" + **New job card form** (F-2 fields); Generate link, link box, Send on WhatsApp, Copy link. **Removed:** fresh job card hint | docs/wireframes/support-new.html (update) |
| form-welcome `/f/[code]` | Personal welcome | Greeting, "Takes about 2 minutes", **privacy notice + "How we use your answers"**, Start | docs/wireframes/form-welcome.html (update) |
| privacy `/privacy` | Full privacy notice | Who is responsible (company name), what, why, how long (3 years), where stored (providers, possibly outside India), rights, how to ask (head-office phone/email) | docs/wireframes/privacy.html (new) |
| form-step, form-callback, form-thank-you, form-states | As phase 1 | + "Too many requests" state | (unchanged) |
| admin-overview `/admin` | Analytics | Filter bar **with Branch (main admins)**, KPI tiles, 7 blocks, empty states; **first-run "Add your first branch"** | docs/wireframes/admin-overview.html (update) |
| admin-alerts, admin-responses, admin-response-detail, admin-deleted, admin-audit | As phase 1, scoped | + branch column/filter for main admins; deleted rows show "Removed for good on"; audit shows branch | (minor updates) |
| admin-users `/admin/users` | Staff accounts | List with role, branch, last sign-in; Add user (role, branch), **Edit** (name, email, role, branch), Deactivate / Reactivate, Reset password | docs/wireframes/admin-users.html (update) |
| admin-branches `/admin/branches` | Branches (main admins) | List (name, city, active, staff count), Add / Rename / Deactivate | docs/wireframes/admin-branches.html (new) |
| admin-branch `/admin/branches/[id]` | One branch + its advisors | Branch details; Advisors list: Add / Rename / Deactivate (branch admins see only their branch at `/admin/advisors`) | docs/wireframes/admin-branch.html (new) |
| admin-customers `/admin/customers` | Privacy requests (**main admins only**) | Search by mobile / reg. no across all branches, result rows with tick boxes (branch, date, name, reg. no, link status, response), Download, Erase personal data (confirm + password) for ticked rows | docs/wireframes/admin-customers.html (new) |
| not-allowed | Role guard | "You don't have access to this page", link back | (unchanged) |
| reset-dialog | — | **Removed from production** (demo only) | — |

**Every screen that saves** shows a saving state and "Couldn't save, try again" with input kept (S-13). **No "Demo — sample data" label** in production.

**Navigation:** admin mobile = bottom tab bar (Overview · Alerts · Responses · More → Recently deleted, Audit, Customers (main admins), Users, Branches (main admins) / Advisors (branch admins), My account, Sign out); admin laptop = left sidebar with alerts badge (same items). Support = top bar with My account and Sign out. **Removed:** Simulate failed save, Reset demo data.

**Visual system (owner §12):** unchanged from phase 1 (neutral base + dealership red accent, status colours, one sans-serif, rounded cards, lucide icons, shadcn/ui only, light mode with dark-ready tokens). Every screen checked at 360 px and 1440 px.

## 8. Integrations
- **WhatsApp:** `wa.me` click-to-send link only (owner, CR-1); no WhatsApp Business API, no account.
- **Job cards:** typed in by support (owner, CR-1); no DMS connection, no file upload.
- **Database:** managed Postgres (Neon, owner's stack) — production only. **Free plan first, paid plan at the go-live gate** (Q-1); the app must work within the free plan (the database may sleep when idle, G-6) and move to the paid plan with no code change.
- **Hosting:** Vercel, a new production project at a **new `….vercel.app` address** (Q-5, G-10); **Hobby (free) plan first, Pro at the go-live gate** (Q-1; the free plan is for non-commercial use, so real customers wait for Pro). Scheduled daily clean-up run by the host's scheduler, once a day (fits the free plan) *(assumed)*. A custom domain can be added later without a code change; when it is, links already sent on the `vercel.app` address keep working for at least 7 days *(assumed)*. The owner creates/owns the accounts; the team never handles their passwords.
- **Email / SMS:** none at launch (G-2). Password resets are done by admins (US-27). An emailed reset link is Later, once the dealership has a domain to send from.
- Later only: WhatsApp Business API, DMS integration, email password-reset links, email/WhatsApp alert notifications.

## 9. Non-functional
- **Scale / load** *(assumed)*: up to 10 branches, ~50 staff, ~3,000 visits/month, ~20 staff signed in at once, bursts of ~100 customers submitting within an hour.
- **Free-plan fit (Q-1, G-6):** until the go-live gate the app runs on free plans; staff screens refresh only while in use, so the database can sleep at night; the daily clean-up runs once a day; storage of test data stays well within the free allowance. Exact free-plan limits are confirmed by the researcher.
- **Latency:** customer form loads < 2 s on 4G; staff lists < 1 s; Overview < 2 s with 3 years of data for all branches *(assumed)*; the first request after the database has slept may take a few extra seconds *(assumed)*.
- **Availability** *(assumed)*: best effort on the hosting provider, no formal uptime promise; a planned maintenance window is announced to admins.
- **Offline:** not supported; customer drafts survive refresh in that phone's browser (best effort).
- **Security (closes D-18, PRODUCTION G-W1/W2/W3/W4):** passwords stored only as argon2id hashes on the server; sessions on the server, expiring (support 2 h idle, admins 12 h idle, 7 days max, G-13), ended by sign-out, deactivation, password reset and role/branch change; role + branch checks on the server for every page, request and action (support → 403 on admin data, AC-6); protection against cross-site request forgery on every form; output escaped (no XSS); sign-in (per email and per network address), step-up passwords, link opening and submitting (per link, with a generous per-address flood limit, G-7) rate-limited; feedback links random-only (32 random bytes) and stored only as a SHA-256 hash (D-11; Resend issues a new code rather than storing a reversible one, G-1); first-admin setup works only on an empty system and its one-time password expires after 72 h (G-14); no feedback data, phone numbers, tokens or passwords in URLs (other than the link code) or server logs; HTTPS only; secrets only in the host's environment settings, never in the repo; the demo's public password and demo accounts do not exist in production.
- **Privacy — DPDP Act 2023 basics** (the owner has the final notice text checked by someone who knows the law before go-live, §12.1):
  - **Notice on the form** (welcome screen, G-12): "{Company name} (Chandra Honda) collects your answers, linked to your name, mobile number and vehicle, to improve our service and to call you back if you ask. Only our service managers see them. We keep them for 3 years. Our hosting providers may store them outside India. To see or delete your data, call {head-office phone}." + link to `/privacy`. `{Company name}` and `{head-office phone}` (plus a head-office email on `/privacy`) are **placeholders** shown as "Your Company Name" and a placeholder contact until the owner supplies the registered company name and contact, which is a go-live blocker (§12.1). Tapping **Start** means the customer agrees; not answering is always possible (closing the page).
  - **Purpose limit:** feedback data is used only for service improvement and callbacks; not shared with third parties other than the hosting/database providers that store it.
  - **Access and erasure on request:** US-30, answered by a main admin at head office across all branches (G-4); the notice names one head-office contact for all branches (G-12).
  - **Retention:** 3 years (Q-4); US-31 and §6.
  - **Minimum data:** only the F-2 fields are collected; no email, address or ID numbers of customers.
  - **Breach:** if data leaks, the owner informs the Data Protection Board and affected customers; the app supports this with the audit log and the customer search (a process, not an app feature).
- **Backups and restore (US-32, G-W6):** automatic database backups with at least 7 days of restore points on the paid plan (Q-1); restore rehearsed on the paid plan before launch; partial restore by default, full rollback only with the owner's go-ahead and followed by re-applying logged erasures (G-5); database structure only via versioned migrations; the restore and setup steps in `docs/DEPLOY.md`.
- **Audit:** append-only for the app (no screen or request can change or delete entries); covers every action in US-19.
- **Monitoring** *(assumed)*: server errors recorded in the host's logs without personal data; the maintainer checks them; no extra monitoring service.
- **Accessibility:** labels on all inputs, sufficient contrast, keyboard-usable on laptop, tap targets ≥ 48 px.
- **Cost limits (Q-1):** US$ 0 on free plans while building and testing; ≈ US$ 20–45 / month for hosting + database from the go-live gate.
- **Platforms/devices:** phone first (360 px+), laptop second (1440 px); modern Chrome/Safari on Android/iOS and desktop.

## 10. Constraints
- **Stack (owner):** Next.js (App Router), TypeScript, Tailwind CSS + shadcn/ui, Recharts, Zod (shared client/server), Drizzle ORM + drizzle-kit, Neon Postgres, Auth.js. Hosting Vercel.
- **Reuse:** same screens, questionnaire config, alert rules and metric functions as phase 1; the server implementation slots in behind the existing data-access interfaces (LLD §2.5); interface changes needed for branches, job card entry, accounts and privacy are design decisions for the architect.
- **Deadline:** none given *(assumed: none)*.
- **Deployment target:** a new production Vercel project at a new `….vercel.app` address + production database, separate from the demo (Q-5, G-10); the demo address goes offline at launch (Q-6).
- **Budget (Q-1):** free plans first; paid plans required before real customer data (§12.1); no code change between them.

## 11. Non-goals (explicitly out)
- Real DMS integration, and any job card import or file upload (support types job cards in).
- WhatsApp Business API, automatic sending or reminders (click-to-send `wa.me` only).
- Email or SMS sending of any kind at launch, including emailed password-reset links (Later, once a sending domain exists, G-2) and alert notifications.
- Multi-dealership / multi-tenant support (several branches of one dealership are in; other dealerships are out).
- Customer accounts or login; customers editing or withdrawing a submitted response themselves (they ask the dealership, US-30).
- Moving or importing any data from the demo; sample data in production.
- Two-step sign-in (one-time codes), single sign-on *(assumed: Later)*.
- Admin UI for editing questions/thresholds or the WhatsApp template (Later).
- Tamil language option (Later).
- Bulk export of all responses to CSV/Excel (Later; per-customer download for privacy requests is in).
- Email/WhatsApp notification to admin on new alerts (Later).
- Custom domain at launch (Later, no code change, Q-5).
- Dark mode (tokens only); native apps; offline use.
- Changes to the frozen phase-1 demo, and any "this demo has ended" page: the demo address simply goes offline at launch (Q-6, G-10).

## 12. Definition of done (phase 2)
- [ ] On a fresh production deployment the only data is the question set and one main admin; signing in forces a new password and shows "Add your first branch"; re-running setup changes nothing; the one-time password stops working after 72 h (US-23, G-14).
- [ ] Main admin adds two branches, advisors and a branch admin + support user per branch; each can sign in and lands on their portal (US-24, US-25, US-20).
- [ ] Support types in a new job card, generates a link and taps Send on WhatsApp: WhatsApp opens with the personalised message and a short link containing no customer data (AC-1, AC-2, US-26).
- [ ] Resend gives a fresh link with the original expiry and the old link shows "A newer link was sent to you on WhatsApp"; another support user of the branch can Resend it from All branch links (US-06, G-1, G-8).
- [ ] The customer opens the link on a different phone (360 px), sees the privacy notice, completes the form; the support laptop shows Opened then Completed without reload (AC-3, AC-4, AC-11, US-05, US-07).
- [ ] A staff screen left open and unused makes no requests to the server until someone returns to it (G-6).
- [ ] Re-opening a submitted link shows "already submitted"; an 8-day-old link shows the expired page; two simultaneous submits store one response; a same-phone retry after a lost reply shows the normal thank-you (AC-5, US-11, G-15).
- [ ] A rating of 1 or Q15 = Yes creates an alert for that branch; Open → Contacted → Resolved is audited (AC-7, AC-8).
- [ ] All 7 analytics blocks render and react to every filter; a branch admin sees only their branch, a main admin sees all with the Branch filter (AC-10, US-16, US-29).
- [ ] A support session gets 403 from every admin data request; a branch admin gets "Not found" for another branch's response, alert and user, and "Not allowed" on Customers (AC-6, US-29, G-4).
- [ ] Editing, deleting and restoring a response needs the password checked by the server; the audit shows old and new values (AC-9, US-18, US-21).
- [ ] 5 wrong passwords lock that email for 15 minutes and an admin reset clears the lock; a support session ends after 2 h idle and an admin session after 12 h; sign-out, deactivation, password reset and role/branch change end sessions (US-01, US-20, US-27, G-9, G-13).
- [ ] A main admin edits a user's email and role; the change is audited (US-20, G-9).
- [ ] A main admin's customer search finds job cards in every branch; download and erasure apply only to the ticked rows and are audited; the erased ids appear in the host's logs; the daily clean-up erases by age (90 days / 3 years), purges 30-day-old deleted items and old sessions and sign-in attempts (US-30, US-31, G-4, G-5, G-11).
- [ ] `docs/DEPLOY.md` holds setup, first-admin creation, the free-to-paid upgrade and the restore steps (partial restore by default, full rollback with erasure re-apply) (US-32, G-5).
- [ ] Production has no picker, demo password, demo label, Reset demo data or Simulate failed save, and runs at its own new address (§0.1, Q-5).

### 12.1 Go-live gate (before the first real customer link is sent)
Production may be built and tested before these are done, with staff-made test data only. No real customer link is sent until every item is ticked.
- [ ] **Paid plans:** hosting on Vercel Pro and the database on a Neon paid plan; the 7-day restore window confirmed; a restore rehearsed on the paid plan (Q-1, G-11, US-32).
- [ ] **Company details in the notice:** the dealership's registered company name and the head-office privacy contact (phone and email) replace the placeholders on the welcome notice and `/privacy` (G-12).
- [ ] **Dealer phone:** the real head-office phone replaces `{head-office phone}` everywhere it appears (notice, `/privacy`) (G-12).
- [ ] **First admin created:** the first main admin has been created on production by the maintainer and has set their own password (US-23, G-14).
- [ ] **Privacy notice legal check:** the final notice text (3 years, providers possibly outside India, contact) has been checked by someone who knows the DPDP Act (G-12).
- [ ] **Demo offline:** the phase-1 demo address is taken offline (Q-6, G-10).

## 13. Data safety
- Backup: automatic database backups, restorable to any point in the last 7 days on the paid plan (Q-1); restore rehearsed before launch; partial restore by default, and a full rollback re-applies logged erasures (G-5).
- Second device: **every device sees the same data** (server); customers' drafts stay on their own phone until submitted.
- If a staff device is lost or wiped: nothing is lost; its session expires within 2 h idle (support) or 12 h idle (admins), and an admin can end it sooner by resetting the password or deactivating the account.
- Undo: deleted responses stay restorable in "Recently deleted" for 30 days; edits have no one-click undo (old values in the audit log); **customer erasure and automatic retention clean-up cannot be undone** (confirm dialog + password for manual erasure), and a restore never brings erased data back into use (G-5).
- Consequence in one line: data is shared, backed up for 7 days and kept for 3 years of personal detail, but an erasure is final.

## Resolved decisions (CR-1)
Owner answers (2026-11-22):
- **Q-1 Budget:** free plans first (Vercel Hobby + Neon free); paid plans (Vercel Pro + Neon paid) as a go-live gate before real customer data; no code change to upgrade.
- **Q-2 Branch admin:** full admin for their own branch, including support users, scoped to that branch (narrowed by G-4 for privacy requests).
- **Q-3 Password reset:** owner first chose both email link and admin reset; superseded by G-2: admin reset only at launch.
- **Q-4 Retention:** 3 years for personal details of answered visits; unanswered links 90 days (critic: no objection).
- **Q-5 Address:** a `vercel.app` address for now; custom domain later with no code change.
- **Q-6 Demo:** taken down at launch.
- **G-2:** admin reset only at launch; emailed reset link later when a domain exists. (G-3, the email-reset rules, falls away with it.)
- **G-4:** customer search, download and erase are main-admin only, across all branches, with a tick box per record.
- **G-10:** production at a new `vercel.app` address; the demo address goes offline at launch; no takeover, no demo-data clearing.
- **G-12:** placeholder company name/contact ("Your Company Name" + placeholder) for now; real details are a go-live blocker; notice says 3 years and that hosting providers may store data outside India.

Team decisions (critic's option A): **G-1** Resend issues a fresh code, same visit and expiry · **G-5** partial restore by default, full rollback with owner's go-ahead and erasure re-apply from host logs · **G-6** refresh only while visible and used in the last 15 min · **G-7** per-link form limits, generous per-address flood limit · **G-8** links belong to the branch, My links / All branch links · **G-9** main admins edit name, email, role, branch; branch admins name/email of their support users · **G-11** go-live gate in the DoD; clean-up also removes old sessions and sign-in attempts · **G-13** admin reset clears the lock; support 2 h idle, admins 12 h; Sign out visible · **G-14** setup only on an empty system, one-time password 72 h, maintainer recovery only when no main admin can sign in · **G-15** same-phone retry is success.
