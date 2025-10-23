const { db } = require('../database/init');
const { EmbedBuilder } = require('discord.js');

/**
 * Calculate earnings for a submission based on views and campaign rate
 */
function calculateEarnings(views, ratePerK) {
  return (views / 1000) * ratePerK;
}

/**
 * Update campaign budget when a submission is approved
 * @param {number} campaignId - Campaign ID
 * @param {number} views - Number of views
 * @returns {Object} Updated budget info
 */
function updateCampaignBudget(campaignId, views) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return null;

  const earnings = calculateEarnings(views, campaign.rate_per_1k);
  const newBudgetSpent = (campaign.budget_spent || 0) + earnings;

  const updateStmt = db.prepare('UPDATE campaigns SET budget_spent = ? WHERE id = ?');
  updateStmt.run(newBudgetSpent, campaignId);

  return {
    campaignId,
    totalBudget: campaign.total_budget || 0,
    budgetSpent: newBudgetSpent,
    budgetLeft: (campaign.total_budget || 0) - newBudgetSpent,
    percentageUsed: ((newBudgetSpent / (campaign.total_budget || 1)) * 100).toFixed(2)
  };
}

/**
 * Check if a milestone has been reached and update it
 * @param {Object} client - Discord client
 * @param {number} campaignId - Campaign ID
 */
async function checkAndNotifyMilestone(client, campaignId) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign || !campaign.total_budget || campaign.total_budget === 0) return;

  const percentageUsed = ((campaign.budget_spent || 0) / campaign.total_budget) * 100;

  // Check all milestones in ascending order and mark ALL that have been passed
  const milestones = [
    { percent: 25, field: 'milestone_25', reached: campaign.milestone_25 === 1 },
    { percent: 50, field: 'milestone_50', reached: campaign.milestone_50 === 1 },
    { percent: 75, field: 'milestone_75', reached: campaign.milestone_75 === 1 },
    { percent: 100, field: 'milestone_100', reached: campaign.milestone_100 === 1 }
  ];

  // Find all newly reached milestones (in order)
  const newlyReached = [];
  for (const milestone of milestones) {
    if (percentageUsed >= milestone.percent && !milestone.reached) {
      newlyReached.push(milestone);
    }
  }

  // Mark all newly reached milestones and send notifications in order
  for (const milestone of newlyReached) {
    // Mark milestone as reached
    const updateStmt = db.prepare(`UPDATE campaigns SET ${milestone.field} = 1 WHERE id = ?`);
    updateStmt.run(campaignId);

    // Refetch campaign to get updated data for notification
    const updatedCampaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);

    // Send notification to campaign announcements channel
    await sendMilestoneNotification(client, updatedCampaign, milestone.percent);
  }
}

/**
 * Send budget milestone notification to campaign channel
 */
async function sendMilestoneNotification(client, campaign, milestone) {
  try {
    if (!campaign.announcements_channel_id) return;

    const channel = await client.channels.fetch(campaign.announcements_channel_id);
    if (!channel) return;

    const budgetLeft = (campaign.total_budget || 0) - (campaign.budget_spent || 0);
    const percentageUsed = ((campaign.budget_spent || 0) / (campaign.total_budget || 1)) * 100;

    // Get total views from all approved submissions
    const viewsData = db.prepare(`
      SELECT SUM(views) as total_views, COUNT(*) as total_submissions
      FROM submissions
      WHERE campaign_id = ? AND status = 'approved'
    `).get(campaign.id);

    const totalViews = viewsData?.total_views || 0;
    const totalSubmissions = viewsData?.total_submissions || 0;

    let color = 0x10b981; // Green
    let emoji = '📊';
    let message = '';

    if (milestone === 25) {
      color = 0x10b981; // Green
      emoji = '🟢';
      message = 'Great start! Keep up the momentum!';
    } else if (milestone === 50) {
      color = 0xf59e0b; // Yellow/Orange
      emoji = '🟡';
      message = 'Halfway there! Amazing progress!';
    } else if (milestone === 75) {
      color = 0xE31E24; // Red
      emoji = '🟠';
      message = 'Almost done! Final push!';
    } else if (milestone === 100) {
      color = 0x991b1b; // Dark red
      emoji = '🔴';
      message = 'Budget reached! Campaign ending soon.';
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${milestone}% Budget Milestone Reached!`)
      .setDescription(message)
      .setColor(color)
      .addFields(
        { name: '📊 Total Views', value: totalViews.toLocaleString(), inline: true },
        { name: '📹 Total Submissions', value: totalSubmissions.toString(), inline: true },
        { name: '💰 Budget Used', value: `$${(campaign.budget_spent || 0).toFixed(2)}`, inline: true },
        { name: '💵 Budget Remaining', value: `$${budgetLeft.toFixed(2)}`, inline: true },
        { name: '📈 Total Budget', value: `$${(campaign.total_budget || 0).toFixed(2)}`, inline: true },
        { name: '📊 Progress', value: `${percentageUsed.toFixed(1)}%`, inline: true }
      )
      .setTimestamp();

    // Mention the role if budget is at 100%
    const content = milestone === 100 ? `<@&${campaign.role_id}> **Campaign budget exhausted!**` : null;

    await channel.send({ content, embeds: [embed] });
  } catch (error) {
    console.error('Failed to send milestone notification:', error);
  }
}

/**
 * Get campaign budget statistics
 */
function getCampaignBudgetStats(campaignId) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return null;

  const viewsData = db.prepare(`
    SELECT SUM(views) as total_views, COUNT(*) as total_submissions
    FROM submissions
    WHERE campaign_id = ? AND status = 'approved'
  `).get(campaignId);

  const percentageUsed = ((campaign.budget_spent || 0) / (campaign.total_budget || 1)) * 100;
  const budgetLeft = (campaign.total_budget || 0) - (campaign.budget_spent || 0);

  return {
    totalBudget: campaign.total_budget || 0,
    budgetSpent: campaign.budget_spent || 0,
    budgetLeft,
    percentageUsed: percentageUsed.toFixed(2),
    totalViews: viewsData?.total_views || 0,
    totalSubmissions: viewsData?.total_submissions || 0,
    milestones: {
      '25%': campaign.milestone_25 === 1,
      '50%': campaign.milestone_50 === 1,
      '75%': campaign.milestone_75 === 1,
      '100%': campaign.milestone_100 === 1
    }
  };
}

module.exports = {
  calculateEarnings,
  updateCampaignBudget,
  checkAndNotifyMilestone,
  getCampaignBudgetStats
};
