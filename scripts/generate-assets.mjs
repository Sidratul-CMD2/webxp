#!/usr/bin/env node
/**
 * Generates the original icon and wallpaper SVGs used by the simulation.
 *
 * All artwork here is original, drawn from geometric primitives in this file
 * in a period-appropriate style (dimensional, upper-left lighting, gradients,
 * soft shadow). No Microsoft or third-party image data is used.
 *
 * Usage: node scripts/generate-assets.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = join(root, 'src/assets/icons');
const wallDir = join(root, 'src/assets/wallpapers');
mkdirSync(iconDir, { recursive: true });
mkdirSync(wallDir, { recursive: true });

// ---------------------------------------------------------------- helpers
let gid = 0;
const id = (p) => `${p}${++gid}`;
const stops = (list) =>
  list.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
const lin = (sid, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${sid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
const rad = (sid, list, cx = 0.35, cy = 0.3, r = 0.75) =>
  `<radialGradient id="${sid}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;
const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;
const shadow = (cx = 16, cy = 29.5, rx = 12, ry = 1.6, op = 0.22) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${op}"/>`;

/** A component returns {defs, body}. */
function folderParts({ open = false } = {}) {
  const back = id('fb');
  const front = id('ff');
  const defs =
    lin(back, [[0, '#f3d27a'], [1, '#c99230']]) +
    lin(front, [[0, '#fff1b8'], [0.45, '#f7d468'], [1, '#e2a42c']], 0, 0, 0.3, 1);
  const backPath = `<path d="M3.5 7.5h8.2l2.1 2.2h13.7c.6 0 1 .4 1 1V26c0 .6-.4 1-1 1h-23c-.6 0-1-.4-1-1V8.5c0-.6.4-1 1-1z" fill="url(#${back})" stroke="#a4741c" stroke-width=".9"/>`;
  const frontPath = open
    ? `<path d="M6.2 13.5h23.3c.7 0 1.1.6.9 1.2L27.6 26.2c-.2.5-.6.8-1.1.8H3.7c-.7 0-1.1-.6-.9-1.2l2.5-11.5c.1-.5.5-.8.9-.8z" fill="url(#${front})" stroke="#b07f22" stroke-width=".9"/>`
    : `<path d="M3.3 12.6h25.4c.6 0 1.1.5 1 1.1l-1.1 12.4c-.1.5-.5.9-1 .9H4.4c-.5 0-.9-.4-1-.9L2.3 13.7c-.1-.6.4-1.1 1-1.1z" fill="url(#${front})" stroke="#b07f22" stroke-width=".9"/>`;
  const shine = open ? '' : `<path d="M3.6 13.6h24.8" stroke="#fffbe6" stroke-width=".8" opacity=".9"/>`;
  return { defs, back: backPath, front: frontPath + shine };
}

function folderIcon({ inside = '', overlay = '', overlayDefs = '', open = false } = {}) {
  const f = folderParts({ open });
  return svg(shadow(16, 28.4, 13, 1.4, 0.18) + f.back + inside + f.front + overlay, f.defs + overlayDefs);
}

function sphere(fillStops, { cx = 16, cy = 16, r = 12, stroke = '#1a3f8f' } = {}) {
  const g = id('sp');
  const hl = id('hl');
  return {
    defs: rad(g, fillStops, 0.38, 0.32, 0.75) + lin(hl, [[0, '#fff', 0.85], [1, '#fff', 0]]),
    body:
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g})" stroke="${stroke}" stroke-width=".9"/>` +
      `<ellipse cx="${cx - r * 0.12}" cy="${cy - r * 0.48}" rx="${r * 0.62}" ry="${r * 0.38}" fill="url(#${hl})"/>`,
  };
}

const BLUE_SPHERE = [[0, '#9fd0ff'], [0.55, '#2f7be6'], [1, '#123f9e']];
const GREEN_SPHERE = [[0, '#c6f59a'], [0.5, '#4cb52c'], [1, '#1d6a12']];
const RED_SPHERE = [[0, '#ffb0a0'], [0.5, '#e2401f'], [1, '#8f1606']];

const questionMark = (fill = '#fff', s = 1, dx = 0, dy = 0) =>
  `<g transform="translate(${dx} ${dy}) scale(${s})"><path d="M12.4 12.2c0-2.3 1.7-3.9 3.9-3.9 2.3 0 3.9 1.5 3.9 3.5 0 1.6-.9 2.5-2 3.3-.9.7-1.3 1.1-1.3 2.2v.6h-2.3v-.8c0-1.7.6-2.5 1.8-3.4.9-.7 1.4-1.1 1.4-1.9 0-.9-.7-1.6-1.6-1.6-1 0-1.6.7-1.7 1.9z" fill="${fill}"/><circle cx="15.8" cy="21.6" r="1.5" fill="${fill}"/></g>`;

const arrow = (dir, fill = '#fff') => {
  const shapes = {
    left: 'M8 16l7-6.5v4h8.5v5H15v4z',
    right: 'M24 16l-7-6.5v4H8.5v5H17v4z',
    up: 'M16 7l6.5 7h-4v9h-5v-9h-4z',
  };
  return `<path d="${shapes[dir]}" fill="${fill}" stroke="#0d4a08" stroke-width=".5" stroke-linejoin="round"/>`;
};

function greenArrowBadge(dir, x, y, s = 0.55) {
  const sp = sphere(GREEN_SPHERE, { stroke: '#1b5e10' });
  return {
    defs: sp.defs,
    body: `<g transform="translate(${x} ${y}) scale(${s})">${sp.body}${arrow(dir)}</g>`,
  };
}

