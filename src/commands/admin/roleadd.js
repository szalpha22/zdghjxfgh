const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { logModeration } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleadd')
    .setDescription('Add a role to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to add role to')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to add')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for adding role')
        .setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      if (member.roles.cache.has(role.id)) {
        return await interaction.reply({
          embeds: [errorEmbed('Already Has Role', `${user.tag} already has the ${role.name} role.`)],
          ephemeral: true
        });
      }

      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return await interaction.reply({
          embeds: [errorEmbed('Cannot Add Role', 'I cannot add a role that is higher than or equal to my highest role.')],
          ephemeral: true
        });
      }

      await member.roles.add(role, reason);

      await logModeration(interaction.client, 'Role Added', user, interaction.user, `Added ${role.name}`, reason);

      await interaction.reply({
        embeds: [successEmbed('Role Added', `${role} has been added to ${user.tag}.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      console.error('Role add error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to add role.')],
        ephemeral: true
      });
      }
    }
  }
};
