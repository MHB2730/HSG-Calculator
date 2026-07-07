/*
 * tariffs.js — THE CALCULATION BRAIN
 * -----------------------------------
 * All rates live in DEFAULTS below (the verified, current values) AND can be
 * overridden at runtime by a small firm-hosted file `tariffs.json`, fetched on
 * startup. So to update fees when SARS / the LSSA tariff / the Deeds Office
 * change, the firm edits ONE small JSON file on the host — every installed app
 * picks it up on the next online load. The baked-in DEFAULTS are the offline
 * fallback, so the app always works (and is correct as at the last release).
 *
 * The transfer/bond logic is an EXACT copy of the live HSG website calculator.
 */

// Deep clone that preserves Infinity (JSON turns it into null on stringify; we
// restore it for band upper-limit keys: object `upTo` and array-pair index `0`).
export const clone = (x) => JSON.parse(JSON.stringify(x),
  (k, v) => (v === null && (k === 'upTo' || k === '0') ? Infinity : v));

// Verified current values (1 Apr 2026 SARS/Deeds, 1 Jul 2026 LSSA). Offline fallback.
const DEFAULTS = {
  vatRate: 0.15,
  affordabilityIncomeRule: 0.30, // banks lend ~30% of gross monthly income to a bond

  transfer: { rateCertificateFee: 830, disbursementsFee: 1900, ficaFee: 520 },
  bond: { disbursementsFee: 1900 },

  // SARS transfer duty: row = { from, upTo, base, rate }. (upTo: Infinity = "and above")
  dutyBands: [
    { from: 0, upTo: 1210000, base: 0, rate: 0 },
    { from: 1210000, upTo: 1663800, base: 0, rate: 0.03 },
    { from: 1663800, upTo: 2329300, base: 13614, rate: 0.06 },
    { from: 2329300, upTo: 2994800, base: 53544, rate: 0.08 },
    { from: 2994800, upTo: 13310000, base: 106784, rate: 0.11 },
    { from: 13310000, upTo: Infinity, base: 1241456, rate: 0.13 },
  ],

  // LSSA conveyancing fee (same scale for transfer + bond) expressed as data:
  // fee = base + per * ceil((amount - from) / step), for the band where amount <= upTo.
  // Schedule 2026, effective 1 Jul 2026 (CPI ref Jan 2026, 3.5%).
  lssaBands: [
    { from: 0, upTo: 100000, base: 6875, per: 0, step: 1 },
    { from: 100000, upTo: 500000, base: 6875, per: 1100, step: 50000 },
    { from: 500000, upTo: 1000000, base: 15675, per: 2120, step: 100000 },
    { from: 1000000, upTo: 5000000, base: 26275, per: 2120, step: 200000 },
    { from: 5000000, upTo: Infinity, base: 68675, per: 5340, step: 1000000 },
  ],

  // Deeds Office fees (Gazette 54225 / GN 7180, 1 Apr 2026): [upper limit, fee].
  deedsTransferBands: [
    [100000, 50], [200000, 114], [300000, 727], [600000, 956],
    [800000, 1346], [1000000, 1546], [2000000, 1738], [4000000, 2408],
    [6000000, 2922], [8000000, 3480], [10000000, 4068], [15000000, 4844],
    [20000000, 5818], [Infinity, 7751],
  ],
  deedsBondBands: [
    [150000, 561], [300000, 727], [600000, 956], [800000, 1346],
    [1000000, 1546], [2000000, 1738], [4000000, 2408], [6000000, 2922],
    [8000000, 3480], [10000000, 4068], [15000000, 4844], [20000000, 5818],
    [30000000, 6781], [Infinity, 9690],
  ],
};

let RATES = clone(DEFAULTS); // active rates (may be overridden by tariffs.json)

// The baked-in defaults, normalised (null->Infinity) — exported so tests can assert
// tariffs.json is structurally identical to DEFAULTS (not just equal on sampled totals).
export const DEFAULT_RATES = clone(DEFAULTS);

// ---------- remote rates (tariffs.json) ----------
const isNum = (v) => typeof v === 'number' && isFinite(v);
const upper = (v) => (v === null || v === undefined ? Infinity : (isNum(v) ? v : NaN));
const okU = (v) => !Number.isNaN(upper(v)); // valid upper limit: a finite number or Infinity (null)

