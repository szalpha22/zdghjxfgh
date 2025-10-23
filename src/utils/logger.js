const { createEmbed, COLORS } = require('./embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function logToChannel(client, channelId, embed, components = null) {
  if (!channelId) return;
  
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      const messageData = { embeds: [embed] };
      if (components) {
        messageData.components = components;
      }
      await channel.send(messageData);
    }
  } catch (error) {
    console.error(`Failed to log to channel ${channelId}:`, error.message);
  }
}

async function logCampaign(client, action, user, campaign) {
  const channelId = process.env.COMMAND_LOGS_CHANNEL;
  const embed = createEmbed({
    title: `📹 Campaign ${action}`,
    fields: [
      { name: 'Campaign', value: campaign?.name || 'Unknown', inline: true },
      { name: 'User', value: `<@${user?.id || 'Unknown'}>`, inline: true },
      { name: 'Action', value: action, inline: true }
    ],
    color: COLORS.INFO
  });
  await logToChannel(client, channelId, embed);
}

async function logSubmission(client, action, submission, user) {
  const channelId = process.env.SUBMISSION_LOGS_CHANNEL;
  
  // Get campaign name
  const { db } = require('../database/init');
  const campaign = db.prepare('SELECT name FROM campaigns WHERE id = ?').get(submission.campaign_id);
  
  const embed = createEmbed({
    title: `📤 Submission ${action}`,
    fields: [
      { name: 'Clip ID', value: `#${submission.id}`, inline: true },
      { name: 'User', value: `<@${user.id}>`, inline: true },
      { name: 'Platform', value: submission.platform, inline: true },
      { name: 'Campaign', value: campaign?.name || `#${submission.campaign_id}`, inline: true },
      { name: 'Views', value: submission.views ? submission.views.toLocaleString() : '0', inline: true },
      { name: 'Status', value: submission.status, inline: true },
      { name: 'Link', value: submission.video_link, inline: false }
    ],
    color: submission.status === 'approved' ? COLORS.SUCCESS : submission.status === 'rejected' ? COLORS.ERROR : COLORS.WARNING
  });
  
  // Add approve/reject buttons for pending submissions
  let components = null;
  if (submission.status === 'pending' && action === 'Submitted') {
    const actionButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_clip_${submission.id}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`reject_clip_${submission.id}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
    components = [actionButtons];
  }
  
  await logToChannel(client, channelId, embed, components);
}

async function logFlagged(client, submission, reason, admin) {
  const channelId = process.env.FLAGGED_CLIPS_CHANNEL;
  
  // Get campaign name
  const { db } = require('../database/init');
  const campaign = db.prepare('SELECT name FROM campaigns WHERE id = ?').get(submission.campaign_id);
  
  const embed = createEmbed({
    title: `🚩 Clip Flagged - Review Required`,
    fields: [
      { name: 'Clip ID', value: `#${submission.id}`, inline: true },
      { name: 'User', value: `<@${submission.user_id}>`, inline: true },
      { name: 'Platform', value: submission.platform, inline: true },
      { name: 'Campaign', value: campaign?.name || `#${submission.campaign_id}`, inline: true },
      { name: 'Views', value: submission.views ? submission.views.toLocaleString() : '0', inline: true },
      { name: 'Flagged By', value: admin ? `<@${admin.id}>` : 'System', inline: true },
      { name: 'Flag Reason', value: reason, inline: false },
      { name: 'Link', value: submission.video_link, inline: false }
    ],
    color: COLORS.WARNING
  });
  
  // Add approve/reject buttons for flagged clips
  const actionButtons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_clip_${submission.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`reject_clip_${submission.id}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );
  
  await logToChannel(client, channelId, embed, [actionButtons]);
}

async function logPayout(client, action, payout, user) {
  const channelId = process.env.PAYOUT_LOGS_CHANNEL;
  
  // Get campaign and user info
  const { db } = require('../database/init');
  const campaign = payout.campaign_id ? db.prepare('SELECT name FROM campaigns WHERE id = ?').get(payout.campaign_id) : null;
  const userInfo = db.prepare('SELECT payout_method, payout_address FROM users WHERE user_id = ?').get(user.id);
  
  const fields = [
    { name: 'Payout ID', value: `#${payout.id}`, inline: true },
    { name: 'User', value: `<@${user.id}>`, inline: true },
    { name: 'Amount', value: `$${payout.amount.toFixed(2)}`, inline: true },
    { name: 'Status', value: payout.status, inline: true }
  ];
  
  if (campaign) {
    fields.push({ name: 'Campaign', value: campaign.name, inline: true });
  }
  
  if (userInfo?.payout_method) {
    fields.push({ name: 'Method', value: userInfo.payout_method, inline: true });
  }
  
  if (userInfo?.payout_address) {
    fields.push({ name: 'Address', value: userInfo.payout_address, inline: false });
  }
  
  if (payout.analytics_proof) {
    fields.push({ name: 'Proof', value: payout.analytics_proof, inline: false });
  }
  
  const embed = createEmbed({
    title: `💰 Payout ${action}`,
    fields,
    color: payout.status === 'approved' ? COLORS.SUCCESS : payout.status === 'rejected' ? COLORS.ERROR : COLORS.WARNING
  });
  
  // Add approve/reject buttons for pending payouts
  let components = null;
  if (payout.status === 'pending' && action === 'Requested') {
    const actionButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_payout_${payout.id}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`reject_payout_${payout.id}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
    components = [actionButtons];
  }
  
  await logToChannel(client, channelId, embed, components);
}

async function logTicket(client, action, ticket, user) {
  const channelId = process.env.TICKET_LOGS_CHANNEL;
  const embed = createEmbed({
    title: `🎟️ Ticket ${action}`,
    fields: [
      { name: 'User', value: `<@${user.id}>`, inline: true },
      { name: 'Type', value: ticket.type, inline: true },
      { name: 'Ticket ID', value: `#${ticket.id}`, inline: true },
      { name: 'Status', value: ticket.status, inline: true }
    ],
    color: COLORS.INFO
  });
  await logToChannel(client, channelId, embed);
}

