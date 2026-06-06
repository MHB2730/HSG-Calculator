# HSG Property — installable web app (Stage 1)

A mobile-first, installable web app (PWA) for **HSG Attorneys** with four property
calculators and a "Get a formal quote" lead form. No build step, no app store —
it's plain HTML/CSS/JS you can upload to any web host.

> Modelled on STBB's "STBB Direct" app, but lead-focused for HSG. This is **Stage 1**
> (calculators + leads). **Stage 2** (client/agent login, live transfer tracking,
> document vault) is planned separately and will use Supabase.

## What's inside
- **Transfer cost** · **Bond registration cost** · **Bond repayment** · **Affordability**
- Itemised breakdowns, Share (WhatsApp / Email / Copy), and a quote form with POPIA consent
- Installs to the home screen and works offline (calculators only)

The maths is an **exact copy of HSG's live website calculator** (transfer duty, LSSA
attorney tariff, Deeds Office fees, disbursements). It is verified to match at
R1m / R2m / R3m / R5m.

## Run it locally
```
cd C:\Users\bremn\dev\hsg-property
npm run serve        # then open http://localhost:4178
npm run test:calc    # prints the calculation checks
```
(Any static server works — there is nothing to build.)

## Before going live — edit the `SITE` object at the top of `js/app.js`
Fill in the TODOs (no coding needed):
- `phone`, `email`, `website`
- `web3formsKey` — a free key from https://web3forms.com so quote requests are
  **emailed to the firm**. If blank, the form falls back to opening the visitor's
  own email app addressed to `email`.

## Where the numbers live — `js/tariffs.js`
Everything (SARS duty bands, the LSSA fee formula, Deeds Office tables, the fixed
disbursements: rates cert R830, disbursements R1900, FICA R520, VAT 15%) is in the
`CONFIG` object at the top. When SARS / LSSA / the Deeds Office change their fees,
edit this one file and every calculator updates. Re-run `npm run test:calc` after.

## Deploy (cPanel / any host)
1. Point a subdomain, e.g. `app.hsgattorneys.co.za`, at a folder.
2. Upload **all files** (keep the folder structure: `css/ js/ icons/ assets/`,
   `index.html`, `manifest.webmanifest`, `sw.js`). Serve over **HTTPS** (required
   for install + offline).
3. When you change any file, bump `CACHE` in `sw.js` (e.g. `-v2` → `-v3`) so phones
   pick up the new version.
4. Add an "Install our app" link / QR code on hsgattorneys.co.za.

## Branding notes
- The design is **strictly black / white / grey** (no accent colour). Colour tokens
  live at the top of `css/styles.css` (`--ink-chrome`, `--brand` = near-black, etc.);
  it ships with **light + dark** themes and a toggle.
- The black app bar + footer carry the **white** HSG lockup (`assets/hsg-logo.png`);
  a **black** lockup (`assets/brand/hsg-lockup-black-160.png`) is included for light surfaces.
- Icons in `icons/` are generated from the GeoAfrika emblem — swap in final firm
  artwork when available (keep the same filenames/sizes).

## Files
```
index.html                 app shell (4 calculators, quote + share modals, dark-mode toggle)
manifest.webmanifest       installable-app settings (theme/icons)
sw.js                      offline cache (service worker) — bump CACHE on changes
css/styles.css             the visual design (monochrome, light + dark themes)
js/app.js                  app controller + SITE settings (tabs, share, lead, install, theme)
js/tariffs.js              THE CALCULATION BRAIN (all SARS / LSSA / Deeds rates & fees)
assets/hsg-logo.png        white HSG lockup (sits on the black app bar + footer)
assets/brand/              logo lockups (black/white) + emblem watermark
icons/                     installable-app icons (192 / 512 / maskable / apple-touch)
scripts/serve.mjs          tiny local preview server
scripts/test-calc.mjs      calculation sanity checks
DESIGN-BRIEF.md            the design spec used for the visual design
```
