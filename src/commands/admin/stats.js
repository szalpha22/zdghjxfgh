const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View bot statistics')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
      const verifiedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE verified = 1').get();
      const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns').get();
      const activeCampaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE status = ?').get('active');
      const totalSubmissions = db.prepare('SELECT COUNT(*) as count FROM submissions').get();
      const approvedSubmissions = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE status = ?').get('approved');
      const totalPayouts = db.prepare('SELECT COUNT(*) as count FROM payouts').get();
      const totalInvites = db.prepare('SELECT COUNT(*) as count FROM invites').get();
      const fakeInvites = db.prepare('SELECT COUNT(*) as count FROM invites WHERE is_fake = 1').get();

      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      const embed = createEmbed({
        title: '📊 ClipHub Bot Statistics',
        fields: [
          { name: '👥 Users', value: `Total: ${totalUsers.count}\nVerified: ${verifiedUsers.count}`, inline: true },
          { name: '🎬 Campaigns', value: `Total: ${totalCampaigns.count}\nActive: ${activeCampaigns.count}`, inline: true },
          { name: '📤 Submissions', value: `Total: ${totalSubmissions.count}\nApproved: ${approvedSubmissions.count}`, inline: true },
          { name: '💰 Payouts', value: `${totalPayouts.count}`, inline: true },
          { name: '📨 Invites', value: `Total: ${totalInvites.count}\nFake: ${fakeInvites.count}`, inline: true },
          { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
          { name: '🌐 Servers', value: `${interaction.client.guilds.cache.size}`, inline: true },
          { name: '⚙️ Commands', value: `${interaction.client.commands.size}`, inline: true },
          { name: '💾 Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true }
        ],
        color: 0xE31E24,
        footer: { text: 'ClipHub Bot Statistics' },
        timestamp: true
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Stats error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Error fetching statistics.', ephemeral: true });
      }
    }
  }
};
