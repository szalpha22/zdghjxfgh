const express = require('express');
const router = express.Router();
const { db } = require('../../src/database/init');

function generateVerificationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.get('/', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT * FROM social_accounts 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.render('pages/accounts', { user: req.user, accounts });
  } catch (error) {
    console.error('Error loading accounts:', error);
    res.status(500).send('Error loading accounts');
  }
});

router.post('/link', (req, res) => {
  try {
    const { platform, account_handle, account_url } = req.body;
    
    if (!platform || !account_handle || !account_url) {
      return res.json({ success: false, message: 'All fields are required' });
    }

    const verificationCode = generateVerificationCode();

    const stmt = db.prepare(`
      INSERT INTO social_accounts (user_id, platform, account_handle, account_url, verification_code, verification_status)
      VALUES (?, ?, ?, ?, ?, 'pending')
      ON CONFLICT(user_id, platform) 
      DO UPDATE SET 
        account_handle = excluded.account_handle,
        account_url = excluded.account_url,
        verification_code = excluded.verification_code,
        verification_status = 'pending',
        updated_at = CURRENT_TIMESTAMP
    `);
    
    stmt.run(req.user.id, platform, account_handle, account_url, verificationCode);

    res.json({ 
      success: true, 
      message: '✅ Account linked! Add the verification code to your bio and click "Submit for Verification".',
      verificationCode: verificationCode
    });
  } catch (error) {
    console.error('Error linking account:', error);
    res.json({ success: false, message: 'Failed to link account' });
  }
});

router.post('/remove/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM social_accounts WHERE id = ? AND user_id = ?');
    stmt.run(req.params.id, req.user.id);
    
    res.json({ success: true, message: 'Account removed successfully' });
  } catch (error) {
    console.error('Error removing account:', error);
    res.json({ success: false, message: 'Failed to remove account' });
  }
});

router.post('/verify/:id', async (req, res) => {
  try {
    const { verifyAccountCode } = require('../../src/services/verification');
    
    const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!account) {
      return res.json({ success: false, message: 'Account not found' });
    }

    if (account.verification_status === 'verified') {
      return res.json({ success: false, message: 'Account is already verified!' });
    }

    const result = await verifyAccountCode(
      account.platform, 
      account.account_url, 
      account.verification_code,
      req.user.id,
      account.account_handle,
      null
    );

    if (result.verified) {
      const stmt = db.prepare(`
        UPDATE social_accounts 
        SET verification_status = 'verified', verified_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
      `);
      stmt.run(req.params.id, req.user.id);

      res.json({ success: true, message: '✅ Verification successful! Your account has been verified.' });
    } else if (result.ticketCreated) {
      res.json({ 
        success: false, 
        message: `🎫 Automatic verification failed. Support ticket #${result.ticketId} has been created for manual review. You'll be notified once verified!` 
      });
    } else {
      res.json({ 
        success: false, 
        message: `❌ Verification failed: ${result.reason}. Please make sure the code "${account.verification_code}" is in your ${account.platform} bio/description.` 
      });
    }
  } catch (error) {
    console.error('Error verifying account:', error);
    res.json({ success: false, message: 'Failed to verify account' });
  }
});

module.exports = router;
