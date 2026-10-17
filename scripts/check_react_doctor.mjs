import { execSync } from 'node:child_process';

console.log('Running React Doctor score verification (minimum: 68)...');

let output = '';
try {
  output = execSync('npx react-doctor --json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  });
} catch (err) {
  if (err.stdout) {
    output = typeof err.stdout === 'string' ? err.stdout : err.stdout.toString('utf8');
  } else {
    console.error('Error running React Doctor score check:', err.message);
    process.exit(1);
  }
}

try {

  const jsonStart = output.indexOf('{');
  const jsonEnd = output.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON found in react-doctor output');
  }

  const report = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
  const score = report.summary?.score;

  if (typeof score !== 'number' || Number.isNaN(score)) {
    console.error('Failed to parse summary.score from react-doctor JSON report:', report);
    process.exit(1);
  }

  console.log(`React Doctor score: ${score} / 100 (${report.summary?.scoreLabel ?? 'Audited'})`);
  console.log(
    `Diagnostics: ${report.summary?.errorCount ?? 0} errors, ${report.summary?.warningCount ?? 0} warnings across ${report.summary?.affectedFileCount ?? 0} files.`,
  );

  if (score < 68) {
    console.error(`ERROR: React Doctor score ${score} is below required threshold of 68.`);
    process.exit(1);
  }

  console.log('✅ React Doctor score threshold passed (>= 68).');
} catch (err) {
  console.error('Error running React Doctor score check:', err.message);
  process.exit(1);
}
