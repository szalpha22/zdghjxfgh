const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/init');
const { successEmbed, errorEmbed, ticketEmbed } = require('../utils/embeds');
const { dmTicketCreated } = require('../utils/dmHandler');
const { logTicket } = require('../utils/logger');

async function handleTicketOpen(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const ticketType = interaction.customId.replace('open_ticket_', '');

    const existing = db.prepare('SELECT id FROM tickets WHERE user_id = ? AND status = ?')
      .get(userId, 'open');

    if (existing) {
      return await interaction.editReply({
        embeds: [errorEmbed('Ticket Exists', 'You already have an open ticket!')]
      });
    }

    const user = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId);
    if (!user) {
      const insertUser = db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)');
      insertUser.run(userId, username);
    }

    const ticketCategory = process.env.TICKET_CATEGORY;
    const staffRole = process.env.STAFF_ROLE;

    const stmt = db.prepare(`
      INSERT INTO tickets (user_id, type, status) 
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(userId, ticketType, 'open');
    const ticketId = result.lastInsertRowid;

    const channel = await interaction.guild.channels.create({
      name: `ticket-${ticketId}`,
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

    const updateStmt = db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?');
    updateStmt.run(channel.id, ticketId);

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);

    const embed = ticketEmbed(ticket, interaction.user);
    const closeButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`close_ticket_${ticketId}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

    await channel.send({
      content: `<@${userId}> ${staffRole ? `<@&${staffRole}>` : ''}`,
      embeds: [embed],
      components: [closeButton]
    });

    await dmTicketCreated(interaction.user, ticket);
    await logTicket(client, 'Created', ticket, interaction.user);

    await interaction.editReply({
      embeds: [successEmbed('Ticket Created', `Your ${ticketType} ticket has been created: <#${channel.id}>`)]
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to create ticket.')]
    });
  }
}

module.exports = {
  handleTicketOpen
};
