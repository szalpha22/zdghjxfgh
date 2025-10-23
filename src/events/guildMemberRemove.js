const { db } = require('../database/init');
const { logInvite } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    try {
      const stmt = db.prepare('UPDATE invites SET left_at = CURRENT_TIMESTAMP WHERE user_id = ? AND left_at IS NULL');
      stmt.run(member.id);

      const inviteStmt = db.prepare('SELECT inviter_id FROM invites WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1');
      const invite = inviteStmt.get(member.id);

      await logInvite(client, 'Left', member.user, invite?.inviter_id);
    } catch (error) {
      console.error('Error in guildMemberRemove:', error);
    }
  }
};
