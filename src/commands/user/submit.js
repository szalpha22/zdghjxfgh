const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { validateCampaignPlatform, checkRateLimit, checkDuplicateSubmission, checkDuplicateLink, checkReusedLink } = require('../../utils/validators');
const { logSubmission, logFlagged } = require('../../utils/logger');
const { dmSubmissionFlagged } = require('../../utils/dmHandler');
const { getYouTubeViews } = require('../../services/youtube');
const { getTikTokViews } = require('../../services/tiktok');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit a clip for a campaign')
    .addStringOption(option =>
      option.setName('campaign')
        .setDescription('Select a campaign you have joined')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('link')
        .setDescription('Video link (YouTube Shorts, TikTok, Instagram, or Twitter/X)')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('analytics')
        .setDescription('Analytics screenshot (required for Instagram and Twitter)')
        .setRequired(false)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const userId = interaction.user.id;

    try {
      // Get all active campaigns that the user has joined
      const campaigns = db.prepare(`
        SELECT c.id, c.name 
        FROM campaigns c
        JOIN campaign_members cm ON c.id = cm.campaign_id
        WHERE cm.user_id = ? AND c.status = 'active'
        ORDER BY c.name
      `).all(userId);

      // Filter campaigns based on user input
      const filtered = campaigns.filter(c => 
        c.name.toLowerCase().includes(focusedValue)
      ).slice(0, 25); // Discord limits to 25 choices

      await interaction.respond(
        filtered.map(c => ({ name: c.name, value: c.name }))
      );
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const campaignName = interaction.options.getString('campaign');
    const videoLink = interaction.options.getString('link');
    const analyticsProof = interaction.options.getAttachment('analytics');
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
      
      if (!user) {
        const stmt = db.prepare('INSERT INTO users (user_id, username) VALUES (?, ?)');
        stmt.run(userId, interaction.user.tag);
      }

      if (user && user.banned) {
        return await interaction.editReply({
          embeds: [errorEmbed('Banned', 'You are banned from submitting clips.')]
        });
      }

      const rateLimit = checkRateLimit(db, userId, 'submit', parseInt(process.env.RATE_LIMIT_SECONDS) || 60);
      if (!rateLimit.allowed) {
        return await interaction.editReply({
          embeds: [errorEmbed('Rate Limited', `Please wait ${rateLimit.waitTime} seconds before submitting again.`)]
        });
      }

      const campaign = db.prepare('SELECT * FROM campaigns WHERE name = ? AND status = ?')
        .get(campaignName, 'active');

      if (!campaign) {
        return await interaction.editReply({
          embeds: [errorEmbed('Invalid Campaign', 'Campaign not found or not active.')]
        });
      }

      const isMember = db.prepare('SELECT id FROM campaign_members WHERE campaign_id = ? AND user_id = ?')
        .get(campaign.id, userId);

      if (!isMember) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Joined', 'You must join this campaign first!')]
        });
      }

      const validation = validateCampaignPlatform(videoLink, campaign.platforms);
      if (!validation.valid) {
        return await interaction.editReply({
          embeds: [errorEmbed('Invalid Platform', validation.error)]
        });
      }

      if ((validation.platform === 'Instagram' || validation.platform === 'Twitter') && !analyticsProof) {
        return await interaction.editReply({
          embeds: [errorEmbed('Analytics Required', `${validation.platform} submissions require an analytics screenshot!`)]
        });
      }

      const duplicateLink = checkDuplicateLink(db, videoLink);
      if (duplicateLink) {
        return await interaction.editReply({
          embeds: [errorEmbed('Duplicate Link', 'This link has already been submitted!')]
        });
      }

      const reusedLink = checkReusedLink(db, videoLink, userId);
      let flagged = 0;
      let flagReason = null;

      if (reusedLink) {
        flagged = 1;
        flagReason = 'Link reused across multiple users';
      }

      let views = 0;
      if (validation.platform === 'YouTube') {
        views = await getYouTubeViews(videoLink) || 0;
      } else if (validation.platform === 'TikTok') {
        views = await getTikTokViews(videoLink) || 0;
      }

      const stmt = db.prepare(`
        INSERT INTO submissions (campaign_id, user_id, video_link, platform, views, analytics_proof, status, flagged, flag_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        campaign.id,
        userId,
        videoLink,
        validation.platform,
        views,
        analyticsProof?.url || null,
        'pending',
        flagged,
        flagReason
      );

      const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(result.lastInsertRowid);

      await logSubmission(interaction.client, 'Submitted', submission, interaction.user);

      if (flagged) {
        await dmSubmissionFlagged(interaction.user, submission, flagReason);
        await logFlagged(interaction.client, submission, flagReason, null);
        await createFlagTicket(interaction, submission);
      }

      await interaction.editReply({
        embeds: [successEmbed(
          'Submission Received!',
          `Your clip has been submitted for **${campaign.name}**\n\n` +
          `📱 Platform: ${validation.platform}\n` +
          `👁️ Views: ${views.toLocaleString()}\n` +
          `📊 Status: ${flagged ? '🚩 Flagged for Review' : '⏳ Pending Review'}`
        )]
      });

    } catch (error) {
      console.error('Submit error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to submit clip. Please try again.')]
      });
    }
  }
};

async function createFlagTicket(interaction, submission) {
  try {
    const stmt = db.prepare(`
      INSERT INTO tickets (user_id, type, related_id, status) 
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(interaction.user.id, 'flagged_submission', submission.id, 'open');
    
    const ticketCategory = process.env.TICKET_CATEGORY;
    const staffRole = process.env.STAFF_ROLE;

    const channel = await interaction.guild.channels.create({
      name: `flag-${result.lastInsertRowid}`,
      type: 0,
      parent: ticketCategory || null,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: ['ViewChannel']
        },
        {
          id: interaction.user.id,
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

    const updateStmt = db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?');
    updateStmt.run(channel.id, result.lastInsertRowid);

    await channel.send({
      content: `<@${interaction.user.id}> ${staffRole ? `<@&${staffRole}>` : ''}`,
      embeds: [errorEmbed(`Flagged Submission - Clip #${submission.id}`, 
        `Your submission has been flagged for manual verification.\n\n` +
        `**Clip ID:** #${submission.id}\n` +
        `**Ticket ID:** #${result.lastInsertRowid}\n` +
        `🔗 Link: ${submission.video_link}\n` +
        `📋 Reason: ${submission.flag_reason}\n\n` +
        `Please provide proof that this is your original content.`
      )]
    });
  } catch (error) {
    console.error('Failed to create flag ticket:', error);
  }
}
