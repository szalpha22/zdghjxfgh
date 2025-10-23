const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Make an announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Announcement message')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to announce in')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Announcement title')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('everyone')
        .setDescription('Ping @everyone')
        .setRequired(false)),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title') || '📢 Announcement';
    const pingEveryone = interaction.options.getBoolean('everyone') || false;

    const embed = new EmbedBuilder()
      .setColor(0xE31E24)
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: `Announcement by ${interaction.user.tag}` })
      .setTimestamp();

    const content = pingEveryone ? '@everyone' : undefined;

    await channel.send({ content, embeds: [embed] });

    await interaction.reply({ content: `Announcement sent to ${channel}!`, ephemeral: true });
  }
};
