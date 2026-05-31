// Patch rules-gate.js: replace base64 game-sharing rule with safe rules
const { requireExecute } = require('./safety');
requireExecute('discord-patch-rules');
const fs = require('fs');
const FILE = '/home/ubuntu/openclaw-system/src/bot/rules-gate.js';
const original = fs.readFileSync(FILE, 'utf8');

// Detect line ending
const NL = original.includes('\r\n') ? '\r\n' : '\n';

// Find old description block
const startMarker = "    .setDescription(" + NL + "      '\\uC774 \\uC11C\\uBC84\\uB294";
const start = original.indexOf(startMarker);
if (start === -1) {
  console.error('FAIL: could not find setDescription block');
  process.exit(1);
}

// Find end of description block ??closing parenthesis before .setFooter
const endMarker = NL + "    )" + NL + "    .setFooter";
const end = original.indexOf(endMarker, start);
if (end === -1) {
  console.error('FAIL: could not find end of setDescription');
  process.exit(1);
}

// Build new description block (lines joined with detected NL)
const newDescriptionLines = [
  `    .setDescription(`,
  `      '???úÎ≤Ñ??**Varo (Í≤åÏûÑÎ≤àÏó≠Í∏?** ?¨Ïö© ÏßÄ??Ïª§Î??àÌã∞?ÖÎãà??\\n' +`,
  `      '?ÑÎûò Í∑úÏπô???ΩÍ≥† ?ôÏùò?¥Ï£º?∏Ïöî.\\n\\n' +`,
  ``,
  `      '**1Ô∏è‚É£ Í≤åÏûÑ ?åÏùº Í≥µÏú† Í∏àÏ?**\\n' +`,
  `      '> Î≥??úÎ≤Ñ??Í≤åÏûÑ ?åÏùº?¥ÎÇò ?§Ïö¥Î°úÎìú ÎßÅÌÅ¨Î•?ÏßÅÏ†ë ?ÖÎ°ú?úÌïòÏßÄ ÎßàÏÑ∏??\\n' +`,
  `      '> ?îÎ≤ÑÍπÖÏóê Í≤åÏûÑ ?åÏùº???ÑÏöî??Í≤ΩÏö∞, ?ÑÏπ¥?ºÏù¥Î∏å¬∑ÏΩî?????∏ÎîîÍ≤åÏûÑ\\n' +`,
  `      '> Ïª§Î??àÌã∞??\\\`[Varo ?ÑÍ∏∞]\\\` ?ïÏãù?ºÎ°ú Í≤åÏãúÎ¨ºÏùÑ ?ëÏÑ±?òÏã† ??\n' +`,
  `      '> **Í≤åÏãúÎ¨?ÎßÅÌÅ¨Îß?* Î¨∏Ïùò Ï±ÑÎÑê??Ï≤®Î??¥Ï£º?∏Ïöî.\\n' +`,
  `      '> ?ëÏãù?Ä #?ìãÎ≤ÑÍ∑∏Î¶¨Ìè¨?∏Í??¥Îìú Ï±ÑÎÑê Ï∞∏Í≥†.\\n\\n' +`,
  ``,
  `      '**2Ô∏è‚É£ R18 ÏΩòÌÖêÏ∏?*\\n' +`,
  `      '> ?±Ïù∏ ÏΩòÌÖêÏ∏†Îäî Î∞òÎìú???¥Îãπ R18 Ï±ÑÎÑê?êÏÑúÎß?Í≥µÏú†?¥Ï£º?∏Ïöî.\\n' +`,
  `      '> ?è∑Ô∏èÏó≠?†ÏÑ†??Ï±ÑÎÑê?êÏÑú Ï∑®Ìñ•Î≥???ï†??Î∞õÏ? ???¥Ïö© Í∞Ä?•Ìï©?àÎã§.\\n\\n' +`,
  ``,
  `      '**3Ô∏è‚É£ ?¨Î∞∞??Í∏àÏ?**\\n' +`,
  `      '> Varo (Í≤åÏûÑÎ≤àÏó≠Í∏? ?ÑÎ°úÍ∑∏Îû® ?êÏ≤¥???¨Î∞∞??Í≥µÏú†??Í∏àÏ??ÖÎãà??\\n' +`,
  `      '> Î∞úÍ≤¨ ???ºÏù¥?†Ïä§Í∞Ä ?ÅÍµ¨ ?ïÏ??©Îãà??\\n\\n' +`,
  ``,
  `      '**4Ô∏è‚É£ Í∏∞Î≥∏ ?àÏ†à**\\n' +`,
  `      '> ?úÎ°ú Ï°¥Ï§ë, Î∂ÑÏüÅ Í∏àÏ?, ?§Ìå∏ Í∏àÏ?.\\n\\n' +`,
  ``,
  `      '?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä\\n' +`,
  `      '?ÑÎûò **?ôÏùò?©Îãà??* Î≤ÑÌäº???ÑÎ•¥Î©?Ï±ÑÎÑê???¥Î¶Ω?àÎã§.'`,
];
const newDescription = newDescriptionLines.join(NL);

const before = original.slice(0, start);
const after = original.slice(end);
const result = before + newDescription + after;

// Sanity checks
if (result.includes('Base64')) {
  console.error('FAIL: Base64 still present in result');
  process.exit(1);
}
if (!result.includes('handleRulesAccept')) {
  console.error('FAIL: rest of file truncated');
  process.exit(1);
}
if (!result.includes('module.exports')) {
  console.error('FAIL: exports missing');
  process.exit(1);
}
if (!result.includes('Varo (Í≤åÏûÑÎ≤àÏó≠Í∏?')) {
  console.error('FAIL: new content missing');
  process.exit(1);
}

// Try parsing the result as JS to check syntax
try {
  new Function(result);
} catch (e) {
  console.error('FAIL: syntax error in result:', e.message);
  process.exit(1);
}

fs.writeFileSync(FILE, result, 'utf8');
console.log('OK');
console.log('  Original:', original.length, 'bytes');
console.log('  New:    ', result.length, 'bytes');
console.log('  Removed: Base64 game-sharing rule');
console.log('  Added:   Safe rules (no game uploads, akalive/kone redirect)');
