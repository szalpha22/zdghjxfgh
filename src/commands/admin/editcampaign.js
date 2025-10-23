const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logCampaign } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editcampaign')
    .setDescription('Edit an existing campaign')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('Campaign ID to edit')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('New campaign name (leave empty to keep current)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('New description (leave empty to keep current)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('New campaign type (leave empty to keep current)')
        .setRequired(false)
        .addChoices(
          { name: 'Clipping', value: 'Clipping' },
          { name: 'Reposting', value: 'Reposting' },
          { name: 'UGC', value: 'UGC' }
        ))
    .addNumberOption(option =>
      option.setName('rate')
        .setDescription('New rate per 1K views (leave empty to keep current)')
        .setRequired(false)
        .setMinValue(0.01))
    .addNumberOption(option =>
      option.setName('budget')
        .setDescription('New total budget (leave empty to keep current)')
        .setRequired(false)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('platforms')
        .setDescription('New platforms (comma-separated: YouTube,TikTok,Instagram,Twitter)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      // Defer IMMEDIATELY - don't await anything before this
      await interaction.deferReply({ flags: 64 }); // 64 = ephemeral
    } catch (deferError) {
      console.error('Failed to defer reply:', deferError.message);
      return; // Exit if we can't defer
    }
    
    const campaignId = interaction.options.getInteger('id');
    const newName = interaction.options.getString('name');
    const newDescription = interaction.options.getString('description');
    const newType = interaction.options.getString('type');
    const newRate = interaction.options.getNumber('rate');
    const newBudget = interaction.options.getNumber('budget');
    const newPlatformsStr = interaction.options.getString('platforms');

    try {
      // Check if campaign exists
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      if (!campaign) {
        return await interaction.editReply({
          embeds: [errorEmbed('Campaign Not Found', `No campaign found with ID ${campaignId}`)]
        });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (newName) {
        // Check if new name already exists
        const existing = db.prepare('SELECT id FROM campaigns WHERE name = ? AND id != ?').get(newName, campaignId);
        if (existing) {
          return await interaction.editReply({
            embeds: [errorEmbed('Duplicate Name', 'A campaign with this name already exists!')]
          });
        }
        updates.push('name = ?');
        values.push(newName);
      }

      if (newDescription) {
        updates.push('description = ?');
        values.push(newDescription);
      }

      if (newType) {
        updates.push('type = ?');
        values.push(newType);
      }

      if (newRate) {
        updates.push('rate_per_1k = ?');
        values.push(newRate);
      }

      if (newBudget) {
        updates.push('total_budget = ?');
        values.push(newBudget);
      }

      if (newPlatformsStr) {
        const platforms = newPlatformsStr.split(',').map(p => p.trim());
        const validPlatforms = ['YouTube', 'TikTok', 'Instagram', 'Twitter'];
        
        const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
        if (invalidPlatforms.length > 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('Invalid Platforms', `Invalid platforms: ${invalidPlatforms.join(', ')}\nValid: ${validPlatforms.join(', ')}`)]
          });
        }
        
        updates.push('platforms = ?');
        values.push(JSON.stringify(platforms));
      }

      // If no updates provided
      if (updates.length === 0) {
        return await interaction.editReply({
          embeds: [errorEmbed('No Changes', 'You must provide at least one field to update!')]
        });
      }

      // Add campaign ID to values for WHERE clause
      values.push(campaignId);

      // Execute update
      const stmt = db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      // Update Discord role/channel if name changed
      if (newName && campaign.role_id) {
        try {
          const guild = interaction.guild;
          const role = await guild.roles.fetch(campaign.role_id);
          if (role) {
            await role.edit({ name: `📹 ${newName}` });
          }

          const category = await guild.channels.fetch(campaign.category_id);
          if (category) {
            await category.edit({ name: `📹 ${newName}` });
          }

          // Update all channels
          if (campaign.general_channel_id) {
            const generalChannel = await guild.channels.fetch(campaign.general_channel_id);
            if (generalChannel) {
              await generalChannel.edit({ name: `${newName.toLowerCase().replace(/\s+/g, '-')}-general` });
            }
          }

          if (campaign.announcements_channel_id) {
            const announcementsChannel = await guild.channels.fetch(campaign.announcements_channel_id);
            if (announcementsChannel) {
              await announcementsChannel.edit({ name: `${newName.toLowerCase().replace(/\s+/g, '-')}-announcements` });
            }
          }

          if (campaign.submissions_channel_id) {
            const submissionsChannel = await guild.channels.fetch(campaign.submissions_channel_id);
            if (submissionsChannel) {
              await submissionsChannel.edit({ name: `${newName.toLowerCase().replace(/\s+/g, '-')}-submissions` });
            }
          }

          if (campaign.leaderboard_channel_id) {
            const leaderboardChannel = await guild.channels.fetch(campaign.leaderboard_channel_id);
            if (leaderboardChannel) {
              await leaderboardChannel.edit({ name: `${newName.toLowerCase().replace(/\s+/g, '-')}-leaderboard` });
            }
          }
        } catch (error) {
          console.error('Failed to update Discord resources:', error);
        }
      }

      // Get updated campaign
      const updatedCampaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);

      // Update active campaigns channel message if it exists
      if (campaign.message_id) {
        try {
          const activeCampaignsChannel = process.env.ACTIVE_CAMPAIGNS_CHANNEL;
          if (activeCampaignsChannel) {
            const channel = await interaction.client.channels.fetch(activeCampaignsChannel);
            if (channel) {
              const message = await channel.messages.fetch(campaign.message_id);
              if (message) {
                const { campaignEmbed } = require('../../utils/embeds');
                const updatedEmbed = campaignEmbed(updatedCampaign);
                
                await message.edit({ embeds: [updatedEmbed] });
                console.log(`✅ Updated announcement message for campaign ${updatedCampaign.name}`);
              }
            }
          }
        } catch (error) {
          console.error('Failed to update announcement message:', error.message);
          // Don't fail the entire command if announcement update fails
        }
      }

      await logCampaign(interaction.client, 'Edited', updatedCampaign, interaction.user);

      const changes = [];
      if (newName) changes.push(`Name: ${campaign.name} → ${newName}`);
      if (newDescription) changes.push(`Description updated`);
      if (newType) changes.push(`Type: ${campaign.type} → ${newType}`);
      if (newRate) changes.push(`Rate: $${campaign.rate_per_1k} → $${newRate}`);
      if (newBudget) changes.push(`Budget: $${campaign.total_budget} → $${newBudget}`);
      if (newPlatformsStr) {
        const oldPlatforms = JSON.parse(campaign.platforms || '[]');
        const newPlatforms = JSON.parse(updatedCampaign.platforms || '[]');
        changes.push(`Platforms: ${oldPlatforms.join(', ')} → ${newPlatforms.join(', ')}`);
      }

      await interaction.editReply({
        embeds: [successEmbed(
          'Campaign Updated! ✅',
          `Successfully updated campaign **${updatedCampaign.name}**\n\n` +
          `**Changes:**\n${changes.map(c => `• ${c}`).join('\n')}`
        )]
      });

    } catch (error) {
      console.error('Edit campaign error:', error);
      console.error('Error stack:', error.stack);
      
      try {
        await interaction.editReply({
          embeds: [errorEmbed('Error', `Failed to edit campaign: ${error.message}`)]
        });
      } catch (replyError) {
        console.error('Could not send error reply:', replyError.message);
      }
    }
  }
};
