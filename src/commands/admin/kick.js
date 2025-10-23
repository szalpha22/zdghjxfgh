const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for kicking')
        .setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.kickable) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Kick', 'I do not have permission to kick this member.')],
          ephemeral: true
        });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Kick', 'You cannot kick this member due to role hierarchy.')],
          ephemeral: true
        });
      }

      await member.kick(reason);

      const stmt = db.prepare(`
        INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run('kick', user.id, interaction.user.id, reason);

      await logModeration(interaction.client, 'Kicked', user, interaction.user, reason);

      await interaction.reply({
        embeds: [successEmbed('Member Kicked', `${user.tag} has been kicked.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Kick error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to kick member.')],
        ephemeral: true
      });
      }
    }
  }
};
