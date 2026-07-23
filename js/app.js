/*
 * Copyright (c) 2026 HSG Attorneys Incorporated. All rights reserved.
 * Part of HSG Calculator. Unauthorised copying, modification or distribution is prohibited.
 */
// =====================================================================
// HSG Property — app logic.
// UI/behaviour from the approved design; CALCULATIONS come from the
// verified engine in tariffs.js (exact parity with the HSG website).
// =====================================================================
import {
  transferCostBreakdown, bondCostBreakdown, bondRepayment, affordability, loadRemoteRates,
} from './tariffs.js';
import { buildShareCard } from './sharecard.js';

/* ---------- Site settings (edit me — no coding needed) ---------- */
const SITE = {
  appName: "HSG Property",
  firmName: "HSG Attorneys",
  tagline: "Property cost & bond toolkit",
  // NOTE: no `disclaimer` key. The firm's disclaimer is now static markup in
  // index.html (footer) so it renders even if this script fails to load —
  // it is legal text, not UI copy. Edit it there, not here.
  // HSG offices — the "Call HSG" button offers these and best-effort highlights the nearest.
  offices: [
    { city: "Durban", region: "KwaZulu-Natal", phone: "+27 31 266 7751" },
    { city: "Cape Town", region: "Western Cape", phone: "+27 21 271 0900" },
  ],
  email: "legal@hsginc.co.za",            // lead destination + mailto fallback address
  website: "https://hsgattorneys.co.za",
  whatsapp: "+27 63 729 2207",            // HSG WhatsApp Business — quote chats land here
  // How quote requests reach the firm:
  //   1. ./submit.php on your cPanel host emails them automatically (no key needed).
  //   2. Optionally paste a free Web3Forms key (https://web3forms.com) to use that instead.
  //   3. If neither works, the form opens the visitor's own email app to SITE.email.
  web3formsKey: "",                        // optional — leave blank to use submit.php
};

const DEFAULT_RATE = 11.75;   // shown in repayment + affordability
const DEFAULT_TERM = 20;

/* ---------- Helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// "R 1 234 567" — South African spacing, rounded. Guards against non-finite and
// very large values so the output never degrades to exponential ("R 1e+21").
const groupR = n => {
  let v = Math.round(Number(n) || 0);
  if (!Number.isFinite(v)) v = 0;
  return "R " + v.toLocaleString("en-US").replace(/,/g, " ");
};
const numFrom = id => {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(String(el.value).replace(/[^\d.]/g, "")) || 0;
};

/* ---------- Calculators (verified engine → render shapes) ---------- */
function calcTransfer() {
  const price = numFrom("transfer-price");
  if (price <= 0) return null;
  const b = transferCostBreakdown(price);
  return {
    rows: b.items.map(i => [i.label, i.note, i.amount]),
    totalLabel: "Total transfer costs (incl. VAT)",
    total: b.total,
    grandLabel: "Purchase price + costs",
    grand: b.grandTotal,
  };
}

function calcBond() {
  const loan = numFrom("bond-loan");
  if (loan <= 0) return null;
  const b = bondCostBreakdown(loan);
  return {
    rows: b.items.map(i => [i.label, i.note, i.amount]),
    totalLabel: "Total bond costs (incl. VAT)",
    total: b.total,
    grandLabel: "Loan + bond costs",
    grand: b.totalWithLoan,
  };
}

function calcRepayment() {
  const loan = numFrom("rep-loan");
  const rate = numFrom("rep-rate") || DEFAULT_RATE;
  const years = numFrom("rep-years") || DEFAULT_TERM;
  if (loan <= 0) return null;
  const r = bondRepayment(loan, rate, years);
  return {
    headlineLabel: "Estimated monthly repayment",
    headlineValue: groupR(r.monthly),
    per: "/month",
    rows: [
      ["Loan amount", "", groupR(loan)],
      ["Interest rate", "", rate + "%"],
      ["Term", "", years + (years === 1 ? " year" : " years")],
      ["Total interest over term", "", groupR(r.totalInterest)],
    ],
    totalRow: ["Total repaid", groupR(r.totalRepay)],
  };
}

