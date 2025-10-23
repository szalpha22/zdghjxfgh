const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to timeout')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for timeout')
        .setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.moderatable) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Timeout', 'I do not have permission to timeout this member.')],
          ephemeral: true
        });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Timeout', 'You cannot timeout this member due to role hierarchy.')],
          ephemeral: true
        });
      }

      await member.timeout(duration * 60 * 1000, reason);

      const stmt = db.prepare(`
        INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason, duration)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run('timeout', user.id, interaction.user.id, reason, duration);

      await logModeration(interaction.client, 'Timed Out', user, interaction.user, reason, `${duration} minutes`);

      await interaction.reply({
        embeds: [successEmbed('Member Timed Out', `${user.tag} has been timed out for ${duration} minutes.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Timeout error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to timeout member.')],
        ephemeral: true
      });
      }
    }
  }
};
