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

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ============================================================
// USER DASHBOARD
// ============================================================
router.get('/dashboard', (req, res) => {
  try {
    const userStats = {
      totalSubmissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ?').get(req.user.id),
      approvedSubmissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND status = "approved"').get(req.user.id),
      totalViews: db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM submissions WHERE user_id = ? AND status = "approved"').get(req.user.id),
      balance: db.prepare('SELECT balance FROM users WHERE user_id = ?').get(req.user.id) || { balance: 0 },
      rank: db.prepare(`
        SELECT COUNT(*) + 1 as rank 
        FROM users u
        WHERE (SELECT COALESCE(SUM(s.views), 0) FROM submissions s WHERE s.user_id = u.user_id AND s.status = 'approved') >
              (SELECT COALESCE(SUM(s.views), 0) FROM submissions s WHERE s.user_id = ? AND s.status = 'approved')
      `).get(req.user.id)
    };
    
    const joinedCampaigns = db.prepare(`
      SELECT c.*, COUNT(DISTINCT s.id) as my_submissions
      FROM campaigns c
      JOIN campaign_members cm ON c.id = cm.campaign_id
      LEFT JOIN submissions s ON c.id = s.campaign_id AND s.user_id = ?
      WHERE cm.user_id = ?
      GROUP BY c.id
    `).all(req.user.id, req.user.id);
    
    const recentSubmissions = db.prepare(`
      SELECT s.*, c.name as campaign_name
      FROM submissions s
      JOIN campaigns c ON s.campaign_id = c.id
      WHERE s.user_id = ?
      ORDER BY s.submitted_at DESC
      LIMIT 5
    `).all(req.user.id);
    
    res.render('pages/user/dashboard', { user: req.user, userStats, joinedCampaigns, recentSubmissions });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// ============================================================
// MY STATS
// ============================================================
router.get('/stats', (req, res) => {
  try {
    const userInfo = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.id);
    
    const stats = {
      totalViews: db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM submissions WHERE user_id = ? AND status = "approved"').get(req.user.id),
      totalSubmissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ?').get(req.user.id),
      approvedSubmissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND status = "approved"').get(req.user.id),
      pendingSubmissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND status = "pending"').get(req.user.id),
      rejectedSubmissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND status = "rejected"').get(req.user.id),
      totalEarnings: db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payouts WHERE user_id = ? AND status = "approved"').get(req.user.id),
      pendingPayouts: db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payouts WHERE user_id = ? AND status = "pending"').get(req.user.id),
      balance: userInfo?.balance || 0,
      bonusAmount: userInfo?.bonus_amount || 0
    };
    
    const submissionHistory = db.prepare(`
      SELECT s.*, c.name as campaign_name
      FROM submissions s
      JOIN campaigns c ON s.campaign_id = c.id
      WHERE s.user_id = ?
      ORDER BY s.submitted_at DESC
    `).all(req.user.id);
    
    const payoutHistory = db.prepare(`
      SELECT * FROM payouts WHERE user_id = ? ORDER BY requested_at DESC
    `).all(req.user.id);
    
    // Get rank
    const rank = db.prepare(`
      SELECT COUNT(*) + 1 as rank 
      FROM users u
      WHERE (SELECT COALESCE(SUM(s.views), 0) FROM submissions s WHERE s.user_id = u.user_id AND s.status = 'approved') >
            (SELECT COALESCE(SUM(s.views), 0) FROM submissions s WHERE s.user_id = ? AND s.status = 'approved')
    `).get(req.user.id);
    
    res.render('pages/user/stats', { user: req.user, stats, submissionHistory, payoutHistory, rank });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).send('Error loading statistics');
  }
});

// ============================================================
// MY PROFILE
// ============================================================
router.get('/profile', (req, res) => {
  try {
    const userInfo = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.id);
    
    const linkedAccounts = db.prepare(`
      SELECT * FROM social_accounts WHERE user_id = ? ORDER BY platform
    `).all(req.user.id);
    
    res.render('pages/user/profile', { user: req.user, userInfo, linkedAccounts });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).send('Error loading profile');
  }
});

