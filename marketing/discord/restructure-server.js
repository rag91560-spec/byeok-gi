// Restructure Í≤åÏûÑÎ≤àÏó≠Í∏???Varo server:
const { requireExecute } = require('./safety');
requireExecute('discord-restructure-server');
// 1. Rename Î≤àÏó≠Í≥µÏú† ??Varo-?ÑÍ∏∞ + update topic
// 2. Replace tags (remove old, keep R18 as filter, add new)
// 3. Delete old Î≤àÏó≠Í≥µÏú† ?ëÏãù ?àÎÇ¥ thread (replaced by new pinned post)
// 4. Update ?ì©Î¨∏Ïùò?òÍ∏∞ topic (remove "share game" prompt)
// 5. Send new pinned guidance post to Varo-?ÑÍ∏∞
// 6. Create 18+ role + permission overwrites for R18 tag filter
//
// SAFETY: dry-run by default. Pass --execute to apply.

if (process.env.DISCORD_ENV_PATH) require('dotenv').config({ path: process.env.DISCORD_ENV_PATH });
const { REST, Routes } = require('discord.js');
const DRY_RUN = !process.argv.includes('--execute');

const GUILD_ID = '1475903955761631234';
const SHARING_FORUM = '1491614384026550292'; // Î≤àÏó≠Í≥µÏú†
const INQUIRY_FORUM = '1475914708384223403'; // Î¨∏Ïùò?òÍ∏∞

const TAG_R18 = '1491614384026550295';

const NEW_SHARING_TOPIC =
  'VaroÎ°?Î≤àÏó≠?¥Î≥∏ Í≤åÏûÑ ?ÑÍ∏∞ / Ï∂îÏ≤ú / ??Í≥µÏú† Ï±ÑÎÑê?ÖÎãà??\n\n' +
  '???ÑÍ∏∞, ?§ÌÅ¨Î¶∞ÏÉ∑, Ï∂îÏ≤ú Í≤åÏûÑ, Î≤àÏó≠ ??n' +
  '?†Ô∏è Í≤åÏûÑ ?åÏùº / ?§Ïö¥Î°úÎìú ÎßÅÌÅ¨ ÏßÅÏ†ë ?ÖÎ°ú??Í∏àÏ?\n' +
  '?êõ Î≤ÑÍ∑∏Í∞Ä ?àÎã§Î©??ÑÏπ¥?ºÏù¥Î∏? ÏΩîÎÑ§ ?±Ïóê [Varo ?ÑÍ∏∞] ?ïÏãù?ºÎ°ú\n' +
  '    Í≤åÏãú ??Í≤åÏãúÎ¨?ÎßÅÌÅ¨Îß?Í≥µÏú†?¥Ï£º?∏Ïöî\n' +
  '?îû R18 ?úÍ∑∏ Í≤åÏãúÎ¨ºÏ? 18+ ?ôÏùò ??ï†???ÑÏöî?©Îãà??;

const NEW_INQUIRY_TOPIC =
  'Î≤àÏó≠Í∏??¨Ïö© Ï§?Î¨∏Ï†ú, Î≤ÑÍ∑∏, ?îÏßÑ Ï∂îÍ? ?îÏ≤≠ ??n' +
  'Î¨¥Ïóá?¥Îì† ???¨Ïä§?∏Î? ?ëÏÑ±?¥Ï£º?∏Ïöî.\n\n' +
  '?ìå ?ëÏÑ± ???ÑÎûò ?¥Ïö©???¨Ìï®?¥Ï£º?∏Ïöî:\n' +
  '???¥Îñ§ Í≤åÏûÑ?∏Ï? (Í≤åÏûÑÎ™?\n' +
  '???¥Îñ§ Î¨∏Ï†úÍ∞Ä Î∞úÏÉù?àÎäîÏßÄ\n' +
  '???§Î•ò Î©îÏãúÏßÄÍ∞Ä ?àÎã§Î©??§ÌÅ¨Î¶∞ÏÉ∑\n\n' +
  '?†Ô∏è Í≤åÏûÑ ?åÏùº?Ä ?îÏä§ÏΩîÎìú??ÏßÅÏ†ë ?ÖÎ°ú?úÌïòÏßÄ ÎßàÏÑ∏??\n' +
  '?êõ ?îÎ≤ÑÍπÖÏö© Í≤åÏûÑ???ÑÏöî??Í≤ΩÏö∞ ?ÑÏπ¥?ºÏù¥Î∏? ÏΩîÎÑ§ ?±Ïóê\n' +
  '    [Varo ?ÑÍ∏∞] ?ïÏãù?ºÎ°ú Í≤åÏãú ??ÎßÅÌÅ¨Îß?Í≥µÏú†?¥Ï£º?∏Ïöî.\n' +
  '   (?ëÏãù: #?ìãÎ≤ÑÍ∑∏Î¶¨Ìè¨?∏Í??¥Îìú Ï∞∏Í≥†)\n\n' +
  '?úÍ∑∏Î•??†ÌÉù?òÎ©¥ Îπ†Î•∏ Î∂ÑÎ•òÍ∞Ä Í∞Ä?•Ìï©?àÎã§.';

