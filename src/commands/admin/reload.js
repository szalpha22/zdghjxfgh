const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('[DEVELOPER ONLY] Reload a command')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Command to reload')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices = Array.from(interaction.client.commands.keys());
    const filtered = choices.filter(choice => choice.startsWith(focusedValue)).slice(0, 25);
    await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
  },

  async execute(interaction) {
    const developerId = process.env.DEVELOPER_ID;
    
    if (interaction.user.id !== developerId && interaction.guild.ownerId !== interaction.user.id) {
      return await interaction.reply({
        embeds: [errorEmbed('Unauthorized', 'This command is only available to the bot developer.')],
        ephemeral: true
      });
    }

    const commandName = interaction.options.getString('command');
    const command = interaction.client.commands.get(commandName);

    if (!command) {
      return await interaction.reply({
        embeds: [errorEmbed('Not Found', `Command \`${commandName}\` not found.`)],
        ephemeral: true
      });
    }

    try {
      const path = require('path');
      const fs = require('fs');
      
      let commandPath;
      const commandFolders = ['admin', 'user'];
      
      for (const folder of commandFolders) {
        const filePath = path.join(__dirname, '..', folder, `${command.data.name}.js`);
        if (fs.existsSync(filePath)) {
          commandPath = filePath;
          break;
        }
      }
      
      if (!commandPath) {
        return await interaction.reply({
          embeds: [errorEmbed('Not Found', `Could not find command file for \`${commandName}\`.`)],
          ephemeral: true
        });
      }
                          
      delete require.cache[require.resolve(commandPath)];
      const newCommand = require(commandPath);
      interaction.client.commands.set(newCommand.data.name, newCommand);

      await interaction.reply({
        embeds: [successEmbed('Command Reloaded', `Command \`${commandName}\` has been reloaded successfully.`)],
        ephemeral: true
      });

    } catch (error) {
      console.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [errorEmbed('Reload Failed', `Error reloading \`${commandName}\`: ${error.message}`)],
          ephemeral: true
        });
      }
    }
  }
};
