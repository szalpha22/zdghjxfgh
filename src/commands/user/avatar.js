const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display user avatar')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to get avatar of')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user') || interaction.user;

    const embed = createEmbed({
      title: `${user.tag}'s Avatar`,
      image: { url: user.displayAvatarURL({ size: 1024, dynamic: true }) },
      description: `[Download](${user.displayAvatarURL({ size: 1024, dynamic: true })})`,
      color: 0xE31E24
    });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in avatar command:', error);
      const errorMessage = { content: '❌ An error occurred while fetching avatar.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
