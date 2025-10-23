const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display server information'),

  async execute(interaction) {
    try {
      const { guild } = interaction;
      await guild.fetch();

    const embed = createEmbed({
      title: `Server Information - ${guild.name}`,
      thumbnail: { url: guild.iconURL({ dynamic: true }) || undefined },
      fields: [
        { name: 'Server ID', value: guild.id, inline: true },
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Boosts', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: true },
        { name: 'Verification Level', value: guild.verificationLevel.toString(), inline: true },
        { name: 'Region', value: guild.preferredLocale || 'Unknown', inline: true }
      ],
      color: 0xE31E24
    });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in serverinfo command:', error);
      const errorMessage = { content: '❌ An error occurred while fetching server information.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
