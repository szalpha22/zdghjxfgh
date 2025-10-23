const { db } = require('../database/init');
const fs = require('fs');
const path = require('path');

function createBackup() {
  try {
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `database_reset_${timestamp}.db`);
    const dbPath = path.join(__dirname, '../../clipmaster.db');

    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`✅ Database backup created: ${backupPath}`);
      return backupPath;
    }

    return null;
  } catch (error) {
    console.error('❌ Backup creation failed:', error);
    throw error;
  }
}

function resetDatabase(performedBy = 'system') {
  try {
    console.log('🔄 Starting database reset...');
    
    const backupPath = createBackup();
    
    db.exec('PRAGMA foreign_keys = OFF;');
    
    const transaction = db.transaction(() => {
      const tables = [
        'view_logs',
        'persistent_messages',
        'moderation_logs',
        'warnings',
        'rate_limits',
        'campaign_members',
        'submissions',
        'payouts',
        'invites',
        'tickets',
        'social_accounts',
        'campaigns',
        'users'
      ];

      let deletedCount = 0;
      
      for (const table of tables) {
        try {
          const result = db.prepare(`DELETE FROM ${table}`).run();
          deletedCount += result.changes;
          console.log(`  ✓ Cleared ${table} (${result.changes} rows)`);
        } catch (error) {
          console.log(`  ⚠️ Table ${table} might not exist or already empty`);
        }
      }

      try {
        db.prepare(`
          INSERT INTO moderation_logs (action_type, moderator_id, target_id, reason, timestamp)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          'DATABASE_RESET',
          performedBy,
          'system',
          JSON.stringify({ 
            backup: backupPath,
            rows_deleted: deletedCount,
            timestamp: new Date().toISOString()
          })
        );
      } catch (logError) {
        console.log('  ⚠️ Could not log to moderation_logs (table may not match schema)');
      }

      console.log(`✅ Deleted ${deletedCount} total rows across all tables`);
    });

    transaction();
    
    db.exec('PRAGMA foreign_keys = ON;');
    
    db.exec('VACUUM;');
    console.log('✅ Database vacuumed');
    
    console.log('✅ Database reset complete!');
    console.log(`📦 Backup saved to: ${backupPath}`);
    
    return {
      success: true,
      backupPath,
      message: 'Database reset successfully'
    };
    
  } catch (error) {
    db.exec('PRAGMA foreign_keys = ON;');
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

module.exports = { resetDatabase, createBackup };
