'use strict';
const crypto = require('node:crypto');
const store = require('./store');
const config = require('./config');

const SESSION_MS = 12 * 60 * 60 * 1000;
const sessions = new Map(); // token -> { username, exp }
const attempts = new Map(); // ip -> { count, until }

// Helper เพื่อเก็บ Session ลง store (SQLite + Supabase + JSON) ทำให้เซิร์ฟเวอร์ restart/sleep แล้วไม่หลุด
function readPersistedSessions() {
  try {
    const data = store.read('sessions.json', {});
    if (data && typeof data === 'object') {
      const now = Date.now();
      for (const [t, s] of Object.entries(data)) {
        if (s && s.exp && s.exp > now) {
          sessions.set(t, s);
        }
      }
    }
  } catch {}
}

function persistSessions() {
  try {
    const obj = {};
    const now = Date.now();
    for (const [t, s] of sessions.entries()) {
      if (s && s.exp && s.exp > now) {
        obj[t] = s;
      }
    }
    store.write('sessions.json', obj);
  } catch {}
}

// โหลด sessions เดิมทันทีเมื่อโมดูลเริ่มทำงาน
readPersistedSessions();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  const [type, saltHex, hashHex] = String(stored).split('$');
  if (type !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// คืนค่า false ถ้ามีผู้ใช้อยู่แล้ว, คืน { password, generated } ถ้าสร้าง admin ใหม่
function ensureAdmin() {
  const db = store.read('users.json', null);
  if (db && Array.isArray(db.users) && db.users.length) return false;
  let password = config.adminPassword;
  let generated = false;
  // บน production ห้ามใช้รหัสเริ่มต้นที่ใครก็รู้ ให้สุ่มรหัสชั่วคราวแล้วพิมพ์ลง log ของเซิร์ฟเวอร์แทน
  if (config.usingDefaultPassword && config.isProduction) {
    password = crypto.randomBytes(12).toString('base64url');
    generated = true;
  }
  store.write('users.json', {
    users: [{
      username: config.adminUser,
      passwordHash: hashPassword(password),
      role: 'admin',
      mustChange: config.usingDefaultPassword,
      createdAt: new Date().toISOString(),
    }],
  });
  invalidateUsersCache();
  return { password: generated ? password : null, generated };
}

let usersCache = null;
let usersCacheAt = 0;

function invalidateUsersCache() {
  usersCache = null;
  usersCacheAt = 0;
}

function findUser(username) {
  const cleanU = String(username || '').trim();
  const now = Date.now();
  if (!usersCache || now - usersCacheAt > 15000) {
    try {
      const db = store.read('users.json', null);
      if (db && Array.isArray(db.users) && db.users.length) {
        usersCache = db.users;
        usersCacheAt = now;
      }
    } catch {}
  }
  if (usersCache) {
    const found = usersCache.find((u) => u.username === cleanU);
    if (found) return found;
  }
  // Fallback direct read
  try {
    const db = store.read('users.json', { users: [] });
    if (db && Array.isArray(db.users)) {
      const found = db.users.find((u) => u.username === cleanU);
      if (found) return found;
    }
  } catch {}
  return null;
}

function checkRateLimit(key, max = 5) {
  const a = attempts.get(key);
  if (a && a.until > Date.now() && a.count >= max) return Math.ceil((a.until - Date.now()) / 1000);
  return 0;
}
function recordFailure(ip) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.until <= now) attempts.set(ip, { count: 1, until: now + 10 * 60 * 1000 });
  else a.count += 1;
}

function login(username, password, ip) {
  const cleanUser = String(username || '').trim();
  const cleanPw = String(password || '');

  // จำกัดทั้งต่อ IP และต่อชื่อผู้ใช้ (กันการปลอม X-Forwarded-For เพื่อเดารหัสผ่านบัญชีเดียว)
  const userKey = 'u:' + cleanUser.toLowerCase();
  const wait = Math.max(checkRateLimit(ip), checkRateLimit(userKey, 10));
  if (wait) return { error: `ลองผิดหลายครั้งเกินไป กรุณารอ ${Math.ceil(wait / 60)} นาที`, status: 429 };
  const user = findUser(cleanUser);
  // คำนวณ hash เสมอ เพื่อไม่ให้เดา username ได้จากเวลาตอบสนอง
  const ok = user && user.passwordHash ? verifyPassword(cleanPw, user.passwordHash)
    : (verifyPassword('x', hashPassword('y')), false);
  if (!ok) { recordFailure(ip); recordFailure(userKey); return { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', status: 401 }; }
  attempts.delete(ip); attempts.delete(userKey);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: user.username, exp: Date.now() + SESSION_MS });
  persistSessions();
  return { token, user };
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie).sid;
  if (!token) return null;
  let s = sessions.get(token);
  if (!s) {
    // ถ้ายังไม่มีใน RAM (เช่นเพิ่ง Restart) ให้ลองอ่านจาก store อีกครั้ง
    readPersistedSessions();
    s = sessions.get(token);
  }
  if (!s) return null;
  if (s.exp < Date.now()) {
    sessions.delete(token);
    persistSessions();
    return null;
  }
  // ยืดอายุ session
  s.exp = Date.now() + SESSION_MS;
  const user = findUser(s.username);
  if (!user) { sessions.delete(token); persistSessions(); return null; }
  return { token, user };
}

