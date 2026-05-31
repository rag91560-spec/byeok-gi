// Patches rules-gate.js to replace base64 game-sharing rule with safe rules.
const { requireExecute } = require('./safety');
requireExecute('discord-patch-rules-gate');
// Usage: node patch-rules-gate.js [path-to-rules-gate.js]

const fs = require('fs');
const filePath = process.argv[2] || '/home/ubuntu/openclaw-system/src/bot/rules-gate.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the .setDescription( ... ) block of the rules embed and replace it.
const oldDescStart = "    .setDescription(\n      '\\uC774 \\uC11C\\uBC84\\uB294";
const startIdx = content.indexOf(oldDescStart);
if (startIdx === -1) {
  console.error('FAIL: setDescription block not found');
  process.exit(1);
}

// Find closing of setDescription ??first ");\n" at top level after start
const closeMarker = "\n    )\n";
const endIdx = content.indexOf(closeMarker, startIdx);
if (endIdx === -1) {
  console.error('FAIL: setDescription closing not found');
  process.exit(1);
}

const newDescBlock = `    .setDescription(
      '\u0069 \u0073\u0065\u0072\u0076\u0065\u0072'.replace('i server', '???œë²„??**Varo (ê²Œì„ë²ˆì—­ê¸?** ?¬ìš© ì§€??ì»¤ë??ˆí‹°?…ë‹ˆ??\\n?„ë˜ ê·œì¹™???½ê³  ?™ì˜?´ì£¼?¸ìš”.\\n\\n') +

      '**1ï¸âƒ£ ê²Œì„ ?Œì¼ ê³µìœ  ê¸ˆì?**\\n' +
      '> ë³??œë²„??ê²Œì„ ?Œì¼ ?ëŠ” ?¤ìš´ë¡œë“œ ë§í¬ë¥?ì§ì ‘ ?…ë¡œ?œí•˜ì§€ ë§ˆì„¸??\\n' +
      '> ?”ë²„ê¹…ì— ê²Œì„ ?Œì¼???„ìš”??ê²½ìš°, ?„ì¹´?¼ì´ë¸ŒÂ·ì½”?????¸ë””ê²Œì„\\n' +
      '> ì»¤ë??ˆí‹°??\`[Varo ?„ê¸°]\` ?•ì‹?¼ë¡œ ê²Œì‹œë¬¼ì„ ?‘ì„±?˜ì‹  ??\n' +
      '> **ê²Œì‹œë¬?ë§í¬ë§?* ë¬¸ì˜ ì±„ë„??ì²¨ë??´ì£¼?¸ìš”.\\n' +
      '> ?‘ì‹?€ #?“‹ë²„ê·¸ë¦¬í¬?¸ê??´ë“œ ì°¸ê³ .\\n\\n' +

      '**2ï¸âƒ£ R18 ì½˜í…ì¸?*\\n' +
      '> ?±ì¸ ì½˜í…ì¸ ëŠ” ë°˜ë“œ???´ë‹¹ R18 ì±„ë„?ì„œë§?ê³µìœ ?´ì£¼?¸ìš”.\\n' +
      '> ?·ï¸ì—­? ì„ ??ì±„ë„?ì„œ ì·¨í–¥ë³???• ??ë°›ì? ???´ìš© ê°€?¥í•©?ˆë‹¤.\\n\\n' +

      '**3ï¸âƒ£ ?¬ë°°??ê¸ˆì?**\\n' +
      '> Varo (ê²Œì„ë²ˆì—­ê¸? ?„ë¡œê·¸ë¨ ?ì²´???¬ë°°??ê³µìœ ??ê¸ˆì??…ë‹ˆ??\\n' +
      '> ë°œê²¬ ???¼ì´? ìŠ¤ê°€ ?êµ¬ ?•ì??©ë‹ˆ??\\n\\n' +

      '**4ï¸âƒ£ ê¸°ë³¸ ?ˆì ˆ**\\n' +
      '> ?œë¡œ ì¡´ì¤‘, ë¶„ìŸ ê¸ˆì?, ?¤íŒ¸ ê¸ˆì?.\\n\\n' +

      '?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€\\n' +
      '?„ë˜ **?™ì˜?©ë‹ˆ??* ë²„íŠ¼???„ë¥´ë©?ì±„ë„???´ë¦½?ˆë‹¤.'`;

const before = content.slice(0, startIdx);
const after = content.slice(endIdx);
const newContent = before + newDescBlock + after;

// Sanity check - new content must still contain rest of file
if (!newContent.includes('handleRulesAccept') || !newContent.includes('module.exports')) {
  console.error('FAIL: corrupt result');
  process.exit(1);
}

if (newContent.includes('Base64')) {
  console.error('FAIL: Base64 still present');
  process.exit(1);
}

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('OK: rules-gate.js patched');
console.log('  - Removed base64 game-sharing rule');
console.log('  - Added safe rules (no game file uploads, akalive/kone redirect)');
console.log('  - File size:', newContent.length, 'bytes');
