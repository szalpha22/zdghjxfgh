const { db } = require('../database/init');
const { createEmbed } = require('../utils/embeds');
const { dmWeeklyReport } = require('../utils/dmHandler');

async function sendWeeklyReports(client) {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const topClippers = db.prepare(`
      SELECT 
        u.user_id, 
        u.username, 
        SUM(CASE WHEN s.status = 'approved' THEN s.views ELSE 0 END) as total_views
      FROM users u
      JOIN submissions s ON u.user_id = s.user_id
      WHERE s.submitted_at >= ? AND s.status = 'approved'
      GROUP BY u.user_id
      ORDER BY total_views DESC
      LIMIT 5
    `).all(oneWeekAgo);

    const newCampaigns = db.prepare('SELECT name FROM campaigns WHERE created_at >= ?').all(oneWeekAgo);

    const endedCampaigns = db.prepare('SELECT name FROM campaigns WHERE ended_at >= ?').all(oneWeekAgo);

    const pendingPayouts = db.prepare(`
      SELECT COUNT(*) as count, SUM(amount) as total 
      FROM payouts 
      WHERE status = 'pending'
    `).get();

    let topClippersText = '';
    topClippers.forEach((clipper, i) => {
      topClippersText += `${i + 1}. <@${clipper.user_id}> - ${clipper.total_views.toLocaleString()} views\n`;
    });

    const embed = createEmbed({
      title: '📊 Weekly Report',
      description: 'Here\'s what happened this week!',
      fields: [
        { 
          name: '🏆 Top 5 Clippers', 
          value: topClippersText || 'No approved clips this week', 
          inline: false 
        },
        { 
          name: '🆕 New Campaigns', 
          value: newCampaigns.length > 0 ? newCampaigns.map(c => c.name).join(', ') : 'None', 
          inline: false 
        },
        { 
          name: '🏁 Ended Campaigns', 
          value: endedCampaigns.length > 0 ? endedCampaigns.map(c => c.name).join(', ') : 'None', 
          inline: false 
        },
        { 
          name: '💰 Pending Payouts', 
          value: `${pendingPayouts.count || 0} requests ($${(pendingPayouts.total || 0).toFixed(2)})`, 
          inline: false 
        }
      ],
      color: 0xE31E24,
      footer: { text: 'Weekly report generated automatically' }
    });

    const announcementChannel = process.env.ANNOUNCEMENTS_CHANNEL;
    if (announcementChannel) {
      const channel = await client.channels.fetch(announcementChannel);
      await channel.send({ embeds: [embed] });
    }

    const verifiedClippers = db.prepare('SELECT user_id FROM users WHERE verified = 1 AND banned = 0').all();

    for (const clipper of verifiedClippers) {
      try {
        const user = await client.users.fetch(clipper.user_id);
        
        const stats = db.prepare(`
          SELECT 
            COUNT(*) as submissions,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN status = 'approved' THEN views ELSE 0 END) as views
          FROM submissions 
          WHERE user_id = ? AND submitted_at >= ?
        `).get(clipper.user_id, oneWeekAgo);

        const campaigns = db.prepare(`
          SELECT COUNT(*) as count 
          FROM campaign_members 
          WHERE user_id = ? AND joined_at >= ?
        `).get(clipper.user_id, oneWeekAgo);

        const payoutsApproved = db.prepare(`
          SELECT SUM(amount) as total 
          FROM payouts 
          WHERE user_id = ? AND status = 'approved' AND processed_at >= ?
        `).get(clipper.user_id, oneWeekAgo);

        const campaign = db.prepare('SELECT rate_per_1k FROM campaigns LIMIT 1').get();
        const earnings = ((stats.views || 0) / 1000) * (campaign?.rate_per_1k || 0);

        await dmWeeklyReport(user, {
          submissions: stats.submissions || 0,
          approved: stats.approved || 0,
          views: stats.views || 0,
          earnings: earnings,
          campaigns: campaigns.count || 0,
          payouts: payoutsApproved?.total || 0
        });
      } catch (error) {
        console.error(`Failed to send weekly report to ${clipper.user_id}:`, error);
      }
    }

    console.log('✅ Weekly reports sent successfully');
  } catch (error) {
    console.error('Error sending weekly reports:', error);
  }
}

module.exports = {
  sendWeeklyReports
};
