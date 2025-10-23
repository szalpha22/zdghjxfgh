const { db } = require('../database/init');
const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function createVerificationTicket(client, userId, platform, accountHandle, accountUrl, verificationCode) {
  try {
    console.log(`🎫 Creating verification ticket for user ${userId}, platform: ${platform}`);
    
    const stmt = db.prepare(`
      INSERT INTO tickets (user_id, type, status, related_id) 
      VALUES (?, ?, ?, ?)
    `);
    
    const accountRecord = db.prepare('SELECT id FROM social_accounts WHERE user_id = ? AND platform = ?')
      .get(userId, platform);
    
    const result = stmt.run(userId, 'verification', 'open', accountRecord?.id || null);
    const ticketId = result.lastInsertRowid;

    db.prepare(`
      UPDATE social_accounts 
      SET verification_status = 'pending_manual'
      WHERE user_id = ? AND platform = ?
    `).run(userId, platform);

    console.log(`✅ Ticket #${ticketId} created in database, status set to pending_manual`);

    if (!client) {
      console.log('⚠️ Discord client not available (web request), ticket created but channel not created');
      return ticketId;
    }

    try {
      const guild = client.guilds.cache.first();
      if (!guild) {
        console.log('⚠️ No guild found');
        return ticketId;
      }

      const ticketCategory = process.env.TICKET_CATEGORY;
      const staffRole = process.env.STAFF_ROLE;

      // Create ticket channel
      const channel = await guild.channels.create({
        name: `ticket-${ticketId}-verification`,
        type: ChannelType.GuildText,
        parent: ticketCategory || null,
        permissionOverwrites: [
          {
            id: guild.id,
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

      // Update ticket with channel ID
      db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?').run(channel.id, ticketId);

      // Send verification info to ticket channel
      const embed = new EmbedBuilder()
        .setTitle('🎫 Account Verification - Manual Review')
        .setDescription(`Automatic verification failed for your ${platform} account. An admin will manually verify your account soon.`)
        .addFields(
          { name: '🎟️ Ticket ID', value: `#${ticketId}`, inline: true },
          { name: '📱 Platform', value: platform, inline: true },
          { name: '📝 Account Handle', value: accountHandle, inline: true },
          { name: '🔗 Profile URL', value: accountUrl, inline: false },
          { name: '🔑 Verification Code', value: `\`${verificationCode}\``, inline: false },
          { name: '❌ Reason', value: 'Could not fetch account bio automatically', inline: false },
          { name: '📋 Next Steps', value: `**For User:** Please ensure the verification code \`${verificationCode}\` is in your ${platform} bio/description.\n\n**For Staff:** Use \`/verifyuser @user ${platform.toLowerCase()}\` to manually verify this account after confirming the code is present.`, inline: false }
        )
        .setColor('#FFA500')
        .setTimestamp();

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

      console.log(`✅ Ticket channel created: ${channel.name} (#${ticketId})`);
    } catch (channelError) {
      console.error('⚠️ Failed to create ticket channel:', channelError.message);
    }

    return ticketId;
  } catch (error) {
    console.error('❌ Error creating auto-ticket:', error);
    return null;
  }
}

module.exports = { createVerificationTicket };
