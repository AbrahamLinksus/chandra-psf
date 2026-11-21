# Owner's input spec (verbatim, 2026-11-21)

> Owner's note with this spec: "build like a dummy ui for now, i want to make it very interactive later make the necessary changes for that"
> i.e. demo phase = clickable UI on mock data; architecture must make it easy to wire real interactivity/back-end later.

# SPEC — Post-Service Feedback (PSF) System

**Client:** Chandra Honda (two-wheeler dealership — scooters & motorcycles)
**Status:** Demo build
**Last updated:** 2026-11-21

---

## 1. Overview

After a vehicle is serviced and delivered, customer support generates a unique feedback link from the job card and sends it to the customer on WhatsApp. The customer fills a short mobile-first form (14 base questions + conditional follow-ups + a callback question). Responses go to a database that only the admin can see. The admin gets an analytics dashboard, an alerts queue for unhappy customers, and an audit log of every change.

### Pipeline

```
Support portal ──► Mock DMS lookup ──► Generate link ──► WhatsApp (wa.me)
                                                              │
                                                              ▼
Admin dashboard ◄── Alerts engine ◄── Postgres ◄── Customer form (no login)
```

1. Support enters a **job card number** → details autofill from the (mock) DMS.
2. System creates a **service visit** and a **single-use link** (expires in 7 days).
3. Support taps **Send on WhatsApp** → opens `wa.me/<phone>?text=<message + link>`.
4. Customer opens the link, answers the form, submits.
5. Response is stored; **alert rules** run; admin sees analytics + alerts.

---

## 2. Goals & non-goals

**Goals (demo)**
- Replace the paper/Excel PSF questionnaire with a digital form.
- Keep feedback data hidden from support staff.
- Give the admin actionable analytics and a callback/complaint queue.
- Deployable on Vercel, usable on phone first, laptop second.

**Non-goals (demo)**
- Real DMS integration (mocked behind one interface).
- WhatsApp Business API automation (manual `wa.me` first).
- Multi-dealership / multi-tenant support.
- Customer accounts or login.

---

## 3. Users & roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| **Customer** | Vehicle owner | Open own link, submit form once | See anything else |
| **Support** | Customer support staff (many accounts) | Log in, look up job card, generate link, send via WhatsApp, see link **status** (Created / Opened / Completed / Expired) | See any answers, ratings, comments or analytics |
| **Admin** | One main admin | Everything: analytics, responses, alerts, edit data, manage support users, view audit log | — |

**Rules**
- Role checks are enforced **in the API/server layer**, not only by hiding UI.
- Any **edit or delete** of feedback data requires the admin to **re-enter their password** (step-up confirmation), and is written to the audit log with old and new values.
- Passwords hashed with **argon2id** (or bcrypt). Sessions via Auth.js.

---

## 4. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) — frontend + API routes / server actions |
| Database | PostgreSQL on **Neon** (via Vercel Marketplace) |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Auth | Auth.js (credentials provider), role in session |
| UI | Tailwind CSS + shadcn/ui, mobile-first |
| Charts | Recharts |
| Validation | Zod (shared between client and server) |
| Hosting | Vercel |

---

## 5. Feedback link lifecycle

- Token: 32 random bytes, base64url. **Only a SHA-256 hash of the token is stored**; the raw token exists only in the link.
- URL: `https://<domain>/f/<token>`
- Expiry: **7 days** from creation.
- Single use: once submitted, the link shows a "Thank you — already submitted" page.
- Status transitions: `created → opened → completed`, or `created/opened → expired`.
- Support can **regenerate** a link for the same visit (old token invalidated).
- WhatsApp message template (editable by admin later):
  > Hi {name}, thank you for servicing your {model} ({reg_no}) at Chandra Honda. Please share your feedback (2 mins): {link}

---

## 6. Questionnaire

All ratings are **1–5**. Base questions are **always shown**. Follow-ups appear **only when their trigger matches**. Follow-ups use **broad category chips + optional "Tell us more" text**.

