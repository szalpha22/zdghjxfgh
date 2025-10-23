const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { createEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check warnings for')
        .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');

    try {
      const warnings = db.prepare(`
        SELECT id, moderator_id, reason, created_at
        FROM warnings
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all(user.id);

      if (warnings.length === 0) {
        return await interaction.reply({
          embeds: [createEmbed({
            title: '⚠️ Warnings',
            description: `${user.tag} has no warnings.`,
            color: 0xE31E24
          })],
          ephemeral: true
        });
      }

      const fields = warnings.map(w => ({
        name: `Warning #${w.id}`,
        value: `**Moderator:** <@${w.moderator_id}>\n**Reason:** ${w.reason}\n**Date:** ${new Date(w.created_at).toLocaleString()}`,
        inline: false
      }));

      const embed = createEmbed({
        title: `⚠️ Warnings for ${user.tag}`,
        description: `Total warnings: ${warnings.length}`,
        fields,
        color: 0xE31E24
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Warnings error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to load warnings.')],
        ephemeral: true
      });
      }
    }
  }
};
