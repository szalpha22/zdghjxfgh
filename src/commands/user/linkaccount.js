const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

function generateVerificationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkaccount')
    .setDescription('Link your social media account for verification')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Social media platform')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube', value: 'YouTube' },
          { name: 'TikTok', value: 'TikTok' },
          { name: 'Instagram', value: 'Instagram' }
        ))
    .addStringOption(option =>
      option.setName('handle')
        .setDescription('Your channel name or @handle')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Full URL to your profile/channel')
        .setRequired(true)),

  async execute(interaction) {
    const platform = interaction.options.getString('platform');
    const handle = interaction.options.getString('handle');
    const url = interaction.options.getString('url');
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const userStmt = db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)');
      userStmt.run(userId, interaction.user.username);

      const verificationCode = generateVerificationCode();

      const existingAccount = db.prepare(`
        SELECT id FROM social_accounts 
        WHERE user_id = ? AND platform = ? AND account_url = ?
      `).get(userId, platform, url);

      if (existingAccount) {
        const stmt = db.prepare(`
          UPDATE social_accounts 
          SET account_handle = ?, 
              verification_code = ?, 
              verification_status = 'pending',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        stmt.run(handle, verificationCode, existingAccount.id);
      } else {
        const stmt = db.prepare(`
          INSERT INTO social_accounts (user_id, platform, account_handle, account_url, verification_code, verification_status)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `);
        stmt.run(userId, platform, handle, url, verificationCode);
      }

      const embed = successEmbed(
        '✅ Account Linked!',
        `Your ${platform} account has been linked.\n\n**Verification Code:** \`${verificationCode}\`\n\n**Next Steps:**\n1. Add this code to your ${platform} bio or description\n2. Use \`/verifyaccount ${platform.toLowerCase()}\` to verify\n3. The bot will automatically check for the code!\n\n**Where to add the code:**\n• **YouTube:** Channel description or About section\n• **TikTok:** Bio\n• **Instagram:** Bio\n\n**Your Profile:** ${url}`
      );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Link account error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to link account. Please try again.')]
      });
    }
  }
};
