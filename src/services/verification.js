const axios = require('axios');
const cheerio = require('cheerio');

async function getYouTubeBio(channelUrl) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.log('YouTube API key not configured');
      return null;
    }

    let channelId = null;
    
    if (channelUrl.includes('@')) {
      const username = channelUrl.split('@')[1]?.split('/')[0];
      if (!username) return null;
      
      const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: username,
          type: 'channel',
          maxResults: 1,
          key: apiKey
        }
      });
      
      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        channelId = searchResponse.data.items[0].snippet.channelId;
      }
    } else if (channelUrl.includes('/channel/')) {
      channelId = channelUrl.split('/channel/')[1]?.split('/')[0];
    }
    
    if (!channelId) return null;

    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'snippet,brandingSettings',
        id: channelId,
        key: apiKey
      }
    });

    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      const description = channel.snippet.description || '';
      const about = channel.brandingSettings?.channel?.description || '';
      return description + ' ' + about;
    }

    return null;
  } catch (error) {
    console.error('YouTube bio fetch error:', error.message);
    return null;
  }
}

async function getTikTokBio(profileUrl) {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      console.log('TikTok API not configured');
      return null;
    }

    const username = profileUrl.split('@')[1]?.split('/')[0] || profileUrl.split('.com/')[1]?.split('/')[0];
    if (!username) return null;

    const options = {
      method: 'GET',
      url: 'https://tiktok-scraper7.p.rapidapi.com/user/info',
      params: { unique_id: username.replace('@', '') },
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'tiktok-scraper7.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    
    if (response.data && response.data.data && response.data.data.user) {
      return response.data.data.user.signature || response.data.data.user.desc || '';
    }

    return null;
  } catch (error) {
    console.error('TikTok bio fetch error:', error.message);
    return null;
  }
}

async function getInstagramBioViaScraping(profileUrl) {
  try {
    console.log('🔧 Attempting Instagram scraping fallback...');
    const response = await axios.get(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    
    const bioMatch = html.match(/"biography":"([^"]*)"/);
    if (bioMatch && bioMatch[1]) {
      const bio = bioMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
      console.log('✅ Instagram bio fetched via scraping');
      return bio;
    }

    const metaDescMatch = html.match(/<meta property="og:description" content="([^"]*)">/);
    if (metaDescMatch && metaDescMatch[1]) {
      console.log('✅ Instagram bio fetched from meta tags');
      return metaDescMatch[1];
    }

    return null;
  } catch (error) {
    console.error('Instagram scraping error:', error.message);
    return null;
  }
}

async function getInstagramBio(profileUrl) {
  try {
    const rapidApiKey = process.env.INSTAGRAM_RAPIDAPI_KEY;
    
    if (rapidApiKey) {
      const options = {
        method: 'GET',
        url: 'https://instagram-scraper-api2.p.rapidapi.com/',
        params: { url: profileUrl },
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
        }
      };

      const response = await axios.request(options);
      
      if (response.data && response.data.data && response.data.data.biography) {
        console.log('✅ Instagram bio fetched via API');
        return response.data.data.biography;
      }
    }
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('⚠️ Instagram API: 403 Forbidden - trying scraping fallback...');
    } else {
      console.log('⚠️ Instagram API failed - trying scraping fallback...');
    }
  }

  return await getInstagramBioViaScraping(profileUrl);
}

async function verifyAccountCode(platform, accountUrl, verificationCode, userId = null, accountHandle = null, client = null) {
  try {
    let bio = null;

    if (platform === 'YouTube') {
      bio = await getYouTubeBio(accountUrl);
    } else if (platform === 'TikTok') {
      bio = await getTikTokBio(accountUrl);
    } else if (platform === 'Instagram') {
      bio = await getInstagramBio(accountUrl);
    }

    if (!bio) {
      if (userId && accountHandle && client) {
        const { createVerificationTicket } = require('../utils/autoTicket');
        const ticketId = await createVerificationTicket(client, userId, platform, accountHandle, accountUrl, verificationCode);
        
        return { 
          verified: false, 
          reason: `Could not fetch ${platform} bio automatically. A support ticket #${ticketId} has been created for manual verification.`,
          requiresManual: true,
          ticketCreated: true,
          ticketId
        };
      }
      
      return { 
        verified: false, 
        reason: 'Could not fetch profile bio/description. Please try again later or contact an admin.',
        requiresManual: true
      };
    }

    const codeExists = bio.toUpperCase().includes(verificationCode.toUpperCase());

    if (codeExists) {
      return { verified: true, bio };
    } else {
      return { verified: false, reason: 'Verification code not found in bio/description' };
    }
  } catch (error) {
    console.error('Verification check error:', error);
    return { verified: false, reason: 'Error checking verification code' };
  }
}

module.exports = {
  getYouTubeBio,
  getTikTokBio,
  getInstagramBio,
  verifyAccountCode
};
