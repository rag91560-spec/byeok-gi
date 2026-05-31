// List all channels in 게임번역기 guild for restructuring planning
require('dotenv').config({ path: '/home/ubuntu/openclaw-system/.env' });
const { REST, Routes } = require('discord.js');

const GUILD_ID = '1475903955761631234';

(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    const channels = await rest.get(Routes.guildChannels(GUILD_ID));

    // Group by parent (category)
    const categories = {};
    const orphans = [];

    for (const ch of channels) {
      if (ch.type === 4) {
        // Category
        if (!categories[ch.id]) categories[ch.id] = { name: ch.name, position: ch.position, children: [] };
        else { categories[ch.id].name = ch.name; categories[ch.id].position = ch.position; }
      } else {
        if (ch.parent_id) {
          if (!categories[ch.parent_id]) categories[ch.parent_id] = { name: '?', position: 999, children: [] };
          categories[ch.parent_id].children.push(ch);
        } else {
          orphans.push(ch);
        }
      }
    }

    // Sort and print
    const TYPE_LABEL = {
      0: 'TEXT',
      2: 'VOICE',
      5: 'ANNOUNCE',
      13: 'STAGE',
      15: 'FORUM',
      11: 'THREAD',
      12: 'PRIV_THREAD'
    };

    const sortedCats = Object.entries(categories).sort((a, b) => a[1].position - b[1].position);
    for (const [catId, cat] of sortedCats) {
      console.log(`\n📁 [${cat.name}] (${catId})`);
      cat.children.sort((a, b) => a.position - b.position);
      for (const ch of cat.children) {
        const type = TYPE_LABEL[ch.type] || ch.type;
        console.log(`  - #${ch.name}  [${type}]  ${ch.id}`);
        if (ch.topic) console.log(`      topic: ${ch.topic.slice(0, 80)}`);
      }
    }
    if (orphans.length) {
      console.log('\n📁 [No Category]');
      for (const ch of orphans) {
        const type = TYPE_LABEL[ch.type] || ch.type;
        console.log(`  - #${ch.name}  [${type}]  ${ch.id}`);
      }
    }
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  }
})();
