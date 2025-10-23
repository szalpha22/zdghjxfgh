const express = require('express');
const router = express.Router();
const { db } = require('../../src/database/init');

router.get('/', (req, res) => {
  const leaderboard = db.prepare(`
    SELECT 
      s.user_id,
      u.username,
      SUM(CASE WHEN s.status = 'approved' THEN s.views ELSE 0 END) as total_views,
      COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved_clips
    FROM submissions s
    JOIN users u ON s.user_id = u.user_id
    GROUP BY s.user_id
    ORDER BY total_views DESC
    LIMIT 100
  `).all();
  
  res.render('pages/leaderboard', { user: req.user, leaderboard });
});

module.exports = router;
