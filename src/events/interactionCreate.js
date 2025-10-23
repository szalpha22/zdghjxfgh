const { logCommand, logError } = require('../utils/logger');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        return await interaction.reply({ 
          embeds: [errorEmbed('Error', 'Command not found!')], 
          ephemeral: true 
        });
      }

      try {
        // Execute command FIRST, log in background (don't await)
        logCommand(client, interaction).catch(err => console.error('Logging error:', err));
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        await logError(client, error, `Command: ${interaction.commandName}`);
        
        try {
          const errorResponse = { 
            embeds: [errorEmbed('Error', 'There was an error executing this command!')], 
            ephemeral: true 
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorResponse);
          } else {
            await interaction.reply(errorResponse);
          }
        } catch (replyError) {
          // Interaction was already handled, ignore
          console.error('Could not send error reply (already handled):', replyError.message);
        }
      }
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`Error in autocomplete for ${interaction.commandName}:`, error);
      }
    } else if (interaction.isButton()) {
      try {
        const { customId } = interaction;

        if (customId.startsWith('campaign_join_')) {
          const { handleCampaignJoin } = require('../handlers/campaigns');
          await handleCampaignJoin(interaction, client);
        } else if (customId.startsWith('open_ticket_')) {
          const { handleTicketOpen } = require('../handlers/ticket');
          await handleTicketOpen(interaction, client);
        } else if (customId.startsWith('close_ticket_')) {
          const closeTicketCommand = client.commands.get('closeticket');
          if (closeTicketCommand) {
            await closeTicketCommand.execute(interaction, client);
          }
        } else if (customId.startsWith('approve_payout_')) {
          const payoutId = parseInt(customId.split('_')[2]);
          const approveCommand = client.commands.get('approvepayout');
          if (approveCommand) {
            interaction.options = {
              getInteger: (name) => payoutId
            };
            await approveCommand.execute(interaction, client);
          }
        } else if (customId.startsWith('reject_payout_')) {
          await interaction.reply({
            embeds: [errorEmbed('Rejection Reason Required', 'Please use `/rejectpayout` command to reject with a reason.')],
            ephemeral: true
          });
        } else if (customId.startsWith('approve_clip_')) {
          const clipId = parseInt(customId.split('_')[2]);
          const approveCommand = client.commands.get('approveclip');
          if (approveCommand) {
            interaction.options = {
              getInteger: (name) => clipId
            };
            await approveCommand.execute(interaction, client);
          }
        } else if (customId.startsWith('reject_clip_')) {
          await interaction.reply({
            embeds: [errorEmbed('Rejection Reason Required', 'Please use `/rejectclip` command to reject with a reason.')],
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Button interaction error:', error);
        await logError(client, error, 'Button Interaction');
        const errorResponse = { 
          embeds: [errorEmbed('Error', 'Failed to process button interaction.')], 
          ephemeral: true 
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorResponse);
        } else {
          await interaction.reply(errorResponse);
        }
      }
    }
  }
};