### 6.1 Base questions

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
| Q11 | Pricing & Value for Money | Were the service charges affordable? | rating_5 *(changed from 1–10)* | Yes |
| Q12 | Overall Satisfaction & Loyalty | Were you satisfied with the overall service experience? | rating_5 | Yes |
| Q13 | Overall Satisfaction & Loyalty | Would you recommend Chandra Honda to your friends and family? | yes_no | Yes |
| Q14 | Overall Satisfaction & Loyalty | Do you have any additional feedback or suggestions? | text | No |
| Q15 | Overall Satisfaction & Loyalty | Would you like someone from our service team to call you? | yes_no | Yes (always last) |

### 6.2 Conditional follow-ups

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

- Category chips are required when the follow-up is shown; the text box is always optional.
- If the customer changes a parent answer so the trigger no longer matches, the follow-up is hidden and its answer is discarded on submit.
- Triggers and thresholds live in the `questions` config (`show_if`), not in code.

### 6.3 Form UX

- **Step flow, one category per screen:** Welcome → 5 category steps → Callback (Q15) → Thank you. Progress bar at the top ("Step 2 of 6").
- **Welcome screen** personalised: "Hi {name}, how was your {model}'s service on {date}?" plus "Takes about 2 minutes".
- **Rating 1–5 as faces** (very unhappy → very happy) with a text label under the selected one; Yes/No as large chip buttons.
- **Follow-ups slide open** under their parent with a short animation, not a page jump.
- Next is enabled only when the step is complete; Back keeps answers.
- Large tap targets (≥ 48 px), thumb-reachable sticky Next button at the bottom on mobile.
- **Thank-you screen** with a short success animation; if Q15 = Yes, it says "Our team will call you soon".
- Draft answers kept in browser storage (best effort) so a refresh doesn't lose them.
- Works on a 360 px wide phone; centred card (max ~560 px) on laptop.

---

## 7. Alerts (callback queue)

**An alert is created on submit when either is true:**
- Any rating (Q1, Q6, Q11, Q12) **= 1**
- **Q15 = Yes** (callback requested)

> Q3 = Yes alone does **not** raise an alert (the customer can request help via Q15).

- One alert per response, with all matching reasons listed (e.g. "Callback requested · Q12 rated 1").
- Status: **Open → Contacted → Resolved**, with a notes field.
- Admin dashboard shows an unread-count badge and an Alerts page (newest first, filter by status).
- Every status change and note is written to the audit log.
- Later: notify admin by email/WhatsApp when an alert is created.

---

## 8. Data model (PostgreSQL)

```
branches        (id, name, city)
advisors        (id, branch_id, name, active)
users           (id, name, email, password_hash, role: 'support'|'admin', active, created_at)

mock_dms        (job_card_no PK, reg_no, customer_name, customer_phone, model,
                 vehicle_type: 'scooter'|'motorcycle', service_type, service_date,
                 delivery_date, advisor_id, branch_id, reported_complaints text[])

vehicles        (id, reg_no UNIQUE, model, vehicle_type)
service_visits  (id, job_card_no UNIQUE, vehicle_id, customer_name, customer_phone,
                 advisor_id, branch_id, service_date, delivery_date,
                 token_hash, status: 'created'|'opened'|'completed'|'expired',
                 expires_at, created_by → users, created_at, opened_at, completed_at)

questions       (id, code, version, category, text, type, options jsonb,
                 parent_id → questions NULL, show_if jsonb NULL,
                 sort_order, required, active)
responses       (id, visit_id UNIQUE → service_visits, questions_version,
                 submitted_at, user_agent)
answers         (id, response_id, question_id,
                 value_num int NULL, value_text text NULL, value_options text[] NULL)

alerts          (id, response_id, reasons text[], status: 'open'|'contacted'|'resolved',
                 notes text, created_at, updated_at, updated_by → users)
audit_log       (id, actor_id → users, action, entity, entity_id,
                 old_value jsonb, new_value jsonb, created_at)
```

