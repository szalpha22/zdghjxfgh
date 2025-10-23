const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { dmTicketCreated } = require('../../utils/dmHandler');
const { logPayout, logTicket } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('requestpayout')
    .setDescription('Request a payout for a campaign')
    .addStringOption(option =>
      option.setName('campaign')
        .setDescription('Campaign name')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('amount')
        .setDescription('Payout amount in USD')
        .setRequired(true)
        .setMinValue(0.01))
    .addAttachmentOption(option =>
      option.setName('analytics')
        .setDescription('Analytics proof video (.mp4 required)')
        .setRequired(true)),

  async execute(interaction) {
    const campaignName = interaction.options.getString('campaign');
    const amount = interaction.options.getNumber('amount');
    const analytics = interaction.options.getAttachment('analytics');
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

      if (!user || !user.payout_method || !user.payout_address) {
        return await interaction.editReply({
          embeds: [errorEmbed('Setup Required', 'Please set up your payout info first using `/setpayout`')]
        });
      }

      if (user.banned) {
        return await interaction.editReply({
          embeds: [errorEmbed('Banned', 'You are banned from requesting payouts.')]
        });
      }

      const balance = user.balance || 0;
      if (amount > balance) {
        return await interaction.editReply({
          embeds: [errorEmbed('Insufficient Balance', `You cannot request more than your available balance.\n**Your Balance:** $${balance.toFixed(2)}\n**Requested:** $${amount.toFixed(2)}`)]
        });
      }

      if (!analytics.contentType?.includes('video')) {
        return await interaction.editReply({
          embeds: [errorEmbed('Invalid File', 'Analytics proof must be a video file (.mp4)')]
        });
      }

      const campaign = db.prepare('SELECT * FROM campaigns WHERE name = ?').get(campaignName);

      if (!campaign) {
        return await interaction.editReply({
          embeds: [errorEmbed('Invalid Campaign', 'Campaign not found.')]
        });
      }

      const stmt = db.prepare(`
        INSERT INTO payouts (user_id, campaign_id, amount, analytics_proof, status)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(userId, campaign.id, amount, analytics.url, 'pending');
      const payoutId = result.lastInsertRowid;

      // Deduct balance when payout is requested
      const deductBalanceStmt = db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ?');
      deductBalanceStmt.run(amount, userId);

      const ticketStmt = db.prepare(`
        INSERT INTO tickets (user_id, type, related_id, status)
        VALUES (?, ?, ?, ?)
      `);

      const ticketResult = ticketStmt.run(userId, 'payout_verification', payoutId, 'open');
      const ticketId = ticketResult.lastInsertRowid;

      const updatePayout = db.prepare('UPDATE payouts SET ticket_id = ? WHERE id = ?');
      updatePayout.run(ticketId, payoutId);

      const ticketCategory = process.env.TICKET_CATEGORY;
      const staffRole = process.env.STAFF_ROLE;

      const channel = await interaction.guild.channels.create({
        name: `payout-${ticketId}`,
        type: ChannelType.GuildText,
        parent: ticketCategory || null,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: userId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
          }
        ]
      });

      if (staffRole) {
        await channel.permissionOverwrites.create(staffRole, {
          ViewChannel: true,
          SendMessages: true
        });
      }

      const channelUpdate = db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?');
      channelUpdate.run(channel.id, ticketId);

      const payout = db.prepare('SELECT * FROM payouts WHERE id = ?').get(payoutId);
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);

      const actionButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_payout_${payoutId}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`reject_payout_${payoutId}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌'),
          new ButtonBuilder()
            .setCustomId(`close_ticket_${ticketId}`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔒')
        );

      await channel.send({
        content: `<@${userId}> ${staffRole ? `<@&${staffRole}>` : ''}`,
        embeds: [successEmbed(
          `Payout Request #${payoutId}`,
          `**Campaign:** ${campaign.name}\n` +
          `**Amount:** $${amount.toFixed(2)}\n` +
          `**Method:** ${user.payout_method}\n` +
          `**Address:** ${user.payout_address}\n` +
          `**Ticket ID:** #${ticketId}\n\n` +
          `[Analytics Proof](${analytics.url})`
        )],
        components: [actionButtons]
      });

      await dmTicketCreated(interaction.user, ticket);
      await logPayout(interaction.client, 'Requested', payout, interaction.user);
      await logTicket(interaction.client, 'Created', ticket, interaction.user);

      await interaction.editReply({
        embeds: [successEmbed(
          'Payout Request Submitted',
          `Your payout request has been submitted for review!\n\n` +
          `📹 Campaign: ${campaign.name}\n` +
          `💰 Amount: $${amount.toFixed(2)}\n` +
          `🎟️ Ticket: <#${channel.id}>`
        )]
      });

    } catch (error) {
      console.error('Request payout error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to submit payout request.')]
      });
    }
  }
};
