const { db } = require('../database/init');
const { logInvite } = require('../utils/logger');

function detectFakeInvite(member) {
  const accountAge = Date.now() - member.user.createdTimestamp;
  const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
  
  const hasDefaultAvatar = member.user.avatar === null;
  
  // Account is fake if it's less than 7 days old AND has no profile picture
  const isFake = daysSinceCreation < 7 && hasDefaultAvatar;
  
  return {
    isFake,
    hasDefaultAvatar,
    daysSinceCreation: Math.floor(daysSinceCreation),
    accountCreatedAt: new Date(member.user.createdTimestamp).toISOString()
  };
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      const invites = await member.guild.invites.fetch();
      const cachedInvites = client.invites?.get(member.guild.id) || new Map();
      
      let inviter = null;
      
      for (const [code, invite] of invites) {
        const cachedInvite = cachedInvites.get(code);
        if (cachedInvite && invite.uses > cachedInvite.uses) {
          inviter = invite.inviter?.id;
          break;
        }
      }

      if (!client.invites) client.invites = new Map();
      client.invites.set(member.guild.id, invites);

      const userStmt = db.prepare(`
        INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)
      `);
      userStmt.run(member.id, member.user.username);

      if (inviter) {
        const inviterStmt = db.prepare(`
          INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)
        `);
        const inviterUser = invites.find(inv => inv.inviter?.id === inviter)?.inviter;
        if (inviterUser) {
          inviterStmt.run(inviter, inviterUser.username);
        }
      }

      const fakeCheck = detectFakeInvite(member);

      const stmt = db.prepare(`
        INSERT INTO invites (user_id, inviter_id, joined_at, account_created_at, has_default_avatar, is_fake) 
        VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
      `);
      stmt.run(member.id, inviter, fakeCheck.accountCreatedAt, fakeCheck.hasDefaultAvatar ? 1 : 0, fakeCheck.isFake ? 1 : 0);

      const autoRoleId = '1427341809570418873';
      try {
        await member.roles.add(autoRoleId);
      } catch (error) {
        console.error('Failed to add auto-role:', error);
      }

      const welcomeChannelId = process.env.WELCOME_CHANNEL;
      if (welcomeChannelId) {
        try {
          const welcomeChannel = await client.channels.fetch(welcomeChannelId);
          const { createEmbed } = require('../utils/embeds');
          const embed = createEmbed({
            title: '👋 Welcome to ClipHub!',
            description: `Welcome ${member.user}! We're glad to have you here.\n\nGet started by checking <#1427291710043459701> and join our active campaigns!`,
            fields: [
              { name: '👥 Member Count', value: `You are member #${member.guild.memberCount}`, inline: true },
              { name: '📅 Account Age', value: `${Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24))} days old`, inline: true }
            ],
            color: 0xE31E24,
            thumbnail: { url: member.user.displayAvatarURL() },
            footer: { text: 'ClipHub Bot' }
          });
          await welcomeChannel.send({ embeds: [embed] });
        } catch (error) {
          console.error('Failed to send welcome message:', error);
        }
      }

      await logInvite(client, 'Joined', member.user, inviter, fakeCheck.isFake);
    } catch (error) {
      console.error('Error in guildMemberAdd:', error);
    }
  }
};
