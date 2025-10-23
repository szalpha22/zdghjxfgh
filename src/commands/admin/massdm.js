const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massdm')
    .setDescription('Send DM to all verified clippers')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)),

  async execute(interaction) {
    const message = interaction.options.getString('message');

    await interaction.deferReply({ ephemeral: true });

    try {
      const users = db.prepare('SELECT user_id FROM users WHERE verified = 1 AND banned = 0').all();

      let sentCount = 0;
      let failedCount = 0;

      const embed = createEmbed({
        title: '📢 Announcement from ClipMaster',
        description: message,
        color: 0xE31E24
      });

      for (const userRecord of users) {
        try {
          const user = await interaction.client.users.fetch(userRecord.user_id);
          await user.send({ embeds: [embed] });
          sentCount++;
        } catch (error) {
          failedCount++;
        }
      }

      await interaction.editReply({
        embeds: [successEmbed(
          'Mass DM Complete',
          `✅ Sent to ${sentCount} users\n❌ Failed: ${failedCount}`
        )]
      });

    } catch (error) {
      console.error('Mass DM error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to send mass DM.')]
      });
    }
  }
};
