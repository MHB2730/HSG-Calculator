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
A ready-to-upload bundle is already built for you: **`dist/hsg-property-client.zip`**
(the client app only — no portal/backend, no dev files).

cPanel → **File Manager** → open the subdomain's Document Root folder →
**Upload** `dist/hsg-property-client.zip` → select it → **Extract** → then delete the zip.

You should end up with this structure in the folder (note it includes `tariffs.json`,
the file you'll edit to update fees, and `submit.php`, the quote-email handler):
```
index.html   manifest.webmanifest   sw.js   submit.php   tariffs.json
css/         js/        assets/      icons/
```
(Rebuild the bundle any time after changes with **`npm run pack`**. The portal/, supabase/,
scripts/ and js/lib/ folders are intentionally NOT shipped to clients.)

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

## Step 5 — Distribute it to clients
The app installs straight from the browser — there's no app store and no file to download.
Point clients to **https://app.hsgattorneys.co.za** any of these ways:

- **QR code** (ready-made in `dist/`): `hsg-property-qr.png` / `.svg`. Put it on business cards,
  email signatures, brochures, the office window, or WhatsApp. Scanning opens the app.
- **Link/button** on `hsgattorneys.co.za`: "Open our property calculator".
- **WhatsApp / SMS / email**: just send the link.

Tell clients they can keep it like an app:
- **iPhone (Safari):** Share → **Add to Home Screen**. (The app shows this hint automatically.)
- **Android (Chrome):** menu **⋮** → **Install app** / **Add to Home screen** (an Install banner
  also appears).

Once installed it opens full-screen with the HSG icon, works offline, and quietly picks up
new fees whenever you update `tariffs.json`.

> The QR code encodes `https://app.hsgattorneys.co.za`, so it only works **after** Steps 1–3
> are done and that address is live. Re-generate it if you use a different address:
> `python -c "import segno; segno.make('https://YOUR-URL', error='h').save('dist/hsg-property-qr.png', scale=10, border=3, dark='#121212')"`

---

## Changing things later (no coding)
- **Phone / email / website:** the `SITE` block at the top of `js/app.js`.
- **Lead destination email:** `$TO` at the top of `submit.php`.
- After **any** change, re-upload the file and bump the version in `sw.js`
  (`hsg-property-v10` → `-v11`) so phones download the new version.

### Updating fees / rates (SARS transfer duty, LSSA guideline, Deeds Office)
Rates live in **`tariffs.json`** — the app fetches it on every online load, so editing
that one file updates every installed app on next launch. To update safely:

1. **Edit `tariffs.json`** — change only the numbers. Use `null` for an "and above" top band.
2. **Check it before uploading:** `node scripts/check-tariffs.mjs`
   It confirms the file is valid, that no section was silently rejected, and prints the
   new fees at sample prices to eyeball. `RESULT: OK` = safe; `DO NOT DEPLOY` = fix first.
   (If a section is invalid the app keeps the OLD built-in fees for it — the check catches
   this so an update never silently fails to take.)
3. **Upload `tariffs.json`** to the host. Done — no version bump needed for a rates-only change.
4. **At a full release** (recommended so the offline fallback stays current): also update the
   matching `DEFAULTS` in `js/tariffs.js` and the expected values in `scripts/test-rates.mjs`,
   then run `npm run test:rates`.
