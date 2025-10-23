const axios = require('axios');

async function getTikTokViews(url) {
  try {
    if (!process.env.RAPIDAPI_KEY) {
      console.log('TikTok API not configured, returning 0 views');
      return 0;
    }

    const options = {
      method: 'GET',
      url: 'https://tiktok-scraper7.p.rapidapi.com/',
      params: { url: url },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'tiktok-scraper7.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    
    if (response.data && response.data.data && response.data.data.play_count) {
      return parseInt(response.data.data.play_count) || 0;
    }

    return 0;
  } catch (error) {
    console.error('TikTok API Error:', error.message);
    return 0;
  }
}

module.exports = {
  getTikTokViews
};
