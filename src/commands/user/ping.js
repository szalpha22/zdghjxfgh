const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),

  async execute(interaction) {
    try {
      const embed = createEmbed({
        title: '🏓 Pong!',
        description: `Bot Latency: ${Math.round(interaction.client.ws.ping)}ms`,
        color: 0xE31E24
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in ping command:', error);
      const errorMessage = { content: '❌ An error occurred while checking bot latency.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
