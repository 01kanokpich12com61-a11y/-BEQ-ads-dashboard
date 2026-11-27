'use strict';
// LINE OA และ WhatsApp หลายบัญชี (เหมือนเพจ Facebook หลายเพจ)
// แต่ละบัญชีมี id ที่ใช้เป็น pageId ของลีด/แชท: บัญชีแรกที่ย้ายมาจากการตั้งค่าเดิมใช้ 'P-LINE' / 'P-WhatsApp'
// เพื่อให้แชทเดิมยังผูกกับบัญชีเดิม
const crypto = require('node:crypto');
const meta = require('./meta');

const rid = (p) => `${p}-${crypto.randomBytes(4).toString('hex')}`;

function settings() { return meta.getSettings(); }

// ---------- อ่านรายการบัญชี (ย้ายค่าเดิมแบบบัญชีเดียวมาเป็นรายการแรกอัตโนมัติ) ----------
function lineAccounts() {
  const s = settings();
  let list = Array.isArray(s.lineAccounts) ? s.lineAccounts.filter(Boolean) : null;
  if (!list) {
    list = [];
    const ln = s.line || {};
    if (ln.channelSecret || ln.channelAccessToken || ln.channelId) {
      list.push({ id: 'P-LINE', name: ln.botName || 'LINE Official Account', channelId: ln.channelId || '', channelSecret: ln.channelSecret || '', channelAccessToken: ln.channelAccessToken || '', botName: ln.botName || '', basicId: ln.basicId || '', botUserId: ln.botUserId || '', connectedAt: ln.connectedAt || null });
    }
    if (list.length) meta.saveSettings({ lineAccounts: list });
  }
  // ตั้งผ่าน Environment (Render) และยังไม่มีบัญชีที่ตรงกัน → ใช้เป็นบัญชีเพิ่ม (แก้/ลบในหน้าเว็บไม่ได้)
  const envSecret = process.env.LINE_CHANNEL_SECRET; const envToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if ((envSecret || envToken) && !list.some((a) => a.channelSecret === envSecret)) {
    list = list.concat([{ id: list.length ? 'LINE-ENV' : 'P-LINE', name: 'LINE OA (Environment)', channelSecret: envSecret || '', channelAccessToken: envToken || '', fromEnv: true }]);
  }
  return list;
}

function waAccounts() {
  const s = settings();
  let list = Array.isArray(s.waAccounts) ? s.waAccounts.filter(Boolean) : null;
  if (!list) {
    list = [];
    const wa = s.whatsapp || {};
    if (wa.phoneId || wa.accessToken) {
      list.push({ id: 'P-WhatsApp', name: wa.verifiedName || 'WhatsApp Business', wabaId: wa.wabaId || '', phoneId: wa.phoneId || '', accessToken: wa.accessToken || '', verifiedName: wa.verifiedName || '', displayPhone: wa.displayPhone || '', connectedAt: wa.connectedAt || null });
    }
    if (list.length) meta.saveSettings({ waAccounts: list });
  }
  return list;
}

const saveLine = (list) => meta.saveSettings({ lineAccounts: list.filter((a) => !a.fromEnv) });
const saveWa = (list) => meta.saveSettings({ waAccounts: list });

// ---------- เพิ่ม/แก้/ลบ ----------
function upsertLine(input) {
  const list = lineAccounts().filter((a) => !a.fromEnv);
  let acc = input.id ? list.find((a) => a.id === input.id) : null;
  if (!acc) { acc = { id: list.length ? rid('LINE') : 'P-LINE', connectedAt: null }; list.push(acc); }
  if (input.name !== undefined) acc.name = String(input.name || '').trim().slice(0, 80) || acc.name || 'LINE Official Account';
  if (input.channelId !== undefined) acc.channelId = String(input.channelId || '').trim().slice(0, 50);
  if (input.channelSecret) acc.channelSecret = String(input.channelSecret).trim().slice(0, 100);
  if (input.channelAccessToken) acc.channelAccessToken = String(input.channelAccessToken).trim().slice(0, 1000);
  saveLine(list);
  return acc;
}
function removeLine(id) { saveLine(lineAccounts().filter((a) => a.id !== id && !a.fromEnv)); }

