'use strict';
// ที่เก็บข้อมูล: รองรับ Supabase (Cloud Database) + SQLite (data/app.db) + JSON สำรอง
// API คงเดิม: read(name, fallback) / write(name, value)
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

const jsonFile = (name) => path.join(config.dataDir, name);

/* ---------- แบบไฟล์ JSON (สำรอง) ---------- */
function jsonRead(name, fallback) {
  try { return JSON.parse(fs.readFileSync(jsonFile(name), 'utf8')); } catch { return fallback; }
}
function jsonWrite(name, value) {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
    const tmp = jsonFile(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, jsonFile(name));
  } catch {}
}

/* ---------- แบบ SQLite ---------- */
let db = null;
let stmts = null;
try {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  db = new DatabaseSync(path.join(config.dataDir, 'app.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS kv (name TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
  try { fs.chmodSync(path.join(config.dataDir, 'app.db'), 0o600); } catch {}
  stmts = {
    get: db.prepare('SELECT value FROM kv WHERE name = ?'),
    put: db.prepare('INSERT INTO kv (name, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'),
    all: db.prepare('SELECT name, value FROM kv'),
  };
} catch {
  db = null;
}

/* ---------- แบบ Supabase (Cloud) ---------- */
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseKey);
const supabaseEndpoint = hasSupabase
  ? `${config.supabaseUrl.replace(/\/+$/, '')}/rest/v1/kv`
  : null;

// ซิงค์ข้อมูลขึ้น Supabase ในพื้นหลัง (ไม่บล็อกการทำงาน)
function syncToSupabase(name, value) {
  if (!hasSupabase) return;
  const url = `${supabaseEndpoint}?on_conflict=name`;
  fetch(url, {
    method: 'POST',
    headers: {
      'apikey': config.supabaseKey,
      'Authorization': `Bearer ${config.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      name,
      value,
      updated_at: new Date().toISOString()
    })
  }).catch((err) => {
    console.error(`[Supabase] Sync failed for ${name}:`, err.message);
  });
}

// โหลดข้อมูลล่าสุดจาก Supabase ตอนเซิร์ฟเวอร์เริ่มทำงาน
async function initFromSupabase() {
  if (!hasSupabase) return;
  try {
    const res = await fetch(`${supabaseEndpoint}?select=name,value,updated_at`, {
      headers: {
        'apikey': config.supabaseKey,
        'Authorization': `Bearer ${config.supabaseKey}`
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
      console.warn('[Supabase] Initial fetch returned status:', res.status);
      return;
    }
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      for (const row of rows) {
        if (!row.name || row.value === undefined) continue;
        // row.value จาก Supabase อาจเป็น string (JSON) หรือ object แล้วแต่ column type
        // ต้องการเก็บลง SQLite เป็น JSON string เสมอ
        const rawStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
        // parse กลับมาเป็น object เพื่อเขียน JSON file และเก็บ SQLite ถูกต้อง
        let parsed;
        try { parsed = JSON.parse(rawStr); } catch { parsed = row.value; }
        if (db && stmts) {
          stmts.put.run(row.name, JSON.stringify(parsed), row.updated_at || new Date().toISOString());
        }
        jsonWrite(row.name, parsed);
      }
      console.log(`[Supabase] Synced ${rows.length} tables/keys from Cloud DB successfully.`);
    }
  } catch (err) {
    console.warn('[Supabase] Could not sync on boot, fallback to local DB:', err.message);
  }
}

// เก็บ promise ไว้ให้ server.js รอได้
const readyPromise = hasSupabase ? initFromSupabase() : Promise.resolve();

function read(name, fallback) {
  if (db && stmts) {
    const row = stmts.get.get(name);
    if (row) {
      try { return JSON.parse(row.value); } catch { return fallback; }
    }
  }
  return jsonRead(name, fallback);
}

function write(name, value) {
  if (db && stmts) {
    stmts.put.run(name, JSON.stringify(value), new Date().toISOString());
  }
  jsonWrite(name, value);
  syncToSupabase(name, value);
}

module.exports = {
  read,
  write,
  ready: readyPromise,
  backend: hasSupabase ? 'supabase+sqlite' : (db ? 'sqlite' : 'json'),
  hasSupabase,
  syncToSupabase,
  initFromSupabase
};
