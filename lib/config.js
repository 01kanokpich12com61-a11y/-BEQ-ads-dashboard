'use strict';
const fs = require('node:fs');
const path = require('node:path');

// โหลด .env แบบง่าย ๆ (ไม่ต้องติดตั้งแพ็กเกจเพิ่ม)
(function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined && val !== '') process.env[m[1]] = val;
  }
})();

// Render ตั้งตัวแปร RENDER=true ให้อัตโนมัติ
const onRender = Boolean(process.env.RENDER);
const isProduction = process.env.NODE_ENV === 'production' || onRender;
const flag = (name, fallback) => (process.env[name] === undefined || process.env[name] === '' ? fallback : process.env[name] === '1');

module.exports = {
  isProduction,
  onRender,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || (process.env.RENDER || process.env.PORT ? '0.0.0.0' : '127.0.0.1'),
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  publicDir: path.join(__dirname, '..', 'public'),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  usingDefaultPassword: !process.env.ADMIN_PASSWORD,
  // production (HTTPS) เปิด Secure cookie อัตโนมัติ ตั้ง COOKIE_SECURE=0 เพื่อปิดได้
  secureCookie: flag('COOKIE_SECURE', isProduction),
  metaApiVersion: process.env.META_API_VERSION || 'v25.0',
  // อยู่หลัง Render/Nginx/Caddy: ใช้ X-Forwarded-For เป็น IP ลูกค้า (Render เปิดให้อัตโนมัติ)
  trustProxy: flag('TRUST_PROXY', onRender),
  tzOffsetHours: 7, // Asia/Bangkok
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || '',
};
