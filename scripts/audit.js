import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf-8' });
const output = result.stdout || '';

let data;
try {
  data = JSON.parse(output);
} catch {
  console.error('Failed to parse npm audit output');
  process.exit(1);
}

const metadata = data.metadata || {};
const vulnerabilities = metadata.vulnerabilities || {};
const high = vulnerabilities.high || 0;
const critical = vulnerabilities.critical || 0;

if (high > 0 || critical > 0) {
  console.error(`High/critical vulnerabilities detected (high=${high}, critical=${critical}).`);
  process.exit(1);
}

console.log(`npm audit OK (high=${high}, critical=${critical}).`);