const NEW_PINNED_POST = {
  title: '?ìå Varo ?ÑÍ∏∞ Ï±ÑÎÑê Í∞Ä?¥Îìú (?ÑÎèÖ)',
  message:
    '# ?éÆ Varo ?ÑÍ∏∞ Ï±ÑÎÑê ?¨Ïö© Í∞Ä?¥Îìú\n\n' +
    '?àÎÖï?òÏÑ∏?? ??Ï±ÑÎÑê?Ä **Varo (Í≤åÏûÑÎ≤àÏó≠Í∏?** ?¨Ïö© ?ÑÍ∏∞Î•?Í≥µÏú†?òÎäî Í≥≥ÏûÖ?àÎã§.\n\n' +
    '## ???¥Îü∞ Í∏Ä???òÏòÅ?©Îãà??n' +
    '- VaroÎ°?Î≤àÏó≠?¥Î≥∏ Í≤åÏûÑ ?ÑÍ∏∞\n' +
    '- Î≤àÏó≠ Í≤∞Í≥º ?§ÌÅ¨Î¶∞ÏÉ∑\n' +
    '- Ï∂îÏ≤ú Í≤åÏûÑ / ?•Î•¥Î≥????òÎäî Í≤åÏûÑ\n' +
    '- Î≤àÏó≠ ??/ AI ?§Ï†ï ?∏Ìïò??n' +
    '- "??Í≤åÏûÑ ?ÑÍ? Î≤àÏó≠?¥Î≥¥?®ÎÇò??" Í∞ôÏ? ÏßàÎ¨∏\n\n' +
    '## ?†Ô∏è ?¥Îü∞ Í∏Ä?Ä Í∏àÏ??ÖÎãà??n' +
    '- Í≤åÏûÑ ?åÏùº ÏßÅÏ†ë ?ÖÎ°ú??n' +
    '- ?§Ïö¥Î°úÎìú ÎßÅÌÅ¨ ÏßÅÏ†ë Í≥µÏú†\n' +
    '- Varo ?ÑÎ°úÍ∑∏Îû® ?êÏ≤¥ ?¨Î∞∞??n\n' +
    '## ?êõ Î≤ÑÍ∑∏Í∞Ä ?àÎäî Í≤åÏûÑ??Í≥µÏú†?òÍ≥† ?∂Îã§Î©?\n' +
    '1. **?ÑÏπ¥?ºÏù¥Î∏? ÏΩîÎÑ§** ??Î≥∏Ïù∏???êÏ£º ?¨Ïö©?òÏãú???∏ÎîîÍ≤åÏûÑ Ïª§Î??àÌã∞??n' +
    '   `[Varo ?ÑÍ∏∞]` ?ïÏãù?ºÎ°ú Í≤åÏãúÎ¨ºÏùÑ ?ëÏÑ±?¥Ï£º?∏Ïöî\n' +
    '2. Í≤åÏûÑ ?¥Î¶ÑÍ≥??¥Îñ§ Î∂ÄÎ∂ÑÏù¥ ÎßâÌûà?îÏ? ?úÎëê Ï§??ÅÏúºÎ©?OK\n' +
    '3. ?îÏä§ÏΩîÎìú #?ì©Î¨∏Ïùò?òÍ∏∞??**Í≤åÏãúÎ¨?ÎßÅÌÅ¨Îß?* Ï≤®Î?\n' +
    '4. ?êÏÑ∏???ëÏãù?Ä #?ìãÎ≤ÑÍ∑∏Î¶¨Ìè¨?∏Í??¥Îìú Ï∞∏Í≥†\n\n' +
    '## ?è∑Ô∏??úÍ∑∏ ?àÎÇ¥\n' +
    '- ?éÆ RPG / ?ìñ ÎπÑÏ£º?ºÎÖ∏Î≤?/ ?éØ Í∏∞Ì? ???•Î•¥Î≥?Î∂ÑÎ•ò\n' +
    '- ?êõ Î≤ÑÍ∑∏Í≥µÏú† ??Î≤àÏó≠ Î¨∏Ï†ú / ?§Î•ò ?ÑÍ∏∞\n' +
    '- ?îû R18 ???±Ïù∏ ÏΩòÌÖêÏ∏?(18+ ?ôÏùò ??ï† ?ÑÏöî)\n' +
    '- ?åè Global ???ÅÏñ¥ ???úÍµ≠????Í≤åÏãúÎ¨?n\n' +
    '## ?íö ?òÏòÅ?©Îãà??n' +
    'Varo??1???¥ÏòÅ ?úÎπÑ?§ÏûÖ?àÎã§. ?ÑÍ∏∞ Í≥µÏú†???§Î•∏ ?¨Ïö©?êÏóêÍ≤????ÑÏ????©Îãà??\n' +
    '?∏ÌïòÍ≤??ëÏÑ±?¥Ï£º?∏Ïöî!'
};