**Notes**
- **Questions are versioned.** Editing wording creates a new version; old answers keep pointing at the old version.
- `show_if` example: `{"op": "lte", "value": 3}` or `{"op": "in", "value": ["Partially", "No"]}`.
- Answer value columns by type: ratings → `value_num`; yes/no, yes/partial/no, single_select → `value_text`; multi_select → `value_options` (+ `value_text` for "Tell us more"); text → `value_text`.
- `audit_log` is append-only (no update/delete from the app).
- Indexes: `service_visits(status, created_at)`, `service_visits(advisor_id)`, `answers(question_id)`, `alerts(status)`.

### Mock DMS interface

```ts
getJobCard(jobCardNo: string): Promise<JobCard | null>
```
Reads from `mock_dms` in the demo. Swapping to the real DMS changes only this function.

---

## 9. Screens

### Customer
- `/f/[token]` — feedback form
- Thank-you page; Expired-link page; Already-submitted page

### Support (login required)
- `/support` — list of visits they created: customer, reg. no, date, **status only**, Resend/Regenerate
- `/support/new` — enter job card no → autofilled details → Generate link → **Send on WhatsApp** / Copy link

### Admin (login required)
- `/admin` — **Overview** (analytics)
- `/admin/alerts` — alerts queue
- `/admin/responses` — all responses table → detail view (edit with password re-entry)
- `/admin/audit` — audit log
- `/admin/users` — create/deactivate support users

---

## 10. Analytics (Admin Overview)

**Filter bar** (applies to Overview and Responses): date range · vehicle type · model · advisor.
Layout: single column on mobile, 2–3 column grid on laptop.

| # | Block | Shows | Chart |
|---|---|---|---|
| 1 | **KPI tiles** | Responses received · Response rate · Avg overall satisfaction (Q12) · Recommend rate (Q13 % Yes) · Open alerts — each with change vs previous period | Number tiles |
| 2 | **Category scores** | Score /100 for each of the 5 categories | Horizontal bar |
| 3 | **Trend** | Avg Q12 and recommend rate per week/month | Line |
| 4 | **Advisor performance** | Per advisor: responses, avg Q6, % Q4 Yes, % Q7 Yes, avg Q12 | Sortable table |
| 5 | **Problem breakdown** | Counts per follow-up category (Q1a, Q3a, Q6a, Q9a, Q11a; Q7a lateness split) | Bar, with a selector for which follow-up |
| 6 | **Question-level detail** | Yes/No (Yes/Partially/No) split for Q2–Q5, Q7–Q10, Q13, Q15 | Small stacked bars |
| 7 | **Recent comments** | Latest Q14 + follow-up text, with Q12 rating beside each | List |

### Metric definitions

- **Response rate** = completed visits ÷ visits created in the period (expired counted as not responded).
- **Rating → score**: `(rating − 1) ÷ 4 × 100`.
- **Yes/No → score**: Yes = 100, No = 0. **Q3 is reversed** (No issues = 100). **Q2**: Yes = 100, Partially = 50, No = 0.
- **Category score** = mean of its question scores (Q14, Q15 excluded).
- **Recommend rate** = % of Q13 = Yes.
- "Change vs previous period" compares with the same-length period immediately before.

---

## 11. Seed data (demo)

Source: `Honda_PSF_Survey_30_Dummy_Customer_Responses.xlsx` (30 fictional responses, Q1–Q14).

- **Q11 conversion** 1–10 → 1–5 via `ceil(x / 2)`.
- **Follow-ups generated** for rows with negative answers, using the Q14 text where it hints at the cause (e.g. "delivery was slightly delayed" → Q7a "1 day late").
- **Q15** = No by default; set to Yes on a few unhappy rows (e.g. CUST-006, CUST-014, CUST-022).
- **Extra rows:** 2–3 responses containing a rating of 1 so the alerts panel has data.
- **Metadata generated** into `mock_dms` / `service_visits`: 4 advisors, 1 branch, service dates spread over the last 3 months, models (Activa, Dio, Shine, SP125, Unicorn) with correct scooter/motorcycle type.
- **~10 unanswered visits** (some expired) so response rate isn't 100%.
- Users: 1 admin, 2 support accounts (demo credentials in `.env.example`, not in code).

