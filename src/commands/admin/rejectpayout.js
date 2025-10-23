const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logPayout } = require('../../utils/logger');
const { dmPayoutRejected } = require('../../utils/dmHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rejectpayout')
    .setDescription('Reject a payout request')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('payout_id')
        .setDescription('Payout ID')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Rejection reason')
        .setRequired(true)),

  async execute(interaction) {
    const payoutId = interaction.options.getInteger('payout_id');
    const reason = interaction.options.getString('reason');

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
        SET status = ?, rejection_reason = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      stmt.run('rejected', reason, payoutId);

      // Restore balance since payout was rejected
      db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(payout.amount, payout.user_id);

      const user = await interaction.client.users.fetch(payout.user_id);
      const userDb = db.prepare('SELECT * FROM users WHERE user_id = ?').get(payout.user_id);
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(payout.campaign_id);

      await dmPayoutRejected(user, payout, campaign, reason);
      await logPayout(interaction.client, 'Rejected', payout, user);

      await interaction.editReply({
        embeds: [successEmbed('Payout Rejected', `Payout #${payoutId} has been rejected.\n**Balance restored:** $${payout.amount.toFixed(2)}\n**User Balance:** $${(userDb?.balance || 0).toFixed(2)}`)]
      });

    } catch (error) {
      console.error('Reject payout error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to reject payout.')]
      });
    }
  }
};
