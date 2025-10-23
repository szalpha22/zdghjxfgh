const { createEmbed, successEmbed, errorEmbed, warningEmbed, COLORS } = require('./embeds');

async function sendDM(user, embed) {
  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Failed to send DM to ${user.tag}:`, error.message);
    return false;
  }
}

async function dmCampaignJoined(user, campaign) {
  const platforms = JSON.parse(campaign.platforms).join(', ');
  const embed = createEmbed({
    title: '🎉 Campaign Joined!',
    description: `You've successfully joined **${campaign.name}**`,
    fields: [
      { name: '📹 Campaign Type', value: campaign.type, inline: true },
      { name: '📱 Platforms', value: platforms, inline: true },
      { name: '💰 Rate', value: `$${campaign.rate_per_1k}/1K views`, inline: true },
      { name: '📺 Content Source', value: campaign.content_source || 'Check campaign details', inline: false },
      { name: '📝 Next Steps', value: 'Start creating clips and submit them using `/submit`!', inline: false }
    ],
    color: COLORS.SUCCESS
  });
  return await sendDM(user, embed);
}

async function dmCampaignEnded(user, campaign, stats) {
  const embed = createEmbed({
    title: '🏁 Campaign Ended',
    description: `**${campaign.name}** has ended. Here's your performance summary:`,
    fields: [
      { name: '📤 Total Submissions', value: stats.submissions.toString(), inline: true },
      { name: '✅ Approved Clips', value: stats.approved.toString(), inline: true },
      { name: '👁️ Total Views', value: stats.views.toLocaleString(), inline: true },
      { name: '💰 Total Earned', value: `$${stats.earned.toFixed(2)}`, inline: true }
    ],
    footer: { text: 'Thank you for participating!' },
    color: COLORS.INFO
  });
  return await sendDM(user, embed);
}

async function dmSubmissionApproved(user, submission, campaign, views) {
  const earning = (views / 1000) * campaign.rate_per_1k;
  const embed = successEmbed(
    'Submission Approved!',
    `Your clip for **${campaign.name}** has been approved!\n\n` +
    `📱 Platform: ${submission.platform}\n` +
    `👁️ Views: ${views.toLocaleString()}\n` +
    `💰 Earnings: $${earning.toFixed(2)}`
  );
  return await sendDM(user, embed);
}

async function dmSubmissionRejected(user, submission, campaign, reason) {
  const embed = errorEmbed(
    'Submission Rejected',
    `Your clip for **${campaign.name}** was rejected.\n\n` +
    `📱 Platform: ${submission.platform}\n` +
    `❌ Reason: ${reason}`
  );
  return await sendDM(user, embed);
}

async function dmSubmissionFlagged(user, submission, reason) {
  const embed = warningEmbed(
    'Submission Flagged for Review',
    `Your submission has been flagged and requires verification.\n\n` +
    `🔗 Link: ${submission.video_link}\n` +
    `📋 Reason: ${reason}\n\n` +
    `A support ticket has been created. Please check your server for the ticket channel.`
  );
  return await sendDM(user, embed);
}

async function dmPayoutApproved(user, payout, campaign) {
  const embed = successEmbed(
    'Payout Approved!',
    `Your payout request has been approved!\n\n` +
    `📹 Campaign: ${campaign.name}\n` +
    `💰 Amount: $${payout.amount.toFixed(2)}\n` +
    `💳 Method: ${user.payout_method}\n` +
    `📬 Address: ${user.payout_address}\n\n` +
    `Payment will be processed within 24-48 hours.`
  );
  return await sendDM(user, embed);
}

async function dmPayoutRejected(user, payout, campaign, reason) {
  const embed = errorEmbed(
    'Payout Rejected',
    `Your payout request has been rejected.\n\n` +
    `📹 Campaign: ${campaign.name}\n` +
    `💰 Amount: $${payout.amount.toFixed(2)}\n` +
    `❌ Reason: ${reason}\n\n` +
    `Please contact support if you have questions.`
  );
  return await sendDM(user, embed);
}

async function dmTicketCreated(user, ticket) {
  const embed = createEmbed({
    title: '🎟️ Support Ticket Created',
    description: `A support ticket has been created for you.\n\n` +
    `🆔 Ticket ID: #${ticket.id}\n` +
    `📋 Type: ${ticket.type}\n\n` +
    `Please check your server for the ticket channel.`,
    color: COLORS.INFO
  });
  return await sendDM(user, embed);
}

async function dmTicketClosed(user, ticket) {
  const embed = createEmbed({
    title: '🔒 Ticket Closed',
    description: `Your support ticket #${ticket.id} has been closed.\n\n` +
    `Thank you for using our support system!`,
    color: COLORS.INFO
  });
  return await sendDM(user, embed);
}

async function dmWeeklyReport(user, stats) {
  const embed = createEmbed({
    title: '📊 Your Weekly Report',
    description: `Here's your performance for the past week:`,
    fields: [
      { name: '📤 Submissions', value: stats.submissions.toString(), inline: true },
      { name: '✅ Approved', value: stats.approved.toString(), inline: true },
      { name: '👁️ Total Views', value: stats.views.toLocaleString(), inline: true },
      { name: '💰 Earnings', value: `$${stats.earnings.toFixed(2)}`, inline: true },
      { name: '📹 Campaigns Joined', value: stats.campaigns.toString(), inline: true },
      { name: '💳 Payouts Received', value: `$${stats.payouts.toFixed(2)}`, inline: true }
    ],
    footer: { text: 'Keep up the great work!' },
    color: COLORS.PRIMARY
  });
  return await sendDM(user, embed);
}

module.exports = {
  sendDM,
  dmCampaignJoined,
  dmCampaignEnded,
  dmSubmissionApproved,
  dmSubmissionRejected,
  dmSubmissionFlagged,
  dmPayoutApproved,
  dmPayoutRejected,
  dmTicketCreated,
  dmTicketClosed,
  dmWeeklyReport
};
