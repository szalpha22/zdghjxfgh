const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Display channel information')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to get information about')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('channel') || interaction.channel;

    const embed = createEmbed({
      title: `Channel Information - ${channel.name}`,
      fields: [
        { name: 'Channel ID', value: channel.id, inline: true },
        { name: 'Type', value: channel.type.toString(), inline: true },
        { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Category', value: channel.parent?.name || 'None', inline: true },
        { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
        { name: 'Position', value: `${channel.position}`, inline: true },
        { name: 'Topic', value: channel.topic || 'None', inline: false }
      ],
      color: 0xE31E24
    });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in channelinfo command:', error);
      const errorMessage = { content: '❌ An error occurred while fetching channel information.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