// A list of band upper-limits is well-formed only if every limit is a valid
// number or Infinity, they STRICTLY ASCEND, only the LAST may be Infinity, and
// the last one MUST be Infinity — the top band has to be open-ended ("and above").
// (Guards against a stray null in a middle band swallowing every higher band,
//  reordered bands defeating the "amount <= upTo" linear scan, AND a finite top
//  limit that would make every lookup fall through and silently return R0 above
//  it — a catastrophic under-quote on the largest deals.)
function ascendingLimits(limits) {
  if (!limits.length || isFinite(limits[limits.length - 1])) return false; // top band must be "and above"
  for (let i = 0; i < limits.length; i++) {
    const u = limits[i];
    if (Number.isNaN(u)) return false;
    if (!isFinite(u) && i !== limits.length - 1) return false; // Infinity: last band only
    if (i > 0 && !(u > limits[i - 1])) return false;           // strictly ascending
  }
  return true;
}

// {from,upTo,...} bands must be contiguous: each `from` >= 0, `from` < its own
// `upTo`, and equal to the previous band's `upTo` (no gaps, no overlaps). This
// makes the linear "amount <= upTo" scan and the base+rate continuity exact.
function contiguousBands(bands) {
  const limits = bands.map((b) => upper(b.upTo));
  if (!ascendingLimits(limits)) return false;
  if (bands[0].from !== 0) return false; // must start at 0 — no untaxed gap below the first band
  for (let i = 0; i < bands.length; i++) {
    if (!(bands[i].from >= 0) || !(bands[i].from < limits[i])) return false;
    if (i > 0 && bands[i].from !== limits[i - 1]) return false;
  }
  return true;
}

// Section-level validity predicates (types AND semantics: sign, ordering, contiguity).
// Duty bands additionally require BASE CONTINUITY: each band's `base` must equal the
// duty accumulated by the previous band at the boundary (base[i] = base[i-1] +
// rate[i-1] * (upTo[i-1] - from[i-1])). Otherwise a base typo makes the duty jump or
// drop discontinuously at a band edge — a silent mispricing the linear scan can't catch.
const validDutyBands = (a) => Array.isArray(a) && a.length &&
  a.every((x) => x && isNum(x.from) && isNum(x.base) && isNum(x.rate) && okU(x.upTo) &&
    x.from >= 0 && x.base >= 0 && x.rate >= 0) && contiguousBands(a) &&
  a.every((x, i) => i === 0
    ? x.base === 0
    : Math.abs(x.base - (a[i - 1].base + a[i - 1].rate * (upper(a[i - 1].upTo) - a[i - 1].from))) <= 1e-6);
const validLssaBands = (a) => Array.isArray(a) && a.length &&
  a.every((x) => x && isNum(x.from) && isNum(x.base) && isNum(x.per) && isNum(x.step) &&
    x.from >= 0 && x.base >= 0 && x.per >= 0 && x.step > 0 && okU(x.upTo)) && contiguousBands(a);
const validPairs = (a) => Array.isArray(a) && a.length &&
  a.every((p) => Array.isArray(p) && isNum(p[1]) && p[1] >= 0 && okU(p[0])) &&
  ascendingLimits(a.map((p) => upper(p[0])));

// The last setRates() outcome: which named sections were applied, and which were
// PRESENT in the file but REJECTED (so a mistyped fee update is never silent —
// loadRemoteRates warns, and scripts/check-tariffs.mjs reports it before deploy).
let lastReport = { applied: [], rejected: [] };
export function getRatesReport() { return lastReport; }

/** Validate + apply a rates object (from tariffs.json). Bad sections are ignored
 *  (the verified defaults stay), so a typo — a negative fee, a reordered or
 *  overlapping band, a stray null — can never break or silently corrupt the
 *  calculator. Validation covers both TYPES and SEMANTICS (sign, ordering,
 *  contiguity). Returns true if the input was a usable object; call
 *  getRatesReport() to see which sections applied vs were rejected. */
