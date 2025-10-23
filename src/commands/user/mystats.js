const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../database/init');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mystats')
    .setDescription('View your personal statistics and performance'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;

      // Get user stats
      const submissionStats = db.prepare(`
        SELECT 
          COUNT(*) as total_submissions,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN status = 'flagged' THEN 1 ELSE 0 END) as flagged,
          SUM(CASE WHEN status = 'approved' THEN views ELSE 0 END) as total_views
        FROM submissions
        WHERE user_id = ?
      `).get(userId);

      const payoutStats = db.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_earned,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount
        FROM payouts
        WHERE user_id = ?
      `).get(userId);

      const campaigns = db.prepare(`
        SELECT COUNT(*) as joined_campaigns
        FROM campaign_members
        WHERE user_id = ?
      `).get(userId);

      const inviteStats = db.prepare(`
        SELECT COUNT(*) as total_invites
        FROM invites
        WHERE inviter_id = ?
      `).get(userId);

      const embed = new EmbedBuilder()
        .setColor(0xE31E24)
        .setTitle('📊 Your Performance Statistics')
        .setDescription(`Here's your complete performance overview, ${interaction.user.username}!`)
        .addFields(
          { 
            name: '🎬 Campaigns', 
            value: `**${campaigns.joined_campaigns || 0}** campaigns joined`, 
            inline: true 
          },
          { 
            name: '📨 Invites', 
            value: `**${inviteStats.total_invites || 0}** users invited`, 
            inline: true 
          },
          { 
            name: '\u200B', 
            value: '\u200B', 
            inline: true 
          },
          { 
            name: '📹 Total Submissions', 
            value: `**${submissionStats.total_submissions || 0}** clips`, 
            inline: true 
          },
          { 
            name: '✅ Approved', 
            value: `**${submissionStats.approved || 0}** clips`, 
            inline: true 
          },
          { 
            name: '⏳ Pending', 
            value: `**${submissionStats.pending || 0}** clips`, 
            inline: true 
          },
          { 
            name: '❌ Rejected', 
            value: `**${submissionStats.rejected || 0}** clips`, 
            inline: true 
          },
          { 
            name: '🚩 Flagged', 
            value: `**${submissionStats.flagged || 0}** clips`, 
            inline: true 
          },
          { 
            name: '👁️ Total Views', 
            value: `**${(submissionStats.total_views || 0).toLocaleString()}** views`, 
            inline: true 
          },
          { 
            name: '💰 Total Earned', 
            value: `**$${(payoutStats.total_earned || 0).toFixed(2)}**`, 
            inline: true 
          },
          { 
            name: '⏰ Pending Payouts', 
            value: `**$${(payoutStats.pending_amount || 0).toFixed(2)}**`, 
            inline: true 
          },
          { 
            name: '📈 Success Rate', 
            value: `**${submissionStats.total_submissions > 0 ? Math.round((submissionStats.approved / submissionStats.total_submissions) * 100) : 0}%**`, 
            inline: true 
          }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'ClipHub Bot • Keep grinding!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error in mystats command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        content: '❌ An error occurred while fetching your stats.',
        ephemeral: true
      });
      }
    }
  }
};
