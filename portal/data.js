/*
 * portal/data.js — data layer for the client portal + staff admin.
 *
 * PROTOTYPE: data lives in localStorage (key `hsg-portal-demo`), seeded from
 * the two sample matters below, and shared between the client tracker and the
 * staff admin — so ticking a milestone in admin updates the client view.
 *
 * The client tracker now reads LIVE from Supabase (the client_lookup RPC); the
 * staff admin still uses this local store for now (wired to Supabase + auth next).
 */
import { sb } from './supabase.js';

export const STAGES = [
  { key: 'offer',      label: 'Offer accepted' },
  { key: 'appointed',  label: 'Conveyancer appointed' },
  { key: 'bond',       label: 'Bond approved' },
  { key: 'fica',       label: 'FICA & documents received' },
  { key: 'clearance',  label: 'Rates & levy clearance' },
  { key: 'signed',     label: 'Documents signed' },
  { key: 'duty',       label: 'Transfer duty paid' },
  { key: 'lodged',     label: 'Lodged at the Deeds Office' },
  { key: 'registered', label: 'Registered' },
];

// The firm's conveyancers — used in the staff-admin dropdown + the demo seed.
export const CONVEYANCERS = ['Karl Hoffman', 'Tess Coetzee', 'Warda Jones'];

const KEY = 'hsg-portal-demo';
const clone = (x) => JSON.parse(JSON.stringify(x));

function buildMilestones(currentIdx, dates = {}, notes = {}) {
  return STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming',
    date: dates[s.key] || '',
    note: notes[s.key] || '',
  }));
}

const SEED = [
  {
    reference: 'HSG-2026-0042', buyerSurname: 'Naidoo', buyerName: 'A. Naidoo',
    property: '12 Oak Avenue, Ballito', price: 2450000, conveyancer: 'Karl Hoffman',
    agentName: 'Lerato — Seeff Ballito', status: 'active',
    currentNote: 'We are awaiting the rates clearance figures from the municipality — expected by ~14 June.',
    milestones: buildMilestones(4,
      { offer: '2026-05-02', appointed: '2026-05-05', bond: '2026-05-19', fica: '2026-05-27',
        clearance: '~14 Jun', signed: '~21 Jun', duty: '~25 Jun', lodged: '~2 Jul', registered: '~10 Jul' },
      { bond: 'Approved by Standard Bank.', fica: 'All FICA documents received — thank you.',
        clearance: 'Figures requested from the municipality.' }),
    documents: [
      { id: 'd1', name: 'Offer to Purchase (signed).pdf', type: 'Agreement' },
      { id: 'd2', name: 'FICA checklist.pdf', type: 'FICA' },
    ],
  },
  {
    reference: 'HSG-2026-0108', buyerSurname: 'Botha', buyerName: 'J & R Botha',
    property: 'Unit 4, The Vines, Stellenbosch', price: 1875000, conveyancer: 'Tess Coetzee',
    agentName: 'Pieter — Pam Golding', status: 'active',
    currentNote: 'Lodged at the Deeds Office — registration usually follows within 7–10 working days.',
    milestones: buildMilestones(7,
      { offer: '2026-04-10', appointed: '2026-04-12', bond: '2026-04-24', fica: '2026-04-30',
        clearance: '2026-05-12', signed: '2026-05-20', duty: '2026-05-26', lodged: '2026-06-03', registered: '~13 Jun' },
      { lodged: 'Lodged 3 June — in the Deeds Office examination queue.' }),
    documents: [{ id: 'd3', name: 'Guarantees (bank).pdf', type: 'Bond' }],
  },
  {
    reference: 'HSG-2026-0151', buyerSurname: 'Khumalo', buyerName: 'S. Khumalo',
    property: '8 Marine Drive, Umhlanga', price: 3200000, conveyancer: 'Warda Jones',
    agentName: 'Thabo — RE/MAX', status: 'active',
    currentNote: 'Your offer is accepted — we are being appointed as the transferring attorneys and will contact you shortly.',
    milestones: buildMilestones(1,
      { offer: '2026-06-01', appointed: '~9 Jun', bond: '~20 Jun', fica: '~27 Jun', clearance: '~10 Jul', signed: '~17 Jul', duty: '~21 Jul', lodged: '~28 Jul', registered: '~7 Aug' },
      { offer: 'Offer to Purchase accepted by the seller.' }),
    documents: [],
  },
];

function getStore() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch {}
  const s = clone(SEED); saveStore(s); return s;
}
function saveStore(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {} }
export function resetStore() { saveStore(clone(SEED)); }