function monitor({ screen, x = 4, y = 3, w = 22, h = 17 } = {}) {
  const bezel = id('bz');
  const scr = id('sc');
  const defs = lin(bezel, [[0, '#fbfaf3'], [1, '#c9c2a6']]) + (screen ? '' : lin(scr, [[0, '#4d8df0'], [1, '#0b2e8a']]));
  const body =
    `<rect x="${x + 7}" y="${y + h + 1}" width="${w - 14}" height="3" fill="#bdb59a" stroke="#857d62" stroke-width=".7"/>` +
    `<rect x="${x + 3}" y="${y + h + 3.5}" width="${w - 6}" height="2.6" rx="1" fill="url(#${bezel})" stroke="#857d62" stroke-width=".7"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="url(#${bezel})" stroke="#7d7458" stroke-width=".9"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 5}" fill="${screen ? screen : `url(#${scr})`}" stroke="#4a4535" stroke-width=".6"/>` +
    `<path d="M${x + 2.5} ${y + 2.5}h${(w - 5) * 0.6}l-${(w - 5) * 0.35} ${(h - 6) * 0.7}H${x + 2.5}z" fill="#fff" opacity=".18"/>` +
    `<circle cx="${x + w - 3}" cy="${y + h - 1.6}" r=".7" fill="#3cc23c"/>`;
  return { defs, body };
}

// ---------------------------------------------------------------- icons
const icons = {};

icons.folder = folderIcon();
icons['folder-open'] = folderIcon({ open: true });

{
  const pg = id('pg');
  const page = (x, y, rot) =>
    `<g transform="rotate(${rot} ${x + 6} ${y + 7})"><rect x="${x}" y="${y}" width="12" height="13" fill="url(#${pg})" stroke="#8c8c8c" stroke-width=".6"/><path d="M${x + 2} ${y + 3}h8M${x + 2} ${y + 5}h8M${x + 2} ${y + 7}h6" stroke="#9fb3d6" stroke-width=".7"/></g>`;
  icons['my-documents'] = folderIcon({
    inside: page(7, 4, -8) + page(13, 3.5, 6),
    overlayDefs: lin(pg, [[0, '#fff'], [1, '#e4e8ef']]),
  });
}
{
  const sky = id('sk');
  icons['my-pictures'] = folderIcon({
    overlay:
      `<g transform="rotate(-6 21 20)"><rect x="14" y="14" width="13" height="10" fill="#fff" stroke="#6f6f6f" stroke-width=".6"/><rect x="15" y="15" width="11" height="8" fill="url(#${sky})"/>` +
      `<path d="M15 23v-2.5c2.5-2 5-2.4 11-1.2V23z" fill="#3e9b21"/><circle cx="23.5" cy="17" r="1.1" fill="#ffe36b"/></g>`,
    overlayDefs: lin(sky, [[0, '#3d84e6'], [1, '#bfe0ff']]),
  });
}
{
  const n = id('nt');
  icons['my-music'] = folderIcon({
    overlay: `<path d="M19 14.5l7-2v9.2a2.3 1.8 0 1 1-1.2-1.6v-5.4l-4.6 1.3v6.9a2.3 1.8 0 1 1-1.2-1.6z" fill="url(#${n})" stroke="#0e2f7a" stroke-width=".6"/>`,
    overlayDefs: lin(n, [[0, '#7fb4ff'], [1, '#1b4fc4']]),
  });
}
{
  const s = id('st');
  icons['new-folder'] = folderIcon({
    overlay: `<path d="M25 3l1.3 3.4L30 7l-3.2 1.6L26 12l-1.5-3.3L21 8l3.3-1.4z" fill="url(#${s})" stroke="#b58300" stroke-width=".5"/>`,
    overlayDefs: lin(s, [[0, '#fffbd0'], [1, '#ffc400']]),
  });
}
{
  const b = greenArrowBadge('up', 13, 11, 0.62);
  icons.up = folderIcon({ overlay: b.body, overlayDefs: b.defs });
}
{
  const b = greenArrowBadge('right', 13, 11, 0.62);
  icons.move = folderIcon({ overlay: b.body, overlayDefs: b.defs });
}
{
  const b = greenArrowBadge('left', 13, 11, 0.62);
  icons.restore = folderIcon({ overlay: b.body, overlayDefs: b.defs });
}
{
  const lens = id('ln');
  icons.explorer = folderIcon({
    overlay:
      `<path d="M23.3 22.8l4.6 4.6" stroke="#5a3a12" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="19.5" cy="19" r="5.2" fill="url(#${lens})" stroke="#2b3c55" stroke-width="1.3"/>` +
      `<path d="M16.8 17.2a3.3 3.3 0 0 1 3-2" stroke="#fff" stroke-width=".9" fill="none" opacity=".9"/>`,
    overlayDefs: rad(lens, [[0, '#ffffff', 0.95], [1, '#8fc0ff', 0.75]]),
  });
}
{
  const pen = id('pn');
  icons.rename = folderIcon({
    overlay:
      `<g transform="rotate(45 22 18)"><rect x="19.5" y="9" width="5" height="15" fill="url(#${pen})" stroke="#7a5200" stroke-width=".6"/><path d="M19.5 24h5l-2.5 4.5z" fill="#f4d7a6" stroke="#7a5200" stroke-width=".6"/><path d="M21.4 26.6h1.2l-.6 1.4z" fill="#333"/><rect x="19.5" y="9" width="5" height="2.4" fill="#e86b6b" stroke="#7a5200" stroke-width=".6"/></g>`,
    overlayDefs: lin(pen, [[0, '#ffe68a'], [1, '#e8a516']], 0, 0, 1, 0),
  });
}
{
  const ck = id('ck');
  icons['folder-options'] = folderIcon({
    overlay:
      `<rect x="15" y="13" width="12" height="12" rx="1" fill="url(#${ck})" stroke="#1c5180" stroke-width=".8"/>` +
      `<path d="M17.3 19l2.6 2.7 4.8-5.6" fill="none" stroke="#21a121" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    overlayDefs: lin(ck, [[0, '#fff'], [1, '#dcdcd7']]),
  });
}
{
  const f1 = folderParts();
  const f2 = folderParts();
  icons.copy = svg(
    `<g transform="translate(-3 -3) scale(.8)">${f1.back}${f1.front}</g><g transform="translate(9 8) scale(.72)">${f2.back}${f2.front}</g>`,
    f1.defs + f2.defs,
  );
}
{
  const x = id('dx');
  icons.delete = svg(
    `<path d="M8.5 6.5L16 14l7.5-7.5 3 3L19 17l7.5 7.5-3 3L16 20l-7.5 7.5-3-3L13 17 5.5 9.5z" fill="url(#${x})" stroke="#7a0f00" stroke-width=".9" stroke-linejoin="round"/>` +
      `<path d="M8.6 7.9L16 15.3l7.4-7.4" fill="none" stroke="#ffd2c4" stroke-width=".8" opacity=".8"/>`,
    lin(x, [[0, '#ff8a6a'], [0.5, '#e2351a'], [1, '#a11603']]),
  );
}

// My Computer: monitor with tower
{
  const tw = id('tw');
  const m = monitor({ x: 2, y: 4, w: 21, h: 16 });
  icons['my-computer'] = svg(
    shadow(16, 29, 14, 1.6) +
      `<rect x="21" y="7" width="9" height="20" rx="1" fill="url(#${tw})" stroke="#7d7458" stroke-width=".9"/>` +
      `<path d="M22.5 10h6M22.5 12h6" stroke="#9a927a" stroke-width=".8"/><circle cx="25.5" cy="23.5" r=".8" fill="#3cc23c"/>` +
      m.body,
    m.defs + lin(tw, [[0, '#f6f3e6'], [1, '#c3bb9e']], 0, 0, 1, 0),
  );
}
// Local disk
{
  const top = id('dt');
  const front = id('df');
  icons.drive = svg(
    shadow(16, 26.5, 13, 1.5) +
      `<path d="M4 13l4-5h20l-4 5z" fill="url(#${top})" stroke="#5d6066" stroke-width=".8" stroke-linejoin="round"/>` +
      `<path d="M24 13l4-5v11l-4 5z" fill="#8d9097" stroke="#5d6066" stroke-width=".8" stroke-linejoin="round"/>` +
      `<rect x="4" y="13" width="20" height="11" fill="url(#${front})" stroke="#5d6066" stroke-width=".8"/>` +
      `<path d="M6 20.5h12" stroke="#7b7e86" stroke-width="1.2"/><rect x="19.5" y="19.6" width="2.6" height="1.8" rx=".4" fill="#38d238" stroke="#1d7a1d" stroke-width=".4"/>`,
    lin(top, [[0, '#f4f5f8'], [1, '#c6c9d0']]) + lin(front, [[0, '#e3e5ea'], [1, '#a8acb4']]),
  );
}
// Network places: globe with two computers
function globe({ cx = 16, cy = 14, r = 10 } = {}) {
  const s = sphere([[0, '#c4ecff'], [0.5, '#3f9be8'], [1, '#0f4a9e']], { cx, cy, r, stroke: '#0c3d86' });
  const land =
    `<path d="M${cx - r * 0.7} ${cy - r * 0.2}c2-1.6 3.4-1 4.2.2s2.6 1.1 3.1 2.5-1 2.8-2.6 3c-1.6.2-2-1.5-3.3-1.6s-2.3-1-1.4-4.1z" fill="#55b738" opacity=".95"/>` +
    `<path d="M${cx + r * 0.1} ${cy - r * 0.75}c1.6-.4 3.6.3 4.8 1.8s.4 2.7-1.1 2.6-2-.9-3.2-.5-1.9-.6-1.6-1.7.1-1.9 1.1-2.2z" fill="#55b738" opacity=".95"/>` +
    `<path d="M${cx + r * 0.25} ${cy + r * 0.3}c1.3-.2 2.6.6 2.4 1.8s-1.6 1.9-2.6 1.3-.9-2.9.2-3.1z" fill="#55b738" opacity=".9"/>`;
  return { defs: s.defs, body: s.body.replace(/(<ellipse[^>]*\/>)$/, `${land}$1`) };
}
{
  const g = globe({ cx: 16, cy: 12, r: 9.5 });
  const pc = (x) => {
    const m = monitor({ x, y: 18, w: 10, h: 8, screen: '#2a63d8' });
    return m;
  };
  const a = pc(2);
  const b = pc(20);
  icons.network = svg(shadow(16, 30, 14, 1.4) + g.body + a.body + b.body, g.defs + a.defs + b.defs);
}
// Browser substitute: globe with orbit ring (not the Internet Explorer logo)
{
  const g = globe({ cx: 16, cy: 16, r: 10.5 });
  const ring = id('rg');
  const ringPath = (half) =>
    `<path d="${half === 'back' ? 'M3 18.5C2 14 9 9.2 18 8.2s13 1.8 12.5 4.2' : 'M30.5 12.4c.6 3.7-6 8.5-15 10.2S2.5 22.4 3 18.5'}" fill="none" stroke="url(#${ring})" stroke-width="2.6" stroke-linecap="round"/>`;
  icons.browser = svg(
    shadow(16, 29.3, 11, 1.4) + ringPath('back') + g.body + ringPath('front'),
    g.defs + lin(ring, [[0, '#fff0a8'], [0.5, '#f5b915'], [1, '#c27c00']], 0, 0, 1, 1),
  );
}
// Recycle bin
function bin(full) {
  const body = id('bb');
  const rim = id('br');
  const arrowsG = `<g fill="#2fa52f" stroke="#155f15" stroke-width=".5" stroke-linejoin="round">
    <path d="M14.2 14.6l1.9-3.1 1.9 3.1h-1.2l-.7-1.2-.7 1.2z"/>
    <path d="M19.2 19.6l-1.8 3.1h-3.7l.6-1h2.6l.8-1.3-.9-.5 2.6-.6.6 2.6z" />
    <path d="M12.2 22.7l-1.9-3.2 1-.6-.1-1h0l1.6 2 .1 1.4.9.4z" transform="translate(.6 -.4)"/>
  </g>`;
  const paper = full
    ? `<path d="M8.6 9.4c-.6-2.4 1.2-4.6 3.6-4 .6-2.2 3.6-2.9 5-1 1.6-1.6 4.4-.8 4.6 1.5 1.8-.2 3 1.6 2.4 3.5z" fill="#fff" stroke="#8a919c" stroke-width=".7"/>` +
      `<path d="M10.5 7.6l2.2.6M15.2 5.6l1.4 2M19.6 6.4l.6 1.8" stroke="#a9b0ba" stroke-width=".7"/>` +
      `<path d="M17.8 2.8l3.4 5.4" stroke="#8a919c" stroke-width=".6"/><path d="M18.4 2.4l4.6-.6 1.4 4.8-3.2 1.6z" fill="#fff6c8" stroke="#8a919c" stroke-width=".6"/>`
    : '';
  return svg(
    shadow(16, 29.4, 10, 1.4) +
      `<path d="M7.5 9.5h17l-2 18c-.1.6-.6 1-1.2 1h-10.6c-.6 0-1.1-.4-1.2-1z" fill="url(#${body})" stroke="#5f7189" stroke-width=".9" stroke-linejoin="round"/>` +
      `<path d="M10.5 11.5l1 15M13.5 11.5l.5 15M18.5 11.5l-.5 15M21.5 11.5l-1 15" stroke="#fff" stroke-width=".7" opacity=".55"/>` +
      `<ellipse cx="16" cy="9.6" rx="8.8" ry="2.1" fill="url(#${rim})" stroke="#5f7189" stroke-width=".9"/>` +
      `<ellipse cx="16" cy="9.6" rx="7" ry="1.2" fill="#6d7f99" opacity=".45"/>` +
      paper +
      `<g transform="translate(0 1)">${arrowsG}</g>`,
    lin(body, [[0, '#f2f6fb'], [0.5, '#c9d6e6'], [1, '#93a7c1']], 0, 0, 1, 0.3) + lin(rim, [[0, '#ffffff'], [1, '#b3c2d6']]),
  );
}
icons['recycle-empty'] = bin(false);
icons['recycle-full'] = bin(true);

// Calculator
{
  const b = id('cb');
  const d = id('cd');
  let keys = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const color = c === 3 ? '#d9534f' : '#4a6fb5';
      keys += `<rect x="${8.6 + c * 4}" y="${13.4 + r * 3.6}" width="3" height="2.4" rx=".5" fill="${color}" stroke="#2a2a2a" stroke-width=".3"/>`;
    }
  }
  icons.calculator = svg(
    shadow(16, 29.6, 10, 1.4) +
      `<rect x="6" y="3" width="20" height="26" rx="2" fill="url(#${b})" stroke="#4c5058" stroke-width=".9"/>` +
      `<rect x="8.4" y="5.4" width="15.2" height="5.6" rx=".6" fill="url(#${d})" stroke="#3e4a3a" stroke-width=".6"/>` +
      `<path d="M19 8.8h3" stroke="#243020" stroke-width="1.1"/>` +
      keys,
    lin(b, [[0, '#f4f5f7'], [1, '#a7abb4']], 0, 0, 1, 1) + lin(d, [[0, '#d9e8c8'], [1, '#aac49a']]),
  );
}
// Help: blue sphere with question mark
{
  const s = sphere(BLUE_SPHERE);
  icons.help = svg(shadow(16, 29.5, 9, 1.3) + s.body + questionMark('#fff', 1, 0, 0), s.defs);
}
{
  const s = sphere(BLUE_SPHERE);
  icons.question = svg(s.body + questionMark('#fff'), s.defs);
}
{
  const s = sphere(BLUE_SPHERE);
  icons.info = svg(
    s.body + `<circle cx="16" cy="9.6" r="1.8" fill="#fff"/><path d="M13.6 13.2h4v8.6h1.6v2h-6.4v-2h1.6v-6.6h-.8z" fill="#fff"/>`,
    s.defs,
  );
}
{
  const s = sphere(RED_SPHERE, { stroke: '#7a1203' });
  icons.error = svg(
    s.body + `<path d="M11 11l10 10M21 11L11 21" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    s.defs,
  );
}
{
  const t = id('wt');
  icons.warning = svg(
    `<path d="M16 3.5l13.2 23.3c.4.7-.1 1.5-.9 1.5H3.7c-.8 0-1.3-.8-.9-1.5z" fill="url(#${t})" stroke="#8a6500" stroke-width=".9" stroke-linejoin="round"/>` +
      `<path d="M14.6 11h2.8l-.5 8.6h-1.8z" fill="#1f1f1f"/><circle cx="16" cy="23" r="1.6" fill="#1f1f1f"/>`,
    lin(t, [[0, '#fff7c2'], [0.5, '#ffd83a'], [1, '#e8a800']]),
  );
}
// Search: magnifier
{
  const lens = id('sl');
  const h = id('sh');
  icons.search = svg(
    shadow(17, 29.5, 10, 1.3) +
      `<path d="M19.5 19.5l7.5 7.5" stroke="url(#${h})" stroke-width="4.4" stroke-linecap="round"/>` +
      `<circle cx="13" cy="13" r="8.6" fill="url(#${lens})" stroke="#2c3f5c" stroke-width="2"/>` +
      `<path d="M8.4 11a5.4 5.4 0 0 1 4.6-3.8" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
    rad(lens, [[0, '#ffffff', 0.95], [0.7, '#bfe0ff', 0.85], [1, '#6aa8f0', 0.9]]) + lin(h, [[0, '#8a5a1e'], [1, '#4b2e0a']]),
  );
}
// Run: small window with arrow
function miniWindow({ x = 3, y = 5, w = 22, h = 18, content = '' } = {}) {
  const t = id('mt');
  const c = id('mc');
  return {
    defs: lin(t, [[0, '#4a8cf7'], [1, '#0a3fc0']]) + lin(c, [[0, '#ffffff'], [1, '#e8e6dc']]),
    body:
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="url(#${c})" stroke="#0b3a9c" stroke-width=".9"/>` +
      `<path d="M${x} ${y + 1.2}c0-.7.5-1.2 1.2-1.2h${w - 2.4}c.7 0 1.2.5 1.2 1.2V${y + 4}H${x}z" fill="url(#${t})"/>` +
      `<rect x="${x + w - 3.6}" y="${y + 0.8}" width="2.6" height="2.4" rx=".5" fill="#e2401f" stroke="#fff" stroke-width=".4"/>` +
      content,
  };
}
{
  const w = miniWindow({ x: 2, y: 4, w: 20, h: 17 });
  const b = greenArrowBadge('right', 13, 12, 0.6);
  icons.run = svg(shadow(16, 29, 12, 1.3) + w.body + b.body, w.defs + b.defs);
}
{
  const w = miniWindow({
    x: 3,
    y: 4,
    w: 26,
    h: 22,
    content: `<rect x="5.5" y="10" width="21" height="13" fill="#000"/><path d="M6 20l3-3 3 2 4-6 3 4 3-2 3.5 3" fill="none" stroke="#2ee82e" stroke-width="1.2"/>`,
  });
  icons['task-manager'] = svg(shadow(16, 29, 13, 1.3) + w.body, w.defs);
}
// Log off / Turn off tiles
function tile(stopsList, glyph, stroke) {
  const g = id('tl');
  return svg(
    `<rect x="3" y="3" width="26" height="26" rx="4" fill="url(#${g})" stroke="${stroke}" stroke-width="1"/>` +
      `<path d="M5.5 5.5h21" stroke="#fff" stroke-width="1" opacity=".55" stroke-linecap="round"/>` +
      glyph,
    lin(g, stopsList, 0, 0, 0.6, 1),
  );
}
icons['log-off'] = tile(
  [[0, '#ffd77a'], [0.5, '#f5a623'], [1, '#c96f00']],
  `<circle cx="12" cy="13" r="4.4" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M15.2 16.2l7.8 7.8M20.4 21.4l2-2M22.6 23.6l1.6-1.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  '#9a5300',
);
icons['turn-off'] = tile(
  [[0, '#ffa58a'], [0.5, '#e8461e'], [1, '#a81e02']],
  `<path d="M11.3 10.4a7.6 7.6 0 1 0 9.4 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M16 7v8.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`,
  '#7f1500',
);
// Control panel
{
  const p = id('cp');
  icons['control-panel'] = svg(
    shadow(16, 29.5, 13, 1.3) +
      `<rect x="3" y="4" width="26" height="23" rx="1.5" fill="url(#${p})" stroke="#5a6170" stroke-width=".9"/>` +
      `<circle cx="11" cy="12" r="5" fill="#2f7be6" stroke="#123f9e" stroke-width=".6"/><path d="M11 12V7a5 5 0 0 1 4.6 7z" fill="#f5b915" stroke="#a87200" stroke-width=".5"/>` +
      `<path d="M19 9h7M19 12.5h7M19 16h7" stroke="#7f8796" stroke-width="1.2"/>` +
      `<path d="M6 21.5h20M6 24.5h20" stroke="#7f8796" stroke-width="1"/><rect x="9" y="20" width="2.4" height="3" fill="#3cb043" stroke="#1d6a12" stroke-width=".4"/><rect x="19" y="23" width="2.4" height="3" fill="#e2401f" stroke="#8f1606" stroke-width=".4"/>`,
    lin(p, [[0, '#ffffff'], [1, '#cfd4dd']]),
  );
}
// Display
{
  const sky = id('ds');
  const m = monitor({ x: 3, y: 3, w: 26, h: 19, screen: `url(#${sky})` });
  icons.display = svg(
    shadow(16, 29.6, 11, 1.3) + m.body + `<path d="M5 18.5c5-3.2 11-3.8 22-1.6V19H5z" fill="#4ea72c"/>`,
    m.defs + lin(sky, [[0, '#2f6fd6'], [1, '#b6d8ff']]),
  );
}
// Taskbar and Start menu
{
  const w = miniWindow({ x: 3, y: 4, w: 26, h: 22 });
  icons.taskbar = svg(
    shadow(16, 29.5, 13, 1.3) +
      w.body +
      `<rect x="3.5" y="21.5" width="25" height="4" fill="#245edb"/><rect x="3.5" y="21.5" width="7" height="4" rx="1.2" fill="#3ca63c"/>` +
      `<rect x="5" y="9.5" width="10" height="11" fill="#fff" stroke="#245edb" stroke-width=".7"/><rect x="5" y="9.5" width="10" height="2.4" fill="#245edb"/>`,
    w.defs,
  );
}
// Sounds: speaker with waves
function speaker({ muted = false, waves = true } = {}) {
  const s = id('spk');
  return svg(
    `<path d="M5 12h5l7-6v20l-7-6H5z" fill="url(#${s})" stroke="#4a4f5a" stroke-width=".9" stroke-linejoin="round"/>` +
      (waves && !muted
        ? `<path d="M20.5 11.5a6 6 0 0 1 0 9M23.5 8.5a10 10 0 0 1 0 15" fill="none" stroke="#2f7be6" stroke-width="1.8" stroke-linecap="round"/>`
        : '') +
      (muted ? `<circle cx="23" cy="16" r="5.6" fill="none" stroke="#e2261a" stroke-width="2"/><path d="M19.2 19.8l7.6-7.6" stroke="#e2261a" stroke-width="2"/>` : ''),
    lin(s, [[0, '#ffffff'], [1, '#a9b0bd']], 0, 0, 1, 1),
  );
}
icons.sounds = speaker();
icons.volume = speaker();
icons['volume-muted'] = speaker({ muted: true });
// Date and time: calendar + clock
{
  const c = id('cal');
  const k = id('clk');
  icons['date-time'] = svg(
    shadow(16, 29.5, 13, 1.3) +
      `<rect x="3" y="5" width="20" height="20" rx="1" fill="#fff" stroke="#6f6f6f" stroke-width=".9"/><rect x="3" y="5" width="20" height="5" fill="url(#${c})"/>` +
      `<path d="M6 13h2M10 13h2M14 13h2M18 13h2M6 16h2M10 16h2M14 16h2M6 19h2M10 19h2" stroke="#4a4a4a" stroke-width="1.4"/>` +
      `<circle cx="22" cy="21" r="7.2" fill="url(#${k})" stroke="#1d3f86" stroke-width="1"/><path d="M22 16.6V21l3 2" stroke="#1d1d1d" stroke-width="1.4" stroke-linecap="round" fill="none"/>`,
    lin(c, [[0, '#ff7a5c'], [1, '#c5260b']]) + rad(k, [[0, '#ffffff'], [1, '#d5e3f7']]),
  );
}
// Accessibility
{
  const s = sphere(BLUE_SPHERE);
  icons.accessibility = svg(
    shadow(16, 29.5, 9, 1.3) +
      s.body +
      `<circle cx="16" cy="8.6" r="2.2" fill="#fff"/><path d="M8.5 12.2l7.5 1.6 7.5-1.6M16 13.8v4.4l-3.4 6.2M16 18.2l3.4 6.2" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
    s.defs,
  );
}
// Navigation spheres
for (const dir of ['left', 'right']) {
  const s = sphere(GREEN_SPHERE, { stroke: '#1b5e10' });
  icons[dir === 'left' ? 'back' : 'forward'] = svg(s.body + arrow(dir), s.defs);
}
{
  const g = id('go');
  icons.go = svg(
    `<rect x="4" y="4" width="24" height="24" rx="3" fill="url(#${g})" stroke="#1b5e10" stroke-width="1"/>` + arrow('right'),
    lin(g, GREEN_SPHERE.map(([o, c]) => [o, c]), 0, 0, 0.5, 1),
  );
}
{
  const s = sphere(RED_SPHERE, { stroke: '#7a1203' });
  icons.stop = svg(s.body + `<path d="M11.5 11.5l9 9M20.5 11.5l-9 9" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`, s.defs);
}
icons.refresh = svg(
  `<path d="M24.5 13A9 9 0 0 0 8 10.5" fill="none" stroke="#2c9a2c" stroke-width="3.2" stroke-linecap="round"/><path d="M5 6.5l1.6 7.4 7-2.8z" fill="#2c9a2c"/>` +
    `<path d="M7.5 19A9 9 0 0 0 24 21.5" fill="none" stroke="#2c9a2c" stroke-width="3.2" stroke-linecap="round"/><path d="M27 25.5l-1.6-7.4-7 2.8z" fill="#2c9a2c"/>`,
);
{
  const r = id('rf');
  const w = id('wl');
  icons.home = svg(
    shadow(16, 29.4, 12, 1.2) +
      `<path d="M16 4L3 15h3.5v13h19V15H29z" fill="url(#${w})" stroke="#7a5d2c" stroke-width=".9" stroke-linejoin="round"/>` +
      `<path d="M16 3L2 15.5l1.8 1.6L16 6.3l12.2 10.8 1.8-1.6z" fill="url(#${r})" stroke="#7a1608" stroke-width=".7" stroke-linejoin="round"/>` +
      `<rect x="13" y="19" width="6" height="9" fill="#8a5a1e"/><rect x="21" y="17" width="4" height="4" fill="#bfe0ff" stroke="#7a5d2c" stroke-width=".6"/>`,
    lin(r, [[0, '#ff7a5c'], [1, '#b8260b']]) + lin(w, [[0, '#fff7e0'], [1, '#e2cfa0']]),
  );
}
// Toolbar: views and folders
icons.views = svg(
  `<rect x="3" y="4" width="26" height="24" rx="1" fill="#fff" stroke="#5a6170" stroke-width=".9"/>` +
    [0, 1].map((r) => [0, 1].map((c) => `<rect x="${6 + c * 12}" y="${7 + r * 10}" width="8" height="7" rx="1" fill="${['#f5c542', '#2f7be6', '#3cb043', '#e2401f'][r * 2 + c]}" stroke="#444" stroke-width=".4"/>`).join('')).join(''),
);
{
  const f = folderParts();
  icons.folders = svg(
    `<path d="M5 4v22h6M5 11h6M5 18.5h6" fill="none" stroke="#5a6170" stroke-width="1.2" stroke-dasharray="1.2 1.2"/>` +
      `<g transform="translate(9 0) scale(.72)">${f.back}${f.front}</g><g transform="translate(9 11) scale(.6)">${folderParts().back}</g>`,
    f.defs,
  );
}
// Show Desktop: desk pad with pencil
{
  const d = id('dk');
  icons['show-desktop'] = svg(
    `<path d="M3 10h26l-3 16H6z" fill="url(#${d})" stroke="#0b3a9c" stroke-width=".9" stroke-linejoin="round"/>` +
      `<path d="M7 13h18" stroke="#fff" stroke-width=".8" opacity=".6"/>` +
      `<g transform="rotate(35 20 10)"><rect x="18" y="1" width="3.4" height="14" fill="#ffd34d" stroke="#8a5d00" stroke-width=".6"/><path d="M18 15h3.4l-1.7 3z" fill="#f4d7a6" stroke="#8a5d00" stroke-width=".5"/></g>`,
    lin(d, [[0, '#7fb4ff'], [1, '#1b4fc4']]),
  );
}
// Start logo: original four-pane window glyph (not the Microsoft logo)
{
  const pane = (x, y, c1, c2) => {
    const g = id('lp');
    return {
      defs: lin(g, [[0, c1], [1, c2]], 0, 0, 1, 1),
      body: `<path d="M${x} ${y + 1}q3.4-1.6 6.8 0v6.4q-3.4-1.6-6.8 0z" transform="translate(0 0)" fill="url(#${g})"/>`,
    };
  };
  const parts = [
    pane(8.5, 6.2, '#ff8a5c', '#e8380d'),
    pane(16.1, 6.2, '#9ef06a', '#2fa514'),
    pane(8.5, 14.6, '#7fc4ff', '#1a62e0'),
    pane(16.1, 14.6, '#ffe57a', '#f5b400'),
  ];
  icons['start-logo'] = svg(
    `<g transform="skewY(-6) translate(0 2)">${parts.map((p) => p.body).join('')}</g>`,
    parts.map((p) => p.defs).join(''),
  );
}
// User picture: original daisy on a blue-green field
{
  const bg = id('ub');
  let petals = '';
  for (let i = 0; i < 12; i++) {
    petals += `<ellipse cx="16" cy="9" rx="2.4" ry="5.6" fill="#fff" stroke="#d8d8d8" stroke-width=".4" transform="rotate(${i * 30} 16 15)"/>`;
  }
  const c = id('uc');
  icons.user = svg(
    `<rect width="32" height="32" fill="url(#${bg})"/>` + petals + `<circle cx="16" cy="15" r="4.2" fill="url(#${c})" stroke="#b07f00" stroke-width=".5"/>`,
    lin(bg, [[0, '#5aa0e8'], [0.6, '#78c26a'], [1, '#3f8f2a']]) + rad(c, [[0, '#fff2a0'], [1, '#f2a900']]),
  );
}
// Control Panel categories without applets (shown disabled)
{
  const p = id('pr');
  icons.printer = svg(
    shadow(16, 29.5, 13, 1.3) +
      `<rect x="9" y="3" width="14" height="9" fill="#fff" stroke="#6f6f6f" stroke-width=".8"/>` +
      `<rect x="3" y="11" width="26" height="12" rx="2" fill="url(#${p})" stroke="#4c5058" stroke-width=".9"/>` +
      `<rect x="8" y="20" width="16" height="7" fill="#fff" stroke="#6f6f6f" stroke-width=".8"/><circle cx="25" cy="15" r=".9" fill="#3cc23c"/>`,
    lin(p, [[0, '#eef0f4'], [1, '#9ea4ae']]),
  );
}
{
  const a = id('ua');
  const b2 = id('ub2');
  icons['user-accounts'] = svg(
    shadow(16, 29.5, 13, 1.3) +
      `<circle cx="11" cy="10" r="4.4" fill="#f2c9a0" stroke="#8a5d3a" stroke-width=".7"/><path d="M3.5 27c0-6 3.4-9 7.5-9s7.5 3 7.5 9z" fill="url(#${a})" stroke="#1b4fc4" stroke-width=".7"/>` +
      `<circle cx="21" cy="11.5" r="4" fill="#f2c9a0" stroke="#8a5d3a" stroke-width=".7"/><path d="M14.5 27.5c0-5.4 3-8 6.5-8s6.5 2.6 6.5 8z" fill="url(#${b2})" stroke="#1d6a12" stroke-width=".7"/>`,
    lin(a, [[0, '#7fb4ff'], [1, '#1b4fc4']]) + lin(b2, [[0, '#a8e37c'], [1, '#2f8f1a']]),
  );
}
{
  const bx = id('bx');
  const cd = id('cdk');
  icons['add-remove'] = svg(
    shadow(16, 29.5, 13, 1.3) +
      `<path d="M4 12l12-5 12 5v13l-12 5-12-5z" fill="url(#${bx})" stroke="#7a5d2c" stroke-width=".9" stroke-linejoin="round"/><path d="M4 12l12 5 12-5M16 17v13" stroke="#7a5d2c" stroke-width=".9" fill="none"/>` +
      `<circle cx="21" cy="9" r="7" fill="url(#${cd})" stroke="#7a8296" stroke-width=".7"/><circle cx="21" cy="9" r="1.6" fill="#fff" stroke="#7a8296" stroke-width=".5"/>`,
    lin(bx, [[0, '#f8e2b0'], [1, '#c99a4c']]) + rad(cd, [[0, '#ffffff'], [0.6, '#cfe0ff'], [1, '#e8c6ff']]),
  );
}
{
  const gauge = id('ga');
  icons.performance = svg(
    shadow(16, 29.5, 13, 1.3) +
      `<path d="M3 22a13 13 0 0 1 26 0z" fill="url(#${gauge})" stroke="#4c5058" stroke-width=".9"/>` +
      `<path d="M6 21a10 10 0 0 1 3-7" stroke="#3cb043" stroke-width="2.4" fill="none"/><path d="M10 13a10 10 0 0 1 12 0" stroke="#f5b915" stroke-width="2.4" fill="none"/><path d="M23 14a10 10 0 0 1 3 7" stroke="#e2401f" stroke-width="2.4" fill="none"/>` +
      `<path d="M16 21l6-8" stroke="#222" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="21" r="1.6" fill="#222"/>`,
    lin(gauge, [[0, '#ffffff'], [1, '#c9ced8']]),
  );
}
{
  const sh = id('shd');
  icons.security = svg(
    shadow(16, 29.5, 10, 1.3) +
      `<path d="M16 3l11 4v8c0 7-5 11.5-11 14C10 26.5 5 22 5 15V7z" fill="url(#${sh})" stroke="#123f9e" stroke-width=".9"/>` +
      `<path d="M11 15.5l3.5 3.6 6.8-7.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    lin(sh, [[0, '#9fd0ff'], [1, '#1b4fc4']]),
  );
}
{
  const pal = id('pal');
  icons.appearance = svg(
    shadow(16, 29.5, 13, 1.3) +
      `<path d="M16 4C8.5 4 3 9 3 15.5S8 27 13.5 27c2 0 2.5-1.2 2-2.6-.6-1.6.4-2.9 2.1-2.9h3.4C25.6 21.5 29 18.6 29 14.5 29 8.6 23.3 4 16 4z" fill="url(#${pal})" stroke="#7a5d2c" stroke-width=".9"/>` +
      `<circle cx="9" cy="14" r="2.2" fill="#e2401f"/><circle cx="12.5" cy="8.8" r="2.2" fill="#f5b915"/><circle cx="19" cy="8" r="2.2" fill="#3cb043"/><circle cx="24" cy="12" r="2.2" fill="#2f7be6"/>`,
    lin(pal, [[0, '#fff6dc'], [1, '#e2c88e']]),
  );
}
{
  const g = globe({ cx: 14, cy: 14, r: 10 });
  icons['network-connections'] = svg(
    shadow(16, 29.5, 12, 1.3) + g.body + `<path d="M20 22h8v4h-8z" fill="#c9ced8" stroke="#4c5058" stroke-width=".7"/><path d="M22 22v-3M26 22v-3" stroke="#4c5058" stroke-width="1.2"/><path d="M24 26v3" stroke="#4c5058" stroke-width="1.6"/>`,
    g.defs,
  );
}

for (const [name, content] of Object.entries(icons)) writeFileSync(join(iconDir, `${name}.svg`), content);

// ---------------------------------------------------------------- wallpapers
const W = 1600;
const H = 1000;
const wall = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>\n`;

function clouds(list) {
  return list
    .map(
      ([x, y, s, op]) =>
        `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}" filter="url(#blur)"><ellipse cx="0" cy="0" rx="120" ry="38" fill="#fff"/><ellipse cx="-70" cy="10" rx="80" ry="26" fill="#fff"/><ellipse cx="80" cy="8" rx="90" ry="28" fill="#fff"/><ellipse cx="20" cy="-22" rx="70" ry="30" fill="#fff"/></g>`,
    )
    .join('');
}