function calcAfford() {
  const grossIncome = numFrom("aff-gross");
  const expenses = numFrom("aff-expenses");
  const deposit = numFrom("aff-deposit");
  const rate = numFrom("aff-rate") || DEFAULT_RATE;
  const years = numFrom("aff-years") || DEFAULT_TERM;
  if (grossIncome <= 0) return null;
  const a = affordability({ grossIncome, expenses, annualRatePct: rate, years, deposit });
  return {
    headlineLabel: "You could roughly afford a property up to",
    headlineValue: groupR(a.indicativePrice),
    per: "",
    rows: [
      ["Affordable monthly repayment", "", groupR(a.affordableInstalment)],
      ["Estimated maximum home loan", "", groupR(a.maxLoan)],
      ["Plus your deposit", "", groupR(deposit)],
    ],
    totalRow: ["Indicative purchase price", groupR(a.indicativePrice)],
    fineprint: "A rough guide only — banks assess each applicant individually (credit record, other debt, etc.).",
  };
}

/* ---------- Renderers (the design's result structures) ---------- */
function renderBreakdown(data) {
  if (!data) return "";
  const rows = data.rows.map(([label, note, amt]) => `
    <div class="row">
      <div class="row-label">${label}${note ? `<span class="row-note">${note}</span>` : ""}</div>
      <div class="row-amount">${groupR(amt)}</div>
    </div>`).join("");
  return `
    <div class="breakdown">${rows}</div>
    <div class="row row-total">
      <div class="row-label">${data.totalLabel}</div>
      <div class="row-amount">${groupR(data.total)}</div>
    </div>
    <div class="grand">
      <div class="grand-label">${data.grandLabel}</div>
      <div class="grand-value">${groupR(data.grand)}</div>
    </div>`;
}
function renderHeadline(data) {
  if (!data) return "";
  const rows = data.rows.map(([label, , amt]) => `
    <div class="row"><div class="row-label">${label}</div><div class="row-amount">${amt}</div></div>`).join("");
  return `
    <div class="headline-result">
      <div class="headline-label">${data.headlineLabel}</div>
      <div class="headline-value">${data.headlineValue}${data.per ? `<span class="per">${data.per}</span>` : ""}</div>
    </div>
    <div class="breakdown">
      ${rows}
      <div class="row row-total"><div class="row-label">${data.totalRow[0]}</div><div class="row-amount">${data.totalRow[1]}</div></div>
    </div>
    ${data.fineprint ? `<p class="fineprint">${data.fineprint}</p>` : ""}`;
}

function paint(containerId, html) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const hint = el.parentElement && el.parentElement.querySelector(".results-hint");
  if (html) { el.innerHTML = html; el.classList.remove("is-hidden"); if (hint) hint.classList.add("is-hidden"); }
  else { el.innerHTML = ""; el.classList.add("is-hidden"); if (hint) hint.classList.remove("is-hidden"); }
}

const CALC = {
  transfer: { fn: calcTransfer, out: "transfer-results", kind: "breakdown" },
  bond:     { fn: calcBond,     out: "bond-results",     kind: "breakdown" },
  repayment:{ fn: calcRepayment,out: "rep-results",      kind: "headline" },
  afford:   { fn: calcAfford,   out: "aff-results",      kind: "headline" },
};

// Debounced screen-reader announcement of the latest estimate (avoids spamming the
// live region on every keystroke).
let _a11yTimer = null;
function announce(msg) {
  const el = document.getElementById("a11y-status");
  if (!el) return;
  clearTimeout(_a11yTimer);
  _a11yTimer = setTimeout(() => { el.textContent = msg || ""; }, 700);
}

function recompute(which) {
  const c = CALC[which];
  const data = c.fn();
  paint(c.out, data ? (c.kind === "breakdown" ? renderBreakdown(data) : renderHeadline(data)) : "");
  if (which === activeTab) {
    announce(!data ? "" : (c.kind === "breakdown"
      ? `${data.totalLabel}: ${groupR(data.total)}. ${data.grandLabel}: ${groupR(data.grand)}.`
      : `${data.headlineLabel}: ${data.headlineValue}${data.per || ""}.`));
  }
  return data;
}

