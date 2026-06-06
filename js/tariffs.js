/*
 * tariffs.js — THE CALCULATION BRAIN
 * -----------------------------------
 * Every number the app uses lives in this one file. When SARS, the LSSA
 * attorney tariff, or the Deeds Office fees change, edit the values in CONFIG
 * below and every calculator updates automatically. Nothing else needs to change.
 *
 * The transfer-cost and bond-cost logic below is an EXACT copy of the formulas
 * used on the live HSG website calculator (hsgattorneys.co.za/conveyancing-calculator),
 * so this app always agrees with the firm. Sources are noted per item.
 */

export const CONFIG = {
  // --- General ---
  vatRate: 0.15, // 15% VAT on attorney fees

  // --- Fixed disbursements on a TRANSFER (rands) ---
  transfer: {
    rateCertificateFee: 830, // municipal rates clearance certificate
    disbursementsFee: 1900, // postage, petties, deeds search, etc.
    ficaFee: 520, // FICA compliance
  },

  // --- Fixed disbursements on a BOND registration (rands) ---
  bond: {
    disbursementsFee: 1900,
  },

  // --- SARS transfer duty sliding scale (current table, effective 1 Apr 2026) ---
  // Each row: [upper limit of band, base duty at start of band, % on the excess above 'from'].
  dutyBands: [
    { from: 0, upTo: 1210000, base: 0, rate: 0 },
    { from: 1210000, upTo: 1663800, base: 0, rate: 0.03 },
    { from: 1663800, upTo: 2329300, base: 13614, rate: 0.06 },
    { from: 2329300, upTo: 2994800, base: 53544, rate: 0.08 },
    { from: 2994800, upTo: 13310000, base: 106784, rate: 0.11 },
    { from: 13310000, upTo: Infinity, base: 1241456, rate: 0.13 },
  ],

  // --- LSSA recommended conveyancing fee (effective 1 Aug 2025) ---
  // The SAME formula is used by HSG for both the transfer fee and the bond fee.
  lssaFee(amount) {
    if (amount <= 0) return 0;
    if (amount <= 100000) return 6640;
    if (amount <= 500000) {
      // R6 640 + R1 060 per R50 000 (or part) above R100 000
      return 6640 + 1060 * Math.ceil((amount - 100000) / 50000);
    }
    if (amount <= 1000000) {
      // R15 120 for the first R500 000 + R2 050 per R100 000 (or part) above
      return 15120 + 2050 * Math.ceil((amount - 500000) / 100000);
    }
    if (amount <= 5000000) {
      // R25 370 for the first R1m + R2 050 per R200 000 (or part) above
      return 25370 + 2050 * Math.ceil((amount - 1000000) / 200000);
    }
    // Over R5m: R66 370 for the first R5m + R5 160 per R1m (or part) above
    return 66370 + 5160 * Math.ceil((amount - 5000000) / 1000000);
  },

  // --- Deeds Office registration fees (gazette 52191) ---
  // TRANSFER (Item 1(b)): [upper limit of band, fee]. Last row applies above the table.
  deedsTransferBands: [
    [100000, 50], [200000, 114], [300000, 727], [600000, 956],
    [800000, 1346], [1000000, 1546], [2000000, 1738], [4000000, 2408],
    [6000000, 2922], [8000000, 3480], [10000000, 4068], [15000000, 4844],
    [20000000, 5818], [Infinity, 7751],
  ],
  // BOND (Item 1(c)): [upper limit of band, fee].
  deedsBondBands: [
    [150000, 561], [300000, 727], [600000, 956], [800000, 1346],
    [1000000, 1546], [2000000, 1738], [4000000, 2408], [6000000, 2922],
    [8000000, 3480], [10000000, 4068], [15000000, 4844], [20000000, 5818],
    [30000000, 6781], [Infinity, 9690],
  ],

  // --- Bond repayment / affordability defaults ---
  defaultInterestRate: 11.0, // prime-ish default %, user can change
  defaultTermYears: 20,
  affordabilityIncomeRule: 0.30, // banks lend ~30% of gross monthly income to a bond
};

// ---------- core lookups ----------

/** SARS transfer duty for a purchase price. */
export function transferDuty(price) {
  if (!price || price <= 0) return 0;
  for (const b of CONFIG.dutyBands) {
    if (price <= b.upTo) return b.base + b.rate * (price - b.from);
  }
  return 0;
}

/** LSSA attorney fee (used for both transfer and bond). */
export function attorneyFee(amount) {
  return CONFIG.lssaFee(amount);
}

