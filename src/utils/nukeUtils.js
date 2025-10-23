const fs = require('fs');
const path = require('path');
const { db } = require('../database/init');

function generateNukeId() {
  return `NUKE-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

async function backupMessages(channel, limit = 100) {
  try {
    const actualLimit = Math.min(limit, 100);
    const messages = await channel.messages.fetch({ limit: actualLimit });
    return Array.from(messages.values()).map(msg => ({
      id: msg.id,
      author: {
        id: msg.author.id,
        tag: msg.author.tag,
        bot: msg.author.bot
      },
      content: msg.content,
      embeds: msg.embeds.map(e => e.toJSON()),
      attachments: Array.from(msg.attachments.values()).map(a => ({
        url: a.url,
        name: a.name
      })),
      createdTimestamp: msg.createdTimestamp,
      createdAt: msg.createdAt.toISOString()
    }));
  } catch (error) {
    console.error('Error backing up messages:', error);
    return [];
  }
}

function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', 'nukes');
  const backupPath = path.join(backupDir, `db-backup-${timestamp}.db`);
  
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const sourceDb = path.join(process.cwd(), 'clipmaster.db');
    fs.copyFileSync(sourceDb, backupPath);
    return backupPath;
  } catch (error) {
    console.error('Error backing up database:', error);
    return null;
  }
}

async function saveNukeBackup(nukeId, channelData, messagesBackup, dbBackupPath, executor, reason) {
  const backupData = {
    nukeId,
    timestamp: new Date().toISOString(),
    executor: {
      id: executor.id,
      tag: executor.tag
    },
    reason,
    channel: channelData,
    messages: messagesBackup,
    dbBackupPath,
    messageCount: messagesBackup.length
  };

  const backupDir = path.join(process.cwd(), 'backups', 'nukes');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupFilePath = path.join(backupDir, `${nukeId}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

  const stmt = db.prepare(`
    CREATE TABLE IF NOT EXISTS nuke_logs (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      executor_id TEXT NOT NULL,
      reason TEXT,
      message_count INTEGER,
      backup_path TEXT,
      db_backup_path TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  stmt.run();

  const insertStmt = db.prepare(`
    INSERT INTO nuke_logs (id, channel_id, channel_name, executor_id, reason, message_count, backup_path, db_backup_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStmt.run(
    nukeId,
    channelData.id,
    channelData.name,
    executor.id,
    reason,
    messagesBackup.length,
    backupFilePath,
    dbBackupPath
  );

  return backupFilePath;
}

function getNukeInfo(nukeId) {
  try {
    const stmt = db.prepare('SELECT * FROM nuke_logs WHERE id = ?');
    const log = stmt.get(nukeId);
    
    if (!log) return null;

    const backupFilePath = path.join(process.cwd(), 'backups', 'nukes', `${nukeId}.json`);
    if (fs.existsSync(backupFilePath)) {
      const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      return { ...log, backupData };
    }

    return log;
  } catch (error) {
    console.error('Error getting nuke info:', error);
    return null;
  }
}

module.exports = {
  generateNukeId,
  backupMessages,
  backupDatabase,
  saveNukeBackup,
  getNukeInfo
};