/* ---------- Tabs ---------- */
const TAB_ORDER = ["transfer", "bond", "repayment", "afford"];
let activeTab = "transfer";
function selectTab(name, focusTab = false) {
  activeTab = name;
  const map = { transfer: "panel-transfer", bond: "panel-bond", repayment: "panel-repayment", afford: "panel-afford" };
  $$(".tab").forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;                 // roving tabindex (ARIA tabs pattern)
    if (on && focusTab) t.focus();
  });
  $$(".panel").forEach(p => p.classList.toggle("active", p.id === map[name]));
}

/* ---------- Input formatting ---------- */
const INPUT_MAP = {
  "transfer-price": "transfer",
  "bond-loan": "bond",
  "rep-loan": "repayment", "rep-rate": "repayment", "rep-years": "repayment",
  "aff-gross": "afford", "aff-expenses": "afford", "aff-deposit": "afford", "aff-rate": "afford", "aff-years": "afford",
};
function attachMoney(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => {
    const digits = el.value.replace(/[^\d]/g, "").slice(0, 12); // cap at ~R999 billion
    el.value = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
    recompute(INPUT_MAP[id]);
  });
}
function attachNumber(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => {
    el.value = el.value.replace(/[^\d.]/g, "");
    recompute(INPUT_MAP[id]);
  });
}

/* ---------- Scenario text (share + quote) ---------- */
function scenarioText() {
  const data = recompute(activeTab);
  const titles = {
    transfer: "Transfer cost estimate", bond: "Bond registration cost estimate",
    repayment: "Bond repayment estimate", afford: "Affordability estimate",
  };
  const lines = [SITE.firmName + " — " + titles[activeTab], ""];
  if (!data) lines.push("(enter your figures to generate an estimate)");
  else if (CALC[activeTab].kind === "breakdown") {
    data.rows.forEach(([l, , a]) => lines.push(`${l}: ${groupR(a)}`));
    lines.push(`${data.totalLabel}: ${groupR(data.total)}`);
    lines.push(`${data.grandLabel}: ${groupR(data.grand)}`);
  } else {
    lines.push(`${data.headlineLabel}: ${data.headlineValue}${data.per}`);
    data.rows.forEach(([l, , a]) => lines.push(`${l}: ${a}`));
    lines.push(`${data.totalRow[0]}: ${data.totalRow[1]}`);
  }
  lines.push("", "Estimate only — not a quotation. Get a formal quote from " + SITE.firmName + ".", SITE.website);
  return lines.join("\n");
}

/* ---------- Modals + toast ---------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex]:not([tabindex="-1"])';
let _lastFocus = null;
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  _lastFocus = document.activeElement;                 // remember what to restore on close
  const app = document.querySelector(".app");
  if (app) app.setAttribute("inert", "");              // make the background unreachable (Tab + AT)
  m.classList.add("open"); document.body.classList.add("modal-open");
  // Move focus into the dialog (first field/control, else the sheet itself), after
  // the open class applies. setTimeout (not rAF) so it also fires in hidden tabs.
  setTimeout(() => {
    const first = m.querySelector(FOCUSABLE) || m.querySelector(".sheet");
    if (first) { if (!first.hasAttribute("tabindex") && first.classList?.contains("sheet")) first.tabIndex = -1; first.focus(); }
  }, 0);
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("open");
  if (!$$(".modal.open").length) {
    document.body.classList.remove("modal-open");
    const app = document.querySelector(".app");
    if (app) app.removeAttribute("inert");
    if (_lastFocus && _lastFocus.focus) _lastFocus.focus();  // return focus to the trigger
    _lastFocus = null;
  }
}
// Trap Tab within the open modal (ARIA dialog pattern).
function trapFocus(e) {
  if (e.key !== "Tab") return;
  const m = $(".modal.open");
  if (!m) return;
  const items = $$(FOCUSABLE, m).filter(el => el.offsetParent !== null || el === document.activeElement);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function toast(msg, urgent = false) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.setAttribute("aria-live", urgent ? "assertive" : "polite");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Share ---------- */
