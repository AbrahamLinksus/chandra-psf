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

---

# Usage scenarios — production (phase 2, CR-1)

> Written by the Product Critic against the CR-1 `docs/SPEC.md` plus the owner's answers of 2026-11-22 (free tiers first with a paid upgrade as go-live gate; password reset by email link AND admin temporary password; personal data kept 3 years; `vercel.app` address; demo taken down at launch).
> Phase-1 scenarios S-01…S-15 above keep their ids (the SPEC cites them). G-ids below refer to `.results/CR-1/critique-product-critic.md`, not to the phase-1 gaps.

## S-16 · Launch day: first admin from nothing
**Vikram (maintainer)** runs setup on 1 Dec 2026 and creates `owner@chandrahonda.in` with one-time password `Tmp-7Kq2-91`, which he sends to the owner on WhatsApp. The owner is travelling and signs in only on 19 Dec. Meanwhile Vikram, testing a script, runs the setup command a second time.
**Result: partly handled** (US-23, F-9: forced "Set your password", "Add your first branch"). **GAP (G-14, medium):** the one-time password never expires, so a password sitting in a chat for 18 days opens the only all-branches account; nothing says the setup command refuses to run once an admin exists, so a second run could create or overwrite a main admin outside the app; the maintainer "recovery command" is a standing back door now that email reset exists.

## S-17 · Resend a link from yesterday
**Priya (support, Velachery)** generated a link for Ramesh Kumar (`JC-24-1042`) on 21 Nov. On 22 Nov Ramesh says "I deleted the message". Priya opens `/support`, taps "Resend" on his row; later Kavitha looks up `JC-24-1042` on `/support/new`, which should "show the existing link with its status", and taps "Copy link".
**Result: GAP (G-1, high).** The server keeps only a hash of the link (US-03, D-11), so it cannot rebuild the link for Resend (US-06) or show/copy the existing link (F-2 step 2). As written, Resend and Copy on any later screen cannot work.

## S-18 · Forgotten password, and someone probing
**Deepa (support, Tambaram)** forgets her password on a Sunday when her branch admin is off. She taps "Forgot password", types `deepa.r@gmail.com`, gets an email on her phone and opens it 3 hours later. The same evening someone types 40 different `…@chandrahonda.in` addresses into the form to see which ones exist, and requests 200 resets for `owner@chandrahonda.in`.
**Result: GAP (G-2, high; G-3, high).** The owner chose email reset + admin reset (Q3 = both), but the SPEC still says "no reset link" (F-1), "Email / SMS: none" (§8) and lists reset emails as a non-goal (§11). Nothing defines link lifetime, single use, the message shown for unknown emails, request limits, what happens to sessions and lockout after a reset, or which sending address the email comes from (there is no owned domain: the app lives on `vercel.app`). Support staff may not have a work inbox at all.

## S-19 · Support moved to another branch with links still open
**Arun (support)** is moved from Velachery to Tambaram on 25 Nov; he has 12 Velachery links in Created/Opened. On 26 Nov a Velachery customer calls: "the link expired, send it again". Kavitha (Velachery support) opens `/support`; Arun opens his `/support` at Tambaram.
**Result: GAP (G-8, medium).** US-06/role rules say support acts only on "their own links", and support only sees their branch: Arun can no longer reach them and Kavitha doesn't see them in "My links" (though F-2 lookup implies she could Regenerate). The same happens when Arun is deactivated. Whether Arun's `/support` still lists the 12 Velachery visits (a cross-branch leak) is not stated.

## S-20 · Promotion and a typo in an email
**Meena (branch admin, Velachery)** is promoted to main admin in January. When she was added, the owner typed `meena@chandrahnda.in`.
**Result: GAP (G-9, medium).** US-20/F-7 allow add, change branch (support only), deactivate, reset, but no change of role, name or email. Workaround is a new account, but email must be unique, so the corrected address may work while the old account keeps the wrong one, and her history is split across two accounts; email reset (Q3) never reaches the misspelt address.

## S-21 · A customer of two branches asks to be deleted
**Ramesh Kumar (98400 12345)** serviced at Velachery in 2025 and Tambaram in 2026. He calls the number in the notice and asks to delete his data. The Tambaram branch admin searches `/admin/customers`, finds 1 job card, taps "Erase personal data". His brother shares the same mobile and has a Shine on a separate job card at Tambaram.
**Result: GAP (G-4, high).** US-30 search and erase are limited to the admin's branch, so the Velachery record survives while Ramesh is told he's erased (a wrong result under the DPDP promise). Erase acts on everything the search found, so the brother's job card and answers are erased too, with no way to choose rows.

