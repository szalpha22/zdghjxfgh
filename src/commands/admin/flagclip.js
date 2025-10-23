const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logFlagged, logTicket } = require('../../utils/logger');
const { dmSubmissionFlagged, dmTicketCreated } = require('../../utils/dmHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flagclip')
    .setDescription('Manually flag a submission')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('link')
        .setDescription('Video link to flag')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Flag reason')
        .setRequired(true)),

  async execute(interaction) {
    const link = interaction.options.getString('link');
    const reason = interaction.options.getString('reason');

    await interaction.deferReply({ ephemeral: true });

    try {
      const submission = db.prepare('SELECT * FROM submissions WHERE video_link = ?').get(link);

      if (!submission) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Submission not found with that link.')]
        });
      }

      const stmt = db.prepare('UPDATE submissions SET flagged = 1, flag_reason = ? WHERE id = ?');
      stmt.run(reason, submission.id);

      const user = await interaction.client.users.fetch(submission.user_id);

      await dmSubmissionFlagged(user, submission, reason);
      await logFlagged(interaction.client, submission, reason, interaction.user);

      const ticketStmt = db.prepare(`
        INSERT INTO tickets (user_id, type, related_id, status)
        VALUES (?, ?, ?, ?)
      `);
      const ticketResult = ticketStmt.run(submission.user_id, 'flagged_submission', submission.id, 'open');

      const ticketCategory = process.env.TICKET_CATEGORY;
      const staffRole = process.env.STAFF_ROLE;

      const channel = await interaction.guild.channels.create({
        name: `flag-${ticketResult.lastInsertRowid}`,
        type: ChannelType.GuildText,
        parent: ticketCategory || null,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel']
          },
          {
            id: submission.user_id,
            allow: ['ViewChannel', 'SendMessages']
          }
        ]
      });

      if (staffRole) {
        await channel.permissionOverwrites.create(staffRole, {
          ViewChannel: true,
          SendMessages: true
        });
      }

      const updateTicket = db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?');
      updateTicket.run(channel.id, ticketResult.lastInsertRowid);

      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketResult.lastInsertRowid);

      const actionButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_clip_${submission.id}`)
            .setLabel('Approve Clip')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`reject_clip_${submission.id}`)
            .setLabel('Reject Clip')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌'),
          new ButtonBuilder()
            .setCustomId(`close_ticket_${ticketResult.lastInsertRowid}`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔒')
        );

      await channel.send({
        content: `<@${submission.user_id}> ${staffRole ? `<@&${staffRole}>` : ''}`,
        embeds: [errorEmbed('Flagged Submission',
          `Your submission has been flagged for manual verification.\n\n` +
          `🔗 Link: ${submission.video_link}\n` +
          `📋 Reason: ${reason}\n\n` +
          `Please provide proof that this is your original content.`
        )],
        components: [actionButtons]
      });

      await dmTicketCreated(user, ticket);
      await logTicket(interaction.client, 'Created', ticket, user);

      await interaction.editReply({
        embeds: [successEmbed('Clip Flagged', `Submission has been flagged and a verification ticket has been created: <#${channel.id}>`)]
      });

    } catch (error) {
      console.error('Flag clip error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to flag submission.')]
      });
    }
  }
};
