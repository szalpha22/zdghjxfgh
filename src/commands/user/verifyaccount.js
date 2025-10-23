const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verifyaccount')
    .setDescription('Submit your account for verification')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Platform to verify')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube', value: 'YouTube' },
          { name: 'TikTok', value: 'TikTok' },
          { name: 'Instagram', value: 'Instagram' }
        )),

  async execute(interaction) {
    const platform = interaction.options.getString('platform');
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const { verifyAccountCode } = require('../../services/verification');
      
      const account = db.prepare(`
        SELECT * FROM social_accounts 
        WHERE user_id = ? AND platform = ?
      `).get(userId, platform);

      if (!account) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', `No ${platform} account linked. Use \`/linkaccount\` first.`)]
        });
      }

      if (account.verification_status === 'verified') {
        return await interaction.editReply({
          embeds: [successEmbed('Already Verified', `Your ${platform} account is already verified! ✅`)]
        });
      }

      await interaction.editReply({
        embeds: [successEmbed('Checking...', `🔍 Checking your ${platform} bio for verification code \`${account.verification_code}\`...\n\nThis may take a few seconds.`)]
      });

      const result = await verifyAccountCode(
        account.platform, 
        account.account_url, 
        account.verification_code,
        userId,
        account.account_handle,
        interaction.client
      );

      if (result.verified) {
        const stmt = db.prepare(`
          UPDATE social_accounts 
          SET verification_status = 'verified', verified_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND platform = ?
        `);
        stmt.run(userId, platform);

        await interaction.editReply({
          embeds: [successEmbed(
            '✅ Verification Successful!',
            `Your ${platform} account has been automatically verified!\n\n**Account:** ${account.account_handle}\n**Status:** Verified ✅\n\n🎉 Your verified badge is now live on your dashboard!`
          )]
        });
      } else if (result.ticketCreated) {
        await interaction.editReply({
          embeds: [successEmbed(
            '🎫 Ticket Created',
            `Automatic verification couldn't complete.\n\n**Ticket #${result.ticketId}** has been created for manual review!\n\n**Platform:** ${platform}\n**Account:** ${account.account_handle}\n**Code:** \`${account.verification_code}\`\n\n⏰ An admin will verify your account manually within 24 hours. You'll be notified once approved!`
          )]
        });
      } else {
        await interaction.editReply({
          embeds: [errorEmbed(
            '❌ Verification Failed',
            `Could not find the verification code in your ${platform} bio.\n\n**Reason:** ${result.reason}\n\n**Your Code:** \`${account.verification_code}\`\n\n**Please:**\n1. Make sure the code is in your bio/description\n2. Wait a few minutes for changes to sync\n3. Try again with \`/verifyaccount ${platform.toLowerCase()}\``
          )]
        });
      }

    } catch (error) {
      console.error('Verify account error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to verify account. Please try again later.')]
      });
    }
  }
};
