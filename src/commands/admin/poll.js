const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Poll question')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('option1')
        .setDescription('First option')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('option2')
        .setDescription('Second option')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('option3')
        .setDescription('Third option')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('option4')
        .setDescription('Fourth option')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('option5')
        .setDescription('Fifth option')
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send poll to (defaults to current)')
        .setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const options = [];
    for (let i = 1; i <= 5; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt);
    }

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

    const description = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xE31E24)
      .setTitle('📊 ' + question)
      .setDescription(description)
      .setFooter({ text: `Poll by ${interaction.user.tag}` })
      .setTimestamp();

    const pollMessage = await channel.send({ embeds: [embed] });

    for (let i = 0; i < options.length; i++) {
      await pollMessage.react(emojis[i]);
    }

    await interaction.reply({ content: `Poll created in ${channel}!`, ephemeral: true });
  }
};
