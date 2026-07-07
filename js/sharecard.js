/*
 * Copyright (c) 2026 HSG Attorneys Incorporated. All rights reserved.
 * Part of HSG Calculator. Unauthorised copying, modification or distribution is prohibited.
 */
/*
 * sharecard.js — render a BRANDED PNG of a quote estimate, so when a user shares
 * it the HSG logo + figures come through as an image (good for marketing).
 * Pure Canvas (no dependency). Returns a PNG Blob.
 */

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

/**
 * card = {
 *   title, headline?:{label,value}, lines:[{label,value}], total?:{label,value}, grand?:{label,value}
 * }
 */
export async function buildShareCard(card, site) {
  try { await document.fonts.ready; } catch { /* fonts optional */ }

  const W = 1080, pad = 72, lineH = 66;
  const headerH = 250;
  const titleH = 96;
  const headlineH = card.headline ? 170 : 0;
  const linesH = (card.lines ? card.lines.length : 0) * lineH;
  const totalH = card.total ? (lineH + 18) : 0;
  const grandH = card.grand ? 168 : 0;
  const footerH = 210;
  const bodyTop = headerH + 46;
  const H = bodyTop + titleH + headlineH + linesH + totalH + grandH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // black header band with the (white) HSG logo
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, W, headerH);
  try {
    const logo = await loadImg('assets/hsg-logo.png');
    const lh = 120, lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, (W - lw) / 2, (headerH - lh) / 2 - 16, lw, lh);
  } catch { /* logo optional */ }
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.font = '500 30px Roboto, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Property estimate', W / 2, headerH - 36);

  // Faint GeoAfrika emblem watermark for texture (drawn behind the content).
  try {
    const emblem = await loadImg('assets/brand/emblem-mask.png');
    const ew = 1020, eh = (emblem.height / emblem.width) * ew;
    // The PNG is a MASK (shape in the alpha channel), so tint it to a grey via
    // source-in compositing — works whether the mask's pixels are black or white.
    const off = document.createElement('canvas');
    off.width = Math.ceil(ew); off.height = Math.ceil(eh);
    const octx = off.getContext('2d');
    octx.drawImage(emblem, 0, 0, ew, eh);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = '#111315';
    octx.fillRect(0, 0, ew, eh);
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.drawImage(off, (W - ew) / 2, headerH + (H - headerH - eh) / 2);
    ctx.restore();
  } catch { /* watermark optional */ }

  // title
  let y = bodyTop + 30;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#16181C';
  ctx.font = '700 46px "Roboto Slab", Georgia, serif';
  ctx.fillText(card.title, pad, y + 28);
  y += titleH;

  // headline (repayment / affordability)
  if (card.headline) {
    ctx.fillStyle = '#5B636E';
    ctx.font = '500 30px Roboto, Arial, sans-serif';
    ctx.fillText(card.headline.label, pad, y + 8);
    ctx.fillStyle = '#16181C';
    ctx.font = '800 70px "Roboto Slab", Georgia, serif';
    ctx.fillText(card.headline.value, pad, y + 90);
    y += headlineH;
  }

  // line items
  for (const ln of (card.lines || [])) {
    ctx.fillStyle = '#16181C';
    ctx.textAlign = 'left';
    ctx.font = '400 34px Roboto, Arial, sans-serif';
    ctx.fillText(ln.label, pad, y + 42);
    ctx.textAlign = 'right';
    ctx.font = '600 34px Roboto, Arial, sans-serif';
    ctx.fillText(ln.value, W - pad, y + 42);
    ctx.strokeStyle = '#ECECEC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, y + lineH - 4);
    ctx.lineTo(W - pad, y + lineH - 4);
    ctx.stroke();
    y += lineH;
  }

  // total
  if (card.total) {
    y += 8;
    ctx.fillStyle = '#16181C';
    ctx.textAlign = 'left';
    ctx.font = '700 38px Roboto, Arial, sans-serif';
    ctx.fillText(card.total.label, pad, y + 40);
    ctx.textAlign = 'right';
    ctx.fillText(card.total.value, W - pad, y + 40);
    y += totalH;
  }

  // grand total (black box)
  if (card.grand) {
    const gh = 132;
    ctx.fillStyle = '#121212';
    roundRect(ctx, pad, y, W - pad * 2, gh, 22);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.font = '600 30px Roboto, Arial, sans-serif';
    ctx.fillText(card.grand.label, pad + 38, y + 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 54px "Roboto Slab", Georgia, serif';
    ctx.fillText(card.grand.value, pad + 38, y + 106);
  }

  // footer: disclaimer + website
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5B636E';
  ctx.font = '400 25px Roboto, Arial, sans-serif';
  wrapText(ctx,
    'Estimate only — not a quotation. Based on current SARS, LSSA and Deeds Office tariffs. Contact HSG Attorneys for a formal quote.',
    pad, H - footerH + 50, W - pad * 2, 36);
  ctx.fillStyle = '#16181C';
  ctx.font = '700 30px Roboto, Arial, sans-serif';
  ctx.fillText((site.website || '').replace(/^https?:\/\//, ''), pad, H - 54);

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
}