(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  console.log(DRY_RUN ? '?îç DRY RUN MODE (use --execute to apply)\n' : '?? EXECUTE MODE\n');

  // Step 1: Update ?ì©Î¨∏Ïùò?òÍ∏∞ topic
  console.log('1Ô∏è‚É£  Update ?ì©Î¨∏Ïùò?òÍ∏∞ topic');
  console.log('   New topic:\n   ' + NEW_INQUIRY_TOPIC.split('\n').join('\n   '));
  if (!DRY_RUN) {
    await rest.patch(Routes.channel(INQUIRY_FORUM), {
      body: { topic: NEW_INQUIRY_TOPIC }
    });
    console.log('   ??Updated');
  }
  console.log();

  // Step 2: Rename Î≤àÏó≠Í≥µÏú† ??Varo-?ÑÍ∏∞ + update topic
  console.log('2Ô∏è‚É£  Rename Î≤àÏó≠Í≥µÏú† ???éÆVaro-?ÑÍ∏∞');
  console.log('   New name: ?éÆVaro-?ÑÍ∏∞');
  console.log('   New topic:\n   ' + NEW_SHARING_TOPIC.split('\n').join('\n   '));
  if (!DRY_RUN) {
    await rest.patch(Routes.channel(SHARING_FORUM), {
      body: {
        name: '?éÆVaro-?ÑÍ∏∞',
        topic: NEW_SHARING_TOPIC
      }
    });
    console.log('   ??Renamed and topic updated');
  }
  console.log();

  // Step 3: Update tags (rename for clarity, keep R18)
  console.log('3Ô∏è‚É£  Update forum tags');
  const newTags = [
    { id: '1491614384026550293', name: 'RPG', emoji_name: '?éÆ', moderated: false, emoji_id: null },
    { id: '1491614384026550294', name: 'ÎπÑÏ£º?ºÎÖ∏Î≤?, emoji_name: '?ìñ', moderated: false, emoji_id: null },
    { id: '1491614384026550296', name: 'Î≤ÑÍ∑∏?úÎ≥¥', emoji_name: '?êõ', moderated: false, emoji_id: null },
    { id: '1491614384026550297', name: 'Ï∂îÏ≤ú', emoji_name: '‚≠?, moderated: false, emoji_id: null },
    { id: '1491623036896673823', name: 'Global', emoji_name: '?åè', moderated: false, emoji_id: null },
    { id: '1491614384026550295', name: 'R18', emoji_name: '?îû', moderated: true, emoji_id: null },
  ];
  console.log('   Tags: RPG / ÎπÑÏ£º?ºÎÖ∏Î≤?/ Î≤ÑÍ∑∏?úÎ≥¥ / Ï∂îÏ≤ú / Global / R18(moderated)');
  if (!DRY_RUN) {
    await rest.patch(Routes.channel(SHARING_FORUM), {
      body: { available_tags: newTags }
    });
    console.log('   ??Tags updated');
  }
  console.log();

  // Step 4: Delete old guide thread + create new pinned post
  console.log('4Ô∏è‚É£  Replace old guide thread');
  const OLD_GUIDE_THREAD = '1491623517693804654'; // ?ìå Î≤àÏó≠Í≥µÏú† ?ëÏãù ?àÎÇ¥ (?ÑÎèÖ)
  console.log('   Delete: 1491623517693804654 (old guide)');
  if (!DRY_RUN) {
    try {
      await rest.delete(Routes.channel(OLD_GUIDE_THREAD));
      console.log('   ??Old guide deleted');
    } catch (e) {
      console.log('   ?†Ô∏è Delete failed (may not exist):', e.message);
    }
  }

  console.log('   Create new pinned post: ' + NEW_PINNED_POST.title);
  if (!DRY_RUN) {
    const newPost = await rest.post(Routes.threads(SHARING_FORUM), {
      body: {
        name: NEW_PINNED_POST.title,
        message: { content: NEW_PINNED_POST.message },
        auto_archive_duration: 10080
      }
    });
    console.log('   ??New post created:', newPost.id);
    // Pin the post
    try {
      await rest.put(`/channels/${SHARING_FORUM}/threads/${newPost.id}/pin`);
      console.log('   ??Pinned');
    } catch (e) {
      console.log('   ?†Ô∏è Pin failed:', e.message);
    }
  }
  console.log();

  console.log('?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ?Å‚îÅ');
  console.log('?ìã Next manual steps (not automated):');
  console.log('  - Create ?ìãÎ≤ÑÍ∑∏Î¶¨Ìè¨?∏Í??¥Îìú channel (we will do this next)');
  console.log('  - Set up 18+ role + permission overwrites');
  console.log('  - Review old ?∞Î™® ?ÅÏÉÅ??Í≤åÏûÑ Í≥µÏú† thread (1498544294636687461)');
  if (DRY_RUN) console.log('\n?í° Run with --execute to apply changes');
})();
