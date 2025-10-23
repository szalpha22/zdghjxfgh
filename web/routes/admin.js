const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db } = require('../../src/database/init');
const { resetDatabase } = require('../../src/utils/databaseReset');
const { logAdminAction } = require('../utils/adminLogger');
const { updateCampaignBudget, getCampaignBudgetStats } = require('../../src/services/budgetTracker');

const upload = multer({ dest: path.join(__dirname, '../public/uploads/temp') });

// ============================================================
// ADMIN DASHBOARD
// ============================================================
router.get('/', (req, res) => {
  try {
    const stats = {
      campaigns: db.prepare('SELECT COUNT(*) as count FROM campaigns').get(),
      submissions: db.prepare('SELECT COUNT(*) as count FROM submissions').get(),
      payouts: db.prepare(`SELECT COUNT(*) as count FROM payouts WHERE status = 'pending'`).get(),
      pendingVerifications: db.prepare(`SELECT COUNT(*) as count FROM social_accounts WHERE verification_status = 'pending_review'`).get(),
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get(),
      bannedUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get()
    };
    
    const pendingVerifications = db.prepare(`
      SELECT sa.*, u.username 
      FROM social_accounts sa 
      JOIN users u ON sa.user_id = u.user_id 
      WHERE sa.verification_status = 'pending_review' 
      ORDER BY sa.updated_at DESC
      LIMIT 10
    `).all();
    
    const recentActivity = db.prepare(`
      SELECT 'submission' as type, id, user_id, submitted_at as timestamp FROM submissions
      UNION ALL
      SELECT 'payout' as type, id, user_id, requested_at as timestamp FROM payouts
      ORDER BY timestamp DESC
      LIMIT 20
    `).all();
    
    res.render('pages/admin', { user: req.user, stats, pendingVerifications, recentActivity });
  } catch (error) {
    console.error('Admin panel error:', error);
    res.render('pages/admin', { 
      user: req.user, 
      stats: { campaigns: {count: 0}, submissions: {count: 0}, payouts: {count: 0}, pendingVerifications: {count: 0}, totalUsers: {count: 0}, bannedUsers: {count: 0} },
      pendingVerifications: [],
      recentActivity: []
    });
  }
});

// ============================================================
// CAMPAIGN MANAGEMENT
// ============================================================
router.get('/campaigns', (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.render('pages/admin/campaigns', { user: req.user, campaigns });
});

