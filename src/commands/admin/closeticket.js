const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logTicket } = require('../../utils/logger');
const { dmTicketClosed } = require('../../utils/dmHandler');

function generateHTMLTranscript(messages, ticket, channelName) {
  const messagesArray = Array.from(messages.values()).reverse();
  
  const messagesHTML = messagesArray.map(msg => {
    const timestamp = msg.createdAt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const avatarURL = msg.author.displayAvatarURL({ size: 64 });
    const isBot = msg.author.bot ? '<span class="bot-badge">BOT</span>' : '';
    
    let contentHTML = msg.content ? `<div class="message-content">${escapeHtml(msg.content)}</div>` : '';
    
    let attachmentsHTML = '';
    if (msg.attachments.size > 0) {
      attachmentsHTML = '<div class="attachments">';
      msg.attachments.forEach(att => {
        if (att.contentType && att.contentType.startsWith('image/')) {
          attachmentsHTML += `<div class="attachment"><img src="${att.url}" alt="${att.name}" style="max-width: 400px; border-radius: 4px;"><br><a href="${att.url}" target="_blank">${att.name}</a></div>`;
        } else {
          attachmentsHTML += `<div class="attachment">📎 <a href="${att.url}" target="_blank">${att.name}</a> (${formatBytes(att.size)})</div>`;
        }
      });
      attachmentsHTML += '</div>';
    }
    
    let embedsHTML = '';
    if (msg.embeds.length > 0) {
      embedsHTML = '<div class="embeds">';
      msg.embeds.forEach(embed => {
        const embedColor = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865F2';
        embedsHTML += `<div class="embed" style="border-left: 4px solid ${embedColor};">`;
        if (embed.author) {
          embedsHTML += `<div class="embed-author">${escapeHtml(embed.author.name)}</div>`;
        }
        if (embed.title) {
          embedsHTML += `<div class="embed-title">${escapeHtml(embed.title)}</div>`;
        }
        if (embed.description) {
          embedsHTML += `<div class="embed-description">${escapeHtml(embed.description)}</div>`;
        }
        if (embed.fields && embed.fields.length > 0) {
          embed.fields.forEach(field => {
            embedsHTML += `<div class="embed-field"><strong>${escapeHtml(field.name)}</strong><br>${escapeHtml(field.value)}</div>`;
          });
        }
        if (embed.image) {
          embedsHTML += `<img src="${embed.image.url}" alt="embed image" style="max-width: 400px; border-radius: 4px; margin-top: 8px;">`;
        }
        if (embed.thumbnail) {
          embedsHTML += `<img src="${embed.thumbnail.url}" alt="embed thumbnail" style="max-width: 80px; border-radius: 4px; margin-top: 8px;">`;
        }
        embedsHTML += '</div>';
      });
      embedsHTML += '</div>';
    }
    
    return `
      <div class="message">
        <img src="${avatarURL}" alt="${msg.author.tag}" class="avatar">
        <div class="message-details">
          <div class="message-header">
            <span class="author">${escapeHtml(msg.author.tag)}</span>
            ${isBot}
            <span class="timestamp">${timestamp}</span>
          </div>
          ${contentHTML}
          ${attachmentsHTML}
          ${embedsHTML}
        </div>
      </div>
    `;
  }).join('');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket #${ticket.id} - Transcript</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background: #36393f;
      color: #dcddde;
      padding: 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: #2f3136;
      border-radius: 8px;
      padding: 30px;
    }
    .header {
      border-bottom: 2px solid #202225;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #fff;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      color: #b9bbbe;
      font-size: 14px;
    }
    .message {
      display: flex;
      padding: 12px 0;
      border-bottom: 1px solid #202225;
    }
    .message:last-child { border-bottom: none; }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .message-details { flex: 1; }
    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .author {
      font-weight: 600;
      color: #fff;
      font-size: 16px;
    }
    .bot-badge {
      background: #5865F2;
      color: #fff;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .timestamp {
      color: #72767d;
      font-size: 12px;
    }
    .message-content {
      color: #dcddde;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
      margin-top: 4px;
    }
    .attachments {
      margin-top: 8px;
    }
    .attachment {
      margin: 8px 0;
      color: #00aff4;
    }
    .attachment a {
      color: #00aff4;
      text-decoration: none;
    }
    .attachment a:hover { text-decoration: underline; }
    .embeds {
      margin-top: 8px;
    }
    .embed {
      background: #2f3136;
      border-radius: 4px;
      padding: 12px 16px;
      margin: 8px 0;
      max-width: 500px;
    }
    .embed-author {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .embed-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
      color: #fff;
    }
    .embed-description {
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 8px;
      color: #dcddde;
    }
    .embed-field {
      margin: 8px 0;
      font-size: 14px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #202225;
      text-align: center;
      color: #72767d;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎟️ Ticket #${ticket.id} Transcript</h1>
      <p>Channel: #${escapeHtml(channelName)}</p>
      <p>Ticket Type: ${escapeHtml(ticket.type)}</p>
      <p>Created: ${new Date(ticket.created_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}</p>
      <p>Closed: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}</p>
    </div>
    <div class="messages">
      ${messagesHTML}
    </div>
    <div class="footer">
      <p>ClipHub Bot Ticket System</p>
      <p>This transcript contains ${messagesArray.length} message(s)</p>
    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('closeticket')
    .setDescription('Close the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND status = ?')
        .get(interaction.channelId, 'open');

      if (!ticket) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not a Ticket', 'This is not an active ticket channel.')]
        });
      }

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const htmlTranscript = generateHTMLTranscript(messages, ticket, interaction.channel.name);
      
      const textTranscript = Array.from(messages.values())
        .reverse()
        .map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`)
        .join('\n');

      const stmt = db.prepare(`
        UPDATE tickets 
        SET status = ?, closed_at = CURRENT_TIMESTAMP, transcript = ? 
        WHERE id = ?
      `);
      stmt.run('closed', textTranscript, ticket.id);

      const user = await interaction.client.users.fetch(ticket.user_id);
      const attachment = new AttachmentBuilder(Buffer.from(htmlTranscript), { 
        name: `ticket-${ticket.id}-transcript.html` 
      });

      const ticketLogsChannel = process.env.TICKET_LOGS_CHANNEL;
      if (ticketLogsChannel) {
        try {
          const logsChannel = await interaction.client.channels.fetch(ticketLogsChannel);
          await logsChannel.send({
            embeds: [successEmbed(
              'Ticket Closed',
              `**Ticket ID:** #${ticket.id}\n` +
              `**User:** ${user.tag}\n` +
              `**Type:** ${ticket.type}\n` +
              `**Closed by:** ${interaction.user.tag}\n` +
              `**Messages:** ${messages.size}`
            )],
            files: [attachment]
          });
        } catch (error) {
          console.error('Failed to send transcript to logs:', error);
        }
      }

      try {
        const userAttachment = new AttachmentBuilder(Buffer.from(htmlTranscript), { 
          name: `ticket-${ticket.id}-transcript.html` 
        });
        await user.send({
          embeds: [successEmbed(
            'Ticket Closed',
            `Your ticket #${ticket.id} has been closed.\n\n` +
            `**Type:** ${ticket.type}\n` +
            `**Closed by:** ${interaction.user.tag}\n\n` +
            `Please find the full transcript attached.`
          )],
          files: [userAttachment]
        });
      } catch (error) {
        console.error('Failed to send transcript to user:', error);
      }

      await logTicket(interaction.client, 'Closed', ticket, user);

      await interaction.editReply({
        embeds: [successEmbed('Ticket Closed', 'Transcript has been generated and sent. This channel will be deleted in 10 seconds.')]
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error('Failed to delete ticket channel:', error);
        }
      }, 10000);

    } catch (error) {
      console.error('Close ticket error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to close ticket.')]
      });
    }
  }
};
