const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('Slowmode duration in seconds (0 to disable)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to set slowmode (defaults to current)')
        .setRequired(false)),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds);

      const message = seconds === 0 
        ? `Slowmode disabled in ${channel}`
        : `Slowmode set to ${seconds} second${seconds !== 1 ? 's' : ''} in ${channel}`;

      await interaction.reply({
        embeds: [successEmbed('Slowmode Updated', message)]
      });

    } catch (error) {
      console.error('Slowmode error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to set slowmode.')],
        ephemeral: true
      });
      }
    }
  }
};
