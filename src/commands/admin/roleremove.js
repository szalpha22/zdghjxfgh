const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleremove')
    .setDescription('Remove a role from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to remove role from')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to remove')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for removing role')
        .setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (!member.roles.cache.has(role.id)) {
        return await interaction.reply({
          embeds: [errorEmbed('Does Not Have Role', `${user.tag} does not have the ${role.name} role.`)],
          ephemeral: true
        });
      }

      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Remove Role', 'I cannot remove a role that is higher than or equal to my highest role.')],
          ephemeral: true
        });
      }

      await member.roles.remove(role, reason);

      await logModeration(interaction.client, 'Role Removed', user, interaction.user, `Removed ${role.name}`, reason);

      await interaction.reply({
        embeds: [successEmbed('Role Removed', `${role} has been removed from ${user.tag}.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Role remove error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to remove role.')],
        ephemeral: true
      });
      }
    }
  }
};
