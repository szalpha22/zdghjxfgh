const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myaccounts')
    .setDescription('View your linked social media accounts'),

  async execute(interaction) {
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const accounts = db.prepare(`
        SELECT * FROM social_accounts 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).all(userId);

      if (!accounts || accounts.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🔗 Your Linked Accounts')
          .setDescription('You haven\'t linked any accounts yet.\n\nUse `/linkaccount` to get started!')
          .setColor(COLORS.INFO);

        return await interaction.editReply({ embeds: [embed] });
      }

      const statusEmojis = {
        'verified': '✅ Verified',
        'pending_review': '⏳ Pending Review',
        'pending': '⚠️ Not Submitted',
        'rejected': '❌ Rejected'
      };

      const fields = accounts.map(account => ({
        name: `${account.platform === 'YouTube' ? '📺' : account.platform === 'TikTok' ? '🎵' : '📸'} ${account.platform}`,
        value: `**Handle:** ${account.account_handle}\n**Status:** ${statusEmojis[account.verification_status] || account.verification_status}\n**URL:** ${account.account_url}${account.verification_status === 'pending' ? `\n**Code:** \`${account.verification_code}\`` : ''}`,
        inline: false
      }));

      const verifiedCount = accounts.filter(a => a.verification_status === 'verified').length;

      const embed = new EmbedBuilder()
        .setTitle('🔗 Your Linked Accounts')
        .setDescription(`You have ${accounts.length} linked account(s), ${verifiedCount} verified.`)
        .addFields(fields)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: 'Use /linkaccount to add more accounts' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('My accounts error:', error);
      const embed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('Failed to fetch your accounts.')
        .setColor(COLORS.ERROR);
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
