const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { createEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topinvites')
    .setDescription('View top inviters'),

  async execute(interaction) {
    try {
      const topInviters = db.prepare(`
        SELECT 
          inviter_id,
          COUNT(*) as total,
          COUNT(CASE WHEN left_at IS NULL THEN 1 END) as current,
          COUNT(CASE WHEN is_fake = 0 THEN 1 END) as real
        FROM invites
        WHERE inviter_id IS NOT NULL
        GROUP BY inviter_id
        ORDER BY real DESC, current DESC
        LIMIT 10
      `).all();

      let description = '';
      const medals = ['🥇', '🥈', '🥉'];

      topInviters.forEach((inviter, index) => {
        const medal = medals[index] || `${index + 1}.`;
        description += `${medal} <@${inviter.inviter_id}> - ${inviter.real} real (${inviter.current} active)\n`;
      });

      const embed = createEmbed({
        title: '🏆 Top Inviters',
        description: description || 'No invites tracked yet!',
        color: 0xE31E24
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Top invites error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to load top inviters.')],
        ephemeral: true
      });
      }
    }
  }
};
