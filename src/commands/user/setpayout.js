const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpayout')
    .setDescription('Set your payout information')
    .addStringOption(option =>
      option.setName('method')
        .setDescription('Payout method (UPI, PayPal, Solana, etc.)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('address')
        .setDescription('Your payout address/ID')
        .setRequired(true)),

  async execute(interaction) {
    const method = interaction.options.getString('method');
    const address = interaction.options.getString('address');
    const userId = interaction.user.id;

    try {
      const stmt = db.prepare(`
        INSERT INTO users (user_id, username, payout_method, payout_address) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET 
          payout_method = excluded.payout_method,
          payout_address = excluded.payout_address
      `);

      stmt.run(userId, interaction.user.tag, method, address);

      await interaction.reply({
        embeds: [successEmbed(
          'Payout Info Saved',
          `Your payout information has been updated!\n\n` +
          `💳 Method: ${method}\n` +
          `📬 Address: ${address}`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Set payout error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to save payout information.')],
        ephemeral: true
      });
      }
    }
  }
};
