/* admin.js — staff admin (prototype): create matters + set milestones. */
import { STAGES, listMatters, getMatter, upsertMatter, newMatterTemplate, nextReference, resetStore } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const listEl = () => $('#admin-list');
const edEl = () => $('#admin-editor');
const stageLabel = key => (STAGES.find(s => s.key === key) || { label: 'Registered' }).label;
const esc = s => String(s == null ? '' : s).replace(/"/g, '&quot;');

let editing = null;

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function showList() {
  const rows = listMatters().map(m => `
    <li><button class="matter-row" data-ref="${esc(m.reference)}">
      <span>
        <span class="mr-prop">${m.property || '(no property)'}</span>
        <span class="mr-sub">${m.reference} · ${m.buyerName || ''} (${m.buyerSurname})</span>
      </span>
      <span class="mr-badge">${stageLabel(m.current)}</span>
    </button></li>`).join('');
  listEl().querySelector('.matter-list').innerHTML = rows || '<p class="muted">No matters yet — add one.</p>';
  edEl().classList.add('is-hidden'); listEl().classList.remove('is-hidden'); window.scrollTo(0, 0);
}

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
          <select id="f-status">${['active', 'registered', 'cancelled'].map(s => `<option ${m.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Buyer name</span><input type="text" id="f-buyer" value="${esc(m.buyerName)}"></label>
        <label class="field"><span class="field-label">Buyer surname</span><input type="text" id="f-surname" value="${esc(m.buyerSurname)}"></label>
        <label class="field full"><span class="field-label">Property</span><input type="text" id="f-property" value="${esc(m.property)}"></label>
        <label class="field"><span class="field-label">Price (R)</span><input type="text" id="f-price" value="${esc(m.price || '')}"></label>
        <label class="field"><span class="field-label">Conveyancer</span><input type="text" id="f-conv" value="${esc(m.conveyancer)}"></label>
        <label class="field full"><span class="field-label">"Where we are now" note (client banner)</span><textarea id="f-note">${esc(m.currentNote)}</textarea></label>
      </div>

      <h2 class="sec">Milestones</h2>
      <ul class="ms-list">${STAGES.map(st => {
        const ms = (m.milestones || []).find(x => x.key === st.key) || { state: 'upcoming', date: '', note: '' };
        return `<li class="ms-row" data-key="${st.key}">
          <div class="ms-head">
            <span class="ms-label">${st.label}</span>
            <select class="ms-state">${['upcoming', 'current', 'done'].map(v => `<option value="${v}" ${ms.state === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
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

  listEl().classList.add('is-hidden'); edEl().classList.remove('is-hidden'); window.scrollTo(0, 0);
  $('#ed-back').onclick = showList;
  $('#ed-save').onclick = () => { if (saveEditor()) showList(); };
  $('#ed-view').onclick = () => {
    const saved = saveEditor();
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
    milestones: STAGES.map(st => {
      const row = edEl().querySelector(`.ms-row[data-key="${st.key}"]`);
      return { key: st.key, label: st.label, state: row.querySelector('.ms-state').value, date: row.querySelector('.ms-date').value.trim(), note: row.querySelector('.ms-note').value.trim() };
    }),
    documents: (editing && editing.documents) || [],
  };
}

function saveEditor() {
  const m = collect();
  if (!m.reference) { toast('Please enter a reference number'); return null; }
  if (!m.buyerSurname) { toast('Please enter the buyer surname'); return null; }
  upsertMatter(m); toast('Matter saved'); return m;
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  $('#new-matter').onclick = () => { const t = newMatterTemplate(); t.reference = nextReference(); showEditor(t); };
  $('#reset-demo').onclick = () => { if (confirm('Reset demo data back to the two sample matters?')) { resetStore(); showList(); toast('Demo data reset'); } };
  listEl().addEventListener('click', (e) => { const row = e.target.closest('.matter-row'); if (row) showEditor(getMatter(row.dataset.ref)); });
  showList();
});
