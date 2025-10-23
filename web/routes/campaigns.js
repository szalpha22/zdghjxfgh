const express = require('express');
const router = express.Router();
const { db } = require('../../src/database/init');

router.get('/', (req, res) => {
  const campaigns = db.prepare("SELECT * FROM campaigns WHERE status != 'ended' ORDER BY created_at DESC").all();
  
  const campaignsWithStats = campaigns.map(campaign => {
    const submissionCount = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE campaign_id = ?').get(campaign.id)?.count || 0;
    const totalViews = db.prepare("SELECT COALESCE(SUM(views), 0) as total FROM submissions WHERE campaign_id = ? AND status = 'approved'").get(campaign.id)?.total || 0;
    const spentBudget = (totalViews / 1000) * campaign.rate_per_1k;
    
    return {
      ...campaign,
      submissionCount,
      totalViews,
      spentBudget
    };
  });
  
  res.render('pages/campaigns', { user: req.user, campaigns: campaignsWithStats });
});

router.get('/:id', (req, res) => {
  try {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    
    if (!campaign) {
      return res.status(404).send('Campaign not found');
    }
    
    const submissionCount = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE campaign_id = ?').get(req.params.id).count;
    
    const totalViews = db.prepare("SELECT COALESCE(SUM(views), 0) as total FROM submissions WHERE campaign_id = ? AND status = 'approved'").get(req.params.id).total;
    
    const spentBudget = (totalViews / 1000) * campaign.rate_per_1k;
    
    const isMember = req.user ? db.prepare('SELECT id FROM campaign_members WHERE campaign_id = ? AND user_id = ?').get(req.params.id, req.user.id) : null;
    
    res.render('pages/campaign-detail', { 
      user: req.user, 
      campaign, 
      submissionCount,
      totalViews,
      spentBudget,
      isMember: !!isMember
    });
  } catch (error) {
    console.error('Campaign detail error:', error);
    res.status(500).send('Error loading campaign');
  }
});

router.post('/join/:id', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user.id;
    
    const existing = db.prepare('SELECT id FROM campaign_members WHERE campaign_id = ? AND user_id = ?')
      .get(campaignId, userId);
    
    if (existing) {
      return res.json({ success: false, message: 'Already joined this campaign' });
    }
    
    const stmt = db.prepare('INSERT INTO campaign_members (campaign_id, user_id) VALUES (?, ?)');
    stmt.run(campaignId, userId);
    
    res.json({ success: true, message: 'Successfully joined campaign!' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to join campaign' });
  }
});

router.post('/leave/:id', async (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?');
    stmt.run(req.params.id, req.user.id);
    
    res.json({ success: true, message: 'Successfully left campaign' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to leave campaign' });
  }
});

module.exports = router;