// Structured data for the branded share IMAGE.
function activeCardData() {
  const data = recompute(activeTab);
  if (!data) return null;
  const titles = {
    transfer: "Transfer cost estimate", bond: "Bond registration cost estimate",
    repayment: "Bond repayment estimate", afford: "Affordability estimate",
  };
  if (CALC[activeTab].kind === "breakdown") {
    return {
      title: titles[activeTab],
      lines: data.rows.map(([l, , a]) => ({ label: l, value: groupR(a) })),
      total: { label: data.totalLabel, value: groupR(data.total) },
      grand: { label: data.grandLabel, value: groupR(data.grand) },
    };
  }
  return {
    title: titles[activeTab],
    headline: { label: data.headlineLabel, value: data.headlineValue + (data.per || "") },
    lines: data.rows.map(([l, , a]) => ({ label: l, value: a })),
    total: { label: data.totalRow[0], value: data.totalRow[1] },
  };
}

let _shareBlob = null, _shareText = "";

async function shareActive() {
  const card = activeCardData();
  if (!card) { toast("Enter an amount first"); return; }
  _shareText = scenarioText();
  try { _shareBlob = await buildShareCard(card, SITE); } catch { _shareBlob = null; }

  // Native file share (mobile): the branded IMAGE goes straight to WhatsApp / email / save.
  if (_shareBlob && navigator.canShare) {
    const file = new File([_shareBlob], "hsg-estimate.png", { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: SITE.firmName + " estimate", text: _shareText }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
  }
  // Desktop fallback sheet — every option shares the image.
  openModal("share-sheet");
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function copyImage(blob) {
  try {
    if (blob && navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      return true;
    }
  } catch { /* fall through */ }
  return false;
}

async function doShare(method) {
  const blob = _shareBlob, text = _shareText;
  if (method === "download") {
    if (blob) { downloadBlob(blob, "hsg-estimate.png"); toast("Image saved"); }
  } else if (method === "whatsapp") {
    const copied = await copyImage(blob);
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    if (copied) toast("Image copied — paste it into the chat");
    else if (blob) { downloadBlob(blob, "hsg-estimate.png"); toast("Image saved — attach it in WhatsApp"); }
  } else if (method === "email") {
    const copied = await copyImage(blob);
    window.location.href = "mailto:?subject=" + encodeURIComponent(SITE.firmName + " property estimate") + "&body=" + encodeURIComponent(text);
    if (copied) toast("Image copied — paste it into your email");
    else if (blob) { downloadBlob(blob, "hsg-estimate.png"); toast("Image saved — attach it to your email"); }
  }
  closeModal("share-sheet");
}

/* ---------- Call HSG (regional) ---------- */
function openCallSheet() {
  // Show both offices and let the visitor choose. (Auto-detect was removed: it sent the
  // visitor's IP to a third party (ipapi.co) with no consent — a POPIA concern — and
  // browser timezone can't tell KZN from the Western Cape, so a manual choice is honest.)
  openModal("call-sheet");
}

/* ---------- Lead / quote ---------- */
function openQuote() {
  const summaries = { transfer: "Transfer cost", bond: "Bond registration cost", repayment: "Bond repayment", afford: "Affordability" };
  const data = recompute(activeTab);
  let headline = "";
  if (data) headline = CALC[activeTab].kind === "breakdown" ? groupR(data.grand) : data.headlineValue + (data.per || "");
  $("#lead-summary").innerHTML = `<strong>${summaries[activeTab]} enquiry</strong>${headline ? " — " + headline : ""}`;
  $("#lead-scenario").value = scenarioText();
  $("#lead-success").classList.remove("show");
  $("#lead-form").style.display = "";
  openModal("lead-modal");
}
function validateLead(form) {
  let ok = true;
  let firstBad = null;
  const check = (name, valid) => {
    const input = form.querySelector(`[name="${name}"]`);
    const field = input && input.closest(".field");
    if (field) field.classList.toggle("has-error", !valid);
    if (input) input.setAttribute("aria-invalid", valid ? "false" : "true");
    if (!valid) { ok = false; if (!firstBad) firstBad = input; }
  };
  check("name", form.name.value.trim().length > 1);
  check("phone", form.phone.value.replace(/\D/g, "").length >= 7);
  check("email", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.value.trim()));
  // Consent error is a standalone alert (not inside a .field), toggled directly.
  const consentErr = document.getElementById("err-lead-consent");
  const consentOk = form.consent.checked;
  if (consentErr) consentErr.classList.toggle("is-shown", !consentOk);
  form.consent.setAttribute("aria-invalid", consentOk ? "false" : "true");
  if (!consentOk) { ok = false; if (!firstBad) firstBad = form.consent; }
  if (firstBad && firstBad.focus) firstBad.focus();   // move focus to the first problem
  return ok;
}
/* ---------- WhatsApp ----------
 * wa.me needs the number in international form with no +, spaces or
 * punctuation: "+27 63 729 2207" -> "27637292207". */
function waNumber() {
  return String(SITE.whatsapp || "").replace(/[^0-9]/g, "");
}

/** Click-to-chat link, optionally pre-filled. */
function waLink(text) {
  const n = waNumber();
  if (!n) return "";
  // Very long prefills get truncated or dropped by WhatsApp, so cap the text.
  const msg = text ? String(text).slice(0, 1200) : "";
  return "https://wa.me/" + n + (msg ? "?text=" + encodeURIComponent(msg) : "");
}

/* Open a wa.me link.
 *
 * Two traps, both hit in production:
 *
 * 1. window.open(url, "_blank", "noopener") ALWAYS returns null — the spec
 *    says so when noopener is set — so its return value can never be used to
 *    detect a blocked popup. The old code treated null as "blocked" and bailed
 *    out on every single click.
 * 2. Inside an installed PWA (display-mode: standalone) there is no tab UI and
 *    window.open("_blank") frequently does nothing at all. Clicking the button
 *    on a phone's home-screen app opened no chat.
 *
 * So: navigate directly when standalone — Android/iOS hand a wa.me URL to the
 * WhatsApp app and leave the PWA running behind it — and use a real anchor
 * click in a normal tab, which is not popup-blocked from a user gesture and
 * keeps the visitor's estimate on screen. */
function openWhatsApp(url) {
  if (!url) return false;
  const standalone = matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (standalone) { window.location.href = url; return true; }
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** First-person message the client sends to HSG. */
function waQuoteMessage(data) {
  let m = `Hi ${SITE.firmName}, I'd like a formal quote.\n\n`;
  m += `Name: ${data.name}\n`;
  m += `Phone: ${data.phone}\n`;
  m += `Email: ${data.email}\n`;
  if (data.scenario) m += `\n--- My estimate ---\n${data.scenario}\n`;
  return m;
}

async function sendLead(data) {
  const subject = `New property enquiry — ${data.name || "website visitor"}`;
  const body =
    `Name: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email}\n\n` +
    `--- Calculation ---\n${data.scenario}\n\nSent from the ${SITE.appName} app.`;

  // 1) Same-origin PHP endpoint FIRST (works on cPanel hosting — no key needed,
  //    and keeps the visitor's PII on the firm's own server. POPIA-preferred:
  //    only fall out to a third party if the firm's own endpoint is unavailable.)
  try {
    const res = await fetch("./submit.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name, phone: data.phone, email: data.email,
        // Honeypot field — see the note in index.html. It must NOT be called
        // "company": Chrome autofill fills that from the user's saved profile
        // and the server then discards the enquiry as bot traffic.
        scenario: data.scenario, hsg_leave_blank: data.hsg_leave_blank || "",
        consent: !!data.consent,
        // Which route the client chose. Recorded in the lead log so the firm
        // can see a WhatsApp enquiry is also coming through on that number.
        channel: data.channel || "form",
      }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.success) return true;
    }
  } catch { /* fall through */ }

  // 2) Web3Forms (only if a key is configured) — a third-party processor, so it
  //    is the fallback, not the default. NOTE: requires the CSP connect-src to
  //    list api.web3forms.com, otherwise this fetch is blocked.
  if (SITE.web3formsKey) {
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: SITE.web3formsKey, subject, from_name: SITE.appName, name: data.name, phone: data.phone, email: data.email, message: body }),
      });
      const json = await res.json();
      if (json.success) return true;
    } catch { /* fall through */ }
  }

  // 3) Fallback: open the visitor's own email app addressed to the firm
  window.location.href = "mailto:" + encodeURIComponent(SITE.email) +
    "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  return "mailto";
}

