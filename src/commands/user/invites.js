const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { createEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check invite count for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check invites for')
        .setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;

    try {
      const totalInvites = db.prepare('SELECT COUNT(*) as count FROM invites WHERE inviter_id = ?').get(userId);
      const leftCount = db.prepare('SELECT COUNT(*) as count FROM invites WHERE inviter_id = ? AND left_at IS NOT NULL').get(userId);
      const fakeCount = db.prepare('SELECT COUNT(*) as count FROM invites WHERE inviter_id = ? AND is_fake = 1').get(userId);
      
      const total = totalInvites?.count || 0;
      const left = leftCount?.count || 0;
      const fake = fakeCount?.count || 0;
      const current = total - left;

      const embed = createEmbed({
        title: '📨 Invite Stats',
        description: `Invite statistics for ${targetUser}`,
        fields: [
          { name: 'Total Invited', value: `${total}`, inline: true },
          { name: 'Currently In Server', value: `${current}`, inline: true },
          { name: 'Left Server', value: `${left}`, inline: true },
          { name: 'Fake Invites', value: `${fake} ⚠️`, inline: true },
          { name: 'Real Invites', value: `${total - fake}`, inline: true }
        ],
        thumbnail: { url: targetUser.displayAvatarURL() },
        color: 0xE31E24
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Invites error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [errorEmbed('Error', 'Failed to load invites.')],
          ephemeral: true
        });
      }
    }
  }
};
