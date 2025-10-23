const { EmbedBuilder } = require('discord.js');

/**
 * Logs admin actions from the website to Discord
 * @param {Object} client - Discord client
 * @param {Object} options - Logging options
 * @param {Object} options.user - User who performed the action
 * @param {string} options.action - Action performed
 * @param {string} options.details - Details about the action
 * @param {string} options.ip - IP address
 * @param {Object} options.req - Express request object (for user agent)
 */
async function logAdminAction(client, options) {
  try {
    const { user, action, details, ip, req } = options;
    
    const logChannel = process.env.COMMAND_LOGS_CHANNEL;
    if (!logChannel) return;
    
    const channel = await client.channels.fetch(logChannel);
    if (!channel) return;
    
    // Parse user agent for device/browser info
    const userAgent = req?.headers['user-agent'] || 'Unknown';
    const browser = parseBrowser(userAgent);
    const os = parseOS(userAgent);
    const device = parseDevice(userAgent);
    
    const embed = new EmbedBuilder()
      .setTitle('🌐 Website Admin Action')
      .setColor(0xef4444) // Red color
      .addFields(
        { name: '👤 User', value: `${user.username}#${user.discriminator}\n\`${user.id}\``, inline: true },
        { name: '⚡ Action', value: `\`${action}\``, inline: true },
        { name: '🌍 IP Address', value: `\`${ip || 'Unknown'}\``, inline: true },
        { name: '📱 Device', value: device, inline: true },
        { name: '🌐 Browser', value: browser, inline: true },
        { name: '💻 Operating System', value: os, inline: true }
      )
      .setTimestamp();
    
    if (details) {
      embed.setDescription(`**Details:**\n${details}`);
    }
    
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

function parseBrowser(userAgent) {
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return '🔵 Chrome';
  if (userAgent.includes('Firefox')) return '🦊 Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return '🧭 Safari';
  if (userAgent.includes('Edg')) return '🔷 Edge';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return '🔴 Opera';
  return '❓ Unknown';
}

function parseOS(userAgent) {
  if (userAgent.includes('Windows')) return '🪟 Windows';
  if (userAgent.includes('Mac OS')) return '🍎 macOS';
  if (userAgent.includes('Linux')) return '🐧 Linux';
  if (userAgent.includes('Android')) return '🤖 Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return '📱 iOS';
  return '❓ Unknown';
}

function parseDevice(userAgent) {
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) return '📱 Mobile';
  if (userAgent.includes('Tablet') || userAgent.includes('iPad')) return '📱 Tablet';
  return '💻 Desktop';
}

module.exports = { logAdminAction };
