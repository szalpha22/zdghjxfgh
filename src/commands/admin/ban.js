const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for banning')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      
      if (member) {
        if (!member.bannable) {
          return await interaction.reply({
            embeds: [errorEmbed('Cannot Ban', 'I do not have permission to ban this member.')],
            ephemeral: true
          });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          return await interaction.reply({
            embeds: [errorEmbed('Cannot Ban', 'You cannot ban this member due to role hierarchy.')],
            ephemeral: true
          });
        }
      }

      await interaction.guild.members.ban(user, { 
        reason: reason,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60
      });

      const stmt = db.prepare(`
        INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run('ban', user.id, interaction.user.id, reason);

      await logModeration(interaction.client, 'Banned', user, interaction.user, reason);

      await interaction.reply({
        embeds: [successEmbed('Member Banned', `${user.tag} has been banned.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Ban error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to ban member.')],
        ephemeral: true
      });
      }
    }
  }
};
