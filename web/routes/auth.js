const express = require('express');
const passport = require('passport');
const router = express.Router();
const { logUserLogin, parseUserAgent } = require('../../src/utils/loginLogger');

router.get('/discord', passport.authenticate('discord'));

router.get('/callback', 
  passport.authenticate('discord', { failureRedirect: '/login' }),
  async (req, res) => {
    // Log user login to Discord
    try {
      const userAgent = req.headers['user-agent'] || '';
      const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || 'Unknown';
      const { device, browser, os } = parseUserAgent(userAgent);

      // Get Discord bot client from the app
      const client = req.app.get('discordClient');
      
      if (client && req.user) {
        await logUserLogin(client, {
          username: req.user.username,
          userId: req.user.id,
          ip: ip,
          userAgent: userAgent,
          device: device,
          browser: browser,
          os: os,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error logging user login:', error);
    }

    res.redirect('/dashboard');
  }
);

router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

module.exports = router;
