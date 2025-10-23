const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { getNukeInfo } = require('../../utils/nukeUtils');
const { createEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nukeinfo')
    .setDescription('Get information about a nuke operation')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('nuke_id')
        .setDescription('The Nuke ID to look up')
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
      title: `💣 Nuke Information - ${nukeId}`,
      fields: [
        { name: 'Channel Name', value: nukeInfo.channel_name, inline: true },
        { name: 'Channel ID', value: nukeInfo.channel_id, inline: true },
        { name: 'Executed By', value: `<@${nukeInfo.executor_id}>`, inline: true },
        { name: 'Timestamp', value: `<t:${Math.floor(new Date(nukeInfo.timestamp).getTime() / 1000)}:F>`, inline: true },
        { name: 'Messages Backed Up', value: `${nukeInfo.message_count}`, inline: true },
        { name: 'Reason', value: nukeInfo.reason || 'No reason provided', inline: false },
        { name: 'Backup Path', value: `\`${nukeInfo.backup_path}\``, inline: false },
        { name: 'DB Backup', value: nukeInfo.db_backup_path ? `\`${nukeInfo.db_backup_path}\`` : 'None', inline: false }
      ],
      color: 0xB91419,
      footer: { text: 'Use /restorenuke to restore this channel' }
    });

    const components = [];

    if (nukeInfo.backupData) {
      const transcript = JSON.stringify(nukeInfo.backupData, null, 2);
      const attachment = new AttachmentBuilder(Buffer.from(transcript), { 
        name: `${nukeId}-transcript.json` 
      });
      components.push(attachment);
    }

    await interaction.editReply({ 
      embeds: [embed],
      files: components.length > 0 ? components : undefined
    });
  }
};
