// Runs every prebuild test from package.json independently and reports each result.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const cmds = pkg.scripts.prebuild.split('&&').map((s) => s.trim()).filter(Boolean);
let fail = 0;
for (const c of cmds) {
  const name = c.split(' ').find((x) => x.startsWith('scripts/'));
  try {
    execSync(`npx ${c}`, { stdio: 'pipe', timeout: 600000, shell: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    fail++;
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').filter((l) => /FAIL|fail|Error|✗|- /.test(l)).slice(0, 8).join('\n    ');
    console.log(`FAIL ${name}\n    ${out}`);
  }
}
console.log(`\n${cmds.length - fail}/${cmds.length} passed`);
process.exit(fail ? 1 : 0);
