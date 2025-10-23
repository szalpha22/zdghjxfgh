const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { updateCampaignBudget } = require('../../services/budgetTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updateviews')
    .setDescription('Manually update views for an approved submission')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('submission_id')
        .setDescription('Submission ID')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('new_views')
        .setDescription('New view count')
        .setRequired(true)),

  async execute(interaction) {
    const submissionId = interaction.options.getInteger('submission_id');
    const newViews = interaction.options.getInteger('new_views');

    await interaction.deferReply({ ephemeral: true });

    try {
      const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);

      if (!submission) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Submission not found.')]
        });
      }

      if (submission.status !== 'approved') {
        return await interaction.editReply({
          embeds: [errorEmbed('Invalid Status', 'Only approved submissions can have views updated.')]
        });
      }

      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(submission.campaign_id);
      
      if (!campaign) {
        return await interaction.editReply({
          embeds: [errorEmbed('Error', 'Campaign not found.')]
        });
      }

      const oldViews = submission.views;
      const viewDifference = newViews - oldViews;
      
      const oldEarnings = (oldViews / 1000) * campaign.rate_per_1k;
      const newEarnings = (newViews / 1000) * campaign.rate_per_1k;
      const earningsDifference = newEarnings - oldEarnings;

      db.prepare('UPDATE submissions SET views = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newViews, submissionId);

      db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?')
        .run(earningsDifference, submission.user_id);

      // Update campaign budget spent by adding the earnings difference
      const currentBudgetSpent = campaign.budget_spent || 0;
      const newBudgetSpent = currentBudgetSpent + earningsDifference;
      db.prepare('UPDATE campaigns SET budget_spent = ? WHERE id = ?')
        .run(newBudgetSpent, submission.campaign_id);
      
      const budgetInfo = {
        totalBudget: campaign.total_budget || 0,
        budgetSpent: newBudgetSpent,
        budgetLeft: (campaign.total_budget || 0) - newBudgetSpent,
        percentageUsed: ((newBudgetSpent / (campaign.total_budget || 1)) * 100).toFixed(2)
      };

      db.prepare(`
        INSERT INTO view_logs (submission_id, views, platform, checked_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(submissionId, newViews, submission.platform);

      await interaction.editReply({
        embeds: [successEmbed(
          'Views Updated',
          `Successfully updated views for submission #${submissionId}\n\n` +
          `**Old Views:** ${oldViews.toLocaleString()}\n` +
          `**New Views:** ${newViews.toLocaleString()}\n` +
          `**Difference:** +${viewDifference.toLocaleString()}\n\n` +
          `**Old Earnings:** $${oldEarnings.toFixed(2)}\n` +
          `**New Earnings:** $${newEarnings.toFixed(2)}\n` +
          `**Added to Balance:** $${earningsDifference.toFixed(2)}\n\n` +
          (budgetInfo ? `**Campaign Budget:** $${budgetInfo.budgetSpent.toFixed(2)} / $${budgetInfo.totalBudget.toFixed(2)} (${budgetInfo.percentageUsed}%)` : '')
        )]
      });

    } catch (error) {
      console.error('Update views error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update views.')]
      });
    }
  }
};
