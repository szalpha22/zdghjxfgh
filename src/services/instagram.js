const axios = require('axios');

async function getInstagramViews(url) {
  try {
    if (!process.env.INSTAGRAM_RAPIDAPI_KEY) {
      console.log('Instagram API not configured, returning 0 views');
      return 0;
    }

    const options = {
      method: 'GET',
      url: 'https://instagram-scraper-api2.p.rapidapi.com/',
      params: { url: url },
      headers: {
        'X-RapidAPI-Key': process.env.INSTAGRAM_RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    
    if (response.data && response.data.data && response.data.data.play_count) {
      return parseInt(response.data.data.play_count) || 0;
    }

    return 0;
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('⚠️ Instagram API: 403 Forbidden (API endpoint requires paid subscription)');
    } else if (error.response?.status === 429) {
      console.log('⚠️ Instagram API: Rate limited (429)');
    } else {
      console.error('Instagram API Error:', error.message);
    }
    return 0;
  }
}

module.exports = { getInstagramViews };
