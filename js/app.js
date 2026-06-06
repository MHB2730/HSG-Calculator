// =====================================================================
// HSG Property — app logic.
// UI/behaviour from the approved design; CALCULATIONS come from the
// verified engine in tariffs.js (exact parity with the HSG website).
// =====================================================================
import {
  transferCostBreakdown, bondCostBreakdown, bondRepayment, affordability, CONFIG,
} from './tariffs.js';

/* ---------- Site settings (edit me — no coding needed) ---------- */
const SITE = {
  appName: "HSG Property",
  firmName: "HSG Attorneys",
  tagline: "Property cost & bond toolkit",
  disclaimer: "These calculators provide estimates for guidance only and do not constitute a formal quotation or legal advice. Figures are based on current published tariffs and may change — contact HSG Attorneys for a formal quote.",
  phone: "+27 21 271 0900",               // shown on the "Call HSG" button (empty hides it)
  email: "legal@hsginc.co.za",            // lead destination + mailto fallback address
  website: "https://hsgattorneys.co.za",
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

// "R 1 234 567" — South African spacing, rounded
const groupR = n => "R " + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

function recompute(which) {
  const c = CALC[which];
  const data = c.fn();
  paint(c.out, data ? (c.kind === "breakdown" ? renderBreakdown(data) : renderHeadline(data)) : "");
  return data;
}

/* ---------- Tabs ---------- */
let activeTab = "transfer";
function selectTab(name) {
  activeTab = name;
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  const map = { transfer: "panel-transfer", bond: "panel-bond", repayment: "panel-repayment", afford: "panel-afford" };
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
    const digits = el.value.replace(/[^\d]/g, "");
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
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add("open"); document.body.classList.add("modal-open");
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("open");
  if (!$$(".modal.open").length) document.body.classList.remove("modal-open");
}
function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Share ---------- */
async function shareActive() {
  const text = scenarioText();
  if (navigator.share) {
    try { await navigator.share({ title: SITE.firmName + " estimate", text }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  openModal("share-sheet");
}
function doShare(method) {
  const text = scenarioText();
  if (method === "whatsapp") window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  else if (method === "email") window.location.href = "mailto:?subject=" + encodeURIComponent(SITE.firmName + " property estimate") + "&body=" + encodeURIComponent(text);
  else if (method === "copy") navigator.clipboard?.writeText(text).then(() => toast("Estimate copied to clipboard"), () => toast("Could not copy"));
  closeModal("share-sheet");
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
  const check = (name, valid) => {
    const field = form.querySelector(`[name="${name}"]`).closest(".field");
    if (field) field.classList.toggle("has-error", !valid);
    if (!valid) ok = false;
  };
  check("name", form.name.value.trim().length > 1);
  check("phone", form.phone.value.replace(/\D/g, "").length >= 7);
  check("email", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.value.trim()));
  if (!form.consent.checked) { ok = false; toast("Please accept the POPIA consent to continue"); }
  return ok;
}
async function sendLead(data) {
  const subject = `New property enquiry — ${data.name || "website visitor"}`;
  const body =
    `Name: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email}\n\n` +
    `--- Calculation ---\n${data.scenario}\n\nSent from the ${SITE.appName} app.`;

  // 1) Web3Forms (only if a key is configured)
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

  // 2) Same-origin PHP endpoint (works on cPanel hosting — no key needed)
  try {
    const res = await fetch("./submit.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name, phone: data.phone, email: data.email,
        scenario: data.scenario, company: data.company || "",
      }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.success) return true;
    }
  } catch { /* fall through */ }

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

/* ---------- Install / iOS hint ---------- */
let deferredPrompt = null;
function initInstall() {
  const banner = $("#install-banner"), iosHint = $("#ios-hint");
  const dismissed = localStorage.getItem("hsg-install-dismissed");
  const standalone = matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferredPrompt = e;
    if (!dismissed && banner) banner.classList.remove("is-hidden");
  });
  // iOS has no install prompt — show the Add-to-Home-Screen hint instead.
  if (isIOS && !standalone && !dismissed && iosHint) {
    setTimeout(() => iosHint.classList.remove("is-hidden"), 1200);
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
    iosHint?.classList.add("is-hidden"); localStorage.setItem("hsg-install-dismissed", "1");
  });
}

/* ---------- Site content fill ---------- */
function fillSite() {
  $$("[data-site]").forEach(el => { if (SITE[el.dataset.site] != null) el.textContent = SITE[el.dataset.site]; });
  $("#year").textContent = new Date().getFullYear();
  const phone = $("#contact-phone");
  if (phone) {
    if (SITE.phone) { phone.href = "tel:" + SITE.phone.replace(/\s/g, ""); phone.classList.remove("is-hidden"); }
    else phone.classList.add("is-hidden");
  }
  const web = $("#contact-web");
  if (web) web.href = SITE.website;
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
  initTheme();
  initInstall();

  // sensible defaults for rate/term so the fields read clearly
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && !el.value) el.value = v; };
  setVal("rep-rate", DEFAULT_RATE); setVal("rep-years", DEFAULT_TERM);
  setVal("aff-rate", DEFAULT_RATE); setVal("aff-years", DEFAULT_TERM);

  $$(".tab").forEach(t => t.addEventListener("click", () => selectTab(t.dataset.tab)));
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
  $("#share-copy")?.addEventListener("click", () => doShare("copy"));

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
  form?.querySelectorAll("input").forEach(inp =>
    inp.addEventListener("input", () => inp.closest(".field")?.classList.remove("has-error")));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") $$(".modal.open").forEach(m => closeModal(m.id));
  });

  registerSW();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
