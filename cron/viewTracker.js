const cron = require('node-cron');
const { db } = require('../src/database/init');
const { getYouTubeViews } = require('../src/services/youtube');
const { getTikTokViews } = require('../src/services/tiktok');
const { getInstagramViews } = require('../src/services/instagram');
const { getTwitterViews } = require('../src/services/twitter');

async function updateViews() {
  console.log('🔄 Starting view update...');
  
  const submissions = db.prepare(`SELECT * FROM submissions WHERE status = 'approved'`).all();
  let updated = 0;
  
  for (const submission of submissions) {
    try {
      let views = 0;
      
      if (submission.platform === 'YouTube') {
        views = await getYouTubeViews(submission.video_link) || 0;
      } else if (submission.platform === 'TikTok') {
        views = await getTikTokViews(submission.video_link) || 0;
      } else if (submission.platform === 'Instagram') {
        views = await getInstagramViews(submission.video_link) || 0;
      } else if (submission.platform === 'Twitter') {
        views = await getTwitterViews(submission.video_link) || 0;
      }
      
      if (views > 0 && views !== submission.views) {
        db.prepare('UPDATE submissions SET views = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(views, submission.id);
        
        db.prepare(`
          INSERT INTO view_logs (submission_id, views, platform, checked_at) 
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(submission.id, views, submission.platform);
        
        if (views - submission.views > 10000) {
          db.prepare('UPDATE submissions SET flagged = 1, flag_reason = ? WHERE id = ?')
            .run('Suspicious view spike detected', submission.id);
          console.log(`🚩 Flagged submission ${submission.id} for view spike`);
        }
        
        updated++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error updating submission ${submission.id}:`, error.message);
    }
  }
  
  console.log(`✅ View update complete. Updated ${updated} submissions.`);
}

function startViewTracker() {
  cron.schedule('0 * * * *', updateViews);
  console.log('✅ View tracker started (runs every hour)');
  
  updateViews();
}

module.exports = { startViewTracker, updateViews };
