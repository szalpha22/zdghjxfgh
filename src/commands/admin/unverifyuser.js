const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unverifyuser')
    .setDescription('Remove verification from a user\'s social media account')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to unverify')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Platform to unverify')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube', value: 'YouTube' },
          { name: 'TikTok', value: 'TikTok' },
          { name: 'Instagram', value: 'Instagram' }
        )),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const platform = interaction.options.getString('platform');

    await interaction.deferReply({ ephemeral: true });

    try {
      const account = db.prepare(`
        SELECT * FROM social_accounts 
        WHERE user_id = ? AND platform = ?
      `).get(targetUser.id, platform);

      if (!account) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', `${targetUser.username} doesn't have a linked ${platform} account.`)]
        });
      }

      const stmt = db.prepare(`
        UPDATE social_accounts 
        SET verification_status = 'pending', verified_at = NULL
        WHERE user_id = ? AND platform = ?
      `);
      stmt.run(targetUser.id, platform);

      await interaction.editReply({
        embeds: [successEmbed(
          '❌ Verification Removed',
          `Removed verification from ${targetUser.username}'s ${platform} account.\n\n**Account:** ${account.account_handle}\n**URL:** ${account.account_url}`
        )]
      });

    } catch (error) {
      console.error('Unverify user error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unverify account.')]
      });
    }
  }
};
