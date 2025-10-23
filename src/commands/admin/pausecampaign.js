const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logAdminAction } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pausecampaign')
    .setDescription('Pause or unpause a campaign')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Campaign name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Pause or unpause')
        .setRequired(true)
        .addChoices(
          { name: 'Pause', value: 'paused' },
          { name: 'Unpause', value: 'active' }
        )),

  async execute(interaction) {
    const campaignName = interaction.options.getString('name');
    const action = interaction.options.getString('action');

    try {
      const campaign = db.prepare('SELECT * FROM campaigns WHERE name = ?').get(campaignName);

      if (!campaign) {
        return await interaction.reply({
          embeds: [errorEmbed('Not Found', 'Campaign not found.')],
          ephemeral: true
        });
      }

      if (campaign.status === 'ended') {
        return await interaction.reply({
          embeds: [errorEmbed('Campaign Ended', 'Cannot pause/unpause an ended campaign.')],
          ephemeral: true
        });
      }

      const stmt = db.prepare('UPDATE campaigns SET status = ? WHERE name = ?');
      stmt.run(action, campaignName);

      await logAdminAction(interaction.client, interaction.user, 'Campaign Status Changed', `${campaignName}: ${action}`);

      await interaction.reply({
        embeds: [successEmbed(
          action === 'paused' ? 'Campaign Paused' : 'Campaign Resumed',
          `**${campaignName}** has been ${action === 'paused' ? 'paused' : 'resumed'}.`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Pause campaign error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [errorEmbed('Error', 'Failed to pause/unpause campaign.')],
          ephemeral: true
        });
      }
    }
  }
};
