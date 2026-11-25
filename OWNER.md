# Chandra PSF: for the owner

> One screen, plain words, no code. Updated at handover from what was built and tested.

**What it does:** After a service, support staff type in the job card and send the customer a WhatsApp link. The customer answers a short form on their phone. Admins see the results, alerts for unhappy or callback customers, an audit log and the staff accounts.

**Roles:**
- **Main admin** (head office): all branches, staff accounts, and customer privacy requests.
- **Branch admin:** everything for their own branch, including its support staff.
- **Support:** creates job cards and links for their branch. No admin screens.
- **Branches and advisors** are added in the app. Advisors are the people named on job cards; they do not sign in.

**Passwords:** An admin resets a forgotten password under Users, then gives the temporary password in person or through your password manager. Nobody resets their own. Too many wrong passwords lock an account for 15 minutes; an admin reset clears the lock. The app sends no reset emails.

**Privacy requests (main admin only):** Customers screen. Search by mobile number or registration number, tick the records, then Download or Erase personal data (it asks for your password). Erasing cannot be undone. Answers are kept 3 years; unanswered links are removed after 90 days by a daily clean-up.

**How to start it:** Open the app's web address in any browser. To run a copy on your own computer, ask the developer; the start command is `pnpm dev`.

**Before the demo (manual check, on the test site only):** Do this on the test (preview) site the developer gives you, never on the real (production) site. Sign in as support, make a link, open it on a real phone, and submit with "Yes" to the callback question. The support screen should show Opened, then Completed, without a reload, and the branch admin should see the alert.

**Before the first real customer link (go-live gate):** Work through the owner checklist in `docs/PRODUCTION.md`, then tell the developer. The developer runs the final go-live check (`pnpm golive:check`), which must pass; you do not run it yourself. Until it passes, the real site holds no customer data at all: all testing and practice data stays on the test site.

**What it can't do (yet):** Send WhatsApp messages itself (support opens WhatsApp with the message). Send emails. Work offline. The company name and contact details stay placeholders until they are set on Vercel.

**What could lose your data:**
- An erasure is final.
- Deleted responses stay in "Recently deleted" for 30 days, then they are gone.
- Until the paid plans are set up, backups keep only about 6 hours of history. Paid plans give 7 days.
- See `docs/SPEC.md` §13 and `docs/PRODUCTION.md` for the full rules.

**If something goes wrong:** Reload the page and try again. If it still fails, note what you were doing and the message on screen, then ask for a fix with `/setup-project fix <what happened>`. If no admin can sign in, ask the developer; never send a password in chat.

**What it costs to run:** Nothing while it is tested on free plans. Real customers need Vercel Pro and a paid Neon database, about US$20–45 a month in total (SPEC §9 estimate). No other paid services.
