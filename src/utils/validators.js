function validatePlatform(url) {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'YouTube';
  if (lowerUrl.includes('tiktok.com')) return 'TikTok';
  if (lowerUrl.includes('instagram.com')) return 'Instagram';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'Twitter';
  
  return null;
}

function validateCampaignPlatform(url, allowedPlatforms) {
  const platform = validatePlatform(url);
  if (!platform) return { valid: false, platform: null, error: 'Invalid platform URL' };
  
  const platforms = JSON.parse(allowedPlatforms);
  if (!platforms.includes(platform)) {
    return { valid: false, platform, error: `This campaign only accepts: ${platforms.join(', ')}` };
  }
  
  return { valid: true, platform, error: null };
}

function checkRateLimit(db, userId, action, limitSeconds = 60) {
  const stmt = db.prepare('SELECT timestamp FROM rate_limits WHERE user_id = ? AND action = ?');
  const record = stmt.get(userId, action);
  
  if (record) {
    const lastAction = new Date(record.timestamp);
    const now = new Date();
    const diffSeconds = (now - lastAction) / 1000;
    
    if (diffSeconds < limitSeconds) {
      return { allowed: false, waitTime: Math.ceil(limitSeconds - diffSeconds) };
    }
  }
  
  const updateStmt = db.prepare(`
    INSERT INTO rate_limits (user_id, action, timestamp) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, action) DO UPDATE SET timestamp = CURRENT_TIMESTAMP
  `);
  updateStmt.run(userId, action);
  
  return { allowed: true, waitTime: 0 };
}

function checkDuplicateSubmission(db, userId, campaignId) {
  const stmt = db.prepare('SELECT id FROM submissions WHERE user_id = ? AND campaign_id = ?');
  return stmt.get(userId, campaignId) !== undefined;
}

function checkDuplicateLink(db, link) {
  const stmt = db.prepare('SELECT user_id, id FROM submissions WHERE video_link = ?');
  return stmt.get(link);
}

function checkReusedLink(db, link, excludeUserId) {
  const stmt = db.prepare('SELECT user_id, COUNT(*) as count FROM submissions WHERE video_link = ? AND user_id != ? GROUP BY user_id');
  const results = stmt.all(link, excludeUserId);
  return results.length > 0 ? results : null;
}

module.exports = {
  validatePlatform,
  validateCampaignPlatform,
  checkRateLimit,
  checkDuplicateSubmission,
  checkDuplicateLink,
  checkReusedLink
};
