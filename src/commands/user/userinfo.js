const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display user information')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to get information about')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const roles = member?.roles.cache
      .filter(role => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => role.toString())
      .slice(0, 20)
      .join(', ') || 'None';

    const embed = createEmbed({
      title: `User Information - ${user.tag}`,
      thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
      fields: [
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joined Server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Not in server', inline: true },
        { name: 'Nickname', value: member?.nickname || 'None', inline: true },
        { name: 'Highest Role', value: member?.roles.highest.toString() || 'None', inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: `Roles [${member?.roles.cache.size - 1 || 0}]`, value: roles, inline: false }
      ],
      color: member?.displayHexColor || 0xE31E24
    });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in userinfo command:', error);
      const errorMessage = { content: '❌ An error occurred while fetching user information.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
