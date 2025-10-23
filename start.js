const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');




console.log('🚀 Starting ClipHub Bot & Web Server...\n');

const bot = spawn('node', ['src/index.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

setTimeout(() => {
  const web = spawn('node', ['web/server.js'], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  web.on('error', (error) => {
    console.error('❌ Web server error:', error);
  });

  web.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Web server exited with code ${code}`);
    }
  });
}, 2000);

bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Bot exited with code ${code}`);
  }
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down ClipHub...');
  process.exit(0);
});
