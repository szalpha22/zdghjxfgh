const cron = require('node-cron');
const { db } = require('../src/database/init');
const { verifyAccountCode } = require('../src/services/verification');

async function checkPendingVerifications() {
  console.log('🔍 Checking pending account verifications...');
  
  try {
    const pendingAccounts = db.prepare(`
      SELECT * FROM social_accounts 
      WHERE verification_status = 'pending'
      ORDER BY updated_at DESC
    `).all();

    if (pendingAccounts.length === 0) {
      console.log('No pending verifications to check');
      return;
    }

    let verified = 0;
    let failed = 0;

    for (const account of pendingAccounts) {
      try {
        console.log(`Checking ${account.platform} account for user ${account.user_id}...`);
        
        const result = await verifyAccountCode(
          account.platform, 
          account.account_url, 
          account.verification_code
        );

        if (result.verified) {
          db.prepare(`
            UPDATE social_accounts 
            SET verification_status = 'verified', verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(account.id);
          
          console.log(`✅ Auto-verified ${account.platform} account for user ${account.user_id}`);
          verified++;
        } else {
          console.log(`❌ Verification failed for ${account.platform}: ${result.reason}`);
          failed++;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error checking account ${account.id}:`, error.message);
        failed++;
      }
    }

    console.log(`✅ Verification check complete. Verified: ${verified}, Failed: ${failed}`);
    
  } catch (error) {
    console.error('Auto-verification error:', error);
  }
}

function startAutoVerification() {
  cron.schedule('*/30 * * * *', checkPendingVerifications);
  console.log('✅ Auto-verification started (runs every 30 minutes)');
  
  setTimeout(() => checkPendingVerifications(), 10000);
}

module.exports = { startAutoVerification, checkPendingVerifications };