export function setRates(json) {
  lastReport = { applied: [], rejected: [] };
  if (!json || typeof json !== 'object') return false;
  const next = clone(DEFAULTS);
  const has = (k) => Object.prototype.hasOwnProperty.call(json, k) && json[k] != null;
  // Record a present section as applied (and run its setter) or rejected.
  const section = (k, ok, apply) => {
    if (!has(k)) return;
    if (ok) { apply(); lastReport.applied.push(k); } else lastReport.rejected.push(k);
  };

  section('vatRate', isNum(json.vatRate) && json.vatRate >= 0 && json.vatRate < 1,
    () => { next.vatRate = json.vatRate; });
  section('affordabilityIncomeRule',
    isNum(json.affordabilityIncomeRule) && json.affordabilityIncomeRule > 0 && json.affordabilityIncomeRule <= 1,
    () => { next.affordabilityIncomeRule = json.affordabilityIncomeRule; });
  // transfer fees: apply each valid key independently (a typo in one must not
  // discard the firm's valid edits to the others), but still REPORT the section as
  // rejected if any present key was invalid, so the warning + check-tariffs catch it.
  if (has('transfer')) {
    if (typeof json.transfer === 'object') {
      let anyBad = false;
      for (const k of ['rateCertificateFee', 'disbursementsFee', 'ficaFee']) {
        if (json.transfer[k] == null) continue;
        if (isNum(json.transfer[k]) && json.transfer[k] >= 0) next.transfer[k] = json.transfer[k];
        else anyBad = true;
      }
      lastReport[anyBad ? 'rejected' : 'applied'].push('transfer');
    } else lastReport.rejected.push('transfer');
  }
  section('bond', json.bond && typeof json.bond === 'object' &&
    (json.bond.disbursementsFee == null || (isNum(json.bond.disbursementsFee) && json.bond.disbursementsFee >= 0)),
    () => { if (isNum(json.bond.disbursementsFee) && json.bond.disbursementsFee >= 0) next.bond.disbursementsFee = json.bond.disbursementsFee; });

  section('dutyBands', validDutyBands(json.dutyBands),
    () => { next.dutyBands = json.dutyBands.map((x) => ({ from: x.from, upTo: upper(x.upTo), base: x.base, rate: x.rate })); });
  section('lssaBands', validLssaBands(json.lssaBands),
    () => { next.lssaBands = json.lssaBands.map((x) => ({ from: x.from, upTo: upper(x.upTo), base: x.base, per: x.per, step: x.step })); });
  section('deedsTransferBands', validPairs(json.deedsTransferBands),
    () => { next.deedsTransferBands = json.deedsTransferBands.map((p) => [upper(p[0]), p[1]]); });
  section('deedsBondBands', validPairs(json.deedsBondBands),
    () => { next.deedsBondBands = json.deedsBondBands.map((p) => [upper(p[0]), p[1]]); });

  RATES = next;
  return true;
}

/** Fetch the firm's tariffs.json and apply it. Returns true if applied. If the
 *  file loaded but a section was mistyped and ignored, warn loudly (so a fee
 *  update that silently didn't "take" is visible in the console, not invisible). */
export async function loadRemoteRates(url = './tariffs.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    const applied = setRates(await res.json());
    const rejected = getRatesReport().rejected;
    if (applied && rejected.length) {
      console.warn('[tariffs] tariffs.json loaded but these sections were INVALID and ignored (still using built-in defaults for them): ' + rejected.join(', '));
    }
    return applied;
  } catch (e) {
    console.warn('[tariffs] could not load/parse tariffs.json — using built-in defaults.', e);
    return false;
  }
}

// ---------- core lookups ----------

export function transferDuty(price) {
  if (!price || price <= 0) return 0;
  for (const b of RATES.dutyBands) {
    if (price <= b.upTo) return b.base + b.rate * (price - b.from);
  }
  return 0;
}

/** LSSA attorney fee (used for both transfer and bond). */
export function attorneyFee(amount) {
  amount = Number(amount) || 0;
  if (amount <= 0) return 0;
  for (const b of RATES.lssaBands) {
    if (amount <= b.upTo) return b.base + b.per * Math.ceil((amount - b.from) / b.step);
  }
  return 0;
}

function bandLookup(bands, amount) {
  if (!(amount > 0)) return 0; // no fee on zero/negative/NaN amounts
  for (const [upperLimit, fee] of bands) {
    if (amount <= upperLimit) return fee;
  }
  return 0;
}

