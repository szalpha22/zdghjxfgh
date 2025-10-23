const express = require('express');
const { db } = require('../database/init');
const { logCampaign } = require('../utils/logger');

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'cliphub_internal_secret_key_2025';
const API_PORT = 5001;

function createInternalAPI(client) {
  const app = express();
  app.use(express.json());

  const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  app.use(authenticate);

  app.post('/api/campaign/created', async (req, res) => {
    let createdRoleId = null;
    let createdChannelId = null;
    
    try {
      const { campaignId } = req.body;
      
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const guild = client.guilds.cache.first();
      if (!guild) {
        return res.status(500).json({ error: 'Bot not connected to server' });
      }

      let roleId = campaign.role_id;
      let channelId = campaign.channel_id;

      if (!roleId) {
        const role = await guild.roles.create({
          name: campaign.name,
          color: 0xE31E24,
          reason: `Campaign: ${campaign.name}`
        });
        roleId = role.id;
        createdRoleId = roleId;
        db.prepare('UPDATE campaigns SET role_id = ? WHERE id = ?').run(roleId, campaignId);
      }

      if (!channelId) {
        const channel = await guild.channels.create({
          name: campaign.name.toLowerCase().replace(/\s+/g, '-'),
          type: 0,
          reason: `Campaign: ${campaign.name}`
        });
        channelId = channel.id;
        createdChannelId = channelId;
        db.prepare('UPDATE campaigns SET channel_id = ? WHERE id = ?').run(channelId, campaignId);
      }

      const activeCampaignsChannel = process.env.ACTIVE_CAMPAIGNS_CHANNEL;
      if (activeCampaignsChannel) {
        const announcementChannel = await client.channels.fetch(activeCampaignsChannel);
        const { createEmbed } = require('../utils/embeds');
        
        const embed = createEmbed({
          title: `🎬 New Campaign: ${campaign.name}`,
          description: campaign.description,
          fields: [
            { name: '💰 Rate', value: `$${campaign.rate_per_1k}/1K views`, inline: true },
            { name: '📅 Duration', value: `${Math.ceil((new Date(campaign.end_date) - new Date(campaign.start_date)) / (1000 * 60 * 60 * 24))} days`, inline: true },
            { name: '📊 Platform', value: campaign.platform || 'Multiple', inline: true },
            { name: '💵 Budget', value: campaign.total_budget ? `$${campaign.total_budget}` : 'Unlimited', inline: true },
            { name: '📺 Channel', value: `<#${channelId}>`, inline: true },
            { name: '🎭 Role', value: `<@&${roleId}>`, inline: true }
          ],
          color: 0xE31E24,
          footer: { text: 'Join this campaign to start earning!' }
        });

        await announcementChannel.send({ embeds: [embed] });
      }

      res.json({ success: true, roleId, channelId });
    } catch (error) {
      console.error('Campaign created webhook error:', error);
      
      try {
        const guild = client.guilds.cache.first();
        if (createdRoleId) {
          const role = await guild.roles.fetch(createdRoleId).catch(() => null);
          if (role) await role.delete('Campaign creation failed - rollback');
          db.prepare('UPDATE campaigns SET role_id = NULL WHERE role_id = ?').run(createdRoleId);
        }
        if (createdChannelId) {
          const channel = await guild.channels.fetch(createdChannelId).catch(() => null);
          if (channel) await channel.delete('Campaign creation failed - rollback');
          db.prepare('UPDATE campaigns SET channel_id = NULL WHERE channel_id = ?').run(createdChannelId);
        }
      } catch (cleanupError) {
        console.error('Cleanup failed during rollback:', cleanupError);
      }
      
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaign/updated', async (req, res) => {
    try {
      const { campaignId } = req.body;
      
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const guild = client.guilds.cache.first();
      if (campaign.role_id) {
        const role = await guild.roles.fetch(campaign.role_id).catch(() => null);
        if (role) {
          await role.setName(campaign.name);
        }
      }

      if (campaign.channel_id) {
        const channel = await guild.channels.fetch(campaign.channel_id).catch(() => null);
        if (channel) {
          await channel.setName(campaign.name.toLowerCase().replace(/\s+/g, '-'));
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Campaign updated webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaign/ended', async (req, res) => {
    try {
      const { campaignId } = req.body;
      
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const guild = client.guilds.cache.first();

      if (campaign.channel_id) {
        const channel = await guild.channels.fetch(campaign.channel_id).catch(() => null);
        if (channel) {
          await channel.delete('Campaign ended');
        }
      }

      if (campaign.role_id) {
        const role = await guild.roles.fetch(campaign.role_id).catch(() => null);
        if (role) {
          await role.delete('Campaign ended');
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Campaign ended webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(API_PORT, '127.0.0.1', () => {
    console.log(`✅ Internal API running on http://127.0.0.1:${API_PORT}`);
  });

  return app;
}

module.exports = { createInternalAPI };
