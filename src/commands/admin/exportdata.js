const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('exportdata')
    .setDescription('Export campaign and clip data')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Data type to export')
        .setRequired(true)
        .addChoices(
          { name: 'All Submissions', value: 'submissions' },
          { name: 'All Payouts', value: 'payouts' },
          { name: 'All Users', value: 'users' },
          { name: 'All Campaigns', value: 'campaigns' }
        )),

  async execute(interaction) {
    const type = interaction.options.getString('type');

    await interaction.deferReply({ ephemeral: true });

    try {
      let data = [];
      let filename = `${type}_export.csv`;

      if (type === 'submissions') {
        data = db.prepare(`
          SELECT s.*, c.name as campaign_name, u.username
          FROM submissions s
          JOIN campaigns c ON s.campaign_id = c.id
          JOIN users u ON s.user_id = u.user_id
          ORDER BY s.submitted_at DESC
        `).all();
      } else if (type === 'payouts') {
        data = db.prepare(`
          SELECT p.*, c.name as campaign_name, u.username, u.payout_method, u.payout_address
          FROM payouts p
          JOIN campaigns c ON p.campaign_id = c.id
          JOIN users u ON p.user_id = u.user_id
          ORDER BY p.requested_at DESC
        `).all();
      } else if (type === 'users') {
        data = db.prepare('SELECT * FROM users').all();
      } else if (type === 'campaigns') {
        data = db.prepare('SELECT * FROM campaigns').all();
      }

      if (data.length === 0) {
        return await interaction.editReply({
          embeds: [errorEmbed('No Data', 'No data available to export.')]
        });
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;

      const attachment = new AttachmentBuilder(Buffer.from(csv), { name: filename });

      await interaction.editReply({
        embeds: [successEmbed('Export Complete', `${data.length} records exported.`)],
        files: [attachment]
      });

    } catch (error) {
      console.error('Export data error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to export data.')]
      });
    }
  }
};
