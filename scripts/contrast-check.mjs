#!/usr/bin/env node
// APCA contrast verification for the active theme.
// Run: npm run contrast-check
// Reads tokens/theme.css (falls back to theme.example.css), resolves the
// brand pairs, and verifies them against APCA thresholds.
// Thresholds (abs Lc): 90 primary text, 75 body text, 60 large/bold 24px+, 45 non-text UI.

import { readFileSync, existsSync } from 'node:fs';
import { converter, formatHex, parse } from 'culori';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { colorParsley } from 'colorparsley';

const toRgbHex = (cssColor) => {
  const parsed = parse(cssColor.trim());
  if (!parsed) return null;
  return formatHex(converter('rgb')(parsed));
};

const Lc = (fgHex, bgHex) =>
  Math.abs(APCAcontrast(sRGBtoY(colorParsley(fgHex)), sRGBtoY(colorParsley(bgHex))));

const themePath = existsSync('tokens/theme.css') ? 'tokens/theme.css' : 'tokens/theme.example.css';
const src = readFileSync(themePath, 'utf8');

// crude but sufficient: pull var definitions per scope
const scopes = { light: {}, dark: {} };
let current = 'light';
for (const line of src.split('\n')) {
  if (/\.dark\s*{/.test(line)) current = 'dark';
  if (/^:root\s*{/.test(line)) current = 'light';
  const m = line.match(/(--[\w-]+):\s*([^;]+);/);
  if (m && !line.trim().startsWith('/*')) scopes[current][m[1]] = m[2].trim();
}

// canvas backgrounds from primitives (fixed)
const CANVAS = { light: '#f8fafe', dark: '#090a0c' };

const checks = [];
for (const mode of ['light', 'dark']) {
  const vars = { ...scopes.light, ...(mode === 'dark' ? scopes.dark : {}) };
  const primary = toRgbHex(vars['--brand-primary'] ?? '');
  const primaryText = toRgbHex(vars['--brand-primary-text'] ?? '');
  const accent = toRgbHex(vars['--brand-accent'] ?? '');
  if (primary && primaryText) {
    checks.push({ label: `${mode}: text on --brand-primary (buttons)`, lc: Lc(primaryText, primary), min: 75 });
  }
  if (primary) {
    checks.push({ label: `${mode}: --brand-primary as UI element on canvas`, lc: Lc(primary, CANVAS[mode]), min: 45 });
  }
  if (accent) {
    checks.push({ label: `${mode}: --brand-accent as UI element on canvas`, lc: Lc(accent, CANVAS[mode]), min: 45 });
  }
}

if (checks.length === 0) {
  console.error(`contrast-check: could not resolve brand colors in ${themePath}.`);
  process.exit(1);
}

console.log(`contrast-check (${themePath}), APCA:\n`);
let failed = 0;
for (const c of checks) {
  const pass = c.lc >= c.min;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  Lc ${String(Math.round(c.lc)).padStart(3)} (min ${c.min})  ${c.label}`);
}
if (failed > 0) {
  console.error(`\n${failed} pair(s) failed. Adjust L (lightness) in OKLCH until they pass.`);
  console.error('Rule of thumb: increase the L distance between text and background.');
}
process.exit(failed > 0 ? 1 : 0);