router.post('/profile/payout', async (req, res) => {
  try {
    const { payout_method, payout_address } = req.body;
    
    const stmt = db.prepare('UPDATE users SET payout_method = ?, payout_address = ? WHERE user_id = ?');
    stmt.run(payout_method, payout_address, req.user.id);
    
    res.json({ success: true, message: 'Payout settings updated successfully' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to update payout settings' });
  }
});

// ============================================================
// MY ACCOUNTS (Social Media)
// ============================================================
router.get('/accounts', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT * FROM social_accounts WHERE user_id = ? ORDER BY platform
    `).all(req.user.id);
    
    res.render('pages/user/accounts', { user: req.user, accounts });
  } catch (error) {
    console.error('Accounts error:', error);
    res.status(500).send('Error loading accounts');
  }
});

router.post('/accounts/link', async (req, res) => {
  try {
    const { platform, account_handle, account_url } = req.body;
    
    // Check if account already exists
    const existing = db.prepare('SELECT * FROM social_accounts WHERE user_id = ? AND platform = ?').get(req.user.id, platform);
    
    if (existing) {
      return res.json({ success: false, message: 'You already have a linked account for this platform' });
    }
    
    // Generate verification code
    const verificationCode = `CLIP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const stmt = db.prepare(`
      INSERT INTO social_accounts (user_id, platform, account_handle, account_url, verification_code, verification_status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    stmt.run(req.user.id, platform, account_handle, account_url, verificationCode);
    
    res.json({ 
      success: true, 
      message: `Account linked! Add "${verificationCode}" to your ${platform} bio and click "Verify" to complete verification.`,
      verificationCode 
    });
  } catch (error) {
    res.json({ success: false, message: 'Failed to link account' });
  }
});

router.post('/accounts/verify/:id', async (req, res) => {
  try {
    const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    
    if (!account) {
      return res.json({ success: false, message: 'Account not found' });
    }
    
    // Submit for verification (auto-verification will check it via cron)
    const stmt = db.prepare(`
      UPDATE social_accounts 
      SET verification_status = 'pending', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(req.params.id);
    
    res.json({ 
      success: true, 
      message: 'Submitted for verification! Our system will automatically verify your account within 30 minutes.' 
    });
  } catch (error) {
    res.json({ success: false, message: 'Failed to submit for verification' });
  }
});

router.post('/accounts/unlink/:id', async (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM social_accounts WHERE id = ? AND user_id = ?');
    stmt.run(req.params.id, req.user.id);
    
    res.json({ success: true, message: 'Account unlinked successfully' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to unlink account' });
  }
});

// ============================================================
// MY CAMPAIGNS
// ============================================================
router.get('/campaigns', (req, res) => {
  try {
    const joinedCampaigns = db.prepare(`
      SELECT c.*, 
             COUNT(DISTINCT s.id) as my_submissions,
             COALESCE(SUM(CASE WHEN s.status = 'approved' THEN s.views ELSE 0 END), 0) as my_views
      FROM campaigns c
      JOIN campaign_members cm ON c.id = cm.campaign_id
      LEFT JOIN submissions s ON c.id = s.campaign_id AND s.user_id = ?
      WHERE cm.user_id = ? AND c.status != 'ended'
      GROUP BY c.id
    `).all(req.user.id, req.user.id);
    
    const availableCampaigns = db.prepare(`
      SELECT c.*,
             COUNT(DISTINCT cm.user_id) as member_count
      FROM campaigns c
      LEFT JOIN campaign_members cm ON c.id = cm.campaign_id
      WHERE c.status = 'active' 
        AND c.id NOT IN (SELECT campaign_id FROM campaign_members WHERE user_id = ?)
      GROUP BY c.id
    `).all(req.user.id);
    
    res.render('pages/user/campaigns', { user: req.user, joinedCampaigns, availableCampaigns });
  } catch (error) {
    console.error('Campaigns error:', error);
    res.status(500).send('Error loading campaigns');
  }
});

// ============================================================
// SUBMIT CLIP
// ============================================================
router.get('/submit', (req, res) => {
  try {
    const campaigns = db.prepare(`
      SELECT c.* 
      FROM campaigns c
      JOIN campaign_members cm ON c.id = cm.campaign_id
      WHERE c.status = 'active' AND cm.user_id = ?
    `).all(req.user.id);
    
    const linkedAccounts = db.prepare(`
      SELECT * FROM social_accounts WHERE user_id = ? AND verification_status = 'verified'
    `).all(req.user.id);
    
    res.render('pages/user/submit', { user: req.user, campaigns, linkedAccounts });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).send('Error loading submit page');
  }
});

router.post('/submit', upload.single('analytics'), async (req, res) => {
  try {
    const { campaign_id, video_link, platform } = req.body;
    const userId = req.user.id;
    
    // Check if user is member of campaign
    const membership = db.prepare('SELECT id FROM campaign_members WHERE campaign_id = ? AND user_id = ?').get(campaign_id, userId);
    if (!membership) {
      return res.json({ success: false, message: 'You must join the campaign before submitting' });
    }
    
    // Check for duplicate link
    const duplicate = db.prepare('SELECT id FROM submissions WHERE video_link = ?').get(video_link);
    if (duplicate) {
      return res.json({ success: false, message: 'This link has already been submitted' });
    }
    
    // Check if account is verified for this platform
    const verifiedAccount = db.prepare('SELECT * FROM social_accounts WHERE user_id = ? AND platform = ? AND verification_status = "verified"').get(userId, platform);
    if (!verifiedAccount) {
      return res.json({ success: false, message: `Please verify your ${platform} account before submitting clips` });
    }
    
    const analyticsPath = req.file ? `/uploads/analytics/${req.file.filename}` : null;
    
    const stmt = db.prepare(`
      INSERT INTO submissions (campaign_id, user_id, video_link, platform, analytics_proof, status, views)
      VALUES (?, ?, ?, ?, ?, 'pending', 0)
    `);
    const result = stmt.run(campaign_id, userId, video_link, platform, analyticsPath);
    
    // Log to Discord with approve/reject buttons
    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(result.lastInsertRowid);
    const { logSubmission } = require('../../src/utils/logger');
    const client = req.app.get('discordClient');
    if (client) {
      await logSubmission(client, 'Submitted', submission, req.user);
    }
    
    res.json({ success: true, message: 'Clip submitted successfully! Awaiting admin approval.' });
  } catch (error) {
    console.error('Submit error:', error);
    res.json({ success: false, message: 'Failed to submit clip' });
  }
});

// ============================================================
// MY SUBMISSIONS
// ============================================================
router.get('/submissions', (req, res) => {
  try {
    const submissions = db.prepare(`
      SELECT s.*, c.name as campaign_name, c.rate_per_1k
      FROM submissions s
      JOIN campaigns c ON s.campaign_id = c.id
      WHERE s.user_id = ?
      ORDER BY s.submitted_at DESC
    `).all(req.user.id);
    
    res.render('pages/user/submissions', { user: req.user, submissions });
  } catch (error) {
    console.error('Submissions error:', error);
    res.status(500).send('Error loading submissions');
  }
});

// ============================================================
// REQUEST PAYOUT
// ============================================================
router.get('/payout', (req, res) => {
  try {
    const userInfo = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.id);
    
    const payouts = db.prepare(`
      SELECT * FROM payouts WHERE user_id = ? ORDER BY requested_at DESC
    `).all(req.user.id);
    
    const totalEarnings = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM payouts WHERE user_id = ? AND status = 'approved'
    `).get(req.user.id);
    
    res.render('pages/user/payout', { user: req.user, userInfo, payouts, totalEarnings });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).send('Error loading payout page');
  }
});

router.post('/payout/request', upload.single('proof'), async (req, res) => {
  try {
    const { amount } = req.body;
    const userInfo = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.id);
    
    if (!userInfo.payout_method || !userInfo.payout_address) {
      return res.json({ success: false, message: 'Please set up your payout method in your profile first' });
    }
    
    if (parseFloat(amount) > userInfo.balance) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }
    
    if (parseFloat(amount) < 5) {
      return res.json({ success: false, message: 'Minimum payout amount is $5' });
    }
    
    const proofPath = req.file ? `/uploads/analytics/${req.file.filename}` : null;
    
    const stmt = db.prepare(`
      INSERT INTO payouts (user_id, amount, payout_method, analytics_proof, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    const result = stmt.run(req.user.id, amount, userInfo.payout_method, proofPath);
    
    // Log to Discord with approve/reject buttons
    const payout = db.prepare('SELECT * FROM payouts WHERE id = ?').get(result.lastInsertRowid);
    const { logPayout } = require('../../src/utils/logger');
    const client = req.app.get('discordClient');
    if (client) {
      await logPayout(client, 'Requested', payout, req.user);
    }
    
    res.json({ success: true, message: 'Payout request submitted! Awaiting admin approval.' });
  } catch (error) {
    console.error('Request payout error:', error);
    res.json({ success: false, message: 'Failed to request payout' });
  }
});

module.exports = router;
