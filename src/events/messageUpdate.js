const { createEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (newMessage.author?.bot) return;
    if (!newMessage.guild) return;
    if (oldMessage.content === newMessage.content) return;

    const channelId = process.env.MESSAGE_LOGS_CHANNEL;
    if (!channelId) return;

    try {
      const channel = await newMessage.client.channels.fetch(channelId);
      
      const embed = createEmbed({
        title: '✏️ Message Edited',
        fields: [
          { name: 'Author', value: `<@${newMessage.author.id}>`, inline: true },
          { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
          { name: 'Before', value: oldMessage.content?.substring(0, 500) || '*No content*', inline: false },
          { name: 'After', value: newMessage.content?.substring(0, 500) || '*No content*', inline: false },
          { name: 'Jump to Message', value: `[Click here](${newMessage.url})`, inline: false }
        ],
        footer: { text: `Message ID: ${newMessage.id}` },
        color: COLORS.WARNING
      });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error logging edited message:', error);
    }
  }
};
