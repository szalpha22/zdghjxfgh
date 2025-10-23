const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { createEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your clipper profile')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to view profile for')
        .setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;

    try {
      const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

      if (!user) {
        return await interaction.reply({
          embeds: [errorEmbed('Not Found', 'User profile not found.')],
          ephemeral: true
        });
      }

      const submissions = db.prepare('SELECT COUNT(*) as count, SUM(views) as views FROM submissions WHERE user_id = ?')
        .get(userId);

      const approved = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND status = ?')
        .get(userId, 'approved');

      const campaigns = db.prepare('SELECT COUNT(*) as count FROM campaign_members WHERE user_id = ?')
        .get(userId);

      const payouts = db.prepare('SELECT SUM(amount) as total FROM payouts WHERE user_id = ? AND status = ?')
        .get(userId, 'approved');

      const totalEarnings = (payouts?.total || 0) + (user.bonus_amount || 0);

      const embed = createEmbed({
        title: `📊 Clipper Profile`,
        description: `Profile for ${targetUser.tag}`,
        fields: [
          { name: '✅ Verified', value: user.verified ? 'Yes' : 'No', inline: true },
          { name: '🚫 Status', value: user.banned ? 'Banned' : 'Active', inline: true },
          { name: '📹 Campaigns Joined', value: campaigns.count.toString(), inline: true },
          { name: '📤 Total Submissions', value: (submissions.count || 0).toString(), inline: true },
          { name: '✅ Approved Clips', value: (approved.count || 0).toString(), inline: true },
          { name: '👁️ Total Views', value: (submissions.views || 0).toLocaleString(), inline: true },
          { name: '💰 Total Earnings', value: `$${totalEarnings.toFixed(2)}`, inline: true },
          { name: '🎁 Bonus', value: `$${user.bonus_amount.toFixed(2)}`, inline: true },
          { name: '💳 Payout Method', value: user.payout_method || 'Not Set', inline: true }
        ],
        thumbnail: targetUser.displayAvatarURL(),
        color: user.verified ? 0xE31E24 : 0xE31E24
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Profile error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to load profile.')],
        ephemeral: true
      });
      }
    }
  }
};
