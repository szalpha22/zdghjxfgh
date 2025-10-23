const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banclipper')
    .setDescription('Ban a user from submitting clips')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');

    try {
      const stmt = db.prepare(`
        INSERT INTO users (user_id, username, banned) 
        VALUES (?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET banned = 1
      `);
      stmt.run(user.id, user.tag);

      await interaction.reply({
        embeds: [successEmbed('User Banned', `${user.tag} has been banned from submitting clips.`)],
        ephemeral: true
      });

    } catch (error) {
      console.error('Ban user error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to ban user.')],
        ephemeral: true
      });
      }
    }
  }
};
