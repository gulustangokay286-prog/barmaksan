import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'barmaksan-csp-test-'));
process.env.WEB_DIST = temp;

const theme = '\n  document.documentElement.dataset.theme = "koyu";\n';
const splash = '\n  window.__splash = { opened: false }; // Açılış\n';
fs.writeFileSync(path.join(temp, 'index.html'), [
  `<script>${theme.replace(/\n/g, '\r\n')}</script>`,
  '<script type="module" src="/assets/index.js"></script>',
  `<script>${splash.replace(/\n/g, '\r')}</script>`,
].join('\r\n'));

const { contentSecurityPolicy } = await import('../src/security.js');
after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('CSP accepts browser-normalized inline scripts from Windows HTML', () => {
  const policy = contentSecurityPolicy();
  const hash = (script) => `'sha256-${crypto.createHash('sha256').update(script).digest('base64')}'`;
  const scriptSrc = policy.split('; ').find((directive) => directive.startsWith('script-src '));

  assert.equal(scriptSrc, `script-src 'self' ${hash(theme)} ${hash(splash)}`);
  assert.ok(!scriptSrc.includes("'unsafe-inline'"));
  assert.ok(!scriptSrc.includes(hash(theme.replace(/\n/g, '\r\n'))));
  assert.equal(contentSecurityPolicy(), policy);
});
