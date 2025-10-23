const { SlashCommandBuilder, version: djsVersion } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display bot information'),

  async execute(interaction) {
    try {
      const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const embed = createEmbed({
      title: '🤖 ClipHub Bot Information',
      thumbnail: { url: interaction.client.user.displayAvatarURL() },
      fields: [
        { name: 'Bot Name', value: interaction.client.user.tag, inline: true },
        { name: 'Bot ID', value: interaction.client.user.id, inline: true },
        { name: 'Created', value: `<t:${Math.floor(interaction.client.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Servers', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: 'Commands', value: `${interaction.client.commands.size}`, inline: true },
        { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
        { name: 'Memory Usage', value: `${memoryUsage} MB`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Discord.js', value: `v${djsVersion}`, inline: true },
        { name: 'Platform', value: `${os.platform()} (${os.arch()})`, inline: true },
        { name: 'CPU', value: os.cpus()[0].model, inline: false }
      ],
      color: 0xE31E24
    });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in botinfo command:', error);
      const errorMessage = { content: '❌ An error occurred while fetching bot information.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
