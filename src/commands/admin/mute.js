const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member (timeout indefinitely)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to mute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for muting')
        .setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.moderatable) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Mute', 'I do not have permission to mute this member.')],
          ephemeral: true
        });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Mute', 'You cannot mute this member due to role hierarchy.')],
          ephemeral: true
        });
      }

      await member.timeout(28 * 24 * 60 * 60 * 1000, reason);

      const stmt = db.prepare(`
        INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run('mute', user.id, interaction.user.id, reason);

      await logModeration(interaction.client, 'Muted', user, interaction.user, reason, '28 days');

      await interaction.reply({
        embeds: [successEmbed('Member Muted', `${user.tag} has been muted.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Mute error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to mute member.')],
        ephemeral: true
      });
      }
    }
  }
};
