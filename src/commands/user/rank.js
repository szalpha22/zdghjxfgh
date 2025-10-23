const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../database/init');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('See your ranking among all clippers'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;

      // Get all users ranked by approved views
      const rankings = db.prepare(`
        SELECT 
          s.user_id,
          u.username,
          SUM(CASE WHEN s.status = 'approved' THEN s.views ELSE 0 END) as total_views,
          COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved_clips
        FROM submissions s
        JOIN users u ON s.user_id = u.user_id
        GROUP BY s.user_id
        ORDER BY total_views DESC
      `).all();

      const userRankData = rankings.find((r, index) => {
        r.rank = index + 1;
        return r.user_id === userId;
      });

      if (!userRankData) {
        return await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('📊 Your Rank')
            .setDescription('You haven\'t submitted any approved clips yet. Start submitting to get ranked!')
            .setFooter({ text: 'ClipHub Bot' })
          ],
          ephemeral: true
        });
      }

      // Get top 5 for comparison
      const top5 = rankings.slice(0, 5);

      // Calculate percentile
      const percentile = ((rankings.length - userRankData.rank) / rankings.length * 100).toFixed(1);

      // Determine rank emoji
      let rankEmoji = '🏅';
      if (userRankData.rank === 1) rankEmoji = '🥇';
      else if (userRankData.rank === 2) rankEmoji = '🥈';
      else if (userRankData.rank === 3) rankEmoji = '🥉';
      else if (userRankData.rank <= 10) rankEmoji = '⭐';

      const embed = new EmbedBuilder()
        .setColor(userRankData.rank <= 3 ? 0xE31E24 : 0x000000)
        .setTitle(`${rankEmoji} Your Global Rank`)
        .setDescription(`You're ranked **#${userRankData.rank}** out of **${rankings.length}** clippers!`)
        .addFields(
          {
            name: '📊 Your Stats',
            value: `**Views:** ${userRankData.total_views.toLocaleString()}\n**Approved Clips:** ${userRankData.approved_clips}\n**Percentile:** Top ${percentile}%`,
            inline: false
          },
          {
            name: '🏆 Top 5 Leaderboard',
            value: top5.map((r, i) => {
              const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              const isYou = r.user_id === userId ? ' **(YOU)**' : '';
              return `${emoji} ${r.username}${isYou} - ${r.total_views.toLocaleString()} views`;
            }).join('\n'),
            inline: false
          }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'ClipHub Bot • Keep climbing the ranks!' })
        .setTimestamp();

      // Add motivational message based on rank
      if (userRankData.rank === 1) {
        embed.addFields({
          name: '👑 Champion Status',
          value: 'You\'re #1! Keep up the amazing work!',
          inline: false
        });
      } else if (userRankData.rank <= 3) {
        embed.addFields({
          name: '🔥 Top Performer',
          value: 'You\'re in the top 3! Keep pushing for #1!',
          inline: false
        });
      } else if (userRankData.rank <= 10) {
        embed.addFields({
          name: '⚡ Rising Star',
          value: 'You\'re in the top 10! Keep grinding!',
          inline: false
        });
      } else {
        const nextRank = rankings[userRankData.rank - 2];
        const viewsNeeded = nextRank.total_views - userRankData.total_views;
        embed.addFields({
          name: '📈 Next Milestone',
          value: `You need **${viewsNeeded.toLocaleString()}** more views to reach rank #${userRankData.rank - 1}`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error in rank command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        content: '❌ An error occurred while fetching your rank.',
        ephemeral: true
      });
      }
    }
  }
};
