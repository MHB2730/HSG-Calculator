# Going live — HSG Property (plain-English guide)

You're putting a folder of files online so the app lives at **https://app.hsgattorneys.co.za**.
People open that address on their phone, use the calculators, and tap **"Get a formal quote"** —
which emails the enquiry to **legal@hsginc.co.za**.

### Already wired in for you
- Phone **+27 21 271 0900**, email **legal@hsginc.co.za**, website link — all filled in.
- Quote emails handled by **`submit.php`** (sends from your own domain — no sign-up or key needed).
- Spam honeypot, POPIA consent, offline support, add-to-home-screen, light/dark mode.

---

## Step 1 — Create the subdomain (once)
cPanel → **Domains** (or **Subdomains**):
- Subdomain: `app`  ·  Domain: `hsgattorneys.co.za`
- Note the **Document Root** folder it creates (e.g. `/home/USER/app.hsgattorneys.co.za`).

(If your DNS is hosted elsewhere, add a record so `app` points to this server.)

## Step 2 — Upload the files
cPanel → **File Manager** → open that subdomain folder → upload everything from
`C:\Users\bremn\dev\hsg-property` **except** `node_modules/`, `scripts/`, `package.json`,
`README.md`, `DESIGN-BRIEF.md`.

**Must be uploaded** (keep the folder structure):
```
index.html   manifest.webmanifest   sw.js   submit.php
css/         js/        assets/      icons/
```
Tip: zip the project, upload the zip, then **Extract** in File Manager.

## Step 3 — Turn on HTTPS (required)
cPanel → **SSL/TLS Status** → run **AutoSSL** for the subdomain. The app must load over
`https://` for install + offline to work.

## Step 4 — Test on your phone (5 minutes)
1. Open `https://app.hsgattorneys.co.za`.
2. Type a purchase price (e.g. `2 000 000`) → the breakdown should appear.
3. Tap **Get a formal quote**, fill it in, tick consent, **Send**.
4. Confirm **legal@hsginc.co.za** received the enquiry.
5. Browser menu → **Add to Home Screen** → it installs with the HSG icon.
6. Turn off wifi/data → reopen → the calculators still work (offline).

## If the quote email doesn't arrive
- Check the spam/junk folder first.
- Emails are sent **From** `noreply@hsgattorneys.co.za`. Some hosts require that to be a **real**
  mailbox. Fix: in cPanel → **Email Accounts**, create `noreply@hsgattorneys.co.za`, **or** open
  `submit.php` and set `$FROM` to an address that already exists on your domain
  (e.g. `info@hsgattorneys.co.za`). Leave `$TO` as `legal@hsginc.co.za`.
- No-PHP alternative: sign up free at **web3forms.com** with `legal@hsginc.co.za`, copy the
  Access Key, and paste it into `js/app.js` → `web3formsKey: "your-key"`.

## Step 5 — Promote it
Add a button or QR code on `hsgattorneys.co.za` linking to `https://app.hsgattorneys.co.za`
("Open our property calculator app").

---

## Changing things later (no coding)
- **Phone / email / website:** the `SITE` block at the top of `js/app.js`.
- **Lead destination email:** `$TO` at the top of `submit.php`.
- **Fees / rates** (when SARS / LSSA / Deeds Office change): `js/tariffs.js` — one file.
- After **any** change, re-upload the file and bump the version in `sw.js`
  (`hsg-property-v3` → `-v4`) so phones download the new version.
