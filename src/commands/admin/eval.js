const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eval')
    .setDescription('[DEVELOPER ONLY] Evaluate JavaScript code')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('JavaScript code to evaluate')
        .setRequired(true)),

  async execute(interaction) {
    const developerId = process.env.DEVELOPER_ID;
    
    if (interaction.user.id !== developerId && interaction.guild.ownerId !== interaction.user.id) {
      return await interaction.reply({
        embeds: [errorEmbed('Unauthorized', 'This command is only available to the bot developer.')],
        ephemeral: true
      });
    }

    const code = interaction.options.getString('code');

    try {
      let evaled = eval(code);
      
      if (typeof evaled !== 'string') {
        evaled = require('util').inspect(evaled, { depth: 0 });
      }

      if (evaled.length > 1900) {
        evaled = evaled.substring(0, 1900) + '...';
      }

      const embed = createEmbed({
        title: '✅ Evaluation Successful',
        fields: [
          { name: 'Input', value: `\`\`\`js\n${code.substring(0, 1000)}\n\`\`\``, inline: false },
          { name: 'Output', value: `\`\`\`js\n${evaled}\n\`\`\``, inline: false }
        ],
        color: 0xE31E24
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      const embed = errorEmbed('Evaluation Error', `\`\`\`js\n${error.message}\n\`\`\``);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
