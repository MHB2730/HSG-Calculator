/*
 * Copyright (c) 2026 HSG Attorneys Incorporated. All rights reserved.
 * Part of HSG Calculator. Unauthorised copying, modification or distribution is prohibited.
 */
// Verify: (1) refactored engine matches the known values, (2) tariffs.json loads
// and is identical to the baked-in defaults, (3) a remote override actually changes results.
import { readFileSync } from 'node:fs';
import {
  setRates, transferCostBreakdown, bondCostBreakdown, transferDuty, attorneyFee,
} from '../js/tariffs.js';

const R = (n) => Math.round(n);
let pass = true;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) pass = false;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${got}${ok ? '' : ' (want ' + want + ')'}`);
};

// 1) Defaults
check('duty R2m', R(transferDuty(2000000)), 33786);
check('fee R2m', R(attorneyFee(2000000)), 35620);
check('transfer R2m total', R(transferCostBreakdown(2000000).total), 79737);
check('bond R1m total', R(bondCostBreakdown(1000000).total), 32622);

// 2) Apply tariffs.json — must be identical to defaults
const json = JSON.parse(readFileSync(new URL('../tariffs.json', import.meta.url), 'utf8'));
check('setRates(tariffs.json) applied', setRates(json), true);
check('after json: transfer R2m total', R(transferCostBreakdown(2000000).total), 79737);
check('after json: bond R1m total', R(bondCostBreakdown(1000000).total), 32622);
check('after json: top duty band R20m (null->Infinity)', R(transferDuty(20000000)), 2111156);

// 3) Override test — change VAT + FICA, confirm results change
const mod = JSON.parse(JSON.stringify(json));
mod.vatRate = 0.20;
mod.transfer.ficaFee = 999;
setRates(mod);
const b = transferCostBreakdown(2000000);
check('override: VAT line = fee*0.20', R(b.items.find((i) => i.label.startsWith('VAT')).amount), R(35620 * 0.20));
check('override: FICA line = 999', R(b.items.find((i) => i.label.startsWith('FICA')).amount), 999);

// 4) Bad input is ignored (defaults preserved)
setRates(json); // reset
setRates({ dutyBands: 'garbage', vatRate: 'oops' });
check('bad rates ignored: duty R2m still correct', R(transferDuty(2000000)), 33786);

console.log(pass ? '\nALL RATES TESTS PASSED' : '\nSOME TESTS FAILED');
process.exit(pass ? 0 : 1);
