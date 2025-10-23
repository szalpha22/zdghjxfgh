const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const CATEGORIES = {
  developer: { name: 'Developer', emoji: '💻', adminOnly: true },
  admin: { name: 'Admin', emoji: '👑', adminOnly: true },
  moderation: { name: 'Moderation', emoji: '🛡️', adminOnly: true },
  campaign: { name: 'Campaign', emoji: '🎬', adminOnly: false },
  payout: { name: 'Payout', emoji: '💰', adminOnly: false },
  tickets: { name: 'Tickets', emoji: '🎟️', adminOnly: false },
  invites: { name: 'Invites', emoji: '📨', adminOnly: false },
  utility: { name: 'Utility', emoji: 'ℹ️', adminOnly: false },
  fun: { name: 'Fun & Social', emoji: '🎉', adminOnly: false },
  general: { name: 'General', emoji: '📚', adminOnly: false }
};

function categorizeCommand(command) {
  const name = command.data.name.toLowerCase();
  const hasAdminPerm = command.data.default_member_permissions?.has?.(PermissionFlagsBits.Administrator) || 
                       command.data.default_member_permissions === PermissionFlagsBits.Administrator;
  
  if (['eval', 'reload', 'setconfig', 'stats', 'viewdb', 'restoredb', 'backupdb'].includes(name)) {
    return 'developer';
  }
  if (hasAdminPerm || ['addcampaign', 'endcampaign', 'approve', 'banclipper', 'bonus', 'massdm', 'exportdata', 'approvepayout', 'rejectpayout', 'approveclip', 'rejectclip', 'flagclip'].includes(name)) {
    return 'admin';
  }
  if (['kick', 'ban', 'unban', 'timeout', 'warn', 'warnings', 'clear', 'mute', 'unmute', 'slowmode', 'lock', 'unlock', 'prune', 'roleadd', 'roleremove', 'nuke'].includes(name)) {
    return 'moderation';
  }
  if (['submit', 'profile', 'leaderboard'].includes(name)) {
    return 'campaign';
  }
  if (['setpayout', 'requestpayout'].includes(name)) {
    return 'payout';
  }
  if (['closeticket', 'reopen', 'claimticket'].includes(name)) {
    return 'tickets';
  }
  if (['invites', 'topinvites', 'resetinvites', 'rewardinviter'].includes(name)) {
    return 'invites';
  }
  if (['ping', 'uptime', 'avatar', 'userinfo', 'serverinfo', 'channelinfo', 'botinfo'].includes(name)) {
    return 'utility';
  }
  if (['poll', 'announce', 'quote', 'tag'].includes(name)) {
    return 'fun';
  }
  return 'general';
}