function bandLookup(bands, amount) {
  for (const [upper, fee] of bands) {
    if (amount <= upper) return fee;
  }
  return 0;
}

export function transferDeedsFee(price) {
  return bandLookup(CONFIG.deedsTransferBands, price);
}

export function bondDeedsFee(loan) {
  return bandLookup(CONFIG.deedsBondBands, loan);
}

// ---------- itemised breakdowns ----------

/**
 * Full transfer-cost breakdown for a purchase price.
 * Mirrors hsg_calculate() on the live site.
 */
export function transferCostBreakdown(price) {
  price = Math.max(0, Number(price) || 0);
  const duty = transferDuty(price);
  const fee = attorneyFee(price);
  const vat = fee * CONFIG.vatRate;
  const deeds = transferDeedsFee(price);
  const { rateCertificateFee, disbursementsFee, ficaFee } = CONFIG.transfer;

  const items = [
    { label: 'Transfer duty (SARS)', amount: duty, note: 'Tax on property over R1,210,000' },
    { label: 'Conveyancing (transfer) fee', amount: fee, note: 'Attorney fee — LSSA tariff' },
    { label: 'VAT on attorney fee', amount: vat, note: '15%' },
    { label: 'Deeds Office fee', amount: deeds, note: 'Registration of transfer' },
    { label: 'Rates clearance certificate', amount: rateCertificateFee, note: 'From the municipality' },
    { label: 'Disbursements', amount: disbursementsFee, note: 'Postage, petties, deeds search' },
    { label: 'FICA compliance', amount: ficaFee, note: 'Identity & verification' },
  ];

  const total = price > 0 ? items.reduce((s, i) => s + i.amount, 0) : 0;
  return { price, items, total, grandTotal: price + total };
}

/**
 * Full bond-registration breakdown for a loan amount.
 * Mirrors calculateBondCosts() on the live site.
 */
export function bondCostBreakdown(loan) {
  loan = Math.max(0, Number(loan) || 0);
  const fee = attorneyFee(loan);
  const vat = fee * CONFIG.vatRate;
  const deeds = bondDeedsFee(loan);
  const disbursementsFee = CONFIG.bond.disbursementsFee;

  const items = [
    { label: 'Bond registration fee', amount: fee, note: 'Attorney fee — LSSA tariff' },
    { label: 'VAT on attorney fee', amount: vat, note: '15%' },
    { label: 'Deeds Office fee', amount: deeds, note: 'Registration of bond' },
    { label: 'Disbursements', amount: disbursementsFee, note: 'Postage, petties' },
  ];

  const total = loan > 0 ? items.reduce((s, i) => s + i.amount, 0) : 0;
  return { loan, items, total, totalWithLoan: loan + total };
}

// ---------- bond repayment & affordability ----------

/** Monthly instalment using the standard amortisation formula. */
export function bondRepayment(loan, annualRatePct, years) {
  loan = Math.max(0, Number(loan) || 0);
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  const n = (Number(years) || 0) * 12;
  if (loan <= 0 || n <= 0) return { monthly: 0, totalRepay: 0, totalInterest: 0 };
  let monthly;
  if (r === 0) {
    monthly = loan / n;
  } else {
    monthly = (loan * r) / (1 - Math.pow(1 + r, -n));
  }
  const totalRepay = monthly * n;
  return { monthly, totalRepay, totalInterest: totalRepay - loan };
}

/**
 * Rough affordability — what bond/price a buyer might qualify for.
 * Clearly an estimate; banks assess each applicant individually.
 */
export function affordability({ grossIncome, expenses = 0, annualRatePct, years, deposit = 0 }) {
  grossIncome = Math.max(0, Number(grossIncome) || 0);
  expenses = Math.max(0, Number(expenses) || 0);
  deposit = Math.max(0, Number(deposit) || 0);
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  const n = (Number(years) || 0) * 12;

  const byIncomeRule = CONFIG.affordabilityIncomeRule * grossIncome;
  const disposable = grossIncome - expenses;
  const affordableInstalment = Math.max(0, Math.min(byIncomeRule, disposable));

  let maxLoan = 0;
  if (affordableInstalment > 0 && n > 0) {
    maxLoan = r === 0
      ? affordableInstalment * n
      : (affordableInstalment * (1 - Math.pow(1 + r, -n))) / r;
  }
  return {
    affordableInstalment,
    maxLoan,
    indicativePrice: maxLoan + deposit,
  };
}
