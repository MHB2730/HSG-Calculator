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
const clone = (x) => JSON.parse(JSON.stringify(x),
  (k, v) => (v === null && (k === 'upTo' || k === '0') ? Infinity : v));

// Verified current values (1 Apr 2026 SARS/Deeds, 1 Aug 2025 LSSA). Offline fallback.
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
  lssaBands: [
    { from: 0, upTo: 100000, base: 6640, per: 0, step: 1 },
    { from: 100000, upTo: 500000, base: 6640, per: 1060, step: 50000 },
    { from: 500000, upTo: 1000000, base: 15120, per: 2050, step: 100000 },
    { from: 1000000, upTo: 5000000, base: 25370, per: 2050, step: 200000 },
    { from: 5000000, upTo: Infinity, base: 66370, per: 5160, step: 1000000 },
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

// ---------- remote rates (tariffs.json) ----------
const isNum = (v) => typeof v === 'number' && isFinite(v);
const upper = (v) => (v === null || v === undefined ? Infinity : (isNum(v) ? v : NaN));

/** Validate + apply a rates object (from tariffs.json). Bad sections are ignored
 *  (the verified defaults stay), so a typo can never break the calculator. */
export function setRates(json) {
  if (!json || typeof json !== 'object') return false;
  const next = clone(DEFAULTS);

  if (isNum(json.vatRate)) next.vatRate = json.vatRate;
  if (isNum(json.affordabilityIncomeRule)) next.affordabilityIncomeRule = json.affordabilityIncomeRule;
  if (json.transfer && typeof json.transfer === 'object') {
    for (const k of ['rateCertificateFee', 'disbursementsFee', 'ficaFee']) {
      if (isNum(json.transfer[k])) next.transfer[k] = json.transfer[k];
    }
  }
  if (json.bond && isNum(json.bond.disbursementsFee)) next.bond.disbursementsFee = json.bond.disbursementsFee;

  const okU = (v) => !Number.isNaN(upper(v)); // valid upper limit: a finite number or Infinity (null)

  if (Array.isArray(json.dutyBands) && json.dutyBands.length &&
      json.dutyBands.every((x) => x && isNum(x.from) && isNum(x.base) && isNum(x.rate) && okU(x.upTo))) {
    next.dutyBands = json.dutyBands.map((x) => ({ from: x.from, upTo: upper(x.upTo), base: x.base, rate: x.rate }));
  }
  if (Array.isArray(json.lssaBands) && json.lssaBands.length &&
      json.lssaBands.every((x) => x && isNum(x.from) && isNum(x.base) && isNum(x.per) && isNum(x.step) && x.step !== 0 && okU(x.upTo))) {
    next.lssaBands = json.lssaBands.map((x) => ({ from: x.from, upTo: upper(x.upTo), base: x.base, per: x.per, step: x.step }));
  }
  const validPairs = (arr) => Array.isArray(arr) && arr.length && arr.every((p) => Array.isArray(p) && isNum(p[1]) && okU(p[0]));
  if (validPairs(json.deedsTransferBands)) next.deedsTransferBands = json.deedsTransferBands.map((p) => [upper(p[0]), p[1]]);
  if (validPairs(json.deedsBondBands)) next.deedsBondBands = json.deedsBondBands.map((p) => [upper(p[0]), p[1]]);

  RATES = next;
  return true;
}

/** Fetch the firm's tariffs.json and apply it. Returns true if applied. */
export async function loadRemoteRates(url = './tariffs.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    return setRates(await res.json());
  } catch { return false; }
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
  for (const [upperLimit, fee] of bands) {
    if (amount <= upperLimit) return fee;
  }
  return 0;
}

export function transferDeedsFee(price) { return bandLookup(RATES.deedsTransferBands, price); }
export function bondDeedsFee(loan) { return bandLookup(RATES.deedsBondBands, loan); }

// ---------- itemised breakdowns ----------

export function transferCostBreakdown(price) {
  price = Math.max(0, Number(price) || 0);
  const duty = transferDuty(price);
  const fee = attorneyFee(price);
  const vat = fee * RATES.vatRate;
  const deeds = transferDeedsFee(price);
  const { rateCertificateFee, disbursementsFee, ficaFee } = RATES.transfer;
  const threshold = isFinite(RATES.dutyBands[0]?.upTo) ? RATES.dutyBands[0].upTo : 0;

  const items = [
    { label: 'Transfer duty (SARS)', amount: duty, note: 'Tax on property over R' + threshold.toLocaleString('en-ZA') },
    { label: 'Conveyancing (transfer) fee', amount: fee, note: 'Attorney fee — LSSA tariff' },
    { label: 'VAT on attorney fee', amount: vat, note: (RATES.vatRate * 100) + '%' },
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
    { label: 'VAT on attorney fee', amount: vat, note: (RATES.vatRate * 100) + '%' },
    { label: 'Deeds Office fee', amount: deeds, note: 'Registration of bond' },
    { label: 'Disbursements', amount: disbursementsFee, note: 'Postage, petties' },
  ];
  const total = loan > 0 ? items.reduce((s, i) => s + i.amount, 0) : 0;
  return { loan, items, total, totalWithLoan: loan + total };
}

// ---------- bond repayment & affordability ----------

export function bondRepayment(loan, annualRatePct, years) {
  loan = Math.max(0, Number(loan) || 0);
  const r = (Number(annualRatePct) || 0) / 100 / 12;
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
  const r = (Number(annualRatePct) || 0) / 100 / 12;
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
