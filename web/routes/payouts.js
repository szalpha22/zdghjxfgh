const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db } = require('../../src/database/init');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/clips'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const payouts = db.prepare('SELECT * FROM payouts WHERE user_id = ? ORDER BY requested_at DESC')
    .all(req.user.id);
  
  const earnings = db.prepare(`
    SELECT SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total
    FROM payouts WHERE user_id = ?
  `).get(req.user.id);
  
  res.render('pages/payouts', { user: req.user, payouts, earnings });
});

router.post('/request', upload.single('proof'), async (req, res) => {
  try {
    const { payout_method, amount } = req.body;
    const proofPath = req.file ? `/uploads/clips/${req.file.filename}` : null;
    
    const stmt = db.prepare(`
      INSERT INTO payouts (user_id, amount, payout_method, proof_file, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    stmt.run(req.user.id, amount, payout_method, proofPath);
    
    res.json({ success: true, message: 'Payout request submitted!' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to submit payout request' });
  }
});

module.exports = router;