function destroy(token) { sessions.delete(token); persistSessions(); }

function cookieHeader(token, maxAgeSec) {
  const parts = [`sid=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (config.secureCookie) parts.push('Secure');
  return parts.join('; ');
}

function changePassword(username, current, next) {
  const db = store.read('users.json', { users: [] });
  const user = db.users.find((u) => u.username === username);
  if (!user || !verifyPassword(String(current || ''), user.passwordHash)) return 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
  if (String(next || '').length < 8) return 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร';
  if (next === 'admin1234') return 'กรุณาเลือกรหัสผ่านอื่นที่ไม่ใช่ค่าเริ่มต้น';
  user.passwordHash = hashPassword(next);
  user.mustChange = false;
  store.write('users.json', db);
  invalidateUsersCache();
  return null;
}

/* ---------- จัดการผู้ใช้ (เฉพาะ admin) ---------- */
// บัญชีเดิมที่ไม่มีฟิลด์ role ถือเป็น admin (ย้อนหลังเข้ากันได้)
const isAdmin = (user) => Boolean(user) && (user.role === 'admin' || !user.role);
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

function passwordProblem(pw) {
  if (String(pw || '').length < 8) return 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร';
  if (pw === 'admin1234') return 'ห้ามใช้รหัสผ่านเริ่มต้น';
  return null;
}

function listUsers() {
  const db = store.read('users.json', { users: [] });
  return db.users.map((u) => ({
    username: u.username, role: isAdmin(u) ? 'admin' : 'staff', mustChange: Boolean(u.mustChange), createdAt: u.createdAt || null,
  }));
}

// เพิ่มหลายคนในครั้งเดียว: items = [{ username, password, role }]  คืน { added: [...], skipped: [{ username, reason }] }
function addUsers(items) {
  const db = store.read('users.json', { users: [] });
  const added = []; const skipped = [];
  for (const it of Array.isArray(items) ? items : []) {
    const username = String(it.username || '').trim();
    const password = String(it.password || '');
    const role = it.role === 'admin' ? 'admin' : 'staff';
    let reason = null;
    if (!USERNAME_RE.test(username)) reason = 'ชื่อผู้ใช้ต้องเป็น a-z 0-9 _ . - ยาว 3–30 ตัว';
    else if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) reason = 'มีชื่อผู้ใช้นี้อยู่แล้ว';
    else reason = passwordProblem(password);
    if (reason) { skipped.push({ username, reason }); continue; }
    db.users.push({ username, passwordHash: hashPassword(password), role, mustChange: true, createdAt: new Date().toISOString() });
    added.push({ username, role });
  }
  if (added.length) {
    store.write('users.json', db);
    invalidateUsersCache();
  }
  return { added, skipped };
}

function destroyUserSessions(username) {
  for (const [token, s] of sessions) if (s.username === username) sessions.delete(token);
  persistSessions();
}

// admin ตั้งรหัสชั่วคราวใหม่ให้ผู้ใช้ (ผู้ใช้ต้องเปลี่ยนเองหลังล็อกอิน) คืนข้อความ error หรือ null
function resetPassword(username, password) {
  const problem = passwordProblem(password);
  if (problem) return problem;
  const db = store.read('users.json', { users: [] });
  const user = db.users.find((u) => u.username === username);
  if (!user) return 'ไม่พบผู้ใช้นี้';
  user.passwordHash = hashPassword(password);
  user.mustChange = true;
  store.write('users.json', db);
  invalidateUsersCache();
  destroyUserSessions(username);
  return null;
}

function deleteUser(username, actor) {
  if (username === actor) return 'ลบบัญชีของตัวเองไม่ได้';
  const db = store.read('users.json', { users: [] });
  const user = db.users.find((u) => u.username === username);
  if (!user) return 'ไม่พบผู้ใช้นี้';
  if (isAdmin(user) && db.users.filter(isAdmin).length <= 1) return 'ต้องเหลือผู้ดูแล (admin) อย่างน้อย 1 คน';
  db.users = db.users.filter((u) => u.username !== username);
  store.write('users.json', db);
  invalidateUsersCache();
  destroyUserSessions(username);
  return null;
}

module.exports = {
  ensureAdmin, login, getSession, destroy, cookieHeader, changePassword,
  isAdmin, listUsers, addUsers, resetPassword, deleteUser,
};