## S-22 · Saturday rush on one network
**Velachery** runs a free-service camp: 45 customers between 10:00 and 11:00 fill the form on the showroom Wi-Fi while waiting; others are on Jio mobile data, which shares one public address among many subscribers.
**Result: GAP (G-7, medium).** F-3's per-network-address limit (e.g. 20 submits/hour) blocks the 21st customer with "Too many requests" in the dealership's busiest hour, and mobile carriers can trigger it for unrelated customers.

## S-23 · Ten branches leave the dashboard open overnight
**Ten branch admins and 20 support laptops** leave `/admin` and `/support` open in a tab when they go home; the 30-second refresh keeps running all night, every day, while the system is on the free database plan before go-live (and on the paid plan afterwards).
**Result: GAP (G-6, high).** "Pick up changes within 30 s" (§4 Rules) means the database never sleeps; on the free plan the monthly compute allowance runs out and the database stops answering for staff and customers until next month; on the paid plan the bill grows with idle tabs.

## S-24 · Restore after a bad day
On 10 Mar 2027 at 16:00 a faulty release corrupts alert statuses. **Vikram** restores the database to 09:00. Between 09:00 and 16:00, 60 customers submitted feedback and the Velachery admin erased one customer's data on request.
**Result: GAP (G-5, high).** US-32 promises restore to any moment but no rule says what happens to the 7 hours of later data (60 responses lost) or that the erasure is silently undone (the erasure's audit entry is rolled back too, so nobody knows to re-apply it).

## S-25 · Going live
**The owner** finishes testing on the free tiers on 15 Dec and tells staff to start sending links to real customers on 16 Dec, but the paid plan upgrade is still pending card approval.
**Result: GAP (G-11, medium).** The owner's answer makes the upgrade a go-live gate, but the Definition of done has no gate item; on the free database the restore window is hours, not the 7 days of US-32, and the rehearsal can't prove the promised window. Nothing stops real data from arriving before the gate.

## S-26 · A customer reads the privacy notice
**Lakshmi** opens her link, reads "We keep them for 2 years. To see or delete your data, call {dealer phone}", and taps "How we use your answers".
**Result: GAP (G-12, medium).** The owner chose 3 years, so the notice, US-31, §6 and the §9 latency target ("2 years of data") are wrong. The notice doesn't name the legal entity responsible (data fiduciary) or which phone of several branches to call, and doesn't say data is stored by hosting providers that may be outside India.

## S-27 · Locked out on purpose, and a shared desk laptop
**A former employee** types `owner@chandrahonda.in` with wrong passwords 5 times every 15 minutes from a script. At Velachery, **Priya** and **Kavitha** share one desk laptop; Priya leaves for lunch without signing out and Kavitha generates 6 links.
**Result: GAP (G-13, medium).** The per-email lockout (US-01) lets anyone keep the main admin locked out indefinitely, and nothing says whether an email reset or admin reset clears a lockout. The 12 h idle session means Kavitha's links are recorded as Priya's; no rule covers shared devices.

## S-28 · The demo after launch
**Kavitha** has `chandra-psf.vercel.app` bookmarked from training and still has the demo's data in her browser. At launch the demo is taken down.
**Result: GAP (G-10, medium).** The SPEC still says the demo stays online (§0, §0.1, DoD last item). It doesn't say which `vercel.app` address production uses; if it reuses the demo address, old demo data and sessions left in staff browsers meet the production app; if not, the old link's behaviour (moved page or error) is undefined, and new staff have nowhere to practise. When a custom domain arrives later, links already sent on `vercel.app` must keep working for 7 days.

## S-29 · Submit on a weak signal
**Selvam** taps Submit with Q15 = Yes on patchy 4G; the request reaches the server and is stored, but the reply is lost; he sees "Couldn't save, try again", taps again.
**Result: GAP (G-15, low).** The retry hits the single-submit rule and he sees "Thank you — already submitted" instead of the thank-you with "Our team will call you soon", so he isn't sure his callback request counted. The same happens to support saving a New job card ("JC-… already exists at this branch").

## S-30 · Comparing branches and a cross-branch callback
**The owner (main admin)** filters Overview to "All branches" (Velachery 40 visits/30 completed, Tambaram 10/5) and then "Tambaram". A Tambaram customer requests a callback while the Tambaram admin is on leave; the owner moves the alert to Contacted while the Velachery admin tries to open it by URL.
**Result: handled** (US-16, F-5 example 75 % / 70 % / 50 %; US-12 alert belongs to the visit's branch and shows to main admins; US-13 concurrent change; US-29 "Not found" for another branch).