async function logInvite(client, action, user, inviter = null, isFake = false) {
  const channelId = process.env.INVITE_LOGS_CHANNEL;
  const fields = [
    { name: 'User', value: `<@${user.id}>`, inline: true },
    { name: 'Action', value: action, inline: true }
  ];
  
  if (inviter) {
    fields.push({ name: 'Invited By', value: `<@${inviter}>`, inline: true });
  }

  if (isFake && action === 'Joined') {
    fields.push({ name: 'Status', value: '⚠️ Possible Fake Invite', inline: true });
  }

  const embed = createEmbed({
    title: `📨 Member ${action}`,
    fields,
    color: action === 'Joined' ? COLORS.SUCCESS : COLORS.ERROR
  });
  await logToChannel(client, channelId, embed);
}

async function logModeration(client, action, user, moderator, reason = null, duration = null) {
  const channelId = process.env.MODERATION_LOGS_CHANNEL;
  const fields = [
    { name: 'User', value: `<@${user.id}>`, inline: true },
    { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
    { name: 'Action', value: action, inline: true }
  ];

  if (reason) {
    fields.push({ name: 'Reason', value: reason, inline: false });
  }

  if (duration) {
    fields.push({ name: 'Duration', value: duration, inline: true });
  }

  const embed = createEmbed({
    title: `🛡️ Moderation Action`,
    fields,
    color: COLORS.WARNING
  });
  await logToChannel(client, channelId, embed);
}

async function logCommand(client, interaction) {
  const channelId = process.env.COMMAND_LOGS_CHANNEL;
  const embed = createEmbed({
    title: `⌨️ Command Executed`,
    fields: [
      { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Command', value: `/${interaction.commandName}`, inline: true },
      { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }
    ],
    color: COLORS.INFO
  });
  await logToChannel(client, channelId, embed);
}

async function logError(client, error, context = '') {
  const channelId = process.env.ERROR_LOGS_CHANNEL;
  const embed = createEmbed({
    title: `🔥 Error Occurred`,
    description: `\`\`\`${error.message}\`\`\``,
    fields: [
      { name: 'Context', value: context || 'Unknown', inline: true },
      { name: 'Stack', value: `\`\`\`${error.stack?.substring(0, 1000) || 'No stack trace'}\`\`\``, inline: false }
    ],
    color: COLORS.ERROR
  });
  await logToChannel(client, channelId, embed);
  console.error(`Error [${context}]:`, error);
}

module.exports = {
  logCampaign,
  logSubmission,
  logFlagged,
  logPayout,
  logTicket,
  logInvite,
  logModeration,
  logCommand,
  logError
};
