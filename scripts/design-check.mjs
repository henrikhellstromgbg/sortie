#!/usr/bin/env node
// Machine enforcement of [lint]-tagged rules in design-rules/RULES.md.
// Run: npm run design-check
// Hardened after external review: comments are masked character-wise (not
// line-skipped), matching is case-insensitive, arbitrary font sizes are
// parsed numerically, and modern color functions (oklab, lab, lch, color())
// plus Tailwind palette utilities are caught.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['app', 'components', 'examples', 'lib'];
const EXT = /\.(tsx|ts|jsx|js|css)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'tokens']);

// Mask comment CONTENT with spaces, preserving offsets and newlines, so
// banned patterns inside comments are ignored but code on the same line
// is still scanned (review finding: line-skip allowed same-line bypass).
function maskComments(src, isCss) {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '*') { mode = 'block'; out += '  '; i += 2; continue; }
      if (!isCss && c === '/' && d === '/') { mode = 'line'; out += '  '; i += 2; continue; }
      if (!isCss && c === "'") { mode = 'sq'; out += c; i++; continue; }
      if (!isCss && c === '"') { mode = 'dq'; out += c; i++; continue; }
      if (!isCss && c === '`') { mode = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'block') {
      if (c === '*' && d === '/') { mode = 'code'; out += '  '; i += 2; continue; }
      out += c === '\n' ? '\n' : ' '; i++; continue;
    }
    if (mode === 'line') {
      if (c === '\n') { mode = 'code'; out += '\n'; i++; continue; }
      out += ' '; i++; continue;
    }
    // strings: keep content (class names live in strings and MUST be scanned)
    if (mode === 'sq' && c === "'" && src[i - 1] !== '\\') mode = 'code';
    if (mode === 'dq' && c === '"' && src[i - 1] !== '\\') mode = 'code';
    if (mode === 'tpl' && c === '`' && src[i - 1] !== '\\') mode = 'code';
    out += c; i++;
  }
  return out;
}

const TW_PALETTE =
  '(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';

const RULES = [
  {
    id: 'N1', desc: 'uppercase is banned',
    test: (src) => [...src.matchAll(/\buppercase\b|text-transform\s*:\s*uppercase|textTransform\s*:\s*['"]uppercase['"]/gi)],
  },
  {
    id: 'N2', desc: 'font sizes below 14px are banned',
    test: (src) => {
      const hits = [...src.matchAll(/\btext-xs\b/gi)];
      // arbitrary Tailwind sizes: text-[Npx] / text-[N.Nrem] etc
      for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)(px|rem|em)\]/gi)) {
        const v = parseFloat(m[1]);
        const px = m[2].toLowerCase() === 'px' ? v : v * 16;
        if (px < 14) hits.push(m);
      }
      // CSS/inline font-size declarations
      for (const m of src.matchAll(/font-?[sS]ize\s*:\s*['"]?(\d+(?:\.\d+)?)(px|rem|em)/g)) {
        const v = parseFloat(m[1]);
        const px = m[2].toLowerCase() === 'px' ? v : v * 16;
        if (px < 14) hits.push(m);
      }
      // numeric JSX style: fontSize: 12
      for (const m of src.matchAll(/fontSize\s*:\s*(\d+(?:\.\d+)?)\s*[,}]/g)) {
        if (parseFloat(m[1]) < 14) hits.push(m);
      }
      return hits;
    },
  },
  {
    id: 'N3', desc: 'em/en-dashes are banned in copy',
    test: (src) => [...src.matchAll(/[\u2013\u2014]/g)],
  },
  {
    id: 'N4', desc: 'raw or palette color values banned (use --color-* tokens)',
    test: (src) => [
      ...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
      ...src.matchAll(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\s*\(/gi),
      ...src.matchAll(new RegExp(`(?:^|[\\s'"\`])(?:hover:|focus:|active:|dark:|data-\\[[^\\]]*\\]:)*(?:text|bg|border|ring|fill|stroke|outline|decoration|divide|from|via|to|accent|caret|shadow)-${TW_PALETTE}(?:-\\d{2,3})?(?:\\/\\d{1,3})?\\b`, 'g')),
    ],
    filter: (line) => !line.includes('currentColor') && !line.includes('design-check-ignore'),
  },
  {
    id: 'N6', desc: 'positive letter-spacing / wide tracking banned',
    test: (src) => [...src.matchAll(/tracking-(wide|wider|widest)|letter-?[sS]pacing\s*:\s*['"]?0*\.?0*[1-9]/gi)],
  },
  {
    id: 'N7', desc: 'outline-none without focus-visible replacement',
    test: (src) => {
      const hits = [...src.matchAll(/outline-none|outline\s*:\s*none/gi)];
      return src.includes('focus-visible') ? [] : hits;
    },
  },
  {
    id: 'N13', desc: 'only @carbon/icons-react is allowed for icons',
    test: (src) => [...src.matchAll(/from\s+['"](lucide-react|react-icons|@heroicons|@tabler\/icons|@radix-ui\/react-icons|@fortawesome)['"]/gi)],
  },
  {
    id: 'N14', desc: 'z-index outside the --z-* scale',
    test: (src) => [...src.matchAll(/z-\[(?!var\(--z-)|z-index\s*:\s*(?!var\(--z-)\d|zIndex\s*:\s*\d/g)],
  },
];

const violations = [];

function scan(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) scan(full);
      continue;
    }
    if (!EXT.test(entry)) continue;
    const raw = readFileSync(full, 'utf8');
    const src = maskComments(raw, entry.endsWith('.css'));
    const lines = raw.split('\n');
    for (const rule of RULES) {
      for (const m of rule.test(src)) {
        const lineNo = src.slice(0, m.index).split('\n').length;
        const line = lines[lineNo - 1] ?? '';
        if (rule.filter && !rule.filter(line)) continue;
        violations.push({ file: relative(process.cwd(), full), line: lineNo, rule: rule.id, desc: rule.desc, snippet: line.trim().slice(0, 80) });
      }
    }
  }
}

for (const root of ROOTS) scan(join(process.cwd(), root));

if (violations.length === 0) {
  console.log('design-check: all [lint] rules pass.');
  process.exit(0);
}

console.error(`design-check: ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`  ${v.rule}  ${v.file}:${v.line}  ${v.desc}`);
  console.error(`      ${v.snippet}`);
}
console.error('\nSee design-rules/RULES.md for the full rule text.');
process.exit(1);
