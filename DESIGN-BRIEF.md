# Design Brief — "HSG Property" PWA Visual Redesign

> Paste this whole document into a Claude design session. It is the complete, self-contained spec.
> The brand is **strictly black, white & grey — no accent colour** (§3). The **hard technical contract** the JS depends on is in §9 — do not break it.

## 1. Project & goal

**HSG Property** is an installable, offline-capable mobile web app (PWA — plain HTML/CSS/JS, **no build step**) for **HSG Attorneys** (Hornby, Smyly, Glavovic Inc., a division of **GeoAfrika Group**; hsgattorneys.co.za). Stage 1 — already built and working — is a property toolkit with **four calculators** (Transfer cost, Bond registration cost, Bond repayment, Affordability), each with an itemised breakdown, a Share action (WhatsApp / email / copy), and a "Get a formal quote" lead form with POPIA consent. It installs to the home screen and works offline. It is modelled on STBB's "STBB Direct" app but is **lead-focused** — the quote CTA is HSG's differentiator.

**The job:** the current visual design is wrong — it reads as a plain "black-and-white template," and the logo is mishandled. You are a **Claude design session** producing a brand-new visual skin. **Deliver three things** that drop into the existing project:

- `index.html` — re-marked-up but preserving **every** technical hook in §9 (the JavaScript is **fixed and must not change**).
- `css/styles.css` — a single, self-contained stylesheet (no `@import` of remote CSS, no preprocessor, no build tools).
- An updated `manifest.webmanifest` (colours only — see §4) **and** the `theme-color` meta in `index.html`, plus an app-icon artwork note (§4).

A developer then wires these into the working app; the calculators' maths/JS must keep functioning untouched.

---

## 2. The problem with the current design, and the target feeling

**What's wrong today:** the app is ~90% white/grey. Surfaces are flat white on a near-white background, separated by thin 1px lines and dashed row rules. There is no brand-colour *mass*, no depth hierarchy, no dark mode, system fonts only, and **emoji used as UI icons** (the install / iOS-share / close glyphs). The grand total — the thing the user came for — does not read as the hero. The result is exactly the "plain / black-and-white / cheap template" look the client is rejecting. STBB's polished feel lives in its native, card-based, single-accent UI; a neglected monochrome web build is the trap to avoid.

**The fix is not more decoration, and it is not adding a colour.** It is: (1) introduce confident **near-black brand mass** (a deep header bar + a filled hero behind every grand total / headline number); (2) a real **named greyscale token system** with **light + dark** themes; (3) a **trustworthy type pairing** with a true display face for the big numbers; (4) **3-tier elevation/contrast hierarchy** so the total is the climax; (5) replace all emoji with a consistent inline-SVG stroke-icon set.

**Target feeling:** premium, trustworthy, modern **property-law toolkit** for an established SA conveyancing firm. Corporate-modern, calm, high-contrast, confident — **not** fintech-playful, **not** gimmicky. The brand is **strictly black, white and grey**: power comes from confident black mass, crisp white space, disciplined greys, strong typographic hierarchy and depth — **not** from any accent colour. (The earlier "black-and-white" complaint was about *lack of craft*, not lack of colour — so the goal is premium monochrome done well.)

---

## 3. Brand foundations

### 3.1 Brand truth (confirmed by the client — read this carefully)

HSG's brand is **strictly black, white and grey — there is NO accent colour.** Two earlier automated reads of the website were both wrong and must be ignored:
- The blues `#1863DC` / `#0056A7` are **CookieYes / CleanTalk cookie-banner plugin defaults**.
- A red token (`#D80000` etc.) appears in the Elementor kit but is an **unused default**, not part of the identity. **The client has confirmed: no red, no blue.**

The genuine identity:
- **Black** chrome — the site header and footer are black (`#000000`), carrying a **white** logo and white nav.
- **White** content surfaces, with **grey** body text (~`#7A7A7A`) and near-black headings.
- **No accent colour at all.**

So: **build mass with near-black, keep content surfaces white, use a disciplined greyscale, and earn the premium feel through typography, spacing, depth and hierarchy — not colour.**

### 3.2 Colour token system (CSS custom properties — light + dark)

Define on `:root`, override under both `[data-theme="dark"]` **and** `@media (prefers-color-scheme: dark)` (so the app respects the OS, and a manual toggle is also possible later). Add `color-scheme: light dark` on `:root`.

