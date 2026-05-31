// Create #?ìãÎ≤ÑÍ∑∏Î¶¨Ìè¨?∏Í??¥Îìú channel + send pinned guide messages.
const { requireExecute } = require('./safety');
requireExecute('discord-create-bug-guide-channel');
// Channel goes under "?ìã ?Ä ?àÎÇ¥ | Info" category.

if (process.env.DISCORD_ENV_PATH) require('dotenv').config({ path: process.env.DISCORD_ENV_PATH });
const { REST, Routes, ChannelType, PermissionFlagsBits } = require('discord.js');

const DRY_RUN = !process.argv.includes('--execute');

const GUILD_ID = '1475903955761631234';
const INFO_CATEGORY_ID = '1475914695360905388'; // ?ìã ?Ä ?àÎÇ¥ | Info
const RULES_CHANNEL_ID = '1477224180402356274'; // for position reference

const CHANNEL_NAME = '?ìãÎ≤ÑÍ∑∏Î¶¨Ìè¨?∏Í??¥Îìú';

// Section 1: Discord inquiry template
const MSG_DISCORD_TEMPLATE =
`# ?êõ Î≤ÑÍ∑∏ Î¶¨Ìè¨??Í∞Ä?¥Îìú

> ?îÏä§ÏΩîÎìú #?ì©Î¨∏Ïùò?òÍ∏∞ Ï±ÑÎÑê?????¨Ïä§???ëÏÑ± ???ÑÎûò ?ëÏãù??Ï∞∏Í≥†?¥Ï£º?∏Ïöî.

## ?ìù ?îÏä§ÏΩîÎìú Î¨∏Ïùò ?ëÏãù

\`\`\`
[?úÎ™©] Í≤åÏûÑÎ™?- ?¥Îñ§ Î¨∏Ï†ú

## 1. Í≤åÏûÑ ?ïÎ≥¥
- Í≤åÏûÑÎ™?
- ?îÏßÑ: (UE4 / UE5 / Unity / RPG Maker MV / MZ / WolfRPG / Í∏∞Ì?)
- Í≤åÏûÑ Î≤ÑÏ†Ñ:

## 2. Î≤ÑÍ∑∏ Ï¶ùÏÉÅ
- Î¨¥Ïä® ?ºÏù¥ ?ºÏñ¥?¨ÎÇò??:
- ?∏Ï†ú Î∞úÏÉù?àÎÇò??:
- ?¨ÌòÑ Î∞©Î≤ï:
  1.
  2.

## 3. ?§ÌÅ¨Î¶∞ÏÉ∑
(?¥Î?ÏßÄ ÏßÅÏ†ë Ï≤®Î?)

## 4. Î°úÍ∑∏ ?åÏùº
Varo ?§Ïπò ?¥Îçî ??logs/ ?¥Îçî ?àÏùò ?åÏùº Ï≤®Î?

## 5. Í≤åÏûÑ ?åÏùº Í≥µÏú† (?†ÌÉù)
?†Ô∏è ?îÏä§ÏΩîÎìú ?úÎ≤Ñ??Í≤åÏûÑ ?åÏùº??ÏßÅÏ†ë ?ÖÎ°ú?úÌïòÏßÄ ÎßàÏÑ∏??

?îÎ≤ÑÍπÖÏóê Í≤åÏûÑ ?åÏùº???ÑÏöî??Í≤ΩÏö∞:
1. ?ÑÏπ¥?ºÏù¥Î∏? ÏΩîÎÑ§ ???∏ÎîîÍ≤åÏûÑ Ïª§Î??àÌã∞??[Varo ?ÑÍ∏∞] ?ïÏãù?ºÎ°ú ?ëÏÑ±
2. Í≤åÏãúÎ¨?ÎßÅÌÅ¨Îß?Ï≤®Î?

- Í≤åÏãúÎ¨?ÎßÅÌÅ¨:
- ?ëÍ∑º Î∞©Î≤ï: (Ïª§Î??àÌã∞ Íµ?£∞ / ÎπÑÎ≤à ??
\`\`\`

> ?í° 80% ?¥ÏÉÅ??Î≤ÑÍ∑∏??**Î°úÍ∑∏ + ?§ÌÅ¨Î¶∞ÏÉ∑**ÎßåÏúºÎ°??¥Í≤∞ Í∞Ä?•Ìï©?àÎã§.`;

