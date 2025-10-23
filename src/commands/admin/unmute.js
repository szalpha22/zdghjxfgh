const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to unmute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for unmuting')
        .setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.isCommunicationDisabled()) {
        return await interaction.reply({
          embeds: [errorEmbed('Not Muted', 'This member is not muted.')],
          ephemeral: true
        });
      }

      await member.timeout(null, reason);

      const stmt = db.prepare(`
        INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run('unmute', user.id, interaction.user.id, reason);

      await logModeration(interaction.client, 'Unmuted', user, interaction.user, reason);

      await interaction.reply({
        embeds: [successEmbed('Member Unmuted', `${user.tag} has been unmuted.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Unmute error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to unmute member.')],
        ephemeral: true
      });
      }
    }
  }
};