```css
:root {
  color-scheme: light dark;

  /* --- Brand = strictly monochrome. The "accent" is BLACK; there is NO colour. --- */
  --brand:        #111315; /* the accent = near-black: CTA fill, active states, emphasis */
  --brand-strong: #000000; /* hover/pressed on filled-black elements */
  --brand-50:     #F0F1F3; /* lightest grey tint — chips, tab track, info banner bg */
  --brand-100:    #E1E3E7; /* grey tint borders / hover fills */
  --focus:        rgba(17,19,21,.30); /* neutral focus ring */

  /* --- Ink & neutrals (the BLACK chrome that gives the brand its weight) --- */
  --ink-chrome:   #121212; /* app bar + footer + filled hero fill (the "brand mass") */
  --ink:          #16181C; /* primary text on light, ~16:1 on white */
  --muted:        #5B636E; /* secondary text, >=4.6:1 on white */
  --line:         #E7E7E7; /* hairlines / dividers (matches the site's separator grey) */

  /* --- Surfaces --- */
  --surface:      #FFFFFF; /* cards */
  --surface-elev: #FBFBFC; /* subtly raised inner surfaces */
  --bg:           #F4F4F4; /* page background (the site's own light grey) */

  /* --- Status --- */
  --success:    #1F8F5F; --success-50: #E7F5EE;
  --warn:       #B7791F; --warn-50:    #FCF3E3;
  --danger:     #C0392B; --danger-50:  #FBEAE8;

  /* --- On-colour text --- */
  --on-brand:   #FFFFFF;   /* white on --brand (AA) */
  --on-chrome:  #FFFFFF;   /* white on near-black chrome */
  --on-chrome-soft: rgba(255,255,255,.72); /* sub-labels on chrome / hero */

  /* --- Radius --- */
  --radius:      16px;
  --radius-sm:   12px;
  --radius-pill: 999px;

  /* --- Elevation (very subtle, tinted toward black) --- */
  --shadow-1:   0 1px 2px rgba(18,18,18,.06);
  --shadow-2:   0 6px 20px rgba(18,18,18,.10);
  --shadow-pop: 0 12px 40px rgba(18,18,18,.22);

  /* --- Layout --- */
  --maxw: 620px;
}

@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --brand:        #FFFFFF; /* monochrome inverts: CTA/accent becomes white on the dark UI */
  --brand-strong: #E6E8EC; /* hover/pressed */
  --brand-50:     rgba(255,255,255,.08); /* faint tint — chips/track */
  --brand-100:    rgba(255,255,255,.16);
  --focus:        rgba(255,255,255,.40);

  --ink-chrome:   #0B0B0C; /* chrome stays the deepest surface */
  --ink:          #ECEEF1;
  --muted:        #A2ABB6;
  --line:         #2A2D33;

  --surface:      #17191D;
  --surface-elev: #1E2126;
  --bg:           #0E0F11;

  --success: #34B97D; --success-50: rgba(52,185,125,.16);
  --warn:    #E0A33A; --warn-50:    rgba(224,163,58,.16);
  --danger:  #F0685A; --danger-50:  rgba(240,104,90,.16);

  --on-brand:  #111315; /* black text on the white dark-mode CTA */
  --on-chrome: #FFFFFF;
  --on-chrome-soft: rgba(255,255,255,.72);

  --shadow-1: 0 1px 2px rgba(0,0,0,.5);
  --shadow-2: 0 6px 20px rgba(0,0,0,.55);
  --shadow-pop: 0 12px 40px rgba(0,0,0,.7);
}}
```

**Justification:** the brand is **strictly black, white and grey — no accent colour.** The "accent" role (`--brand`) is simply **near-black**, so the primary CTA, active tab and emphasis are confident black; in dark mode it **inverts to white** (with black text) so the CTA still pops. `--ink-chrome` (near-black) is the brand mass — the app bar, footer and the filled grand-total/headline hero — which is what makes the app read as *designed* rather than a plain template. White text on near-black clears WCAG AA comfortably (~17:1). Everything else is a disciplined greyscale (`--muted`, `--line`, `--surface`, `--bg`). **The premium feel comes from hierarchy, type and depth, not colour.** Functional states (an input error, a "sent" confirmation) should use weight + an icon + a darker tone rather than introducing a brand colour.

### 3.3 Typography

