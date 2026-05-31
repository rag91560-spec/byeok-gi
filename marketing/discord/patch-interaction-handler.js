// Add R18 consent handler call after rules accept handler
const { requireExecute } = require('./safety');
requireExecute('discord-patch-interaction-handler');
const fs = require('fs');
const FILE = '/home/ubuntu/openclaw-system/src/bot/interaction-handler.js';
let content = fs.readFileSync(FILE, 'utf8');

const NL = content.includes('\r\n') ? '\r\n' : '\n';

// Find rules accept handler invocation
const oldBlock = [
  '    // Rules gate accept button',
  '    const rulesHandled = await handleRulesAccept(interaction);',
  '    if (rulesHandled) return;'
].join(NL);

if (!content.includes(oldBlock)) {
  console.error('FAIL: cannot find rules handler block');
  process.exit(1);
}

// Already patched?
if (content.includes('handleR18Consent(interaction)')) {
  console.log('SKIP: already patched');
  process.exit(0);
}

const newBlock = [
  '    // Rules gate accept button',
  '    const rulesHandled = await handleRulesAccept(interaction);',
  '    if (rulesHandled) return;',
  '',
  '    // R18 consent button',
  '    const r18Handled = await handleR18Consent(interaction);',
  '    if (r18Handled) return;'
].join(NL);

const result = content.replace(oldBlock, newBlock);

if (result === content) {
  console.error('FAIL: replace did not change content');
  process.exit(1);
}

// Syntax check
try {
  new Function(result);
} catch (e) {
  console.error('FAIL: syntax error after patch:', e.message);
  process.exit(1);
}

fs.writeFileSync(FILE, result, 'utf8');
console.log('OK: patched');
console.log('  Original:', content.length, 'bytes');
console.log('  New:    ', result.length, 'bytes');
