/*
 * portal/data.js — data layer for the client portal.
 * SAMPLE DATA for now. Later, lookupMatter() calls the Supabase `client_lookup`
 * RPC and returns the SAME shape, so the UI doesn't change.
 */

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

// Build the 9 milestones given the index of the current stage (0-based).
function build(currentIdx, dates = {}, notes = {}) {
  return STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming',
    date: dates[s.key] || '',
    note: notes[s.key] || '',
  }));
}

const SAMPLE = [
  {
    reference: 'HSG-2026-0042',
    buyerSurname: 'Naidoo',
    buyerName: 'A. Naidoo',
    property: '12 Oak Avenue, Ballito',
    price: 2450000,
    conveyancer: 'M. Hornby',
    agentName: 'Lerato — Seeff Ballito',
    currentNote: 'We are awaiting the rates clearance figures from the municipality — expected by ~14 June.',
    milestones: build(4,
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
    reference: 'HSG-2026-0108',
    buyerSurname: 'Botha',
    buyerName: 'J & R Botha',
    property: 'Unit 4, The Vines, Stellenbosch',
    price: 1875000,
    conveyancer: 'S. Glavovic',
    agentName: 'Pieter — Pam Golding',
    currentNote: 'Lodged at the Deeds Office — registration usually follows within 7–10 working days.',
    milestones: build(7,
      { offer: '2026-04-10', appointed: '2026-04-12', bond: '2026-04-24', fica: '2026-04-30',
        clearance: '2026-05-12', signed: '2026-05-20', duty: '2026-05-26', lodged: '2026-06-03', registered: '~13 Jun' },
      { lodged: 'Lodged 3 June — in the Deeds Office examination queue.' }),
    documents: [
      { id: 'd3', name: 'Guarantees (bank).pdf', type: 'Bond' },
    ],
  },
];

export async function lookupMatter(reference, surname) {
  const ref = (reference || '').trim().toLowerCase();
  const sn = (surname || '').trim().toLowerCase();
  const m = SAMPLE.find(x => x.reference.toLowerCase() === ref && x.buyerSurname.toLowerCase() === sn);
  return m ? JSON.parse(JSON.stringify(m)) : null;
}

// Shown on the page so you can try it during the prototype phase.
export const DEMO_HINT = SAMPLE.map(m => `${m.reference} / ${m.buyerSurname}`);
