const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/init');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Mark user as verified clipper')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to verify')
        .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');

    try {
      const stmt = db.prepare(`
        INSERT INTO users (user_id, username, verified) 
        VALUES (?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET verified = 1
      `);
      stmt.run(user.id, user.tag);

      const verifiedRole = process.env.VERIFIED_CLIPPER_ROLE;
      if (verifiedRole) {
        try {
          const member = await interaction.guild.members.fetch(user.id);
          await member.roles.add(verifiedRole);
        } catch (error) {
          console.error('Failed to assign verified role:', error);
        }
      }

      await interaction.reply({
        embeds: [successEmbed('User Verified', `${user.tag} is now a verified clipper!`)],
        ephemeral: true
      });

    } catch (error) {
      console.error('Approve user error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to verify user.')],
        ephemeral: true
      });
      }
    }
  }
};
