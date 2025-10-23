const { EmbedBuilder } = require('discord.js');

/**
 * Logs user login activity to Discord
 * @param {Client} client - Discord bot client
 * @param {Object} loginData - Login information
 */
async function logUserLogin(client, loginData) {
  try {
    const channelId = process.env.MEMBER_LOGS_CHANNEL;
    if (!channelId) {
      console.error('❌ MEMBER_LOGS_CHANNEL not configured');
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error('❌ Could not find login logs channel');
      return;
    }

    const { username, userId, ip, userAgent, device, browser, os, timestamp } = loginData;

    const embed = new EmbedBuilder()
      .setColor(0xE31E24) // Red color
      .setTitle('🔐 User Login')
      .setDescription(`**${username}** logged into the website`)
      .addFields(
        { name: '👤 User ID', value: userId, inline: true },
        { name: '📱 Device', value: device || 'Unknown', inline: true },
        { name: '🌐 Browser', value: browser || 'Unknown', inline: true },
        { name: '💻 Operating System', value: os || 'Unknown', inline: true },
        { name: '🌍 IP Address', value: ip || 'Unknown', inline: true },
        { name: '⏰ Timestamp', value: `<t:${Math.floor(timestamp / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: 'ClipHub Login Logger' })
      .setTimestamp();

    // Add user agent as a field if available
    if (userAgent) {
      embed.addFields({ 
        name: '📋 User Agent', 
        value: userAgent.length > 1024 ? userAgent.substring(0, 1021) + '...' : userAgent 
      });
    }

    await channel.send({ embeds: [embed] });
    console.log(`✅ Logged login for user: ${username} (${userId})`);
  } catch (error) {
    console.error('❌ Error logging user login:', error);
  }
}

/**
 * Parse user agent string to extract device, browser, and OS information
 * @param {string} userAgent - User agent string
 * @returns {Object} Parsed information
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  }

  // Detect browser
  let browser = 'Unknown';
  if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edg/')) {
    browser = 'Microsoft Edge';
  } else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
    browser = 'Google Chrome';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
    browser = 'Safari';
  } else if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) {
    browser = 'Opera';
  }

  // Detect OS
  let os = 'Unknown';
  if (userAgent.includes('Windows NT 10.0')) {
    os = 'Windows 10/11';
  } else if (userAgent.includes('Windows NT 6.3')) {
    os = 'Windows 8.1';
  } else if (userAgent.includes('Windows NT 6.2')) {
    os = 'Windows 8';
  } else if (userAgent.includes('Windows NT 6.1')) {
    os = 'Windows 7';
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  // Detect device type
  let device = 'Desktop';
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'Tablet';
  }

  return { device, browser, os };
}

module.exports = { logUserLogin, parseUserAgent };
