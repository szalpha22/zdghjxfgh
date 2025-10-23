const { db } = require('../database/init');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, campaignEmbed } = require('../utils/embeds');
const cron = require('node-cron');
const { startBudgetChecker } = require('../../cron/budgetChecker');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log('✅ Bot is ready!');

    await cacheInvites(client);
    await recreatePersistentMessages(client);
    startCronJobs(client);
  }
};

async function cacheInvites(client) {
  client.invites = new Map();
  
  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      client.invites.set(guild.id, invites);
    } catch (error) {
      console.error(`Failed to cache invites for ${guild.name}:`, error.message);
    }
  }
  
  console.log('✅ Invites cached');
}

async function recreatePersistentMessages(client) {
  try {
    const activeCampaignsChannel = process.env.ACTIVE_CAMPAIGNS_CHANNEL;
    const supportChannel = process.env.SUPPORT_CHANNEL;

    const campaigns = db.prepare('SELECT * FROM campaigns WHERE status = ?').all('active');
    
    for (const campaign of campaigns) {
      if (campaign.message_id && activeCampaignsChannel) {
        try {
          const channel = await client.channels.fetch(activeCampaignsChannel);
          await channel.messages.fetch(campaign.message_id);
          // Message exists, do nothing
        } catch (error) {
          // Message doesn't exist, only recreate if message_id was set
          console.log(`Campaign message for ${campaign.name} not found, skipping recreation to avoid duplicates`);
        }
      }
      // DO NOT create new messages automatically on restart
      // Messages are only created when campaigns are first added via /addcampaign
    }

    // Only check if support message exists, don't recreate on every restart
    if (supportChannel) {
      const stmt = db.prepare('SELECT * FROM persistent_messages WHERE type = ?');
      const existing = stmt.get('support');
      
      if (existing && existing.message_id) {
        try {
          const channel = await client.channels.fetch(supportChannel);
          await channel.messages.fetch(existing.message_id);
          // Message exists, do nothing
        } catch (error) {
          console.log('Support message not found, needs manual recreation with /setup command');
        }
      }
    }

    console.log('✅ Persistent messages recreated');
  } catch (error) {
    console.error('Error recreating persistent messages:', error);
  }
}

async function createCampaignMessage(client, campaign) {
  try {
    const channel = await client.channels.fetch(process.env.ACTIVE_CAMPAIGNS_CHANNEL);
    
    const embed = campaignEmbed(campaign);
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`campaign_join_${campaign.id}`)
          .setLabel('Join Campaign')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎬')
      );

    const message = await channel.send({ embeds: [embed], components: [row] });
    
    const updateStmt = db.prepare('UPDATE campaigns SET message_id = ? WHERE id = ?');
    updateStmt.run(message.id, campaign.id);
  } catch (error) {
    console.error(`Failed to create campaign message for ${campaign.name}:`, error.message);
  }
}

async function createSupportMessage(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);
    
    const stmt = db.prepare('SELECT * FROM persistent_messages WHERE type = ?');
    const existing = stmt.get('support');
    
    if (existing && existing.message_id) {
      try {
        await channel.messages.fetch(existing.message_id);
        return;
      } catch (error) {
      }
    }

    const embed = createEmbed({
      title: '🎟️ Support Tickets',
      description: 'Need help? Select the type of support you need below.\n\n' +
                   'Our staff team will assist you as soon as possible.',
      color: 0xE31E24,
      footer: { text: 'ClipHub Bot' }
    });

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket_business')
          .setLabel('Business Enquiries')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💼'),
        new ButtonBuilder()
          .setCustomId('open_ticket_campaign')
          .setLabel('Campaign Support')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📹')
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket_payment')
          .setLabel('Payment Issues')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💰'),
        new ButtonBuilder()
          .setCustomId('open_ticket_tech')
          .setLabel('Tech Support')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔧')
      );

    const message = await channel.send({ embeds: [embed], components: [row1, row2] });
    
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO persistent_messages (id, type, channel_id, message_id) 
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run('support_main', 'support', channelId, message.id);
  } catch (error) {
    console.error('Failed to create support message:', error.message);
  }
}

function startCronJobs(client) {
  cron.schedule('0 0 * * 0', async () => {
    console.log('Running weekly reports...');
    const { sendWeeklyReports } = require('../services/reports');
    await sendWeeklyReports(client);
  });

  // Start budget milestone checker
  startBudgetChecker(client);

  console.log('✅ Cron jobs started');
}
