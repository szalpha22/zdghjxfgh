const cron = require('node-cron');
const { db } = require('../src/database/init');
const { checkAndNotifyMilestone } = require('../src/services/budgetTracker');

/**
 * Cron job to check budget milestones for all active campaigns
 * Runs every 30 minutes
 */
function startBudgetChecker(client) {
  cron.schedule('*/30 * * * *', async () => {
    console.log('🔍 Checking campaign budget milestones...');
    
    try {
      const campaigns = db.prepare('SELECT * FROM campaigns WHERE status = ? AND total_budget > 0').all('active');
      
      for (const campaign of campaigns) {
        await checkAndNotifyMilestone(client, campaign.id);
      }
      
      console.log(`✅ Budget check complete for ${campaigns.length} campaigns`);
    } catch (error) {
      console.error('Error in budget checker:', error);
    }
  });

  console.log('✅ Budget milestone checker started (runs every 30 minutes)');
}

module.exports = { startBudgetChecker };