Match the firm's real stack — **Roboto** is the site's workhorse (headings + body), with **Roboto Slab** as the slab-serif display accent (the site also uses Montserrat in its footer and light-weight Yantramanav in its nav; you do not need those). Load via Google Fonts with `preconnect`, but the design **must hold up offline** via system fallbacks.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Slab:wght@500;700&display=swap">
```

```css
:root {
  --font-ui:      "Roboto", -apple-system, "Segoe UI", system-ui, Arial, sans-serif;
  --font-display: "Roboto Slab", Georgia, "Times New Roman", serif;
}
```

- **Display (Roboto Slab):** `.panel-title`, and the big result numbers `.headline-value` / `.grand-value`. The slab serif signals "established law firm."
- **UI (Roboto):** everything else — labels, rows, buttons, inputs, footer.

**Weights:** body 400; labels/buttons 500; subtotals/amounts 700; hero numbers 700 (Roboto Slab) with `-0.01em` tracking.

**Type scale (mobile, 1rem = 16px):**

| Token | Size / line-height | Use |
|---|---|---|
| `--fs-display` | `2.25rem / 1.05` | `.headline-value` |
| `--fs-grand`   | `1.75rem / 1.1`  | `.grand-value` |
| `--fs-h1`      | `1.5rem / 1.2`   | `.panel-title` |
| `--fs-h2`      | `1.125rem`       | sheet titles `h3` |
| `--fs-body`    | `1rem / 1.5`     | rows, intro, body |
| `--fs-input`   | `1.15rem`        | money/number inputs (>=16px prevents iOS zoom) |
| `--fs-label`   | `0.8125rem`      | `.field-label` — UPPERCASE, `.04em` tracking |
| `--fs-sm`      | `0.8125rem`      | `.btn-sm`, notes |
| `--fs-fine`    | `0.75rem`        | `.disclaimer`, `.fineprint`, `.row-note` |

**Critical for finance:** apply `font-variant-numeric: tabular-nums lining-nums;` (and `font-feature-settings:'tnum' 1,'lnum' 1;`) to **every monetary figure** — `.row-amount`, `.row-total .row-amount`, `.grand-value`, `.headline-value`, and the `.input-money input` — so digits align and don't jitter as the user types. The JS groups thousands with spaces (SA convention `1 234 567`); reserve field width so it doesn't reflow.

### 3.4 Spacing, radius, elevation

```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px;
}
```
- **Card padding:** 16–20px. **Screen gutters:** 16px (20px at >=480px).
- **Radius:** cards/sheets `--radius` (16px; sheets top corners 20px), controls `--radius-sm` (12px), pills/tabs `--radius-pill`.
- **Elevation:** cards `--shadow-1` resting / `--shadow-2` for the hero & sheets; sheets `--shadow-pop`. In dark mode, lean on `--line` + `--surface-elev` for separation; keep shadows deep but soft.

---

## 4. Logo & icons — CRITICAL & ACCURATE

**Verified state of the brand assets** (every public file was downloaded and pixel-checked): there is **NO full-colour logo and NO full-lockup vector master** published anywhere. Every public HSG/GeoAfrika asset is a **single flat colour** — pure black *or* pure white on transparent. That is fine: the brand is monochrome anyway, so there is no logo colour to chase. Do **not** assume a coloured logo can be downloaded.

The mark is a **combined GeoAfrika + HSG lockup**: a faceted, low-poly **folded-polygon emblem** (the shared GeoAfrika "folded crystal" device) at top-right, above the wordmark **"HSG"** (heavy bold uppercase) with **"Attorneys"** beneath in lighter weight.

### 4.1 Brand assets already in the repo (use these exact paths)

| File | What it is | Use |
|---|---|---|
| `assets/hsg-logo.png` | White full lockup (currently in the app bar) | On the **dark** app bar only |
| `assets/brand/hsg-lockup-white-445.png` | Higher-res (445×278) **white** full lockup | Larger white-on-dark placements |
| `assets/brand/hsg-lockup-black-160.png` | **BLACK** full lockup (160×100) | On **light** surfaces (e.g. a quote/share stamp) |
| `assets/brand/geoafrika-logoHSG-160.png` | White full lockup (160×100) | Backup of the app-bar logo |
| `assets/brand/geo-emblem.svg` | **Vector emblem only** (no wordmark); fill set via `.cls-1 { fill:#fff }` | Scalable accent / app-icon source |

> **Recolouring the emblem:** `geo-emblem.svg` is recolourable, but **only when inlined** into the HTML (CSS `fill` cannot reach inside an `<img src>`). To tint it (black `--ink`, or a faint grey watermark), inline the `<svg>` and add `.cls-1 { fill: currentColor; }`. As an `<img>` it stays white.

### 4.2 What to request from the client (include in the handoff note)

Still missing: a **full-colour** version and a **full-lockup vector**. Ask HSG / GeoAfrika marketing for the official brand-pack masters:
1. **Primary full lockup** (emblem + "HSG / Attorneys") as **vector** (SVG + PDF/EPS/AI), **full-colour**.
2. The **white / reverse** version (vector).
3. The **black / mono** version (vector).
4. The standalone **emblem-only** mark in the same three colourways (for app icon / favicon / maskable icon).
5. Exact brand colour values (HEX/RGB/CMYK/Pantone) for emblem + wordmark, and the official brand typeface.
6. The **GeoAfrika parent-group** logo (same set) for "a division of GeoAfrika Group" footer co-branding.

### 4.3 How to treat the logo now (design to this)

- **Never place a white logo on a white/light surface.** Put the **white** lockup (`assets/hsg-logo.png`) on the **`--ink-chrome` near-black app bar** — where it reads perfectly. App bar height ~56px; logo height 32–34px.
- For any **light** surface that needs the mark, use the **black** lockup (`assets/brand/hsg-lockup-black-160.png`) — note it is only 160px wide (fine for small UI, not large/print).
- Provide a **text/monogram fallback** so the app never looks broken if an image fails to load: **"HSG"** in `--font-display` 700 (white on chrome) with **"Property"** beneath in `--font-ui` 500 `--on-chrome-soft`. Wire it behind `.appbar-logo` (e.g. visible if the `<img>` errors).
- Use the emblem as a restrained **monochrome** mark — black (`--ink`) on light surfaces, white on the chrome/hero, or a faint grey watermark. It is recolourable **only when inlined** (`.cls-1 { fill: currentColor }`); as an `<img>` it stays white.

### 4.4 App icons & manifest (PWA)

- **`theme-color`:** change the `index.html` meta from the old blue to the chrome colour: `<meta name="theme-color" content="#121212">` (near-black, matching the app bar).
- **`manifest.webmanifest` (MUST update — it still carries blue):** set `"theme_color": "#121212"` and `"background_color": "#F4F4F4"` (currently `#0056A7` and `#f3f6fb`). If only the meta changes, the **installed** app's splash/OS theming stays blue and re-triggers the rejection.
- **Icons already exist** — `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png` (`purpose: "maskable"`), `icons/apple-touch-icon.png`. **Keep the existing filenames and the existing manifest `icons` array/purposes unchanged** — only **regenerate the artwork**: the recoloured emblem centred on a solid `--ink-chrome` field, emblem <=66% of the canvas (maskable safe area); `apple-touch-icon.png` 180×180 with **no transparency** (iOS adds its own rounding). Flag that final icons need the client's vector master.

---

## 5. Screen-by-screen specs

Every spec references the **real** ids/classes the JS binds to (see §9). The CSS must target these exact hooks. The result-HTML in §5.4 is **injected by `calculators.js` as `innerHTML`** — you cannot change that markup, only style it.

### 5.1 App header — `.appbar`
- Full-width **`--ink-chrome`** bar, ~56px tall, `--shadow-1`, respects `env(safe-area-inset-top)`.
- Left: `.appbar-logo` (the **white** lockup) at 32–34px height. Beside it, `.appbar-titles` stacked: `.appbar-title` (`data-site="appName"` → "HSG Property") in `--on-chrome` 700, and `.appbar-sub` (`data-site="tagline"`) in `--on-chrome-soft` `--fs-sm`.
- The black bar **is** the primary brand mass — no coloured keyline needed. For a crisp edge, use a 1px inner hairline at `rgba(255,255,255,.08)`, or let the black bar meet the light page directly.

### 5.2 The four calculator screens — `.panel` / `.panel.active`
- One `.panel` visible at a time; `.panel.active` shown via `display:block`, others hidden. Refine the fade to `translateY(6px)→0`, opacity 0→1, 200ms `ease-out`.
- Each panel: `.panel-title` (display serif, `--fs-h1`, `--ink`), `.panel-intro` (`--muted`, `--fs-body`), then fields, then the `.results` container, then `.actions`.
- **Inputs** (ids fixed): Transfer `#transfer-price`; Bond `#bond-loan`; Repayment `#rep-loan`/`#rep-rate`/`#rep-years`; Affordability `#aff-gross`/`#aff-expenses`/`#aff-deposit`/`#aff-rate`/`#aff-years`. Money inputs are wrapped in `.input-money` with a leading `.cur` ("R"). Rate/term pairs sit in a `.field-row` (two equal columns, 12px gap).
- `.actions`: a **ghost** "Share" `[data-action="share"]` and the **primary** "Get a formal quote" `[data-action="quote"]`. Make the quote CTA the **visual climax** of every result screen — it is HSG's edge. Stack on a 360px screen if needed, quote emphasised.
- **Empty state:** before any input, `.results` carries `.is-hidden`. A faint one-line hint ("Enter an amount to see the breakdown") is welcome — but place it as a **sibling**, never inside `.results` (the JS owns and overwrites `.results` innerHTML).

### 5.3 Itemised result breakdown + grand-total / headline hero — `.results`
Give results **three tiers**:
- **Tier 1 line items** `.breakdown > .row`: `.row-label` (`--ink`, `--fs-body`; optional `.row-note` on its own line, `--muted` `--fs-fine`) left; `.row-amount` right-aligned, 700, tabular-nums. **Replace dashed borders with whitespace** — 12–14px vertical padding, faint `--line` hairline only if needed. Dashed rules are the #1 "cheap template" tell.
- **Tier 2 subtotal** `.row.row-total`: a solid 1.5px `--line` top border; label + amount both 700, slightly larger.
- **Tier 3 GRAND TOTAL** `.grand`: the hero. A **filled `--ink-chrome` card** (`color: var(--on-chrome)`), `--radius`, 16px padding, `--shadow-2`. `.grand-label` in `--on-chrome-soft`, UPPERCASE `.04em`. `.grand-value` in **display serif**, `--fs-grand`, 700, `--on-chrome`, tabular-nums. A faint white (`--on-chrome-soft`) emblem watermark or a thin inner hairline adds craft. This **black mass** is the single biggest upgrade.
- **Headline calculators** (Repayment, Affordability) use `.headline-result` instead of `.grand`: a **`--ink-chrome` hero band** — `.headline-label` in `--on-chrome-soft`, `.headline-value` in display serif `--fs-display` 700 `--on-chrome` tabular-nums, with `.per` ("/month") in `--on-chrome-soft` `--fs-body`. Below it the `.breakdown` rows in the normal light style.
- **About `.fineprint`:** the JS injects a `.fineprint` line **only inside the Affordability result**. If you want a trust caption ("Estimate only — based on current SARS / LSSA / Deeds tariffs") on the other screens, add it as **static markup outside `.results`** (anything placed inside `.results` is wiped on the next keystroke).

### 5.4 EXACT result-HTML the JS injects (style this real structure)

**Transfer & Bond** (`renderBreakdown`) — injected into `#transfer-results` / `#bond-results`:
```html
<div class="breakdown">
  <div class="row">
    <div class="row-label">Conveyancing fee<span class="row-note">incl. VAT</span></div>
    <div class="row-amount">R 12 345</div>
  </div>
  <!-- ...more .row items... -->
</div>
<div class="row row-total">
  <div class="row-label">Total transfer costs (incl. VAT)</div>
  <div class="row-amount">R 45 678</div>
</div>
<div class="grand">
  <div class="grand-label">Purchase price + costs</div>
  <div class="grand-value">R 1 045 678</div>
</div>
```

**Repayment** — injected into `#rep-results`:
```html
<div class="headline-result">
  <div class="headline-label">Estimated monthly repayment</div>
  <div class="headline-value">R 12 345<span class="per">/month</span></div>
</div>
<div class="breakdown">
  <div class="row"><div class="row-label">Loan amount</div><div class="row-amount">R 1 000 000</div></div>
  <div class="row"><div class="row-label">Interest rate</div><div class="row-amount">11.75%</div></div>
  <div class="row"><div class="row-label">Term</div><div class="row-amount">20 years</div></div>
  <div class="row"><div class="row-label">Total interest over term</div><div class="row-amount">R 1 962 800</div></div>
  <div class="row row-total"><div class="row-label">Total repaid</div><div class="row-amount">R 2 962 800</div></div>
</div>
```

**Affordability** — injected into `#aff-results`:
```html
<div class="headline-result">
  <div class="headline-label">You could roughly afford a property up to</div>
  <div class="headline-value">R 1 850 000</div>
</div>
<div class="breakdown">
  <div class="row"><div class="row-label">Affordable monthly repayment</div><div class="row-amount">R 18 500</div></div>
  <div class="row"><div class="row-label">Estimated maximum home loan</div><div class="row-amount">R 1 700 000</div></div>
  <div class="row"><div class="row-label">Plus your deposit</div><div class="row-amount">R 150 000</div></div>
  <div class="row row-total"><div class="row-label">Indicative purchase price</div><div class="row-amount">R 1 850 000</div></div>
</div>
<p class="fineprint">A rough guide only — banks assess each applicant individually (credit record, other debt, etc.).</p>
```
> Note: repayment/affordability put `.headline-result` **before** the `.breakdown`; transfer/bond put `.grand` **after** the `.row-total`. Style both orders. `.row-amount` carries both money **and** non-money values ("11.75%", "20 years") — keep tabular-nums but don't assume a currency prefix or force currency alignment that looks odd for "20 years".

### 5.5 Share bottom-sheet — `#share-sheet`
- `.modal` is a fixed full-viewport overlay; **open state is `.modal.open`** (JS toggles `.open`). Default `.modal { display:none }`; `.modal.open { display:flex }` (align-items:flex-end). When open, `body.modal-open` locks scroll (`overflow:hidden`).
- Scrim: `--ink-chrome` at ~55% alpha + optional `backdrop-filter: blur(2px)` (provide a solid-colour fallback first for older webviews).
- `.sheet`: `--surface`, `border-radius: 20px 20px 0 0`, `--shadow-pop`, 20px padding, `padding-bottom: max(20px, env(safe-area-inset-bottom))`, slide-up 260ms `cubic-bezier(.2,.8,.2,1)`. Add a 36×4px rounded **grab handle** (`--line`) centred at top.
- Title `h3`. `.sheet-options` holds three full-width `.btn.btn-block` buttons — `#share-whatsapp`, `#share-email`, `#share-copy` — each with a leading icon (WhatsApp, email, copy) as inline SVG. A quiet `.btn-text` "Cancel" `[data-action="close-modal"][data-target="share-sheet"]` at the bottom.

### 5.6 Get-a-quote lead form — `#lead-modal`
- Same bottom-sheet mechanics (`.modal.open`, `.sheet.sheet-form`). `.sheet-head`: `h3` "Get a formal quote" + a `.btn-text` close `[data-action="close-modal"][data-target="lead-modal"]` (close = inline SVG, >=44×44 hit area).
- `#lead-summary` (`.sheet-summary`): a scenario chip — `--brand-50` background, `--ink` text, `--radius-sm`.
- `#lead-form` fields (names fixed): `name`, `phone`, `email` — each a `.field` with `.field-label` + input. Hidden `#lead-scenario`.
- `.consent` POPIA row: a **>=18px** checkbox `[name="consent"]` + label at >=4.5:1 with the firm name (`data-site="firmName"`) **bolded**. Generous tap area across the whole row.
- Submit: `.btn.btn-primary.btn-block` "Send to HSG" (full-width black CTA).

### 5.7 Install banner & iOS hint — `#install-banner` / `#ios-hint`
- Both start with `.is-hidden` (JS removes it). **Replace all emoji** with crisp inline SVG (download glyph; iOS share-arrow; close).
- `#install-banner`: `--brand-50` surface, 1px `--brand-100` border, `--radius-sm`, a leading app-icon thumbnail + copy "Add HSG Property to your home screen — works offline". `.install-actions` holds `#install-btn` (`.btn.btn-sm` primary "Install") + `#install-dismiss` (`.btn-text` close, >=44×44 hit area).
- `#ios-hint`: a tinted **info** card (`--warn-50` background, `--warn` keyline) with an inline iOS share glyph; text "To install: tap **Share** then **Add to Home Screen**." + `#ios-hint-close` (`.btn-text` close).

### 5.8 Footer / disclaimer — `.footer`
- Recommended: an **`--ink-chrome` band** (bookend the app in brand black; correct backdrop for the white logo + GeoAfrika co-branding).
- `.disclaimer` (`data-site="disclaimer"`, `--fs-fine`, `--on-chrome-soft` >=4.5:1). `.footer-contact`: two **anchors** styled `.btn.btn-ghost.btn-sm` — `#contact-phone` ("Call …") and `#contact-web` ("Visit website"); on a dark footer, ghost buttons use white outline/text. **`#contact-phone` may receive `.is-hidden` at runtime** (phone not yet configured) — design the footer to look balanced with **only** the website button showing. `.copyright`: "© <span id="year"></span> HSG Attorneys" + (optional) "a division of GeoAfrika Group".

### 5.9 Toast — `#toast`
- The JS uses a single `#toast.toast`, and **creates it at the end of `<body>` if it is absent** — so style `.toast` as a **body-level** element (do not scope its selector under a parent that may not exist). Visible state is class **`.show`** (JS adds/removes it). Default hidden/translated; `.toast.show` rises 20px→0 + fades in. Use a dark pill (`--ink-chrome` / `--on-chrome`) so it reads in **both** themes; centred near the bottom, above safe-area, `--shadow-pop`, `--radius-pill`.

---

## 6. Component library

**Buttons** — base `.btn` (min-height 44px, `--radius-sm`, 500 weight, `--fs-body`, `:active` scale .98 + 120ms transition):
- `.btn-primary` — solid `--brand`, `--on-brand` text; hover/`:active` → `--brand-strong`. The conversion CTA.
- `.btn-ghost` — transparent, 1.5px `--brand` (or `--line`) border, `--brand` text; on dark footer, white border/text.
- `.btn-block` — `width:100%`.
- `.btn-sm` — `--fs-sm`, reduced padding (keep 44px hit area via padding).
- `.btn-text` — borderless text/icon button; **enforce a 44×44 minimum hit area** for all close/Cancel/dismiss controls.

**Inputs & currency fields:**
- `.field` — block; `.field-label` UPPERCASE `--fs-label` 500 `--muted` `.04em`, 8px gap below.
- `.input-money` — a single premium control: 1.5px `--line` border, `--radius-sm`, `--surface`, min-height 52px, 14px padding, `display:flex; align-items:center`. `.cur` ("R") `--muted` 700 with a 1px `--line` divider on its right. The `input` fills the rest: `--fs-input`, 700, tabular-nums, `--ink`, no inner border/outline. **The `.cur` must stay a *sibling* of a native `<input>` — never wrap or replace the input with a styled div** (the JS reads/writes `input.value` by id, and keeps `type`/`inputmode`).
- Plain number inputs (`#rep-rate`, `#rep-years`, etc.) match `.input-money` height/border for visual consistency.
- **Focus (`:focus-within` on `.input-money`, `:focus-visible` on inputs):** border `--brand` + ring `0 0 0 3px var(--focus)`, 120ms transition.

**Tabs — `.tabs` / `.tab` / `.tab.active`:** a premium segmented control. `.tabs`: `--brand-50` (light) / `rgba(255,255,255,.06)` (dark) track, 4px padding, `--radius-pill`, horizontal scroll with hidden scrollbar + 12px scroll-padding (4 labels just fit 360px). `.tab`: `--muted` 500, min-height 44px, `--radius-pill`, `.875rem`. `.tab.active`: `--surface` fill, `--ink` text, `--shadow-1`, optional 2px `--brand` indicator. (JS toggles `.active`.)

**Cards:** `--surface`, `--radius`, `--shadow-1`, 16–20px padding, `--line` border in dark mode for definition. Panels read as cards.

**Rows:** see §5.3 (`.row`, `.row-label`, `.row-note`, `.row-amount`, `.row-total`, `.grand`/`.grand-label`/`.grand-value`, `.headline-result`/`.headline-label`/`.headline-value`/`.per`).

**Modals / sheets:** see §5.5 — `.modal`/`.modal.open`/`.sheet`/`.sheet-form`/`.sheet-head`/`.sheet-options`/`.sheet-summary`/`.consent`. Above 640px, centre the sheet as a dialog (`--maxw`, `border-radius:--radius`, `align-items:center`).

**Chips:** the `.sheet-summary` scenario chip and selected states reuse the pill pattern — selected = solid `--brand` + `--on-brand`; unselected = `--line` outline + `--ink`.

---

## 7. States & interactions

- **Empty:** `.results.is-hidden` until input. Friendly hint allowed as a panel sibling (not inside `.results`).
- **Typing:** money fields live-format with spaces (JS); reserve width so no reflow; numbers stay tabular.
- **Result reveal:** `.results` fades + rises 6px (220ms ease-out) when shown.
- **Hero count-up (optional dev note):** animating `.headline-value` / `.grand-value` 0→final over ~500ms ease-out is the one signature delight moment.
- **Focus:** visible `:focus-visible` ring (2px `--brand`, 2px offset) on **all** focusable controls — tabs, buttons, links, inputs, checkbox.
- **Disabled:** 0.5 opacity, `cursor:not-allowed`, no shadow.
- **Loading:** style a `.btn` busy state (reduced opacity + inline spinner) for the lead submit.
- **Error:** input error token — border `--danger`, helper text `--danger` `--fs-sm`. Provide a `.field.has-error` convention.
- **Success:** toast confirmation (`.toast.show`); optionally style a `--success-50` confirmation block for the lead form.
- **Microinteractions (subtle, serious — no bounce):** button `:active` scale .98 + darken; tab crossfade; sheet slide-up + grab handle; toast rise+fade; focus-ring 120ms. Easing: `ease-out` / `cubic-bezier(.2,.8,.2,1)`.

---

## 8. Accessibility

- **Contrast (WCAG AA):** token pairs are chosen to pass — `--ink` on `--surface` ~16:1; `--muted` on `--surface` >=4.6:1; white on `--brand` / `--ink-chrome` (near-black) >=15:1. Disclaimer/fineprint >=4.5:1 and >=0.75rem. In dark mode the CTA inverts (black text on a white `--brand`) — verify `--on-brand` against `--brand` and `--brand-strong`.
- **Tap targets:** every interactive element >=44×44px — tabs, all `.btn`, and especially the `.btn-text` close/dismiss.
- **Focus-visible:** ring on **all** controls, not just inputs.
- **Reduced motion:**
  ```css
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  ```
- **Colour scheme:** honour `prefers-color-scheme`; declare `color-scheme: light dark`.
- **Font size:** body >=16px; inputs >=16px (`--fs-input` 1.15rem) to avoid iOS zoom-on-focus. Keep the real `.field-label` ↔ input association.

---

## 9. Hard constraints — the technical contract (DO NOT CHANGE)

The JavaScript in `js/` is **fixed**. Your `index.html` + `css/styles.css` must preserve every hook below, or the working app breaks.

- **No build tools / no framework / no remote CSS import.** Plain HTML + one CSS file. Mobile-first. Must work **offline** (fonts degrade to system fallbacks). Must work on **iOS Safari + Android Chrome**.
- **Tabs:** `.tab[data-tab="transfer"|"bond"|"repayment"|"afford"]`; panels `#panel-transfer` / `#panel-bond` / `#panel-repayment` / `#panel-afford`, class `.panel`, active state **`.panel.active`** (and `.tab.active`).
- **Inputs (by id):** `#transfer-price`, `#bond-loan`, `#rep-loan`, `#rep-rate`, `#rep-years`, `#aff-gross`, `#aff-expenses`, `#aff-deposit`, `#aff-rate`, `#aff-years`. Keep each a **native `<input>`** with its `inputmode`/`type`. Money inputs stay wrapped in `.input-money` with a `.cur` **sibling** (never merge the input into a styled div).
- **Result containers (JS sets `innerHTML`):** `#transfer-results`, `#bond-results`, `#rep-results`, `#aff-results`, each `.results` toggled with **`.is-hidden`**. Never put your own content inside them.
- **Injected result classes the CSS must style:** `.breakdown`, `.row`, `.row-label`, `.row-note`, `.row-amount`, `.row-total`, `.grand`, `.grand-label`, `.grand-value`, `.headline-result`, `.headline-label`, `.headline-value`, `.per`, `.fineprint`. (See verbatim structures in §5.4.)
- **Action hooks (event-delegated):** `[data-action="share"]`, `[data-action="quote"]`, `[data-action="close-modal"][data-target="…"]`.
- **Modals:** `#share-sheet` and `#lead-modal`, class `.modal`, **open state `.modal.open`**, inner `.sheet`. `body.modal-open` toggled by JS. Share buttons `#share-whatsapp` / `#share-email` / `#share-copy`. Lead form `#lead-form` with inputs `name`/`phone`/`email`, `#lead-summary`, hidden `#lead-scenario`, checkbox `[name="consent"]`.
- **Install UI:** `#install-banner`, `#install-btn`, `#install-dismiss`, `#ios-hint`, `#ios-hint-close`.
- **Misc hooks:** `#toast` (visible via **`.show`**; may be JS-created at body level — style it as body-level), `#year`, and **anchors** `#contact-phone` (may be `.is-hidden` when no phone is set) and `#contact-web`. `[data-site="appName"|"firmName"|"tagline"|"disclaimer"]` are filled via `textContent` by JS.
- **Visibility helper:** `.is-hidden { display: none !important; }` must exist and win.
- **Keep the module entry & PWA wiring:** `<script type="module" src="js/app.js"></script>`, `<link rel="manifest" href="manifest.webmanifest">`, the icon `<link>`s, and the apple-mobile meta tags. **Update** the `theme-color` meta (→ `#121212`) and the `manifest.webmanifest` colours (§4.4). Keep an `<img class="appbar-logo" src="assets/hsg-logo.png">` (with a text fallback).
- **Do not add a bottom nav or change the 4-tab IA.** This is a reskin, not a re-architecture.

---

## 10. Deliverables & acceptance checklist

**Deliver:** `index.html` + `css/styles.css` + updated `manifest.webmanifest` colours + the `theme-color` meta, and a short handoff note listing (a) the logo files to request from the client (§4.2) and (b) the app-icon artwork the dev must regenerate (§4.4).

**Acceptance — the design is done when:**
- [ ] App no longer reads as a flat/cheap template: a confident **near-black brand mass** (black app bar + footer, filled `.grand`/`.headline-result` hero), a clear 3-tier hierarchy, the Roboto/Roboto Slab pairing and real depth — **premium monochrome**, not bland.
- [ ] **Strictly black / white / grey — no blue, no red, no accent colour** — including `manifest.webmanifest` `theme_color`/`background_color` and the `theme-color` meta.
- [ ] **Light + dark** themes both ship via tokens and `prefers-color-scheme`; all contrast pairs pass **WCAG AA** (incl. dark-mode CTA pressed state).
- [ ] **Roboto + Roboto Slab** loaded with system fallbacks; renders correctly **offline**.
- [ ] Every monetary figure uses **tabular lining numerals**; no jitter/reflow while typing.
- [ ] The four screens, the three result structures in §5.4, the two bottom-sheets, install banner, iOS hint, footer, and toast are all styled against their **real** hooks (§9) — verified by pasting the §5.4 snippets in and confirming they style correctly.
- [ ] **No emoji** as UI; all glyphs are inline SVG.
- [ ] White HSG logo sits **only** on the near-black app bar (never on white); a text/monogram fallback exists; `#contact-phone` hidden looks fine.
- [ ] All tap targets >=44px; `:focus-visible` ring on **all** controls; `prefers-reduced-motion` honoured.
- [ ] Works on **iOS Safari + Android Chrome**, mobile-first; sheets centre as dialogs at >=640px.
- [ ] **No build step**, single CSS file, all §9 ids/classes/data-attributes intact — the existing `js/` runs unchanged.
