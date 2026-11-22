# Usage scenarios — PSF demo (phase 1)

> Written by the Product Critic against `docs/SPEC.md`. Each scenario walks the spec's own flows.
> `handled` cites the US/F id that covers it; `GAP` names what is missing (G-ids match the critic report).
> Judged against phase 1 (mock data in browser storage, simulated sign-in, public demo). Items the spec marks Later are not gaps.

## S-01 · Happy path at the delivery desk
**Kavitha (Support 1)**, laptop at the desk, 21 Nov 2026 11:40. Ramesh Kumar collects his Activa 6G. She signs in with "Sign in as Support 1", taps "New feedback link", types `JC-24-1042`, sees Ramesh Kumar · +91 98400 12345 · TN 09 BX 4521 · Activa 6G · Advisor Suresh, taps Generate, then Send on WhatsApp (WhatsApp Web opens with the template) and also Copy link.
**Result: handled** (US-01, US-02, US-03, US-04, F-2 steps 1–5; §5 examples).

## S-02 · Job card typed the way people type
**Kavitha** is in a hurry and types ` jc-24-1042` (leading space, lower case), then on the next customer `JC241077` (no dashes, as printed on some carbon copies).
**Result: GAP (G-4, medium).** The spec only defines exact seeded numbers vs "Job card not found". It does not say whether case, spaces or missing dashes are tolerated, so a real job card may show "not found" and she retypes until it matches.

## S-03 · Job card with an unusable phone number
**Arun (Support 2)** enters `JC-24-1077`: the DMS record has the landline `044 2434 5678`; another, `JC-24-1081`, has no phone at all and the name "M. Lakshmi (Ms)".
**Result: GAP (G-5, medium).** F-2 always offers "Send on WhatsApp" to `wa.me/<phone>`. With a landline or blank phone WhatsApp opens an invalid chat or an error, and there is no stated behaviour (correct the number, disable the button, or copy only). Copy link (US-04) is the only workaround.

## S-04 · Unhappy customer, changes their mind, refreshes
**Ramesh** opens the link on his Android phone (360 px). Step 1: Q1 = 2 → Q1a opens, picks "Same problem came back". Step 3: Q7 = No → Q7a "1 day late", then changes Q7 to Yes → Q7a hides. On step 4 the phone locks and Chrome reloads the page; his answers come back. Step 5: Q12 = 1, Q14 "Brake noise still there". Q15 = Yes, Submit.
**Result: handled** (US-07–US-11, F-3 triggers table, §5 "Q12 = 1, Q15 = Yes"; alert per US-12 / F-4 with reasons "Callback requested · Q12 rated 1").

## S-05 · Late link, and a regenerate while the customer is mid-form
**Priya S.** opens her link 9 days after it was sent → Expired page. She calls; **Arun** looks up her job card, sees the existing link (Expired), taps Regenerate, then Resend. Separately, **Kavitha** regenerates `JC-24-1063` because the customer said "I lost it", while that customer had actually found the old link and is on step 3.
**Result: partly handled.** Expiry, regenerate and resend are handled (US-06, US-11, F-2 edge "link already exists"). **GAP (G-11, low):** the customer on the old link loses their in-progress answers at the Expired page; the spec doesn't say whether that page tells them a newer link was sent.

## S-06 · Presenter with two tabs open
**Vikram** (presenting to the client) keeps `/admin` open in tab A. In tab B (opened from WhatsApp Web) he completes the customer form with Q15 = Yes. He goes back to tab A (the badge still shows the old count) and moves an older alert Open → Contacted. Then he refreshes.
**Result: GAP (G-2, high).** The spec has one browser copy of the data but never says how two open tabs of the same browser behave. If tab A doesn't see tab B's submission, its next save can overwrite it: the new response and alert disappear (data loss), in the exact flow the Definition of Done demonstrates ("support list shows Opened then Completed").

## S-07 · The demo opened two months later, after several run-throughs
**Mr. Chandrasekar** (client) opens the public link on 25 Jan 2027 to show a colleague. Overview defaults to "last 30 days". He then signs in as Support 1 to create a fresh link, as he saw in the first demo.
**Result: GAP (G-1, high; G-10, medium).** Seed service dates are fixed to late Aug – 21 Nov 2026 (§6). By January the default range holds no responses: every KPI, trend and advisor block is empty or zero, every seeded unanswered visit is Expired, and the KPI arrows compare nothing with nothing. The main admin demo is blocked unless the viewer knows to change the date range (G-1). The spec also never says how many seeded job cards have **no** visit yet; if every seeded job card already has a visit, "Generate link" always lands on "link already exists" or "Feedback already received", and the first DoD item can't be shown fresh (G-10).