// ---- client side ----
export async function lookupMatter(reference, surname) {
  // Live: Supabase `client_lookup` RPC (reference + surname). Falls back to the
  // local sample data only if Supabase is unreachable (offline / not configured).
  if (sb) {
    try {
      const { data, error } = await sb.rpc('client_lookup', {
        p_reference: (reference || '').trim(), p_surname: (surname || '').trim(),
      });
      if (!error) {
        if (data) { data.documents = data.documents || []; return data; }
        return null; // clean "not found" from the live database
      }
    } catch { /* network/config issue → fall back to the sample data below */ }
  }
  const ref = (reference || '').trim().toLowerCase();
  const sn = (surname || '').trim().toLowerCase();
  const m = getStore().find(x => x.reference.toLowerCase() === ref && x.buyerSurname.toLowerCase() === sn);
  return m ? clone(m) : null;
}
export const DEMO_HINT = () => getStore().map(m => `${m.reference} / ${m.buyerSurname}`);

// ---- admin side: LIVE (Supabase) ----
// Used by the staff admin once signed in. Maps between the app's camelCase shape
// and the Postgres columns. Falls back to nothing — the admin requires a login,
// so `sb` is always present here.
const isISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim());

function rowToMatter(row) {
  const byKey = Object.fromEntries((row.milestones || []).map((m) => [m.stage_key, m]));
  return {
    reference: row.reference, buyerName: row.buyer_name || '', buyerSurname: row.buyer_surname || '',
    property: row.property || '', price: row.price || 0, conveyancer: row.conveyancer || '',
    agentName: '', currentNote: row.current_note || '', status: row.status || 'active',
    milestones: STAGES.map((st) => {
      const m = byKey[st.key] || {};
      return { key: st.key, label: st.label, state: m.state || 'upcoming',
        date: m.date_done || m.expected_date || '', note: m.note || '' };
    }),
    documents: [],
  };
}

export async function listMattersRemote() {
  const { data, error } = await sb.from('matters')
    .select('reference,property,buyer_name,buyer_surname,status,milestones(stage_key,state,ord)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => {
    const cur = (row.milestones || []).find((x) => x.state === 'current');
    return { reference: row.reference, property: row.property, buyerName: row.buyer_name,
      buyerSurname: row.buyer_surname, current: cur ? cur.stage_key : 'registered',
      status: row.status || 'active' };
  });
}

export async function getMatterRemote(reference) {
  const { data, error } = await sb.from('matters')
    .select('*, milestones(*)').eq('reference', reference).maybeSingle();
  if (error) throw error;
  return data ? rowToMatter(data) : null;
}

export async function upsertMatterRemote(matter) {
  const mRow = {
    reference: matter.reference, buyer_name: matter.buyerName || null,
    buyer_surname: matter.buyerSurname, property: matter.property || null,
    price: matter.price || null, conveyancer: matter.conveyancer || null,
    current_note: matter.currentNote || null, status: matter.status || 'active',
  };
  const { data: saved, error: e1 } = await sb.from('matters')
    .upsert(mRow, { onConflict: 'reference' }).select('id').single();
  if (e1) throw e1;
  const rows = STAGES.map((st, i) => {
    const ms = (matter.milestones || []).find((x) => x.key === st.key) || {};
    const dv = String(ms.date || '').trim();
    return { matter_id: saved.id, stage_key: st.key, ord: i, state: ms.state || 'upcoming',
      date_done: isISODate(dv) ? dv : null, expected_date: isISODate(dv) ? null : (dv || null),
      note: String(ms.note || '').trim() || null };
  });
  const { error: e2 } = await sb.from('milestones').upsert(rows, { onConflict: 'matter_id,stage_key' });
  if (e2) throw e2;
  return matter;
}

export async function nextReferenceRemote() {
  const { data, error } = await sb.from('matters').select('reference');
  const year = '2026';
  if (error || !data) return `HSG-${year}-0001`;
  const nums = data.map((m) => { const r = /HSG-\d{4}-(\d+)/.exec(m.reference || ''); return r ? parseInt(r[1], 10) : 0; });
  const n = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `HSG-${year}-${n}`;
}

// ---- admin side: LOCAL demo (kept for reference / offline prototype) ----
export function listMatters() {
  return getStore().map(m => ({
    reference: m.reference, property: m.property, buyerName: m.buyerName, buyerSurname: m.buyerSurname,
    current: (m.milestones.find(x => x.state === 'current') || {}).key || 'registered', status: m.status || 'active',
  }));
}
export function getMatter(ref) {
  const m = getStore().find(x => x.reference.toLowerCase() === (ref || '').toLowerCase());
  return m ? clone(m) : null;
}
export function upsertMatter(matter) {
  const s = getStore();
  const i = s.findIndex(x => x.reference.toLowerCase() === matter.reference.toLowerCase());
  if (i >= 0) s[i] = matter; else s.push(matter);
  saveStore(s);
}
export function newMatterTemplate() {
  return {
    reference: '', buyerName: '', buyerSurname: '', property: '', price: 0,
    conveyancer: '', agentName: '', currentNote: '', status: 'active',
    milestones: STAGES.map(s => ({ key: s.key, label: s.label, state: 'upcoming', date: '', note: '' })),
    documents: [],
  };
}
export function nextReference() {
  const nums = getStore().map(m => { const r = /HSG-\d{4}-(\d+)/.exec(m.reference || ''); return r ? parseInt(r[1], 10) : 0; });
  const n = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `HSG-2026-${n}`;
}
