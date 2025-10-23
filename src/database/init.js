const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../clipmaster.db'));

function migrateDatabase() {
  try {
    const userColumns = db.prepare('PRAGMA table_info(users)').all();
    const userColumnNames = userColumns.map(col => col.name);
    
    if (!userColumnNames.includes('avatar')) {
      db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
      console.log('✅ Added avatar column to users table');
    }
    
    if (!userColumnNames.includes('balance')) {
      db.exec('ALTER TABLE users ADD COLUMN balance REAL DEFAULT 0');
      console.log('✅ Added balance column to users table');
    }
    
    // Campaign budget and channel tracking
    const campaignColumns = db.prepare('PRAGMA table_info(campaigns)').all();
    const campaignColumnNames = campaignColumns.map(col => col.name);
    
    if (!campaignColumnNames.includes('total_budget')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN total_budget REAL DEFAULT 0');
      console.log('✅ Added total_budget column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('budget_spent')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN budget_spent REAL DEFAULT 0');
      console.log('✅ Added budget_spent column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('category_id')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN category_id TEXT');
      console.log('✅ Added category_id column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('general_channel_id')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN general_channel_id TEXT');
      console.log('✅ Added general_channel_id column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('announcements_channel_id')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN announcements_channel_id TEXT');
      console.log('✅ Added announcements_channel_id column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('submissions_channel_id')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN submissions_channel_id TEXT');
      console.log('✅ Added submissions_channel_id column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('leaderboard_channel_id')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN leaderboard_channel_id TEXT');
      console.log('✅ Added leaderboard_channel_id column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('milestone_25')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN milestone_25 INTEGER DEFAULT 0');
      console.log('✅ Added milestone_25 column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('milestone_50')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN milestone_50 INTEGER DEFAULT 0');
      console.log('✅ Added milestone_50 column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('milestone_75')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN milestone_75 INTEGER DEFAULT 0');
      console.log('✅ Added milestone_75 column to campaigns table');
    }
    
    if (!campaignColumnNames.includes('milestone_100')) {
      db.exec('ALTER TABLE campaigns ADD COLUMN milestone_100 INTEGER DEFAULT 0');
      console.log('✅ Added milestone_100 column to campaigns table');
    }
    
    // Add updated_at column to submissions if it doesn't exist
    const submissionColumns = db.prepare('PRAGMA table_info(submissions)').all();
    const submissionColumnNames = submissionColumns.map(col => col.name);
    
    if (!submissionColumnNames.includes('updated_at')) {
      db.exec('ALTER TABLE submissions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      console.log('✅ Added updated_at column to submissions table');
    }
    
    // Migrate social_accounts to remove UNIQUE constraint for multiple accounts per platform
    const socialAccountsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='social_accounts'").get();
    const hasUniqueConstraint = socialAccountsSchema && socialAccountsSchema.sql && 
                                 socialAccountsSchema.sql.includes('UNIQUE(user_id, platform)');
    
    if (hasUniqueConstraint) {
      console.log('🔄 Migrating social_accounts to support multiple accounts per platform...');
      
      // Create backup and new table
      db.exec(`
        CREATE TABLE social_accounts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          account_handle TEXT NOT NULL,
          account_url TEXT NOT NULL,
          verification_code TEXT,
          verification_status TEXT DEFAULT 'pending',
          verified_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
        
        INSERT INTO social_accounts_new 
        SELECT * FROM social_accounts;
        
        DROP TABLE social_accounts;
        
        ALTER TABLE social_accounts_new RENAME TO social_accounts;
      `);
      
      console.log('✅ social_accounts migration complete - multiple accounts per platform now supported!');
    }
  } catch (error) {
    console.log('Migration skipped or already applied:', error.message);
  }
}

function initializeDatabase() {
  migrateDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      platforms TEXT NOT NULL,
      content_source TEXT,
      rate_per_1k REAL NOT NULL,
      role_id TEXT,
      message_id TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar TEXT,
      verified INTEGER DEFAULT 0,
      banned INTEGER DEFAULT 0,
      balance REAL DEFAULT 0,
      payout_method TEXT,
      payout_address TEXT,
      bonus_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaign_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      UNIQUE(campaign_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      video_link TEXT NOT NULL,
      platform TEXT NOT NULL,
      views INTEGER DEFAULT 0,
      analytics_proof TEXT,
      status TEXT DEFAULT 'pending',
      flagged INTEGER DEFAULT 0,
      flag_reason TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      campaign_id INTEGER,
      amount REAL NOT NULL,
      payout_method TEXT,
      proof_file TEXT,
      analytics_proof TEXT,
      status TEXT DEFAULT 'pending',
      ticket_id INTEGER,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      rejection_reason TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      type TEXT NOT NULL,
      related_id INTEGER,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      transcript TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      inviter_id TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      left_at DATETIME,
      account_created_at DATETIME,
      has_default_avatar INTEGER DEFAULT 0,
      is_fake INTEGER DEFAULT 0,
      FOREIGN KEY (inviter_id) REFERENCES users(user_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS moderation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, action)
    );

    CREATE TABLE IF NOT EXISTS persistent_messages (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS view_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      views INTEGER DEFAULT 0,
      platform TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES submissions(id)
    );

    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      account_handle TEXT NOT NULL,
      account_url TEXT NOT NULL,
      verification_code TEXT,
      verification_status TEXT DEFAULT 'pending',
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_campaign ON submissions(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_link ON submissions(video_link);
    CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_invites_inviter ON invites(inviter_id);
  `);

  console.log('✅ Database initialized successfully');
}

module.exports = { db, initializeDatabase };
