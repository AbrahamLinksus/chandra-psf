# Chandra PSF: for the owner

> One screen, plain words, no code. Written at handover from what was built and tested.

**What it does:** After a service, support staff send each customer a WhatsApp link. The customer answers a short form on their phone, and the admin team sees the results, alerts for unhappy or callback customers, an audit log and the user accounts. It is a demo on sample data.

**How to start it:** Open https://chandra-psf.vercel.app on any phone or computer, no setup needed. To run a copy on your own computer, ask whoever set it up; the start command is `pnpm dev`, then open http://localhost:8000.

**What it can't do (yet):**
- It does not send WhatsApp messages. Support opens WhatsApp with the message, or copies the link.
- It does not sync between devices. Each phone and computer keeps its own copy.
- It does not hold real customer data. Use sample data only.
- It is not secure enough for real use: passwords and sign-in checks run in the browser.
- The dealership phone number shown to customers is a placeholder until the real number is set.

**What could lose your data:**
- **Reset demo data** on the sign-in screen puts back the sample data and removes everything entered since.
- Clearing the browser's site data (in its privacy or history settings) deletes everything entered in that browser.
- There is no backup. Data made on one phone or computer is not on any other.

**If something goes wrong:** Reload the page and try again. If it still fails, write down what you were doing and the message on screen, then ask for a fix with `/setup-project fix <what happened>`.

**What it costs to run:** Nothing extra. It is hosted on Vercel's free tier. There are no other paid services and no keys to buy.