writeFileSync(
  join(wallDir, 'hillside.svg'),
  wall(
    lin('sky', [[0, '#1d5fcc'], [0.35, '#3f86e0'], [0.62, '#8dbdf0'], [0.8, '#cfe3f8']]) +
      lin('hill', [[0, '#8fd14a'], [0.35, '#5aa524'], [0.75, '#357a14'], [1, '#225a0b']]) +
      lin('back', [[0, '#a9d97a'], [1, '#6aa83c']]) +
      `<radialGradient id="sun" cx=".35" cy=".62" r=".45"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
      `<filter id="blur" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>` +
      `<filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>`,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
      clouds([
        [260, 170, 1.2, 0.85],
        [700, 110, 0.9, 0.7],
        [1180, 210, 1.4, 0.9],
        [1460, 120, 0.8, 0.65],
        [520, 330, 0.7, 0.55],
        [960, 360, 0.6, 0.5],
      ]) +
      `<path d="M0 660C220 600 420 590 640 620S1100 640 1600 590V1000H0z" fill="url(#back)" opacity=".85" filter="url(#soft)"/>` +
      `<path d="M0 720C260 610 560 560 860 600S1360 700 1600 660V1000H0z" fill="url(#hill)"/>` +
      `<path d="M0 720C260 610 560 560 860 600S1360 700 1600 660V1000H0z" fill="url(#sun)"/>` +
      `<path d="M0 860C380 800 900 820 1600 780" stroke="#2e6d10" stroke-width="40" opacity=".18" fill="none" filter="url(#soft)"/>`,
  ),
);

writeFileSync(
  join(wallDir, 'azure.svg'),
  wall(
    lin('bg', [[0, '#0b3d91'], [0.5, '#1f6fd1'], [1, '#5aa8f0']], 0, 0, 1, 1) +
      `<radialGradient id="glow" cx=".7" cy=".3" r=".6"><stop offset="0" stop-color="#bfe3ff" stop-opacity=".55"/><stop offset="1" stop-color="#bfe3ff" stop-opacity="0"/></radialGradient>` +
      `<filter id="blur"><feGaussianBlur stdDeviation="30"/></filter>`,
    `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>` +
      `<path d="M-100 820C300 640 700 900 1100 700S1500 560 1700 600" stroke="#9fd3ff" stroke-width="90" fill="none" opacity=".25" filter="url(#blur)"/>` +
      `<path d="M-100 380C400 220 800 520 1700 260" stroke="#ffffff" stroke-width="60" fill="none" opacity=".12" filter="url(#blur)"/>`,
  ),
);

writeFileSync(
  join(wallDir, 'dusk.svg'),
  wall(
    lin('sky', [[0, '#1b2a6b'], [0.45, '#6a4fa3'], [0.75, '#e2876a'], [0.9, '#f8c47a']]) +
      lin('far', [[0, '#3c3a78'], [1, '#2a2758']]) +
      lin('near', [[0, '#1d2b4a'], [1, '#0d1426']]) +
      `<filter id="blur" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="16"/></filter>`,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
      `<circle cx="1120" cy="700" r="70" fill="#ffe2a0" opacity=".85" filter="url(#blur)"/>` +
      clouds([
        [380, 230, 1.1, 0.25],
        [1250, 300, 1.3, 0.22],
      ]) +
      `<path d="M0 740C300 640 520 700 760 660S1240 600 1600 700V1000H0z" fill="url(#far)"/>` +
      `<path d="M0 830C340 760 700 800 1000 770S1400 760 1600 800V1000H0z" fill="url(#near)"/>`,
  ),
);

// Favicon reuses the start glyph.
writeFileSync(join(root, 'public/favicon.svg'), icons['start-logo']);

console.log(`Wrote ${Object.keys(icons).length} icons and 3 wallpapers.`);
