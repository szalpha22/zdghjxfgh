require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const { db } = require('../src/database/init');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = 5000;

// Create Discord client for login logging
const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Login to Discord
discordClient.login(process.env.BOT_TOKEN).catch(err => {
  console.error('❌ Failed to login Discord client for web logging:', err);
});

discordClient.once('clientReady', () => {
  console.log('✅ Discord login logger ready');
});

// Make client available to routes
app.set('discordClient', discordClient);

app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cliphub-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

const DOMAIN = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG || 'localhost:5000';

// Check if we have a custom deployment domain (for published apps)
const CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 
  (process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/auth/callback`
    : process.env.REPL_SLUG && process.env.REPL_OWNER
    ? `https://${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app/auth/callback`
    : `http://localhost:${PORT}/auth/callback`);

console.log('🔐 OAuth Callback URL:', CALLBACK_URL);
console.log('🔑 CLIENT_IDD configured:', process.env.CLIENT_IDD ? 'Yes' : 'No (MISSING!)');

if (!process.env.CLIENT_IDD || !process.env.CLIENT_SECRET) {
  console.error('❌ ERROR: CLIENT_IDD or CLIENT_SECRET is missing!');
}

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_IDD,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['identify', 'guilds']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      if (!db) {
        return done(new Error('Database not initialized'), null);
      }
      const stmt = db.prepare('INSERT OR REPLACE INTO users (user_id, username, avatar) VALUES (?, ?, ?)');
      stmt.run(profile.id, profile.username, profile.avatar);
      
      return done(null, profile);
    } catch (error) {
      console.error('Discord auth error:', error);
      return done(error, null);
    }
  }
));

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

async function isAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  
  const isDeveloper = req.user.id === process.env.DEVELOPER_ID;
  
  let hasAdminRole = false;
  if (process.env.ADMIN_ROLE_ID && discordClient.guilds.cache.size > 0) {
    try {
      const guild = discordClient.guilds.cache.first();
      const member = await guild.members.fetch(req.user.id).catch(() => null);
      if (member && member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        hasAdminRole = true;
      }
    } catch (error) {
      console.error('Error checking admin role:', error);
    }
  }
  
  if (!isDeveloper && !hasAdminRole) {
    return res.status(403).render('pages/error', { 
      user: req.user, 
      error: 'Access Denied',
      message: 'You do not have permission to access the admin panel. Only authorized administrators can view this page.'
    });
  }
  
  return next();
}

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const submissionRoutes = require('./routes/submissions');
const payoutRoutes = require('./routes/payouts');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const leaderboardRoutes = require('./routes/leaderboard');
const accountsRoutes = require('./routes/accounts');
const { startViewTracker } = require('../cron/viewTracker');
const { startAutoVerification } = require('../cron/autoVerification');

app.use('/auth', authRoutes);
app.use('/campaigns', isAuthenticated, campaignRoutes);
app.use('/submissions', isAuthenticated, submissionRoutes);
app.use('/payouts', isAuthenticated, payoutRoutes);
app.use('/admin', isAuthenticated, isAdmin, adminRoutes);
app.use('/user', isAuthenticated, userRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/accounts', isAuthenticated, accountsRoutes);

app.get('/', (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns WHERE status = ? ORDER BY created_at DESC LIMIT 6').all('active');
  res.render('pages/home', { user: req.user, campaigns });
});

app.get('/login', (req, res) => {
  res.render('pages/login', { user: null });
});

app.get('/help', (req, res) => {
  res.render('pages/help', { user: req.user });
});

app.get('/terms', (req, res) => {
  res.render('pages/terms', { user: req.user });
});

app.get('/privacy', (req, res) => {
  res.render('pages/privacy', { user: req.user });
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  const userStats = db.prepare(`
    SELECT 
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_clips,
      SUM(CASE WHEN status = 'approved' THEN views ELSE 0 END) as total_views,
      COUNT(*) as total_submissions
    FROM submissions WHERE user_id = ?
  `).get(req.user.id);
  
  const payoutStats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_earned,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payouts
    FROM payouts WHERE user_id = ?
  `).get(req.user.id);

  const socialAccounts = db.prepare(`
    SELECT * FROM social_accounts 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(req.user.id);

  const verifiedCount = socialAccounts.filter(acc => acc.verification_status === 'verified').length;

  res.render('pages/dashboard', { user: req.user, userStats, payoutStats, socialAccounts, verifiedCount });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 ClipHub Website running on port ${PORT}`);
  console.log(`📱 Visit: http://localhost:${PORT}`);
  
  startViewTracker();
  startAutoVerification();
});

module.exports = app;
