// Verify: (1) refactored engine matches the known values, (2) tariffs.json loads
// and is identical to the baked-in defaults, (3) a remote override actually changes results.
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import {
  setRates, getRatesReport, transferCostBreakdown, bondCostBreakdown, transferDuty, attorneyFee,
  DEFAULT_RATES, clone,
} from '../js/tariffs.js';

const R = (n) => Math.round(n);
let pass = true;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) pass = false;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${got}${ok ? '' : ' (want ' + want + ')'}`);
};

// 1) Defaults  (LSSA Schedule 2026, effective 1 Jul 2026)
check('duty R2m', R(transferDuty(2000000)), 33786);
check('fee R2m', R(attorneyFee(2000000)), 36875);
check('transfer R2m total', R(transferCostBreakdown(2000000).total), 81180);
check('bond R1m total', R(bondCostBreakdown(1000000).total), 33662);

// 2) Apply tariffs.json — must be identical to defaults
const json = JSON.parse(readFileSync(new URL('../tariffs.json', import.meta.url), 'utf8'));
check('setRates(tariffs.json) applied', setRates(json), true);
check('after json: transfer R2m total', R(transferCostBreakdown(2000000).total), 81180);
check('after json: bond R1m total', R(bondCostBreakdown(1000000).total), 33662);
check('after json: top duty band R20m (null->Infinity)', R(transferDuty(20000000)), 2111156);

// 3) Override test — change VAT + FICA, confirm results change
const mod = JSON.parse(JSON.stringify(json));
mod.vatRate = 0.20;
mod.transfer.ficaFee = 999;
setRates(mod);
const b = transferCostBreakdown(2000000);
check('override: VAT line = fee*0.20', R(b.items.find((i) => i.label.startsWith('VAT')).amount), R(36875 * 0.20));
check('override: FICA line = 999', R(b.items.find((i) => i.label.startsWith('FICA')).amount), 999);

// 4) Bad input is ignored (defaults preserved)
setRates(json); // reset
setRates({ dutyBands: 'garbage', vatRate: 'oops' });
check('bad rates ignored: duty R2m still correct', R(transferDuty(2000000)), 33786);

// 5) Semantic validation — structurally-typed but broken bands must be REJECTED
//    (defaults kept), never applied. Each case would previously have produced a
//    negative or silently-wrong quote.
const semanticBad = [
  ['overlapping duty bands', { dutyBands: [
    { from: 0, upTo: 1000000, base: 0, rate: 0 },
    { from: 500000, upTo: 2000000, base: 100, rate: 0.05 }] }],
  ['from > upTo duty band', { dutyBands: [
    { from: 0, upTo: 1000000, base: 0, rate: 0 },
    { from: 2000000, upTo: 1500000, base: 5000, rate: 0.1 }] }],
  ['negative duty base', { dutyBands: [
    { from: 0, upTo: 1210000, base: -99999, rate: 0 },
    { from: 1210000, upTo: null, base: 0, rate: 0.03 }] }],
  ['reordered duty bands (top first)', { dutyBands: [
    { from: 1210000, upTo: null, base: 100, rate: 0.13 },
    { from: 0, upTo: 1210000, base: 0, rate: 0 }] }],
  ['negative lssa per', { lssaBands: [
    { from: 0, upTo: 100000, base: 6875, per: 0, step: 1 },
    { from: 100000, upTo: null, base: 6875, per: -1000, step: 50000 }] }],
  ['negative lssa step', { lssaBands: [
    { from: 0, upTo: 100000, base: 6875, per: 0, step: 1 },
    { from: 100000, upTo: null, base: 6875, per: 1100, step: -50000 }] }],
  ['stray null mid deeds band', { deedsTransferBands: [[100000, 50], [null, 114], [200000, 900]] }],
  ['first duty band not starting at 0', { dutyBands: [
    { from: 100000, upTo: 1210000, base: 0, rate: 0.03 },
    { from: 1210000, upTo: null, base: 33300, rate: 0.06 }] }],
  ['finite top duty band (not "and above")', { dutyBands: [
    { from: 0, upTo: 1210000, base: 0, rate: 0 },
    { from: 1210000, upTo: 20000000, base: 0, rate: 0.03 }] }],
  ['finite top lssa band', { lssaBands: [
    { from: 0, upTo: 100000, base: 6875, per: 0, step: 1 },
    { from: 100000, upTo: 500000, base: 6875, per: 1100, step: 50000 }] }],
  ['finite top deeds band', { deedsTransferBands: [[100000, 50], [200000, 114], [300000, 727]] }],
];
for (const [name, bad] of semanticBad) {
  setRates(json); // reset to good
  setRates(bad);  // attempt the bad override
  check(`reject ${name}: duty R2m unchanged`, R(transferDuty(2000000)), 33786);
  check(`reject ${name}: fee R1m unchanged`, R(attorneyFee(1000000)), 26275);
}
// Negative price/amount must never yield a positive fee
check('deeds fee on 0 = 0', transferCostBreakdown(0).items.find((i) => i.label.startsWith('Deeds')).amount, 0);

// 6) getRatesReport() surfaces rejected sections (so an update never fails silently)
setRates(json); // a fully valid file
check('valid file: no rejected sections', getRatesReport().rejected.length, 0);
check('valid file: reports applied sections', getRatesReport().applied.includes('lssaBands'), true);
setRates({ lssaBands: [{ from: 0, upTo: 100000, base: 6875, per: -5, step: 1 }], vatRate: 0.15 });
check('bad section named in report.rejected', getRatesReport().rejected.includes('lssaBands'), true);
check('good section still in report.applied', getRatesReport().applied.includes('vatRate'), true);

// 7) tariffs.json must be STRUCTURALLY identical to the baked-in DEFAULTS (not just
//    equal on sampled totals) — so any drift between the two shipped sources fails loudly.
//    (Strip the _-prefixed metadata keys; those are documentation, not rates.)
const jsonRatesOnly = Object.fromEntries(Object.entries(json).filter(([k]) => !k.startsWith('_')));
try {
  assert.deepStrictEqual(clone(jsonRatesOnly), DEFAULT_RATES);
  console.log('OK   tariffs.json deep-equals DEFAULTS');
} catch (e) {
  pass = false;
  console.log('FAIL tariffs.json deep-equals DEFAULTS:\n' + e.message);
}

// 8) Duty-band BASE continuity is enforced: a base typo (discontinuous at a boundary)
//    is rejected, so the duty never silently jumps at a band edge.
setRates(json);
setRates({ dutyBands: [
  { from: 0, upTo: 1210000, base: 0, rate: 0 },
  { from: 1210000, upTo: 1663800, base: 0, rate: 0.03 },
  { from: 1663800, upTo: null, base: 99999, rate: 0.06 }] }); // base should be 13614
check('reject discontinuous duty base: report.rejected', getRatesReport().rejected.includes('dutyBands'), true);
check('reject discontinuous duty base: duty R2m unchanged', R(transferDuty(2000000)), 33786);

// 9) transfer fees apply per-key: a valid sibling still lands even if another key is bad,
//    but the section is still flagged rejected so the typo is never silent.
setRates(json);
setRates({ transfer: { rateCertificateFee: 900, ficaFee: -5 } });
check('per-key transfer: valid key applied', transferCostBreakdown(2000000).items.find((i) => i.label.startsWith('Rates')).amount, 900);
check('per-key transfer: bad key flags section', getRatesReport().rejected.includes('transfer'), true);
setRates(json); // reset

console.log(pass ? '\nALL RATES TESTS PASSED' : '\nSOME TESTS FAILED');
process.exit(pass ? 0 : 1);
