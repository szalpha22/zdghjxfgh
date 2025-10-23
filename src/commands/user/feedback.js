const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Submit feedback or suggestions to the staff team'),

  async execute(interaction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId(`feedback_modal_${interaction.user.id}`)
        .setTitle('📝 Submit Feedback');

      const subjectInput = new TextInputBuilder()
        .setCustomId('feedback_subject')
        .setLabel('Subject')
        .setPlaceholder('Brief subject for your feedback')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const feedbackInput = new TextInputBuilder()
        .setCustomId('feedback_content')
        .setLabel('Your Feedback')
        .setPlaceholder('Share your thoughts, suggestions, or concerns...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const subjectRow = new ActionRowBuilder().addComponents(subjectInput);
      const feedbackRow = new ActionRowBuilder().addComponents(feedbackInput);

      modal.addComponents(subjectRow, feedbackRow);

      await interaction.showModal(modal);

      // Handle modal submission
      const filter = (i) => i.customId === `feedback_modal_${interaction.user.id}`;
      
      interaction.awaitModalSubmit({ filter, time: 300000 })
        .then(async (modalInteraction) => {
          const subject = modalInteraction.fields.getTextInputValue('feedback_subject');
          const content = modalInteraction.fields.getTextInputValue('feedback_content');

          // Send to support channel
          const supportChannelId = process.env.SUPPORT_CHANNEL;
          if (supportChannelId) {
            try {
              const supportChannel = await interaction.client.channels.fetch(supportChannelId);
              
              const feedbackEmbed = new EmbedBuilder()
                .setColor(0xE31E24)
                .setTitle('📝 New Feedback Received')
                .setDescription(`**Subject:** ${subject}`)
                .addFields(
                  { name: '👤 From', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                  { name: '💬 Feedback', value: content, inline: false },
                  { name: '📅 Submitted', value: new Date().toLocaleString(), inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: 'ClipHub Bot • Feedback System' })
                .setTimestamp();

              await supportChannel.send({ embeds: [feedbackEmbed] });
            } catch (error) {
              console.error('Failed to send feedback to support channel:', error);
            }
          }

          const confirmEmbed = new EmbedBuilder()
            .setColor(0xE31E24)
            .setTitle('✅ Feedback Submitted!')
            .setDescription('Thank you for your feedback! Our staff team will review it shortly.')
            .addFields(
              { name: 'Subject', value: subject, inline: false },
              { name: 'What happens next?', value: 'Staff will review your feedback and may reach out if they need more information.', inline: false }
            )
            .setFooter({ text: 'ClipHub Bot • We appreciate your input!' })
            .setTimestamp();

          await modalInteraction.reply({ embeds: [confirmEmbed], ephemeral: true });
        })
        .catch((error) => {
          if (error.code !== 'INTERACTION_COLLECTOR_ERROR') {
            console.error('Error handling feedback modal:', error);
          }
        });

    } catch (error) {
      console.error('Error in feedback command:', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ An error occurred while opening the feedback form.',
          ephemeral: true
        });
      }
    }
  }
};