/* ---------- Theme toggle ---------- */
function initTheme() {
  const saved = localStorage.getItem("hsg-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  const btn = $("#theme-toggle");
  if (!btn) return;
  const sync = () => {
    const attr = document.documentElement.getAttribute("data-theme");
    const isDark = attr === "dark" || (!attr && matchMedia("(prefers-color-scheme: dark)").matches);
    btn.classList.toggle("is-dark", isDark);
    // Keep the browser chrome (theme-color) matching the ACTIVE theme, including a
    // manual toggle that differs from the OS colour scheme.
    const chrome = isDark ? "#121212" : "#F4F4F4";
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", chrome));
  };
  sync();
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const isDark = cur === "dark" || (!cur && matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("hsg-theme", next);
    sync();
  });
}

/* ---------- Install / iOS coach ----------
 * Android/Chromium fires `beforeinstallprompt`, so there we show a real
 * Install button. iOS NEVER fires it — Apple hasn't implemented the API and
 * every iOS browser is WebKit — so the best possible there is a coach card
 * explaining Share → Add to Home Screen. Notes learned the hard way:
 *   - iPadOS ≥13 masquerades as a Mac ("MacIntel" + no "iPad" in the UA);
 *     detect it via platform + maxTouchPoints or iPads see nothing at all.
 *   - Dismissal used to be one shared, PERMANENT localStorage key: closing
 *     the Android banner also silenced the iOS coach forever. Now the two
 *     surfaces use separate keys, and the iOS coach may return after 14
 *     days (an instruction is worth re-showing; a nag banner less so).
 *   - Chrome/Firefox/Edge on iOS are WebKit too but put "Add to Home
 *     Screen" in a different place than Safari — word the steps per browser.
 */
