const { db } = require('../database/init');

const spamTracker = new Map();

const SPAM_THRESHOLD = 5;
const SPAM_INTERVAL = 5000;

const badWords = [
  'badword1',
  'badword2'
];

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const automodEnabled = process.env.AUTOMOD_ENABLED === 'true';
    if (!automodEnabled) return;

    const userId = message.author.id;
    const now = Date.now();

    if (!spamTracker.has(userId)) {
      spamTracker.set(userId, []);
    }

    const userMessages = spamTracker.get(userId);
    userMessages.push(now);

    const recentMessages = userMessages.filter(timestamp => now - timestamp < SPAM_INTERVAL);
    spamTracker.set(userId, recentMessages);

    if (recentMessages.length >= SPAM_THRESHOLD) {
      try {
        await message.delete();
        
        const member = await message.guild.members.fetch(userId);
        if (member.moderatable) {
          await member.timeout(5 * 60 * 1000, 'Anti-spam: Sending messages too quickly');
          
          const stmt = db.prepare(`
            INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason, duration)
            VALUES (?, ?, ?, ?, ?)
          `);
          stmt.run('timeout', userId, message.client.user.id, 'Anti-spam: Sending messages too quickly', 5);
          
          try {
            await message.author.send('You have been timed out for 5 minutes for sending messages too quickly. Please slow down.');
          } catch (e) {
            console.log('Could not DM user');
          }
        }
        
        spamTracker.delete(userId);
        return;
      } catch (error) {
        console.error('Error handling spam:', error);
      }
    }

    const filterEnabled = process.env.WORD_FILTER_ENABLED === 'true';
    if (filterEnabled) {
      const content = message.content.toLowerCase();
      const foundBadWords = badWords.filter(word => content.includes(word));
      
      if (foundBadWords.length > 0) {
        try {
          await message.delete();
          
          const stmt = db.prepare(`
            INSERT INTO warnings (user_id, moderator_id, reason)
            VALUES (?, ?, ?)
          `);
          stmt.run(userId, message.client.user.id, `Used prohibited word(s): ${foundBadWords.join(', ')}`);
          
          try {
            await message.author.send(`Your message was deleted for containing prohibited words. Please follow the server rules.`);
          } catch (e) {
            console.log('Could not DM user');
          }
        } catch (error) {
          console.error('Error filtering message:', error);
        }
      }
    }
  }
};
