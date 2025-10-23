const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top clippers leaderboard'),

  async execute(interaction) {
    try {
      const topClippers = db.prepare(`
        SELECT 
          u.user_id, 
          u.username, 
          COUNT(s.id) as submissions,
          SUM(CASE WHEN s.status = 'approved' THEN s.views ELSE 0 END) as total_views
        FROM users u
        LEFT JOIN submissions s ON u.user_id = s.user_id
        WHERE u.verified = 1 AND u.banned = 0
        GROUP BY u.user_id
        ORDER BY total_views DESC
        LIMIT 10
      `).all();

      let description = '';
      const medals = ['🥇', '🥈', '🥉'];

      topClippers.forEach((clipper, index) => {
        const medal = medals[index] || `${index + 1}.`;
        description += `${medal} <@${clipper.user_id}> - ${clipper.total_views.toLocaleString()} views (${clipper.submissions} clips)\n`;
      });

      const embed = createEmbed({
        title: '🏆 Top Clippers Leaderboard',
        description: description || 'No clippers yet!',
        color: 0xE31E24,
        footer: { text: 'Keep clipping to reach the top!' }
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Leaderboard error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to load leaderboard.')],
        ephemeral: true
      });
      }
    }
  }
};
