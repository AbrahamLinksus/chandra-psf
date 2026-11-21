# SPEC — Post-Service Feedback (PSF) System · Chandra Honda

> Written by the planner from the owner's answers, round by round. Approved before any design.
> Lines marked *(assumed)* were decided by the planner because the owner chose "decide for me".
> Source: owner's input spec `docs/SPEC-input.md` (2026-11-21). Its IDs (Q1–Q15, Q1a…Q13a, AC-1…AC-11) are kept unchanged.
> Owner's note: "build like a dummy ui for now, i want to make it very interactive later make the necessary changes for that".

## 0. Phases (demo now vs later)

- **Phase 1 — Demo (this project, owner round 1):** a clickable UI of **every screen** in §7 on **mock data**, with a quick "Sign in as Admin / Support" picker. Data lives **only in the browser that made it** (seed data + every change kept in that browser's storage until "Reset demo data"). A form filled in on a phone shows up only in that same browser. Published as a public link on Vercel's free tier so the client can open it on their own phone.
- **Phase 2 — Later:** real database (Neon Postgres + Drizzle), real login (Auth.js, argon2id passwords, server-side role checks / 403s, rate limits, CSRF), real single-use SHA-256-hashed tokens, server-side alerts engine, shared data across devices, plus everything in the owner's §16 "Later" list. Same screens.
- **Design rule for Phase 1 (owner's standing goal: "very interactive later"):** every screen reads and writes **only through one typed data-access layer** (e.g. `getJobCard`, `createVisitLink`, `getVisitByToken`, `submitResponse`, `listAlerts`, `updateAlert`, `getAnalytics(filters)`, `editResponse`, `deleteResponse`, `restoreResponse`, `listAudit`, `listUsers`, `signIn`). Phase 1 implements it with mock data in browser storage; Phase 2 adds a server/database implementation of the same interface, so Phase 2 swaps the implementation, not the screens. Questions, triggers (`show_if`), alert rules and metric formulas live in config / pure functions shared by both phases.
- Each user story below has a **Phase** column: "Demo" = built now; "Later" = Phase 2.

## 1. Goal
Chandra Honda (two-wheeler dealership, scooters and motorcycles) replaces its paper/Excel post-service feedback questionnaire with a digital flow. After a vehicle is serviced and delivered, a support staff member enters the job card number, the system autofills the customer and vehicle details, creates a single-use feedback link (valid 7 days) and opens WhatsApp with a prefilled message. The customer answers a short, friendly, mobile-first form (14 base questions + conditional follow-ups + a callback question). Answers are visible only to the admin, who gets an analytics dashboard, a callback/complaint alerts queue and an audit log of every change. Support staff never see answers or analytics, only link status.

## 2. Users
| User | What they want | How often |
|---|---|---|
| Customer (vehicle owner) | Answer quickly on their phone from a WhatsApp link, no login; ask for a call back if unhappy | Once per service visit (~2 min) |
| Support staff (many accounts) | Look up a job card, generate a link, send it on WhatsApp in one tap, see whether the customer opened/completed it | Many times a day, at the delivery desk, phone or laptop |
| Admin (one main admin) | See satisfaction trends, advisor performance and problem areas; act on unhappy customers; correct data with an audit trail; manage support users | Daily on laptop, alerts checked on phone |

**Role rules (from owner):** Customer: open own link, submit once, nothing else. Support: log in, look up job card, generate/regenerate/resend link, see link status (Created / Opened / Completed / Expired); cannot see answers, ratings, comments or analytics. Admin: everything (analytics, responses, alerts, edit data, manage support users, audit log). Any edit or delete of feedback data needs the admin to re-enter their password and is written to the audit log with old and new values.

## 3. User stories
| ID | As a… | I want to… | So that… | Acceptance (checkable) | Phase |
|---|---|---|---|---|---|
| US-01 | Support | sign in and land on my portal | only staff create links | Signing in as a support demo account opens `/support`; as admin opens `/admin`; a support user opening any `/admin` page is sent away / shown "Not allowed" | Demo (simulated sign-in); real Auth.js + server-side 403 (AC-6) Later |
| US-02 | Support | enter a job card number and see customer + vehicle details autofilled | I don't retype data | Entering a seeded job card (e.g. `JC-24-1042`) fills name, phone, reg. no, model, vehicle type, service date, advisor (AC-1); an unknown number shows "Job card not found" | Demo |
| US-03 | Support | generate a feedback link for that visit | the customer gets a personal form | "Generate link" shows a `/f/<token>` URL that opens the customer form for that visit (AC-2); a visit gets status **Created**, expires 7 days later | Demo (mock token); hashed single-use token Later |
| US-04 | Support | send the link on WhatsApp in one tap, or copy it | sending is fast | "Send on WhatsApp" opens `wa.me/<phone>?text=…` with the template message filled (name, model, reg. no, link) (AC-2); "Copy link" copies and shows "Copied" | Demo |
| US-05 | Support | see the visits I created with their status only | I can chase unopened links | `/support` lists my visits: customer, reg. no, date, coloured status badge; no ratings/answers anywhere; search by job card / reg. no | Demo |
| US-06 | Support | regenerate, resend or cancel a link | a lost, expired or wrongly sent link can be replaced or withdrawn | "Regenerate" creates a new link and the old one shows the Expired page with "A newer link was sent to you on WhatsApp" (S-05); "Resend" reopens WhatsApp with the current link; "Cancel link" (confirm) sets status **Cancelled**, the link shows "Link not valid", the visit is left out of response rate, and the action is audited (S-14) *(assumed: critic default)* | Demo |
| US-07 | Customer | open my link and see a personal welcome | I trust it and know it's quick | Welcome shows "Hi {name}, how was your {model}'s service on {date}?" and "Takes about 2 minutes"; opening sets visit status **Opened** (AC-3) | Demo |
| US-08 | Customer | answer one category per step with face ratings and big Yes/No chips | it's quick on a phone | 5 category steps + callback step, progress "Step 2 of 6"; faces 1–5 with label; Next disabled until the step is complete; Back keeps answers; works at 360 px (AC-11) | Demo |
| US-09 | Customer | get short follow-up questions only when something went wrong | I can explain without a long form | Every trigger in §4 F-3 table shows/hides its follow-up with a slide animation (AC-4); hidden follow-up answers are discarded on submit; chips required, text optional | Demo |
| US-10 | Customer | ask for a call back and see a thank-you | I know someone will help | Q15 is always last; Thank-you shows a success animation, and "Our team will call you soon" when Q15 = Yes; status **Completed** (AC-3) | Demo |
| US-11 | Customer | not lose answers on refresh, and not submit twice | it's reliable | Refresh mid-form restores answers (browser storage, best effort); a completed link shows "Thank you — already submitted"; a link older than 7 days shows the Expired page (AC-5) | Demo |
| US-12 | Admin | get an alert for every unhappy customer or callback request | nobody is missed | Submit with any of Q1/Q6/Q11/Q12 = 1 or Q15 = Yes creates one alert listing all reasons (e.g. "Callback requested · Q12 rated 1") visible on the admin dashboard (AC-7); Q3 = Yes alone creates none | Demo (rule runs in mock layer); server-side engine Later |
| US-13 | Admin | work the alerts queue | callbacks get done | `/admin/alerts` newest first, filter by status, rows coloured by status; move Open → Contacted → Resolved and add notes; nav badge shows open count; each change appears in the audit log (AC-8) | Demo |
| US-14 | Admin | see KPI tiles with change vs previous period | I know how we're doing at a glance | Tiles: Responses received, Response rate, Avg Q12, Recommend rate, Open alerts, each with green/red arrow vs the previous same-length period | Demo |
| US-15 | Admin | see category scores, trend, advisor table, problem breakdown, question detail, recent comments | I know where to improve | All 7 blocks of §4 F-5 render with seed data (AC-10); advisor table sortable; problem breakdown has a follow-up selector | Demo |
| US-16 | Admin | filter Overview and Responses by date range, vehicle type, model, advisor | I can drill in | Every filter changes every block and the responses table (AC-10) | Demo |
| US-17 | Admin | browse all responses and open one | I can read the full feedback | `/admin/responses` table (filterable) → detail with every answer incl. follow-ups, visit + vehicle info | Demo |
| US-18 | Admin | edit or delete a response after re-entering my password | data can be corrected safely | Edit/delete asks for password; wrong password blocks it; change is logged with old and new values (AC-9) | Demo (password checked against demo admin password); argon2id + server step-up Later |
| US-19 | Admin | see the audit log | every change is traceable | `/admin/audit` lists actor, action, entity, old → new, time (IST), newest first; no edit/delete controls | Demo |
| US-20 | Admin | create and deactivate support users | staff turnover is handled | `/admin/users`: add support user (name, email, temp password), deactivate/reactivate; a deactivated user can't sign in; a new user signing in with the temp password must set their own password before reaching `/support` (S-15) *(assumed: critic default)*; changes audited | Demo (users kept in this browser) |
| US-21 | Admin | restore a response I deleted from a "Recently deleted" list | a mistaken delete can be undone | Deleting a response moves it (with its alert) to `/admin/responses/deleted`; it disappears from responses, analytics and alerts; "Restore" (after password) brings back the response, its answers and its alert with its previous status; delete and restore are both audited | Demo |
| US-22 | Owner / presenter | reset the demo to its original seed data | each demo starts clean | "Reset demo data" asks "Reset all demo data? Every link, response, alert, user and audit entry made in this browser is lost." → confirm → seed data restored, signed out to the sign-in screen | Demo only |

## 4. Main flows

### Rules for every flow
- **Several tabs (owner, gap round, S-06):** every open tab of the same browser picks up changes made in other tabs automatically (lists, badges, statuses, dashboards refresh without a reload) and a tab never overwrites data saved by another tab; each write merges into the latest stored data rather than saving a stale copy.
- **Saving and failed saves (S-13)** *(assumed: critic default)*: every write (customer Submit, link create/regenerate/cancel, alert status/notes, response edit/delete/restore, user changes) shows a saving state; if it fails the screen shows "Couldn't save, try again", keeps what the user entered and lets them retry. The demo data layer can simulate a failure so this is visible now and Phase 2 needs no screen changes.

### F-1 · Sign in (US-01)
1. Staff opens the app → sign-in screen: quick picker buttons "Sign in as Admin" · "Sign in as Support 1" · "Sign in as Support 2", plus the normal email + password form (works for the demo users and any support user the admin adds) *(assumed)*. The demo password is shown as a hint under the form so presenters can use the password prompts *(assumed)*.
2. Support → `/support`; admin → `/admin`. Nav and pages match the role. "Sign out" returns to sign-in. The signed-in user is remembered in this browser until sign-out or reset *(assumed)*.
3. First sign-in of a support user created by the admin (temp password) → "Set your password" screen (new password + confirm) → then `/support`; the change is audited (S-15) *(assumed: critic default)*. Seeded demo users skip this.
- Errors / edge cases: wrong password → "Email or password is incorrect"; deactivated user → "Account disabled, contact admin"; support opening an admin URL → "Not allowed" page (Later: server returns 403 for every response/analytics API, AC-6).

### F-2 · Create and send a feedback link (US-02 – US-06)
1. Support taps the big "New feedback link" button → `/support/new`.
2. Enters job card number → details autofill from the (mock) DMS via `getJobCard(jobCardNo)`. Lookup ignores case, spaces and dashes: `jc-24-1042`, ` JC241042` and `JC 24 1042` all find `JC-24-1042` (S-02) *(assumed: critic default)*. A hint under the input lists the seeded job cards that have no link yet (S-07) *(assumed: critic default)*.
3. The customer's phone number on the details card is editable before sending (fix a landline, typo or missing number); the edited number is used for the WhatsApp link and saved on the visit (S-03) *(assumed: critic default)*.
4. Taps "Generate link" → visit created, status **Created**, expires in 7 days; link shown.
5. Taps "Send on WhatsApp" (WhatsApp icon + colour) → `wa.me/<phone>?text=<template>`; or "Copy link".
6. `/support` list shows the visit with its status badge; later Regenerate / Resend / Cancel link (US-06).
- Errors / edge cases: job card not found → message, no link; a link already exists for this job card → show it with its status and offer Regenerate instead of creating a duplicate *(assumed)*; job card whose feedback is Completed → show "Feedback already received", no new link *(assumed)*; WhatsApp not installed → `wa.me` opens WhatsApp Web (browser behaviour).

### F-3 · Customer feedback form (US-07 – US-11)
1. Customer opens `/f/<token>` → Welcome (status → **Opened**).
2. Steps (one category per screen, progress bar "Step n of 6"):
   1. Service Quality & Complaint Resolution: Q1–Q3
   2. Customer Interaction & Communication: Q4–Q6
   3. Timelines & Vehicle Delivery: Q7–Q9
   4. Pricing & Value for Money: Q10–Q11
   5. Overall Satisfaction & Loyalty: Q12–Q14
   6. Callback: Q15
3. Submit → Thank-you (status → **Completed**); alert rules run.
- **Demo across devices:** a link generated in one browser (e.g. the support laptop) and opened on another phone still shows the personal welcome for that job card (the link itself carries the visit details, and the seed job cards exist in every browser) *(assumed)*; the answers given on that phone stay on that phone, so the laptop's support list keeps showing **Created** (owner accepted, round 1). To show the full status cycle, open the link in the same browser. On the device where the form was filled, that device's own admin views show the submitted response and its alert (S-12) *(assumed: critic default)*.
- **Text length (S-13)** *(assumed: critic default)*: Q14, Q2a, Q13a and every "Tell us more" box are limited to 1,000 characters with a visible counter; emoji and Tamil text are accepted.
- Errors / edge cases: invalid/unknown or cancelled token → "Link not valid" page; expired (> 7 days) → Expired page; replaced by Regenerate → Expired page with "A newer link was sent to you on WhatsApp" (S-05) *(assumed: critic default)*; already completed → "Thank you — already submitted"; refresh → answers restored from browser storage; changing a parent answer so a trigger no longer matches → follow-up hides and its answer is discarded on submit.

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
- Triggers live in question config (`show_if`, e.g. `{"op":"lte","value":3}`, `{"op":"in","value":["Partially","No"]}`), not in screen code.

**Form UX (owner §6.3):** Welcome → 5 category steps → Callback → Thank you; faces for ratings (very unhappy → very happy) with label under the selected one; Yes/No as large chips; follow-ups slide open under their parent; Next enabled only when the step is complete; Back keeps answers; tap targets ≥ 48 px; sticky thumb-reachable Next on mobile; success animation; works at 360 px; centred card (max ~560 px) on laptop; vehicle and customer name shown throughout.

### F-4 · Alerts (US-12, US-13)
1. On submit, an alert is created when any rating (Q1, Q6, Q11, Q12) = 1, or Q15 = Yes. One alert per response, all matching reasons listed. Q3 = Yes alone raises none.
2. Admin sees the open-count badge in the nav → `/admin/alerts` (newest first, filter by status).
3. Admin opens an alert (customer, phone, vehicle, reasons, link to the response) → sets Contacted / Resolved, adds notes. Each status change and note goes to the audit log.
4. **After an admin edit (owner, gap round, S-08):** the alert rules re-run on the edited answers: the alert's reasons are updated; if an alert is now due and none exists, one is created (status Open); if no reason remains, the alert is marked **Resolved** with an audit-log note (e.g. "Auto-resolved: no alert reason after edit"). Each of these changes is audited.
- Errors / edge cases: no alerts → "No alerts — all customers happy"; Resolved alert can be reopened to Open *(assumed)*.

### F-5 · Analytics (US-14 – US-16)
Filter bar (Overview and Responses): date range · vehicle type · model · advisor. Single column on mobile, 2–3 column grid on laptop.

| # | Block | Shows | Chart |
|---|---|---|---|
| 1 | KPI tiles | Responses received · Response rate · Avg overall satisfaction (Q12) · Recommend rate (Q13 % Yes) · Open alerts — each with change vs previous period | Number tiles |
| 2 | Category scores | Score /100 for each of the 5 categories | Horizontal bar |
| 3 | Trend | Avg Q12 and recommend rate per week/month | Line |
| 4 | Advisor performance | Per advisor: responses, avg Q6, % Q4 Yes, % Q7 Yes, avg Q12 | Sortable table |
| 5 | Problem breakdown | Counts per follow-up category (Q1a, Q3a, Q6a, Q9a, Q11a; Q7a lateness split) | Bar, with follow-up selector |
| 6 | Question-level detail | Yes/No (Yes/Partially/No) split for Q2–Q5, Q7–Q10, Q13, Q15 | Small stacked bars |
| 7 | Recent comments | Latest Q14 + follow-up text, with Q12 rating beside each | List |

**Metric definitions (owner §10, exact):**
- **Filter date (S-11)** *(assumed: critic default)*: the visit's **service date** drives every block, the KPI tiles, the trend and the Responses table, so all numbers for a period agree.
- Response rate = completed visits ÷ visits whose service date is in the period (expired counted as not responded). A response in Recently deleted does not count as completed (S-09) *(assumed: critic default)*; a Cancelled visit is left out of both numbers (S-14) *(assumed: critic default)*.
- Rating → score: `(rating − 1) ÷ 4 × 100`.
- Yes/No → score: Yes = 100, No = 0. Q3 is reversed (No issues = 100). Q2: Yes = 100, Partially = 50, No = 0.
- Category score = mean of its question scores (Q14, Q15 excluded).
- Recommend rate = % of Q13 = Yes.
- "Change vs previous period" compares with the same-length period immediately before.
- Default date range: last 30 days; trend granularity weekly for ranges ≤ 90 days, monthly beyond *(assumed)*.
- "Open alerts" tile counts alerts with status Open regardless of date filter *(assumed)*.
- **No data (S-10)** *(assumed: critic default)*: a block or tile with no matching responses shows "—" and "No responses for these filters" (never 0 %, NaN or ∞); the change arrow is hidden when the previous period has no data.

### F-6 · Responses, edits and audit (US-17 – US-19)
1. Admin opens `/admin/responses` (filters as F-5) → row → detail.
2. "Edit" → change answers → "Save" → password prompt → saved; audit entry with old and new values; the alert rules re-run as in F-4 step 4 (S-08).
3. "Delete" → confirm + password → moved to **Recently deleted** (`/admin/responses/deleted`: customer, date, deleted at, Restore); audit entry `response.delete` with old value (owner round 1).
4. "Restore" → password → response, answers and its alert (previous status) are back everywhere; audit entry `response.restore`.
5. `/admin/audit` shows every entry, append-only.
- Errors / edge cases: wrong password → "Password incorrect", nothing saved; edits follow the same follow-up rules as the form (changing Q1 to 4 removes Q1a) *(assumed)*; a deleted response's visit stays **Completed** for support (the customer did submit; the link can't be reused) *(assumed)*; Recently deleted items stay until restored or "Reset demo data" (no auto-purge in the demo) *(assumed)*; empty list → "Nothing deleted". Edits have no one-click undo; their old values stay readable in the audit log.

### F-8 · Reset demo data (US-22)
1. "Reset demo data" is on the sign-in screen and in the admin "More" menu / sidebar *(assumed)*.
2. Confirm dialog states what is lost → all data in this browser goes back to the seed set, with seed dates recounted back from today (§6, S-07); user is signed out. Other open tabs pick up the reset (S-06).
- Edge: clearing the browser's site data has the same effect (seed data comes back on next open).

### F-7 · Manage support users (US-20)
1. Admin opens `/admin/users` → list (name, email, active, created).
2. "Add support user" → name, email, temporary password → appears in list.
3. Deactivate / reactivate. All changes audited.
- Errors / edge cases: duplicate email → "Email already in use"; admin cannot deactivate themself.

## 5. Inputs and outputs (concrete examples)
| Flow | Example input | Expected output |
|---|---|---|
| F-1 | `support1@chandrahonda.demo` + demo password | Lands on `/support` showing "My feedback links" |
| F-2 | Job card `JC-24-1042` | Autofill: Ramesh Kumar · +91 98400 12345 · TN 09 BX 4521 · Activa 6G · Scooter · Paid service · 14 Nov 2026 · Advisor: Suresh |
| F-2 | Generate + Send on WhatsApp | Opens `https://wa.me/919840012345?text=Hi%20Ramesh%20Kumar%2C%20thank%20you%20for%20servicing%20your%20Activa%206G%20(TN%2009%20BX%204521)%20at%20Chandra%20Honda.%20Please%20share%20your%20feedback%20(2%20mins)%3A%20https%3A%2F%2F<domain>%2Ff%2F<token>` |
| F-2 | Job card `JC-99-0000` | "Job card not found. Check the number on the job card." |
| F-3 | Q1 = 2 | Q1a slides open: chips Problem not fixed · Same problem came back · New problem appeared · Other + "Tell us more" |
| F-3 | Q7 = No, then changed to Yes | Q7a appears, then hides; its answer is not saved |
| F-3 | Q12 = 1, Q15 = Yes, submit | Thank-you with "Our team will call you soon"; one alert "Callback requested · Q12 rated 1" |
| F-3 | Opening a link created 8 days ago | Expired page: "This feedback link has expired. Please contact Chandra Honda." |
| F-4 | Alert for Priya S. → Contacted, note "Called, bike rechecked 22 Nov" | Row turns amber; audit: `admin · alert.status · open → contacted` + note |
| F-5 | Q1 ratings 4, 5, 3 | Scores 75, 100, 50 |
| F-5 | Q2 answers Yes, Partially, No | Scores 100, 50, 0 |
| F-5 | 40 visits created, 30 completed in range | Response rate 75% |
| F-6 | Change Q6 from 2 → 4, password correct | Q6a removed; audit `response.edit` old `{Q6:2,Q6a:["Rude"]}` new `{Q6:4}` |
| F-6 | Delete CUST-014's response, then Restore | Response leaves the table, the Overview "Responses received" drops by 1 and its alert leaves the queue; after Restore all three are back and the audit shows `response.delete` then `response.restore` |
| F-8 | After creating 3 links and 1 response, tap Reset demo data → confirm | Signed out; support list shows only the seeded visits again; audit log shows only seeded entries |
| F-1 | Tap "Sign in as Support 1" | Lands on `/support` as Support 1 (support1@chandrahonda.demo) |
| F-2 | Job card ` jc241042` | Same autofill as `JC-24-1042` (S-02) |
| F-6 | Edit Q12 1 → 4 on a response whose only alert reason was "Q12 rated 1" | Alert marked Resolved; audit shows `response.edit` and `alert.status · open → resolved` with note "Auto-resolved: no alert reason after edit" (S-08) |
| F-6 | Edit Q15 No → Yes on a response with no alert | New Open alert "Callback requested"; open-count badge +1 (S-08) |
| F-5 | Filter matches no responses | Tiles and blocks show "—" and "No responses for these filters"; no arrows (S-10) |
| F-3 | Customer opens an old link after support pressed Regenerate | Expired page: "A newer link was sent to you on WhatsApp" (S-05) |
| F-8 | Data first loaded on 10 Jan 2027 | Seed service dates span ~10 Oct 2026 → 10 Jan 2027, i.e. the 3 months before that day; Overview "last 30 days" shows data (S-07) |
| — | Two tabs open; customer submits in tab B | Tab A's support list shows Completed without reload; a later save in tab A keeps tab B's response and alert (S-06) |

## 6. Data
- **Entities (target model, owner §8):** branches, advisors, users (role support/admin, active), mock_dms (job cards), vehicles, service_visits (status created/opened/completed/expired/cancelled, expires_at, created_by, replaced_by for regenerated links), questions (versioned, `show_if`, parent), responses (one per visit, questions_version), answers (value_num / value_text / value_options by type), alerts (reasons, status, notes), audit_log (append-only, old/new jsonb). Full column list: `docs/SPEC-input.md` §8. Phase 1 mock data uses the same shapes so Phase 2 is a swap.
- **Answer storage by type:** ratings → number; yes/no, yes/partial/no, single_select → text; multi_select → options list (+ text for "Tell us more"); text → text.
- **Questions are versioned:** editing wording creates a new version; old answers keep pointing at the old version (question editing UI itself is Later).
- **Seed (demo):** ~30 completed responses (Q1–Q14) from the owner's file `data/seed/Honda_PSF_Survey_30_Dummy_Customer_Responses.xlsx` (30 fictional responses; columns read by the data task). Rules: Q11 1–10 → 1–5 via `ceil(x/2)`; follow-ups generated for negative answers using Q14 hints (e.g. "delivery was slightly delayed" → Q7a "1 day late"); Q15 = No by default, Yes on a few unhappy rows (e.g. CUST-006, CUST-014, CUST-022); 2–3 extra responses with a rating of 1; 1 branch, 4 advisors; service dates spread over the last 3 months; models Activa, Dio (scooter), Shine, SP125, Unicorn (motorcycle); ~10 unanswered visits (some expired); about 10 extra job cards with no visit yet, so "Generate link" can always be shown fresh (listed as a presenter hint on `/support/new`) (S-07) *(assumed: critic default)*; users: 1 admin, 2 support (demo credentials in `.env.example`, not in code).
- **Seed dates move with the load day (owner, gap round, S-07):** every seed date (service dates, link created/expiry, submitted, alert and audit times) is stored as an offset and counted back from the day the data is first loaded in this browser or last reset, so the seed always covers "the last 3 months" and the expired/open link mix stays the same. The data then keeps those dates until the next reset.
- **Volume:** demo ≈ 45 visits, ~33 responses, ~500 answers, a handful of alerts. Real use (Later) ≈ a few hundred visits/month *(assumed)*.
- **Where demo data lives (owner round 1):** the seed set ships with the app; every change (links, responses, alerts, users, audit) is kept in that browser's storage until "Reset demo data" or the browser's data is cleared. Each browser/device has its own copy. All tabs of one browser share that copy live and never overwrite each other (owner, gap round, S-06).
- **Retention:** demo data is disposable; real retention policy decided in Phase 2 *(assumed)*.
- **Time:** store UTC, display IST.

## 7. Screens (UI projects)
| Screen | Purpose | Key elements | Wireframe |
|---|---|---|---|
| sign-in | Staff login | Quick "Sign in as Admin / Support 1 / Support 2" buttons, email + password form, demo password hint, error message, "Reset demo data" link | docs/wireframes/sign-in.png |
| support-list `/support` | My links + status | Big "New feedback link" button, search (job card / reg. no), rows: customer, reg. no, date, status badge (Created · Opened · Completed · Expired · Cancelled), Resend / Regenerate / Cancel link (S-14) | docs/wireframes/support-list.png |
| support-new `/support/new` | Look up + generate + send | Job card input with hint of fresh seeded job cards (S-07), autofilled details card with editable phone (S-03), Generate link, link box, Send on WhatsApp (green WhatsApp button), Copy link | docs/wireframes/support-new.png |
| form-welcome `/f/[token]` | Personal welcome | "Hi Ramesh, how was your Activa 6G's service on 14 Nov?", "Takes about 2 minutes", Start | docs/wireframes/form-welcome.png |
| form-step | One category per step | Progress "Step 2 of 6", questions, faces 1–5 with label, Yes/No chips, sliding follow-ups (chips + Tell us more), Back, sticky Next | docs/wireframes/form-step.png |
| form-callback | Q15 | "Would you like someone from our service team to call you?" Yes/No, Submit | docs/wireframes/form-callback.png |
| form-thank-you | Done | Success animation, "Our team will call you soon" if Q15 = Yes | docs/wireframes/form-thank-you.png |
| form-expired / form-already-submitted / form-invalid | Link states | Icon, message, dealership contact; regenerated link adds "A newer link was sent to you on WhatsApp" (S-05) | docs/wireframes/form-states.png |
| admin-overview `/admin` | Analytics | Filter bar, 5 KPI tiles with arrows, 7 blocks (§4 F-5), skeleton loaders, "—" / "No responses for these filters" empty states (S-10) | docs/wireframes/admin-overview.png |
| admin-alerts `/admin/alerts` | Callback queue | Status filter, rows coloured by status, reasons, detail drawer with status buttons + notes | docs/wireframes/admin-alerts.png |
| admin-responses `/admin/responses` | All responses | Filter bar, table (date, customer, model, advisor, Q12, alert flag) → detail | docs/wireframes/admin-responses.png |
| admin-response-detail | One response | Visit + vehicle info, answers by category incl. follow-ups, Edit / Delete, password prompt | docs/wireframes/admin-response-detail.png |
| admin-deleted `/admin/responses/deleted` | Recently deleted | Rows: customer, service date, deleted at, Restore (password prompt); empty state "Nothing deleted" | docs/wireframes/admin-deleted.png |
| reset-dialog | Reset demo data | Warning text of what is lost, Cancel, Reset | (in sign-in) |
| admin-audit `/admin/audit` | Audit log | Rows: time (IST), actor, action, entity, old → new; filter by action *(assumed)* | docs/wireframes/admin-audit.png |
| admin-users `/admin/users` | Support users | List, Add support user form, Deactivate / Reactivate | docs/wireframes/admin-users.png |
| not-allowed | Role guard | "You don't have access to this page", link back | (in form-states) |
| set-password | First sign-in of an admin-created support user (S-15) | New password, confirm, Save | (in sign-in) |

**Every screen that saves** shows a saving state and the "Couldn't save, try again" message with the user's input kept (§4 Rules, S-13). Long texts are shown truncated in lists with "Show more" on detail screens *(assumed)*.

**Navigation:** admin mobile = bottom tab bar (Overview · Alerts · Responses · More → Recently deleted, Audit, Users, Reset demo data, Sign out); admin laptop = left sidebar with alerts badge (same items). Recently deleted is also linked from the Responses page. Support = simple top bar.

**Visual system (owner §12):** neutral base (white/slate) + one accent, the dealership red, only for primary buttons, progress and highlights; green/amber/red reserved for status; one sans-serif (Inter or Geist); rounded cards 12–16 px, soft shadows, generous spacing; lucide icons; light mode, colour tokens ready for dark mode later; shadcn/ui components only, no one-off styles; same chart colour = same meaning everywhere; KPI change as small green/red arrow; friendly empty states; micro-interactions (chip tap feedback, step transitions, follow-up slide-in, success animation). Every screen checked at 360 px and 1440 px.

## 8. Integrations
- **WhatsApp:** `wa.me` deep link only (no API, no account) — Demo.
- **DMS:** mocked behind `getJobCard(jobCardNo: string): Promise<JobCard | null>`; real DMS Later.
- **Database:** none in the demo (browser storage); Neon Postgres + Drizzle — Later.
- **Auth:** simulated in the demo; Auth.js credentials provider + argon2id — Later.
- **Hosting:** Vercel free tier, public link (owner round 1); uses the owner's Vercel account (owner creates/connects it; the team never handles its password).
- Later only: WhatsApp Business API, email/WhatsApp alert notifications.

## 9. Non-functional
- **Scale / load:** one dealership, 1 branch, 1 admin, a few support users; demo data ≈ 45 visits. Not a concern beyond that.
- **Latency:** customer form loads < 2 s on 4G; dashboard updates < 1 s on demo data.
- **Offline:** not supported; form drafts survive refresh via browser storage (best effort).
- **Security & privacy (target, owner §13):** server-side role checks on every route/action; hashed tokens (SHA-256 of 32 random bytes, base64url); argon2id (or bcrypt) passwords; rate-limited login and submit; CSRF via Auth.js; no feedback data in URLs or logs; customer phone visible only to support and admin; support never receives answers/analytics. **Demo phase (owner round 1):** these are mimicked in the UI and mock layer (role guard pages, password prompt, mock tokens) and become real in Phase 2 — all marked **Later**. Because the demo is a public link with a sign-in picker, anyone with the URL can view everything: the demo must contain **only fictional data**, and the site asks search engines not to index it *(assumed)*. A visible "Demo — sample data" label is shown in staff screens *(assumed)*.
- **Accessibility:** labels on all inputs, sufficient contrast, keyboard-usable on laptop, tap targets ≥ 48 px.
- **Cost limits:** free tiers only for the demo *(assumed)*.
- **Platforms/devices:** phone first (360 px+), laptop second (1440 px); modern Chrome/Safari on Android/iOS and desktop *(assumed)*.

## 10. Constraints
- **Stack (owner):** Next.js (App Router), TypeScript, Tailwind CSS + shadcn/ui, Recharts, Zod (shared client/server); Phase 2: Drizzle ORM + drizzle-kit, Neon Postgres, Auth.js. Hosting Vercel.
- **Deadline:** none given *(assumed: none)*.
- **Deployment target:** public Vercel URL, free tier, owner's Vercel account (owner round 1).
- **Budget:** free tiers *(assumed)*.
- **Architecture:** UI must talk only to the data-access interface so Phase 2 replaces the mock without screen changes (owner's note).

## 11. Non-goals (explicitly out)
- Real DMS integration (mocked behind one interface).
- WhatsApp Business API automation / automatic reminders (manual `wa.me` only).
- Multi-dealership / multi-tenant support.
- Customer accounts or login.
- Admin UI for editing questions/thresholds or the WhatsApp template (Later).
- Tamil language option (Later).
- Export to CSV/Excel (Later).
- Email/WhatsApp notification to admin on new alerts (Later).
- Dark mode (tokens only).
- Sharing demo data between devices / a real backend in the demo (Phase 2).

## 12. Definition of done (demo phase)
- [ ] As support, enter a seeded job card, see details autofilled, generate a link and tap Send on WhatsApp: WhatsApp opens with the personalised message and link (AC-1, AC-2).
- [ ] Open that link on a 360 px phone, complete the form, and watch follow-ups appear/disappear for every trigger; the support list shows Opened then Completed (AC-3, AC-4, AC-11).
- [ ] Re-opening a submitted link shows "already submitted"; an 8-day-old seeded link shows the expired page (AC-5).
- [ ] Submitting with a rating of 1 or Q15 = Yes shows a new alert on the admin dashboard; moving it Open → Contacted → Resolved shows each change in the audit log (AC-7, AC-8).
- [ ] All 7 analytics blocks render with the seed data and react to every filter (AC-10).
- [ ] Editing a response asks for the admin password and the audit log shows old and new values; support accounts cannot reach any admin page (AC-9, AC-6 as UI guard; server 403 in Phase 2).
- [ ] Deleting a response puts it in Recently deleted and Restore brings it back with its alert; "Reset demo data" returns the app to the seed data.
- [ ] The client opens the public Vercel link on their own phone and completes a feedback form at 360 px.
- [ ] On a fresh load or after Reset, the Overview's default "last 30 days" shows seed data and some seeded links are still open (S-07).
- [ ] With two tabs open, a submission in one tab appears in the other without reload, and a save in the other tab doesn't remove it (S-06).
- [ ] Editing a response re-runs the alert rules: Q12 1 → 4 auto-resolves its only-reason alert with an audit note; Q15 No → Yes creates a callback alert (S-08).
- [ ] A simulated failed save shows "Couldn't save, try again" and keeps the entered answers (S-13).

## 13. Data safety
- Backup: **none** (owner round 1). Demo data is kept in this browser until "Reset demo data".
- Second device: **other devices don't see it** (owner round 1); each browser has its own copy starting from the seed data.
- If the device is wiped or browser data cleared, the user loses: every link, response, alert, user and audit entry made in that browser; the original seed data comes back (owner round 1).
- Undo: a deleted response goes to "Recently deleted" and can be restored (owner round 1). Edits have no one-click undo; old values stay in the audit log. "Reset demo data" itself has no undo (confirm dialog warns).
- Consequence in one line: nothing made during a demo survives a reset or a cleared browser, and nothing is shared between devices.

## Open questions
- None. Resolved in round 1: demo boundary (mock data + sign-in picker, phase 2 behind same screens), hosting (public Vercel free tier, owner's account), data safety (browser only, reset button, no backup), undo (Recently deleted with restore). Seed source: `data/seed/Honda_PSF_Survey_30_Dummy_Customer_Responses.xlsx`. Gap round (product-critic G-1 to G-15, `docs/scenarios.md`): G-1 to G-3 answered by the owner; G-4 to G-15 take the critic's option A, marked *(assumed: critic default)*.
