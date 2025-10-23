const { EmbedBuilder } = require('discord.js');

// ClipHub Red Theme
const COLORS = {
  PRIMARY: 0xE31E24,    // ClipHub Red
  SUCCESS: 0xE31E24,    // ClipHub Red
  WARNING: 0xB91419,    // Dark Red (for warnings)
  ERROR: 0x8B0F14,      // Darkest Red (for errors)
  INFO: 0xE31E24,       // ClipHub Red (for info)
  RED: 0xE31E24,        // ClipHub Red accent
  DARK_RED: 0xB91419    // Dark Red accent
};

function createEmbed(options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || COLORS.PRIMARY)
    .setTimestamp();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.fields) embed.addFields(options.fields);
  if (options.footer) embed.setFooter(options.footer);
  if (options.thumbnail) {
    const thumbnailUrl = typeof options.thumbnail === 'string' ? options.thumbnail : options.thumbnail.url;
    embed.setThumbnail(thumbnailUrl);
  }
  if (options.image) {
    const imageUrl = typeof options.image === 'string' ? options.image : options.image.url;
    embed.setImage(imageUrl);
  }
  if (options.author) embed.setAuthor(options.author);

  return embed;
}

function successEmbed(title, description) {
  return createEmbed({
    title: `✅ ${title}`,
    description,
    color: COLORS.SUCCESS
  });
}

function errorEmbed(title, description) {
  return createEmbed({
    title: `❌ ${title}`,
    description,
    color: COLORS.ERROR
  });
}

function warningEmbed(title, description) {
  return createEmbed({
    title: `⚠️ ${title}`,
    description,
    color: COLORS.WARNING
  });
}

function infoEmbed(title, description) {
  return createEmbed({
    title: `ℹ️ ${title}`,
    description,
    color: COLORS.INFO
  });
}

function campaignEmbed(campaign) {
  const platforms = JSON.parse(campaign.platforms).join(', ');
  return createEmbed({
    title: `📹 ${campaign.name}`,
    description: campaign.description,
    fields: [
      { name: '🎬 Type', value: campaign.type, inline: true },
      { name: '📱 Platforms', value: platforms, inline: true },
      { name: '💰 Rate', value: `$${campaign.rate_per_1k}/1K views`, inline: true },
      { name: '📺 Content Source', value: campaign.content_source || 'Not specified', inline: false },
      { name: '📊 Status', value: campaign.status === 'active' ? '🟢 Active' : '🔴 Ended', inline: true }
    ],
    color: campaign.status === 'active' ? COLORS.SUCCESS : COLORS.ERROR,
    footer: { text: `Campaign ID: ${campaign.id}` }
  });
}

function submissionEmbed(submission, user, campaign) {
  const statusEmoji = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌',
    flagged: '🚩'
  };

  return createEmbed({
    title: `${statusEmoji[submission.status]} Clip Submission`,
    fields: [
      { name: '👤 User', value: `<@${submission.user_id}>`, inline: true },
      { name: '📹 Campaign', value: campaign.name, inline: true },
      { name: '📱 Platform', value: submission.platform, inline: true },
      { name: '🔗 Link', value: submission.video_link, inline: false },
      { name: '👁️ Views', value: submission.views.toLocaleString(), inline: true },
      { name: '📊 Status', value: submission.status, inline: true },
      { name: '📅 Submitted', value: new Date(submission.submitted_at).toLocaleString(), inline: true }
    ],
    color: submission.flagged ? COLORS.WARNING : COLORS.PRIMARY
  });
}

function payoutEmbed(payout, user, campaign) {
  const statusEmoji = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌'
  };

  return createEmbed({
    title: `${statusEmoji[payout.status]} Payout Request`,
    fields: [
      { name: '👤 User', value: `<@${payout.user_id}>`, inline: true },
      { name: '📹 Campaign', value: campaign.name, inline: true },
      { name: '💰 Amount', value: `$${payout.amount.toFixed(2)}`, inline: true },
      { name: '📊 Status', value: payout.status, inline: true },
      { name: '📅 Requested', value: new Date(payout.requested_at).toLocaleString(), inline: true }
    ],
    color: payout.status === 'approved' ? COLORS.SUCCESS : payout.status === 'rejected' ? COLORS.ERROR : COLORS.WARNING
  });
}

function ticketEmbed(ticket, user) {
  return createEmbed({
    title: `🎟️ Support Ticket #${ticket.id}`,
    description: `Type: ${ticket.type}`,
    fields: [
      { name: '👤 User', value: `<@${ticket.user_id}>`, inline: true },
      { name: '📊 Status', value: ticket.status === 'open' ? '🟢 Open' : '🔴 Closed', inline: true },
      { name: '📅 Created', value: new Date(ticket.created_at).toLocaleString(), inline: true }
    ],
    color: ticket.status === 'open' ? COLORS.SUCCESS : COLORS.ERROR
  });
}

module.exports = {
  COLORS,
  createEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  campaignEmbed,
  submissionEmbed,
  payoutEmbed,
  ticketEmbed
};
