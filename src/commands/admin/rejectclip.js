const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logSubmission } = require('../../utils/logger');
const { dmSubmissionRejected } = require('../../utils/dmHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rejectclip')
    .setDescription('Reject a submission')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('submission_id')
        .setDescription('Submission ID')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Rejection reason')
        .setRequired(true)),

  async execute(interaction) {
    const submissionId = interaction.options.getInteger('submission_id');
    const reason = interaction.options.getString('reason');

    await interaction.deferReply({ ephemeral: true });

    try {
      const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);

      if (!submission) {
        return await interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Submission not found.')]
        });
      }

      const stmt = db.prepare(`
        UPDATE submissions 
        SET status = ?, reviewed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      stmt.run('rejected', submissionId);

      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(submission.campaign_id);
      const user = await interaction.client.users.fetch(submission.user_id);

      await dmSubmissionRejected(user, submission, campaign, reason);
      await logSubmission(interaction.client, 'Rejected', submission, user);

      await interaction.editReply({
        embeds: [successEmbed('Clip Rejected', `Submission #${submissionId} has been rejected.`)]
      });

    } catch (error) {
      console.error('Reject clip error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to reject submission.')]
      });
    }
  }
};
