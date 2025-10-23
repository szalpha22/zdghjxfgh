const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('User ID to unban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for unbanning')
        .setRequired(false)),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
      
      if (!ban) {
        return await interaction.reply({
          embeds: [errorEmbed('Not Banned', 'This user is not banned.')],
          ephemeral: true
        });
      }

      await interaction.guild.members.unban(userId, reason);

      const stmt = db.prepare(`
        INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run('unban', userId, interaction.user.id, reason);

      await logModeration(interaction.client, 'Unbanned', ban.user, interaction.user, reason);

      await interaction.reply({
        embeds: [successEmbed('Member Unbanned', `${ban.user.tag} has been unbanned.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Unban error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to unban user.')],
        ephemeral: true
      });
      }
    }
  }
};
