require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandFolders = ['admin', 'user'];

for (const folder of commandFolders) {
  const commandsPath = path.join(__dirname, 'src', 'commands', folder);
  if (!fs.existsSync(commandsPath)) continue;
  
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    }
  }
}

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} application (/) commands...`);
    console.log(`📋 Commands to register:`, commands.map(c => c.name).join(', '));

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_IDD, process.env.GUILD_ID),
      { body: commands },
    );

    console.log(`✅ Successfully registered ${data.length} application (/) commands!`);
    console.log(`✅ Registered commands:`, data.map(c => c.name).join(', '));
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
})();
