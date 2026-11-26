'use strict';
// หาว่า "เซลล์คนไหนตอบแชท" จากข้อมูลที่มี
// - Meta API ไม่บอกว่าแอดมินคนไหนกดส่ง (ข้อความฝั่งเพจมาในชื่อเพจ) จึงใช้ข้อความระบบ
//   "X assigned this conversation to Y" ของ Business Suite เพื่อรู้ว่าใครรับผิดชอบแชทช่วงนั้น
// - ข้อความที่ตอบจากเว็บนี้รู้ชื่อผู้ใช้ที่ล็อกอินอยู่แล้ว (by = username)
// - ไฟล์ import ระบุคอลัมน์เซลล์/ผู้ตอบได้

const ASSIGN_PATTERNS = [
  /^(.+?) assigned this conversation to (.+?)\.?$/i,
  /^(.+?) assigned (?:the )?conversation to (.+?)\.?$/i,
  /^(.+?) (?:ได้)?มอบหมาย(?:การสนทนา|แชท|บทสนทนา)(?:นี้)?ให้(?:กับ)?\s*(.+?)\s*(?:แล้ว)?$/,
];
const UNASSIGN_PATTERN = /unassigned this conversation|ยกเลิกการมอบหมาย/i;
const NOT_A_PERSON = /^(staff|ทีมขาย|unassigned|ยังไม่ระบุ|page|admin|-|—)$/i;
// คำที่บอกว่าเป็นชื่อเพจ/ธุรกิจ ไม่ใช่ชื่อคน (กันกรณีเพจเปลี่ยนชื่อแล้วชื่อเก่ายังค้างในแชท)
const BUSINESS_WORDS = /clinic|center|centre|hair|transplant|wellness|academy|official|group|company|co\.|ltd|คลินิก|ปลูกผม|ศูนย์|บริษัท|\bby beq\b/i;

function pageNameSet(pages, leads) {
  const set = new Set();
  for (const p of pages || []) if (p && p.name) set.add(String(p.name).trim().toLowerCase());
  for (const l of leads || []) if (l && l.pageName) set.add(String(l.pageName).trim().toLowerCase());
  return set;
}

// ชื่อนี้เป็นคนจริงไหม (ไม่ใช่ชื่อเพจ/ค่าว่าง/คำทั่วไป)
function isPerson(name, pageNames) {
  const n = String(name || '').trim();
  if (!n || n.length > 60 || NOT_A_PERSON.test(n)) return false;
  if (pageNames && pageNames.has(n.toLowerCase())) return false;
  if (BUSINESS_WORDS.test(n)) return false;
  return true;
}

function parseAssignment(text) {
  const t = String(text || '').trim();
  if (UNASSIGN_PATTERN.test(t)) return { unassign: true };
  for (const re of ASSIGN_PATTERNS) {
    const m = t.match(re);
    if (m) return { by: m[1].trim(), to: m[2].trim() };
  }
  return null;
}

// ไล่ข้อความตามเวลา: ใส่ชื่อเซลล์ให้ข้อความฝั่งเพจที่ยังไม่รู้ว่าใครตอบ และหาเซลล์ผู้ดูแลแชท
// คืน { changed, rep } และแก้ msgs ในที่ (เพิ่ม by + byAssumed=true เมื่ออนุมานจากการมอบหมาย)
function resolveConversation(msgs, pageNames) {
  let assignee = null;
  let lastPerson = null;
  const counts = new Map();
  let changed = false;
  const list = Array.isArray(msgs) ? msgs : [];
  const order = list.map((m, i) => [m, i]).sort((a, b) => (String(a[0].at) < String(b[0].at) ? -1 : String(a[0].at) > String(b[0].at) ? 1 : a[1] - b[1]));
  for (const [m] of order) {
    const asg = parseAssignment(m.text);
    if (asg) {
      if (asg.unassign) assignee = null;
      else if (isPerson(asg.to, pageNames)) assignee = asg.to;
      continue;
    }
    if (m.from !== 'staff') continue;
    // ข้อความที่ส่งจากเว็บนี้ (ไม่มี via) รู้ชื่อผู้ใช้แน่นอน → เชื่อเสมอ แม้ชื่อผู้ใช้จะเป็น "admin"
    const byLow = String(m.by || '').trim().toLowerCase();
    const sentFromWeb = m.by && !m.via && !m.byAssumed && !pageNames.has(byLow) && !BUSINESS_WORDS.test(m.by);
    if (sentFromWeb || (m.by && !m.byAssumed && isPerson(m.by, pageNames))) {
      lastPerson = m.by;
      counts.set(m.by, (counts.get(m.by) || 0) + 1);
      continue;
    }
    const guess = assignee || null;
    if (guess && (m.by !== guess || !m.byAssumed)) {
      if (!m.byPage && m.by && !isPerson(m.by, pageNames)) m.byPage = m.by; // เก็บชื่อเพจเดิมไว้
      m.by = guess;
      m.byAssumed = true;
      changed = true;
    }
    if (guess) counts.set(guess, (counts.get(guess) || 0) + 1);
  }
  let rep = assignee || lastPerson || null;
  if (!rep && counts.size) rep = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { changed, rep };
}

