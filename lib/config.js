const fs = require('fs'), path = require('path');
// tiny .env loader (no dependencies)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
process.env.TZ = process.env.TZ || 'Asia/Karachi'; // report times use this timezone
module.exports = {
  port: +process.env.PORT || 3000,
  token: process.env.WHATSAPP_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'change-me',
  appSecret: process.env.APP_SECRET || '',
  apiVersion: process.env.GRAPH_API_VERSION || 'v21.0',
  msClientId: process.env.MS_CLIENT_ID || '',   // optional: Microsoft app (client) ID, can also be typed in the dashboard
  msTenant: process.env.MS_TENANT || '',
  adminPin: process.env.ADMIN_PIN || '1234',
  seedDemo: process.env.SEED_DEMO !== 'false',
  dataFile: process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json'),
  get live() { return !!(this.token && this.phoneNumberId); },
};
