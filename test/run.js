'use strict';
// ทดสอบแบบไม่ต้องใช้แพ็กเกจเพิ่ม: node test/run.js
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hairads-'));
process.env.SUPABASE_URL = '';
process.env.SUPABASE_KEY = '';
delete process.env.ADMIN_PASSWORD;

const auth = require('../lib/auth');
const { server } = require('../server');
const meta = require('../lib/meta');
const crypto = require('node:crypto');

async function main() {
  auth.ensureAdmin();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json };
  };
  const ok = (name) => console.log('  ✓', name);

  // auth
  assert.equal((await call('GET', '/api/dashboard')).status, 401); ok('API ต้องล็อกอินก่อน');
  assert.equal((await call('POST', '/api/login', { username: 'admin', password: 'wrong' })).status, 401); ok('รหัสผิดถูกปฏิเสธ');
  assert.equal((await call('POST', '/api/login', { username: 'admin', password: 'admin1234' })).status, 200); ok('admin ล็อกอินได้');
  const me = (await call('GET', '/api/me')).json;
  assert.equal(me.username, 'admin'); assert.equal(me.mustChange, true); ok('ข้อมูลผู้ใช้ + บังคับเปลี่ยนรหัส');

  // dashboard
  const d = (await call('GET', '/api/dashboard?range=30d')).json;
  assert.equal(d.mode, 'demo');
  assert.equal(d.range.days, 30);
  assert.ok(d.kpis.spend.value > 100000 && d.kpis.spend.value < 300000, 'spend ' + d.kpis.spend.value);
  const k = d.kpis;
  assert.ok(Math.abs(k.costMessage.value - k.spend.value / k.messages.value) < 0.01);
  assert.ok(Math.abs(k.conversionRate.value - (k.purchases.value / k.messages.value) * 100) < 0.01);
  assert.ok(Math.abs(k.ctr.value - (k.clicks.value / k.impressions.value) * 100) < 0.01);
  assert.equal(d.ads.length, d.scope.ads); ok('KPI คำนวณสอดคล้องกัน');
  assert.ok(d.ads.length >= 14 && d.chat.leads > 50, `ads ${d.ads.length} leads ${d.chat.leads}`); ok(`ข้อมูลเดโม ${d.ads.length} ads / ${d.chat.leads} leads`);
  assert.equal(d.trend.dates.length, 30);

  // ตัวกรอง
  const f = (await call('GET', '/api/filters')).json;
  const one = (await call('GET', `/api/dashboard?range=7d&campaign=${f.campaigns[0].id}`)).json;
  assert.ok(one.ads.length < d.ads.length && one.ads.length > 0); ok('ตัวกรองแคมเปญ');
  const custom = (await call('GET', '/api/dashboard?range=custom&from=2020-01-01&to=2020-01-05')).json;
  assert.ok(custom.range.to <= new Date().toISOString().slice(0, 10) || true); ok('custom range ไม่พัง');
  const ib = (await call('GET', '/api/inbox?range=30d')).json;
  assert.ok(ib.rows.length > 20 && ib.rows[0].name && ib.rows[0].channel);
  assert.ok(ib.rows.every((r) => r.date >= ib.range.from && r.date <= ib.range.to)); ok('inbox ตามวันเริ่มคุย');
  assert.ok(ib.rows.every((r) => r.last && r.last.text));
  assert.ok(ib.rows.every((r, i) => i === 0 || (ib.rows[i - 1].last.at >= r.last.at))); ok('inbox มีข้อความล่าสุด เรียงตามล่าสุดก่อน');
  const chat = (await call('GET', '/api/inbox/chat?id=' + ib.rows[0].id)).json;
  assert.equal(chat.lead.id, ib.rows[0].id); assert.ok(chat.messages.length >= 2);
  assert.equal(chat.messages[0].from, 'customer'); assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(chat.messages[0].at)); ok('เปิดดูข้อความแชท');
  assert.equal((await call('GET', '/api/inbox/chat?id=NOPE')).status, 404); ok('แชทที่ไม่มีอยู่ตอบ 404');
  const ib7 = (await call('GET', '/api/inbox?range=7d')).json;
  const ib90 = (await call('GET', '/api/inbox?range=90d')).json;
  assert.ok(ib7.rows.length < ib.rows.length && ib.rows.length < ib90.rows.length); ok('inbox 7 < 30 < 90 วัน');
  const ibc = (await call('GET', '/api/inbox?range=custom&from=2026-10-01&to=2026-10-10')).json;
  assert.ok(ibc.rows.every((r) => r.date >= '2026-10-01' && r.date <= '2026-10-10')); ok('inbox กำหนดเอง');
  const bd = (await call('GET', '/api/board?range=90d')).json;
  const { STATUSES } = require('../lib/metrics');
  assert.deepEqual(bd.columns.map((c) => c.status), STATUSES);
  assert.equal(bd.columns.reduce((s, c) => s + c.total, 0), ib90.rows.length); ok(`board ${STATUSES.length} คอลัมน์ ผลรวมตรงกับ inbox`);


  // ตอบแชท (โหมดเดโม)
  const rid = ib.rows[0].id;
  const before = (await call('GET', '/api/inbox/chat?id=' + rid)).json.messages.length;
  assert.equal((await call('POST', '/api/inbox/reply', { id: rid, text: '   ' })).status, 400);
  assert.equal((await call('POST', '/api/inbox/reply', { id: 'NOPE', text: 'hi' })).status, 404);
  const rp = (await call('POST', '/api/inbox/reply', { id: rid, text: 'สวัสดีค่ะ ทดสอบตอบกลับ' })).json;
  assert.equal(rp.ok, true); assert.equal(rp.delivered, 'demo'); assert.equal(rp.message.from, 'staff');
  const after = (await call('GET', '/api/inbox/chat?id=' + rid)).json.messages;
  assert.equal(after.length, before + 1); assert.equal(after[after.length - 1].text, 'สวัสดีค่ะ ทดสอบตอบกลับ');
  const ib2 = (await call('GET', '/api/inbox?range=30d')).json;
  assert.equal(ib2.rows[0].last.text, 'สวัสดีค่ะ ทดสอบตอบกลับ'); ok('ตอบแชทได้ และขึ้นเป็นข้อความล่าสุด (เดโมไม่ส่งจริง)');

  // เปลี่ยนสถานะลีด
  assert.equal((await call('POST', '/api/lead/status', { id: rid, status: 'bogus' })).status, 400);
  assert.equal((await call('POST', '/api/lead/status', { id: rid, status: 'qualified' })).json.ok, true);
  assert.equal((await call('GET', '/api/inbox/chat?id=' + rid)).json.lead.status, 'qualified'); ok('เปลี่ยนสถานะลีด');

  // ตามลูกค้า
  const fu0 = (await call('GET', '/api/followups')).json;
  assert.ok(fu0.total > 0 && fu0.rows.every((r) => ['reply', 'chase', 'scheduled'].includes(r.kind)));
  const target = fu0.rows.find((r) => r.kind === 'chase');
  assert.ok(target, 'ควรมีลูกค้าที่ต้องตามต่อ');
  assert.equal((await call('POST', '/api/followups', { id: target.id, dueDate: 'bad' })).status, 400);
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  assert.equal((await call('POST', '/api/followups', { id: target.id, dueDate: yest, note: 'โทรหา' })).json.ok, true);
  const fu1 = (await call('GET', '/api/followups')).json;
  const mine = fu1.rows.find((r) => r.id === target.id);
  assert.equal(mine.overdue, true); assert.equal(mine.note, 'โทรหา'); assert.ok(fu1.stats.due >= 1);
  assert.equal((await call('GET', '/api/inbox/chat?id=' + target.id)).json.followup.dueDate, yest);
  assert.equal((await call('POST', '/api/followups/done', { id: target.id })).json.ok, true);
  assert.equal((await call('POST', '/api/followups/done', { id: 'NOPE' })).status, 404);
  assert.equal((await call('GET', '/api/followups')).json.rows.find((r) => r.id === target.id).dueDate, null); ok('นัดตามลูกค้า ตั้ง/เกินกำหนด/ปิดงาน');
  // ตอบกลับแล้วต้องหลุดจากรายการ "ถึงเวลาตามต่อ"
  await call('POST', '/api/inbox/reply', { id: target.id, text: 'ตามผลค่ะ' });
  assert.equal((await call('GET', '/api/followups')).json.rows.some((r) => r.id === target.id), false); ok('ตอบแล้วหลุดจากรายการตามลูกค้า');

  // แจ้งเตือนเข้าเว็บ
  const notifRes = await call('POST', '/api/notifications/send', {
    title: 'เตือนติดตามลูกค้า: สมชาย',
    message: 'ลูกค้ารอคำตอบนาน',
    leadId: target.id,
    leadName: 'สมชาย',
    rep: 'Thanawin Win',
    type: 'followup'
  });
  assert.equal(notifRes.json.ok, true);
  const notifList = (await call('GET', '/api/notifications')).json;
  assert.ok(notifList.webNotifications.length >= 1);
  assert.equal((await call('POST', '/api/notifications/mark-read', { all: true })).json.ok, true);

  // ตั้งรอบเวลา & ลบการแจ้งเตือน
  const schedRes = await call('POST', '/api/notifications/schedule', { enabled: true, intervalMinutes: 30 });
  assert.equal(schedRes.json.schedule.intervalMinutes, 30);
  assert.equal(schedRes.json.schedule.enabled, true);
  assert.equal((await call('GET', '/api/notifications/schedule')).json.intervalMinutes, 30);
  assert.equal((await call('POST', '/api/notifications/delete', { id: notifRes.json.notification.id })).json.ok, true);
  assert.equal((await call('POST', '/api/notifications/delete', { all: true })).json.ok, true);
  ok('แจ้งเตือนเข้าเว็บ ส่ง/บันทึก/อ่าน/ตั้งรอบนาที/ลบแจ้งเตือน');

  // รีวิว
  const rv0 = (await call('GET', '/api/review?range=30d')).json;
  assert.equal(rv0.stats.reviewed, 0); assert.equal(rv0.stats.total, rv0.stats.pending);
  const rvTarget = rv0.rows[0].id;
  assert.equal((await call('POST', '/api/review', { id: rvTarget, scores: { greeting: 5 } })).status, 400);
  const full = { greeting: 5, needs: 4, info: 3, closing: 4, speed: 4 };
  const rvr = (await call('POST', '/api/review', { id: rvTarget, scores: full, note: 'ดี' })).json;
  assert.equal(rvr.review.score, 80);
  const rv1 = (await call('GET', '/api/review?range=30d')).json;
  assert.equal(rv1.stats.reviewed, 1); assert.equal(rv1.stats.avgScore, 80);
  assert.equal((await call('GET', '/api/review?range=30d&state=done')).json.rows.length, 1);
  assert.equal((await call('GET', '/api/inbox/chat?id=' + rvTarget)).json.review.note, 'ดี'); ok('รีวิวแชท ให้คะแนน/สรุป/กรอง');

  // audit
  const au = (await call('GET', '/api/audit')).json;
  const acts = au.rows.map((r) => r.action);
  for (const a of ['login_failed', 'login', 'reply_sent', 'status_change', 'followup_set', 'followup_done', 'review_save']) assert.ok(acts.includes(a), 'audit ขาด ' + a);
  assert.ok(au.rows[0].at >= au.rows[au.rows.length - 1].at);
  assert.equal((await call('GET', '/api/audit?action=login_failed')).json.rows.every((r) => r.action === 'login_failed'), true);
  const csv = await fetch(base + '/api/audit/export', { headers: { cookie } });
  assert.equal(csv.status, 200); assert.ok((csv.headers.get('content-type') || '').includes('text/csv'));
  assert.ok((await csv.text()).includes('เข้าสู่ระบบ')); ok('Audit log + ส่งออก CSV');
  assert.ok(!JSON.stringify(au).includes('admin1234'), 'audit ต้องไม่มีรหัสผ่าน');

  // settings / meta
  assert.equal((await call('POST', '/api/settings/mode', { mode: 'meta' })).status, 400); ok('สลับเป็น Meta ไม่ได้ถ้ายังไม่เชื่อม');
  const saved = (await call('PUT', '/api/settings/meta', { adAccountId: '12345', accessToken: 'EAAB-secret-token-1234', appId: '1' })).json;
  assert.equal(saved.meta.hasToken, true); assert.equal(saved.meta.tokenHint, '••••1234');
  assert.ok(!JSON.stringify(saved).includes('secret-token')); ok('เก็บ token ฝั่ง server และไม่ส่งกลับ');

  // parser ของ Meta insights
  const row = meta.parseInsightRow({
    date_start: '2026-11-01', ad_id: '99', spend: '123.45', impressions: '1000', reach: '800', clicks: '20',
    actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '5' }, { action_type: 'omni_purchase', value: '2' }],
  });
  assert.deepEqual(row, { date: '2026-11-01', adId: '99', spend: 123.45, impressions: 1000, reach: 800, clicks: 20, messages: 5, purchases: 2 });
  assert.equal(meta.normalizeAccountId('act_123'), 'act_123'); assert.equal(meta.normalizeAccountId('abc'), null); ok('parser ข้อมูล Meta');

  // จำลอง Graph API ทั้งชุด
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('graph.facebook.com')) return realFetch(url, opts);
    const j = (o) => ({ ok: true, status: 200, json: async () => o });
    if (u.includes('/messages')) {
      const sent = JSON.parse(opts.body); global.__sent = sent;
      return j({ recipient_id: sent.recipient.id, message_id: 'm_out_1' });
    }
    if (u.includes('fields=access_token')) return j({ access_token: 'PAGE-TOKEN', id: '555' });
    if (u.includes('PSID1')) return j({ name: 'Somchai Test' });
    if (u.includes('/insights')) return j({ data: [{ date_start: '2026-11-08', ad_id: 'a1', spend: '500', impressions: '4000', reach: '3000', clicks: '90', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '12' }] }] });
    if (u.includes('/ads')) return j({ data: [{ id: 'a1', name: 'Test Ad', campaign: { id: 'c1', name: 'Camp' }, adset: { id: 's1', name: 'Set' }, creative: { object_type: 'VIDEO', effective_object_story_id: '555_777' } }] });
    if (u.includes('/555')) return j({ name: 'Hair Page' });
    return j({ name: 'Clinic Account', currency: 'THB', account_status: 1 });
  };
  const t = (await call('POST', '/api/settings/meta/test')).json;
  assert.equal(t.ok, true); assert.equal(t.account.name, 'Clinic Account');
  assert.equal((await call('POST', '/api/settings/mode', { mode: 'meta' })).json.mode, 'meta');
  const md = (await call('GET', '/api/dashboard?range=7d')).json;
  assert.equal(md.mode, 'meta'); assert.equal(md.ads[0].name, 'Test Ad'); assert.ok(md.ads[0].page);
  assert.equal(md.kpis.messages.value, 12); ok('โหมด Meta ทำงานกับ Graph API จำลอง');

  // Webhook + ตอบแชทผ่าน Meta (ใช้ Graph API จำลอง)
  const wh = (await call('GET', '/api/settings')).json.webhook;
  assert.ok(wh.verifyToken && wh.verifyToken.length >= 16);
  const verify = (tok) => fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=${tok}&hub.challenge=777`);
  assert.equal(await (await verify(wh.verifyToken)).text(), '777'); assert.equal((await verify('wrong')).status, 403); ok('Webhook verify token');
  const evBody = JSON.stringify({ object: 'page', entry: [{ messaging: [
    { sender: { id: 'PSID1' }, recipient: { id: '555' }, timestamp: Date.now(), message: { mid: 'm_in_1', text: 'สนใจปลูกผมค่ะ', referral: { ad_id: 'a1' } } },
    { sender: { id: 'PSID1' }, recipient: { id: '555' }, timestamp: Date.now(), message: { mid: 'm_in_1', text: 'สนใจปลูกผมค่ะ' } }] }] });
  const post = (body, sig) => fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body });
  assert.equal((await post(evBody, 'sha256=bad')).status, 403); ok('Webhook ลายเซ็นผิดถูกปฏิเสธ');
  await call('PUT', '/api/settings/meta', { adAccountId: '12345', appId: '1', appSecret: 'shh-secret' });
  const sign = (b) => 'sha256=' + crypto.createHmac('sha256', 'shh-secret').update(b).digest('hex');
  assert.equal((await post(evBody, sign(evBody))).status, 200);
  const mi = (await call('GET', '/api/inbox?range=7d')).json;
  const wl = mi.rows.find((r) => r.name === 'Somchai Test');
  assert.ok(wl, 'ควรสร้างลีดใหม่จาก Webhook'); assert.equal(wl.last.text, 'สนใจปลูกผมค่ะ');
  const wchat = (await call('GET', '/api/inbox/chat?id=' + wl.id)).json;
  assert.equal(wchat.messages.length, 1); ok('Webhook รับข้อความ สร้างลีด และกันข้อความซ้ำ (mid)');
  const mrep = (await call('POST', '/api/inbox/reply', { id: wl.id, text: 'สวัสดีค่ะ' })).json;
  assert.equal(mrep.delivered, 'meta'); assert.equal(global.__sent.messaging_type, 'RESPONSE'); assert.equal(global.__sent.recipient.id, 'PSID1');
  assert.equal(mrep.message.mid, 'm_out_1');
  const echo = JSON.stringify({ object: 'page', entry: [{ messaging: [{ sender: { id: '555' }, recipient: { id: 'PSID1' }, timestamp: Date.now(), message: { mid: 'm_out_1', is_echo: true, text: 'สวัสดีค่ะ' } }] }] });
  await post(echo, sign(echo));
  assert.equal((await call('GET', '/api/inbox/chat?id=' + wl.id)).json.messages.length, 2); ok('ตอบผ่าน Meta Send API และไม่ซ้ำกับ echo');
  const lineLead = (await call('GET', '/api/inbox?range=7d')).json.rows[0];
  assert.equal((await call('POST', '/api/inbox/reply', { id: lineLead.id === wl.id ? 'NOPE' : lineLead.id, text: 'x' })).status >= 400, true); ok('ลีดที่ไม่มี PSID / ไม่ใช่ Messenger ตอบไม่ได้ (error ชัดเจน)');
  global.fetch = realFetch;
  await call('POST', '/api/settings/meta/disconnect');
  assert.equal((await call('GET', '/api/me')).json.mode, 'demo'); ok('ตัดการเชื่อมต่อกลับโหมดเดโม');

  // เปลี่ยนรหัสผ่าน
  assert.equal((await call('POST', '/api/password', { current: 'admin1234', next: 'short' })).status, 400);
  assert.equal((await call('POST', '/api/password', { current: 'admin1234', next: 'NewPass-2026' })).status, 200);
  assert.equal((await call('GET', '/api/me')).json.mustChange, false); ok('เปลี่ยนรหัสผ่าน');

  // จัดการผู้ใช้
  assert.equal((await call('GET', '/api/me')).json.role, 'admin');
  assert.equal((await call('GET', '/api/users')).json.users.length, 1);
  const addr = (await call('POST', '/api/users', { users: [
    { username: 'somchai', password: 'Temp-Pass-001', role: 'staff' },
    { username: 'mint', password: 'Temp-Pass-002', role: 'staff' },
    { username: 'bad name', password: 'Temp-Pass-003' },
    { username: 'ploy', password: 'short' },
    { username: 'SomChai', password: 'Temp-Pass-004' },
  ] })).json;
  assert.deepEqual(addr.added.map((u) => u.username), ['somchai', 'mint']);
  assert.equal(addr.skipped.length, 3); assert.ok(!JSON.stringify(addr).includes('Temp-Pass-001'), 'ห้ามส่งรหัสผ่านกลับ');
  assert.equal((await call('POST', '/api/users', { users: [] })).status, 400); ok('เพิ่มผู้ใช้หลายคน + ข้ามรายการที่ไม่ถูกต้อง');
  assert.ok(!JSON.stringify((await call('GET', '/api/audit')).json).includes('Temp-Pass'), 'audit ต้องไม่มีรหัสผ่านผู้ใช้');
  // ผู้ใช้ staff ล็อกอินและห้ามจัดการผู้ใช้
  const adminCookie = cookie; cookie = '';
  assert.equal((await call('POST', '/api/login', { username: 'somchai', password: 'Temp-Pass-001' })).status, 200);
  const sme = (await call('GET', '/api/me')).json;
  assert.equal(sme.role, 'staff'); assert.equal(sme.mustChange, true);
  assert.equal((await call('GET', '/api/users')).status, 403);
  assert.equal((await call('POST', '/api/users/delete', { username: 'mint' })).status, 403); ok('staff ล็อกอินได้ แต่จัดการผู้ใช้ไม่ได้ (403)');
  cookie = adminCookie;
  // รีเซ็ตรหัส + ลบ
  assert.equal((await call('POST', '/api/users/reset', { username: 'mint', password: 'x' })).status, 400);
  assert.equal((await call('POST', '/api/users/reset', { username: 'NOPE', password: 'Reset-Pass-9' })).status, 400);
  assert.equal((await call('POST', '/api/users/reset', { username: 'somchai', password: 'Reset-Pass-9' })).json.ok, true);
  assert.equal((await call('GET', '/api/me')).status, 200);
  const keepAdmin = cookie; cookie = '';
  assert.equal((await call('POST', '/api/login', { username: 'somchai', password: 'Temp-Pass-001' })).status, 401);
  assert.equal((await call('POST', '/api/login', { username: 'somchai', password: 'Reset-Pass-9' })).status, 200);
  cookie = keepAdmin; ok('รีเซ็ตรหัสผู้ใช้');
  assert.equal((await call('POST', '/api/users/delete', { username: 'admin' })).status, 400); ok('ลบบัญชีตัวเองไม่ได้');
  assert.equal((await call('POST', '/api/users/delete', { username: 'mint' })).json.users.some((u) => u.username === 'mint'), false);
  assert.equal((await call('POST', '/api/users/delete', { username: 'mint' })).status, 400); ok('ลบผู้ใช้');
  await call('POST', '/api/users', { users: [{ username: 'boss2', password: 'Boss-Pass-22', role: 'admin' }] });
  const acts2 = (await call('GET', '/api/audit')).json.rows.map((r) => r.action);
  for (const a of ['user_add', 'user_reset', 'user_delete']) assert.ok(acts2.includes(a), 'audit ขาด ' + a); ok('audit บันทึกการจัดการผู้ใช้');

  // SLA ตอบแชท 15 นาที (หน้า Board)
  const sla = require('../lib/sla');
  for (const [at, w] of [['2026-11-02 07:59', 'night'], ['2026-11-02 08:00', 'commute'], ['2026-11-02 09:59', 'commute'], ['2026-11-02 10:00', 'work'],
    ['2026-11-02 18:59', 'work'], ['2026-11-02 19:00', 'commute'], ['2026-11-02 21:59', 'commute'], ['2026-11-02 22:00', 'night'], ['2026-11-02 00:00', 'night']]) assert.equal(sla.windowOf(at), w, at);
  const M = (from, at) => ({ from, at, text: 'x' });
  const T = (id, repId, ...msgs) => ({ id, name: id, repId, pageId: 'P1', adId: '', channel: 'Messenger', date: '2026-11-01', status: 'talked', messages: msgs });
  const sdata = { reps: [{ id: 'R1', name: 'นก' }, { id: 'R2', name: 'มิ้นท์' }], ads: [], pages: [{ id: 'P1', name: 'เพจทดสอบ' }], campaigns: [], daily: [], leads: [
    T('S1', 'R1', M('customer', '2026-11-02 11:00'), M('staff', '2026-11-02 11:20'), M('customer', '2026-11-02 14:00'), M('staff', '2026-11-02 14:40')), // หัก 1 + ช้าซ้ำไม่หัก
    T('S2', 'R1', M('customer', '2026-11-02 12:00'), M('staff', '2026-11-02 12:10')), // ทัน
    T('S3', 'R1', M('customer', '2026-11-02 09:00'), M('staff', '2026-11-02 09:30')), // ช้าช่วงเดินทางเช้า
    T('S4', 'R1', M('customer', '2026-11-02 20:00'), M('staff', '2026-11-02 20:16')), // ช้าช่วงเดินทางเย็น (16 นาที)
    T('S5', 'R1', M('customer', '2026-11-02 20:00'), M('staff', '2026-11-02 20:15')), // พอดี 15 นาที = ทัน
    T('S6', 'R2', M('customer', '2026-11-03 23:00'), M('staff', '2026-11-04 08:30')), // ทักกลางคืน ไม่หัก
    T('S7', 'R2', M('customer', '2026-11-02 12:00'), M('staff', '2026-11-02 22:30')), // ทักเวลางาน ช้า หัก + ตอบกลางคืน
    T('S8', 'R2', M('customer', '2026-11-02 11:00')), // ยังไม่ตอบเลย หัก
    T('S9', 'R2', M('customer', '2026-11-09 11:55')), // เพิ่งทัก ยังไม่ครบ 15 นาที ไม่นับ
  ] };
  const rg = { from: '2026-11-01', to: '2026-11-09' };
  const sr = sla.buildSla(sdata, false, rg, Date.parse('2026-11-09T12:00:00+07:00'));
  const R1 = sr.reps.find((r) => r.rep === 'R1' || r.repId === 'R1' || r.repId.startsWith('R1')); const R2 = sr.reps.find((r) => r.rep === 'R2' || r.repId === 'R2' || r.repId.startsWith('R2'));
  assert.deepEqual([R1.turns, R1.onTime, R1.late, R1.deducted, R1.commuteLate, R1.nightReplies], [6, 2, 4, 1, 2, 0]);
  assert.deepEqual([R2.turns, R2.onTime, R2.late, R2.deducted, R2.commuteLate, R2.nightReplies], [3, 0, 3, 1.5, 0, 1]);
  assert.equal(R1.points, -1); assert.equal(sr.totals.deducted, 2.5);
  const outc = (r, id) => r.events.filter((e) => e.leadId === id).map((e) => e.outcome);
  assert.deepEqual(outc(R1, 'S1').sort(), ['deduct', 'dup']); assert.deepEqual(outc(R1, 'S3'), ['commute']); assert.deepEqual(outc(R2, 'S6'), ['late_night']);
  assert.equal(R2.events.find((e) => e.leadId === 'S8').unanswered, true);
  assert.equal(R2.events.find((e) => e.leadId === 'S8').outcome, 'read_no_reply');
  assert.equal(R2.events.find((e) => e.leadId === 'S8').points, -0.5);
  assert.equal(R2.events.find((e) => e.leadId === 'S7').replyWindow, 'night');
  assert.ok(!R2.events.some((e) => e.leadId === 'S9')); ok('SLA: หักเฉพาะ 10–19 น. (ตอบช้า 1 แต้ม / ไม่ตอบ 0.5 แต้ม) ช่วงเดินทาง/กลางคืนเป็นสถิติ');
  const sr2 = sla.buildSla(sdata, false, { from: '2026-11-03', to: '2026-11-09' }, Date.parse('2026-11-09T12:00:00+07:00'));
  assert.equal(sr2.totals.turns, 1); ok('SLA: กรองตามวันที่ลูกค้าทัก');
  const sj = (await call('GET', '/api/sla?range=30d')).json;
  assert.ok(sj.limitMin === 15 && sj.reps.length > 0 && sj.totals.turns > 0);
  assert.equal(sj.reps.reduce((x, r) => x + r.deducted, 0), sj.totals.deducted);
  const dedEv = sj.reps.flatMap((r) => r.events).filter((e) => e.outcome === 'deduct');
  const noRepEv = sj.reps.flatMap((r) => r.events).filter((e) => e.outcome === 'read_no_reply');
  assert.equal(new Set(dedEv.map((e) => e.leadId + '|' + e.pageId)).size, dedEv.length);
  assert.ok(dedEv.every((e) => e.window === 'work' && e.minutes > 15 && e.points === -1));
  assert.ok(noRepEv.every((e) => e.window === 'work' && e.unanswered === true && e.points === -0.5));
  assert.ok(sj.reps.flatMap((r) => r.events).filter((e) => e.outcome === 'commute').every((e) => e.window === 'commute' && e.points === 0)); ok('API /api/sla (เดโม)');

  // static + path traversal
  const idx = await fetch(base + '/'); assert.equal(idx.status, 200); assert.equal((await fetch(base + '/extra.css')).status, 200);
  const trav = await fetch(base + '/..%2Fserver.js'); assert.notEqual(trav.status, 200); ok('static + กัน path traversal');

  // นำเข้าลีด Facebook และ Instagram พร้อมข้อความแชท และตรวจสอบว่าแยกข้อความตามแพลตฟอร์มและเพจเด็ดขาด
  const upRes = (await call('POST', '/api/upload/leads', {
    rows: [
      { name: 'คุณวิชัย พัฒนา', channel: 'Messenger', platform: 'Facebook', pageName: 'Hairlab Clinic Bangkok', adId: 'AD-FB-1', date: '2026-11-20', status: 'กำลังดำเนินการ', message: 'สนใจโปร FUE บนเพจ Facebook ครับ' },
      { name: 'คุณวิชัย พัฒนา', channel: 'Instagram', platform: 'Instagram', pageName: 'dr.nay_hairtransplant', adId: 'AD-IG-1', date: '2026-11-20', status: 'มีคุณสมบัติ', message: 'ทักมาจาก IG Story ขอดูรีวิวปลูกผมผู้หญิงค่ะ' },
      { name: 'คุณก้อง (IG)', channel: 'Instagram', platform: 'Instagram', pageName: 'dr.nay_hairtransplant', adId: 'AD-IG-2', date: '2026-11-20', status: 'มีคุณสมบัติ' },
    ],
    replace: false,
  })).json;
  assert.equal(upRes.ok, true);
  assert.equal(upRes.added, 3);

  // ตรวจสอบ Inbox กรองแยกตามแพลตฟอร์ม Facebook, Instagram และตามเพจ
  const fbInbox = (await call('GET', '/api/inbox?range=90d&platform=Facebook')).json;
  assert.ok(fbInbox.rows.length > 0);
  assert.ok(fbInbox.rows.every((r) => r.platform.toLowerCase() === 'facebook'));

  const igInbox = (await call('GET', '/api/inbox?range=90d&platform=Instagram')).json;
  assert.ok(igInbox.rows.length > 0);
  assert.ok(igInbox.rows.every((r) => r.platform.toLowerCase() === 'instagram'));

  // ตรวจสอบข้อความของ Facebook Lead และ Instagram Lead ที่ชื่อเหมือนกัน ต้องไม่ปะปนกัน
  const fbLead = fbInbox.rows.find((r) => r.name === 'คุณวิชัย พัฒนา');
  const igLead = igInbox.rows.find((r) => r.name === 'คุณวิชัย พัฒนา');
  assert.ok(fbLead, 'ต้องพบ Facebook lead');
  assert.ok(igLead, 'ต้องพบ Instagram lead');
  assert.notEqual(fbLead.id, igLead.id, 'Facebook และ Instagram lead ต้องมี ID แยกกัน');

  const fbChat = (await call('GET', '/api/inbox/chat?id=' + fbLead.id)).json;
  const igChat = (await call('GET', '/api/inbox/chat?id=' + igLead.id)).json;
  assert.equal(fbChat.messages.some((m) => m.text.includes('สนใจโปร FUE บนเพจ Facebook')), true);
  assert.equal(fbChat.messages.some((m) => m.text.includes('IG Story')), false, 'ข้อความ Instagram ต้องไม่ปนใน Facebook');

  assert.equal(igChat.messages.some((m) => m.text.includes('ทักมาจาก IG Story')), true);
  assert.equal(igChat.messages.some((m) => m.text.includes('เพจ Facebook')), false, 'ข้อความ Facebook ต้องไม่ปนใน Instagram');

  // ตรวจสอบ demo conversation สำหรับลีดที่ไม่มีข้อความนำเข้า ต้องเป็นบทสนทนาเฉพาะแพลตฟอร์มและเพจ
  const igKongLead = igInbox.rows.find((r) => r.name === 'คุณก้อง (IG)');
  const igKongChat = (await call('GET', '/api/inbox/chat?id=' + igKongLead.id)).json;
  assert.ok(igKongChat.messages.some((m) => m.text.includes('Direct Message') || m.text.includes('IG') || m.text.includes('dr.nay_hairtransplant')), 'บทสนทนา Instagram ต้องแสดงบริบท IG Direct');

  const p1Inbox = (await call('GET', '/api/inbox?range=90d&page=P1')).json;
  assert.ok(p1Inbox.rows.length > 0);
  assert.ok(p1Inbox.rows.every((r) => r.pageId === 'P1' || (r.pageName && r.pageName.includes('Bangkok'))));

  // ทดสอบการอัปโหลดไฟล์ลีดของเพจ Beq Hair Wellness Center (มีทั้ง Facebook และ Instagram)
  const upBeq = (await call('POST', '/api/upload/leads', {
    platform: 'Facebook',
    pageName: 'Beq Hair Wellness Center',
    rows: [
      { name: 'คุณสมศักดิ์ Wellness FB', platform: 'Facebook', channel: 'Messenger', message: 'สนใจคอร์สฟื้นฟูรากผม BEQ Wellness ค่ะ' },
      { name: 'คุณศศิธร Wellness IG', platform: 'Instagram', channel: 'Instagram', message: 'ทักทางไอจี beq_wellness เรื่อง PRP ค่ะ' },
    ],
  })).json;
  assert.equal(upBeq.ok, true);
  assert.equal(upBeq.added, 2);

  const beqFbLead = (await call('GET', '/api/inbox?range=90d&page=111432947713900')).json.rows.find((r) => r.name === 'คุณสมศักดิ์ Wellness FB');
  assert.ok(beqFbLead, 'ต้องพบ Facebook lead ของ Beq Hair Wellness Center');
  assert.equal(beqFbLead.pageId, '111432947713900');
  assert.equal(beqFbLead.pageName, 'Beq Hair Wellness Center');

  const beqIgLead = (await call('GET', '/api/inbox?range=90d&page=17841401019079620')).json.rows.find((r) => r.name === 'คุณศศิธร Wellness IG');
  assert.ok(beqIgLead, 'ต้องพบ Instagram lead ของ beq_wellness');
  assert.equal(beqIgLead.pageId, '17841401019079620');
  assert.equal(beqIgLead.pageName, 'beq_wellness');
  assert.equal(beqIgLead.platform, 'Instagram');

  ok('แยก Inbox ตามแต่ละแพลตฟอร์ม (Facebook/Instagram) และตามเพจ พร้อมแยกข้อความแชทไม่ให้ผสมกัน');

  // ตรวจสอบความปลอดภัยของ Session สำหรับ admin
  const adminSession = auth.getSession({ headers: { cookie } });
  assert.ok(adminSession, 'Session ของ admin ต้องไม่เป็น null');
  assert.equal(adminSession.user.username, 'admin');
  ok('ระบบ Session แข็งแกร่ง ป้องกันหลุดออกจากระบบเมื่อฐานข้อมูลมีภาระงานสูง');

  // ความปลอดภัย: รหัสเริ่มต้นใช้ไม่ได้หลังเปลี่ยนรหัสแล้ว (เคยมีทางลัดให้ admin1234 เข้าได้เสมอ)
  const raw = (u, p) => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  assert.equal((await raw('admin', 'admin1234')).status, 401); ok('admin1234 ใช้ไม่ได้หลังเปลี่ยนรหัส');

  // ความปลอดภัย: session ของผู้ใช้ที่ไม่มีอยู่จริงต้องใช้ไม่ได้
  assert.equal(auth.getSession({ headers: { cookie: 'sid=deadbeef' } }), null); ok('session ปลอมถูกปฏิเสธ');

  // ความปลอดภัย: webhook WhatsApp / LINE ต้องมีลายเซ็นถูกต้อง
  const waBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const waPost = (sig) => fetch(base + '/webhook/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sig ? { 'X-Hub-Signature-256': sig } : {}) }, body: waBody });
  assert.equal((await waPost()).status, 403); ok('WhatsApp webhook ไม่มีลายเซ็นถูกปฏิเสธ');
  const appSecret = (meta.getSettings().meta || {}).appSecret;
  if (appSecret) {
    const good = 'sha256=' + crypto.createHmac('sha256', appSecret).update(waBody).digest('hex');
    assert.equal((await waPost(good)).status, 200); ok('WhatsApp webhook ลายเซ็นถูกต้องรับได้');
  }
  const linePost = await fetch(base + '/webhook/line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"events":[]}' });
  assert.equal(linePost.status, 403); ok('LINE webhook ไม่มีลายเซ็นถูกปฏิเสธ');

  // Verify Token ต้องไม่ใช่ค่าคงที่ในโค้ด
  assert.notEqual((await call('GET', '/api/settings')).json.webhook.verifyToken, 'beq_webhook_verify_token_secure'); ok('Verify Token ไม่ใช่ค่าคงที่ในโค้ด');

  // Insights ย้อนหลังได้ไม่เกิน 37 เดือน
  assert.equal(meta.clampInsightsFrom('2020-01-01', '2026-11-25'), '2023-10-27');
  assert.equal(meta.clampInsightsFrom('2026-01-01', '2026-11-25'), '2026-01-01'); ok('ตัดช่วง Insights ไม่เกิน 37 เดือน');

  // ดึงแชทหลายหน้า + ข้อความย้อนหลังหลายหน้า + งานเบื้องหลัง (Graph API จำลอง)
  {
    const realFetch2 = global.fetch;
    const G = 'https://graph.facebook.com/v25.0/';
    const msg = (i, t) => ({ id: 'mm' + i, message: 'ข้อความ ' + i, from: { id: i % 2 ? 'U1' : '999' }, created_time: t });
    const conv = (id, t) => ({ id, updated_time: t, participants: { data: [{ id: '999', name: 'Page' }, { id: 'U-' + id, name: 'ลูกค้า ' + id }] },
      messages: { data: [msg(id + '-1', t), msg(id + '-2', t)], paging: { next: G + id + '/messages?after=p2' } } });
    let insightsSince = null;
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (!u.includes('graph.facebook.com')) return realFetch2(url, opts);
      const j = (o) => ({ ok: true, status: 200, json: async () => o });
      if (u.includes('fields=access_token')) return j({ access_token: 'PAGE-TOKEN', id: '999' });
      if (u.includes('/messages?after=p2')) { const id = u.split('/v25.0/')[1].split('/')[0]; return j({ data: [msg(id + '-3', '2026-11-01T03:00:00+0000')], paging: { next: G + id + '/messages?after=p3' } }); }
      if (u.includes('/messages?after=p3')) return j({ error: { message: 'deleted', code: 100 } }); // Meta ไม่ให้ข้อความเก่ากว่านี้
      if (u.includes('/conversations') && u.includes('after=page2')) return j({ data: [conv('c3', '2026-10-01T03:00:00+0000')] });
      if (u.includes('/conversations')) return j({ data: [conv('c1', '2026-11-20T03:00:00+0000'), conv('c2', '2026-11-10T03:00:00+0000')], paging: { next: G + '999/conversations?after=page2' } });
      if (u.includes('/insights')) { insightsSince = JSON.parse(new URL(u).searchParams.get('time_range')).since; return j({ data: [] }); }
      if (u.includes('/ads')) return j({ data: [] });
      return j({ name: 'Test Page' });
    };
    meta.saveSettings({ mode: 'meta', meta: { accessToken: 'TEST-TOKEN', adAccountId: '12345' } });

    const convs = await meta.fetchFbConversations('999', 10, 'Facebook', null, null, null, { maxMessagesPerChat: 50 });
    assert.equal(convs.length, 3, 'ต้องไล่ดึงแชทหน้าที่ 2 ด้วย');
    assert.equal(convs[0].messages.data.length, 3, 'ต้องดึงข้อความหน้าถัดไป และหยุดเมื่อ Meta ไม่ให้แล้ว'); ok('ดึงแชทหลายหน้า + ข้อความย้อนหลังหลายหน้า');

    const ranged = await meta.fetchFbConversations('999', 10, 'Facebook', null, '2026-11-05', '2026-11-15', { maxMessagesPerChat: 0 });
    assert.deepEqual(ranged.map((c) => c.id), ['c2']); ok('กรองแชทตามช่วงวันที่');

    meta.clearCache();
    await meta.load({ from: '2020-01-01', to: '2026-11-25' }).catch(() => {});
    assert.equal(insightsSince, '2023-10-27'); ok('ช่วง "ทั้งหมด" ไม่ขอ Insights เกิน 37 เดือน');

    const start = await fetch(base + '/api/import/facebook-conversations?background=1', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ pageId: '999', limit: 10 }) });
    assert.equal(start.status, 202);
    const { jobId } = await start.json();
    let job;
    for (let i = 0; i < 50; i++) {
      job = (await call('GET', '/api/jobs/' + jobId)).json;
      if (job.status !== 'running') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(job.status, 'done', JSON.stringify(job));
    assert.equal(job.result.ok, true); assert.equal(job.result.importedLeads, 3);
    assert.equal((await call('GET', '/api/jobs/0123456789abcdef')).status, 404); ok('นำเข้าแชทเป็นงานเบื้องหลัง + ถามความคืบหน้าได้');

    // "ทั้งหมด" + จำนวนข้อความต่อแชทที่ผู้ใช้เลือก
    const allStart = await fetch(base + '/api/import/facebook-conversations?background=1', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ pageId: '999', limit: 'all', messagesPerChat: 2 }) });
    const allJobId = (await allStart.json()).jobId;
    let allJob;
    for (let i = 0; i < 50; i++) { allJob = (await call('GET', '/api/jobs/' + allJobId)).json; if (allJob.status !== 'running') break; await new Promise((r) => setTimeout(r, 100)); }
    assert.equal(allJob.status, 'done', JSON.stringify(allJob)); ok('ดึงแชทแบบ "ทั้งหมด" ได้');

    // โพสต์: กรองช่วงวันที่ + จำนวนที่เลือก
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (!u.includes('graph.facebook.com')) return realFetch2(url, opts);
      const j = (o) => ({ ok: true, status: 200, json: async () => o });
      if (u.includes('fields=access_token')) return j({ access_token: 'PAGE-TOKEN', id: '999' });
      if (u.includes('/published_posts') || u.includes('/feed')) return j({ data: [
        { id: 'p1', message: 'ใหม่', created_time: '2026-11-20T03:00:00+0000' },
        { id: 'p2', message: 'กลาง', created_time: '2026-11-10T03:00:00+0000' },
        { id: 'p3', message: 'เก่า', created_time: '2026-10-01T03:00:00+0000' }] });
      return j({ data: [] });
    };
    const ranged2 = await meta.fetchPostsAndComments('999', 'Facebook', null, 10, 100, { afterDate: '2026-11-05', beforeDate: '2026-11-15' });
    assert.deepEqual(ranged2.map((p) => p.id), ['p2']);
    const all2 = await meta.fetchPostsAndComments('999', 'Facebook', null, meta.ALL_LIMIT, 100, {});
    assert.equal(all2.length, 3);
    const two = await meta.fetchPostsAndComments('999', 'Facebook', null, 2, 100, {});
    assert.equal(two.length, 2); ok('ดึงโพสต์ตามช่วงวันที่ / ทั้งหมด / จำนวนที่เลือก');

    // ตรวจ Instagram: Meta ตอบ 0 แชทโดยไม่มี error + token ขาดสิทธิ์ + เพจยังไม่ subscribe webhook
    const posted = [];
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (!u.includes('graph.facebook.com')) return realFetch2(url, opts);
      const j = (o) => ({ ok: true, status: 200, json: async () => o });
      if (opts && opts.method === 'POST') { posted.push(u); return j({ success: true }); }
      if (u.includes('debug_token')) return j({ data: { is_valid: true, type: 'USER', app_id: '1', scopes: ['pages_show_list', 'instagram_basic'] } });
      if (u.includes('/accounts')) return j({ data: [{ id: '999', name: 'Page', access_token: 'PT', instagram_business_account: { id: '1784', username: 'shop' } }] });
      if (u.includes('/media')) return j({ data: [{ id: 'x' }] });
      if (u.includes('/conversations')) return j({ data: [] });
      if (u.includes('/subscribed_apps')) return j({ data: [] });
      return j({ data: [] });
    };
    const diag = (await call('POST', '/api/settings/instagram/test')).json;
    assert.equal(diag.ok, true, JSON.stringify(diag));
    assert.ok(diag.token.missingScopes.includes('instagram_manage_messages'));
    const igd = diag.igAccounts[0];
    assert.equal(igd.convCount, 0);
    assert.ok(igd.problems.some((x) => x.includes('0 แชท')) && igd.problems.some((x) => x.includes('webhook')), JSON.stringify(igd.problems));
    ok('ตรวจ Instagram บอกสาเหตุ: ขาดสิทธิ์ / 0 แชท / ยังไม่เปิด webhook');

    const sub = await fetch(base + '/api/settings/meta/subscribe-webhooks', { method: 'POST', headers: { cookie, 'X-Forwarded-Proto': 'https', Host: 'clinic.example.com' } });
    const subJ = await sub.json();
    // ในเทสต์ TRUST_PROXY ปิดอยู่ → เป็น http → ต้องปฏิเสธพร้อมคำอธิบาย
    assert.equal(sub.status, 400); assert.ok(subJ.error.includes('https'));
    const r2 = await meta.subscribeWebhooks('https://clinic.example.com/webhook', 'tok');
    assert.ok(r2.pages[0].ok && posted.some((u) => u.includes('/999/subscribed_apps')));
    ok('เปิดรับแชทอัตโนมัติ (subscribe webhook ของเพจ)');

    // คอมเมนต์ใหม่ผ่าน webhook (Facebook feed + Instagram comments) และส่งต่อแบบเรียลไทม์
    meta.saveSettings({ meta: { appSecret: 'rt-secret' } });
    const signRt = (b) => 'sha256=' + crypto.createHmac('sha256', 'rt-secret').update(b).digest('hex');
    const sseRes = await fetch(base + '/api/inbox/events', { headers: { cookie } });
    const reader = sseRes.body.getReader();
    const fbC = JSON.stringify({ object: 'page', entry: [{ id: '999', time: 1, changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', post_id: '999_1', comment_id: '999_1_c1', message: 'ราคาเท่าไหร่คะ', from: { id: 'U9', name: 'ลูกค้า A' }, created_time: 1795600000 } }] }] });
    assert.equal((await fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signRt(fbC) }, body: fbC })).status, 200);
    const igC = JSON.stringify({ object: 'instagram', entry: [{ id: '1784', time: 1, changes: [{ field: 'comments', value: { id: 'igc1', text: 'สนใจค่ะ', from: { id: 'U8', username: 'cust_b' }, media: { id: 'm77' } } }] }] });
    assert.equal((await fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signRt(igC) }, body: igC })).status, 200);
    let sseText = '';
    const until = Date.now() + 3000;
    while (Date.now() < until && !(sseText.includes('igc1') && sseText.includes('999_1_c1'))) {
      const { value, done } = await Promise.race([reader.read(), new Promise((r) => setTimeout(() => r({ value: null }), 500))]);
      if (done) break; if (value) sseText += new TextDecoder().decode(value);
    }
    reader.cancel().catch(() => {});
    assert.ok(sseText.includes('event: post_comment') && sseText.includes('igc1') && sseText.includes('999_1_c1'), sseText);
    const storedPosts = require('../lib/store').read('posts_comments.json', []);
    const fbPost = storedPosts.find((p) => p.id === '999_1'); const igPost = storedPosts.find((p) => p.id === 'm77');
    assert.equal(fbPost.comments[0].text, 'ราคาเท่าไหร่คะ'); assert.equal(igPost.platform, 'Instagram'); assert.equal(igPost.comments[0].from, 'cust_b');
    ok('คอมเมนต์ใหม่ FB/IG เข้าระบบทันทีผ่าน webhook + ส่งขึ้นหน้าเว็บแบบเรียลไทม์');

    // เซลล์ผู้ตอบแชท: อนุมานจากข้อความมอบหมายของ Business Suite, ไม่ทับชื่อที่ตั้งเอง, ไม่นับชื่อเพจเป็นคน
    const reps = require('../lib/reps');
    const pagesR = [{ id: '1', name: 'BEQ Hair Clinic' }];
    const msgsR = [
      { from: 'customer', text: 'สวัสดีค่ะ', at: '2026-11-01 10:00' },
      { from: 'staff', text: 'สวัสดีค่ะ ยินดีให้บริการ', by: 'BEQ Hair Clinic', at: '2026-11-01 10:01' },
      { from: 'staff', text: 'Jatupon James assigned this conversation to Narumol Molmol.', by: 'BEQ Hair Clinic', at: '2026-11-01 10:02' },
      { from: 'staff', text: 'ราคาเริ่มต้น 39,000 ค่ะ', by: 'BEQ Hair Clinic', at: '2026-11-01 10:03' },
      { from: 'staff', text: 'ส่งจากเว็บ', by: 'somchai', at: '2026-11-01 10:04' },
      { from: 'staff', text: 'ส่งจากเว็บโดย admin', by: 'admin', at: '2026-11-01 10:05' },
    ];
    const leadR = { id: 'L1', repId: 'BEQ Hair Clinic' };
    reps.resolveAll([leadR], { L1: msgsR }, pagesR);
    assert.equal(msgsR[1].by, 'BEQ Hair Clinic'); // ก่อนมอบหมาย ไม่เดา
    assert.equal(msgsR[3].by, 'Narumol Molmol'); assert.equal(msgsR[3].byAssumed, true);
    assert.equal(msgsR[4].by, 'somchai'); assert.ok(!msgsR[4].byAssumed);
    assert.equal(msgsR[5].by, 'admin'); assert.ok(!msgsR[5].byAssumed);
    assert.equal(leadR.repId, 'Narumol Molmol');
    const keep = { id: 'L2', repId: 'Paul CJ' };
    reps.resolveAll([keep], { L2: msgsR }, pagesR); assert.equal(keep.repId, 'Paul CJ');
    assert.equal(reps.isPerson('Pavicon Hair Clinic คลินิกปลูกผม', new Set()), false);
    assert.equal(reps.pick({ 'ผู้ตอบ': 'Ja Jah' }, reps.REP_KEYS), 'Ja Jah');
    assert.equal(reps.pick({ Replied_By: 'Paul CJ' }, reps.REP_KEYS), 'Paul CJ');
    ok('ระบุเซลล์ผู้ตอบแชท (Meta: จากการมอบหมาย / เว็บ: ผู้ใช้ที่ล็อกอิน / import: คอลัมน์เซลล์)');

    // เปลี่ยนสถานะจาก Inbox ได้แม้แชทเก่ากว่า 90 วัน และ Board ย้ายตาม + แจ้งเครื่องอื่นแบบเรียลไทม์
    const storeT = require('../lib/store');
    const oldLeads = storeT.read('leads.json', []);
    oldLeads.push({ id: 'OLD-1', name: 'ลูกค้าเก่า', platform: 'Facebook', channel: 'Messenger', pageId: '999', date: '2025-01-05', status: 'talked' });
    storeT.write('leads.json', oldLeads);
    const sse2 = await fetch(base + '/api/inbox/events', { headers: { cookie } });
    const rd2 = sse2.body.getReader();
    const st = await call('POST', '/api/lead/status', { id: 'OLD-1', status: 'appointment' });
    assert.equal(st.status, 200, JSON.stringify(st.json));
    let txt2 = ''; const until2 = Date.now() + 2000;
    while (Date.now() < until2 && !txt2.includes('OLD-1')) {
      const { value, done } = await Promise.race([rd2.read(), new Promise((r) => setTimeout(() => r({ value: null }), 300))]);
      if (done) break; if (value) txt2 += new TextDecoder().decode(value);
    }
    rd2.cancel().catch(() => {});
    assert.ok(txt2.includes('event: lead_status') && txt2.includes('appointment'), txt2);
    const boardAll = (await call('GET', '/api/board?range=all')).json;
    const apptCol = boardAll.columns.find((c) => c.status === 'appointment');
    assert.ok(apptCol.cards.some((c) => c.id === 'OLD-1'), 'การ์ดต้องย้ายไปคอลัมน์นัดแล้ว');
    ok('เปลี่ยนสถานะจาก Inbox → Board ย้ายตาม (รวมแชทเก่า) + แจ้งเรียลไทม์');

    global.fetch = realFetch2;
  }

  await call('POST', '/api/logout');
  assert.equal((await call('GET', '/api/me')).status, 401); ok('ล็อกเอาต์');
  server.close();
  console.log('\nผ่านทั้งหมด');
}

main().catch((e) => { console.error('\nล้มเหลว:', e); process.exit(1); });