// อัปเดตเซลล์ของลีด: ใส่เมื่อยังไม่มี หรือค่าเดิมเป็นชื่อเพจ/ค่าว่าง (ไม่ทับชื่อที่คนตั้งเอง)
function applyLeadRep(lead, rep, pageNames) {
  if (!lead || !rep) return false;
  const cur = lead.repId || lead.rep || '';
  if (cur && isPerson(cur, pageNames)) return false;
  lead.repId = rep;
  lead.rep = rep;
  return true;
}

// ไล่ทุกแชทในระบบ (ใช้ตอนเริ่มเซิร์ฟเวอร์ และหลัง import)
function resolveAll(leads, messages, pages, onlyIds = null) {
  const pageNames = pageNameSet(pages, leads);
  let msgChanged = false;
  let leadChanged = false;
  for (const lead of leads || []) {
    if (onlyIds && !onlyIds.has(lead.id)) continue;
    const msgs = messages[lead.id];
    if (!Array.isArray(msgs) || !msgs.length) continue;
    const r = resolveConversation(msgs, pageNames);
    if (r.changed) msgChanged = true;
    if (applyLeadRep(lead, r.rep, pageNames)) leadChanged = true;
  }
  return { msgChanged, leadChanged };
}

// ดึงค่าจากแถว import ตามชื่อคอลัมน์หลายแบบ (ไม่สนตัวพิมพ์/เว้นวรรค/ขีด)
const norm = (k) => String(k).toLowerCase().replace(/[\s_\-.]/g, '');
function pick(row, keys) {
  if (!row) return '';
  const want = new Set(keys.map(norm));
  for (const [k, v] of Object.entries(row)) {
    if (want.has(norm(k)) && v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}
const REP_KEYS = ['repId', 'rep', 'sales', 'salesperson', 'sale', 'owner', 'agent', 'staff', 'admin', 'responder',
  'replied_by', 'reply_by', 'answered_by', 'assigned_to', 'assignee', 'handled_by',
  'เซลล์', 'เซลส์', 'เซล', 'ผู้ตอบ', 'ผู้ตอบแชท', 'แอดมิน', 'ผู้รับผิดชอบ', 'พนักงาน', 'พนักงานขาย'];
const REPLY_KEYS = ['reply', 'staff_reply', 'answer', 'response', 'admin_reply', 'ข้อความตอบ', 'คำตอบ', 'ตอบกลับ'];

// รวมรายชื่อเซลล์จากข้อมูลจริง: ผู้ใช้ในระบบ + เซลล์ที่ถูกตั้งให้ลีด + ชื่อคนตอบ/ผู้รับมอบหมายในแชท
function collectRepNames(leads, messages, pages, users) {
  const pn = pageNameSet(pages, leads);
  const names = new Map();
  const add = (n) => { const v = String(n || '').trim(); if (v && isPerson(v, pn) && !names.has(v.toLowerCase())) names.set(v.toLowerCase(), v); };
  for (const u of users || []) add(u.fbName || u.username);
  for (const l of leads || []) add(l.repId || l.rep);
  for (const list of Object.values(messages || {})) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (m.from === 'staff' && m.by && !m.byPage) add(m.by);
      const a = parseAssignment(m.text); if (a && a.to) add(a.to);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'th'));
}

module.exports = { collectRepNames, resolveConversation, resolveAll, applyLeadRep, isPerson, pageNameSet, parseAssignment, pick, REP_KEYS, REPLY_KEYS };