---

## 12. UI & visual design

**Goal:** professional and trustworthy for staff, friendly and quick for customers.

**Visual system**
- **Colour:** neutral base (white / slate greys) with one accent colour, the dealership's red, used only for primary buttons, progress and highlights. Green / amber / red reserved for status (good / warning / alert).
- **Type:** one clean sans-serif (e.g. Inter or Geist); clear size scale for headings, body, captions.
- **Shape & depth:** rounded cards (12–16 px radius), soft shadows, generous spacing.
- **Icons:** one consistent line-icon set (lucide, bundled with shadcn/ui).
- **Light mode** for the demo; tokens set up so dark mode can be added later.

**Customer form (engagement)**
- Step flow with progress bar, face ratings and chip answers (see §6.3).
- Micro-interactions: tap feedback on chips, smooth step transitions, follow-ups sliding in.
- Friendly, short copy; no jargon; vehicle and customer name shown throughout.
- Success animation on submit.

**Support portal**
- Simple, fast: one big "New feedback link" button, job-card search, status shown as coloured badges (Created · Opened · Completed · Expired).
- One-tap "Send on WhatsApp" with the WhatsApp icon and colour.

**Admin dashboard**
- Card-based grid: KPI tiles on top, charts below; same chart colours for the same meaning everywhere.
- KPI tiles show the value large, the change vs previous period as a small green/red arrow.
- Alerts badge in the nav; alert rows coloured by status.
- Skeleton loaders while data loads; friendly empty states ("No alerts — all customers happy").
- Mobile: bottom tab bar (Overview · Alerts · Responses · More); laptop: left sidebar.

**Quality bar**
- Consistent spacing and components from shadcn/ui only; no one-off styles.
- Every screen checked at 360 px and 1440 px widths before it is called done.

---

## 13. Non-functional requirements

- **Security:** server-side role checks on every route/action; hashed tokens; rate-limit form submit and login; CSRF protection via Auth.js; no feedback data in URLs or logs.
- **Privacy:** customer phone numbers visible only to support (for sending) and admin.
- **Performance:** form loads in < 2 s on 4G; dashboard queries < 1 s on demo data.
- **Accessibility:** labels on all inputs, sufficient contrast, keyboard-usable on laptop.
- **Time zone:** store UTC, display IST.

---

## 14. Acceptance criteria (demo)

1. Support enters a seeded job card number and sees vehicle/customer details autofilled.
2. Generating a link produces a working `/f/<token>` URL and a WhatsApp button with the prefilled message.
3. Opening the link changes the visit status to **Opened**; submitting changes it to **Completed**.
4. Follow-ups appear and disappear correctly for every trigger in §6.2.
5. A submitted link cannot be submitted again; a link past 7 days shows the expired page.
6. A support user calling any response/analytics API gets **403**.
7. A submission with any rating = 1 or Q15 = Yes creates an alert visible on the admin dashboard.
8. Admin can move an alert Open → Contacted → Resolved; each change appears in the audit log.
9. Editing a response requires password re-entry and is logged with old and new values.
10. All 7 analytics blocks render with the seed data and respond to every filter.
11. Form is fully usable on a 360 px wide screen and on a laptop.

---

## 15. Build order

1. Project setup, Neon DB, Drizzle schema + migrations
2. Seed script (xlsx import + generated metadata)
3. Auth + roles (support/admin)
4. Customer form with conditional logic
5. Support portal (job card lookup, link generation, WhatsApp button, status list)
6. Alerts engine + admin alerts page + audit log
7. Admin analytics dashboard + filters
8. Responses table/detail with audited edits
9. Deploy to Vercel

---

## 16. Later (post-demo)

- WhatsApp Business API sending (Meta verification + approved templates) and automatic reminders for unopened links.
- Real DMS integration behind `getJobCard`.
- Admin email/WhatsApp notification on new alerts.
- Admin UI for editing questions/thresholds.
- Tamil language option for the form.
- Export responses to CSV/Excel.
