// R18 consent button handler ??toggles ?”18+?™ì˜ role on/off
const { requireExecute } = require('./safety');
requireExecute('discord-r18-consent');

async function handleR18Consent(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('r18_consent_')) return false;

  const guildId = interaction.customId.replace('r18_consent_', '');
  if (interaction.guildId !== guildId) return false;

  const member = interaction.member;
  if (!member) return false;

  // Find ?”18+?™ì˜ role by name
  const r18Role = interaction.guild.roles.cache.find(r => r.name === '?”18+?™ì˜');
  if (!r18Role) {
    await interaction.reply({
      content: '? ï¸ 18+ ??• ??ì°¾ì„ ???†ìŠµ?ˆë‹¤. ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?´ì£¼?¸ìš”.',
      ephemeral: true
    });
    return true;
  }

  try {
    if (member.roles.cache.has(r18Role.id)) {
      // Already has role ??remove (revoke consent)
      await member.roles.remove(r18Role.id);
      await interaction.reply({
        content: '??**18+ ?™ì˜ê°€ ì² íšŒ?˜ì—ˆ?µë‹ˆ??**\n?”Varo-?„ê¸°-R18 ì±„ë„???¨ê²¨ì§‘ë‹ˆ??\n?¤ì‹œ ?œì„±?”í•˜?¤ë©´ ë²„íŠ¼???¤ì‹œ ?ŒëŸ¬ì£¼ì„¸??',
        ephemeral: true
      });
      console.log('[R18Consent] revoked: ' + member.user.tag);
    } else {
      // Doesn't have role ??add (grant consent)
      await member.roles.add(r18Role.id);
      await interaction.reply({
        content: '??**18+ ?™ì˜ ?„ë£Œ!**\n?”Varo-?„ê¸°-R18 ì±„ë„???´ë ¸?µë‹ˆ??\n?™ì˜ë¥?ì² íšŒ?˜ë ¤ë©?ë²„íŠ¼???¤ì‹œ ?ŒëŸ¬ì£¼ì„¸??',
        ephemeral: true
      });
      console.log('[R18Consent] granted: ' + member.user.tag);
    }
  } catch (err) {
    console.error('[R18Consent] role toggle error:', err.message);
    await interaction.reply({
      content: '???¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤. ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?´ì£¼?¸ìš”.',
      ephemeral: true
    });
  }

  return true;
}

module.exports = { handleR18Consent };
