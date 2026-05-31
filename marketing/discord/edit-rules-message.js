// Edit existing rules embed message via REST API (no gateway connection).
const { requireExecute } = require('./safety');
requireExecute('discord-edit-rules-message');
// Safe to run while main bot is online.
if (process.env.DISCORD_ENV_PATH) require('dotenv').config({ path: process.env.DISCORD_ENV_PATH });
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const CFG_PATH = '/home/ubuntu/openclaw-system/data/rules-gate.json';
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const GUILD_ID = '1475903955761631234';
const guildCfg = cfg[GUILD_ID];

if (!guildCfg) {
  console.error('FAIL: guild config not found');
  process.exit(1);
}

const { messageId, channelId } = guildCfg;
console.log('Target:', { messageId, channelId });

const newEmbed = {
  color: 0x5865F2,
  title: '?“œ ?œë²„ ê·œì¹™',
  description:
    '???œë²„??**Varo (ê²Œìž„ë²ˆì—­ê¸?** ?¬ìš© ì§€??ì»¤ë??ˆí‹°?…ë‹ˆ??\n' +
    '?„ëž˜ ê·œì¹™???½ê³  ?™ì˜?´ì£¼?¸ìš”.\n\n' +

    '**1ï¸âƒ£ ê²Œìž„ ?Œì¼ ê³µìœ  ê¸ˆì?**\n' +
    '> ë³??œë²„??ê²Œìž„ ?Œì¼?´ë‚˜ ?¤ìš´ë¡œë“œ ë§í¬ë¥?ì§ì ‘ ?…ë¡œ?œí•˜ì§€ ë§ˆì„¸??\n' +
    '> ?”ë²„ê¹…ì— ê²Œìž„ ?Œì¼???„ìš”??ê²½ìš°, ?„ì¹´?¼ì´ë¸ŒÂ·ì½”?????¸ë””ê²Œìž„\n' +
    '> ì»¤ë??ˆí‹°??`[Varo ?„ê¸°]` ?•ì‹?¼ë¡œ ê²Œì‹œë¬¼ì„ ?‘ì„±?˜ì‹  ??n' +
    '> **ê²Œì‹œë¬?ë§í¬ë§?* ë¬¸ì˜ ì±„ë„??ì²¨ë??´ì£¼?¸ìš”.\n' +
    '> ?‘ì‹?€ #?“‹ë²„ê·¸ë¦¬í¬?¸ê??´ë“œ ì±„ë„ ì°¸ê³ .\n\n' +

    '**2ï¸âƒ£ R18 ì½˜í…ì¸?*\n' +
    '> ?±ì¸ ì½˜í…ì¸ ëŠ” ë°˜ë“œ???´ë‹¹ R18 ì±„ë„?ì„œë§?ê³µìœ ?´ì£¼?¸ìš”.\n' +
    '> ?·ï¸ì—­? ì„ ??ì±„ë„?ì„œ ì·¨í–¥ë³???• ??ë°›ì? ???´ìš© ê°€?¥í•©?ˆë‹¤.\n\n' +

    '**3ï¸âƒ£ ?¬ë°°??ê¸ˆì?**\n' +
    '> Varo (ê²Œìž„ë²ˆì—­ê¸? ?„ë¡œê·¸ëž¨ ?ì²´???¬ë°°??ê³µìœ ??ê¸ˆì??…ë‹ˆ??\n' +
    '> ë°œê²¬ ???¼ì´? ìŠ¤ê°€ ?êµ¬ ?•ì??©ë‹ˆ??\n\n' +

    '**4ï¸âƒ£ ê¸°ë³¸ ?ˆì ˆ**\n' +
    '> ?œë¡œ ì¡´ì¤‘, ë¶„ìŸ ê¸ˆì?, ?¤íŒ¸ ê¸ˆì?.\n\n' +

    '?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€\n' +
    '?„ëž˜ **?™ì˜?©ë‹ˆ??* ë²„íŠ¼???„ë¥´ë©?ì±„ë„???´ë¦½?ˆë‹¤.',
  footer: { text: 'ê·œì¹™ ?„ë°˜ ??ê²½ê³  ?†ì´ ë°?ì²˜ë¦¬?????ˆìŠµ?ˆë‹¤' }
};

const components = [{
  type: 1, // ActionRow
  components: [{
    type: 2, // Button
    custom_id: 'rules_accept_' + GUILD_ID,
    label: '???™ì˜?©ë‹ˆ??,
    style: 3 // Success/Green
  }]
}];

(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    const result = await rest.patch(
      Routes.channelMessage(channelId, messageId),
      { body: { embeds: [newEmbed], components } }
    );
    console.log('OK: rules embed updated');
    console.log('  Message ID:', result.id);
    console.log('  Edited at:', result.edited_timestamp);
  } catch (err) {
    console.error('FAIL:', err.message);
    if (err.rawError) console.error('  Raw:', JSON.stringify(err.rawError));
    process.exit(1);
  }
})();
