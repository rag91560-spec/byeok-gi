// Inspect all threads (active + archived) in 번역공유 forum channel
require('dotenv').config({ path: '/home/ubuntu/openclaw-system/.env' });
const { REST } = require('discord.js');

const GUILD_ID = '1475903955761631234';
const FORUM_ID = '1491614384026550292';
const R18_TAG_ID = '1491614384026550295';

const TAG_NAMES = {
  '1491614384026550293': '🎮 RPG',
  '1491614384026550294': '📖 비주얼노벨',
  '1491614384026550295': '🔞 R18',
  '1491614384026550296': '🐛 버그공유',
  '1491614384026550297': '🎯 기타',
  '1491623036896673823': '🌏 Global'
};

(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    const all = [];

    // Active threads
    const active = await rest.get(`/guilds/${GUILD_ID}/threads/active`);
    for (const t of active.threads) {
      if (t.parent_id === FORUM_ID) all.push({ ...t, archived: false });
    }

    // Archived threads (paginate)
    let before = null;
    while (true) {
      let url = `/channels/${FORUM_ID}/threads/archived/public?limit=100`;
      if (before) url += `&before=${before}`;
      const res = await rest.get(url);
      for (const t of res.threads) {
        all.push({ ...t, archived: true });
      }
      if (!res.has_more) break;
      const last = res.threads[res.threads.length - 1];
      before = last.thread_metadata?.archive_timestamp;
      if (!before) break;
    }

    console.log(`\n=== Total threads in 번역공유: ${all.length} ===\n`);

    let r18Count = 0;
    for (const t of all) {
      const tags = (t.applied_tags || []).map(id => TAG_NAMES[id] || id).join(', ');
      const isR18 = (t.applied_tags || []).includes(R18_TAG_ID);
      if (isR18) r18Count++;
      const status = t.archived ? '[ARCHIVED]' : '[ACTIVE]  ';
      const r18Mark = isR18 ? ' 🔞' : '';
      console.log(`${status} ${t.id} | msgs:${(t.message_count || 0).toString().padStart(3)} |${r18Mark} ${t.name}`);
      if (tags) console.log(`           tags: ${tags}`);
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total: ${all.length}`);
    console.log(`R18 tagged: ${r18Count}`);
    console.log(`Active: ${all.filter(t => !t.archived).length}`);
    console.log(`Archived: ${all.filter(t => t.archived).length}`);
  } catch (err) {
    console.error('FAIL:', err.message);
    if (err.rawError) console.error('  Raw:', JSON.stringify(err.rawError));
    process.exit(1);
  }
})();
