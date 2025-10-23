const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed, campaignEmbed } = require('../../utils/embeds');
const { logCampaign } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcampaign')
    .setDescription('Create a new campaign')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Campaign name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Campaign description')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Campaign type')
        .setRequired(true)
        .addChoices(
          { name: 'Clipping', value: 'Clipping' },
          { name: 'Reposting', value: 'Reposting' },
          { name: 'UGC', value: 'UGC' }
        ))
    .addStringOption(option =>
      option.setName('platforms')
        .setDescription('Allowed platforms (comma-separated: YouTube,TikTok,Instagram,Twitter)')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('rate')
        .setDescription('Rate per 1K views in USD')
        .setRequired(true)
        .setMinValue(0.01))
    .addNumberOption(option =>
      option.setName('budget')
        .setDescription('Total campaign budget in USD')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('content_source')
        .setDescription('Content source or brand info')
        .setRequired(false)),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const type = interaction.options.getString('type');
    const platformsStr = interaction.options.getString('platforms');
    const rate = interaction.options.getNumber('rate');
    const budget = interaction.options.getNumber('budget');
    const contentSource = interaction.options.getString('content_source');

    await interaction.deferReply({ ephemeral: true });

    try {
      const platforms = platformsStr.split(',').map(p => p.trim());
      const validPlatforms = ['YouTube', 'TikTok', 'Instagram', 'Twitter'];
      
      const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        return await interaction.editReply({
          embeds: [errorEmbed('Invalid Platforms', `Invalid platforms: ${invalidPlatforms.join(', ')}\nValid: ${validPlatforms.join(', ')}`)]
        });
      }

      // Create role with campaign name
      const guild = interaction.guild;
      const campaignRole = await guild.roles.create({
        name: `📹 ${name}`,
        color: 0xE31E24, // Red color
        reason: `Campaign role for ${name}`
      });

      // Create category and 4 channels
      const category = await guild.channels.create({
        name: `📹 ${name}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: campaignRole.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          }
        ]
      });

      // Create 4 channels in the category
      const generalChannel = await guild.channels.create({
        name: `${name.toLowerCase().replace(/\s+/g, '-')}-general`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `General chat for ${name} campaign members`
      });

      const announcementsChannel = await guild.channels.create({
        name: `${name.toLowerCase().replace(/\s+/g, '-')}-announcements`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Campaign updates and progress notifications`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: campaignRole.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages]
          }
        ]
      });

      const submissionsChannel = await guild.channels.create({
        name: `${name.toLowerCase().replace(/\s+/g, '-')}-submissions`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Submit your clips here`
      });

      const leaderboardChannel = await guild.channels.create({
        name: `${name.toLowerCase().replace(/\s+/g, '-')}-leaderboard`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Top performers for ${name}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: campaignRole.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages]
          }
        ]
      });

      // Insert campaign into database with all new fields
      const stmt = db.prepare(`
        INSERT INTO campaigns (
          name, description, type, platforms, content_source, rate_per_1k, 
          total_budget, budget_spent, role_id, category_id, 
          general_channel_id, announcements_channel_id, submissions_channel_id, leaderboard_channel_id,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        name,
        description,
        type,
        JSON.stringify(platforms),
        contentSource,
        rate,
        budget,
        0, // budget_spent starts at 0
        campaignRole.id,
        category.id,
        generalChannel.id,
        announcementsChannel.id,
        submissionsChannel.id,
        leaderboardChannel.id,
        'active'
      );

      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);

      // Post to active campaigns channel
      const activeCampaignsChannel = process.env.ACTIVE_CAMPAIGNS_CHANNEL;
      if (activeCampaignsChannel) {
        const channel = await interaction.client.channels.fetch(activeCampaignsChannel);
        
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
      }

      // Send welcome message to announcements channel
      await announcementsChannel.send({
        embeds: [successEmbed(
          `🎬 Welcome to ${name}!`,
          `**Campaign Type:** ${type}\n` +
          `**Platforms:** ${platforms.join(', ')}\n` +
          `**Rate:** $${rate} per 1K views\n` +
          `**Total Budget:** $${budget}\n\n` +
          `Use the channels to collaborate, submit clips, and track your progress!\n\n` +
          `**Budget Progress:** $0 / $${budget} (0%)`
        )]
      });

      await logCampaign(interaction.client, 'Created', campaign, interaction.user);

      await interaction.editReply({
        embeds: [successEmbed(
          'Campaign Created Successfully! 🎉',
          `Campaign **${name}** has been created!\n\n` +
          `✅ Role: <@&${campaignRole.id}>\n` +
          `✅ Category: ${category.name}\n` +
          `✅ Channels: <#${generalChannel.id}>, <#${announcementsChannel.id}>, <#${submissionsChannel.id}>, <#${leaderboardChannel.id}>\n` +
          `✅ Budget: $${budget}\n\n` +
          `Users who join will automatically get the role and access to all channels!`
        )]
      });

    } catch (error) {
      console.error('Add campaign error:', error);
      try {
        await interaction.editReply({
          embeds: [errorEmbed('Error', error.message.includes('UNIQUE') ? 'A campaign with this name already exists!' : 'Failed to create campaign.')]
        });
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }
};