router.post('/campaigns/add', async (req, res) => {
  try {
    const { name, description, type, platforms, rate_per_1k, budget, content_source } = req.body;
    const client = req.app.get('discordClient');
    const { notifyCampaignCreated } = require('../api/botClient');
    
    const existingCampaign = db.prepare('SELECT id FROM campaigns WHERE name = ?').get(name);
    if (existingCampaign) {
      return res.json({ success: false, message: 'Campaign with this name already exists' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO campaigns (name, description, type, platforms, rate_per_1k, total_budget, budget_spent, content_source, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'active')
    `);
    const result = stmt.run(name, description, type, JSON.stringify(platforms.split(',')), rate_per_1k, budget || 0, content_source || null);
    const campaignId = result.lastInsertRowid;
    
    const botResult = await notifyCampaignCreated(campaignId);
    
    if (!botResult.success) {
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaignId);
      return res.json({ success: false, message: `Failed to create Discord roles/channels: ${botResult.error}` });
    }
    
    await logAdminAction(client, {
      user: req.user,
      action: 'CREATE_CAMPAIGN',
      details: `Created campaign: ${name} with budget $${budget}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Campaign created with Discord role and channel!' });
  } catch (error) {
    console.error('Add campaign error:', error);
    res.json({ success: false, message: error.message });
  }
});

router.post('/campaigns/edit/:id', async (req, res) => {
  try {
    const { name, description, rate_per_1k, budget, platforms, type } = req.body;
    const client = req.app.get('discordClient');
    const { notifyCampaignUpdated } = require('../api/botClient');
    
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) {
      return res.json({ success: false, message: 'Campaign not found' });
    }
    
    const existingName = db.prepare('SELECT id FROM campaigns WHERE name = ? AND id != ?').get(name, req.params.id);
    if (existingName) {
      return res.json({ success: false, message: 'Campaign with this name already exists' });
    }
    
    // Parse platforms
    let platformsArray = [];
    if (platforms) {
      platformsArray = platforms.split(',').map(p => p.trim());
      const validPlatforms = ['YouTube', 'TikTok', 'Instagram', 'Twitter'];
      const invalidPlatforms = platformsArray.filter(p => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        return res.json({ success: false, message: `Invalid platforms: ${invalidPlatforms.join(', ')}` });
      }
    }
    
    const stmt = db.prepare(`
      UPDATE campaigns 
      SET name = ?, description = ?, rate_per_1k = ?, total_budget = ?, platforms = ?, type = ?
      WHERE id = ?
    `);
    stmt.run(name, description, rate_per_1k, budget || 0, JSON.stringify(platformsArray), type || campaign.type, req.params.id);
    
    const botResult = await notifyCampaignUpdated(req.params.id);
    if (!botResult.success) {
      console.error('Failed to update Discord resources:', botResult.error);
    }
    
    await logAdminAction(client, {
      user: req.user,
      action: 'EDIT_CAMPAIGN',
      details: `Updated campaign: ${name}${botResult.success ? '' : ' (Discord update failed)'}`,
      ip: req.ip,
      req
    });
    
    res.json({ 
      success: true, 
      message: botResult.success 
        ? 'Campaign updated successfully!' 
        : 'Campaign updated in database, but Discord role/channel update failed. Please update manually.'
    });
  } catch (error) {
    console.error('Edit campaign error:', error);
    res.json({ success: false, message: error.message });
  }
});

router.post('/campaigns/end/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { notifyCampaignEnded } = require('../api/botClient');
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    
    const stmt = db.prepare("UPDATE campaigns SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(req.params.id);
    
    const botResult = await notifyCampaignEnded(req.params.id);
    if (!botResult.success) {
      console.error('Failed to delete Discord resources:', botResult.error);
    }
    
    await logAdminAction(client, {
      user: req.user,
      action: 'END_CAMPAIGN',
      details: `Ended campaign: ${campaign.name}${botResult.success ? '' : ' (Discord cleanup failed)'}`,
      ip: req.ip,
      req
    });
    
    res.json({ 
      success: true, 
      message: botResult.success 
        ? 'Campaign ended successfully' 
        : 'Campaign ended in database, but Discord role/channel cleanup failed. Please delete manually.'
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/campaigns/pause/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    const { action } = req.body; // 'paused' or 'active'
    
    const stmt = db.prepare('UPDATE campaigns SET status = ? WHERE id = ?');
    stmt.run(action, req.params.id);
    
    await logAdminAction(client, {
      user: req.user,
      action: action === 'paused' ? 'PAUSE_CAMPAIGN' : 'RESUME_CAMPAIGN',
      details: `${action === 'paused' ? 'Paused' : 'Resumed'} campaign: ${campaign.name}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: `Campaign ${action === 'paused' ? 'paused' : 'resumed'} successfully` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/campaigns/delete/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    
    if (!campaign) {
      return res.json({ success: false, message: 'Campaign not found' });
    }
    
    if (campaign.status !== 'ended') {
      return res.json({ success: false, message: 'Can only delete ended campaigns' });
    }
    
    // Delete related data first (foreign key constraints)
    db.prepare('DELETE FROM campaign_members WHERE campaign_id = ?').run(req.params.id);
    db.prepare('DELETE FROM submissions WHERE campaign_id = ?').run(req.params.id);
    db.prepare('UPDATE payouts SET campaign_id = NULL WHERE campaign_id = ?').run(req.params.id);
    
    // Delete the campaign
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'DELETE_CAMPAIGN',
      details: `Deleted campaign: ${campaign.name} (ID: ${campaign.id})`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.json({ success: false, message: error.message });
  }
});

// ============================================================
// SUBMISSION MANAGEMENT
// ============================================================
router.get('/submissions', (req, res) => {
  const filter = req.query.status || 'all';
  let query = 'SELECT s.*, c.name as campaign_name, u.username FROM submissions s JOIN campaigns c ON s.campaign_id = c.id JOIN users u ON s.user_id = u.user_id';
  
  if (filter !== 'all') {
    query += ` WHERE s.status = '${filter}'`;
  }
  
  query += ' ORDER BY s.submitted_at DESC';
  
  const submissions = db.prepare(query).all();
  res.render('pages/admin/submissions', { user: req.user, submissions, filter });
});

router.post('/submissions/approve/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(submission.campaign_id);
    
    const { views } = req.body;
    const actualViews = views || submission.views || 0;
    
    // Update submission status
    const stmt = db.prepare("UPDATE submissions SET status = 'approved', views = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(actualViews, req.params.id);
    
    // Calculate earnings and update user balance
    const earnings = (actualViews / 1000) * campaign.rate_per_1k;
    db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(earnings, submission.user_id);
    
    // Update campaign budget
    updateCampaignBudget(submission.campaign_id, actualViews);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'APPROVE_SUBMISSION',
      details: `Approved submission #${req.params.id} - ${actualViews} views - $${earnings.toFixed(2)} earnings`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: `Submission approved! $${earnings.toFixed(2)} added to user balance.` });
  } catch (error) {
    console.error('Approve submission error:', error);
    res.json({ success: false, message: error.message });
  }
});

router.post('/submissions/reject/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { reason } = req.body;
    
    const stmt = db.prepare("UPDATE submissions SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(req.params.id);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'REJECT_SUBMISSION',
      details: `Rejected submission #${req.params.id}. Reason: ${reason || 'No reason provided'}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Submission rejected' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/submissions/flag/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { reason } = req.body;
    
    const stmt = db.prepare('UPDATE submissions SET flagged = 1, flag_reason = ? WHERE id = ?');
    stmt.run(reason, req.params.id);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'FLAG_SUBMISSION',
      details: `Flagged submission #${req.params.id}. Reason: ${reason}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Submission flagged for review' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ============================================================
// PAYOUT MANAGEMENT
// ============================================================
router.get('/payouts', (req, res) => {
  const filter = req.query.status || 'pending';
  const payouts = db.prepare(`
    SELECT p.*, u.username 
    FROM payouts p 
    JOIN users u ON p.user_id = u.user_id 
    WHERE p.status = ?
    ORDER BY p.requested_at DESC
  `).all(filter);
  
  res.render('pages/admin/payouts', { user: req.user, payouts, filter });
});

router.post('/payouts/approve/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const payout = db.prepare('SELECT * FROM payouts WHERE id = ?').get(req.params.id);
    
    const stmt = db.prepare("UPDATE payouts SET status = 'approved', processed_at = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(req.params.id);
    
    // Balance was already deducted when payout was requested, so no need to deduct again
    
    await logAdminAction(client, {
      user: req.user,
      action: 'APPROVE_PAYOUT',
      details: `Approved payout #${req.params.id} - $${payout.amount} to user ${payout.user_id}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Payout approved successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/payouts/reject/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { reason } = req.body;
    const payout = db.prepare('SELECT * FROM payouts WHERE id = ?').get(req.params.id);
    
    const stmt = db.prepare("UPDATE payouts SET status = 'rejected', rejection_reason = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(reason, req.params.id);
    
    // Restore balance since payout was rejected
    db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(payout.amount, payout.user_id);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'REJECT_PAYOUT',
      details: `Rejected payout #${req.params.id}. Reason: ${reason}. Balance restored: $${payout.amount}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Payout rejected and balance restored' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ============================================================
// USER MANAGEMENT
// ============================================================
router.get('/users', (req, res) => {
  const search = req.query.search || '';
  let query = 'SELECT * FROM users';
  let params = [];
  
  if (search) {
    query += ' WHERE user_id LIKE ? OR username LIKE ?';
    params = [`%${search}%`, `%${search}%`];
  }
  
  query += ' ORDER BY created_at DESC LIMIT 100';
  
  const users = db.prepare(query).all(...params);
  res.render('pages/admin/users', { user: req.user, users, search });
});

router.post('/users/ban/:userId', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { reason } = req.body;
    
    const stmt = db.prepare('UPDATE users SET banned = 1 WHERE user_id = ?');
    stmt.run(req.params.userId);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'BAN_USER',
      details: `Banned user ${req.params.userId}. Reason: ${reason || 'No reason'}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/users/unban/:userId', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    
    const stmt = db.prepare('UPDATE users SET banned = 0 WHERE user_id = ?');
    stmt.run(req.params.userId);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'UNBAN_USER',
      details: `Unbanned user ${req.params.userId}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/users/bonus/:userId', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { amount, reason } = req.body;
    
    const stmt = db.prepare('UPDATE users SET balance = balance + ?, bonus_amount = bonus_amount + ? WHERE user_id = ?');
    stmt.run(parseFloat(amount), parseFloat(amount), req.params.userId);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'ADD_BONUS',
      details: `Added $${amount} bonus to user ${req.params.userId}. Reason: ${reason}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: `Bonus of $${amount} added successfully` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/users/balance/:userId', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { balance, reason } = req.body;
    const oldBalance = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(req.params.userId);
    
    const stmt = db.prepare('UPDATE users SET balance = ? WHERE user_id = ?');
    stmt.run(parseFloat(balance), req.params.userId);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'EDIT_USER_BALANCE',
      details: `Changed user ${req.params.userId} balance from $${oldBalance?.balance || 0} to $${balance}. Reason: ${reason || 'Manual adjustment'}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: `Balance updated to $${balance}` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ============================================================
// ACCOUNT VERIFICATION
// ============================================================
router.post('/accounts/verify/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    
    const stmt = db.prepare(`
      UPDATE social_accounts 
      SET verification_status = 'verified', verified_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(req.params.id);
    
    const account = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(req.params.id);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'VERIFY_ACCOUNT',
      details: `Verified ${account.platform} account for user ${account.user_id}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Account verified successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/accounts/reject/:id', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    
    const stmt = db.prepare(`
      UPDATE social_accounts 
      SET verification_status = 'rejected' 
      WHERE id = ?
    `);
    stmt.run(req.params.id);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'REJECT_ACCOUNT_VERIFICATION',
      details: `Rejected account verification #${req.params.id}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: 'Verification rejected' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/accounts/manual/verify', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { user_id, platform } = req.body;
    
    const account = db.prepare(`
      SELECT * FROM social_accounts 
      WHERE user_id = ? AND platform = ?
    `).get(user_id, platform);
    
    if (!account) {
      return res.json({ success: false, message: 'Account not found for this user and platform' });
    }
    
    const stmt = db.prepare(`
      UPDATE social_accounts 
      SET verification_status = 'verified', verified_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND platform = ?
    `);
    stmt.run(user_id, platform);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'MANUAL_VERIFY_ACCOUNT',
      details: `Manually verified ${platform} for user ${user_id}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: `✅ Successfully verified ${platform} account for user ${user_id}` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/accounts/manual/unverify', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { user_id, platform } = req.body;
    
    const account = db.prepare(`
      SELECT * FROM social_accounts 
      WHERE user_id = ? AND platform = ?
    `).get(user_id, platform);
    
    if (!account) {
      return res.json({ success: false, message: 'Account not found for this user and platform' });
    }
    
    const stmt = db.prepare(`
      UPDATE social_accounts 
      SET verification_status = 'pending', verified_at = NULL 
      WHERE user_id = ? AND platform = ?
    `);
    stmt.run(user_id, platform);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'UNVERIFY_ACCOUNT',
      details: `Removed verification from ${platform} for user ${user_id}`,
      ip: req.ip,
      req
    });
    
    res.json({ success: true, message: `❌ Removed verification from ${platform} account for user ${user_id}` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ============================================================
// STATISTICS & ANALYTICS
// ============================================================
router.get('/stats', (req, res) => {
  try {
    const overallStats = {
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get(),
      totalSubmissions: db.prepare('SELECT COUNT(*) as count FROM submissions').get(),
      totalCampaigns: db.prepare('SELECT COUNT(*) as count FROM campaigns').get(),
      totalEarnings: db.prepare("SELECT SUM(amount) as total FROM payouts WHERE status = 'approved'").get(),
      totalViews: db.prepare("SELECT SUM(views) as total FROM submissions WHERE status = 'approved'").get()
    };
    
    const campaignStats = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.total_budget,
        c.budget_spent,
        COUNT(DISTINCT cm.user_id) as members,
        COUNT(DISTINCT s.id) as submissions,
        COALESCE(SUM(s.views), 0) as total_views
      FROM campaigns c
      LEFT JOIN campaign_members cm ON c.id = cm.campaign_id
      LEFT JOIN submissions s ON c.id = s.campaign_id AND s.status = 'approved'
      WHERE c.status = 'active'
      GROUP BY c.id
    `).all();
    
    const topUsers = db.prepare(`
      SELECT 
        u.user_id,
        u.username,
        u.balance,
        COUNT(s.id) as submissions,
        COALESCE(SUM(s.views), 0) as total_views
      FROM users u
      LEFT JOIN submissions s ON u.user_id = s.user_id AND s.status = 'approved'
      GROUP BY u.user_id
      ORDER BY total_views DESC
      LIMIT 10
    `).all();
    
    res.render('pages/admin/stats', { user: req.user, overallStats, campaignStats, topUsers });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).send('Error loading statistics');
  }
});

// ============================================================
// EXPORT DATA
// ============================================================
router.get('/export', (req, res) => {
  res.render('pages/admin/export', { user: req.user });
});

router.get('/export/campaigns', (req, res) => {
  try {
    const campaigns = db.prepare('SELECT * FROM campaigns').all();
    
    let csv = 'ID,Name,Type,Rate per 1K,Budget,Spent,Status,Created\n';
    campaigns.forEach(c => {
      csv += `${c.id},"${c.name}","${c.type}",${c.rate_per_1k},${c.total_budget || 0},${c.budget_spent || 0},"${c.status}","${c.created_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=campaigns.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).send('Export failed');
  }
});

router.get('/export/submissions', (req, res) => {
  try {
    const submissions = db.prepare('SELECT s.*, c.name as campaign_name, u.username FROM submissions s JOIN campaigns c ON s.campaign_id = c.id JOIN users u ON s.user_id = u.user_id').all();
    
    let csv = 'ID,Campaign,Username,Platform,Link,Views,Status,Submitted\n';
    submissions.forEach(s => {
      csv += `${s.id},"${s.campaign_name}","${s.username}","${s.platform}","${s.video_link}",${s.views},"${s.status}","${s.submitted_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=submissions.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).send('Export failed');
  }
});

router.get('/export/payouts', (req, res) => {
  try {
    const payouts = db.prepare('SELECT p.*, u.username FROM payouts p JOIN users u ON p.user_id = u.user_id').all();
    
    let csv = 'ID,Username,Amount,Method,Status,Requested,Processed\n';
    payouts.forEach(p => {
      csv += `${p.id},"${p.username}",${p.amount},"${p.payout_method || ''}","${p.status}","${p.requested_at}","${p.processed_at || ''}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payouts.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).send('Export failed');
  }
});

router.get('/export/users', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM users').all();
    
    let csv = 'User ID,Username,Balance,Banned,Created\n';
    users.forEach(u => {
      csv += `"${u.user_id}","${u.username}",${u.balance || 0},${u.banned},"${u.created_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).send('Export failed');
  }
});

// ============================================================
// DATABASE MANAGEMENT (DEVELOPER ONLY)
// ============================================================
router.post('/database/reset', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    const { confirmation } = req.body;
    
    if (req.user.id !== process.env.DEVELOPER_ID) {
      return res.json({ success: false, message: 'Unauthorized: Only the developer can reset the database' });
    }
    
    if (confirmation !== 'RESET DATABASE') {
      return res.json({ success: false, message: 'Invalid confirmation phrase' });
    }
    
    const result = resetDatabase(req.user.id);
    
    await logAdminAction(client, {
      user: req.user,
      action: 'RESET_DATABASE',
      details: 'Database completely reset with backup created',
      ip: req.ip,
      req
    });
    
    res.json({ 
      success: true, 
      message: '✅ Database reset successfully! All data has been cleared and a backup has been created.',
      backupPath: result.backupPath
    });
  } catch (error) {
    console.error('Database reset error:', error);
    res.json({ success: false, message: 'Failed to reset database: ' + error.message });
  }
});

module.exports = router;
