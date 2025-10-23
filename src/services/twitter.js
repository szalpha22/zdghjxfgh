const axios = require('axios');

async function getTwitterViews(url) {
  try {
    if (!process.env.RAPIDAPI_KEY) {
      console.log('Twitter API not configured, returning 0 views');
      return 0;
    }

    const options = {
      method: 'GET',
      url: 'https://twitter-api45.p.rapidapi.com/tweet.php',
      params: { url: url },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    
    if (response.data && response.data.views) {
      return parseInt(response.data.views) || 0;
    }
    
    if (response.data && response.data.view_count) {
      return parseInt(response.data.view_count) || 0;
    }

    return 0;
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('⚠️ Twitter API: 403 Forbidden (API endpoint may require paid subscription)');
    } else if (error.response?.status === 429) {
      console.log('⚠️ Twitter API: Rate limited (429)');
    } else {
      console.error('Twitter API Error:', error.message);
    }
    return 0;
  }
}

module.exports = { getTwitterViews };
