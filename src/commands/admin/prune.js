const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prune')
    .setDescription('Prune inactive members from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Days of inactivity (1-30)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(30))
    .addBooleanOption(option =>
      option.setName('dry_run')
        .setDescription('Preview how many members would be pruned (no action taken)')
        .setRequired(false)),

  async execute(interaction) {
    const days = interaction.options.getInteger('days');
    const dryRun = interaction.options.getBoolean('dry_run') || false;

    await interaction.deferReply();

    try {
      if (dryRun) {
        const count = await interaction.guild.members.prune({ days, dry: true });
        
        await interaction.editReply({
          embeds: [successEmbed('Prune Preview', `**${count}** member${count !== 1 ? 's' : ''} would be pruned with ${days} days of inactivity.`)]
        });
      } else {
        const count = await interaction.guild.members.prune({ days, reason: `Pruned by ${interaction.user.tag}` });
        
        await logModeration(interaction.client, 'Prune', interaction.user, interaction.user, `${count} members pruned`, `${days} days inactivity`);

        await interaction.editReply({
          embeds: [successEmbed('Members Pruned', `Successfully pruned **${count}** inactive member${count !== 1 ? 's' : ''}.`)]
        });
      }

    } catch (error) {
      console.error('Prune error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to prune members.')]
      });
    }
  }
};
