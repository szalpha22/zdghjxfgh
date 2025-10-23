const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages from the channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    try {
      let deletedCount = 0;

      if (targetUser) {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(msg => msg.author.id === targetUser.id).first(amount);
        
        for (const msg of userMessages.values()) {
          await msg.delete();
          deletedCount++;
        }
      } else {
        const deleted = await interaction.channel.bulkDelete(amount, true);
        deletedCount = deleted.size;
      }

      await interaction.editReply({
        embeds: [successEmbed('Messages Cleared', `Successfully deleted ${deletedCount} message(s)${targetUser ? ` from ${targetUser.tag}` : ''}.`)]
      });

    } catch (error) {
      console.error('Clear error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to delete messages.')]
      });
    }
  }
};
