// Set up R18 separation:
const { requireExecute } = require('./safety');
requireExecute('discord-setup-r18-separation');
// 1. Create ?”18+?™ì˜ role
// 2. Create ?”Varo-?„ê¸°-R18 forum channel (member + 18+ only)
// 3. Remove R18 tag from main ?®Varo-?„ê¸° channel
// 4. Send R18 guide post to new channel
// 5. Send 18+ consent button to ?·ï¸ì—­??language channel
//
// Usage: node setup-r18-separation.js [--execute]

if (process.env.DISCORD_ENV_PATH) require('dotenv').config({ path: process.env.DISCORD_ENV_PATH });
const { REST, Routes, ChannelType } = require('discord.js');

const DRY_RUN = !process.argv.includes('--execute');

const GUILD_ID = '1475903955761631234';
const SHARING_CATEGORY = '1477220694944120893'; // ?® ?€ ë²ˆì—­ê³µìœ  | Sharing
const SHARING_FORUM = '1491614384026550292'; // ?®Varo-?„ê¸°
const ROLE_SELECT_CHANNEL = '1477220709955801203'; // ?·ï¸ì—­??language
const MEMBER_ROLE_ID = '1477224178879954944'; // existing ë©¤ë²„ role

const R18_TAG_ID = '1491614384026550295';

// Permission flags (BigInt strings)
const PERM = {
  ViewChannel:      '1024',           // 1 << 10
  SendMessages:     '2048',           // 1 << 11
  SendMessagesInThreads: '274877906944', // 1 << 38
  CreatePublicThreads: '34359738368', // 1 << 35
  ReadMessageHistory: '65536',        // 1 << 16
  AttachFiles:      '32768',          // 1 << 15
  EmbedLinks:       '16384',          // 1 << 14
  AddReactions:     '64',             // 1 << 6
};
const ALL_BASIC = (BigInt(PERM.ViewChannel) | BigInt(PERM.SendMessagesInThreads) |
  BigInt(PERM.CreatePublicThreads) | BigInt(PERM.ReadMessageHistory) |
  BigInt(PERM.AttachFiles) | BigInt(PERM.EmbedLinks) | BigInt(PERM.AddReactions)).toString();

const R18_GUIDE_MSG =
`# ?” Varo ?„ê¸° R18 ì±„ë„ ?ˆë‚´

??ì±„ë„?€ **18???´ìƒ ?™ì˜?ë§Œ** ë³????ˆëŠ” R18 ê²Œì„ ?„ê¸° ?„ìš© ì±„ë„?…ë‹ˆ??

## ???´ëŸ° ê¸€???‘ì„±?´ì£¼?¸ìš”
- R18 ê²Œì„ ?„ê¸° / ë²ˆì—­ ê²°ê³¼
- R18 ê²Œì„ ì¶”ì²œ / ?¥ë¥´ë³????˜ëŠ” ê²Œì„
- R18 ë²ˆì—­ ??
## ? ï¸ ê¸ˆì??¬í•­
- ê²Œì„ ?Œì¼ / ?¤ìš´ë¡œë“œ ë§í¬ ì§ì ‘ ?…ë¡œ??- ë¯¸ì„±?„ì ìºë¦­??ê²Œì„ (?œêµ­ë²•ìƒ ì²˜ë²Œ ?€??
- Varo ?„ë¡œê·¸ë¨ ?ì²´ ?¬ë°°??
## ?› ë²„ê·¸ê°€ ?ˆëŠ” ê²Œì„??ê³µìœ ?˜ê³  ?¶ë‹¤ë©?
1. **?„ì¹´?¼ì´ë¸? ì½”ë„¤** ??ë³¸ì¸???ì£¼ ?¬ìš©?˜ì‹œ???¸ë””ê²Œì„ ì»¤ë??ˆí‹°??   \`[Varo ?„ê¸°]\` ?•ì‹?¼ë¡œ ê²Œì‹œë¬¼ì„ ?‘ì„±?´ì£¼?¸ìš”
2. ?”ìŠ¤ì½”ë“œ #?“©ë¬¸ì˜?˜ê¸°??**ê²Œì‹œë¬?ë§í¬ë§?* ì²¨ë?
3. ?ì„¸???‘ì‹?€ #?“‹ë²„ê·¸ë¦¬í¬?¸ê??´ë“œ ì°¸ê³ 

## ?š« 18+ ??• ?€ ?´ë–»ê²?ë°›ë‚˜??
- #?·ï¸ì—­??language ì±„ë„?ì„œ \`?” 18+ ?™ì˜\` ë²„íŠ¼???´ë¦­?´ì£¼?¸ìš”
- ë³¸ì¸??18???´ìƒ?´ë©° R18 ì½˜í…ì¸??œì²­???™ì˜?¨ì„ ?˜ë??©ë‹ˆ??;

const CONSENT_MSG =
`## ?” R18 ì½˜í…ì¸??™ì˜

