const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Check bot uptime'),

  async execute(interaction) {
    try {
      const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const embed = createEmbed({
      title: '⏱️ Bot Uptime',
      description: `**${days}** days, **${hours}** hours, **${minutes}** minutes, **${seconds}** seconds`,
      color: 0xE31E24
    });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in uptime command:', error);
      const errorMessage = { content: '❌ An error occurred while checking bot uptime.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
