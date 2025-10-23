const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db } = require('../../src/database/init');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/analytics'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns WHERE status = ?').all('active');
  res.render('pages/submit', { user: req.user, campaigns });
});

router.post('/submit', upload.single('analytics'), async (req, res) => {
  try {
    const { campaign_id, video_link } = req.body;
    const userId = req.user.id;
    
    const platform = detectPlatform(video_link);
    if (!platform) {
      return res.json({ success: false, message: 'Invalid video link' });
    }
    
    if ((platform === 'Instagram' || platform === 'Twitter') && !req.file) {
      return res.json({ success: false, message: `${platform} submissions require an analytics screenshot` });
    }
    
    const duplicate = db.prepare('SELECT id FROM submissions WHERE video_link = ?').get(video_link);
    if (duplicate) {
      return res.json({ success: false, message: 'This link has already been submitted' });
    }
    
    const analyticsPath = req.file ? `/uploads/analytics/${req.file.filename}` : null;
    
    const stmt = db.prepare(`
      INSERT INTO submissions (campaign_id, user_id, video_link, platform, analytics_proof, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    stmt.run(campaign_id, userId, video_link, platform, analyticsPath);
    
    res.json({ success: true, message: 'Clip submitted successfully!' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to submit clip' });
  }
});

function detectPlatform(url) {
  if (url.includes('youtube.com/shorts') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter';
  return null;
}

module.exports = router;
