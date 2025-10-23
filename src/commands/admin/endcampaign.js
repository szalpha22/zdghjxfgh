const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logCampaign } = require('../../utils/logger');
const { dmCampaignEnded } = require('../../utils/dmHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('endcampaign')
    .setDescription('End an active campaign')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Campaign name')
        .setRequired(true)),

  async execute(interaction) {
    const name = interaction.options.getString('name');

    await interaction.deferReply({ ephemeral: true });

    try {
      const campaign = db.prepare('SELECT * FROM campaigns WHERE name = ? AND status = ?')
        .get(name, 'active');

      if (!campaign) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Active campaign not found.')]
        });
      }

      const stmt = db.prepare('UPDATE campaigns SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run('ended', campaign.id);

      if (campaign.message_id) {
        try {
          const channel = await interaction.client.channels.fetch(process.env.ACTIVE_CAMPAIGNS_CHANNEL);
          const message = await channel.messages.fetch(campaign.message_id);
          await message.delete();
        } catch (error) {
          console.error('Failed to delete campaign message:', error);
        }
      }

      const members = db.prepare('SELECT user_id FROM campaign_members WHERE campaign_id = ?')
        .all(campaign.id);

      for (const member of members) {
        try {
          const user = await interaction.client.users.fetch(member.user_id);
          
          const stats = db.prepare(`
            SELECT 
              COUNT(*) as submissions,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN status = 'approved' THEN views ELSE 0 END) as views
            FROM submissions 
            WHERE user_id = ? AND campaign_id = ?
          `).get(member.user_id, campaign.id);

          const earned = ((stats.views || 0) / 1000) * campaign.rate_per_1k;

          await dmCampaignEnded(user, campaign, {
            submissions: stats.submissions || 0,
            approved: stats.approved || 0,
            views: stats.views || 0,
            earned: earned
          });
        } catch (error) {
          console.error(`Failed to DM user ${member.user_id}:`, error);
        }
      }

      await logCampaign(interaction.client, 'Ended', campaign, interaction.user);

      await interaction.editReply({
        embeds: [successEmbed('Campaign Ended', `Campaign **${name}** has been ended. All members have been notified.`)]
      });

    } catch (error) {
      console.error('End campaign error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to end campaign.')]
      });
    }
  }
};