## S-08 · Admin corrects a response that raised an alert
**Meena (Admin)** calls Selvam (alert "Q12 rated 1"). He says he tapped the wrong face and meant 4. She edits Q12 1 → 4 with her password. Next, customer Farida (Q15 = No) phones to say she does want a call; Meena edits Q15 No → Yes.
**Result: GAP (G-3, high).** F-6 says edits follow the form's follow-up rules and are audited, but not whether alerts are re-evaluated. Selvam's alert keeps saying "Q12 rated 1" (a wrong result in the queue and the Open-alerts KPI), and Farida's callback request creates no alert, so nobody calls her.

## S-09 · Deleting a test response, then restoring it
**Meena** deletes CUST-031 (a staff test entry) and checks Overview: Responses received drops 33 → 32. The response rate updates too (D-17): a deleted response no longer counts as completed. She then restores it.
**Result: handled.** Delete → Recently deleted → Restore with its alert is handled (US-21, F-6 steps 3–4, §5 example). **G-7 (medium) resolved by D-17:** response rate counts a visit as completed only while it has a live response, so the rate and Responses received agree again. The visit itself stays Completed (F-6 assumption).

## S-10 · A filter that matches nothing
**Meena** filters Overview: advisor "Karthik", model "Unicorn", last 7 days → 0 responses; the previous 7 days also have 0.
**Result: GAP (G-6, medium).** The spec gives an empty state only for alerts and Recently deleted. For zero matches it doesn't say what Avg Q12, Recommend rate, category scores, the change arrows (0 vs 0, or 4.2 vs nothing) or the advisor table show, so the admin may see "0", "NaN" or "+∞%" and misread it as a real score.

## S-11 · Month-end report across a boundary
**Meena** sets 1 Nov – 30 Nov 2026. Visit `JC-24-1099`: serviced 28 Nov, link created 29 Nov, customer submitted 2 Dec. Another: serviced 30 Oct, link created 31 Oct, submitted 3 Nov.
**Result: GAP (G-8, medium).** Response rate is defined on visits created in the period, but "Responses received", the trend, advisor table, comments and the Responses table don't say which date the filter uses (service date, link created, or submitted). Different blocks could count these two responses in different months, and the monthly numbers won't add up.

## S-12 · Client completes the form on their own phone, then looks as admin
**Mr. Chandrasekar** receives a link on his iPhone from Vikram's laptop and completes it with Q6 = 1 and Q15 = Yes (DoD item 8). Then on the same phone he taps "Sign in as Admin" to see the alert. Next day he clears Safari history.
**Result: partly handled.** Cross-device visibility (laptop keeps showing Created) is the owner's accepted limitation (F-3 "Demo across devices", §13); clearing data returns to seed (§13, F-8). **GAP (G-12, low):** the spec doesn't say whether the phone's own admin then shows his response and alert (the visit didn't exist in the phone's copy before), nor whether a link regenerated on the laptop still works on the phone.

## S-13 · Weak signal and a long comment
**Lakshmi** answers on a bus on patchy 3G and pastes a 2,400-character comment in Q14, mixing English, Tamil script and emoji. As she taps Submit the signal drops.
**Result: GAP (G-9, medium; G-13, low).** Phase 1 never fails (local storage), but the data-access layer is meant to let Phase 2 swap in a server without changing screens (§0, §10). The spec defines no "couldn't send, your answers are kept, try again" state or saving state for submit or for staff writes, so Phase 2 would need screen changes, contrary to the design rule (G-9). There is also no stated length limit or display rule for very long comments in Recent comments and the response detail (G-13).

## S-14 · Link sent to the wrong customer
**Kavitha** types `JC-24-1024` instead of `JC-24-1042`, doesn't notice the name on the autofill card, and sends a link for Anitha's visit (serviced last month) to Anitha by mistake while Ramesh gets nothing.
**Result: GAP (G-14, low).** Resending to the right customer is handled (she enters the right job card, S-01). But there is no way to cancel or void the wrong link; Regenerate only creates another live one, and the stray visit counts against the response rate forever.

## S-15 · Staff turnover
**Meena** adds "Deepa R." (`deepa@chandrahonda.demo`, temp password `Welcome@1`), tries to add `support1@chandrahonda.demo` again ("Email already in use"), and deactivates Support 2 who is mid-shift. Deepa signs in.
**Result: handled** (US-20, F-7, F-1 "Account disabled"). **GAP (G-15, low):** "temporary password" implies Deepa is asked to set her own on first sign-in, but no flow says so.