// Section 2: Akalive/Kone post template
const MSG_AKALIVE_TEMPLATE =
`# ?ìù ?∏Î? Ïª§Î??àÌã∞ [Varo ?ÑÍ∏∞] ?ëÏãù

> ?îÎ≤ÑÍπÖÏö© Í≤åÏûÑ Í≥µÏú† ???ÑÏπ¥?ºÏù¥Î∏? ÏΩîÎÑ§ ?±Ïóê ?ëÏÑ±?òÎäî Í≤åÏãúÎ¨??ëÏãù?ÖÎãà??
> **Í≤åÏûÑ ?¥Î¶Ñ + ?úÎëê Ï§?*Îß??ÅÏúºÎ©??©Îãà??

## ?éØ ÎØ∏ÎãàÎ©Ä ?ëÏãù (Í∞Ä??Í∞ÑÎã®)

\`\`\`
[?úÎ™©] [Varo ?ÑÍ∏∞] ?ã‚óã - Î≤àÏó≠ ÎßâÌûò

VaroÎ°??ã‚óã Î≤àÏó≠?¥Î¥§?îÎç∞ ??Î∂ÄÎ∂ÑÏóê??ÎßâÌòî?µÎãà??

(?¨Í∏∞???¥Îñ§ Î≤ÑÍ∑∏/Î¨∏Ï†úÍ∞Ä ?àÎäîÏßÄ ?úÎëê Ï§?

Í∞ôÏ? Í≤åÏûÑ Î≤àÏó≠?¥Î≥¥??Î∂??àÎÇò??
?îÎ≤ÑÍπÖÏö© ?åÏùº?Ä Ï±ÑÎÑê Î£∞Î?Î°?Ï≤®Î??©Îãà??

#Varo #Í≤åÏûÑÎ≤àÏó≠
\`\`\`

## ?ìã Í∂åÏû• ?ëÏãù (?ïÎ≥¥ ??Ï§?Î∂ÑÏö©)

\`\`\`
[?úÎ™©] [Varo ?ÑÍ∏∞] ?ã‚óã - ?≥‚ñ≥ Î∂ÄÎ∂?Î≤àÏó≠ ????
?àÎÖï?òÏÑ∏?? Varo ?®ÏÑú ?ã‚óã Î≤àÏó≠ ?úÎèÑ?¥Î¥§?µÎãà??

?ìå Í≤åÏûÑ ?ïÎ≥¥
- Í≤åÏûÑ: ?ã‚óã
- ?îÏßÑ: (Î™®Î•¥Î©?ÎπÑÏõå???©Îãà??

?êõ Î∞úÏÉù??Î¨∏Ï†ú
- (?¥Îîî??ÎßâÌòî?îÏ?)
- (?¥Îñ§ Ï¶ùÏÉÅ?∏Ï?)

?îß ?úÎèÑ?¥Î≥∏ Í≤?- AI: (Claude / Gemini / GPT ??
- Ï∂îÏ∂ú / Î≤àÏó≠ / ?ÅÏö© Ï§??¥Îîî??ÎßâÌòî?îÏ?

Í∞ôÏ? Í≤åÏûÑ ?¥Î≥¥??Î∂??ïÎ≥¥ ?àÏúºÎ©??ìÍ? Î∂Ä?ÅÎìúÎ¶ΩÎãà??

#Varo #Í≤åÏûÑÎ≤àÏó≠Í∏?#?îÎ≤ÑÍπ?\`\`\`

## ?ìù ?ëÏÑ± ??- Í≤åÏûÑ ?¥Î¶Ñ?Ä ?úÍµ≠???ºÎ≥∏???????∞Î©¥ Í≤Ä??????- Î™®Î•¥????™©?Ä Í∑∏ÎÉ• ÎπÑÏö∞Í±∞ÎÇò "Î™®Î¶Ñ" ?ÅÏñ¥??OK
- Í≤åÏûÑ ?åÏùº?Ä **?¥Îãπ Ï±ÑÎÑê??Íµ?£∞?ÄÎ°?* ?ÖÎ°ú??- Í≤åÏãúÎ¨??ëÏÑ± ??**ÎßÅÌÅ¨Îß?* Varo ?îÏä§ÏΩîÎìú #?ì©Î¨∏Ïùò?òÍ∏∞??Í≥µÏú†`;