R18 ê²Œì„ ?„ê¸° ì±„ë„ (#?”Varo-?„ê¸°-R18)???‘ê·¼?˜ë ¤ë©??„ë˜ ë²„íŠ¼???´ë¦­?´ì£¼?¸ìš”.

? ï¸ **ë³¸ì¸??18???´ìƒ?´ë©° ?±ì¸ ì½˜í…ì¸??œì²­???™ì˜?¨ì„ ?˜ë??©ë‹ˆ??**
? ï¸ ë¯¸ì„±?„ìê°€ ?™ì˜ ??ë²•ì  ì±…ì„?€ ë³¸ì¸?ê²Œ ?ˆìŠµ?ˆë‹¤.

?™ì˜ ??R18 ì±„ë„??ë³´ì´ê²??©ë‹ˆ?? ?™ì˜ë¥?ì² íšŒ?˜ê³  ?¶ë‹¤ë©??¤ì‹œ ë²„íŠ¼???„ë¥´?¸ìš”.`;

(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  console.log(DRY_RUN ? '?” DRY RUN MODE\n' : '?? EXECUTE MODE\n');

  // Step 1: Create ?”18+?™ì˜ role
  console.log('1ï¸âƒ£  Create ?”18+?™ì˜ role');
  let r18RoleId;
  if (!DRY_RUN) {
    // Check if role already exists
    const roles = await rest.get(Routes.guildRoles(GUILD_ID));
    const existing = roles.find(r => r.name === '?”18+?™ì˜' || r.name === '18+?™ì˜' || r.name === '?” 18+');
    if (existing) {
      r18RoleId = existing.id;
      console.log('   ??Role exists:', r18RoleId);
    } else {
      const role = await rest.post(Routes.guildRoles(GUILD_ID), {
        body: {
          name: '?”18+?™ì˜',
          color: 0xC2185B,
          mentionable: false,
          hoist: false,
          permissions: '0'
        }
      });
      r18RoleId = role.id;
      console.log('   ??Role created:', r18RoleId);
    }
  } else {
    r18RoleId = '<NEW_ROLE_ID>';
    console.log('   (would create role "?”18+?™ì˜", color magenta)');
  }
  console.log();

  // Step 2: Create ?”Varo-?„ê¸°-R18 forum channel
  console.log('2ï¸âƒ£  Create ?”Varo-?„ê¸°-R18 forum channel');
  let r18ChannelId;
  if (!DRY_RUN) {
    // Check existing
    const channels = await rest.get(Routes.guildChannels(GUILD_ID));
    const existing = channels.find(c => c.name === '?”varo-?„ê¸°-r18' || c.name === '?”Varo-?„ê¸°-R18');
    if (existing) {
      r18ChannelId = existing.id;
      console.log('   ??Channel exists:', r18ChannelId);
    } else {
      const newChannel = await rest.post(Routes.guildChannels(GUILD_ID), {
        body: {
          name: '?”Varo-?„ê¸°-R18',
          type: ChannelType.GuildForum,
          parent_id: SHARING_CATEGORY,
          topic: 'R18 ê²Œì„ ?„ê¸° ?„ìš© ì±„ë„ (18+ ?™ì˜ ??•  ?„ìš”).\n\n? ï¸ ê²Œì„ ?Œì¼ ì§ì ‘ ?…ë¡œ??ê¸ˆì?.\n?› ë²„ê·¸???¸ë? ì»¤ë??ˆí‹° [Varo ?„ê¸°] ê²Œì‹œ ??ë§í¬ ê³µìœ .',
          nsfw: true,
          available_tags: [
            { name: 'RPG', emoji_name: '?®', moderated: false, emoji_id: null },
            { name: 'ë¹„ì£¼?¼ë…¸ë²?, emoji_name: '?“–', moderated: false, emoji_id: null },
            { name: 'ë²„ê·¸?œë³´', emoji_name: '?›', moderated: false, emoji_id: null },
            { name: 'ì¶”ì²œ', emoji_name: 'â­?, moderated: false, emoji_id: null },
            { name: 'Global', emoji_name: '?Œ', moderated: false, emoji_id: null }
          ],
          permission_overwrites: [
            // @everyone: deny everything
            { id: GUILD_ID, type: 0, allow: '0', deny: PERM.ViewChannel },
            // ë©¤ë²„ role: deny too (need both ë©¤ë²„ + 18+ to see)
            { id: MEMBER_ROLE_ID, type: 0, allow: '0', deny: PERM.ViewChannel },
            // 18+ role: allow
            { id: r18RoleId, type: 0, allow: ALL_BASIC, deny: '0' }
          ]
        }
      });
      r18ChannelId = newChannel.id;
      console.log('   ??Channel created:', r18ChannelId);
    }
  } else {
    r18ChannelId = '<NEW_CHANNEL_ID>';
    console.log('   (would create R18 forum, NSFW=true, 18+ role only)');
  }
  console.log();

  // Step 3: Remove R18 tag from main ?®Varo-?„ê¸° channel
  console.log('3ï¸âƒ£  Remove R18 tag from main ?®Varo-?„ê¸°');
  if (!DRY_RUN) {
    const main = await rest.get(Routes.channel(SHARING_FORUM));
    const filtered = (main.available_tags || []).filter(t => t.id !== R18_TAG_ID);
    await rest.patch(Routes.channel(SHARING_FORUM), {
      body: { available_tags: filtered }
    });
    console.log('   ??R18 tag removed (' + filtered.length + ' tags remaining)');
  } else {
    console.log('   (would remove R18 tag ??main channel becomes SFW only)');
  }
  console.log();

  // Step 4: Send guide post to R18 channel
  console.log('4ï¸âƒ£  Send guide post to R18 channel');
  if (!DRY_RUN && r18ChannelId !== '<NEW_CHANNEL_ID>') {
    const guidePost = await rest.post(Routes.threads(r18ChannelId), {
      body: {
        name: '?“Œ R18 ì±„ë„ ê°€?´ë“œ (?„ë…)',
        message: { content: R18_GUIDE_MSG },
        auto_archive_duration: 10080
      }
    });
    console.log('   ??Guide post created:', guidePost.id);
  } else {
    console.log('   (would post pinned guide to R18 channel)');
  }
  console.log();

  // Step 5: Send 18+ consent button to ?·ï¸ì—­??language
  console.log('5ï¸âƒ£  Send 18+ consent button to ?·ï¸ì—­??language');
  if (!DRY_RUN) {
    const result = await rest.post(Routes.channelMessages(ROLE_SELECT_CHANNEL), {
      body: {
        content: CONSENT_MSG,
        components: [{
          type: 1,
          components: [{
            type: 2,
            custom_id: 'r18_consent_' + GUILD_ID,
            label: '?” 18+ ?™ì˜',
            style: 4 // Danger / Red
          }]
        }]
      }
    });
    console.log('   ??Consent button posted:', result.id);
  } else {
    console.log('   (would post consent button in ?·ï¸ì—­??language)');
  }
  console.log();

  console.log('?â”?â”?â”?â”?â”?â”?â”?â”?â”?â”');
  if (!DRY_RUN) {
    console.log('??DONE');
    console.log('R18 Role ID:', r18RoleId);
    console.log('R18 Channel ID:', r18ChannelId);
    console.log();
    console.log('?“‹ IMPORTANT: Add interaction handler for "r18_consent_*" button');
    console.log('   in /home/ubuntu/openclaw-system/src/bot/interaction-handler.js');
    console.log('   (or wherever button handlers are registered)');
  } else {
    console.log('?’¡ Run with --execute to apply');
  }
})();
