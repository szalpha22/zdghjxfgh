const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logSubmission } = require('../../utils/logger');
const { dmSubmissionApproved } = require('../../utils/dmHandler');
const { getYouTubeViews } = require('../../services/youtube');
const { getTikTokViews } = require('../../services/tiktok');
const { updateCampaignBudget, checkAndNotifyMilestone } = require('../../services/budgetTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('approveclip')
    .setDescription('Approve a submission')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('submission_id')
        .setDescription('Submission ID')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('current_views')
        .setDescription('Current view count for this video')
        .setRequired(true)),

  async execute(interaction) {
    const submissionId = interaction.options.getInteger('submission_id');
    const currentViews = interaction.options.getInteger('current_views');

    await interaction.deferReply({ ephemeral: true });

    try {
      const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);

      if (!submission) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Submission not found.')]
        });
      }

      const views = currentViews;
      
      // Validation: warn if current_views seems unreasonably high
      if (views > 10000000) {
        return await interaction.editReply({
          embeds: [errorEmbed(
            'Unusually High Views',
            `The view count you entered (${views.toLocaleString()}) is very high (>10M).\n\n` +
            'Please double-check the number before approving. If this is correct, please contact a developer to approve this submission manually.'
          )]
        });
      }

      const stmt = db.prepare(`
        UPDATE submissions 
        SET status = ?, views = ?, reviewed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      stmt.run('approved', views, submissionId);

      const updatedSubmission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(submission.campaign_id);
      const user = await interaction.client.users.fetch(submission.user_id);

      const earnings = (views / 1000) * campaign.rate_per_1k;
      db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(earnings, submission.user_id);

      // Update campaign budget and check for milestones
      const budgetInfo = updateCampaignBudget(submission.campaign_id, views);
      await checkAndNotifyMilestone(interaction.client, submission.campaign_id);

      await dmSubmissionApproved(user, updatedSubmission, campaign, views);
      await logSubmission(interaction.client, 'Approved', updatedSubmission, user);

      await interaction.editReply({
        embeds: [successEmbed(
          'Clip Approved', 
          `Submission #${submissionId} has been approved with ${views.toLocaleString()} views.\n` +
          `**Earnings:** $${earnings.toFixed(2)} added to user balance.\n` +
          (budgetInfo ? `**Campaign Budget:** $${budgetInfo.budgetSpent.toFixed(2)} / $${budgetInfo.totalBudget.toFixed(2)} (${budgetInfo.percentageUsed}%)` : '')
        )]
      });

    } catch (error) {
      console.error('Approve clip error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to approve submission.')]
      });
    }
  }
};
