const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logPayout } = require('../../utils/logger');
const { dmPayoutApproved } = require('../../utils/dmHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('approvepayout')
    .setDescription('Approve a payout request')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('payout_id')
        .setDescription('Payout ID')
        .setRequired(true)),

  async execute(interaction) {
    const payoutId = interaction.options.getInteger('payout_id');

    await interaction.deferReply({ ephemeral: true });

    try {
      const payout = db.prepare('SELECT * FROM payouts WHERE id = ?').get(payoutId);

      if (!payout) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Payout request not found.')]
        });
      }

      const stmt = db.prepare(`
        UPDATE payouts 
        SET status = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      stmt.run('approved', payoutId);

      // Balance was already deducted when payout was requested, so no need to deduct again

      const user = await interaction.client.users.fetch(payout.user_id);
      const userDb = db.prepare('SELECT * FROM users WHERE user_id = ?').get(payout.user_id);
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(payout.campaign_id);

      await dmPayoutApproved(user, payout, campaign);
      await logPayout(interaction.client, 'Approved', payout, user);

      await interaction.editReply({
        embeds: [successEmbed('Payout Approved', `Payout #${payoutId} for $${payout.amount.toFixed(2)} has been approved.\n**User Balance:** $${(userDb?.balance || 0).toFixed(2)}`)]
      });

    } catch (error) {
      console.error('Approve payout error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to approve payout.')]
      });
    }
  }
};
