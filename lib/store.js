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
function getSupabaseConfig() {
  if (config.supabaseUrl && config.supabaseKey) {
    return { url: config.supabaseUrl.replace(/\/+$/, ''), key: config.supabaseKey };
  }
  try {
    let s = null;
    if (db && stmts) {
      const row = stmts.get.get('settings.json');
      if (row) s = JSON.parse(row.value);
    }
    if (!s) s = jsonRead('settings.json', {});
    const sb = (s && s.supabase) || {};
    if (sb.url && sb.key) {
      return { url: String(sb.url).trim().replace(/\/+$/, ''), key: String(sb.key).trim() };
    }
  } catch {}
  return { url: '', key: '' };
}

function isSupabaseConnected() {
  const c = getSupabaseConfig();
  return Boolean(c.url && c.key);
}

// ซิงค์ข้อมูลขึ้น Supabase ในพื้นหลัง (ไม่บล็อกการทำงาน)
// - ต่อชื่อไฟล์ ส่งทีละคำขอเท่านั้น และส่งเฉพาะค่าล่าสุด: กันกรณีคำขอเก่าไปถึงทีหลังแล้วทับข้อมูลใหม่ (ข้อมูลหายตอนรีสตาร์ท)
// - รวมการเขียนถี่ ๆ (เช่นแชทเข้ารัว ๆ) เป็นครั้งเดียวทุก ~1 วินาที ไม่ต้องอัปโหลดไฟล์ใหญ่ซ้ำทุกข้อความ
// - ล้มเหลวจะลองใหม่อัตโนมัติ (สูงสุด 5 ครั้ง ห่างขึ้นเรื่อย ๆ)
const syncState = new Map(); // name -> { pending, hasPending, running, timer, tries }
const SYNC_DEBOUNCE_MS = 1000;

async function pushToSupabase(name, value) {
  const c = getSupabaseConfig();
  if (!c.url || !c.key) return;
  const res = await fetch(`${c.url}/rest/v1/kv?on_conflict=name`, {
    method: 'POST',
    headers: {
      'apikey': c.key,
      'Authorization': `Bearer ${c.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ name, value, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
}

async function drainSync(name) {
  const st = syncState.get(name);
  if (!st || st.running) return;
  st.running = true;
  try {
    while (st.hasPending) {
      const value = st.pending;
      st.hasPending = false; st.pending = undefined;
      try {
        await pushToSupabase(name, value);
        st.tries = 0;
      } catch (err) {
        st.tries = (st.tries || 0) + 1;
        console.error(`[Supabase] Sync failed for ${name} (ครั้งที่ ${st.tries}):`, err.message);
        if (!st.hasPending) { st.pending = value; st.hasPending = true; } // ยังไม่มีค่าใหม่กว่า → ส่งค่าเดิมซ้ำ
        if (st.tries >= 5) { st.tries = 0; st.hasPending = false; st.pending = undefined; console.error(`[Supabase] เลิกลองส่ง ${name} ชั่วคราว (จะส่งใหม่เมื่อมีการบันทึกครั้งถัดไป)`); break; }
        await new Promise((r) => setTimeout(r, 2000 * st.tries));
      }
    }
  } finally {
    st.running = false;
  }
}

function syncToSupabase(name, value) {
  if (!isSupabaseConnected()) return;
  let st = syncState.get(name);
  if (!st) { st = { pending: undefined, hasPending: false, running: false, timer: null, tries: 0 }; syncState.set(name, st); }
  st.pending = value; st.hasPending = true;
  // รอให้เงียบ ~1 วินาทีค่อยส่ง แต่ถ้าเขียนรัวต่อเนื่องก็ต้องส่งอย่างน้อยทุก 5 วินาที
  if (!st.firstAt) st.firstAt = Date.now();
  if (st.timer && Date.now() - st.firstAt >= 5000) return;
  clearTimeout(st.timer);
  st.timer = setTimeout(() => { st.timer = null; st.firstAt = 0; drainSync(name); }, SYNC_DEBOUNCE_MS);
}

// ส่งทุกอย่างที่ค้างอยู่ให้เสร็จ (เรียกก่อนปิดเซิร์ฟเวอร์ตอน deploy)
async function flushSupabase(timeoutMs = 8000) {
  const jobs = [];
  for (const [name, st] of syncState) {
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    if (st.hasPending || st.running) jobs.push(drainSync(name));
  }
  // รอจนคิวว่าง (drainSync ที่กำลังรันอยู่จะส่งค่าที่ค้างต่อเอง)
  const until = Date.now() + timeoutMs;
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, timeoutMs))]);
  while (Date.now() < until && [...syncState.values()].some((st) => st.running || st.hasPending)) await new Promise((r) => setTimeout(r, 100));
}

// โหลดข้อมูลล่าสุดจาก Supabase
async function initFromSupabase(throwOnError = false) {
  const c = getSupabaseConfig();
  if (!c.url || !c.key) {
    if (throwOnError) throw new Error('ยังไม่ได้ตั้งค่า Supabase URL และ API Key');
    return { ok: false, count: 0 };
  }
  try {
    const res = await fetch(`${c.url}/rest/v1/kv?select=name,value,updated_at`, {
      headers: {
        'apikey': c.key,
        'Authorization': `Bearer ${c.key}`
      },
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const msg = `Supabase ตอบกลับสถานะ HTTP ${res.status}${errBody ? ': ' + errBody.slice(0, 120) : ''}`;
      console.warn('[Supabase]', msg);
      if (throwOnError) throw new Error(msg);
      return { ok: false, count: 0 };
    }
    const rows = await res.json();
    let count = 0;
    if (Array.isArray(rows) && rows.length > 0) {
      for (const row of rows) {
        if (!row.name || row.value === undefined) continue;
        const rawStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
        let parsed;
        try { parsed = JSON.parse(rawStr); } catch { parsed = row.value; }
        if (db && stmts) {
          stmts.put.run(row.name, JSON.stringify(parsed), row.updated_at || new Date().toISOString());
        }
        jsonWrite(row.name, parsed);
        count++;
      }
      console.log(`[Supabase] Synced ${count} tables/keys from Cloud DB successfully.`);
    }
    return { ok: true, count };
  } catch (err) {
    console.warn('[Supabase] Could not sync, fallback to local DB:', err.message);
    if (throwOnError) throw err;
    return { ok: false, count: 0 };
  }
}

// เก็บ promise ไว้ให้ server.js รอได้
const readyPromise = isSupabaseConnected() ? initFromSupabase(false) : Promise.resolve();

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
  get backend() { return isSupabaseConnected() ? 'supabase+sqlite' : (db ? 'sqlite' : 'json'); },
  get hasSupabase() { return isSupabaseConnected(); },
  getSupabaseConfig,
  syncToSupabase,
  flushSupabase,
  initFromSupabase
};
