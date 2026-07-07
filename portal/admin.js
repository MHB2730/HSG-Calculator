/*
 * Copyright (c) 2026 HSG Attorneys Incorporated. All rights reserved.
 * Part of HSG Calculator. Unauthorised copying, modification or distribution is prohibited.
 */
/* admin.js — HSG staff admin (LIVE): sign in, create matters, set milestones.
   Reads/writes the live Supabase tables; changes appear instantly to clients. */
import { STAGES, CONVEYANCERS, listMattersRemote, getMatterRemote, upsertMatterRemote, newMatterTemplate, nextReferenceRemote } from './data.js';
import { hasAuth, getUser, signIn, signOut, isStaff, getAAL, unenrollUnverified, enrollTotp, verifyTotp, challengeExisting } from './auth.js';

const $ = (s, r = document) => r.querySelector(s);
const listEl = () => $('#admin-list');
const edEl = () => $('#admin-editor');

// Every full-screen section; show() reveals exactly one.
const SECTIONS = {
  login: '#admin-login', enroll: '#admin-mfa-enroll', verify: '#admin-mfa-verify',
  list: '#admin-list', editor: '#admin-editor',
};
let enrollFactorId = null;
const stageLabel = (key) => (STAGES.find((s) => s.key === key) || { label: 'Registered' }).label;
// Full HTML escape (covers text content AND quoted attribute values).
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let editing = null;

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- view switching ----------
function show(which) {
  for (const [k, sel] of Object.entries(SECTIONS)) {
    const el = $(sel); if (el) el.classList.toggle('is-hidden', k !== which);
  }
  const so = $('#sign-out'); if (so) so.classList.toggle('is-hidden', which === 'login');
  window.scrollTo(0, 0);
}

// ---------- auth ----------
async function refreshAuthUI() {
  if (!hasAuth()) { showLoginError('The live database is not reachable. Please try again later.'); show('login'); return; }
  const user = await getUser();
  if (!user) { show('login'); return; }
  if (!(await isStaff())) {
    showLoginError('This account is not authorised for staff admin. Use your HSG firm email, or contact the administrator.');
    await signOut();
    show('login');
    return;
  }
  await routeMfa();
}

// Decide where a signed-in staff member goes based on their 2FA state.
async function routeMfa() {
  const aal = await getAAL();
  if (aal.currentLevel === 'aal2') { await showList(); return; }   // already 2FA-verified this session
  if (aal.nextLevel === 'aal2') { showVerify(); return; }          // has 2FA set up → enter a code
  await showEnroll();                                              // no 2FA yet → must set it up (required)
}

// ---------- 2FA: first-time setup ----------
async function showEnroll() {
  show('enroll');
  const qr = $('#mfa-qr'); const secret = $('#mfa-secret'); const err = $('#mfa-enroll-error');
  err.classList.add('is-hidden'); qr.removeAttribute('src'); secret.textContent = 'Generating…';
  enrollFactorId = null;
  await unenrollUnverified();
  const res = await enrollTotp();
  if (res.error) {
    secret.textContent = '';
    err.textContent = 'Could not start 2FA setup. Please sign out and try again.';
    err.classList.remove('is-hidden');
    return;
  }
  enrollFactorId = res.factorId;
  qr.setAttribute('src', res.qr);
  secret.textContent = res.secret;
}

async function doEnrollVerify() {
  const err = $('#mfa-enroll-error'); err.classList.add('is-hidden');
  if (!enrollFactorId) { await showEnroll(); return; }
  const code = $('#mfa-enroll-code').value;
  if (!/^\d{6}$/.test(String(code).trim())) { err.textContent = 'Enter the 6-digit code from your app.'; err.classList.remove('is-hidden'); return; }
  const btn = $('#mfa-enroll-go'); btn.disabled = true; btn.textContent = 'Verifying…';
  const { error } = await verifyTotp(enrollFactorId, code);
  btn.disabled = false; btn.textContent = 'Verify & finish';
  if (error) { err.textContent = 'That code didn’t match. Check the app and try the current 6 digits.'; err.classList.remove('is-hidden'); return; }
  $('#mfa-enroll-code').value = '';
  await showList();
}

