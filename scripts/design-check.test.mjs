import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const checker = fileURLToPath(new URL('./design-check.mjs', import.meta.url));

function runFixture(source) {
  const root = mkdtempSync(join(tmpdir(), 'sortie-design-check-'));
  mkdirSync(join(root, 'app'));
  writeFileSync(join(root, 'app', 'fixture.tsx'), source);
  const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  rmSync(root, { recursive: true, force: true });
  return result;
}

const violations = runFixture(`
const tooSmall = 13;
export function Fixture({ active }) {
  return <>
    {/* comment */} <div className="uppercase" />
    <div style={{ textTransform: 'Uppercase' }} />
    <div className="text-[13.5px]" />
    <div style={{ color: 'oklab(50% 0 0)' }} />
    <div style={{ color: 'color(display-p3 1 0 0)' }} />
    <div className={\`text-[\${tooSmall}px]\`} />
    <div className={active && ['upper', 'case'].join('')} />
    <div style={{ '--local-color': '#' + 'abc' }} />
    <div className={{ ['bg-' + 'red-500']: active }} />
    <div className="sm:bg-red-500" />
    <div style={{ color: 'var(--gray-500)' }} />
    <div style={{ color: '#abc' }} data-note="design-check-ignore" />
  </>;
}
`);

if (violations.status !== 1 || !violations.stderr.includes('N1') || !violations.stderr.includes('N2') || !violations.stderr.includes('N4')) {
  console.error(violations.stderr || violations.stdout);
  throw new Error('Expected N1, N2, and N4 violations were not all reported.');
}

const clean = runFixture(`export function Clean() { return <div className="text-[var(--color-text-primary)]" />; }`);
if (clean.status !== 0) {
  console.error(clean.stderr || clean.stdout);
  throw new Error('A valid semantic-token fixture failed design-check.');
}

console.log('design-check regression fixtures pass.');
