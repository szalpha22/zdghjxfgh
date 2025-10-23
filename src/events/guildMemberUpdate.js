const { createEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const channelId = process.env.MEMBER_LOGS_CHANNEL;
    if (!channelId) return;

    try {
      const changes = [];

      if (oldMember.nickname !== newMember.nickname) {
        changes.push({
          name: 'Nickname Changed',
          value: `**Before:** ${oldMember.nickname || '*None*'}\n**After:** ${newMember.nickname || '*None*'}`,
          inline: false
        });
      }

      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

      if (addedRoles.size > 0) {
        changes.push({
          name: 'Roles Added',
          value: addedRoles.map(role => `<@&${role.id}>`).join(', '),
          inline: false
        });
      }

      if (removedRoles.size > 0) {
        changes.push({
          name: 'Roles Removed',
          value: removedRoles.map(role => `<@&${role.id}>`).join(', '),
          inline: false
        });
      }

      if (changes.length === 0) return;

      const channel = await newMember.client.channels.fetch(channelId);
      
      const embed = createEmbed({
        title: '👤 Member Updated',
        description: `<@${newMember.id}>`,
        fields: changes,
        thumbnail: { url: newMember.user.displayAvatarURL() },
        color: COLORS.INFO
      });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error logging member update:', error);
    }
  }
};
