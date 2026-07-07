// check-tariffs.mjs — run this after editing tariffs.json, BEFORE you upload it.
//
//   node scripts/check-tariffs.mjs            (checks ./tariffs.json)
//   node scripts/check-tariffs.mjs path.json  (checks another file)
//
// It confirms the file is valid JSON, that EVERY section was accepted (a mistyped
// section is otherwise silently ignored and the app keeps the OLD built-in fees),
// and prints the resulting fees at sample prices so you can eyeball the new rates.
// Exit code 0 = safe to deploy; 1 = something is wrong, do not upload.
import { readFileSync } from 'node:fs';
import {
  setRates, getRatesReport, transferCostBreakdown, bondCostBreakdown, attorneyFee,
} from '../js/tariffs.js';

const path = process.argv[2] || new URL('../tariffs.json', import.meta.url);
const R = (n) => 'R ' + Math.round(n).toLocaleString('en-ZA');
let problems = 0;

// 1) Valid JSON? (trailing comma / bad quote is the most common edit mistake.)
let json;
try {
  json = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.error('X  tariffs.json is not valid JSON — fix this first:\n   ' + e.message);
  console.error('   (Common causes: a trailing comma, a missing comma, or a stray quote.)');
  process.exit(1);
}

// 2) Every section accepted?
const ok = setRates(json);
if (!ok) { console.error('X  File is not a usable rates object.'); process.exit(1); }
const { applied, rejected } = getRatesReport();
console.log('Sections applied : ' + (applied.length ? applied.join(', ') : '(none — file only has notes)'));
if (rejected.length) {
  problems++;
  console.error('X  REJECTED (invalid — the app will IGNORE these and keep the old built-in fees):');
  console.error('   ' + rejected.join(', '));
  console.error('   Fix the values (check for negatives, wrong order, gaps between bands, or a stray null).');
}

// 3) Eyeball the resulting fees.
console.log('\nResulting fees at sample values (sanity-check these against the guideline):');
console.log('  price / loan     attorney fee    transfer total    bond total');
for (const v of [750000, 1000000, 2000000, 5000000]) {
  const t = transferCostBreakdown(v), b = bondCostBreakdown(v);
  console.log('  ' + R(v).padEnd(14), R(attorneyFee(v)).padEnd(14), R(t.total).padEnd(16), R(b.total));
}

console.log(problems ? '\nRESULT: DO NOT DEPLOY — fix the rejected section(s) above.'
                     : '\nRESULT: OK — every section is valid. Safe to upload tariffs.json.');
process.exit(problems ? 1 : 0);