// Section 3: Rules of thumb / FAQ
const MSG_FAQ =
`# ???êÏ£º Î¨ªÎäî ÏßàÎ¨∏

## Q. ???îÏä§ÏΩîÎìú??Í≤åÏûÑ ?åÏùº??ÏßÅÏ†ë Î™??¨Î¶¨Í≤??êÎÇò??
- 1???¥ÏòÅ ?úÎπÑ?§Ïùò ÏßÄ?çÍ??•ÏÑ± ?ïÎ≥¥
- ?îÏä§ÏΩîÎìú ?úÎ≤Ñ ?¥ÏòÅ ?ïÏ±Ö ?àÏ†ï??- ?¨Ïö©??Î≥∏Ïù∏??ÏßÅÏ†ë ?êÎ£å Í¥ÄÎ¶?Í∞Ä??- ?êÏÑ∏???àÎÇ¥: #?ì¢Í≥µÏ? Ï±ÑÎÑê Ï∞∏Í≥†

## Q. ?¥Îñ§ ?∏Î? Ïª§Î??àÌã∞Î•??¥Ïö©?òÎ©¥ Ï¢ãÎÇò??
- Î≥∏Ïù∏???êÏ£º ?¨Ïö©?òÏãú???∏ÎîîÍ≤åÏûÑ Ïª§Î??àÌã∞ Ï∂îÏ≤ú
- ?úÍµ≠ ?¨Ïö©?? **?ÑÏπ¥?ºÏù¥Î∏?*, **ÏΩîÎÑ§** ??- ?ÅÏñ¥Í∂??¨Ïö©?? F95zone ??
## Q. Í≤åÏãúÎ¨?Í≥µÍ∞ú Î≤îÏúÑ???¥ÎñªÍ≤??¥Ïïº ?òÎÇò??
- ?¥Îãπ Ïª§Î??àÌã∞??Î£∞ÏùÑ ?∞ÎùºÏ£ºÏÑ∏??- ÎπÑÎ≤à ?§Ï†ï??Íµ?£∞?¥ÎùºÎ©?Í∑∏Î?Î°??∞ÎùºÏ£ºÏãúÎ©??©Îãà??- ?îÏä§ÏΩîÎìú??Í≥µÏú† ??ÎπÑÎ≤à???®Íªò ?ÅÏñ¥Ï£ºÏÑ∏??
## Q. Í≤åÏûÑ ?åÏùº ?ÜÏù¥ ?¥ÎñªÍ≤??îÎ≤ÑÍπ??òÎÇò??
- **Î°úÍ∑∏ ?åÏùº + ?§ÌÅ¨Î¶∞ÏÉ∑**?ºÎ°ú 80% ?¥ÏÉÅ ?¥Í≤∞?©Îãà??- Î°úÍ∑∏ ?ÑÏπò: Varo ?§Ïπò ?¥Îçî ??\`logs/\` ?¥Îçî
- ?êÏÑ∏??Ï¶ùÏÉÅ + ?¨ÌòÑ Î∞©Î≤ï = Í∞Ä?????ÑÏ?

## Q. ?§Î•∏ ?¨Ïö©?êÍ? ?¥Î? Í∞ôÏ? Í≤åÏûÑ ?ÑÍ∏∞Î•??¨Î†∏?¥Ïöî
- ?ìÍ?Î°?"?Ä??Í∞ôÏ? Î¨∏Ï†ú Î∞úÏÉù" ?ïÎ≥¥ Ï∂îÍ? Í∞Ä??- Í∞ôÏ? Í≤åÏûÑ = Í∞ôÏ? ?¥Í≤∞Ï±ÖÏùº Í∞Ä?•ÏÑ± ?íÏùå

## Q. R18 Í≤åÏûÑ ?ÑÍ∏∞?îÏöî?
- #?éÆVaro-?ÑÍ∏∞ Ï±ÑÎÑê??\`?îû R18\` ?úÍ∑∏ ?¨Ïö©
- (Î≥ÑÎèÑ R18 ?ôÏùò ??ï† ?ÑÏöî ??Í≥??àÎÇ¥?©Îãà??

## Q. ?∏Íµ≠???ÑÍ∏∞Î•??∞Í≥† ?∂Ïñ¥??- \`?åè Global\` ?úÍ∑∏ ?¨Ïö©
- ?ÅÏñ¥ ?ÑÍ∏∞??#support-en Ï±ÑÎÑê???úÏö© Í∞Ä??;

(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  console.log(DRY_RUN ? '?îç DRY RUN MODE\n' : '?? EXECUTE MODE\n');

  // Step 1: Create channel
  console.log('1Ô∏è‚É£  Create channel: ' + CHANNEL_NAME);
  let channelId;
  if (!DRY_RUN) {
    // Get rules-rules channel position to place new channel right after it
    const rulesChannel = await rest.get(Routes.channel(RULES_CHANNEL_ID));

    const newChannel = await rest.post(Routes.guildChannels(GUILD_ID), {
      body: {
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        parent_id: INFO_CATEGORY_ID,
        topic: 'Î≤ÑÍ∑∏ Î¶¨Ìè¨???ëÏÑ± ?ëÏãù / ?∏Î? Ïª§Î??àÌã∞ [Varo ?ÑÍ∏∞] ?ëÏÑ±Î≤?/ FAQ',
        position: rulesChannel.position + 1,
        permission_overwrites: [
          {
            id: GUILD_ID,
            type: 0, // role
            allow: '1024', // ViewChannel
            deny: '2048' // SendMessages ??read only for everyone
          }
        ]
      }
    });
    channelId = newChannel.id;
    console.log('   ??Channel created:', channelId);
  } else {
    console.log('   (would create read-only channel under ?àÎÇ¥ category)');
  }
  console.log();

  // Step 2: Send section messages
  console.log('2Ô∏è‚É£  Send guide messages');
  if (!DRY_RUN) {
    const msg1 = await rest.post(Routes.channelMessages(channelId), {
      body: { content: MSG_DISCORD_TEMPLATE }
    });
    console.log('   ??Section 1 (Discord template):', msg1.id);

    const msg2 = await rest.post(Routes.channelMessages(channelId), {
      body: { content: MSG_AKALIVE_TEMPLATE }
    });
    console.log('   ??Section 2 (Akalive template):', msg2.id);

    const msg3 = await rest.post(Routes.channelMessages(channelId), {
      body: { content: MSG_FAQ }
    });
    console.log('   ??Section 3 (FAQ):', msg3.id);

    // Pin all 3 messages
    console.log('\n3Ô∏è‚É£  Pin messages');
    for (const m of [msg1, msg2, msg3]) {
      try {
        await rest.put(Routes.channelPin(channelId, m.id));
        console.log('   ??Pinned:', m.id);
      } catch (e) {
        console.log('   ?†Ô∏è Pin failed:', m.id, e.message);
      }
    }
  } else {
    console.log('   (would send 3 messages: Discord template / Akalive template / FAQ)');
  }
  console.log();

  // Step 3: Set member-role-only access (so only verified members see it)
  console.log('4Ô∏è‚É£  Permissions');
  console.log('   @everyone: ViewChannel (read-only)');
  console.log('   - Anyone (verified or not) can see ??info channel');
  console.log();

  console.log('?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ');
  if (!DRY_RUN && channelId) {
    console.log('??DONE');
    console.log('Channel ID:', channelId);
  } else if (DRY_RUN) {
    console.log('?í° Run with --execute to apply');
  }
})();