// ---------- 2FA: returning login ----------
function showVerify() {
  show('verify');
  $('#mfa-verify-error').classList.add('is-hidden');
  $('#mfa-verify-code').value = '';
}

async function doVerify(ev) {
  if (ev) ev.preventDefault();
  const err = $('#mfa-verify-error'); err.classList.add('is-hidden');
  const code = $('#mfa-verify-code').value;
  if (!/^\d{6}$/.test(String(code).trim())) { err.textContent = 'Enter the 6-digit code from your app.'; err.classList.remove('is-hidden'); return; }
  const btn = $('#mfa-verify-go'); btn.disabled = true; btn.textContent = 'Verifying…';
  const { error } = await challengeExisting(code);
  btn.disabled = false; btn.textContent = 'Verify';
  if (error) { err.textContent = 'That code didn’t match. Try the current 6 digits from your app.'; err.classList.remove('is-hidden'); return; }
  await showList();
}

function showLoginError(msg) {
  const e = $('#lg-error');
  if (!e) return;
  if (msg) { e.textContent = msg; e.classList.remove('is-hidden'); } else { e.textContent = ''; e.classList.add('is-hidden'); }
}

async function doLogin(ev) {
  ev.preventDefault();
  showLoginError('');
  const btn = $('#lg-go'); const email = $('#lg-email').value; const pass = $('#lg-pass').value;
  if (!email || !pass) { showLoginError('Please enter your email and password.'); return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const { error } = await signIn(email, pass);
    if (error) { showLoginError(error.message || 'Sign in failed. Check your email and password.'); return; }
    $('#lg-pass').value = '';
    await refreshAuthUI();
  } catch {
    showLoginError('Could not reach the database. Check your connection and try again.');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

// ---------- matters list ----------
async function showList() {
  show('list');
  const ul = listEl().querySelector('.matter-list');
  ul.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const matters = await listMattersRemote();
    const rows = matters.map((m) => `
      <li><button class="matter-row" data-ref="${esc(m.reference)}">
        <span>
          <span class="mr-prop">${esc(m.property || '(no property)')}</span>
          <span class="mr-sub">${esc(m.reference)} · ${esc(m.buyerName || '')} (${esc(m.buyerSurname)})</span>
        </span>
        <span class="mr-badge">${esc(stageLabel(m.current))}</span>
      </button></li>`).join('');
    ul.innerHTML = rows || '<p class="muted">No matters yet — add one with “+ New matter”.</p>';
  } catch {
    ul.innerHTML = '<p class="muted">Could not load matters. Please refresh.</p>';
  }
}

// ---------- editor ----------
function showEditor(matter) {
  editing = matter;
  const m = matter;
  edEl().innerHTML = `
    <button class="btn btn-ghost btn-sm" id="ed-back" type="button">← Back to matters</button>
    <h1 style="margin:12px 2px;">${m.reference ? 'Edit matter' : 'New matter'}</h1>
    <div class="editor">
      <div class="grid2">
        <label class="field"><span class="field-label">Reference</span><input type="text" id="f-ref" value="${esc(m.reference)}"></label>
        <label class="field"><span class="field-label">Status</span>
          <select id="f-status">${['active', 'registered', 'cancelled'].map((s) => `<option ${m.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Buyer name</span><input type="text" id="f-buyer" value="${esc(m.buyerName)}"></label>
        <label class="field"><span class="field-label">Buyer surname</span><input type="text" id="f-surname" value="${esc(m.buyerSurname)}"></label>
        <label class="field full"><span class="field-label">Property</span><input type="text" id="f-property" value="${esc(m.property)}"></label>
        <label class="field"><span class="field-label">Price (R)</span><input type="text" id="f-price" value="${esc(m.price || '')}"></label>
        <label class="field"><span class="field-label">Conveyancer</span>
          <select id="f-conv">
            <option value="">— select —</option>
            ${CONVEYANCERS.map((c) => `<option value="${esc(c)}" ${m.conveyancer === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            ${(m.conveyancer && !CONVEYANCERS.includes(m.conveyancer)) ? `<option value="${esc(m.conveyancer)}" selected>${esc(m.conveyancer)}</option>` : ''}
          </select></label>
        <label class="field full"><span class="field-label">"Where we are now" note (client banner)</span><textarea id="f-note">${esc(m.currentNote)}</textarea></label>
      </div>

      <h2 class="sec">Milestones</h2>
      <ul class="ms-list">${STAGES.map((st) => {
        const ms = (m.milestones || []).find((x) => x.key === st.key) || { state: 'upcoming', date: '', note: '' };
        return `<li class="ms-row" data-key="${st.key}">
          <div class="ms-head">
            <span class="ms-label">${st.label}</span>
            <select class="ms-state">${['upcoming', 'current', 'done'].map((v) => `<option value="${v}" ${ms.state === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </div>
          <div class="ms-grid">
            <input type="text" class="ms-date" placeholder="date / expected" value="${esc(ms.date)}">
            <input type="text" class="ms-note" placeholder="note (optional)" value="${esc(ms.note)}">
          </div>
        </li>`;
      }).join('')}</ul>

      <div class="editor-actions">
        <button class="btn btn-primary" id="ed-save" type="button">Save matter</button>
        <button class="btn btn-ghost" id="ed-view" type="button">Save &amp; view as client ↗</button>
      </div>
    </div>`;

  show('editor');
  $('#ed-back').onclick = () => { showList(); };
  $('#ed-save').onclick = async () => { const s = await saveEditor(); if (s) showList(); };
  $('#ed-view').onclick = async () => {
    const saved = await saveEditor();
    if (saved) window.open(`index.html?ref=${encodeURIComponent(saved.reference)}&surname=${encodeURIComponent(saved.buyerSurname)}`, '_blank');
  };
}

function collect() {
  return {
    reference: $('#f-ref').value.trim(),
    status: $('#f-status').value,
    buyerName: $('#f-buyer').value.trim(),
    buyerSurname: $('#f-surname').value.trim(),
    property: $('#f-property').value.trim(),
    price: parseFloat(($('#f-price').value || '').replace(/[^\d.]/g, '')) || 0,
    conveyancer: $('#f-conv').value.trim(),
    currentNote: $('#f-note').value.trim(),
    milestones: STAGES.map((st) => {
      const row = edEl().querySelector(`.ms-row[data-key="${st.key}"]`);
      return { key: st.key, label: st.label, state: row.querySelector('.ms-state').value, date: row.querySelector('.ms-date').value.trim(), note: row.querySelector('.ms-note').value.trim() };
    }),
    documents: (editing && editing.documents) || [],
  };
}

async function saveEditor() {
  const m = collect();
  if (!m.reference) { toast('Please enter a reference number'); return null; }
  if (!m.buyerSurname) { toast('Please enter the buyer surname'); return null; }
  const btn = $('#ed-save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    await upsertMatterRemote(m);
    toast('Matter saved — clients see this now');
    return m;
  } catch (e) {
    toast(/permission|denied|row-level/i.test(String(e && e.message)) ? 'Not authorised to save' : 'Save failed — please try again');
    return null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save matter'; }
  }
}

// ---------- boot ----------
document.addEventListener('DOMContentLoaded', () => {
  const lg = document.querySelector('.appbar-logo');
  if (lg) { lg.addEventListener('error', () => { lg.style.display = 'none'; }); if (lg.complete && lg.naturalWidth === 0) lg.style.display = 'none'; }
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  $('#login-form').addEventListener('submit', doLogin);
  $('#mfa-enroll-go').onclick = doEnrollVerify;
  $('#mfa-verify-form').addEventListener('submit', doVerify);
  $('#sign-out').onclick = async () => { await signOut(); enrollFactorId = null; showLoginError(''); show('login'); };
  $('#new-matter').onclick = async () => { const t = newMatterTemplate(); t.reference = await nextReferenceRemote(); showEditor(t); };
  listEl().addEventListener('click', async (e) => {
    const row = e.target.closest('.matter-row');
    if (row) { const m = await getMatterRemote(row.dataset.ref); if (m) showEditor(m); else toast('Could not open that matter'); }
  });

  refreshAuthUI();
});
