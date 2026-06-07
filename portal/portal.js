/* portal.js — client transfer tracker (prototype, sample data). */
import { STAGES, lookupMatter, DEMO_HINT } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const money = n => 'R ' + Math.round(Number(n) || 0).toLocaleString('en-ZA');
const labelFor = (m) => m.label || (STAGES.find(s => s.key === m.key) || {}).label || m.key;

function stepperHTML(milestones) {
  return '<ol class="stepper">' + milestones.map(m => `
    <li class="step step-${m.state}">
      <span class="step-node">${m.state === 'done' ? '✓' : ''}</span>
      <div class="step-body">
        <div class="step-label">${labelFor(m)}</div>
        ${m.date ? `<div class="step-date">${m.state === 'upcoming' ? 'Expected ' : ''}${m.date}</div>` : ''}
        ${m.note ? `<div class="step-note">${m.note}</div>` : ''}
      </div>
    </li>`).join('') + '</ol>';
}

function docsHTML(documents) {
  if (!documents || !documents.length) return '<p class="muted">No documents have been shared yet.</p>';
  return `
    <div class="docs-lock" id="docs-lock">
      <p>For your security, documents are protected. We'll send a one-time PIN to the contact details on file.</p>
      <button class="btn btn-primary" id="doc-pin" type="button">Get one-time PIN</button>
      <p class="fineprint" style="margin-top:10px;">(Demo: this just reveals the list — the live version emails/texts a PIN first.)</p>
    </div>
    <ul class="docs is-hidden" id="docs-list">${documents.map(d => `
      <li class="doc"><span>${d.name}<small>${d.type}</small></span><button class="btn btn-ghost btn-sm" type="button">Download</button></li>`).join('')}
    </ul>`;
}

function render(m) {
  const current = m.milestones.find(x => x.state === 'current');
  $('#matter').innerHTML = `
    <div class="matter-head">
      <div class="matter-ref">${m.reference}</div>
      <h1 class="matter-prop">${m.property}</h1>
      <div class="matter-meta">${m.buyerName} · ${money(m.price)} · Conveyancer: ${m.conveyancer}</div>
    </div>
    <div class="banner">
      <div class="banner-label">Where we are now</div>
      <div class="banner-step">${current ? labelFor(current) : 'Registered 🎉'}</div>
      <p class="banner-note">${m.currentNote || ''}</p>
    </div>
    <h2 class="sec">Progress</h2>
    ${stepperHTML(m.milestones)}
    <h2 class="sec">Documents</h2>
    ${docsHTML(m.documents)}
    <div class="actions" style="margin-top:18px;"><button class="btn btn-ghost btn-block" id="back" type="button">← Look up another</button></div>`;

  $('#lookup').classList.add('is-hidden');
  $('#matter').classList.remove('is-hidden');
  window.scrollTo(0, 0);

  const pin = $('#doc-pin');
  if (pin) pin.onclick = () => { $('#docs-lock').classList.add('is-hidden'); $('#docs-list').classList.remove('is-hidden'); };
  $('#back').onclick = () => { $('#matter').classList.add('is-hidden'); $('#lookup').classList.remove('is-hidden'); window.scrollTo(0, 0); };
}

async function go() {
  const ref = $('#lk-reference').value;
  const sn = $('#lk-surname').value;
  const err = $('#lk-error');
  if (!ref.trim() || !sn.trim()) { err.textContent = 'Please enter both your reference number and surname.'; err.classList.remove('is-hidden'); return; }
  err.classList.add('is-hidden');
  const m = await lookupMatter(ref, sn);
  if (!m) { err.textContent = 'No transfer found for that reference and surname. Please check the details, or contact HSG.'; err.classList.remove('is-hidden'); return; }
  render(m);
}

document.addEventListener('DOMContentLoaded', () => {
  $('#portal-form').addEventListener('submit', (e) => { e.preventDefault(); go(); });
  $('#year').textContent = new Date().getFullYear();
  const hint = $('#demo-hint');
  if (hint) hint.textContent = 'Demo logins to try — ' + DEMO_HINT.join('   ·   ');
});
