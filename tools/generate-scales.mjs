// Verifies the color system in tokens/primitives.css against APCA.
// primitives.css is the source of truth: this script PARSES it, so drift
// between CSS and checks is impossible (review finding: dual sources).
// Run: node tools/generate-scales.mjs
//
// Threshold tiers (abs Lc), per README:
//   90  primary text
//   75  body text (secondary, status text, links)
//   60  meta text (tertiary: hints, timestamps, placeholders; never body copy)
//   45  non-text UI (icons, status indicators)
//   30  input/control borders (paired with filled bg + visible label)
//   --  decorative separators: exempt (WCAG 1.4.11 non-essential), reported informationally
//
// Tertiary text is only permitted on canvas/surface/raised/sunken.
// On hover/active surfaces, use primary or secondary text (see semantic.css).

import { readFileSync } from 'node:fs';
import { converter, formatHex, parse } from 'culori';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { colorParsley } from 'colorparsley';

const css = readFileSync(new URL('../tokens/primitives.css', import.meta.url), 'utf8');
const vars = {};
for (const m of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  const val = m[2].trim();
  if (val.startsWith('oklch(') && !val.includes('var(')) vars[m[1]] = val;
}

const hex = (name) => {
  const raw = vars[name];
  if (!raw) throw new Error(`Missing primitive: ${name}`);
  return formatHex(converter('rgb')(parse(raw)));
};
const WHITE = '#ffffff';
const Lc = (fg, bg) => Math.abs(APCAcontrast(sRGBtoY(colorParsley(fg)), sRGBtoY(colorParsley(bg))));

const checks = [];
const add = (label, fg, bg, min) => {
  const v = Lc(fg, bg);
  checks.push({ label, lc: v, min, pass: v >= min });
};

/* ================= LIGHT MODE =================
   Surfaces: canvas=gray-50, surface/raised=white, sunken/hover=gray-100, active=gray-200 */
const L = {
  canvas: hex('--gray-50'), surface: WHITE, sunken: hex('--gray-100'),
  hover: hex('--gray-100'), active: hex('--gray-200'),
};
const Ltext = { primary: [hex('--gray-950'), 90], secondary: [hex('--gray-700'), 75] };

for (const [tname, [t, min]] of Object.entries(Ltext))
  for (const [sname, s] of Object.entries(L))
    add(`LIGHT ${tname} on ${sname}`, t, s, min);
for (const sname of ['canvas', 'surface', 'sunken'])
  add(`LIGHT tertiary on ${sname}`, hex('--gray-600'), L[sname], 60);

add('LIGHT separator (border-subtle, decorative, exempt) vs surface', hex('--gray-200'), WHITE, 0);
add('LIGHT input border (border-strong) vs surface', hex('--gray-400'), WHITE, 30);
add('LIGHT text on primary button', WHITE, hex('--gray-900'), 90);

for (const s of ['error', 'warning', 'success', 'info']) {
  add(`LIGHT ${s}-text on ${s}-bg`, hex(`--${s}-text`), hex(`--${s}-bg`), 75);
  add(`LIGHT ${s}-text on canvas`, hex(`--${s}-text`), L.canvas, 75);
  add(`LIGHT ${s}-text on surface`, hex(`--${s}-text`), L.surface, 75);
  add(`LIGHT ${s}-base (icon) on canvas`, hex(`--${s}-base`), L.canvas, 45);
  add(`LIGHT ${s}-base (icon) on surface`, hex(`--${s}-base`), L.surface, 45);
}
add('LIGHT white text on error-base (destructive btn)', WHITE, hex('--error-base'), 75);

/* ================= DARK MODE =================
   Surfaces: canvas=gray-950, surface=gray-900, raised=gray-800,
   sunken=gray-925, hover=gray-800, active=gray-750 */
const D = {
  canvas: hex('--gray-950'), surface: hex('--gray-900'), raised: hex('--gray-800'),
  sunken: hex('--gray-925'), hover: hex('--gray-800'), active: hex('--gray-750'),
};
const Dtext = { primary: [hex('--gray-50'), 90], secondary: [hex('--gray-200'), 75] };

for (const [tname, [t, min]] of Object.entries(Dtext))
  for (const [sname, s] of Object.entries(D))
    add(`DARK ${tname} on ${sname}`, t, s, min);
for (const sname of ['canvas', 'surface', 'raised', 'sunken'])
  add(`DARK tertiary on ${sname}`, hex('--gray-400'), D[sname], 60);

add('DARK separator (border-subtle, decorative, exempt) vs surface', hex('--gray-800'), D.surface, 0);
add('DARK input border (border-strong) vs surface', hex('--gray-500'), D.surface, 30);
add('DARK text on primary button', hex('--gray-950'), hex('--gray-50'), 90);

for (const s of ['error', 'warning', 'success', 'info']) {
  add(`DARK ${s}-text on ${s}-bg`, hex(`--${s}-text-dark`), hex(`--${s}-bg-dark`), 75);
  add(`DARK ${s}-text on canvas`, hex(`--${s}-text-dark`), D.canvas, 75);
  add(`DARK ${s}-text on surface`, hex(`--${s}-text-dark`), D.surface, 75);
  add(`DARK ${s}-base (icon) on canvas`, hex(`--${s}-base-dark`), D.canvas, 45);
  add(`DARK ${s}-base (icon) on surface`, hex(`--${s}-base-dark`), D.surface, 45);
}

/* ================= REPORT ================= */
let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  Lc ${String(Math.round(c.lc)).padStart(3)} (min ${c.min})  ${c.label}`);
}
console.log(`\n${checks.length} pairs checked against tokens/primitives.css (parsed, not hardcoded).`);
console.log(failed === 0 ? 'All pairs pass APCA.' : `${failed} FAILED.`);
process.exit(failed === 0 ? 0 : 1);
