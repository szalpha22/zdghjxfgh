const { google } = require('googleapis');
const axios = require('axios');

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

async function getYouTubeViews(url) {
  try {
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;

    const response = await youtube.videos.list({
      part: 'statistics',
      id: videoId
    });

    if (response.data.items && response.data.items.length > 0) {
      return parseInt(response.data.items[0].statistics.viewCount) || 0;
    }

    return 0;
  } catch (error) {
    console.error('YouTube API Error:', error.message);
    return null;
  }
}

function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

module.exports = {
  getYouTubeViews,
  extractYouTubeId
};
