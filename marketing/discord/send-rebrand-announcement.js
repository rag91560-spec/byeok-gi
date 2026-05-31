// Send rebrand + policy change announcement to ?“¢ê³µì??¬í•­ channel.
const { requireExecute } = require('./safety');
requireExecute('discord-send-rebrand-announcement');
if (process.env.DISCORD_ENV_PATH) require('dotenv').config({ path: process.env.DISCORD_ENV_PATH });
const { REST, Routes } = require('discord.js');
const CHANNEL_ID = '1475914697122517022'; // ?“¢ê³µì??¬í•­

const embed = {
  color: 0x2ECC71,
  title: '?Ž‰ ê²Œìž„ë²ˆì—­ê¸???Varo ë¦¬ë¸Œ?œë”©!',
  description:
    '**?´ë¦„**: ê²Œìž„ë²ˆì—­ê¸???**Varo (ë°”ë¡œ)**\n' +
    '**?´ìœ **: ?´ì™¸ ì§„ì¶œ / ?¥ê¸° ?•ìž¥\n' +
    '**ë³€ê²??†ìŒ**: ê¸°ëŠ¥, ?¼ì´? ìŠ¤(MIT), ?¬ìš© ë°©ë²•\n\n' +

    '?â”?â”?â”?â”?â”?â”?â”?â”?â”??n\n' +

    '?“Œ **?¨ê»˜ ë³€ê²½ë˜???•ì±…**\n\n' +
    '??ê²Œìž„ ?Œì¼ ?”ìŠ¤ì½”ë“œ ì§ì ‘ ?…ë¡œ??????n' +
    '???¸ë? ì»¤ë??ˆí‹° `[Varo ?„ê¸°]` ê²Œì‹œë¬?ë§í¬ë§???n' +
    '???ì„¸???‘ì‹?€ #?“‹ë²„ê·¸ë¦¬í¬?¸ê??´ë“œ ì°¸ê³ \n\n' +

    '?â”?â”?â”?â”?â”?â”?â”?â”?â”??n\n' +

    '?ï¸ **?´ë¦„???˜ë?**\n' +
    '?œêµ­??"**ë°”ë¡œ** ë²ˆì—­" ??ì§ê???n' +
    '??????ëª¨ë‘ ë°œìŒ ê°€??n' +
    '?¼í‹´??"varÅ" ??"?¤ì–‘??\n\n' +

    'ê·¸ë™?ˆì˜ ?±ì› ê°ì‚¬?œë¦½?ˆë‹¤ ?’š',
  footer: { text: 'GitHub ?ë™ ë¦¬ë‹¤?´ë ‰???ìš© / ?œêµ­?ì„œ??"ê²Œìž„ë²ˆì—­ê¸? ?œê¸° ë³‘ê¸°' },
  timestamp: new Date().toISOString()
};

(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    const result = await rest.post(
      Routes.channelMessages(CHANNEL_ID),
      { body: { embeds: [embed] } }
    );
    console.log('OK: announcement sent');
    console.log('  Message ID:', result.id);
    console.log('  Channel:', result.channel_id);
  } catch (err) {
    console.error('FAIL:', err.message);
    if (err.rawError) console.error('  Raw:', JSON.stringify(err.rawError));
    process.exit(1);
  }
})();