function createHelpEmbed(commands, category, page, totalPages, isAdmin) {
  // Validate category exists
  if (!CATEGORIES[category]) {
    category = 'general';
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setTitle(`${CATEGORIES[category].emoji} ${CATEGORIES[category].name} Commands`)
    .setDescription(`All ${CATEGORIES[category].name.toLowerCase()} commands available`)
    .setFooter({ text: `ClipHub Bot • Page ${page}/${totalPages} • Use the buttons to navigate` })
    .setTimestamp();

  const commandsPerPage = 8;
  const start = (page - 1) * commandsPerPage;
  const end = start + commandsPerPage;
  const pageCommands = commands.slice(start, end);

  pageCommands.forEach(cmd => {
    const description = cmd.data.description || 'No description';
    const usage = cmd.usage || `/${cmd.data.name}`;
    embed.addFields({
      name: `/${cmd.data.name}`,
      value: `${description}\n**Usage:** \`${usage}\``,
      inline: false
    });
  });

  if (pageCommands.length === 0) {
    embed.setDescription('No commands found in this category.');
  }

  return embed;
}

function createMainEmbed(commandsByCategory, isAdmin) {
  const embed = new EmbedBuilder()
    .setColor(0xE31E24)
    .setTitle('📚 ClipHub Bot - Command Center')
    .setDescription('**Welcome to ClipHub!**\nClick the buttons below to view commands by category.\n\n' +
      'Use the search feature to find specific commands by keyword.')
    .setTimestamp()
    .setFooter({ text: 'ClipHub Bot' });

  for (const [categoryKey, category] of Object.entries(CATEGORIES)) {
    if (category.adminOnly && !isAdmin) continue;
    
    const count = commandsByCategory[categoryKey]?.length || 0;
    if (count > 0) {
      embed.addFields({
        name: `${category.emoji} ${category.name}`,
        value: `${count} command${count !== 1 ? 's' : ''} available`,
        inline: true
      });
    }
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands')
    .addStringOption(option =>
      option.setName('search')
        .setDescription('Search for a specific command')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('View commands from a specific category')
        .setRequired(false)
        .addChoices(
          { name: 'Campaign', value: 'campaign' },
          { name: 'Payout', value: 'payout' },
          { name: 'Tickets', value: 'tickets' },
          { name: 'Invites', value: 'invites' },
          { name: 'Utility', value: 'utility' },
          { name: 'Fun & Social', value: 'fun' },
          { name: 'General', value: 'general' },
          { name: 'Admin', value: 'admin' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Developer', value: 'developer' }
        )),

  async execute(interaction) {
    const search = interaction.options.getString('search');
    const categoryFilter = interaction.options.getString('category');
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    const allCommands = Array.from(interaction.client.commands.values());
    
    if (search) {
      const searchResults = allCommands.filter(cmd => {
        const cmdCategory = categorizeCommand(cmd);
        if (CATEGORIES[cmdCategory].adminOnly && !isAdmin) return false;
        
        return cmd.data.name.toLowerCase().includes(search.toLowerCase()) ||
               cmd.data.description.toLowerCase().includes(search.toLowerCase());
      });

      if (searchResults.length === 0) {
        return await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x8B0F14)
            .setTitle('❌ No Results Found')
            .setDescription(`No commands found matching "${search}"`)
          ],
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle(`🔍 Search Results for "${search}"`)
        .setDescription(`Found ${searchResults.length} command${searchResults.length !== 1 ? 's' : ''}`)
        .setTimestamp();

      searchResults.slice(0, 10).forEach(cmd => {
        const category = categorizeCommand(cmd);
        embed.addFields({
          name: `/${cmd.data.name}`,
          value: `${cmd.data.description}\n**Category:** ${CATEGORIES[category].emoji} ${CATEGORIES[category].name}`,
          inline: false
        });
      });

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const commandsByCategory = {};
    for (const categoryKey of Object.keys(CATEGORIES)) {
      commandsByCategory[categoryKey] = [];
    }

    allCommands.forEach(cmd => {
      const category = categorizeCommand(cmd);
      if (CATEGORIES[category].adminOnly && !isAdmin) return;
      commandsByCategory[category].push(cmd);
    });

    if (categoryFilter) {
      const commands = commandsByCategory[categoryFilter] || [];
      if (commands.length === 0) {
        return await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x8B0F14)
            .setTitle('❌ No Commands')
            .setDescription(`No commands found in ${CATEGORIES[categoryFilter].name} category`)
          ],
          ephemeral: true
        });
      }

      const totalPages = Math.ceil(commands.length / 8);
      let currentPage = 1;

      const embed = createHelpEmbed(commands, categoryFilter, currentPage, totalPages, isAdmin);
      
      if (totalPages > 1) {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('help_prev')
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('help_next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
          );

        const response = await interaction.reply({ embeds: [embed], components: [row] });
        
        const collector = response.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
          }

          if (i.customId === 'help_next') currentPage++;
          if (i.customId === 'help_prev') currentPage--;

          const newEmbed = createHelpEmbed(commands, categoryFilter, currentPage, totalPages, isAdmin);
          const newRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('help_prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
              new ButtonBuilder()
                .setCustomId('help_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages)
            );

          await i.update({ embeds: [newEmbed], components: [newRow] });
        });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
    } else {
      const mainEmbed = createMainEmbed(commandsByCategory, isAdmin);
      
      const rows = [];
      const categoryButtons = [];
      
      for (const [key, category] of Object.entries(CATEGORIES)) {
        if (category.adminOnly && !isAdmin) continue;
        if ((commandsByCategory[key]?.length || 0) === 0) continue;
        
        categoryButtons.push(
          new ButtonBuilder()
            .setCustomId(`help_cat_${key}`)
            .setLabel(category.name)
            .setEmoji(category.emoji)
            .setStyle(ButtonStyle.Secondary)
        );
      }

      for (let i = 0; i < categoryButtons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(categoryButtons.slice(i, i + 5)));
      }

      const response = await interaction.reply({ embeds: [mainEmbed], components: rows });

      const collector = response.createMessageComponentCollector({ time: 300000 });
      let categoryCollector = null;

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'These buttons are not for you!', ephemeral: true }).catch(() => {});
        }

        // Handle back button
        if (i.customId === 'help_back') {
          if (categoryCollector) {
            categoryCollector.stop();
            categoryCollector = null;
          }
          
          try {
            await i.update({ embeds: [mainEmbed], components: rows });
          } catch (error) {
            if (error.code !== 10062 && error.code !== 40060) {
              console.error('Error updating help interaction:', error);
            }
          }
          return;
        }

        // Handle category pagination
        const categoryKey = i.customId.replace('help_cat_', '').replace('_prev', '').replace('_next', '');
        
        if (i.customId.includes('_prev') || i.customId.includes('_next')) {
          // This is handled by the category-specific logic below
          return;
        }

        // Handle category selection
        const commands = commandsByCategory[categoryKey] || [];
        const totalPages = Math.ceil(commands.length / 8);
        let currentPage = 1;
        
        const embed = createHelpEmbed(commands, categoryKey, currentPage, totalPages, isAdmin);
        
        const categoryRow = new ActionRowBuilder();
        
        if (totalPages > 1) {
          categoryRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`help_cat_prev_${categoryKey}`)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`help_cat_next_${categoryKey}`)
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('help_back')
              .setLabel('Back to Menu')
              .setStyle(ButtonStyle.Danger)
          );
        } else {
          categoryRow.addComponents(
            new ButtonBuilder()
              .setCustomId('help_back')
              .setLabel('Back to Menu')
              .setStyle(ButtonStyle.Danger)
          );
        }
        
        try {
          await i.update({ embeds: [embed], components: [categoryRow] });
        } catch (error) {
          if (error.code !== 10062 && error.code !== 40060) {
            console.error('Error updating help interaction:', error);
          }
          return;
        }
        
        // Stop previous category collector if exists
        if (categoryCollector) {
          categoryCollector.stop();
        }
        
        // Create new category collector
        categoryCollector = i.message.createMessageComponentCollector({ time: 300000 });
        
        categoryCollector.on('collect', async ci => {
          if (ci.user.id !== interaction.user.id) {
            return ci.reply({ content: 'These buttons are not for you!', ephemeral: true }).catch(() => {});
          }
          
          // Handle back to menu - let parent collector handle it
          if (ci.customId === 'help_back') {
            categoryCollector.stop();
            categoryCollector = null;
            
            try {
              await ci.update({ embeds: [mainEmbed], components: rows });
            } catch (error) {
              if (error.code !== 10062 && error.code !== 40060) {
                console.error('Error updating help interaction:', error);
              }
            }
            return;
          }
          
          if (ci.customId === `help_cat_next_${categoryKey}`) currentPage++;
          if (ci.customId === `help_cat_prev_${categoryKey}`) currentPage--;
          
          const newEmbed = createHelpEmbed(commands, categoryKey, currentPage, totalPages, isAdmin);
          const newRow = new ActionRowBuilder();
          
          if (totalPages > 1) {
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`help_cat_prev_${categoryKey}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
              new ButtonBuilder()
                .setCustomId(`help_cat_next_${categoryKey}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages),
              new ButtonBuilder()
                .setCustomId('help_back')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Danger)
            );
          } else {
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId('help_back')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Danger)
            );
          }
          
          try {
            await ci.update({ embeds: [newEmbed], components: [newRow] });
          } catch (error) {
            if (error.code !== 10062 && error.code !== 40060) {
              console.error('Error updating help interaction:', error);
            }
          }
        });
      });
    }
  }
};
