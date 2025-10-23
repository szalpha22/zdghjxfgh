const axios = require('axios');

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'cliphub_internal_secret_key_2025';
const BOT_API_URL = 'http://127.0.0.1:5001';

const botClient = axios.create({
  baseURL: BOT_API_URL,
  headers: {
    'x-api-key': INTERNAL_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

async function notifyCampaignCreated(campaignId) {
  try {
    const response = await botClient.post('/api/campaign/created', { campaignId });
    return response.data;
  } catch (error) {
    console.error('Failed to notify bot of campaign creation:', error.message);
    return { success: false, error: error.message };
  }
}

async function notifyCampaignUpdated(campaignId) {
  try {
    const response = await botClient.post('/api/campaign/updated', { campaignId });
    return response.data;
  } catch (error) {
    console.error('Failed to notify bot of campaign update:', error.message);
    return { success: false, error: error.message };
  }
}

async function notifyCampaignEnded(campaignId) {
  try {
    const response = await botClient.post('/api/campaign/ended', { campaignId });
    return response.data;
  } catch (error) {
    console.error('Failed to notify bot of campaign end:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  notifyCampaignCreated,
  notifyCampaignUpdated,
  notifyCampaignEnded
};