let deferredPrompt = null;
const IOS_COACH_DELAY_MS = 2500;                       // let the calculator land first
const IOS_COACH_RESHOW_MS = 14 * 24 * 3600 * 1000;     // dismissed coach returns after 14 days

function initInstall() {
  const banner = $("#install-banner"), iosHint = $("#ios-hint");
  const bannerDismissed = localStorage.getItem("hsg-install-dismissed"); // legacy key: Android banner only
  const standalone = matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  // iPhone/iPod still say so in the UA; iPadOS 13+ claims to be MacIntel,
  // but real Macs report 0 touch points.
  const isIPhone = /iphone|ipod/i.test(navigator.userAgent);
  const isIPad = /ipad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIOS = isIPhone || isIPad;

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferredPrompt = e;
    if (!bannerDismissed && banner) banner.classList.remove("is-hidden");
  });

  if (isIOS && !standalone && iosHint) {
    // Separate dismissal state from the Android banner, with expiry.
    let coachDismissedAt = 0;
    try { coachDismissedAt = parseInt(localStorage.getItem("hsg-ios-coach-dismissed") || "0", 10) || 0; } catch {}
    const snoozed = coachDismissedAt && (Date.now() - coachDismissedAt) < IOS_COACH_RESHOW_MS;

    if (!snoozed) {
      // Safari has no reliable feature-detect vs other iOS shells; UA tokens
      // (CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge) are the convention.
      const ua = navigator.userAgent;
      const step1 = $("#ios-coach-step1");
      const shareIcon = step1 ? step1.querySelector(".ios-coach-share")?.outerHTML || "" : "";
      if (step1) {
        if (/CriOS/i.test(ua)) {
          // Chrome iOS: Share icon sits in the address bar.
          step1.innerHTML = "Tap " + shareIcon + " <strong>Share</strong> in the address bar";
        } else if (/FxiOS/i.test(ua)) {
          // Firefox iOS: hamburger menu, not the share sheet.
          step1.innerHTML = "Tap the <strong>menu</strong> (☰), then <strong>Share</strong>";
        } else if (/EdgiOS/i.test(ua)) {
          step1.innerHTML = "Tap the <strong>menu</strong> (⋯), then <strong>Share</strong>";
        } else if (isIPad) {
          // Safari on iPad: Share is in the TOP toolbar, next to the address bar.
          step1.innerHTML = "Tap " + shareIcon + " <strong>Share</strong> at the top, next to the address bar";
        }
        // Default markup already says "Tap Share below" — correct for iPhone Safari.
      }
      // iPad toolbars are at the top: anchor the card up there and flip the arrow.
      if (isIPad) iosHint.classList.add("points-up");
      setTimeout(() => iosHint.classList.remove("is-hidden"), IOS_COACH_DELAY_MS);
    }
  }

  $("#install-btn")?.addEventListener("click", async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
    else toast("Use your browser menu → “Add to Home screen”.");
    banner?.classList.add("is-hidden");
  });
  $("#install-dismiss")?.addEventListener("click", () => {
    banner?.classList.add("is-hidden"); localStorage.setItem("hsg-install-dismissed", "1");
  });
  $("#ios-hint-close")?.addEventListener("click", () => {
    iosHint?.classList.add("is-hidden");
    try { localStorage.setItem("hsg-ios-coach-dismissed", String(Date.now())); } catch {}
  });
}

