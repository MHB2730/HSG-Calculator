/*
 * Copyright (c) 2026 HSG Attorneys Incorporated. All rights reserved.
 * Part of HSG Calculator. Unauthorised copying, modification or distribution is prohibited.
 */
// Quick sanity check of the calculation brain against known values.
import {
  transferDuty, attorneyFee, transferDeedsFee, bondDeedsFee,
  transferCostBreakdown, bondCostBreakdown, bondRepayment, affordability,
} from '../js/tariffs.js';

const R = (n) => 'R ' + Math.round(n).toLocaleString('en-ZA');
const prices = [1000000, 2000000, 3000000, 5000000];

console.log('=== Transfer duty (SARS) ===');
for (const p of prices) console.log(R(p), '→ duty', R(transferDuty(p)));

console.log('\n=== Attorney fee (LSSA) ===');
for (const p of prices) console.log(R(p), '→ fee', R(attorneyFee(p)));

console.log('\n=== Deeds Office (transfer / bond) ===');
for (const p of prices) console.log(R(p), '→ transfer', R(transferDeedsFee(p)), '| bond', R(bondDeedsFee(p)));

console.log('\n=== Full transfer cost breakdown ===');
for (const p of prices) {
  const b = transferCostBreakdown(p);
  console.log(`\nPrice ${R(p)}  → total costs ${R(b.total)}  → grand total ${R(b.grandTotal)}`);
  for (const i of b.items) console.log('   ', i.label.padEnd(32), R(i.amount));
}

console.log('\n=== Full bond cost breakdown ===');
for (const p of prices) {
  const b = bondCostBreakdown(p);
  console.log(`Loan ${R(p)} → total bond costs ${R(b.total)} (loan+costs ${R(b.totalWithLoan)})`);
}

console.log('\n=== Bond repayment (R1m @ 11% / 20yr) ===');
const rep = bondRepayment(1000000, 11, 20);
console.log('monthly', R(rep.monthly), '| total interest', R(rep.totalInterest));

console.log('\n=== Affordability (gross 50k, exp 15k, 11%, 20yr) ===');
const aff = affordability({ grossIncome: 50000, expenses: 15000, annualRatePct: 11, years: 20 });
console.log('instalment', R(aff.affordableInstalment), '| max loan', R(aff.maxLoan), '| price', R(aff.indicativePrice));
