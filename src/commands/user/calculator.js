const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calculator')
    .setDescription('Calculate potential earnings from views')
    .addIntegerOption(option =>
      option.setName('views')
        .setDescription('Number of views')
        .setRequired(true)
        .setMinValue(1))
    .addNumberOption(option =>
      option.setName('rate')
        .setDescription('Rate per 1K views (default: check campaign rates)')
        .setRequired(false)
        .setMinValue(0.01)),

  async execute(interaction) {
    try {
      const views = interaction.options.getInteger('views');
      const rate = interaction.options.getNumber('rate');

      const { db } = require('../../database/init');

      // If no rate provided, try to get user's average campaign rate
      let calculatedRate = rate;
      if (!rate) {
        const avgRate = db.prepare(`
          SELECT AVG(c.rate_per_1k) as avg_rate
          FROM campaigns c
          JOIN campaign_members cm ON c.id = cm.campaign_id
          WHERE cm.user_id = ? AND c.status = 'active'
        `).get(interaction.user.id);

        calculatedRate = avgRate?.avg_rate || 5.0; // Default to $5 if no campaigns joined
      }

      const earnings = (views / 1000) * calculatedRate;

      // Calculate milestones
      const milestones = [
        { views: 10000, earnings: (10000 / 1000) * calculatedRate },
        { views: 50000, earnings: (50000 / 1000) * calculatedRate },
        { views: 100000, earnings: (100000 / 1000) * calculatedRate },
        { views: 500000, earnings: (500000 / 1000) * calculatedRate },
        { views: 1000000, earnings: (1000000 / 1000) * calculatedRate }
      ];

      const embed = new EmbedBuilder()
        .setColor(0xE31E24)
        .setTitle('💰 Earnings Calculator')
        .setDescription(`Calculate your potential earnings based on views and rates`)
        .addFields(
          { 
            name: '👁️ Views', 
            value: `**${views.toLocaleString()}** views`, 
            inline: true 
          },
          { 
            name: '💵 Rate', 
            value: `**$${calculatedRate.toFixed(2)}** per 1K views`, 
            inline: true 
          },
          { 
            name: '💰 Earnings', 
            value: `**$${earnings.toFixed(2)}**`, 
            inline: true 
          },
          {
            name: '📈 Milestone Projections',
            value: milestones
              .map(m => `**${(m.views / 1000)}K views** → $${m.earnings.toFixed(2)}`)
              .join('\n'),
            inline: false
          },
          {
            name: '💡 Pro Tip',
            value: 'Higher quality content = more views = more earnings! Focus on creating engaging content that follows campaign guidelines.',
            inline: false
          }
        )
        .setFooter({ text: 'ClipHub Bot • These are estimates based on the rate provided' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error in calculator command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        content: '❌ An error occurred while calculating earnings.',
        ephemeral: true
      });
      }
    }
  }
};