export function transferDeedsFee(price) { return bandLookup(RATES.deedsTransferBands, price); }
export function bondDeedsFee(loan) { return bandLookup(RATES.deedsBondBands, loan); }

// ---------- itemised breakdowns ----------

// VAT rate as a clean % string: 0.15 -> "15%", 0.155 -> "15.5%" (never float noise
// like "14.000000000000002%"). Only formats the label; the computed VAT is untouched.
const vatPct = () => `${+(RATES.vatRate * 100).toFixed(2)}%`;

export function transferCostBreakdown(price) {
  price = Math.max(0, Number(price) || 0);
  const duty = transferDuty(price);
  const fee = attorneyFee(price);
  const vat = fee * RATES.vatRate;
  const deeds = transferDeedsFee(price);
  const { rateCertificateFee, disbursementsFee, ficaFee } = RATES.transfer;
  // Duty-free threshold = where the first taxable (rate > 0) band begins.
  const firstTaxable = RATES.dutyBands.find((b) => b.rate > 0);
  const threshold = firstTaxable ? firstTaxable.from : 0;

  const items = [
    { label: 'Transfer duty (SARS)', amount: duty, note: 'Tax on property over R' + threshold.toLocaleString('en-ZA') },
    { label: 'Conveyancing (transfer) fee', amount: fee, note: 'Attorney fee — LSSA tariff' },
    { label: 'VAT on attorney fee', amount: vat, note: vatPct() },
    { label: 'Deeds Office fee', amount: deeds, note: 'Registration of transfer' },
    { label: 'Rates clearance certificate', amount: rateCertificateFee, note: 'From the municipality' },
    { label: 'Disbursements', amount: disbursementsFee, note: 'Postage, petties, deeds search' },
    { label: 'FICA compliance', amount: ficaFee, note: 'Identity & verification' },
  ];
  const total = price > 0 ? items.reduce((s, i) => s + i.amount, 0) : 0;
  return { price, items, total, grandTotal: price + total };
}

export function bondCostBreakdown(loan) {
  loan = Math.max(0, Number(loan) || 0);
  const fee = attorneyFee(loan);
  const vat = fee * RATES.vatRate;
  const deeds = bondDeedsFee(loan);
  const disbursementsFee = RATES.bond.disbursementsFee;

  const items = [
    { label: 'Bond registration fee', amount: fee, note: 'Attorney fee — LSSA tariff' },
    { label: 'VAT on attorney fee', amount: vat, note: vatPct() },
    { label: 'Deeds Office fee', amount: deeds, note: 'Registration of bond' },
    { label: 'Disbursements', amount: disbursementsFee, note: 'Postage, petties' },
  ];
  const total = loan > 0 ? items.reduce((s, i) => s + i.amount, 0) : 0;
  return { loan, items, total, totalWithLoan: loan + total };
}

// ---------- bond repayment & affordability ----------

export function bondRepayment(loan, annualRatePct, years) {
  loan = Math.max(0, Number(loan) || 0);
  const r = Math.max(0, Number(annualRatePct) || 0) / 100 / 12;
  const n = (Number(years) || 0) * 12;
  if (loan <= 0 || n <= 0) return { monthly: 0, totalRepay: 0, totalInterest: 0 };
  const monthly = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  const totalRepay = monthly * n;
  return { monthly, totalRepay, totalInterest: totalRepay - loan };
}

export function affordability({ grossIncome, expenses = 0, annualRatePct, years, deposit = 0 }) {
  grossIncome = Math.max(0, Number(grossIncome) || 0);
  expenses = Math.max(0, Number(expenses) || 0);
  deposit = Math.max(0, Number(deposit) || 0);
  const r = Math.max(0, Number(annualRatePct) || 0) / 100 / 12;
  const n = (Number(years) || 0) * 12;

  const byIncomeRule = RATES.affordabilityIncomeRule * grossIncome;
  const disposable = grossIncome - expenses;
  const affordableInstalment = Math.max(0, Math.min(byIncomeRule, disposable));

  let maxLoan = 0;
  if (affordableInstalment > 0 && n > 0) {
    maxLoan = r === 0 ? affordableInstalment * n : (affordableInstalment * (1 - Math.pow(1 + r, -n))) / r;
  }
  return { affordableInstalment, maxLoan, indicativePrice: maxLoan + deposit };
}
