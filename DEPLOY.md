# Going live — HSG Property (plain-English guide)

You're putting a folder of files online so the app lives at **https://app.hsgattorneys.co.za**.
People open that address on their phone, use the calculators, and tap **"Get a formal quote"** —
which emails the enquiry to **legal@hsginc.co.za**.

### Already wired in for you
- Phone **+27 21 271 0900**, email **legal@hsginc.co.za**, website link — all filled in.
- Spam honeypot, POPIA consent, offline support, add-to-home-screen, light/dark mode.

### How the quote email actually works
Not PHP `mail()` — **authenticated SMTP**. Four files, and they need each other:

| File | Role |
|---|---|
| `submit.php` | Public endpoint the app POSTs to. Validates, rate-limits, logs the lead, then sends. |
| `hsg-mail.php` | Shared library: builds the message and speaks SMTP. Include-only, denied over HTTP. |
| `mail-config.php` | Recipient + SMTP credentials. **Not in git, not in the deploy bundle.** |
| `leads.php` | Password-protected admin page to read and resend captured leads. |

`submit.php` writes every accepted enquiry to `leads.log.jsonl` **before** attempting to
send, so a mail failure never loses a client — check `leads.php` if an email goes missing.

Two things that are easy to break and expensive to debug:

- **`mail-config.php` is uploaded by hand, once.** It is `.gitignore`d because it holds the
  SMTP password, so it is not in `dist/hsg-property-client.zip` either. Extracting the bundle
  over a live site leaves it untouched — which is the intent. If `submit.php` starts returning
  500, a missing or malformed `mail-config.php` is the first suspect. Template:
  `mail-config.example.php`.
- **`leads.log.jsonl` must stay in the web root.** The code in `hsg_lead_paths()` prefers a
  sibling `../hsg-leads/` folder outside the web root, but PHP on this host cannot see above
  the document root (`open_basedir`), so that branch silently never fires. Creating that folder
  does not move the log — it just splits it in two and hides the history from `leads.php`.
  The log is protected by `.htaccess` instead (`<Files "leads.log.jsonl"> Require all denied`).

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
the file you'll edit to update fees, plus the four-file mail stack):
```
index.html   manifest.webmanifest   sw.js   tariffs.json
submit.php   hsg-mail.php   leads.php        <-- mail stack
css/         js/        assets/      icon/
```
Plus **`mail-config.php`**, which the bundle does not contain — upload that separately
the first time (copy `mail-config.example.php`, fill in the real SMTP password).
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
- On xneelo, the definitive answer is in the Control Panel → the hosting package for
  `app.hsgattorneys.co.za` → **Mail tools** → **Mail Logs**. It lists every message the server
  sent in the last 60 days with a Delivered / Failed status, which tells you immediately whether
  the mail left the server at all.
- Emails are sent **From** `webmaster@app.hsgattorneys.co.za` — deliberately the *subdomain*, not
  the parent domain, because `app.hsgattorneys.co.za` publishes an SPF record
  (`v=spf1 mx a include:spf.host-h.net ?all`) and `hsgattorneys.co.za` publishes none. It must
  stay a **real mailbox** on this package: it is also the SMTP account and envelope sender, so
  bounces come back to it. To change it, edit `mail-config.php` on the server (`from`, and the
  matching `smtp.username`/`smtp.password`) — but create the mailbox first. Leave `to` as
  `legal@hsginc.co.za`.
- **Never put a non-ASCII character straight into a mail header.** This is what broke delivery on
  22 July 2026. The subject is built as `subject_prefix . ' — ' . $name` with a literal em dash,
  and `hsg_smtp_send()` writes the subject straight into the SMTP DATA stream — so the raw UTF-8
  bytes went out unencoded and Microsoft 365 rejected **every** enquiry. The mail log showed four
  em-dash subjects Failed against one plain-hyphen subject Delivered. `hsg-mail.php` now runs the
  subject and the Reply-To display name through `mb_encode_mimeheader()`. Keep it that way — and
  note the same rule bites for an accented client name, not just the em dash.
- **Formatting:** the message is `multipart/alternative` (plain text + HTML), and both parts use
  **CRLF** line endings. Bare `\n` is why an early version arrived in Outlook with every line run
  together into one paragraph. If you edit the body, keep `\r\n`.

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
