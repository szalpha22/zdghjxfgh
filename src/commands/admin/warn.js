const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for warning')
        .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    try {
      const stmt = db.prepare(`
        INSERT INTO warnings (user_id, moderator_id, reason)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(user.id, interaction.user.id, reason);

      const warnCount = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE user_id = ?').get(user.id);

      const modStmt = db.prepare(`
        INSERT INTO moderation_logs (action_type, user_id, moderator_id, reason)
        VALUES (?, ?, ?, ?)
      `);
      modStmt.run('warn', user.id, interaction.user.id, reason);

      await logModeration(interaction.client, 'Warned', user, interaction.user, reason);

      try {
        const { createEmbed } = require('../../utils/embeds');
        const dmEmbed = createEmbed({
          title: '⚠️ Warning',
          description: `You have been warned in **${interaction.guild.name}**`,
          fields: [
            { name: 'Reason', value: reason, inline: false },
            { name: 'Total Warnings', value: `${warnCount.count}`, inline: true }
          ],
          color: 0xE31E24
        });
        await user.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log('Could not DM user');
      }

      await interaction.reply({
        embeds: [successEmbed('Member Warned', `${user.tag} has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${warnCount.count}`)]
      });

    } catch (error) {
      console.error('Warn error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to warn member.')],
        ephemeral: true
      });
      }
    }
  }
};
