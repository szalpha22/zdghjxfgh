const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getNukeInfo } = require('../../utils/nukeUtils');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restorenuke')
    .setDescription('View restoration info for a nuked channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('nuke_id')
        .setDescription('The Nuke ID to restore')
        .setRequired(true)),

  async execute(interaction) {
    const nukeId = interaction.options.getString('nuke_id');

    await interaction.deferReply({ ephemeral: true });

    const nukeInfo = getNukeInfo(nukeId);

    if (!nukeInfo) {
      return await interaction.editReply({
        embeds: [errorEmbed('Not Found', `No nuke operation found with ID \`${nukeId}\``)]
      });
    }

    const embed = createEmbed({
      title: '🔄 Nuke Restoration Information',
      description: `**Nuke ID:** \`${nukeId}\`\n\nBackup data is available for this nuked channel.`,
      fields: [
        { name: 'Channel Name', value: nukeInfo.channel_name, inline: true },
        { name: 'Messages Backed Up', value: `${nukeInfo.message_count}`, inline: true },
        { name: 'Nuked At', value: `<t:${Math.floor(new Date(nukeInfo.timestamp).getTime() / 1000)}:R>`, inline: true },
        { name: '📦 Backup Locations', value: 
          `**Messages:** \`${nukeInfo.backup_path}\`\n` +
          `**Database:** \`${nukeInfo.db_backup_path || 'None'}\``, 
          inline: false 
        },
        { name: '⚠️ Manual Restoration Required', value: 
          'Automatic channel restoration is not supported. Use the backup files to manually review and restore content as needed.\n\n' +
          '**Database Restoration:**\n' +
          '1. Stop the bot\n' +
          '2. Replace `clipmaster.db` with the backup\n' +
          '3. Restart the bot\n\n' +
          '**Message Restoration:**\n' +
          'Review the JSON transcript to see deleted messages.',
          inline: false 
        }
      ],
      color: 0xE31E24,
      footer: { text: 'All backups are stored in /backups/nukes/' }
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
