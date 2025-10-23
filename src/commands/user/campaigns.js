const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../database/init');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('campaigns')
    .setDescription('View all active campaigns'),

  async execute(interaction) {
    try {
      const campaigns = db.prepare(`
        SELECT * FROM campaigns 
        WHERE status = 'active'
        ORDER BY created_at DESC
      `).all();

      if (campaigns.length === 0) {
        return await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('📹 No Active Campaigns')
            .setDescription('There are currently no active campaigns. Check back later!')
            .setFooter({ text: 'ClipHub Bot' })
          ],
          ephemeral: true
        });
      }

      let currentPage = 0;
      const campaignsPerPage = 1;
      const totalPages = campaigns.length;

      const generateEmbed = (page) => {
        const campaign = campaigns[page];
        const platforms = JSON.parse(campaign.platforms);
        
        // Get member count
        const memberCount = db.prepare(`
          SELECT COUNT(*) as count FROM campaign_members WHERE campaign_id = ?
        `).get(campaign.id);

        // Check if user has joined
        const userJoined = db.prepare(`
          SELECT id FROM campaign_members WHERE campaign_id = ? AND user_id = ?
        `).get(campaign.id, interaction.user.id);

        return new EmbedBuilder()
          .setColor(0xE31E24)
          .setTitle(`📹 ${campaign.name}`)
          .setDescription(campaign.description || 'No description provided')
          .addFields(
            { name: '🎬 Type', value: campaign.type, inline: true },
            { name: '📱 Platforms', value: platforms.join(', '), inline: true },
            { name: '💰 Rate', value: `$${campaign.rate_per_1k}/1K views`, inline: true },
            { name: '📺 Content Source', value: campaign.content_source || 'Not specified', inline: false },
            { name: '👥 Members', value: `${memberCount.count || 0} clippers joined`, inline: true },
            { name: '📊 Status', value: userJoined ? '✅ **You joined this campaign**' : '➕ Click join below', inline: true }
          )
          .setFooter({ text: `Campaign ${page + 1} of ${totalPages} • ID: ${campaign.id}` })
          .setTimestamp();
      };

      const generateButtons = (page) => {
        const campaign = campaigns[page];
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('campaigns_prev')
              .setLabel('◀ Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('campaigns_next')
              .setLabel('Next ▶')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
              .setCustomId(`campaign_join_${campaign.id}`)
              .setLabel('Join Campaign')
              .setStyle(ButtonStyle.Success)
          );
        return row;
      };

      const embed = generateEmbed(currentPage);
      const row = generateButtons(currentPage);

      const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
        fetchReply: true
      });

      const collector = response.createMessageComponentCollector({ time: 300000 });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: '❌ These buttons are not for you!', ephemeral: true });
        }

        if (i.customId === 'campaigns_next') {
          currentPage++;
        } else if (i.customId === 'campaigns_prev') {
          currentPage--;
        } else if (i.customId.startsWith('campaign_join_')) {
          // Let the campaign handler deal with this
          return;
        }

        const newEmbed = generateEmbed(currentPage);
        const newRow = generateButtons(currentPage);

        await i.update({ embeds: [newEmbed], components: [newRow] });
      });

      collector.on('end', () => {
        // Disable buttons after timeout
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('campaigns_prev')
              .setLabel('◀ Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('campaigns_next')
              .setLabel('Next ▶')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('campaigns_expired')
              .setLabel('Expired')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );
        
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      });

    } catch (error) {
      console.error('Error in campaigns command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        content: '❌ An error occurred while fetching campaigns.',
        ephemeral: true
      });
      }
    }
  }
};
