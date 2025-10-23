const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../database/init');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { dmCampaignJoined } = require('../utils/dmHandler');
const { logCampaign } = require('../utils/logger');

async function handleCampaignJoin(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const campaignId = interaction.customId.split('_')[2];
    const userId = interaction.user.id;

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND status = ?')
      .get(campaignId, 'active');

    if (!campaign) {
      return await interaction.editReply({
        embeds: [errorEmbed('Error', 'This campaign is no longer active.')]
      });
    }

    const existing = db.prepare('SELECT id FROM campaign_members WHERE campaign_id = ? AND user_id = ?')
      .get(campaignId, userId);

    // Toggle functionality: if already joined, leave campaign
    if (existing) {
      // Remove from campaign
      const deleteStmt = db.prepare('DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?');
      deleteStmt.run(campaignId, userId);

      // Remove role
      if (campaign.role_id) {
        try {
          const member = await interaction.guild.members.fetch(userId);
          await member.roles.remove(campaign.role_id);
        } catch (error) {
          console.error('Failed to remove role:', error.message);
        }
      }

      await logCampaign(client, 'Left', interaction.user, campaign);

      return await interaction.editReply({
        embeds: [successEmbed('Campaign Left', `You've left **${campaign.name}**. You can rejoin anytime!`)]
      });
    }

    // Join campaign
    const userStmt = db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)');
    userStmt.run(userId, interaction.user.username);

    const stmt = db.prepare('INSERT INTO campaign_members (campaign_id, user_id) VALUES (?, ?)');
    stmt.run(campaignId, userId);

    if (campaign.role_id) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(campaign.role_id);
      } catch (error) {
        console.error('Failed to assign role:', error.message);
      }
    }

    await dmCampaignJoined(interaction.user, campaign);
    await logCampaign(client, 'Joined', interaction.user, campaign);

    await interaction.editReply({
      embeds: [successEmbed('Campaign Joined!', `You've successfully joined **${campaign.name}**!\n\nPress the button again to leave this campaign.`)]
    });

  } catch (error) {
    console.error('Error in campaign toggle:', error);
    const reply = {
      embeds: [errorEmbed('Error', 'Failed to process campaign request.')]
    };
    if (interaction.deferred) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply({ ...reply, ephemeral: true });
    }
  }
}

module.exports = {
  handleCampaignJoin
};
