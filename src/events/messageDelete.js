const { createEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (message.author?.bot) return;
    if (!message.guild) return;

    const channelId = process.env.MESSAGE_LOGS_CHANNEL;
    if (!channelId) return;

    try {
      const channel = await message.client.channels.fetch(channelId);
      
      const embed = createEmbed({
        title: '🗑️ Message Deleted',
        fields: [
          { name: 'Author', value: `<@${message.author?.id}>`, inline: true },
          { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
          { name: 'Content', value: message.content?.substring(0, 1000) || '*No content*', inline: false }
        ],
        footer: { text: `Message ID: ${message.id}` },
        color: COLORS.ERROR
      });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error logging deleted message:', error);
    }
  }
};