function upsertWa(input) {
  const list = waAccounts();
  let acc = input.id ? list.find((a) => a.id === input.id) : null;
  const phoneId = String(input.phoneId || '').trim().slice(0, 50);
  if (!acc && phoneId) acc = list.find((a) => a.phoneId === phoneId) || null;
  if (!acc) { acc = { id: list.length ? `WA-${phoneId || crypto.randomBytes(4).toString('hex')}` : 'P-WhatsApp', connectedAt: null }; list.push(acc); }
  if (input.name !== undefined) acc.name = String(input.name || '').trim().slice(0, 80) || acc.name || 'WhatsApp Business';
  if (input.wabaId !== undefined) acc.wabaId = String(input.wabaId || '').trim().slice(0, 50);
  if (input.phoneId !== undefined) acc.phoneId = phoneId;
  if (input.accessToken) acc.accessToken = String(input.accessToken).trim().slice(0, 1000);
  saveWa(list);
  return acc;
}
function removeWa(id) { saveWa(waAccounts().filter((a) => a.id !== id)); }

function updateLine(id, patch) { const list = lineAccounts().filter((a) => !a.fromEnv); const a = list.find((x) => x.id === id); if (a) { Object.assign(a, patch); saveLine(list); } return a; }
function updateWa(id, patch) { const list = waAccounts(); const a = list.find((x) => x.id === id); if (a) { Object.assign(a, patch); saveWa(list); } return a; }

// ---------- จับคู่ข้อความที่เข้ามากับบัญชี ----------
// LINE: หาบัญชีที่ Channel Secret ตรวจลายเซ็นผ่าน (ปลอดภัยและไม่ต้องรู้ล่วงหน้าว่าเป็น OA ไหน)
function lineAccountForSignature(raw, signature) {
  const sig = String(signature || '');
  for (const a of lineAccounts()) {
    if (!a.channelSecret) continue;
    const expected = crypto.createHmac('sha256', a.channelSecret).update(raw).digest('base64');
    const x = Buffer.from(sig); const y = Buffer.from(expected);
    if (x.length === y.length && crypto.timingSafeEqual(x, y)) return a;
  }
  return null;
}
// WhatsApp: ข้อความบอก phone_number_id ของเบอร์ที่รับ
function waAccountForPhone(phoneId) {
  const list = waAccounts();
  return list.find((a) => String(a.phoneId) === String(phoneId)) || (list.length === 1 && !list[0].phoneId ? list[0] : null);
}

function lineAccountById(id) { const list = lineAccounts(); return list.find((a) => a.id === id) || list[0] || null; }
function waAccountById(id) { const list = waAccounts(); return list.find((a) => a.id === id) || list[0] || null; }

const mask = (t) => (t ? `••••${String(t).slice(-4)}` : '');
function publicLine() {
  return lineAccounts().map((a) => ({ id: a.id, name: a.name || a.botName || 'LINE OA', channelId: a.channelId || '', hasSecret: Boolean(a.channelSecret), hasToken: Boolean(a.channelAccessToken), tokenHint: mask(a.channelAccessToken), botName: a.botName || '', basicId: a.basicId || '', connectedAt: a.connectedAt || null, fromEnv: Boolean(a.fromEnv) }));
}
function publicWa() {
  return waAccounts().map((a) => ({ id: a.id, name: a.name || a.verifiedName || 'WhatsApp', wabaId: a.wabaId || '', phoneId: a.phoneId || '', hasToken: Boolean(a.accessToken), tokenHint: mask(a.accessToken), verifiedName: a.verifiedName || '', displayPhone: a.displayPhone || '', connectedAt: a.connectedAt || null }));
}

module.exports = {
  lineAccounts, waAccounts, upsertLine, removeLine, upsertWa, removeWa, updateLine, updateWa,
  lineAccountForSignature, waAccountForPhone, lineAccountById, waAccountById, publicLine, publicWa,
};
