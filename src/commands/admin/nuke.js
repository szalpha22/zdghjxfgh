const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { generateNukeId, backupMessages, backupDatabase, saveNukeBackup } = require('../../utils/nukeUtils');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Nuclear option: Delete and recreate a channel (UNLIMITED USE)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to nuke (defaults to current channel)')
        .setRequired(false)),

  async execute(interaction) {
    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const nukeMasterRoleId = process.env.NUKE_MASTER_ROLE_ID;
    const hasNukeMasterRole = nukeMasterRoleId && interaction.member.roles.cache.has(nukeMasterRoleId);

    if (!isOwner && !hasNukeMasterRole) {
      return await interaction.reply({
        embeds: [errorEmbed('Unauthorized', 'Only the server owner or users with NUKE_MASTER_ROLE can use this command.')],
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('nuke_confirm')
      .setTitle('⚠️ CONFIRM CHANNEL NUKE');

    const reasonInput = new TextInputBuilder()
      .setCustomId('nuke_reason')
      .setLabel('Reason for Nuke')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter detailed reason for nuking this channel')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    const pinInput = new TextInputBuilder()
      .setCustomId('nuke_pin')
      .setLabel('Confirmation PIN')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter "NUKE" to confirm (all caps)')
      .setRequired(true)
      .setMinLength(4)
      .setMaxLength(4);

    const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
    const pinRow = new ActionRowBuilder().addComponents(pinInput);

    modal.addComponents(reasonRow, pinRow);

    await interaction.showModal(modal);

    const filter = (i) => i.customId === 'nuke_confirm' && i.user.id === interaction.user.id;
    
    try {
      const modalSubmit = await interaction.awaitModalSubmit({ filter, time: 120000 });
      
      const reason = modalSubmit.fields.getTextInputValue('nuke_reason');
      const pin = modalSubmit.fields.getTextInputValue('nuke_pin');

      if (pin !== 'NUKE') {
        return await modalSubmit.reply({
          embeds: [errorEmbed('Invalid PIN', 'The confirmation PIN must be exactly "NUKE" (all caps).')],
          ephemeral: true
        });
      }

      await modalSubmit.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const nukeId = generateNukeId();

      await modalSubmit.editReply({
        embeds: [createEmbed({
          title: '⏳ Preparing Nuke...',
          description: `**Nuke ID:** \`${nukeId}\`\n\nBacking up messages and database...`,
          color: 0xB91419
        })]
      });

      const messagesBackup = await backupMessages(channel, 1000);
      const dbBackupPath = backupDatabase();

      const channelData = {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        topic: channel.topic,
        nsfw: channel.nsfw,
        parentId: channel.parentId,
        position: channel.position,
        rateLimitPerUser: channel.rateLimitPerUser,
        permissionOverwrites: channel.permissionOverwrites.cache.map(po => ({
          id: po.id,
          type: po.type,
          allow: po.allow.bitfield.toString(),
          deny: po.deny.bitfield.toString()
        }))
      };

      const backupPath = await saveNukeBackup(nukeId, channelData, messagesBackup, dbBackupPath, interaction.user, reason);

      const logChannel = await interaction.client.channels.fetch(process.env.COMMAND_LOGS_CHANNEL).catch(() => null);
      if (logChannel) {
        const logEmbed = createEmbed({
          title: '💣 CHANNEL NUKED',
          fields: [
            { name: 'Nuke ID', value: `\`${nukeId}\``, inline: true },
            { name: 'Channel', value: `#${channel.name} (${channel.id})`, inline: true },
            { name: 'Executor', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Messages Backed Up', value: `${messagesBackup.length}`, inline: true },
            { name: 'Database Backed Up', value: dbBackupPath ? 'Yes' : 'No', inline: true },
            { name: 'Backup Location', value: `\`${backupPath}\``, inline: false }
          ],
          color: 0x8B0F14,
          timestamp: true
        });
        await logChannel.send({ embeds: [logEmbed] });
      }

      const newChannel = await channel.clone({
        name: channel.name,
        reason: `Nuked by ${interaction.user.tag} | Nuke ID: ${nukeId}`
      });

      await newChannel.setPosition(channel.position);

      for (const po of channelData.permissionOverwrites) {
        try {
          await newChannel.permissionOverwrites.create(po.id, {
            allow: BigInt(po.allow),
            deny: BigInt(po.deny)
          });
        } catch (e) {
          console.error('Error setting permission:', e);
        }
      }

      await channel.delete(`Nuked by ${interaction.user.tag} | Nuke ID: ${nukeId}`);

      const nukeEmbed = createEmbed({
        title: '💥 CHANNEL NUKED',
        description: `This channel has been completely reset.`,
        fields: [
          { name: 'Nuke ID', value: `\`${nukeId}\``, inline: true },
          { name: 'Executed By', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: '📦 Backup', value: `${messagesBackup.length} messages saved`, inline: true },
          { name: '🔄 Recovery', value: `Use \`/nukeinfo ${nukeId}\` for details`, inline: true }
        ],
        color: 0x8B0F14,
        footer: { text: `All data has been backed up • Nuke ID: ${nukeId}` },
        timestamp: true
      });

      await newChannel.send({ embeds: [nukeEmbed] });

    } catch (error) {
      if (error.code === 'InteractionCollectorError') {
        return;
      }
      console.error('Nuke error:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          embeds: [errorEmbed('Nuke Failed', 'An error occurred while nuking the channel.')]
        }).catch(() => {});
      }
    }
  }
};
