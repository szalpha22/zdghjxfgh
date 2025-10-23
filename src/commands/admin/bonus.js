const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bonus')
    .setDescription('Grant bonus to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to grant bonus')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('amount')
        .setDescription('Bonus amount in USD')
        .setRequired(true)
        .setMinValue(0.01)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');

    try {
      const stmt = db.prepare(`
        INSERT INTO users (user_id, username, bonus_amount) 
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET bonus_amount = bonus_amount + ?
      `);
      stmt.run(user.id, user.tag, amount, amount);

      await interaction.reply({
        embeds: [successEmbed('Bonus Granted', `$${amount.toFixed(2)} bonus has been granted to ${user.tag}!`)],
        ephemeral: true
      });

    } catch (error) {
      console.error('Bonus error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to grant bonus.')],
        ephemeral: true
      });
      }
    }
  }
};
