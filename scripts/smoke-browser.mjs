import { spawn } from 'node:child_process';
import process from 'node:process';

import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4173;
const ORIGIN = `http://${HOST}:${PORT}`;

/**
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve(null);
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

/**
 * @param {string} url
 * @param {{timeoutMs?: number, intervalMs?: number}=} options
 */
async function waitForHttpOk(url, options = {}) {
  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 30_000;
  const intervalMs = typeof options.intervalMs === 'number' ? options.intervalMs : 250;
  const deadline = Date.now() + timeoutMs;

  // Node 20+ has global fetch.
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // keep retrying
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function npmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function main() {
  await run(npmCmd(), ['run', 'build']);

  const previewProc = spawn(npmCmd(), ['run', 'preview', '--', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    stdio: 'inherit',
  });

  let browser = null;
  try {
    await waitForHttpOk(`${ORIGIN}/`);

    browser = await chromium.launch();
    const page = await browser.newPage();

    /** @type {string[]} */
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#editor');
    await page.waitForSelector('#preview');

    await page.fill('#editor', 'flowchart TD\n  a([A]) --> b([B])\n');
    await page.click('#render-now');
    {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const status = await page.textContent('#render-status');
        if (typeof status === 'string' && status.includes('Rendered')) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const status = await page.textContent('#render-status');
      if (typeof status !== 'string' || !status.includes('Rendered')) {
        throw new Error(`Expected render status to include "Rendered", got: ${String(status)}`);
      }
    }

    await page.click('#simulate');
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const value = await page.inputValue('#proposal');
        if (typeof value === 'string' && value.trim().length > 0) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const value = await page.inputValue('#proposal');
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('Expected patch proposal textarea to be non-empty after Simulate patch.');
      }
    }

    await page.click('#apply-patch');
    await page.waitForSelector('#patch-undo:not([hidden])');

    await page.click('#undo-patch');
    await page.waitForSelector('#patch-undo[hidden]');

    await page.click('#add-tab');
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const count = await page.locator('#tab-list button.tab').count();
        if (count >= 2) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const count = await page.locator('#tab-list button.tab').count();
      if (count < 2) {
        throw new Error(`Expected at least 2 tabs after clicking New tab, got ${count}.`);
      }
    }

    if (pageErrors.length) {
      throw new Error(`Page errors:\n${pageErrors.join('\n')}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    previewProc.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