/* ---------- Site content fill ---------- */
function fillSite() {
  $$("[data-site]").forEach(el => { if (SITE[el.dataset.site] != null) el.textContent = SITE[el.dataset.site]; });
  $("#year").textContent = new Date().getFullYear();
  const web = $("#contact-web");
  if (web) web.href = SITE.website;
  // Footer WhatsApp link — a plain chat, no pre-filled enquiry. Hide it
  // entirely if no number is configured rather than leaving a dead link.
  const wa = $("#contact-whatsapp");
  if (wa) {
    const href = waLink(`Hi ${SITE.firmName}, I have a property question.`);
    if (href) wa.href = href; else wa.remove();
  }
  // Build the Call-HSG office list (config data — safe to inject).
  const list = $("#call-list");
  if (list) {
    list.innerHTML = SITE.offices.map((o, i) => `
      <a class="btn btn-ghost btn-block call-office" id="call-office-${i}" href="tel:${o.phone.replace(/\s/g, "")}">
        <strong>${o.city}</strong> · ${o.phone}<span class="near-tag" hidden> — nearest to you</span>
      </a>`).join("");
  }
}

/* ---------- Service worker (offline) ---------- */
function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
}

/* ---------- Boot ---------- */
function init() {
  fillSite();
  // Logo fallback without an inline onerror handler (keeps the CSP script-src strict).
  const lg = document.querySelector('.appbar-logo');
  if (lg) {
    const onErr = () => { lg.style.display = 'none'; const fb = lg.nextElementSibling; if (fb) fb.style.display = 'block'; };
    lg.addEventListener('error', onErr);
    if (lg.complete && lg.naturalWidth === 0) onErr();
  }
  // Footer logo: hide cleanly if the asset is missing (mirrors the app-bar fallback).
  const flg = document.querySelector('.footer-logo');
  if (flg) {
    const onErrF = () => { flg.style.display = 'none'; };
    flg.addEventListener('error', onErrF);
    if (flg.complete && flg.naturalWidth === 0) onErrF();
  }
  // Every inline SVG here is decorative (its control carries visible text or an
  // aria-label), so hide them from assistive tech and drop any stray tab stop.
  document.querySelectorAll('svg:not([aria-hidden])').forEach(s => {
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
  });
  initTheme();
  initInstall();

  // sensible defaults for rate/term so the fields read clearly
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && !el.value) el.value = v; };
  setVal("rep-rate", DEFAULT_RATE); setVal("rep-years", DEFAULT_TERM);
  setVal("aff-rate", DEFAULT_RATE); setVal("aff-years", DEFAULT_TERM);

  $$(".tab").forEach(t => t.addEventListener("click", () => selectTab(t.dataset.tab)));
  // ARIA tabs keyboard model: arrow keys / Home / End move between tabs.
  $(".tabs")?.addEventListener("keydown", e => {
    const i = TAB_ORDER.indexOf(activeTab);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % TAB_ORDER.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TAB_ORDER.length - 1;
    if (j >= 0) { e.preventDefault(); selectTab(TAB_ORDER[j], true); }
  });
  ["transfer-price", "bond-loan", "rep-loan", "aff-gross", "aff-expenses", "aff-deposit"].forEach(attachMoney);
  ["rep-rate", "rep-years", "aff-rate", "aff-years"].forEach(attachNumber);

  document.addEventListener("click", e => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const action = a.dataset.action;
    if (action === "share") shareActive();
    else if (action === "quote") openQuote();
    else if (action === "close-modal") closeModal(a.dataset.target);
  });
  $$(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m) closeModal(m.id); }));

  $("#share-whatsapp")?.addEventListener("click", () => doShare("whatsapp"));
  $("#share-email")?.addEventListener("click", () => doShare("email"));
  $("#share-download")?.addEventListener("click", () => doShare("download"));
  $("#contact-phone")?.addEventListener("click", (e) => { e.preventDefault(); openCallSheet(); });

  const form = $("#lead-form");
  form?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!validateLead(form)) return;
    const submit = $("#lead-submit");
    submit.classList.add("is-busy");
    const data = Object.fromEntries(new FormData(form).entries());
    const result = await sendLead(data);
    submit.classList.remove("is-busy");
    if (result === "mailto") {
      toast("Opening your email app…"); closeModal("lead-modal"); form.reset();
    } else if (result) {
      form.style.display = "none";
      $("#lead-success").classList.add("show");
      toast("Enquiry sent to HSG Attorneys");
      setTimeout(() => { closeModal("lead-modal"); form.reset(); form.style.display = ""; $("#lead-success").classList.remove("show"); }, 2600);
    } else {
      toast("Could not send — please use the email option.");
    }
  });
  /* "Chat on WhatsApp" — same form, different destination.
   *
   * Order matters: we record the lead on our own server BEFORE handing off to
   * WhatsApp. wa.me only opens a PRE-FILLED DRAFT; if the client never presses
   * send, or WhatsApp isn't installed, the enquiry would otherwise vanish with
   * no trace — the exact failure mode that cost real clients today. Logging
   * first means the firm still sees it in leads.php either way.
   *
   * The window is opened synchronously from the click (before any await), or
   * mobile browsers treat it as an unrequested popup and block it. */
  $("#lead-whatsapp")?.addEventListener("click", async () => {
    if (!validateLead(form)) return;
    const data = Object.fromEntries(new FormData(form).entries());

    const url = waLink(waQuoteMessage(data));
    if (!url) { toast("Message us on " + SITE.whatsapp); return; }

    /* The two environments need opposite ordering:
     *
     * Browser tab — open the chat FIRST, inside the user gesture, or the
     * anchor click risks being treated as an unrequested popup. The page
     * stays alive in the background, so the logging below still completes.
     *
     * Installed PWA — openWhatsApp() navigates this window away, which kills
     * any in-flight request. So log FIRST and await it, then hand off. There
     * is no popup permission to lose: a same-window navigation never needs
     * user activation. */
    const standalone = matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (!standalone) openWhatsApp(url);

    const btn = $("#lead-whatsapp");
    btn.classList.add("is-busy");
    try { await sendLead(Object.assign({}, data, { channel: "whatsapp" })); }
    catch { /* never block the chat on our own logging */ }
    btn.classList.remove("is-busy");

    toast("Opening WhatsApp — press send in the chat");
    closeModal("lead-modal");
    form.reset();

    if (standalone) openWhatsApp(url);
  });

  form?.querySelectorAll("input").forEach(inp =>
    inp.addEventListener("input", () => inp.closest(".field")?.classList.remove("has-error")));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") $$(".modal.open").forEach(m => closeModal(m.id));
    else trapFocus(e);
  });

  // Pull the firm's live rates (tariffs.json). Baked-in values are the offline fallback.
  loadRemoteRates().then((applied) => { if (applied) recompute(activeTab); }).catch(() => {});

  registerSW();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
// internal build marker: mhb-tariffwarden-0ea3e67e6352403aaee8b0d785d5b35f
