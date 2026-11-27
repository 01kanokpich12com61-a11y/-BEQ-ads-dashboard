'use strict';

function detectConvPlatform(c, defaultPlat = 'Facebook') {
  // 1. ตรวจสอบจาก tags ของ Meta
  const tags = (c.tags && c.tags.data) || [];
  for (const t of tags) {
    const name = String(t.name || '').toLowerCase();
    if (name.includes('instagram')) return 'Instagram';
    if (name.includes('messenger') || name.includes('facebook')) return 'Facebook';
    if (name.includes('whatsapp')) return 'WhatsApp';
  }

  // 2. ตรวจสอบจาก custom_labels หรือ platform field ของ conversation
  if (c.platform) {
    const p = String(c.platform).toLowerCase();
    if (p.includes('instagram')) return 'Instagram';
    if (p.includes('facebook') || p.includes('messenger')) return 'Facebook';
  }

  // 3. ตรวจสอบจาก id หรือ participant id (Instagram scoped IDs หรือ IG username ในชื่อ)
  const parts = (c.participants && c.participants.data) || [];
  for (const part of parts) {
    if (part.username || (part.name && part.name.startsWith('@'))) return 'Instagram';
    if (part.email && part.email.includes('instagram')) return 'Instagram';
  }

  return defaultPlat;
}

function detectFbConvStatus(c) {
  // 1. ตรวจสอบจาก tags หรือ custom_labels ของ Facebook Leads Centre / Inbox
  const labels = [];
  if (c.custom_labels && Array.isArray(c.custom_labels.data)) {
    for (const l of c.custom_labels.data) if (l.name) labels.push(l.name);
  }
  if (c.tags && Array.isArray(c.tags.data)) {
    for (const t of c.tags.data) if (t.name) labels.push(t.name);
  }
  const labelStr = labels.join(' ');
  const statusFromLabel = ops.normalizeStatus('', labelStr);
  if (statusFromLabel && statusFromLabel !== 'talked') return statusFromLabel;

  // 2. ถ้าไม่มี label แยกตามการตอบกลับ: ลูกค้าทักมาแต่แอดมินยังไม่ตอบ = ไม่ตอบ (no_reply)
  const msgList = (c.messages && c.messages.data) || [];
  if (msgList.length > 0) {
    const parts = (c.participants && c.participants.data) || [];
    const custId = parts[0] ? String(parts[0].id) : '';
    const hasStaffReply = msgList.some((m) => m.from && String(m.from.id) !== custId);
    if (!hasStaffReply) return 'no_reply';
  }

  return statusFromLabel || 'talked';
}

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const config = require('./lib/config');
const auth = require('./lib/auth');
const store = require('./lib/store');
const meta = require('./lib/meta');
const providers = require('./lib/providers');
const ops = require('./lib/ops');
const line = require('./lib/line');
const audit = require('./lib/audit');
const jobs = require('./lib/jobs');
const reps = require('./lib/reps');
const assistant = require('./lib/assistant');
const channels = require('./lib/channels');
const ext = require('./lib/extchannels');
const { Readable } = require('node:stream');
const sla = require('./lib/sla');
const { resolveRange, isDate, today, eachDay, addDays } = require('./lib/dates');
const { buildDashboard, buildBoard, buildInbox, leadRow, listFilters } = require('./lib/metrics');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'none'",
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body === 'object' && !Buffer.isBuffer(body);
  let payload = isJson ? JSON.stringify(body) : body;
  const extra = {};
  // บีบอัดข้อมูลก้อนใหญ่ (เช่น Dashboard/Inbox หลายร้อย KB) ให้โหลดเร็วขึ้นมากบนมือถือ
  const acceptsGzip = res.req && /\bgzip\b/.test(String(res.req.headers['accept-encoding'] || ''));
  if (acceptsGzip && typeof payload === 'string' && payload.length > 8192 && !headers['Content-Encoding']) {
    payload = require('node:zlib').gzipSync(payload, { level: 5 });
    extra['Content-Encoding'] = 'gzip';
    extra.Vary = 'Accept-Encoding';
  }
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extra,
    ...headers,
  });
  res.end(payload);
}

function readJson(req, maxBytes = 5_000_000) {
  return new Promise((resolve, reject) => {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return reject(Object.assign(new Error('Content-Type ต้องเป็น application/json'), { status: 415 }));
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { reject(Object.assign(new Error('ข้อมูลใหญ่เกินไป'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('JSON ไม่ถูกต้อง'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const clean = (v, max = 5000) => String(v ?? '').trim().slice(0, max);

function clientIp(req) {
  if (config.trustProxy) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || 'unknown';
}

function readRaw(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('ข้อมูลใหญ่เกินไป'), { status: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Verify Token สำหรับ Webhook: ใช้ WEBHOOK_VERIFY_TOKEN (แนะนำบน Render) หรือค่าที่บันทึกไว้
// ถ้ายังไม่มีเลย จะสุ่มค่าใหม่แล้วบันทึก (ไม่ใช้ค่าคงที่ในโค้ด เพราะ repo อ่านได้)
const LEGACY_DEFAULT_TOKEN = 'beq_webhook_verify_token_secure';
function webhookToken() {
  if (process.env.WEBHOOK_VERIFY_TOKEN && process.env.WEBHOOK_VERIFY_TOKEN.trim()) {
    return process.env.WEBHOOK_VERIFY_TOKEN.trim();
  }
  const m = meta.getSettings().meta || {};
  const saved = String(m.webhookVerifyToken || '').trim();
  if (saved && saved !== LEGACY_DEFAULT_TOKEN) return saved;
  const fresh = crypto.randomBytes(16).toString('hex');
  meta.saveSettings({ meta: { webhookVerifyToken: fresh } });
  return fresh;
}

// ตรวจลายเซ็น X-Hub-Signature-256 ของ Meta (ใช้กับทั้ง Messenger/Instagram และ WhatsApp Cloud API)
function metaSignatureOk(req, raw) {
  const secret = (meta.getSettings().meta || {}).appSecret || process.env.META_APP_SECRET || '';
  if (!secret) return { ok: false, reason: 'ยังไม่ได้บันทึก App Secret' };
  const sig = String(req.headers['x-hub-signature-256'] || '');
  const ok = safeEq(sig, 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex'));
  return { ok, reason: ok ? '' : 'ลายเซ็นไม่ถูกต้อง' };
}

const safeEq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// ส่งข้อมูล Lead + ข้อความล่าสุดไปยัง Google Sheets ผ่าน Apps Script ทันที (realtime backup)
async function pushToSheets(lead, latestMsg) {
  try {
    const s = meta.getSettings();
    const scriptUrl = s.sheets && s.sheets.appsScriptUrl;
    if (!scriptUrl) return;
    await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name || 'ลูกค้า Messenger',
        platform: lead.platform || 'Facebook',
        pageName: lead.pageName || '',
        message: latestMsg || '',
        date: lead.date || new Date().toISOString().slice(0, 10),
        status: lead.status || 'talked',
        phone: lead.phone || ''
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (_) { /* ไม่ให้บล็อก webhook */ }
}

// ระบบ Server-Sent Events (SSE) สำหรับ Real-time Chat ใน Inbox
const realtimeClients = new Set();
// ส่งสัญญาณ "ยังเชื่อมต่ออยู่" ทุก 25 วินาที กันพร็อกซีของ Render ตัดการเชื่อมต่อ SSE ที่เงียบนาน
setInterval(() => {
  for (const client of realtimeClients) {
    try { client.res.write(': ping\n\n'); } catch (_) { realtimeClients.delete(client); }
  }
}, 25000).unref();

function broadcastRealtime(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of realtimeClients) {
    try {
      client.res.write(data);
    } catch (_) {
      realtimeClients.delete(client);
    }
  }
}

// รับข้อความจาก Meta Webhook (Messenger) แล้วบันทึกเป็นแชท
async function handleWebhook(body) {
  if (body.object !== 'page' && body.object !== 'instagram') return;
  const isInstagram = body.object === 'instagram';
  for (const entry of body.entry || []) {
    for (const ev of entry.messaging || []) {
      const msg = ev.message;
      if (!msg || (!msg.text && !(msg.attachments && msg.attachments.length))) continue;
      const echo = Boolean(msg.is_echo); // ข้อความที่เพจส่งออกเอง (เช่นตอบจาก Business Suite)
      const pageId = String(echo ? ev.sender.id : ev.recipient.id);
      const psid = String(echo ? ev.recipient.id : ev.sender.id);
      const ref = msg.referral || ev.referral || {};

      // ตรวจสอบและลงทะเบียน Page อัตโนมัติจาก Webhook
      // — ถ้ายังไม่รู้จัก pageId นี้ จะดึงชื่อจาก Graph API แล้วบันทึกลง pages.json ทันที
      let pages = store.read('pages.json', []);
      let matchedPage = pages.find((p) => p.id === pageId);
      let pageName = matchedPage ? matchedPage.name : '';

      if (!matchedPage) {
        // พยายามดึงชื่อเพจจริงจาก Graph API (ต้องมี accessToken)
        const pageInfo = await meta.fetchPageInfo(pageId).catch(() => null);
        if (pageInfo && pageInfo.name) pageName = pageInfo.name;

        // ตรวจว่ามีเพจ placeholder (id ขึ้นต้น P-) ที่ยังไม่มี real pageId หรือไม่
        const fbPages = pages.filter((p) => (!p.platform || p.platform === 'Facebook'));
        const placeholder = fbPages.find((p) => p.id.startsWith('P-'));
        if (placeholder) {
          // อัปเดต placeholder ให้ใช้ pageId จริง
          placeholder.id = pageId;
          if (pageName) placeholder.name = pageName;
          else pageName = placeholder.name;
          store.write('pages.json', pages);
        } else {
          // ไม่สร้างเพจขยะอัตโนมัติถ้าไม่มีชื่อเพจที่ชัดเจน
          if (pageName && !pageName.startsWith('Facebook ') && !pageName.startsWith('Instagram ') && pageId !== '1040829309417229') {
            const defaultPlatform = isInstagram ? 'Instagram' : 'Facebook';
            recordPage(pageId, pageName, defaultPlatform);
          }
        }
      }

      const currentPlatform = isInstagram ? 'Instagram' : ((matchedPage && matchedPage.platform) || 'Facebook');
      let leads = store.read('leads.json', []);
      let lead = leads.find((l) => l.psid === psid && (!pageId || !l.pageId || l.pageId === pageId));
      if (!lead) {
        const name = await meta.fetchProfileName(pageId, psid);
        lead = ops.findOrCreateLead({
          psid,
          pageId,
          name,
          adId: ref.ad_id ? String(ref.ad_id) : '',
          platform: currentPlatform,
          pageName: pageName || `${currentPlatform} หลัก`,
          channel: currentPlatform === 'Instagram' ? 'Instagram' : 'Messenger',
        }).lead;
      } else {
        let changed = false;
        if (!lead.pageId || lead.pageId !== pageId) { lead.pageId = pageId; changed = true; }
        if (!lead.platform || lead.platform !== currentPlatform) { lead.platform = currentPlatform; changed = true; }
        if (!lead.pageName && pageName) { lead.pageName = pageName; changed = true; }
        if (changed) {
          const idx = leads.findIndex((x) => x.id === lead.id);
          if (idx !== -1) { leads[idx] = lead; store.write('leads.json', leads); }
        }
      }
      const addedMsg = {
        from: echo ? 'staff' : 'customer', text: msg.text || '[ไฟล์แนบ]', mid: msg.mid || undefined,
        at: ops.nowStamp(ev.timestamp || Date.now()), via: 'webhook',
      };
      // ข้อความที่แอดมินตอบจาก Business Suite: Meta ไม่บอกชื่อคนส่ง → ใช้เซลล์ผู้ดูแลแชทนี้
      if (echo) {
        const pn = reps.pageNameSet(store.read('pages.json', []), [lead]);
        const owner = lead.repId || lead.rep;
        if (reps.isPerson(owner, pn)) { addedMsg.by = owner; addedMsg.byAssumed = true; } else if (pageName) addedMsg.by = pageName;
      }
      // ข้อความระบบ "X assigned this conversation to Y" → อัปเดตเซลล์ผู้ดูแลทันที
      const asg = reps.parseAssignment(addedMsg.text);
      if (asg && asg.to) {
        const pn = reps.pageNameSet(store.read('pages.json', []), [lead]);
        if (reps.isPerson(asg.to, pn)) {
          const all = store.read('leads.json', []);
          const li = all.find((x) => x.id === lead.id);
          if (li) { li.repId = asg.to; li.rep = asg.to; store.write('leads.json', all); lead.repId = asg.to; lead.rep = asg.to; }
        }
      }
      ops.addMessage(lead.id, addedMsg);
      broadcastRealtime('chat_message', { leadId: lead.id, lead, message: addedMsg });
      if (!echo) {
        pushToSheets(lead, msg.text || '').catch(() => {});
      }
    }
    // คอมเมนต์ใหม่บนโพสต์ (Facebook: field "feed", Instagram: field "comments") → อัปเดตหน้า Posts & Comments ทันที
    for (const change of entry.changes || []) {
      try { handleCommentChange(String(entry.id || ''), change, isInstagram); } catch (e) { console.error('comment-webhook', e); }
    }
  }
}

function handleCommentChange(ownerId, change, isInstagram) {
  const v = change && change.value;
  if (!v) return;
  let postId; let comment; let parentId = null;
  if (!isInstagram && change.field === 'feed' && v.item === 'comment') {
    if (v.verb === 'remove') return;
    postId = String(v.post_id || '');
    const fromId = v.from && String(v.from.id);
    comment = { id: String(v.comment_id), text: v.message || '', from: (v.from && v.from.name) || 'ผู้ใช้ Facebook', timestamp: v.created_time ? new Date(Number(v.created_time) * 1000 || v.created_time).toISOString() : new Date().toISOString(), isStaff: fromId === ownerId };
    if (v.parent_id && v.parent_id !== v.post_id) parentId = String(v.parent_id);
  } else if (isInstagram && change.field === 'comments') {
    postId = String((v.media && v.media.id) || '');
    const fromId = v.from && String(v.from.id);
    comment = { id: String(v.id), text: v.text || '', from: (v.from && v.from.username) || 'ผู้ใช้ Instagram', timestamp: new Date().toISOString(), isStaff: fromId === ownerId };
    if (v.parent_id) parentId = String(v.parent_id);
  } else return;
  if (!postId || !comment.id) return;
  const posts = store.read('posts_comments.json', []);
  let post = posts.find((p) => String(p.id) === postId);
  if (!post) {
    const page = store.read('pages.json', []).find((p) => String(p.id) === ownerId);
    post = { id: postId, platform: isInstagram ? 'Instagram' : 'Facebook', pageId: ownerId, pageName: page ? page.name : '', content: '(โพสต์ที่ยังไม่ได้ดึงรายละเอียด — กดดึงโพสต์เพื่อโหลดรูปและข้อความ)', mediaUrl: null, videoUrl: null, mediaType: 'IMAGE', permalink: '', timestamp: comment.timestamp, comments: [] };
    posts.unshift(post);
  }
  post.comments = post.comments || [];
  if (parentId) {
    const parent = post.comments.find((c) => String(c.id) === parentId);
    if (parent) {
      parent.replies = parent.replies || [];
      if (!parent.replies.some((r) => String(r.id) === comment.id)) parent.replies.push(comment);
      if (comment.isStaff) parent.replied = true;
    } else if (!post.comments.some((c) => String(c.id) === comment.id)) post.comments.push({ ...comment, replies: [], replied: false });
  } else if (!post.comments.some((c) => String(c.id) === comment.id)) {
    post.comments.push({ ...comment, replies: [], replied: Boolean(comment.isStaff) });
  }
  store.write('posts_comments.json', posts);
  broadcastRealtime('post_comment', { postId, platform: post.platform, comment, parentId });
}

function syncLegacyData() {
  try {
    const pages = store.read('pages.json', []);
    const fbPages = pages.filter((p) => (!p.platform || p.platform === 'Facebook'));
    const singleFbPage = fbPages.length === 1 ? fbPages[0] : null;

    const leads = store.read('leads.json', []);
    let changed = false;
    for (const l of leads) {
      if (!l.platform) {
        const ch = (l.channel || '').toLowerCase();
        if (ch.includes('line')) l.platform = 'LINE';
        else if (ch.includes('wa') || ch.includes('what')) l.platform = 'WhatsApp';
        else l.platform = 'Facebook';
        changed = true;
      }
      if (!l.pageName && singleFbPage && l.platform === 'Facebook') {
        l.pageName = singleFbPage.name;
        changed = true;
      }
      if (l.pageId && singleFbPage && l.platform === 'Facebook' && singleFbPage.id.startsWith('P-') && !isNaN(Number(l.pageId))) {
        singleFbPage.id = l.pageId;
        store.write('pages.json', pages);
      }
    }
    if (changed) store.write('leads.json', leads);
  } catch (_) {}
}
syncLegacyData();

function recordPage(pageId, pageName, platform = 'Facebook') {
  if (!pageName && !pageId) return;
  const name = clean(pageName, 80) || clean(pageId, 80);
  const id = clean(pageId, 50) || `PAGE-${name.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}`;
  if (!name || /channel/i.test(name) || /channel/i.test(id)) return;
  const pages = store.read('pages.json', []);
  const idx = pages.findIndex((p) => p.id === id);
  if (idx >= 0) {
    if (platform && (!pages[idx].platform || pages[idx].platform === 'Facebook')) {
      pages[idx].platform = platform;
    }
    // บัญชี LINE/WhatsApp: ชื่อที่ตั้งในหน้าตั้งค่าคือชื่อจริง → อัปเดตตามเสมอ
    const isChannelAcc = ['LINE', 'WhatsApp', 'WeChat', 'TikTok'].includes(platform);
    if (name && (isChannelAcc || !pages[idx].name || pages[idx].name.startsWith('Facebook Page ') || pages[idx].name === id)) {
      pages[idx].name = name;
    }
  } else {
    const color = platform === 'LINE' ? '#06c755' : platform === 'WhatsApp' ? '#25d366' : platform === 'WeChat' ? '#07c160' : platform === 'TikTok' ? '#111827' : platform === 'Instagram' ? '#e1306c' : '#1877f2';
    pages.push({ id, name, platform: platform || 'Facebook', color });
  }
  store.write('pages.json', pages);
}

function fetchUrl(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = targetUrl.startsWith('https:') ? https : http;
    client.get(targetUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        let nextUrl = res.headers.location;
        if (!nextUrl.startsWith('http')) {
          const u = new URL(targetUrl);
          nextUrl = `${u.protocol}//${u.host}${nextUrl}`;
        }
        return resolve(fetchUrl(nextUrl, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`ดึงข้อมูลไม่สำเร็จ HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// กู้คืนข้อมูลจาก Google Sheets อัตโนมัติเมื่อเว็บเริ่มทำงาน (ถ้าในระบบยังไม่มีลีด)
async function autoRestoreFromSheets() {
  try {
    const s = meta.getSettings();
    const sheetUrl = process.env.GOOGLE_SHEET_URL || (s.sheets && (s.sheets.sheetUrl || s.sheets.lastUrl));
    if (!sheetUrl) return;

    let csvUrl = sheetUrl;
    if (csvUrl.includes('/pubhtml')) {
      csvUrl = csvUrl.replace('/pubhtml', '/pub?output=csv');
    } else {
      const match = csvUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const docId = match[1];
        let gid = '0';
        const gidMatch = csvUrl.match(/[#&?]gid=([0-9]+)/);
        if (gidMatch) gid = gidMatch[1];
        csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
      }
    }

    const csvText = await fetchUrl(csvUrl).catch(() => null);
    if (!csvText || !csvText.trim()) return;

    const existingLeads = store.read('leads.json', []);
    if (existingLeads.length === 0) {
      const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
        const added = [];
        for (let i = 1; i < lines.length; i++) {
          const rowVals = lines[i].split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
          const r = {};
          headers.forEach((h, idx) => { r[h] = rowVals[idx] || ''; });

          const name = r.name || r['ชื่อ'] || r['ชื่อลูกค้า'] || `ลูกค้า ${i}`;
          const channel = r.channel || r['ช่องทาง'] || 'Messenger';
          const platform = r.platform || r['แพลตฟอร์ม'] || (channel === 'LINE' ? 'LINE' : channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook');
          const pageName = r.page || r.pagename || r['เพจ'] || 'เพจรักเพื่อน';
          const pageId = r.pageid || (pageName.includes('รักเพื่อน') ? 'P-RakPhuean' : `P_${pageName}`);
          const date = r.date || r['วันที่'] || today();
          const dropReason = r.message || r['ข้อความ'] || r['บันทึก'] || r.note || '';
          const status = ops.normalizeStatus(r.status || r['สถานะ'] || 'talked', dropReason);
          const phone = r.phone || r['เบอร์'] || r['เบอร์โทร'] || '';

          added.push({
            id: `S-${Date.now().toString(36)}-${String(i).padStart(4, '0')}`,
            name, channel, platform, pageName, pageId, date, status, quality: ops.QUALITY[status] || 'average',
            adId: 'Direct', repId: '', value: 0, firstResponseMin: null, dropReason, phone, email: '',
          });
        }
        if (added.length) {
          store.write('leads.json', added);
          console.log(`[AutoRestore] Restored ${added.length} leads from Google Sheets`);
        }
      }
    }
  } catch (_) {}
}
setTimeout(autoRestoreFromSheets, 1500);

// รับข้อความจาก LINE Official Account Webhook
async function handleLineWebhook(body, acc) {
  acc = acc || channels.lineAccounts()[0] || { id: 'P-LINE', name: 'LINE Official Account' };
  const lineToken = acc.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  if (body.destination && !acc.botUserId && !acc.fromEnv) channels.updateLine(acc.id, { botUserId: body.destination });
  for (const ev of body.events || []) {
    if (ev.type !== 'message' || !ev.message) continue;
    const userId = ev.source?.userId;
    if (!userId) continue;
    const text = ev.message.text || (ev.message.type === 'image' ? '[รูปภาพ]' : ev.message.type === 'video' ? '[วิดีโอ]' : '[ข้อความ]');
    const pageId = acc.id;
    const pageName = acc.name || acc.botName || 'LINE Official Account';
    recordPage(pageId, pageName, 'LINE');
    let leads = store.read('leads.json', []);
    // ลูกค้าคนเดียวกันทักหลาย OA = แยกแชทตาม OA (ลีดเก่าที่ยังไม่มี pageId นับเป็นของ OA แรก)
    let lead = leads.find((l) => (l.psid === userId || l.phone === userId) && (l.pageId === pageId || (!l.pageId && pageId === 'P-LINE')));
    if (!lead) {
      let name = `LINE ลูกค้า ${userId.slice(-4)}`;
      if (lineToken) {
        try {
          const profRes = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
            headers: { Authorization: `Bearer ${lineToken}` },
            signal: AbortSignal.timeout(8000),
          });
          if (profRes.ok) {
            const prof = await profRes.json();
            if (prof && prof.displayName) name = prof.displayName;
          }
        } catch {}
      }
      lead = ops.findOrCreateLead({ psid: userId, pageId, name, adId: 'Direct', channel: 'LINE', platform: 'LINE', pageName }).lead;
    }
    const lineMsg = {
      from: 'customer', text, mid: ev.message.id || undefined,
      at: ops.nowStamp(ev.timestamp || Date.now()), via: 'line',
    };
    ops.addMessage(lead.id, lineMsg);
    broadcastRealtime('chat_message', { leadId: lead.id, lead, message: lineMsg });
    pushToSheets(lead, text).catch(() => {});
    try {
      const lineConf = line.getLineConfig();
      if (lineConf.enabled && lineConf.notifyOnNewReply) {
        line.sendLineNotification(line.formatNewReplyAlert({ ...lead, lastText: text })).catch(() => {});
      }
    } catch {}
  }
}

// รับข้อความจาก WhatsApp Business Webhook
async function handleWhatsAppWebhook(body) {
  if (body.object !== 'whatsapp_business_account') return;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const val = change.value;
      if (!val || !val.messages) continue;
      // หลายเบอร์: ข้อความบอก phone_number_id ของเบอร์ที่รับ → หาบัญชีนั้น (ยังไม่มีในระบบ = เพิ่มให้อัตโนมัติ)
      const md = val.metadata || {};
      let acc = channels.waAccountForPhone(md.phone_number_id);
      if (!acc && md.phone_number_id) acc = channels.upsertWa({ phoneId: md.phone_number_id, name: md.display_phone_number ? `WhatsApp ${md.display_phone_number}` : 'WhatsApp Business' });
      if (acc && md.display_phone_number && !acc.displayPhone) channels.updateWa(acc.id, { displayPhone: md.display_phone_number });
      acc = acc || { id: 'P-WhatsApp', name: 'WhatsApp Business' };
      const contactMap = new Map((val.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const msg of val.messages) {
        const waId = msg.from;
        if (!waId) continue;
        const text = msg.text?.body || (msg.type ? `[${msg.type}]` : '[ข้อความ]');
        const pageId = acc.id;
        const pageName = acc.name || acc.verifiedName || 'WhatsApp Business';
        recordPage(pageId, pageName, 'WhatsApp');
        let leads = store.read('leads.json', []);
        let lead = leads.find((l) => (l.psid === waId || l.phone === waId) && l.platform === 'WhatsApp' && (l.pageId === pageId || (!l.pageId && pageId === 'P-WhatsApp')));
        if (!lead) {
          const name = contactMap.get(waId) || `WhatsApp ${waId}`;
          lead = ops.findOrCreateLead({ psid: waId, pageId, name, adId: 'Direct', channel: 'WhatsApp', platform: 'WhatsApp', pageName }).lead;
          lead.phone = waId;
        }
        const ts = msg.timestamp ? parseInt(msg.timestamp, 10) * 1000 : Date.now();
        const waMsg = {
          from: 'customer', text, mid: msg.id || undefined,
          at: ops.nowStamp(ts), via: 'whatsapp',
        };
        ops.addMessage(lead.id, waMsg);
        broadcastRealtime('chat_message', { leadId: lead.id, lead, message: waMsg });
        pushToSheets(lead, text).catch(() => {});
        try {
          const lineConf = line.getLineConfig();
          if (lineConf.enabled && lineConf.notifyOnNewReply) {
            line.sendLineNotification(line.formatNewReplyAlert({ ...lead, lastText: text })).catch(() => {});
          }
        } catch {}
      }
    }
  }
}

function handleWeChatMessage(acc, xml) {
  const type = ext.xmlField(xml, 'MsgType');
  const openId = ext.xmlField(xml, 'FromUserName');
  if (!openId || type === 'event') return;
  const text = type === 'text' ? ext.xmlField(xml, 'Content') : `[${type === 'image' ? 'รูปภาพ' : type === 'voice' ? 'ข้อความเสียง' : type === 'video' ? 'วิดีโอ' : type === 'location' ? 'ตำแหน่ง' : type || 'ข้อความ'}]`;
  const msgId = ext.xmlField(xml, 'MsgId');
  const ts = Number(ext.xmlField(xml, 'CreateTime')) * 1000 || Date.now();
  const pageId = acc.id; const pageName = acc.name || 'WeChat Official Account';
  recordPage(pageId, pageName, 'WeChat');
  let leads = store.read('leads.json', []);
  let lead = leads.find((l) => l.psid === openId && l.pageId === pageId);
  if (!lead) lead = ops.findOrCreateLead({ psid: openId, pageId, name: `WeChat ${openId.slice(-6)}`, adId: 'Direct', channel: 'WeChat', platform: 'WeChat', pageName }).lead;
  const msg = { from: 'customer', text, mid: msgId ? `wc_${msgId}` : undefined, at: ops.nowStamp(ts), via: 'wechat' };
  ops.addMessage(lead.id, msg);
  broadcastRealtime('chat_message', { leadId: lead.id, lead, message: msg });
  pushToSheets(lead, text).catch(() => {});
}

function publicSettings() {
  const s = meta.getSettings();
  const m = s.meta || {};
  const ln = s.line || {};
  const wa = s.whatsapp || {};
  const sh = s.sheets || {};
  const sbCfg = store.getSupabaseConfig ? store.getSupabaseConfig() : { url: config.supabaseUrl || '', key: config.supabaseKey || '' };
  return {
    mode: providers.currentMode(),
    clinicName: s.clinicName || 'BEQ Group',
    meta: {
      appId: m.appId || '',
      hasSecret: Boolean(m.appSecret),
      hasToken: Boolean(m.accessToken),
      tokenHint: m.accessToken ? `••••${m.accessToken.slice(-4)}` : '',
      adAccountId: m.adAccountId || '',
      apiVersion: m.apiVersion || config.metaApiVersion,
      accountName: m.accountName || '',
      currency: m.currency || '',
      connectedAt: m.connectedAt || null,
    },
    webhook: { path: '/webhook', verifyToken: webhookToken(), hasSecret: Boolean(m.appSecret) },
    lineAccounts: channels.publicLine(),
    waAccounts: channels.publicWa(),
    extAccounts: ext.publicAll(),
    line: {
      channelId: ln.channelId || '',
      hasSecret: Boolean(ln.channelSecret),
      hasToken: Boolean(ln.channelAccessToken),
      tokenHint: ln.channelAccessToken ? `••••${ln.channelAccessToken.slice(-4)}` : '',
      botName: ln.botName || '',
      basicId: ln.basicId || '',
      connectedAt: ln.connectedAt || null,
      webhookPath: '/webhook/line',
    },
    whatsapp: {
      wabaId: wa.wabaId || '',
      phoneId: wa.phoneId || '',
      hasToken: Boolean(wa.accessToken),
      tokenHint: wa.accessToken ? `••••${wa.accessToken.slice(-4)}` : '',
      verifiedName: wa.verifiedName || '',
      displayPhone: wa.displayPhone || '',
      connectedAt: wa.connectedAt || null,
      webhookPath: '/webhook/whatsapp',
      verifyToken: webhookToken(),
    },
    sheets: {
      lastUrl: sh.lastUrl || '',
      appsScriptUrl: sh.appsScriptUrl || '',
      lastSyncAt: sh.lastSyncAt || null,
      hasAppsScript: Boolean(sh.appsScriptUrl),
    },
    supabase: {
      connected: Boolean(sbCfg.url && sbCfg.key),
      fullUrl: sbCfg.url || '',
      url: sbCfg.url ? sbCfg.url.replace(/^https?:\/\//, '').split('.')[0] : '',
      hasKey: Boolean(sbCfg.key),
      keyHint: sbCfg.key ? `••••${sbCfg.key.slice(-4)}` : '',
      backend: store.backend,
    },
  };
}

// จำนวนที่ผู้ใช้เลือก: ตัวเลข หรือ 'all' = ทั้งหมดเท่าที่ Meta ให้
function parseLimit(v, def, min = 1) {
  if (String(v || '').toLowerCase() === 'all') return meta.ALL_LIMIT;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.max(min, Math.min(n, meta.ALL_LIMIT));
}

// ดึงโฆษณาใหม่เบื้องหลังเสร็จ → บอกหน้า Dashboard ที่เปิดอยู่ให้โหลดตัวเลขใหม่
providers.onAdsRefreshed((r) => broadcastRealtime('ads_updated', r));

const assistantUsage = new Map(); // username -> [timestamps]

const ADMIN_ONLY_ROUTES = new Set([
  'PUT /api/settings/meta', 'POST /api/settings/meta/disconnect', 'POST /api/settings/meta/extend', 'POST /api/settings/meta/test',
  'POST /api/settings/mode', 'POST /api/settings/line-notify', 'POST /api/notifications/schedule',
  'POST /api/notifications/test-line',
]);

// คำขอที่ทำเป็นงานเบื้องหลังได้ (เรียกด้วย ?background=1)
const BACKGROUND_ROUTES = new Set([
  'POST /api/import/facebook-conversations',
  'POST /api/import/facebook-conversations-all',
  'POST /api/posts-comments/sync',
  'POST /api/meta/sync-all',
]);

async function api(req, res, url, session) {
  const route = `${req.method} ${url.pathname}`;
  const q = Object.fromEntries(url.searchParams);

  /* ---------- ตั้งค่าระบบ: เฉพาะผู้ดูแล (เดิมบัญชีทีมขายเปลี่ยน Token Meta / ตัดการเชื่อมต่อ / สลับโหมดได้) ---------- */
  if (ADMIN_ONLY_ROUTES.has(route) && !auth.isAdmin(session.user)) {
    return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
  }

  /* ---------- งานเบื้องหลัง: ดึงข้อมูลจาก Meta ที่ใช้เวลานาน ---------- */
  if (BACKGROUND_ROUTES.has(route) && q.background === '1') {
    const raw = await readRaw(req, 5_000_000);
    const existing = jobs.running(route);
    if (existing) return send(res, 202, { jobId: existing.id, alreadyRunning: true });
    const innerUrl = new URL(url.toString());
    innerUrl.searchParams.delete('background');
    const job = jobs.start(route, session.user.username, () => new Promise((resolve) => {
      const fakeReq = Object.assign(Readable.from(raw.length ? [raw] : []), {
        method: req.method, url: innerUrl.pathname + innerUrl.search, headers: { ...req.headers }, socket: { remoteAddress: req.socket.remoteAddress },
        setTimeout() {},
      });
      let status = 200; let done = false;
      const finish = (body) => {
        if (done) return; done = true;
        let parsed = body;
        if (Buffer.isBuffer(parsed)) parsed = parsed.toString('utf8');
        if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch {} }
        resolve({ status, body: parsed });
      };
      const fakeRes = {
        headersSent: false,
        writeHead(st) { status = st; this.headersSent = true; return this; },
        setHeader() {}, getHeader() {}, setTimeout() {}, write() { return true; }, on() {}, once() {},
        end(body) { finish(body); },
      };
      api(fakeReq, fakeRes, innerUrl, session)
        .then(() => finish({ ok: true }))
        .catch((e) => { status = e.status || 500; finish({ error: (e && e.message) || 'เกิดข้อผิดพลาด' }); });
    }));
    audit.log(session.user.username, 'job_start', route, clientIp(req));
    return send(res, 202, { jobId: job.id });
  }
  {
    const jm = url.pathname.match(/^\/api\/jobs\/([a-f0-9]{16})(\/cancel)?$/);
    if (jm) {
      const job = jobs.get(jm[1]);
      if (!job || (job.owner !== session.user.username && !auth.isAdmin(session.user))) return send(res, 404, { error: 'ไม่พบงานนี้ (อาจหมดอายุหรือเซิร์ฟเวอร์รีสตาร์ท)' });
      if (jm[2] && req.method === 'POST') { jobs.cancel(job.id); return send(res, 200, jobs.publicView(job)); }
      if (req.method === 'GET') return send(res, 200, jobs.publicView(job));
    }
  }

  /* ---------- น้อง AI: ตอบคำถามจากข้อมูลจริงในเว็บ (Claude + เครื่องมืออ่านข้อมูล) ---------- */
  if (route === 'GET /api/assistant/status') {
    return send(res, 200, { enabled: assistant.enabled(), model: assistant.enabled() ? assistant.model() : null });
  }
  if (route === 'POST /api/assistant') {
    if (!assistant.enabled()) return send(res, 200, { fallback: true });
    // จำกัดการใช้ต่อผู้ใช้ กันค่าใช้จ่ายบานปลาย: 40 คำถาม / 10 นาที
    const key = session.user.username; const now = Date.now();
    const hist = (assistantUsage.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
    if (hist.length >= 40) return send(res, 429, { error: 'ถามถี่เกินไป พักสักครู่แล้วลองใหม่นะครับ' });
    hist.push(now); assistantUsage.set(key, hist);
    const b = await readJson(req);
    const r = await assistant.ask(Array.isArray(b.messages) ? b.messages : [], session.user);
    audit.log(session.user.username, 'assistant_ask', String((b.messages || []).slice(-1)[0]?.text || '').slice(0, 80), clientIp(req));
    return send(res, 200, { text: r.text, tools: r.tools });
  }

  if (route === 'GET /api/me') {
    return send(res, 200, {
      username: session.user.username, mustChange: Boolean(session.user.mustChange),
      role: auth.isAdmin(session.user) ? 'admin' : 'staff',
      mode: providers.currentMode(), clinicName: publicSettings().clinicName,
    });
  }

  /* ---------- จัดการผู้ใช้ (เฉพาะ admin) ---------- */
  if (url.pathname === '/api/users' || url.pathname.startsWith('/api/users/')) {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });

    if (route === 'GET /api/users') return send(res, 200, { users: auth.listUsers() });

    if (route === 'POST /api/users') {
      const b = await readJson(req);
      const items = Array.isArray(b.users) ? b.users.slice(0, 100) : [];
      if (!items.length) return send(res, 400, { error: 'ไม่มีรายชื่อผู้ใช้ที่จะเพิ่ม' });
      const out = auth.addUsers(items);
      // ไม่บันทึกรหัสผ่านลง audit
      if (out.added.length) audit.log(session.user.username, 'user_add', out.added.map((u) => `${u.username} (${u.role})`).join(', '), clientIp(req));
      return send(res, 200, { ok: true, ...out, users: auth.listUsers() });
    }

    if (route === 'POST /api/users/reset') {
      const b = await readJson(req);
      const err = auth.resetPassword(clean(b.username, 60), String(b.password || ''));
      if (err) return send(res, 400, { error: err });
      audit.log(session.user.username, 'user_reset', clean(b.username, 60), clientIp(req));
      return send(res, 200, { ok: true });
    }

    if (route === 'POST /api/users/delete') {
      const b = await readJson(req);
      const err = auth.deleteUser(clean(b.username, 60), session.user.username);
      if (err) return send(res, 400, { error: err });
      audit.log(session.user.username, 'user_delete', clean(b.username, 60), clientIp(req));
      return send(res, 200, { ok: true, users: auth.listUsers() });
    }
  }

  if (route === 'GET /api/filters') {
    const range = resolveRange({ range: '30d' });
    // ตัวกรองใช้แค่รายชื่อแคมเปญ/เพจ → ใช้ข้อมูลโฆษณาชุดล่าสุดได้ ไม่ต้องดึง Meta ใหม่ตามช่วงเวลา
    const fData = meta.lastSnapshot() ? await providers.load(range, { ads: false }) : await providers.load(resolveRange({ range: '30d' }));
    return send(res, 200, listFilters(fData));
  }

  if (route === 'GET /api/dashboard') {
    if (q.refresh) meta.clearCache();
    const range = resolveRange(q);
    const data = await providers.load(range, { fresh: Boolean(q.refresh) });
    return send(res, 200, {
      mode: providers.currentMode(), metaError: data.metaError || null,
      stored: data.stale || data.metaError ? { at: data.storedAt || null, refreshing: Boolean(data.stale) } : null,
      ...buildDashboard(data, range, q),
    });
  }

  if (route === 'GET /api/board') {
    const range = resolveRange(q);
    const data = await providers.load(range, { ads: false });
    const isDemo = providers.currentMode() === 'demo';
    const overlay = store.read('messages.json', {});
    const messagesMap = {};
    for (const l of data.leads) {
      messagesMap[l.id] = ops.messagesFor(l, data, isDemo, overlay);
    }
    return send(res, 200, { mode: providers.currentMode(), ...buildBoard(data, range, { messagesMap, platform: q.platform, page: q.page }) });
  }

  if (route === 'GET /api/posts-comments') {
    try {
      const range = resolveRange({ range: url.searchParams.get('range') || '30d', from: url.searchParams.get('from'), to: url.searchParams.get('to') });
      const pageIdFilter = url.searchParams.get('pageId') || '';
      const platformFilter = url.searchParams.get('platform') || '';

      let posts = store.read('posts_comments.json', []);
      if (pageIdFilter) {
        posts = posts.filter(p => p.pageId === pageIdFilter || String(p.pageId) === String(pageIdFilter));
      }
      if (platformFilter) {
        posts = posts.filter(p => (p.platform || 'Facebook').toLowerCase() === platformFilter.toLowerCase());
      }

      let commentSla = { totals: { turns: 0, onTime: 0, late: 0, points: 0 }, admins: [] };
      try {
        commentSla = sla.buildCommentSla(posts, range);
      } catch (slaErr) {
        console.error('buildCommentSla error:', slaErr);
      }

      return send(res, 200, {
        posts,
        sla: commentSla,
        range,
      });
    } catch (err) {
      console.error('GET /api/posts-comments error:', err);
      return send(res, 500, { error: err.message || 'ไม่สามารถโหลดข้อมูลคอมเมนต์ได้' });
    }
  }

  if (route === 'POST /api/posts-comments/sync') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req).catch(() => ({}));
    const pages = store.read('pages.json', []);
    const targetPageId = b.pageId;

    let targetPages = pages.filter(p => (!p.platform || p.platform === 'Facebook' || p.platform === 'Instagram') && !p.id.startsWith('P-'));
    if (targetPageId) {
      targetPages = targetPages.filter(p => p.id === targetPageId || String(p.id) === String(targetPageId));
    }

    if (!targetPages.length) return send(res, 400, { error: 'ไม่พบเพจสำหรับดึงโพสต์ กรุณากดดึงเพจจาก Meta ก่อน' });

    let allPosts = store.read('posts_comments.json', []);
    let fetchedCount = 0;
    const errors = [];

    const reqLimit = parseLimit(b.limit ?? q.limit, 300, 10);
    const commentLimit = parseLimit(b.commentsPerPost, 500, 10);
    const postOpts = { afterDate: isDate(b.afterDate) ? b.afterDate : null, beforeDate: isDate(b.beforeDate) ? b.beforeDate : null };
    for (const [pIdx, p] of targetPages.entries()) {
      if (jobs.cancelled()) break;
      jobs.report({ note: `เพจ ${pIdx + 1}/${targetPages.length}: ${p.name}` });
      try {
        const pPlat = p.platform || 'Facebook';
        const pPosts = await meta.fetchPostsAndComments(p.id, pPlat, p.fbPageId || null, reqLimit, commentLimit, postOpts);
        pPosts.forEach(post => {
          post.pageName = p.name;
          const exIdx = allPosts.findIndex(x => x.id === post.id);
          if (exIdx >= 0) allPosts[exIdx] = post;
          else allPosts.unshift(post);
          fetchedCount++;
        });
      } catch (err) {
        errors.push(`${p.name}: ${err.message}`);
      }
    }

    store.write('posts_comments.json', allPosts);
    audit.log(session.user.username, 'posts_sync', `ดึงโพสต์ & คอมเมนต์ ${fetchedCount} โพสต์`, clientIp(req));
    if (errors.length > 0 && fetchedCount === 0) {
      return send(res, 500, { error: 'ดึงโพสต์ไม่สำเร็จ: ' + errors.join(' | ') });
    }
    return send(res, 200, { ok: true, count: fetchedCount, errors: errors.length ? errors : undefined });
  }

  if (route === 'GET /api/sla') {
    const range = resolveRange(q);
    const data = await providers.load(range, { ads: false });
    return send(res, 200, { mode: providers.currentMode(), ...sla.buildSla(data, providers.currentMode() === 'demo', range, Date.now(), { platform: q.platform, page: q.page }) });
  }

  if (route === 'GET /api/inbox') {
    const range = resolveRange(q);
    const data = await providers.load(range, { ads: false });
    const isDemo = providers.currentMode() === 'demo';
    const overlay = store.read('messages.json', {});
    const messagesMap = {};
    for (const l of data.leads) {
      messagesMap[l.id] = ops.messagesFor(l, data, isDemo, overlay);
    }
    const out = buildInbox(data, range, { platform: q.platform, page: q.page, messagesMap });
    for (const r of out.rows) {
      const msgs = messagesMap[r.id] || [];
      r.last = msgs.length ? msgs[msgs.length - 1] : null; // ข้อความล่าสุด ใช้แสดงในรายการแชท
    }
    out.rows.sort((a, b) => {
      const x = a.last ? a.last.at : a.date; const y = b.last ? b.last.at : b.date;
      return x === y ? 0 : x < y ? 1 : -1;
    });
    return send(res, 200, { mode: providers.currentMode(), ...out });
  }

  // Real-time Event Stream (Server-Sent Events) สำหรับส่งข้อความแชทใหม่เข้าหน้าเว็บทันที
  if (route === 'GET /api/inbox/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');
    const client = { res, userId: session.user.username };
    realtimeClients.add(client);
    req.on('close', () => {
      realtimeClients.delete(client);
    });
    return;
  }

  if (route === 'GET /api/inbox/chat') {
    const data = await providers.load(resolveRange({ range: 'all' }), { ads: false });
    const lead = data.leads.find((l) => l.id === q.id);
    if (!lead) return send(res, 404, { error: 'ไม่พบแชทนี้' });
    const isDemo = providers.currentMode() === 'demo';
    // โหมด Meta: ข้อความมาจาก Webhook หรือฟิลด์ messages ของลีด ถ้ายังไม่ได้ต่อจะว่าง
    const messages = ops.messagesFor(lead, data, isDemo);
    return send(res, 200, {
      demo: isDemo, lead: leadRow(data, lead), messages,
      review: ops.getReview(lead.id), followup: ops.getFollowup(lead.id),
    });
  }

  if (route === 'POST /api/inbox/reply') {
    const b = await readJson(req);
    const text = clean(b.text, 2000);
    if (!text) return send(res, 400, { error: 'กรุณาพิมพ์ข้อความ' });
    const data = await providers.load(resolveRange({ range: 'all' }), { ads: false });
    const lead = data.leads.find((l) => l.id === b.id);
    if (!lead) return send(res, 404, { error: 'ไม่พบแชทนี้' });
    const isDemo = providers.currentMode() === 'demo';
    const msgs = ops.messagesFor(lead, data, isDemo);
    let mid;
    if (!isDemo) {
      const lastCustomer = [...msgs].reverse().find((m) => m.from === 'customer');
      try { ({ mid } = await meta.sendMessage(lead, text, lastCustomer && lastCustomer.at)); }
      catch (e) {
        audit.log(session.user.username, 'reply_failed', `${lead.id} ${lead.name}: ${e.message}`, clientIp(req));
        return send(res, 502, { error: e.message });
      }
    }
    // ไม่ให้ข้อความใหม่มีเวลาก่อนข้อความล่าสุด (เช่นข้อมูลเดโมที่สร้างล่วงหน้า)
    const lastAt = msgs.length ? msgs[msgs.length - 1].at : '';
    const now = ops.nowStamp();
    const message = { from: 'staff', text, at: now < lastAt ? lastAt : now, by: session.user.username, ...(mid ? { mid } : {}) };
    ops.addMessage(lead.id, message);
    broadcastRealtime('chat_message', { leadId: lead.id, lead, message });
    audit.log(session.user.username, 'reply_sent', `${lead.id} ${lead.name} (${isDemo ? 'เดโม ไม่ได้ส่งจริง' : 'ส่งผ่าน Meta'}) ${text.length} ตัวอักษร`, clientIp(req));
    return send(res, 200, { ok: true, delivered: isDemo ? 'demo' : 'meta', message });
  }

  if (route === 'POST /api/lead/status') {
    const b = await readJson(req);
    if (ops.LEGACY_STATUS[b.status]) b.status = ops.LEGACY_STATUS[b.status];
    if (!ops.STATUSES.includes(b.status)) return send(res, 400, { error: 'สถานะไม่ถูกต้อง' });
    // หาในทุกช่วงเวลา (เดิมหาแค่ 90 วัน ทำให้แชทเก่าเปลี่ยนสถานะไม่ได้)
    const data = await providers.load(resolveRange({ range: 'all' }), { ads: false });
    const lead = data.leads.find((l) => l.id === b.id);
    if (!lead) return send(res, 404, { error: 'ไม่พบแชทนี้' });
    if (lead.status !== b.status) {
      const oldStatus = lead.status;
      ops.setStatus(lead.id, b.status);
      broadcastRealtime('lead_status', { id: lead.id, status: b.status, from: oldStatus, by: session.user.username });
      audit.log(session.user.username, 'status_change', `${lead.id} ${lead.name}: ${lead.status} → ${b.status}`, clientIp(req));
      
      // ส่งแจ้งเตือน LINE ทันทีเมื่อเปลี่ยนสถานะ
      try {
        const lineConf = line.getLineConfig();
        if (lineConf.enabled && lineConf.notifyOnStatusChange) {
          line.sendLineNotification(line.formatStatusChangeAlert(lead, oldStatus, b.status, session.user.username)).catch(() => {});
        }
      } catch (err) {
        console.warn('[LINE alert error]', err.message);
      }
    }
    return send(res, 200, { ok: true, status: b.status });
  }

  if (route === 'POST /api/lead/rep') {
    const b = await readJson(req);
    const repName = clean(b.rep, 100);
    const data = await providers.load(resolveRange({ range: 'all' }), { ads: false });
    const lead = data.leads.find((l) => l.id === b.id);
    if (!lead) return send(res, 404, { error: 'ไม่พบแชทนี้' });

    let leads = store.read('leads.json', []);
    let idx = leads.findIndex((l) => l.id === b.id);
    if (idx !== -1) {
      leads[idx].repId = repName;
      leads[idx].rep = repName;
      store.write('leads.json', leads);
    } else {
      leads.push({ ...lead, repId: repName, rep: repName });
      store.write('leads.json', leads);
    }

    broadcastRealtime('lead_rep', { id: b.id, rep: repName, by: session.user.username });
    audit.log(session.user.username, 'rep_assigned', `${lead.id} ${lead.name}: มอบหมายให้ ${repName || 'ยังไม่ระบุ'}`, clientIp(req));
    return send(res, 200, { ok: true, rep: repName });
  }

  if (route === 'GET /api/notifications') {
    const data = await providers.load(resolveRange({ range: '90d' }), { ads: false });
    const fuData = ops.buildFollowups(data, providers.currentMode() === 'demo', q);
    const rows = fuData.rows || [];
    const overdueList = rows.filter(r => r.overdue);
    const replyList = rows.filter(r => r.kind === 'reply');
    const chaseList = rows.filter(r => r.kind === 'chase');
    
    // จัดกลุ่มตาม Rep
    const repMap = {};
    for (const r of rows) {
      const rep = r.rep || 'Unassigned';
      if (!repMap[rep]) repMap[rep] = { rep, total: 0, overdue: 0, reply: 0, chase: 0, items: [] };
      repMap[rep].total++;
      if (r.overdue) repMap[rep].overdue++;
      if (r.kind === 'reply') repMap[rep].reply++;
      if (r.kind === 'chase') repMap[rep].chase++;
      if (repMap[rep].items.length < 5) repMap[rep].items.push({ id: r.id, name: r.name, kind: r.kind, overdue: r.overdue });
    }

    const storedNotifs = store.read('web_notifications.json', []);

    return send(res, 200, {
      total: overdueList.length + replyList.length + storedNotifs.filter(n => !n.read).length,
      counts: {
        overdue: overdueList.length,
        reply: replyList.length,
        chase: chaseList.length,
        scheduled: (fuData.counts && fuData.counts.scheduled) || 0,
        unreadWeb: storedNotifs.filter(n => !n.read).length,
      },
      webNotifications: storedNotifs.slice(0, 30),
      byRep: Object.values(repMap),
      recentAlerts: overdueList.slice(0, 10).map(r => ({
        id: r.id,
        name: r.name,
        rep: r.rep,
        dueDate: r.dueDate,
        note: r.note,
        type: 'overdue'
      }))
    });
  }

  if (route === 'POST /api/notifications/send') {
    const b = await readJson(req);
    const title = clean(b.title || 'แจ้งเตือนติดตามลูกค้า', 120);
    const message = clean(b.message || '', 500);
    const leadId = b.leadId ? String(b.leadId) : null;
    const leadName = b.leadName ? clean(b.leadName, 100) : null;
    const rep = b.rep ? clean(b.rep, 100) : null;
    const type = b.type || 'followup';

    if (!message) return send(res, 400, { error: 'กรุณากรอกข้อความแจ้งเตือน' });

    let notifs = store.read('web_notifications.json', []);
    const newNotif = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      message,
      leadId,
      leadName,
      rep,
      type,
      at: new Date().toISOString(),
      read: false,
      sender: session.user.username,
    };
    notifs.unshift(newNotif);
    if (notifs.length > 100) notifs = notifs.slice(0, 100);
    store.write('web_notifications.json', notifs);

    // ส่งเข้า LINE แจ้งเตือนด้วยหากเปิดใช้งาน
    try {
      const lineConf = line.getLineConfig();
      if (lineConf.enabled) {
        line.sendLineNotification(`\n📢 [แจ้งเตือนทีมงาน - หน้าตามลูกค้า]\n${title}\n${leadName ? `👤 ลูกค้า: ${leadName}\n` : ''}${rep ? `💼 เซลส์: ${rep}\n` : ''}💬 รายละเอียด: ${message}\n⏱️ ผู้ส่ง: ${session.user.username}`).catch(() => {});
      }
    } catch {}

    audit.log(session.user.username, 'web_notification_sent', `${title}: ${message.slice(0, 60)}`, clientIp(req));
    return send(res, 200, { ok: true, notification: newNotif, totalUnread: notifs.filter(n => !n.read).length });
  }

  if (route === 'POST /api/notifications/mark-read') {
    const b = await readJson(req);
    let notifs = store.read('web_notifications.json', []);
    if (b.all) {
      notifs.forEach(n => n.read = true);
    } else if (b.id) {
      const found = notifs.find(n => n.id === b.id);
      if (found) found.read = true;
    }
    store.write('web_notifications.json', notifs);
    return send(res, 200, { ok: true, unread: notifs.filter(n => !n.read).length });
  }

  if (route === 'POST /api/notifications/delete') {
    const b = await readJson(req);
    let notifs = store.read('web_notifications.json', []);
    if (b.all) {
      notifs = [];
    } else if (b.id) {
      notifs = notifs.filter(n => n.id !== b.id);
    }
    store.write('web_notifications.json', notifs);
    audit.log(session.user.username, 'web_notification_deleted', b.all ? 'ลบการแจ้งเตือนทั้งหมด' : `ลบแจ้งเตือน ${b.id}`, clientIp(req));
    return send(res, 200, { ok: true, total: notifs.length, unread: notifs.filter(n => !n.read).length });
  }

  if (route === 'GET /api/notifications/schedule') {
    const sched = store.read('notification_schedule.json', {
      enabled: false,
      intervalMinutes: 60, // เช่น 15, 30, 60, 120, 360, 1440
      lastRun: null,
      target: 'all', // 'all', 'reply', 'overdue'
    });
    return send(res, 200, sched);
  }

  if (route === 'POST /api/notifications/schedule') {
    const b = await readJson(req);
    const cur = store.read('notification_schedule.json', {
      enabled: false,
      intervalMinutes: 60,
      lastRun: null,
      target: 'all',
    });
    const intervalMinutes = Math.max(1, parseInt(b.intervalMinutes || cur.intervalMinutes || 60, 10));
    const updated = {
      enabled: Boolean(b.enabled),
      intervalMinutes,
      target: b.target || cur.target || 'all',
      lastRun: cur.lastRun || null,
      updatedAt: new Date().toISOString(),
      updatedBy: session.user.username,
    };
    store.write('notification_schedule.json', updated);
    audit.log(session.user.username, 'notification_schedule_updated', `enabled=${updated.enabled}, interval=${updated.intervalMinutes}m, target=${updated.target}`, clientIp(req));
    return send(res, 200, { ok: true, schedule: updated });
  }

  if (route === 'GET /api/settings/line-notify') {
    return send(res, 200, line.getLineConfig());
  }

  if (route === 'POST /api/settings/line-notify') {
    const b = await readJson(req);
    const saved = line.saveLineConfig(b);
    audit.log(session.user.username, 'line_notify_settings_saved', `enabled: ${saved.enabled}`, clientIp(req));
    return send(res, 200, { ok: true, config: saved });
  }

  if (route === 'POST /api/notifications/test-line') {
    const r = await line.sendLineNotification('🧪 ทดสอบการแจ้งเตือนจาก BEQ Ads Dashboard สำเร็จแล้ว!');
    return send(res, 200, r);
  }

  if (route === 'GET /api/followups') {
    const data = await providers.load(resolveRange({ range: '90d' }), { ads: false });
    return send(res, 200, { mode: providers.currentMode(), ...ops.buildFollowups(data, providers.currentMode() === 'demo', q) });
  }

  if (route === 'POST /api/followups') {
    const b = await readJson(req);
    if (!isDate(b.dueDate)) return send(res, 400, { error: 'วันที่นัดไม่ถูกต้อง' });
    const data = await providers.load(resolveRange({ range: '90d' }), { ads: false });
    const lead = data.leads.find((l) => String(l.id) === String(b.id));
    if (!lead) return send(res, 404, { error: 'ไม่พบแชทนี้' });
    const fu = ops.setFollowup(lead.id, { dueDate: b.dueDate, note: clean(b.note, 300) }, session.user.username);
    audit.log(session.user.username, 'followup_set', `${lead.id} ${lead.name}: นัด ${fu.dueDate}${fu.note ? ' — ' + fu.note : ''}`, clientIp(req));
    
    // แจ้งเตือน LINE หากตั้งนัดหมายติดตามลูกค้า
    try {
      const lineConf = line.getLineConfig();
      if (lineConf.enabled && lineConf.notifyOnOverdue) {
        line.sendLineNotification(`\n📅 [ตั้งนัดติดตามลูกค้า]\n👤 ลูกค้า: ${lead.name}\n💼 เซลส์: ${lead.repId || 'ยังไม่ระบุ'}\n📅 นัดตาม: ${fu.dueDate}\n📝 โน้ต: ${fu.note || 'ไม่มี'}`).catch(() => {});
      }
    } catch {}
    
    return send(res, 200, { ok: true, followup: fu });
  }

  if (route === 'POST /api/followups/done') {
    const b = await readJson(req);
    const fu = ops.doneFollowup(String(b.id || ''), session.user.username);
    if (!fu) return send(res, 404, { error: 'ไม่พบนัดตามลูกค้านี้' });
    audit.log(session.user.username, 'followup_done', `${b.id}`, clientIp(req));
    return send(res, 200, { ok: true, followup: fu });
  }

  if (route === 'GET /api/review') {
    const range = resolveRange(q);
    return send(res, 200, { mode: providers.currentMode(), ...ops.buildReview(await providers.load(range, { ads: false }), range, q) });
  }

  if (route === 'POST /api/review') {
    const b = await readJson(req);
    const data = await providers.load(resolveRange({ range: '90d' }), { ads: false });
    const lead = data.leads.find((l) => l.id === b.id);
    if (!lead) return send(res, 404, { error: 'ไม่พบแชทนี้' });
    const r = ops.saveReview(lead.id, b.scores, b.note, session.user.username);
    if (r.error) return send(res, 400, { error: r.error });
    audit.log(session.user.username, 'review_save', `${lead.id} ${lead.name}: ${r.review.score}%`, clientIp(req));
    return send(res, 200, { ok: true, review: r.review });
  }

  if (route === 'POST /api/upload/leads') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 25000) : [];
    if (!rows.length) return send(res, 400, { error: 'ไม่มีข้อมูลที่จะนำเข้า' });
    let existing = b.replace ? [] : store.read('leads.json', []);
    const CHANNELS = ['Messenger', 'LINE', 'Instagram', 'WhatsApp'];
    const added = []; const errors = [];
    const tdy = today();

    const uploadPlatform = clean(b.platform, 30);
    const uploadPageName = clean(b.pageName, 80);
    const knownPages = store.read('pages.json', []);
    let overlay = store.read('messages.json', {});
    let messagesChanged = false;

    function normalizeDate(d) {
      if (!d) return tdy;
      const s = String(d).trim();
      // YYYY-MM-DD
      const m1 = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (m1) {
        let y = parseInt(m1[1], 10);
        if (y > 2400) y -= 543; // ปี พ.ศ. -> ค.ศ.
        return `${y}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
      }
      // DD/MM/YYYY or MM/DD/YYYY
      const m2 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (m2) {
        let y = parseInt(m2[3], 10);
        if (y > 2400) y -= 543;
        let a = parseInt(m2[1], 10);
        let b = parseInt(m2[2], 10);
        let month = (a > 12) ? b : (b > 12 ? a : b);
        let day = (a > 12) ? a : (b > 12 ? b : a);
        month = Math.min(12, Math.max(1, month));
        day = Math.min(31, Math.max(1, day));
        return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      const parsed = Date.parse(s);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
      return tdy;
    }

    const normalizeStatus = (st, fallback = '') => ops.normalizeStatus(st, fallback);

    for (const [i, r] of rows.entries()) {
      let name = clean(r.name || r.fullname || r.fullName || r.full_name || r.customer, 100);
      if (!name) name = `ลูกค้า #${existing.length + added.length + 1}`;
      let channel = clean(r.channel, 30);
      if (!CHANNELS.includes(channel)) {
        const chLow = (channel || r.source || '').toLowerCase();
        if (chLow.includes('line')) channel = 'LINE';
        else if (chLow.includes('ig') || chLow.includes('instagram')) channel = 'Instagram';
        else if (chLow.includes('wa') || chLow.includes('whatsapp')) channel = 'WhatsApp';
        else channel = 'Messenger';
      }
      const adId = clean(r.adId || r.form || r.form_name || r.adid || r.ad_id || r.adName || r.ad_name || r.campaign || r.campaign_name || r.source, 80) || 'Direct';
      const date = normalizeDate(r.date || r.created);
      const rep = clean(reps.pick(r, reps.REP_KEYS), 40) || '';
      const staffReply = clean(reps.pick(r, reps.REPLY_KEYS), 2000);
      const dropReason = clean(r.dropReason || r.labels || r.reason || r.note, 100) || null;
      const status = normalizeStatus(r.status || r.stage || r.lead_status, dropReason || '');
      const value = Math.max(0, parseFloat(String(r.value || r.amount || r.price || 0).replace(/[^0-9.]/g, '')) || 0);
      const phone = clean(r.phone || r.phone_number || r.telephone, 40) || '';
      const email = clean(r.email || r.email_address, 80) || '';

      // ตรวจสอบแพลตฟอร์มอย่างแม่นยำ (Instagram, Facebook, LINE, WhatsApp)
      const rawRowPlat = clean(r.platform, 30);
      const rawRowPage = clean(r.pageName || r.page, 80);
      const rawRowChan = clean(r.channel || r.source, 30);
      const isIgRow = Boolean(
        (rawRowPlat && /ig|instagram/i.test(rawRowPlat)) ||
        (rawRowChan && /ig|instagram/i.test(rawRowChan)) ||
        (rawRowPage && /ig|instagram|dr\.nay_hairtransplant|beq_wellness/i.test(rawRowPage))
      );

      let platform = uploadPlatform || 'Facebook';
      if (isIgRow) {
        platform = 'Instagram';
      } else if (rawRowPlat) {
        if (/line/i.test(rawRowPlat)) platform = 'LINE';
        else if (/wa|whatsapp/i.test(rawRowPlat)) platform = 'WhatsApp';
        else if (/ig|instagram/i.test(rawRowPlat)) platform = 'Instagram';
        else if (/fb|facebook|messenger/i.test(rawRowPlat)) platform = 'Facebook';
      } else if (rawRowChan) {
        if (/line/i.test(rawRowChan)) platform = 'LINE';
        else if (/wa|whatsapp/i.test(rawRowChan)) platform = 'WhatsApp';
        else if (/ig|instagram/i.test(rawRowChan)) platform = 'Instagram';
        else if (/fb|facebook|messenger/i.test(rawRowChan)) platform = 'Facebook';
      }

      // ปรับ channel ให้ตรงกับแพลตฟอร์ม
      if (platform === 'Instagram') channel = 'Instagram';
      else if (platform === 'Facebook') channel = 'Messenger';
      else if (platform === 'LINE') channel = 'LINE';
      else if (platform === 'WhatsApp') channel = 'WhatsApp';

      // ค้นหา pageId และชื่อเพจจริงจาก pages.json ที่เชื่อมต่อกับ Meta (แยก Instagram และ Facebook ชัดเจน)
      let resolvedPageId = clean(r.pageId, 50);
      let pageName = rawRowPage;

      const checkStr = `${uploadPageName} ${rawRowPage} ${rawRowPlat} ${rawRowChan} ${r.pageId || ''} ${r.adId || ''} ${r.campaign || ''}`.toLowerCase();
      const isNayBrand = /nay|109373461849494|17841448814795762/.test(checkStr);
      const isBeqWellness = /wellness|111432947713900|17841401019079620/.test(checkStr) || (!isNayBrand && /beq/.test(checkStr));

      if (platform === 'Instagram') {
        if (isBeqWellness) {
          const igBeq = knownPages.find((p) => p.platform === 'Instagram' && (p.id === '17841401019079620' || p.name.includes('beq') || p.name.includes('wellness')));
          pageName = igBeq ? igBeq.name : 'beq_wellness';
          resolvedPageId = igBeq ? igBeq.id : '17841401019079620';
        } else {
          const igNay = knownPages.find((p) => p.platform === 'Instagram' && (p.id === '17841448814795762' || p.name.includes('nay')));
          pageName = igNay ? igNay.name : 'dr.nay_hairtransplant';
          resolvedPageId = igNay ? igNay.id : '17841448814795762';
        }
      } else if (platform === 'Facebook') {
        if (isNayBrand) {
          const fbNay = knownPages.find((p) => p.platform === 'Facebook' && (p.id === '109373461849494' || p.name.includes('Nay')));
          pageName = fbNay ? fbNay.name : 'Dr. Nay Hair Transplant by BEQ ปลูกผมถาวร';
          resolvedPageId = fbNay ? fbNay.id : '109373461849494';
        } else if (isBeqWellness) {
          const fbWel = knownPages.find((p) => p.platform === 'Facebook' && (p.id === '111432947713900' || p.name.includes('Wellness') || p.name.includes('Beq')));
          pageName = fbWel ? fbWel.name : 'Beq Hair Wellness Center';
          resolvedPageId = fbWel ? fbWel.id : '111432947713900';
        } else {
          const fbPav = knownPages.find((p) => p.platform === 'Facebook' && (p.id === '239105462619075' || p.name.includes('Pavicon')));
          pageName = fbPav ? fbPav.name : (uploadPageName || rawRowPage || 'Pavicon Hair Clinic คลินิกปลูกผมมาตรฐานสากล');
          resolvedPageId = fbPav ? fbPav.id : '239105462619075';
        }
      } else if (platform === 'LINE') {
        pageName = rawRowPage || uploadPageName || 'LINE Official Account';
        resolvedPageId = 'P-LINE';
      } else if (platform === 'WhatsApp') {
        pageName = rawRowPage || uploadPageName || 'WhatsApp Business';
        resolvedPageId = 'P-WhatsApp';
      }
      const pageId = resolvedPageId || clean(r.pageId, 50) || `PAGE-${pageName.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}`;
      recordPage(pageId, pageName, platform);

      // ตรวจสอบว่ามี lead เดิมในระบบจากเพจและแพลตฟอร์มเดียวกันหรือไม่ (แยก Facebook และ Instagram เด็ดขาด)
      const cleanName = name.trim().toLowerCase();
      const existingMatch = existing.find((ex) => {
        const exPlat = ex.platform || (ex.channel === 'Instagram' ? 'Instagram' : ex.channel === 'LINE' ? 'LINE' : ex.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook');
        if (exPlat !== platform) return false;
        const samePage = ex.pageId === pageId || String(ex.pageId) === String(pageId) || (ex.pageName && pageName && ex.pageName.trim().toLowerCase() === pageName.trim().toLowerCase());
        if (!samePage) return false;
        const isGenericName = !cleanName || cleanName.startsWith('ลูกค้า') || cleanName.startsWith('customer') || cleanName.startsWith('user');
        if (!isGenericName && ex.name && ex.name.trim().toLowerCase() === cleanName) return true;
        if (phone && ex.phone && ex.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) return true;
        return false;
      });

      let targetLead = existingMatch;
      if (existingMatch) {
        // อัปเดตข้อมูลให้กับ lead เดิมในเพจและแพลตฟอร์มนี้
        if (adId && adId !== 'Direct') existingMatch.adId = adId;
        if (rep) existingMatch.repId = rep;
        if (status) {
          existingMatch.status = status;
          existingMatch.quality = ops.QUALITY[status] || existingMatch.quality;
        }
        if (value > 0) existingMatch.value = value;
        if (dropReason) existingMatch.dropReason = dropReason;
        if (phone) existingMatch.phone = phone;
        if (email) existingMatch.email = email;
        existingMatch.pageName = pageName;
        existingMatch.platform = platform;
        existingMatch.channel = channel;
        added.push(existingMatch);
      } else {
        const id = `U-${Date.now().toString(36)}-${String(i).padStart(4, '0')}`;
        const lead = {
          id, name, channel, adId, date,
          platform, pageName, pageId,
          repId: rep,
          status, quality: ops.QUALITY[status] || 'average', value, firstResponseMin: null, dropReason,
          phone, email,
        };
        existing.push(lead);
        added.push(lead);
        targetLead = lead;
      }

      // หากมีข้อความในแถวข้อมูล ให้นำเข้าและบันทึกใน messages.json โดยแยกตาม lead.id, แพลตฟอร์ม และเพจ
      const rawMsg = clean(r.message || r.messages || r.chat || r.conversation || r.conversations || r.last_message || r.text || r.details || r.detail || r.description || r.inquiry || r.comment || r.comments || r.note || r.notes || r.remark || r.remarks, 2000);
      if (rawMsg && targetLead) {
        const msgList = overlay[targetLead.id] || (overlay[targetLead.id] = []);
        if (!msgList.some((m) => m.text === rawMsg)) {
          msgList.push({
            from: 'customer',
            text: rawMsg,
            at: `${date} 10:00:00`,
            via: 'upload',
            platform: targetLead.platform,
            pageName: targetLead.pageName,
          });
          messagesChanged = true;
        }
      }
      // ข้อความที่เซลล์ตอบ (ถ้าไฟล์มีคอลัมน์คำตอบ) → บันทึกเป็นข้อความฝั่งทีมขาย พร้อมชื่อเซลล์
      if (staffReply && targetLead) {
        const msgList = overlay[targetLead.id] || (overlay[targetLead.id] = []);
        if (!msgList.some((m) => m.from === 'staff' && m.text === staffReply)) {
          msgList.push({
            from: 'staff', text: staffReply, at: `${date} 10:05:00`, via: 'upload',
            ...(rep ? { by: rep } : {}), platform: targetLead.platform, pageName: targetLead.pageName,
          });
          messagesChanged = true;
        }
      }
    }
    if (added.length || b.replace) store.write('leads.json', existing);
    if (messagesChanged) store.write('messages.json', overlay);
    audit.log(session.user.username, 'leads_upload', `นำเข้า ${added.length} leads (เพจ: ${uploadPageName || 'ตามไฟล์'}, แพลตฟอร์ม: ${uploadPlatform || 'ตามไฟล์'})${b.replace ? ' (แทนที่ชุดเดิม)' : ''}`, clientIp(req));
    return send(res, 200, { ok: true, added: added.length, errors });
  }

  if (route === 'GET /api/upload/history') {
    const logs = (store.read('audit.json', [])).filter((l) => l.action === 'leads_upload' || l.action === 'campaigns_upload').slice(-20).reverse();
    const history = logs.map((l) => ({
      at: l.at,
      user: l.user,
      action: l.action,
      count: parseInt((l.detail || '0').match(/\d+/)?.[0] || '0', 10),
    }));
    return send(res, 200, { history });
  }

  if (route === 'POST /api/upload/campaigns') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 25000) : [];
    if (!rows.length) return send(res, 400, { error: 'ไม่มีข้อมูลที่จะนำเข้า' });

    let existingData = b.replace ? { ads: [], daily: [], campaigns: [] } : store.read('campaigns_data.json', { ads: [], daily: [], campaigns: [] });
    if (!Array.isArray(existingData.daily)) existingData.daily = [];
    if (!Array.isArray(existingData.ads)) existingData.ads = [];
    if (!Array.isArray(existingData.campaigns)) existingData.campaigns = [];

    const campMap = new Map((existingData.campaigns || []).map((c) => [c.id, c]));
    const adMap = new Map((existingData.ads || []).map((a) => [a.id, a]));
    const tdy = today();

    const uploadPlatform = clean(b.platform, 30) || 'Facebook';
    const uploadPageName = clean(b.pageName, 80) || 'Pavicon Hair Clinic คลินิกปลูกผมมาตรฐานสากล';
    const uploadPageId = clean(b.pageId, 40) || `P_${uploadPageName.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}`;
    recordPage(uploadPageId, uploadPageName, uploadPlatform);

    function normalizeDate(d) {
      if (!d) return tdy;
      const s = String(d).trim();
      const m1 = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (m1) {
        let y = parseInt(m1[1], 10);
        if (y > 2400) y -= 543;
        return `${y}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
      }
      const m2 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (m2) {
        let y = parseInt(m2[3], 10);
        if (y > 2400) y -= 543;
        let a = parseInt(m2[1], 10);
        let b = parseInt(m2[2], 10);
        let month = (a > 12) ? b : (b > 12 ? a : b);
        let day = (a > 12) ? a : (b > 12 ? b : a);
        month = Math.min(12, Math.max(1, month));
        day = Math.min(31, Math.max(1, day));
        return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      const parsed = Date.parse(s);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
      return tdy;
    }

    let addedRows = 0;
    for (const r of rows) {
      const campName = clean(r.campaign || r.campaign_name || r.campaignName || r.adset || r.adName || r.ad_name, 100) || 'General Campaign';
      const campId = clean(r.campaignId || r.campaign_id, 50) || `C-${campName.slice(0, 20).replace(/\s+/g, '_')}`;
      const status = clean(r.status || r.effective_status || r.delivery || r['สถานะ'], 30) || 'ACTIVE';
      const objective = clean(r.objective || r.campaign_objective || r['วัตถุประสงค์'], 60) || 'OUTCOME_ENGAGEMENT';
      const dailyBudget = parseFloat(String(r.dailyBudget || r.daily_budget || r['งบต่อวัน'] || 0).replace(/[^0-9.]/g, '')) || null;
      const lifetimeBudget = parseFloat(String(r.lifetimeBudget || r.lifetime_budget || r['งบตลอดอายุ'] || 0).replace(/[^0-9.]/g, '')) || null;
      if (!campMap.has(campId)) {
        campMap.set(campId, { id: campId, name: campName, status, objective, dailyBudget, lifetimeBudget });
      }

      const adName = clean(r.adName || r.ad_name || r.name || r.ad, 100) || campName;
      const adId = clean(r.adId || r.ad_id || r.id, 50) || adName;
      const adset = clean(r.adset || r.adset_name || r.adsetName, 100) || '';
      const rawThumb = clean(r.thumb || r.thumbnail_url || r.image_url || r.image || r['รูปภาพ'] || r['ลิงก์รูป'], 1000) || null;
      const rawVideo = clean(r.videoUrl || r.video_url || r.video || r['วิดีโอ'] || r['ลิงก์วิดีโอ'], 1000) || null;
      const creative = clean(r.creative || r.creative_type, 20) || (rawVideo ? 'VIDEO' : 'IMAGE');
      const headline = clean(r.headline || r.title || r['พาดหัว'], 200) || adName;
      const body = clean(r.body || r.ad_copy || r.caption || r.message || r['ข้อความโฆษณา'], 1000) || '';
      const cta = clean(r.cta || r.call_to_action || r.call_to_action_type || r['ปุ่มกระตุ้น'], 50) || 'SEND_MESSAGE';
      const targetingSummary = clean(r.targeting || r.targetingSummary || r['กลุ่มเป้าหมาย'], 200) || adset;
      const placement = clean(r.placement || r.placements || r['ตำแหน่งการจัดวาง'], 150) || 'Facebook & Instagram';
      const optimizationGoal = clean(r.optimizationGoal || r.optimization_goal || r['เป้าหมายการนำส่ง'], 60) || 'CONVERSATIONS';

      const pageName = clean(r.pageName || r.page, 80) || uploadPageName;
      const platform = clean(r.platform, 30) || uploadPlatform;
      const pageId = clean(r.pageId, 50) || (pageName === uploadPageName ? uploadPageId : `P_${pageName.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}`);
      if (pageName !== uploadPageName) recordPage(pageId, pageName, platform);

      if (!adMap.has(adId)) {
        adMap.set(adId, {
          id: adId,
          name: adName,
          status,
          campaignId: campId,
          objective,
          adset,
          optimizationGoal,
          dailyBudget,
          lifetimeBudget,
          targetingSummary,
          placement,
          pageId,
          pageName,
          platform,
          agencyId: clean(r.agency || r.agencyId, 60) || 'In-house',
          creative,
          thumb: rawThumb,
          videoUrl: rawVideo,
          headline,
          body,
          cta,
        });
      } else {
        const existingAd = adMap.get(adId);
        if (pageId && (!existingAd.pageId || existingAd.pageId === 'P1')) existingAd.pageId = pageId;
        if (pageName && (!existingAd.pageName || existingAd.pageName.includes('เพจหลัก'))) existingAd.pageName = pageName;
        if (platform && !existingAd.platform) existingAd.platform = platform;
        if (rawThumb && !existingAd.thumb) existingAd.thumb = rawThumb;
        if (rawVideo && !existingAd.videoUrl) { existingAd.videoUrl = rawVideo; existingAd.creative = 'VIDEO'; }
        if (body && !existingAd.body) existingAd.body = body;
        if (headline && !existingAd.headline) existingAd.headline = headline;
      }

      const spend = Math.max(0, parseFloat(String(r.spend || r.amount_spent || 0).replace(/[^0-9.]/g, '')) || 0);
      const impressions = Math.max(0, parseInt(String(r.impressions || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const reach = Math.max(0, parseInt(String(r.reach || 0).replace(/[^0-9]/g, ''), 10) || Math.round(impressions * 0.7));
      const clicks = Math.max(0, parseInt(String(r.clicks || r.clicks_all || r.link_clicks || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const linkClicks = Math.max(0, parseInt(String(r.linkClicks || r.link_clicks || r.inline_link_clicks || 0).replace(/[^0-9]/g, ''), 10) || Math.round(clicks * 0.75));
      const messages = Math.max(0, parseInt(String(r.messages || r.messaging_conversations || r.results || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const purchases = Math.max(0, parseInt(String(r.purchases || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const purchaseValue = Math.max(0, parseFloat(String(r.purchaseValue || r.purchase_value || r.revenue || 0).replace(/[^0-9.]/g, '')) || 0);
      const postEngagement = Math.max(0, parseInt(String(r.postEngagement || r.post_engagement || r.engagement || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const reactions = Math.max(0, parseInt(String(r.reactions || r.post_reactions || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const comments = Math.max(0, parseInt(String(r.comments || r.post_comments || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const shares = Math.max(0, parseInt(String(r.shares || r.post_shares || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const videoPlays = Math.max(0, parseInt(String(r.videoPlays || r.video_views || r.video_plays || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const videoThruPlays = Math.max(0, parseInt(String(r.videoThruPlays || r.thruplays || r.thruplay || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const videoP100 = Math.max(0, parseInt(String(r.videoP100 || r.video_p100 || 0).replace(/[^0-9]/g, ''), 10) || 0);

      const rawDateStart = r.date || r.reporting_starts || r.reportingStarts || r.day;
      const rawDateEnd = r.dateEnd || r.reporting_ends || r.reportingEnds || rawDateStart;
      const startDate = normalizeDate(rawDateStart);
      const endDate = normalizeDate(rawDateEnd);

      // ตรวจสอบว่ามีข้อมูลตัวเลขอย่างน้อยหนึ่งตัว
      if (!spend && !impressions && !clicks && !messages && !reach) continue;

      let dateList = [startDate];
      if (startDate && endDate && startDate < endDate) {
        dateList = eachDay(startDate, endDate);
      }
      const daysCount = Math.max(1, dateList.length);
      const daySpend = Math.round((spend / daysCount) * 100) / 100;
      const dayImpressions = Math.round(impressions / daysCount);
      const dayReach = Math.round(reach / daysCount);
      const dayClicks = Math.round(clicks / daysCount);
      const dayLinkClicks = Math.round(linkClicks / daysCount);
      const dayMessages = Math.round(messages / daysCount);
      const dayPurchases = Math.round(purchases / daysCount);
      const dayPurchaseValue = Math.round((purchaseValue / daysCount) * 100) / 100;
      const dayPostEngagement = Math.round(postEngagement / daysCount);
      const dayReactions = Math.round(reactions / daysCount);
      const dayComments = Math.round(comments / daysCount);
      const dayShares = Math.round(shares / daysCount);
      const dayVideoPlays = Math.round(videoPlays / daysCount);
      const dayVideoThruPlays = Math.round(videoThruPlays / daysCount);
      const dayVideoP100 = Math.round(videoP100 / daysCount);

      for (const d of dateList) {
        existingData.daily.push({
          date: d,
          adId,
          spend: daySpend,
          impressions: dayImpressions,
          reach: dayReach,
          clicks: dayClicks,
          linkClicks: dayLinkClicks,
          messages: dayMessages,
          purchases: dayPurchases,
          purchaseValue: dayPurchaseValue,
          postEngagement: dayPostEngagement,
          reactions: dayReactions,
          comments: dayComments,
          shares: dayShares,
          videoPlays: dayVideoPlays,
          videoThruPlays: dayVideoThruPlays,
          videoP100: dayVideoP100,
        });
      }
      addedRows++;
    }

    existingData.campaigns = [...campMap.values()];
    existingData.ads = [...adMap.values()];
    store.write('campaigns_data.json', existingData);
    audit.log(session.user.username, 'campaigns_upload', `นำเข้าข้อมูลโฆษณา ${addedRows} แถว (เพจ: ${uploadPageName}, แพลตฟอร์ม: ${uploadPlatform})${b.replace ? ' (แทนที่ชุดเดิม)' : ''}`, clientIp(req));
    return send(res, 200, { ok: true, added: addedRows, campaigns: existingData.campaigns.length, ads: existingData.ads.length });
  }

  if (route === 'GET /api/data/summary') {
    const leads = store.read('leads.json', []);
    const campData = store.read('campaigns_data.json', { ads: [], daily: [], campaigns: [] });
    const totalSpend = (campData.daily || []).reduce((sum, d) => sum + (d.spend || 0), 0);
    return send(res, 200, {
      leadsCount: leads.length,
      adsCount: (campData.ads || []).length,
      campaignsCount: (campData.campaigns || []).length,
      dailyRecordsCount: (campData.daily || []).length,
      totalSpend: Math.round(totalSpend * 100) / 100,
    });
  }

  if (route === 'POST /api/data/clear') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const target = b.target || 'leads';
    if (target === 'leads' || target === 'all') {
      store.write('leads.json', []);
      store.write('leadmeta.json', {});
      audit.log(session.user.username, 'data_clear', 'ล้างข้อมูล Leads ทั้งหมด', clientIp(req));
    }
    if (target === 'campaigns' || target === 'all') {
      store.write('campaigns_data.json', { ads: [], daily: [], campaigns: [] });
      audit.log(session.user.username, 'data_clear', 'ล้างข้อมูล Ads & Campaigns ทั้งหมด', clientIp(req));
    }
    return send(res, 200, { ok: true, target });
  }

  if (route === 'GET /api/export/leads') {
    const leads = store.read('leads.json', []);
    const csvRows = [
      ['ID', 'ชื่อลูกค้า', 'ช่องทาง', 'แพลตฟอร์ม', 'เพจ', 'โฆษณา/แคมเปญ', 'วันที่', 'สถานะ', 'คุณภาพ', 'มูลค่า (บาท)', 'เบอร์โทร', 'อีเมล', 'เซลส์ผู้ดูแล', 'เหตุผล/หมายเหตุ'].join(','),
      ...leads.map((l) => [
        `"${(l.id || '').replace(/"/g, '""')}"`,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.channel || '').replace(/"/g, '""')}"`,
        `"${(l.platform || l.channel || '').replace(/"/g, '""')}"`,
        `"${(l.pageName || '').replace(/"/g, '""')}"`,
        `"${(l.adId || '').replace(/"/g, '""')}"`,
        `"${(l.date || '').replace(/"/g, '""')}"`,
        `"${(l.status || '').replace(/"/g, '""')}"`,
        `"${(l.quality || '').replace(/"/g, '""')}"`,
        l.value || 0,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.repId || '').replace(/"/g, '""')}"`,
        `"${(l.dropReason || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    audit.log(session.user.username, 'export_leads', `ส่งออก Leads ${leads.length} รายการเป็น CSV`, clientIp(req));
    return send(res, 200, '\ufeff' + csvRows.join('\r\n'), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads_export.csv"',
    });
  }

  if (route === 'GET /api/export/campaigns') {
    const campData = store.read('campaigns_data.json', { ads: [], daily: [], campaigns: [] });
    const adMap = new Map((campData.ads || []).map((a) => [a.id, a]));
    const campMap = new Map((campData.campaigns || []).map((c) => [c.id, c.name]));
    const csvRows = [
      ['วันที่', 'แคมเปญ', 'ชื่อโฆษณา', 'รหัสโฆษณา', 'เพจ', 'แพลตฟอร์ม', 'งบที่ใช้ (บาท)', 'การแสดงผล (Impressions)', 'การเข้าถึง (Reach)', 'คลิก', 'ข้อความ/ผลลัพธ์', 'การซื้อ'].join(','),
      ...(campData.daily || []).map((d) => {
        const ad = adMap.get(d.adId) || {};
        const cName = campMap.get(ad.campaignId) || ad.campaignId || '';
        return [
          `"${(d.date || '').replace(/"/g, '""')}"`,
          `"${cName.replace(/"/g, '""')}"`,
          `"${(ad.name || d.adId || '').replace(/"/g, '""')}"`,
          `"${(d.adId || '').replace(/"/g, '""')}"`,
          `"${(ad.pageName || '').replace(/"/g, '""')}"`,
          `"${(ad.platform || 'Facebook').replace(/"/g, '""')}"`,
          d.spend || 0,
          d.impressions || 0,
          d.reach || 0,
          d.clicks || 0,
          d.messages || 0,
          d.purchases || 0,
        ].join(',');
      }),
    ];
    audit.log(session.user.username, 'export_campaigns', `ส่งออกข้อมูลโฆษณา ${(campData.daily || []).length} แถวเป็น CSV`, clientIp(req));
    return send(res, 200, '\ufeff' + csvRows.join('\r\n'), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="campaigns_export.csv"',
    });
  }

  if (route === 'GET /api/export/backup') {
    const backup = {
      exportedAt: new Date().toISOString(),
      leads: store.read('leads.json', []),
      campaignsData: store.read('campaigns_data.json', { ads: [], daily: [], campaigns: [] }),
      pages: store.read('pages.json', []),
      messages: store.read('messages.json', {}),
      reviews: store.read('reviews.json', {}),
      followups: store.read('followups.json', {}),
    };
    audit.log(session.user.username, 'export_backup', 'ดาวน์โหลด Full JSON Backup', clientIp(req));
    return send(res, 200, JSON.stringify(backup, null, 2), {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="beq_backup_${today()}.json"`,
    });
  }

  if (route === 'POST /api/upload/sheets-sync') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    let sheetUrl = String(b.sheetUrl || '').trim();
    if (!sheetUrl) return send(res, 400, { error: 'กรุณากรอกลิงก์ Google Sheets' });

    let csvUrl = sheetUrl;
    if (csvUrl.includes('/pubhtml')) {
      csvUrl = csvUrl.replace('/pubhtml', '/pub?output=csv');
    } else {
      const match = csvUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const docId = match[1];
        let gid = '0';
        const gidMatch = csvUrl.match(/[#&?]gid=([0-9]+)/);
        if (gidMatch) gid = gidMatch[1];
        csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
      }
    }

    try {
      const csvText = await fetchUrl(csvUrl);
      if (!csvText || !csvText.trim()) return send(res, 400, { error: 'ไม่พบเนื้อหาใน Google Sheet นี้ หรือ Sheet ไม่ได้เปิดสิทธิ์สาธารณะ (Anyone with the link)' });

      meta.saveSettings({ sheets: { lastUrl: sheetUrl, lastSyncAt: new Date().toISOString() } });
      audit.log(session.user.username, 'sheets_sync', `ดึงข้อมูลจาก Google Sheet สำเร็จ (${csvText.length} ไบต์)`, clientIp(req));
      return send(res, 200, { ok: true, csvText });
    } catch (err) {
      return send(res, 502, { error: `ดึง Google Sheet ไม่สำเร็จ: ${err.message}. ตรวจสอบว่าแชร์เป็น "Anyone with the link" หรือกด Publish to web แล้วหรือไม่` });
    }
  }

  // LINE OA หลายบัญชี: ส่ง id มาด้วย = แก้บัญชีเดิม, ไม่ส่ง = เพิ่มบัญชีใหม่
  // TikTok (โฆษณา / แชท) และ WeChat — หลายบัญชี: /api/settings/ext/<kind>[/test|/delete]
  {
    const em = /^(PUT|POST) \/api\/settings\/ext\/(tiktokAds|tiktokMsg|wechat)(\/test|\/delete)?$/.exec(route);
    if (em) {
      if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
      const [, method, kind, action] = em;
      const b = await readJson(req);
      const K = ext.KINDS[kind];
      if (method === 'PUT' && !action) {
        let acc;
        try { acc = ext.upsert(kind, { ...b, id: clean(b.id, 60) || null }); } catch (e) { return send(res, e.status || 400, { error: e.message }); }
        if (kind !== 'tiktokAds') recordPage(acc.id, acc.name, K.platform);
        audit.log(session.user.username, `${kind}_settings_save`, `ตั้งค่า ${K.platform}: ${acc.name}`, clientIp(req));
        return send(res, 200, { ...publicSettings(), savedId: acc.id });
      }
      if (method === 'POST' && action === '/delete') {
        ext.remove(kind, clean(b.id, 60));
        audit.log(session.user.username, `${kind}_settings_delete`, `ลบ ${K.platform}: ${b.id}`, clientIp(req));
        return send(res, 200, publicSettings());
      }
      if (method === 'POST' && action === '/test') {
        const acc = ext.byId(kind, clean(b.id, 60));
        if (!acc) return send(res, 200, { ok: false, error: 'ไม่พบบัญชีนี้ — กดบันทึกก่อน' });
        try {
          let info = '';
          if (kind === 'wechat') {
            await ext.wechatAccessToken(acc, true);
            info = 'ขอ access_token สำเร็จ';
          } else if (kind === 'tiktokAds') {
            const r = await ext.tiktokAdsTest(acc);
            info = [r.name, r.currency].filter(Boolean).join(' · ');
            if (r.name && (!acc.name || acc.name === 'TikTok Ads')) ext.update(kind, acc.id, { name: r.name });
          } else {
            return send(res, 200, { ok: false, error: 'บันทึกค่าไว้แล้ว — การรับ/ตอบแชท TikTok จะเปิดใช้เมื่อแอปได้อนุมัติ Business Messaging API' });
          }
          ext.update(kind, acc.id, { connectedAt: new Date().toISOString(), info });
          audit.log(session.user.username, `${kind}_test`, `เชื่อมต่อ ${K.platform} สำเร็จ: ${acc.name}`, clientIp(req));
          return send(res, 200, { ok: true, info, settings: publicSettings() });
        } catch (e) {
          return send(res, 200, { ok: false, error: e.message });
        }
      }
      return send(res, 404, { error: 'Not found' });
    }
  }

  if (route === 'PUT /api/settings/line') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    if (!clean(b.id, 60) && !clean(b.channelSecret, 100) && !clean(b.channelAccessToken, 1000)) return send(res, 400, { error: 'กรุณาใส่ Channel Secret และ Channel Access Token ของ LINE OA ที่จะเพิ่ม' });
    const acc = channels.upsertLine({ id: clean(b.id, 60) || null, name: b.name, channelId: b.channelId, channelSecret: clean(b.channelSecret, 100), channelAccessToken: clean(b.channelAccessToken, 1000) });
    recordPage(acc.id, acc.name || 'LINE Official Account', 'LINE');
    audit.log(session.user.username, 'line_settings_save', `ตั้งค่า LINE OA: ${acc.name || acc.id}`, clientIp(req));
    return send(res, 200, { ...publicSettings(), savedId: acc.id });
  }
  if (route === 'POST /api/settings/line/delete') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    channels.removeLine(clean(b.id, 60));
    audit.log(session.user.username, 'line_settings_delete', `ลบ LINE OA: ${b.id}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'POST /api/settings/line/test') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const acc = channels.lineAccountById(clean(b.id, 60));
    const token = (acc && acc.channelAccessToken) || '';
    if (!acc || !token) return send(res, 200, { ok: false, error: 'กรุณาบันทึก Channel Access Token (long-lived) ของบัญชีนี้ก่อนกดทดสอบ' });
    try {
      const r = await fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const info = await r.json().catch(() => ({}));
      if (!r.ok) return send(res, 200, { ok: false, error: info.message || `LINE API ตอบกลับสถานะ HTTP ${r.status}` });
      const botName = info.displayName || 'LINE Official Account';
      const basicId = info.basicId || '';
      const name = acc.name && acc.name !== 'LINE Official Account' ? acc.name : `${botName}${basicId ? ' (' + basicId + ')' : ''}`;
      if (!acc.fromEnv) channels.updateLine(acc.id, { botName, basicId, botUserId: info.userId || acc.botUserId || '', name, connectedAt: new Date().toISOString() });
      recordPage(acc.id, name, 'LINE');
      audit.log(session.user.username, 'line_test', `เชื่อมต่อ LINE OA สำเร็จ: ${botName} (${basicId})`, clientIp(req));
      return send(res, 200, { ok: true, bot: { displayName: botName, basicId, userId: info.userId }, settings: publicSettings() });
    } catch (e) {
      return send(res, 200, { ok: false, error: e.message || 'ไม่สามารถเชื่อมต่อ LINE Messaging API ได้' });
    }
  }

  // WhatsApp หลายเบอร์: ส่ง id มาด้วย = แก้เบอร์เดิม, ไม่ส่ง = เพิ่มเบอร์ใหม่ (Token เว้นว่างได้ = ใช้ Token ของ Meta)
  if (route === 'PUT /api/settings/whatsapp') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    if (!clean(b.id, 60) && !clean(b.phoneId, 50)) return send(res, 400, { error: 'กรุณาใส่ Phone Number ID ของเบอร์ WhatsApp ที่จะเพิ่ม' });
    const acc = channels.upsertWa({ id: clean(b.id, 60) || null, name: b.name, wabaId: b.wabaId, phoneId: b.phoneId, accessToken: clean(b.accessToken, 1000) });
    recordPage(acc.id, acc.name || 'WhatsApp Business', 'WhatsApp');
    audit.log(session.user.username, 'whatsapp_settings_save', `ตั้งค่า WhatsApp: ${acc.name || acc.phoneId || acc.id}`, clientIp(req));
    return send(res, 200, { ...publicSettings(), savedId: acc.id });
  }
  if (route === 'POST /api/settings/whatsapp/delete') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    channels.removeWa(clean(b.id, 60));
    audit.log(session.user.username, 'whatsapp_settings_delete', `ลบ WhatsApp: ${b.id}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'POST /api/settings/whatsapp/test') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const s = meta.getSettings();
    const m = s.meta || {};
    const acc = channels.waAccountById(clean(b.id, 60));
    const token = (acc && acc.accessToken) || m.accessToken || '';
    const phoneId = (acc && acc.phoneId) || '';
    if (!phoneId) return send(res, 200, { ok: false, error: 'กรุณาระบุ Phone Number ID ก่อนกดทดสอบ' });
    if (!token) return send(res, 200, { ok: false, error: 'กรุณาระบุ Permanent Access Token ก่อนกดทดสอบ' });
    try {
      const version = m.apiVersion || config.metaApiVersion;
      const info = await meta.graph(phoneId, { fields: 'id,display_phone_number,verified_name,quality_rating' }, token, version);
      const verifiedName = info.verified_name || 'WhatsApp Business';
      const displayPhone = info.display_phone_number || phoneId;
      const name = acc.name && !/^WhatsApp( Business| \+?\d)/.test(acc.name) ? acc.name : `${verifiedName} (${displayPhone})`;
      channels.updateWa(acc.id, { verifiedName, displayPhone, name, connectedAt: new Date().toISOString() });
      recordPage(acc.id, name, 'WhatsApp');
      audit.log(session.user.username, 'whatsapp_test', `เชื่อมต่อ WhatsApp สำเร็จ: ${verifiedName} (${displayPhone})`, clientIp(req));
      return send(res, 200, { ok: true, phone: { verifiedName, displayPhone, qualityRating: info.quality_rating }, settings: publicSettings() });
    } catch (e) {
      return send(res, 200, { ok: false, error: e.message || 'ไม่สามารถเชื่อมต่อ WhatsApp Cloud API ได้' });
    }
  }

  if (route === 'PUT /api/settings/sheets') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const cur = (meta.getSettings().sheets) || {};
    const next = {
      ...cur,
      lastUrl: clean(b.sheetUrl !== undefined ? b.sheetUrl : cur.lastUrl, 1000),
      appsScriptUrl: clean(b.appsScriptUrl !== undefined ? b.appsScriptUrl : cur.appsScriptUrl, 1000),
      autoSync: b.autoSync !== undefined ? Boolean(b.autoSync) : true,
    };
    meta.saveSettings({ sheets: next });
    audit.log(session.user.username, 'sheets_settings_save', `ตั้งค่า Google Sheets: ${next.lastUrl ? 'บันทึก URL แล้ว' : '—'}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'PUT /api/settings/supabase') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const cur = (meta.getSettings().supabase) || {};
    const nextUrl = clean(b.url !== undefined ? b.url : cur.url, 500).replace(/\/+$/, '');
    const nextKey = clean(b.key, 2000) || cur.key || '';
    meta.saveSettings({ supabase: { url: nextUrl, key: nextKey, updatedAt: new Date().toISOString() } });
    audit.log(session.user.username, 'supabase_settings_save', `ตั้งค่า Supabase URL: ${nextUrl || '—'}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'GET /api/audit') {
    return send(res, 200, audit.query({ ...q, limit: Math.min(Number(q.limit) || 100, 500), offset: Math.max(Number(q.offset) || 0, 0) }));
  }

  if (route === 'GET /api/audit/export') {
    const out = audit.query({ ...q, limit: 5000, offset: 0 });
    return send(res, 200, audit.toCsv(out.rows), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="audit-log.csv"' });
  }

  if (route === 'GET /api/settings') return send(res, 200, publicSettings());

  if (route === 'GET /api/settings/pages') {
    return send(res, 200, { pages: store.read('pages.json', []) });
  }

  if (route === 'POST /api/settings/pages') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const id = clean(b.id, 80);
    const name = clean(b.name, 120);
    const platform = clean(b.platform, 40) || 'Facebook';
    const color = clean(b.color, 20) || (platform === 'Instagram' ? '#e1306c' : '#1877f2');
    const adAccountId = clean(b.adAccountId, 80) || '';
    const fbPageId = clean(b.fbPageId, 80) || '';
    const pageToken = clean(b.pageToken, 500) || '';
    if (!id || !name) return send(res, 400, { error: 'กรุณากรอก Page ID และชื่อเพจ' });

    let pages = store.read('pages.json', []);
    const idx = pages.findIndex((p) => p.id === id || String(p.id) === String(id));
    const resolvedFbPageId = fbPageId || (idx >= 0 && pages[idx].fbPageId ? pages[idx].fbPageId : '');
    const parentFbPage = resolvedFbPageId ? pages.find((p) => String(p.id) === String(resolvedFbPageId)) : null;
    const resolvedToken = pageToken || (parentFbPage && parentFbPage.pageToken) || (idx >= 0 && pages[idx].pageToken) || '';
    const pageItem = {
      id, name, platform, color, adAccountId,
      ...(resolvedFbPageId ? { fbPageId: resolvedFbPageId } : {}),
      ...(resolvedToken ? { pageToken: resolvedToken } : {}),
    };
    if (idx >= 0) {
      pages[idx] = pageItem;
    } else {
      pages.push(pageItem);
    }
    store.write('pages.json', pages);
    meta.clearCache();
    audit.log(session.user.username, 'page_save', `บันทึกเพจ: ${name} (${id}) ผูก Ad Account: ${adAccountId || 'ไม่มี'}`, clientIp(req));
    return send(res, 200, { ok: true, pages });
  }

  if (route === 'POST /api/settings/pages/delete') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const id = clean(b.id, 80);
    if (!id) return send(res, 400, { error: 'กรุณาระบุ Page ID ที่ต้องการลบ' });

    let pages = store.read('pages.json', []);
    pages = pages.filter((p) => p.id !== id && String(p.id) !== String(id));
    store.write('pages.json', pages);

    // ปลด pageId ออกจาก leads ที่เคยผูกกับเพจนี้ เพื่อไม่ให้ providers.js auto-inject เพจนี้กลับเข้ามา
    try {
      let leads = store.read('leads.json', []);
      let leadsChanged = false;
      for (const l of leads) {
        if (l.pageId === id || String(l.pageId) === String(id)) {
          l.pageId = '';
          l.pageName = '';
          leadsChanged = true;
        }
      }
      if (leadsChanged) store.write('leads.json', leads);
    } catch (_) {}

    meta.clearCache();
    audit.log(session.user.username, 'page_delete', `ลบเพจ ID: ${id}`, clientIp(req));
    return send(res, 200, { ok: true, pages });
  }


  if (route === 'POST /api/leads/refresh-names') {
    const leads = store.read('leads.json', []);
    let updated = 0;
    const pages = store.read('pages.json', []);
    for (const l of leads) {
      const isGeneric = !l.name || l.name.includes('ลูกค้า') || l.name.startsWith('M-') || l.name === 'Facebook';
      if (l.platform === 'Facebook' && l.psid && isGeneric) {
        try {
          const pageId = l.pageId || (pages.find(p => !p.platform || p.platform === 'Facebook') || {}).id;
          if (pageId) {
            const realName = await meta.fetchProfileName(pageId, l.psid);
            if (realName && realName !== l.name) {
              l.name = realName;
              updated++;
            }
          }
        } catch {}
      }
    }
    if (updated > 0) {
      store.write('leads.json', leads);
      audit.log(session.user.username, 'refresh_names', 'อัปเดตชื่อลูกค้าจาก Facebook สำเร็จ ' + updated + ' รายชื่อ', clientIp(req));
    }
    return send(res, 200, { ok: true, updated, total: leads.length });
  }

  if (route === 'POST /api/import/facebook-conversations') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req).catch(() => ({}));
    const pageId = clean(b.pageId, 80);
    if (!pageId) return send(res, 400, { error: 'กรุณาระบุ Page ID' });

    const pages = store.read('pages.json', []);
    const matched = pages.find((p) => p.id === pageId || String(p.id) === String(pageId));
    const pageName = matched ? matched.name : ('เพจ ' + pageId);

    try {
      const plat = (matched && matched.platform) || 'Facebook';
      const fbPageId = matched ? matched.fbPageId : null;
      const afterDate = clean(b.afterDate, 10) || null;
      const beforeDate = clean(b.beforeDate, 10) || null;
      const convs = await meta.fetchFbConversations(pageId, parseLimit(b.limit, 400, 10), plat, fbPageId, afterDate, beforeDate, { maxMessagesPerChat: parseLimit(b.messagesPerChat, plat === 'Instagram' ? 200 : 300) });
      let leads = store.read('leads.json', []);
      let messages = store.read('messages.json', {});

      let importedLeads = 0;
      let importedMsgs = 0;

      for (const c of convs) {
        const parts = (c.participants && c.participants.data) || [];
        const isSelf = (pid) => String(pid) === String(pageId) || (fbPageId && String(pid) === String(fbPageId)) || (matched && matched.fbPageId && String(pid) === String(matched.fbPageId));
        const customerPart = parts.find((p) => !isSelf(p.id)) || parts[0];
        if (!customerPart) continue;
        const psid = String(customerPart.id);
        const custName = customerPart.name || (customerPart.username ? '@' + customerPart.username : ('ลูกค้า ' + psid.slice(-4)));

        const actualPlat = detectConvPlatform(c, plat);
        let lead = leads.find((l) => l.psid === psid && (l.platform || 'Facebook') === actualPlat && (!l.pageId || String(l.pageId) === String(pageId)));
        if (!lead) {
          const res = ops.findOrCreateLead({
            psid,
            pageId,
            name: custName,
            platform: actualPlat,
            channel: actualPlat === 'Instagram' ? 'Instagram' : 'Messenger',
            pageName,
          });
          lead = res.lead;
          leads.push(lead);
          importedLeads++;
        } else if (!lead.name || lead.name.includes('ลูกค้า')) {
          lead.name = custName;
        }
        lead.pageId = pageId;
        lead.pageName = pageName;
        lead.platform = actualPlat;
        lead.channel = actualPlat === 'Instagram' ? 'Instagram' : 'Messenger';
        if (c.updated_time) {
          const convDate = new Date(c.updated_time).toISOString().slice(0, 10);
          if (convDate) lead.date = convDate;
        }
        const detectedStatus1 = detectFbConvStatus(c);
        if (detectedStatus1) {
          lead.status = detectedStatus1;
          lead.quality = ops.QUALITY[detectedStatus1] || lead.quality;
        }

        const msgList = (c.messages && c.messages.data) || [];
        const currentLeadMsgs = messages[lead.id] || (messages[lead.id] = []);
        for (const m of msgList) {
          const fromPage = m.from && isSelf(m.from.id);
          let text = (m.message || '').trim();
          if (!text) {
            if (m.attachments || m.shares || m.sticker) {
              text = fromPage ? '📷 [เจ้าหน้าที่ส่งรูปภาพหรือไฟล์แนบ]' : '📷 [ลูกค้าส่งรูปภาพหรือไฟล์แนบ]';
            } else {
              continue;
            }
          }
          const at = ops.nowStamp(m.created_time ? new Date(m.created_time).getTime() : Date.now());
          if (!currentLeadMsgs.some((x) => (m.id && x.mid === m.id) || (x.text === text && Math.abs(new Date(x.at) - new Date(at)) < 60000))) {
            const staffName = fromPage ? ((m.from && m.from.name) || 'Staff') : null;
            currentLeadMsgs.push({
              from: fromPage ? 'staff' : 'customer',
              text,
              mid: m.id || undefined,
              at,
              via: 'import',
              ...(staffName ? { by: staffName } : {}),
            });
            importedMsgs++;
          }
        }
      }
      for (const lid in messages) {
        if (Array.isArray(messages[lid])) {
          messages[lid].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
        }
      }
      reps.resolveAll(leads, messages, store.read('pages.json', []));
      store.write('messages.json', messages);
      store.write('leads.json', leads);
      audit.log(session.user.username, 'import_fb', 'นำเข้าบทสนทนาเพจ ' + pageName + ': ' + importedLeads + ' ลีด, ' + importedMsgs + ' ข้อความ', clientIp(req));
      const warning = !convs.length && plat === 'Instagram'
        ? 'Meta ส่งแชท Instagram กลับมา 0 แชท (ไม่มี error) — กด "📸 ตรวจสอบ Instagram" ในหน้า Setting เพื่อดูสาเหตุ'
        : (!convs.length ? 'Meta ส่งแชทกลับมา 0 แชทในช่วงที่เลือก' : undefined);
      return send(res, 200, { ok: true, importedLeads, importedMsgs, pageId, pageName, conversations: convs.length, warning });
    } catch (e) {
      return send(res, 500, { error: e.message || 'ดึงบทสนทนาจาก Facebook ไม่สำเร็จ' });
    }
  }

  if (route === 'POST /api/meta/discover-pages') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req).catch(() => ({}));
    const customToken = clean(b.accessToken, 500);
    try {
      const fbPages = await meta.fetchManagedPages(customToken || null);
      let pages = store.read('pages.json', []);
      let added = 0;
      let updated = 0;

      for (const fp of fbPages) {
        const id = String(fp.id);
        const name = clean(fp.name, 120);
        // กรองไม่เอาเพจที่ไม่มีชื่อ หรือเป็นเพจตัวเลขขยะ
        if (!name || name.startsWith('Page ') || id === '1040829309417229') continue;
        const pageToken = fp.access_token || '';
        const idx = pages.findIndex((p) => p.id === id || String(p.id) === id);
        if (idx >= 0) {
          pages[idx].name = name;
          if (pageToken) pages[idx].pageToken = pageToken;
          if (!pages[idx].platform) pages[idx].platform = 'Facebook';
          updated++;
        } else {
          pages.push({
            id,
            name,
            platform: 'Facebook',
            color: '#1877f2',
            ...(pageToken ? { pageToken } : {}),
          });
          added++;
        }




        // ตรวจสอบว่า Facebook เพจนี้เชื่อมกับ Instagram Business / Connected Account หรือไม่
        const ig = fp.instagram_business_account || fp.connected_instagram_account;
        if (ig && ig.id) {
          const igId = String(ig.id);
          const igName = clean(ig.username || ig.name || `IG - ${name}`, 120);
          const igIdx = pages.findIndex((p) => p.id === igId || String(p.id) === igId);
          if (igIdx >= 0) {
            pages[igIdx].name = igName;
            pages[igIdx].platform = 'Instagram';
            pages[igIdx].fbPageId = id;
            if (pageToken) pages[igIdx].pageToken = pageToken;
            updated++;
          } else {
            pages.push({
              id: igId,
              name: igName,
              platform: 'Instagram',
              fbPageId: id,
              color: '#e1306c',
              ...(pageToken ? { pageToken } : {}),
            });
            added++;
          }
        }
      }
      store.write('pages.json', pages);
      meta.clearCache();
      audit.log(session.user.username, 'discover_pages', `ค้นพบและซิงค์เพจจาก Meta: เพิ่ม ${added} เพจ, อัปเดต ${updated} เพจ`, clientIp(req));
      return send(res, 200, { ok: true, pages, added, updated, totalFound: fbPages.length });
    } catch (e) {
      return send(res, 500, { error: e.message || 'ไม่สามารถดึงข้อมูลเพจจาก Meta ได้ (ตรวจสิทธิ์ pages_show_list และ pages_read_engagement)' });
    }
  }

  if (route === 'POST /api/import/facebook-conversations-all') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req).catch(() => ({}));
    const limit = parseLimit(b.limit, 400, 10);
    const messagesPerChat = b.messagesPerChat;
    const afterDate = clean(b.afterDate, 10) || null;
    const beforeDate = clean(b.beforeDate, 10) || null;
    const pages = store.read('pages.json', []);
    const targetPages = pages.filter((p) => (!p.platform || p.platform === 'Facebook' || p.platform === 'Instagram') && !p.id.startsWith('P-'));
    if (!targetPages.length) return send(res, 400, { error: 'ไม่พบเพจ Facebook หรือ Instagram ในระบบ กรุณากดดึงเพจจาก Meta ก่อน' });

    let leads = store.read('leads.json', []);
    let messages = store.read('messages.json', {});
    let totalImportedLeads = 0;
    let totalImportedMsgs = 0;
    const results = [];

    for (const [pageIdx, page] of targetPages.entries()) {
      if (jobs.cancelled()) { results.push({ pageId: page.id, pageName: page.name, error: 'ยกเลิกโดยผู้ใช้', success: false }); continue; }
      jobs.report({ note: `เพจ ${pageIdx + 1}/${targetPages.length}: ${page.name}`, phase: 'conversations', done: 0, total: limit });
      const pPlat = page.platform || 'Facebook';
      try {
        const convs = await meta.fetchFbConversations(page.id, limit, pPlat, page.fbPageId || null, afterDate, beforeDate, { maxMessagesPerChat: parseLimit(messagesPerChat, pPlat === 'Instagram' ? 200 : 300) });
        // อ่านข้อมูลล่าสุดหลังดึงเสร็จ เพื่อไม่ทับแชทที่ webhook เพิ่งบันทึกระหว่างรอ
        leads = store.read('leads.json', []);
        messages = store.read('messages.json', {});

        let pLeads = 0;
        let pMsgs = 0;
        for (const c of convs) {
          const parts = (c.participants && c.participants.data) || [];
          const isSelf = (pid) => String(pid) === String(page.id) || (page.fbPageId && String(pid) === String(page.fbPageId));
          const customerPart = parts.find((p) => !isSelf(p.id)) || parts[0];
          if (!customerPart) continue;
          const psid = String(customerPart.id);
          const custName = customerPart.name || (customerPart.username ? '@' + customerPart.username : ('ลูกค้า ' + psid.slice(-4)));

          const actualPlat = detectConvPlatform(c, pPlat);
          let lead = leads.find((l) => l.psid === psid && (l.platform || 'Facebook') === actualPlat && (!l.pageId || String(l.pageId) === String(page.id)));
          if (!lead) {
            const res = ops.findOrCreateLead({
              psid,
              pageId: page.id,
              name: custName,
              platform: actualPlat,
              pageName: page.name,
              channel: actualPlat === 'Instagram' ? 'Instagram' : 'Messenger',
            });
            lead = res.lead;
            leads.push(lead);
            pLeads++;
          } else if (!lead.name || lead.name.includes('ลูกค้า')) {
            lead.name = custName;
          }
          lead.pageId = page.id;
          lead.pageName = page.name;
          lead.platform = actualPlat;
          lead.channel = actualPlat === 'Instagram' ? 'Instagram' : 'Messenger';
          if (c.updated_time) {
            const convDate = new Date(c.updated_time).toISOString().slice(0, 10);
            if (convDate) lead.date = convDate;
          }
          const detectedStatus2 = detectFbConvStatus(c);
          if (detectedStatus2) {
            lead.status = detectedStatus2;
            lead.quality = ops.QUALITY[detectedStatus2] || lead.quality;
          }

          const msgList = (c.messages && c.messages.data) || [];
          const currentLeadMsgs = messages[lead.id] || (messages[lead.id] = []);
          for (const m of msgList) {
            const fromPage = m.from && isSelf(m.from.id);
            let text = (m.message || '').trim();
            if (!text) {
              if (m.attachments || m.shares || m.sticker) {
                text = fromPage ? '📷 [เจ้าหน้าที่ส่งรูปภาพหรือไฟล์แนบ]' : '📷 [ลูกค้าส่งรูปภาพหรือไฟล์แนบ]';
              } else {
                continue;
              }
            }
            const at = ops.nowStamp(m.created_time ? new Date(m.created_time).getTime() : Date.now());
            if (!currentLeadMsgs.some((x) => (m.id && x.mid === m.id) || (x.text === text && Math.abs(new Date(x.at) - new Date(at)) < 60000))) {
              const staffName = fromPage ? ((m.from && m.from.name) || 'Staff') : null;
              currentLeadMsgs.push({
                from: fromPage ? 'staff' : 'customer',
                text,
                mid: m.id || undefined,
                at,
                via: 'import',
                ...(staffName ? { by: staffName } : {}),
              });
                pMsgs++;
            }
          }
        }
        for (const lid in messages) {
          if (Array.isArray(messages[lid])) {
            messages[lid].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
          }
        }
        reps.resolveAll(leads, messages, store.read('pages.json', []));
        store.write('messages.json', messages);
        store.write('leads.json', leads);
        totalImportedLeads += pLeads;
        totalImportedMsgs += pMsgs;
        results.push({ pageId: page.id, pageName: page.name, leads: pLeads, msgs: pMsgs, success: true, conversations: convs.length });
        if (!convs.length && pPlat === 'Instagram') results[results.length - 1].warning = 'Meta ส่งแชท IG กลับมา 0 แชท';
      } catch (err) {
        results.push({ pageId: page.id, pageName: page.name, error: err.message, success: false });
      }
    }
    audit.log(session.user.username, 'import_fb_all', `นำเข้าบทสนทนาทุกเพจ: ${totalImportedLeads} ลีด, ${totalImportedMsgs} ข้อความ`, clientIp(req));
    const errors = results.filter((r) => !r.success || r.warning).map((r) => `${r.pageName}: ${r.error || r.warning}`);
    return send(res, 200, { ok: true, totalImportedLeads, totalImportedMsgs, results, errors });
  }

  if (route === 'PUT /api/settings/meta') {
    const b = await readJson(req);
    const cur = meta.getSettings().meta || {};
    let cleanAdAccount = clean(b.adAccountId, 40).replace(/^act_/, "");
    if (!cleanAdAccount && cur.adAccountId) cleanAdAccount = cur.adAccountId;
    const next = {
      appId: clean(b.appId, 40),
      adAccountId: cleanAdAccount,
      apiVersion: /^v\d+\.\d+$/.test(clean(b.apiVersion, 10)) ? clean(b.apiVersion, 10) : config.metaApiVersion,
    };
    // ค่าลับจะถูกเขียนทับเฉพาะเมื่อกรอกค่าใหม่เท่านั้น
    if (clean(b.appSecret, 1000)) next.appSecret = clean(b.appSecret, 1000);
    if (clean(b.accessToken, 4000)) {
      next.accessToken = clean(b.accessToken, 4000);
    } else if (cur.accessToken) {
      next.accessToken = cur.accessToken;
    }
    if (next.accessToken && next.accessToken !== cur.accessToken) { next.connectedAt = null; next.accountName = ''; }
    meta.saveSettings({ clinicName: clean(b.clinicName, 80) || undefined, meta: next });
    meta.clearCache();
    const changed = [next.accessToken && next.accessToken !== cur.accessToken ? 'token' : '', next.appSecret ? 'app secret' : ''].filter(Boolean);
    audit.log(session.user.username, 'settings_save', `Ad Account ${next.adAccountId || '—'}${changed.length ? ' · เปลี่ยน ' + changed.join(', ') : ''}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'POST /api/settings/meta/test') {
    const m = meta.getSettings().meta || {};
    if (!m.accessToken) return send(res, 200, { ok: false, error: 'กรุณาระบุ Access Token ก่อนกดทดสอบ' });
    try {
      const info = await meta.testConnection(m);
      // เมื่อทดสอบสำเร็จ บันทึกสถานะเชื่อมต่อ และสลับ mode เป็น 'meta' ให้อัตโนมัติทันที
      meta.saveSettings({
        mode: 'meta',
        meta: {
          ...(info.adAccountId ? { adAccountId: info.adAccountId } : {}),
          accountName: info.name,
          currency: info.currency,
          connectedAt: new Date().toISOString(),
        }
      });
      meta.clearCache();
      audit.log(session.user.username, 'meta_test', `สำเร็จ: ${info.name}`, clientIp(req));
      return send(res, 200, { ok: true, account: info, settings: publicSettings() });
    } catch (e) {
      audit.log(session.user.username, 'meta_test', `ไม่สำเร็จ: ${e.message}`, clientIp(req));
      return send(res, 200, { ok: false, error: e.message });
    }
  }

  // เปิดรับแชท Messenger/Instagram อัตโนมัติ: ตั้ง webhook ที่แอป Meta และ subscribe ทุกเพจ
  if (route === 'POST /api/settings/meta/subscribe-webhooks') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const proto = config.trustProxy ? String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() : (req.socket.encrypted ? 'https' : 'http');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const callbackUrl = `${proto}://${host}/webhook`;
    if (!/^https:\/\//.test(callbackUrl) || /localhost|127\.0\.0\.1/.test(host)) {
      return send(res, 400, { error: `Meta ต้องการ Webhook แบบ https ที่เข้าถึงได้จากอินเทอร์เน็ต (ตอนนี้คือ ${callbackUrl}) — กดปุ่มนี้จากเว็บที่ deploy แล้ว` });
    }
    try {
      const r = await meta.subscribeWebhooks(callbackUrl, webhookToken());
      audit.log(session.user.username, 'meta_subscribe_webhooks', `${callbackUrl}: แอป ${r.app.filter((x) => x.ok).length}/${r.app.length}, เพจ ${r.pages.filter((x) => x.ok).length}/${r.pages.length}`, clientIp(req));
      return send(res, 200, { ok: true, callbackUrl, ...r });
    } catch (e) {
      return send(res, 500, { error: e.message || 'ตั้งค่า webhook ไม่สำเร็จ' });
    }
  }

  if (route === 'POST /api/settings/instagram/test') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const m = meta.getSettings().meta || {};
    if (!m.accessToken) return send(res, 200, { ok: false, error: 'กรุณาบันทึก Meta Access Token ก่อนกดทดสอบ Instagram' });
    try {
      const diag = await meta.testInstagramConnection();
      let pages = store.read('pages.json', []);
      for (const ig of diag.igAccounts) {
        const igIdx = pages.findIndex((p) => String(p.id) === ig.igId);
        if (igIdx >= 0) {
          pages[igIdx].name = ig.username;
          pages[igIdx].platform = 'Instagram';
          pages[igIdx].fbPageId = ig.fbPageId;
          if (ig.pageToken) pages[igIdx].pageToken = ig.pageToken;
        } else {
          pages.push({
            id: ig.igId,
            name: ig.username,
            platform: 'Instagram',
            fbPageId: ig.fbPageId,
            color: '#e1306c',
            ...(ig.pageToken ? { pageToken: ig.pageToken } : {}),
          });
        }
      }
      store.write('pages.json', pages);
      meta.clearCache();
      return send(res, 200, {
        ok: true,
        igAccounts: diag.igAccounts.map(({ pageToken, ...rest }) => rest),
        unlinkedFbPages: diag.unlinkedFbPages,
        totalFbPages: diag.totalFbPages,
        token: diag.token,
      });
    } catch (e) {
      const msg = String(e.message || '');
      const friendly = (msg.includes('Session has expired') || msg.includes('Error validating access token'))
        ? 'Meta Access Token ปัจจุบันหมดอายุแล้ว (Session has expired) — กรุณาสร้าง Token ใหม่ที่มีสิทธิ์ instagram_basic, instagram_manage_messages, instagram_manage_comments, pages_show_list, pages_messaging แล้วกดบันทึก'
        : msg;
      return send(res, 200, { ok: false, error: friendly });
    }
  }

  if (route === 'POST /api/meta/sync-all') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const m = meta.getSettings().meta || {};
    if (!m.accessToken) return send(res, 400, { error: 'กรุณาบันทึก Access Token ก่อนซิงค์ข้อมูล' });
    try {
      // 1. ทดสอบและค้นหา Ad Account
      const info = await meta.testConnection(m);
      meta.saveSettings({
        mode: 'meta',
        meta: {
          ...(info.adAccountId ? { adAccountId: info.adAccountId } : {}),
          accountName: info.name,
          currency: info.currency,
          connectedAt: new Date().toISOString(),
        }
      });
      meta.clearCache();

      // 2. ค้นหาและซิงค์เพจ Facebook + Instagram
      let pages = store.read('pages.json', []);
      let pagesAdded = 0;
      let pagesUpdated = 0;
      try {
        const fbPages = await meta.fetchManagedPages();
        for (const fp of fbPages) {
          const id = String(fp.id);
          const name = clean(fp.name, 120);
          if (!name || name.startsWith('Page ') || id === '1040829309417229') continue;
          const pTok = fp.access_token || '';
          const idx = pages.findIndex((p) => p.id === id || String(p.id) === id);
          if (idx >= 0) {
            pages[idx].name = name;
            if (pTok) pages[idx].pageToken = pTok;
            if (!pages[idx].platform) pages[idx].platform = 'Facebook';
            pagesUpdated++;
          } else {
            pages.push({ id, name, platform: 'Facebook', color: '#1877f2', ...(pTok ? { pageToken: pTok } : {}) });
            pagesAdded++;
          }
          const ig = fp.instagram_business_account || fp.connected_instagram_account;
          if (ig && ig.id) {
            const igId = String(ig.id);
            const igName = clean(ig.username || ig.name || `IG - ${name}`, 120);
            const igIdx = pages.findIndex((p) => p.id === igId || String(p.id) === igId);
            if (igIdx >= 0) {
              pages[igIdx].name = igName;
              pages[igIdx].platform = 'Instagram';
              pages[igIdx].fbPageId = id;
              if (pTok) pages[igIdx].pageToken = pTok;
              pagesUpdated++;
            } else {
              pages.push({ id: igId, name: igName, platform: 'Instagram', fbPageId: id, color: '#e1306c', ...(pTok ? { pageToken: pTok } : {}) });
              pagesAdded++;
            }
          }
        }
        store.write('pages.json', pages);
      } catch (_) {}

      // 3. ดึงแคมเปญ โฆษณา รูปภาพ วิดีโอ และสถิติ (30 วันล่าสุด)
      const range = resolveRange({ range: '30d' });
      let dashData;
      try {
        dashData = await meta.load({ from: range.prevFrom, to: range.to });
      } catch (loadErr) {
        if (loadErr.message.includes('too many calls') || loadErr.message.includes('rate-limiting')) {
          return send(res, 429, { error: 'Meta Ad Account กำลังติด Rate Limit ชั่วคราว (เรียก API ถี่เกินไป) — การเชื่อมต่อเพจและ Token บันทึกเรียบร้อยแล้ว กรุณารอประมาณ 5–15 นาทีแล้วกดซิงค์ข้อมูลอีกครั้ง' });
        }
        throw loadErr;
      }

      audit.log(session.user.username, 'meta_sync_all', `ซิงค์ Meta ครบวงจร: ${info.name} (${(dashData.ads || []).length} ads, ${pages.length} pages)`, clientIp(req));
      return send(res, 200, {
        ok: true,
        accountName: info.name,
        adAccountId: info.adAccountId || m.adAccountId,
        pagesCount: pages.length,
        pagesAdded,
        pagesUpdated,
        campaignsCount: (dashData.campaigns || []).length,
        adsCount: (dashData.ads || []).length,
        settings: publicSettings(),
      });
    } catch (e) {
      return send(res, 500, { error: e.message || 'ซิงค์ข้อมูลจาก Meta ไม่สำเร็จ' });
    }
  }

  if (route === 'POST /api/settings/meta/extend') {
    const m = meta.getSettings().meta || {};
    if (!m.appId || !m.appSecret || !m.accessToken) return send(res, 400, { error: 'ต้องกรอก App ID, App Secret และ Access Token ก่อน' });
    try {
      const token = await meta.exchangeLongLived(m);
      meta.saveSettings({ meta: { accessToken: token } });
      audit.log(session.user.username, 'meta_extend', 'แลกเป็น token อายุยาว', clientIp(req));
      return send(res, 200, { ok: true, settings: publicSettings() });
    } catch (e) {
      return send(res, 200, { ok: false, error: e.message });
    }
  }

  if (route === 'POST /api/settings/meta/disconnect') {
    const s = meta.getSettings();
    store.write('settings.json', { ...s, mode: 'demo', meta: {} });
    meta.clearCache();
    audit.log(session.user.username, 'meta_disconnect', 'ลบ token และกลับโหมดเดโม', clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'POST /api/settings/supabase/sync') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    if (!store.hasSupabase) return send(res, 400, { error: 'ยังไม่ได้ตั้งค่า Supabase URL และ API Key' });
    try {
      const r = await store.initFromSupabase(true);
      audit.log(session.user.username, 'supabase_sync', `ดึงข้อมูลล่าสุดจาก Supabase Cloud สำเร็จ (${r.count || 0} ตาราง)`, clientIp(req));
      return send(res, 200, { ok: true, count: r.count || 0, message: `ดึงข้อมูลล่าสุดจาก Supabase สำเร็จแล้ว (${r.count || 0} รายการ)` });
    } catch (err) {
      return send(res, 500, { error: 'ดึงข้อมูลไม่สำเร็จ: ' + err.message });
    }
  }

  if (route === 'POST /api/settings/mode') {
    const b = await readJson(req);
    const m = meta.getSettings().meta || {};
    if (b.mode === 'meta' && !m.connectedAt) return send(res, 400, { error: 'ต้องทดสอบการเชื่อมต่อ Meta ให้สำเร็จก่อน' });
    const targetMode = b.mode === 'meta' ? 'meta' : b.mode === 'demo' ? 'demo' : 'live';
    meta.saveSettings({ mode: targetMode });
    audit.log(session.user.username, 'mode_change', `เปลี่ยนเป็นโหมด ${targetMode === 'meta' ? 'Meta' : targetMode === 'demo' ? 'เดโม' : 'ข้อมูลจริง (Live)'}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'POST /api/password') {
    const b = await readJson(req);
    const err = auth.changePassword(session.user.username, b.current, b.next);
    if (err) return send(res, 400, { error: err });
    audit.log(session.user.username, 'password_change', 'เปลี่ยนรหัสผ่านของตัวเอง', clientIp(req));
    return send(res, 200, { ok: true });
  }

  if (route === 'POST /api/upload/ad-image') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req, 40_000_000); // 40MB รองรับทั้งรูปภาพความละเอียดสูงและไฟล์วิดีโอสั้น (MP4/WebM)
    const { adId, adName, imageData, mimeType, mediaUrl, videoUrl: directVideoUrl } = b;

    let finalThumb = null;
    let finalVideo = null;
    let isVideo = false;

    if (directVideoUrl || mediaUrl) {
      const cleanUrl = clean(directVideoUrl || mediaUrl, 1500);
      if (!cleanUrl) return send(res, 400, { error: 'กรุณาระบุ URL ของรูปภาพหรือวิดีโอ' });
      isVideo = Boolean(directVideoUrl) || /\.(mp4|webm|mov)(\?|$)/i.test(cleanUrl);
      if (isVideo) finalVideo = cleanUrl;
      else finalThumb = cleanUrl;
    } else {
      if (!imageData) return send(res, 400, { error: 'ต้องส่งข้อมูลไฟล์รูปภาพหรือวิดีโอ (imageData)' });

      const ALLOWED_MIME = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
        'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
      };
      const detectedMime = mimeType || imageData.match(/^data:([^;]+);base64,/)?.[1] || '';
      const ext = ALLOWED_MIME[detectedMime] || 'jpg';
      if (!Object.values(ALLOWED_MIME).includes(ext)) {
        return send(res, 400, { error: 'รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, GIF, WebP) และวิดีโอ (MP4, WebM, MOV)' });
      }
      isVideo = ['mp4', 'webm', 'mov'].includes(ext);

      // ถอด base64 header ออกก่อน decode
      const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      if (buf.length > 30_000_000) return send(res, 400, { error: 'ไฟล์มีขนาดใหญ่เกิน 30 MB' });

      const safeName = (adId || adName || 'ad').replace(/[^a-zA-Z0-9ก-๙-]/g, '_').slice(0, 40);
      const filename = `${Date.now()}-${safeName}.${ext}`;
      const uploadsDir = path.join(config.publicDir, 'ad-images');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, filename), buf);
      const url = `/ad-images/${filename}`;
      if (isVideo) finalVideo = url;
      else finalThumb = url;
    }

    // 1. บันทึกลง ad_media.json เพื่อให้แสดงผลได้ทุกโหมด (Demo, Live, Meta API)
    const adMedia = store.read('ad_media.json', {});
    const key = adId || adName;
    if (key) {
      const prev = adMedia[key] || {};
      adMedia[key] = {
        ...prev,
        ...(finalThumb ? { thumb: finalThumb } : {}),
        ...(finalVideo ? { videoUrl: finalVideo, creative: 'VIDEO' } : {}),
        updatedAt: new Date().toISOString(),
      };
      store.write('ad_media.json', adMedia);
    }

    // 2. อัปเดตใน campaigns_data.json ด้วย (ถ้ามี)
    const campData = store.read('campaigns_data.json', { ads: [], daily: [], campaigns: [] });
    const ad = (campData.ads || []).find((a) => a.id === adId || a.name === adName || a.name === adId);
    if (ad) {
      if (finalThumb) ad.thumb = finalThumb;
      if (finalVideo) { ad.videoUrl = finalVideo; ad.creative = 'VIDEO'; }
      store.write('campaigns_data.json', campData);
    }

    const savedUrl = finalVideo || finalThumb;
    audit.log(session.user.username, 'image_upload', `อัปโหลด${isVideo ? 'วิดีโอ' : 'รูป'}โฆษณา: ${savedUrl}${adId ? ' → ' + (adName || adId) : ''}`, clientIp(req));
    return send(res, 200, { ok: true, url: savedUrl, thumb: finalThumb, videoUrl: finalVideo, isVideo, adName: ad ? ad.name : (adName || adId || null), adUpdated: true });
  }

  if (route === 'GET /api/upload/ad-images') {
    const range = resolveRange({ range: '30d' });
    const activeData = await providers.load(range).catch(() => ({ ads: [], campaigns: [] }));
    const campData = store.read('campaigns_data.json', { ads: [], daily: [], campaigns: [] });
    const adMedia = store.read('ad_media.json', {});
    const campNameMap = new Map([
      ...((activeData.campaigns || []).map((c) => [c.id, c.name])),
      ...((campData.campaigns || []).map((c) => [c.id, c.name])),
    ]);
    const adMap = new Map();
    for (const a of [...(activeData.ads || []), ...(campData.ads || [])]) {
      const ov = adMedia[a.id] || adMedia[a.name] || {};
      adMap.set(a.id, {
        id: a.id,
        name: a.name,
        campaign: campNameMap.get(a.campaignId) || a.campaign || '',
        creative: ov.creative || a.creative || 'IMAGE',
        thumb: ov.thumb || a.thumb || null,
        videoUrl: ov.videoUrl || a.videoUrl || null,
      });
    }
    return send(res, 200, { ads: [...adMap.values()] });
  }

  return send(res, 404, { error: 'ไม่พบ API นี้' });
}

// In-memory cache สำหรับ static files พร้อม pre-compressed gzip เพิ่มความเร็วในการโหลด 4-5 เท่า
const staticFileCache = new Map();

// เลขเวอร์ชันของไฟล์ js/css = hash ของเนื้อหา (คำนวณใหม่เมื่อไฟล์เปลี่ยน)
const assetVersionCache = new Map();
function assetVersion(name) {
  const file = path.join(config.publicDir, name);
  try {
    const st = fs.statSync(file);
    const hit = assetVersionCache.get(file);
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.v;
    const v = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
    assetVersionCache.set(file, { v, mtimeMs: st.mtimeMs, size: st.size });
    return v;
  } catch { return '0'; }
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(config.publicDir, rel));
  if (!file.startsWith(config.publicDir + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(file, (err, stats) => {
    if (err || !stats.isFile()) return send(res, 404, 'Not found');

    const ext = path.extname(file);
    const contentType = MIME[ext] || 'application/octet-stream';

    // หน้า HTML: ใส่เลขเวอร์ชันของ js/css ตามเนื้อหาไฟล์จริง (?v=<hash>) ทุกครั้ง
    // deploy ใหม่ → hash เปลี่ยน → เบราว์เซอร์โหลดไฟล์ใหม่ทันที ไม่ติดแคชเก่า 1 ปี
    if (ext === '.html') {
      let html;
      try { html = fs.readFileSync(file, 'utf8'); } catch { return send(res, 500, 'Server read error'); }
      html = html.replace(/((?:href|src)="\/)([\w.-]+\.(?:js|css))(?:\?v=[^"]*)?"/g, (m, pre, name) => `${pre}${name}?v=${assetVersion(name)}"`);
      const htmlEtag = `W/"${crypto.createHash('sha1').update(html).digest('hex').slice(0, 16)}"`;
      if (req.headers['if-none-match'] === htmlEtag) {
        res.writeHead(304, { ...SECURITY_HEADERS, ETag: htmlEtag, 'Cache-Control': 'no-cache' });
        return res.end();
      }
      const buf = Buffer.from(html, 'utf8');
      const gz = String(req.headers['accept-encoding'] || '').includes('gzip') ? zlib.gzipSync(buf) : null;
      res.writeHead(200, {
        ...SECURITY_HEADERS, 'Content-Type': contentType, 'Content-Length': (gz || buf).length,
        ETag: htmlEtag, 'Cache-Control': 'no-cache', ...(gz ? { 'Content-Encoding': 'gzip' } : {}),
      });
      return res.end(gz || buf);
    }

    const etag = `W/"${stats.size}-${stats.mtimeMs.toFixed(0)}"`;

    // 1. ตรวจสอบ 304 Not Modified
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ...SECURITY_HEADERS, ETag: etag });
      return res.end();
    }

    // 2. ตรวจสอบว่ามี cached buffer อยู่หรือไม่
    let cached = staticFileCache.get(file);
    if (!cached || cached.mtimeMs !== stats.mtimeMs) {
      try {
        const rawBuf = fs.readFileSync(file);
        const shouldGzip = ['.js', '.css', '.html', '.json', '.svg'].includes(ext) && rawBuf.length > 512;
        const gzipped = shouldGzip ? zlib.gzipSync(rawBuf, { level: 6 }) : null;
        cached = { raw: rawBuf, gzipped, mtimeMs: stats.mtimeMs, etag, contentType };
        staticFileCache.set(file, cached);
      } catch {
        return send(res, 500, 'Server read error');
      }
    }

    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    const canGzip = Boolean(cached.gzipped && acceptEncoding.includes('gzip'));
    const body = canGzip ? cached.gzipped : cached.raw;

    // Static Assets ที่มี Query string (?v=...) แคชได้ 1 ปีเต็ม ถ้าเป็น index.html ให้ revalidate
    const isVersioned = url.search.includes('v=');
    const cacheControl = isVersioned 
      ? 'public, max-age=31536000, immutable' 
      : 'public, max-age=300, must-revalidate';

    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': cached.contentType,
      'Content-Length': body.length,
      ETag: cached.etag,
      'Cache-Control': cacheControl,
    };
    if (canGzip) headers['Content-Encoding'] = 'gzip';

    res.writeHead(200, headers);
    res.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  // ขยาย timeout สำหรับการดึงข้อมูลและ sync ขนาดใหญ่ (Meta Graph API)
  req.setTimeout(180000);
  res.setTimeout(180000);
  try {
    const url = new URL(req.url, 'http://localhost');
    const ip = clientIp(req);

    // Webhook จาก Meta (ไม่ใช้ session แต่ตรวจลายเซ็น X-Hub-Signature-256 ด้วย App Secret)
    if (url.pathname === '/webhook') {
      if (req.method === 'GET') {
        const reqTok = url.searchParams.get('hub.verify_token') || '';
        const curTok = webhookToken();
        const storedTok = (meta.getSettings().meta || {}).webhookVerifyToken || '';
        const okTok = url.searchParams.get('hub.mode') === 'subscribe' && (safeEq(reqTok, curTok) || (storedTok && safeEq(reqTok, storedTok)));
        if (!okTok) { audit.log('meta-webhook', 'webhook_rejected', 'Verify Token ไม่ถูกต้อง', ip); return send(res, 403, 'Forbidden'); }
        return send(res, 200, clean(url.searchParams.get('hub.challenge'), 100));
      }
      if (req.method === 'POST') {
        const raw = await readRaw(req);
        const chk = metaSignatureOk(req, raw);
        if (!chk.ok) { audit.log('meta-webhook', 'webhook_rejected', chk.reason, ip); return send(res, 403, 'Forbidden'); }
        let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'Bad request'); }
        try { await handleWebhook(body); } catch (e) { console.error('webhook', e); }
        return send(res, 200, 'EVENT_RECEIVED'); // ตอบ 200 เสมอเมื่อลายเซ็นถูก เพื่อไม่ให้ Meta ส่งซ้ำ
      }
      return send(res, 405, 'Method not allowed');
    }

    // Webhook จาก WeChat Official Account: /webhook/wechat/<id บัญชี>
    {
      const wm = /^\/webhook\/wechat\/([A-Za-z0-9-]{3,40})$/.exec(url.pathname);
      if (wm) {
        const acc = ext.byId('wechat', wm[1]);
        if (!acc || !acc.token) return send(res, 404, 'Not found');
        const ts = url.searchParams.get('timestamp') || ''; const nonce = url.searchParams.get('nonce') || '';
        const sigOk = ext.safeEq(url.searchParams.get('signature') || '', ext.wechatSignature(acc.token, ts, nonce));
        if (req.method === 'GET') {
          // WeChat ยืนยัน Server URL: ลายเซ็นถูก → ตอบ echostr กลับ
          if (!sigOk) { audit.log('wechat-webhook', 'webhook_rejected', 'ลายเซ็น WeChat ไม่ถูกต้อง (GET)', ip); return send(res, 403, 'Forbidden'); }
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          return res.end(url.searchParams.get('echostr') || '');
        }
        if (req.method === 'POST') {
          if (!sigOk) { audit.log('wechat-webhook', 'webhook_rejected', 'ลายเซ็น WeChat ไม่ถูกต้อง', ip); return send(res, 403, 'Forbidden'); }
          let xml = (await readRaw(req)).toString('utf8');
          const enc = ext.xmlField(xml, 'Encrypt');
          if (enc) {
            if (!acc.aesKey || !ext.safeEq(url.searchParams.get('msg_signature') || '', ext.wechatSignature(acc.token, ts, nonce, enc))) return send(res, 403, 'Forbidden');
            try { xml = ext.wechatDecrypt(acc, enc); } catch { return send(res, 400, 'Bad request'); }
          }
          // ตอบ success ทันที (WeChat รอไม่เกิน 5 วินาที) แล้วค่อยบันทึก
          res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('success');
          try { handleWeChatMessage(acc, xml); } catch (e) { console.error('wechat-webhook', e); }
          return;
        }
        return send(res, 405, 'Method not allowed');
      }
    }

    // Webhook จาก LINE Official Account (Messaging API)
    if (url.pathname === '/webhook/line') {
      if (req.method === 'POST') {
        const raw = await readRaw(req);
        const sig = String(req.headers['x-line-signature'] || '');
        // หลาย OA: หาบัญชีที่ Channel Secret ตรวจลายเซ็นผ่าน = ข้อความนี้เข้ามาที่ OA นั้น
        if (!channels.lineAccounts().some((a) => a.channelSecret)) {
          audit.log('line-webhook', 'webhook_rejected', 'ยังไม่ได้บันทึก LINE Channel Secret', ip);
          return send(res, 403, 'Forbidden');
        }
        const lineAcc = channels.lineAccountForSignature(raw, sig);
        if (!lineAcc) {
          audit.log('line-webhook', 'webhook_rejected', 'ลายเซ็น LINE ไม่ตรงกับ OA ใดในระบบ', ip);
          return send(res, 403, 'Forbidden');
        }
        let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'Bad request'); }
        try { await handleLineWebhook(body, lineAcc); } catch (e) { console.error('line-webhook', e); }
        return send(res, 200, 'OK');
      }
      return send(res, 405, 'Method not allowed');
    }

    // Webhook จาก WhatsApp Business (Cloud API)
    if (url.pathname === '/webhook/whatsapp') {
      if (req.method === 'GET') {
        const reqTok = url.searchParams.get('hub.verify_token') || '';
        const curTok = webhookToken();
        const storedTok = (meta.getSettings().whatsapp || {}).verifyToken || '';
        const okTok = url.searchParams.get('hub.mode') === 'subscribe' && (safeEq(reqTok, curTok) || (storedTok && safeEq(reqTok, storedTok)));
        if (!okTok) { audit.log('wa-webhook', 'webhook_rejected', 'Verify Token WhatsApp ไม่ถูกต้อง', ip); return send(res, 403, 'Forbidden'); }
        return send(res, 200, clean(url.searchParams.get('hub.challenge'), 100));
      }
      if (req.method === 'POST') {
        const raw = await readRaw(req);
        const chk = metaSignatureOk(req, raw);
        if (!chk.ok) { audit.log('wa-webhook', 'webhook_rejected', chk.reason, ip); return send(res, 403, 'Forbidden'); }
        let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'Bad request'); }
        try { await handleWhatsAppWebhook(body); } catch (e) { console.error('wa-webhook', e); }
        return send(res, 200, 'EVENT_RECEIVED');
      }
      return send(res, 405, 'Method not allowed');
    }

    // Public Health Check & Keep-Alive Ping (สำหรับ Render / Monitoring ป้องกัน spin down)
    if (url.pathname === '/api/ping' || url.pathname === '/healthz') {
      return send(res, 200, { ok: true, uptime: Math.round(process.uptime()), timestamp: Date.now() });
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const b = await readJson(req);
      const r = auth.login(b.username, b.password, ip);
      if (r.error) { audit.log(clean(b.username, 60) || '—', 'login_failed', r.error, ip); return send(res, r.status, { error: r.error }); }
      audit.log(r.user.username, 'login', 'เข้าสู่ระบบสำเร็จ', ip);
      return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader(r.token, 12 * 3600) });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const s = auth.getSession(req);
      if (s) { auth.destroy(s.token); audit.log(s.user.username, 'logout', 'ออกจากระบบ', ip); }
      return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader('', 0) });
    }

    if (url.pathname.startsWith('/api/')) {
      const session = auth.getSession(req);
      if (!session) return send(res, 401, { error: 'กรุณาเข้าสู่ระบบ' });
      return await api(req, res, url, session);
    }

    return serveStatic(req, res, url);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    const errMsg = e && e.message ? e.message : 'เกิดข้อผิดพลาดภายในระบบ';
    send(res, status, { error: errMsg });
  }
});

// เตือนการตั้งค่าที่จะทำให้ระบบบน production ไม่ปลอดภัยหรือข้อมูลหาย (พิมพ์ลง log ตอนเริ่มเซิร์ฟเวอร์)
function productionWarnings() {
  if (!config.isProduction) return;
  const warn = (m) => console.warn('  ⚠️  ' + m);
  if (!store.hasSupabase) warn('ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_KEY — บน Render ข้อมูล (แชท ลีด ผู้ใช้ การตั้งค่า) จะหายทุกครั้งที่ deploy หรือรีสตาร์ท');
  if (!process.env.ADMIN_PASSWORD) warn('ยังไม่ได้ตั้ง ADMIN_PASSWORD');
  if (!process.env.ANTHROPIC_API_KEY) warn('ยังไม่ได้ตั้ง ANTHROPIC_API_KEY — น้อง AI จะตอบได้แค่คำถามพื้นฐานตามคำสำคัญ');
  if (!process.env.WEBHOOK_VERIFY_TOKEN) warn('ยังไม่ได้ตั้ง WEBHOOK_VERIFY_TOKEN — ค่า Verify Token อาจเปลี่ยนหลังรีสตาร์ท');
  if (!config.secureCookie) warn('COOKIE_SECURE ปิดอยู่ — ควรเปิดเมื่อใช้งานผ่าน HTTPS');
}

// ไล่ทุกแชทครั้งเดียวตอนเริ่ม: ใส่ชื่อเซลล์ให้ข้อความที่ Meta ส่งมาเป็นชื่อเพจ และแก้ลีดที่เซลล์เป็นชื่อเพจ
function resolveRepsOnStartup() {
  try {
    const leads = store.read('leads.json', []);
    const messages = store.read('messages.json', {});
    const r = reps.resolveAll(leads, messages, store.read('pages.json', []));
    if (r.msgChanged) store.write('messages.json', messages);
    if (r.leadChanged) store.write('leads.json', leads);
    if (r.msgChanged || r.leadChanged) console.log('  👤 อัปเดตชื่อเซลล์ผู้ตอบแชทจากประวัติการมอบหมายแล้ว');
  } catch (e) { console.warn('  ⚠️  อัปเดตชื่อเซลล์ไม่สำเร็จ:', e.message); }
}

// ตอนเริ่มเซิร์ฟเวอร์บน Render: ตั้ง webhook ให้ Meta ส่งแชท/คอมเมนต์เข้ามาอัตโนมัติ (ทำซ้ำได้ ไม่มีผลเสีย)
// ปิดได้ด้วย AUTO_SUBSCRIBE_WEBHOOKS=0
function autoSubscribeWebhooks() {
  const base = String(process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  if (!base.startsWith('https://') || process.env.AUTO_SUBSCRIBE_WEBHOOKS === '0') return;
  const m = meta.getSettings().meta || {};
  if (!m.accessToken) return;
  setTimeout(() => {
    meta.subscribeWebhooks(base + '/webhook', webhookToken())
      .then((r) => {
        const okPages = r.pages.filter((x) => x.ok).length;
        console.log(`  🔔 Webhook ${base}/webhook — แอป: ${r.app.map((a) => `${a.object} ${a.ok ? 'OK' : 'ไม่สำเร็จ'}`).join(', ')} · เพจ ${okPages}/${r.pages.length}`);
        for (const x of [...r.app, ...r.pages]) if (!x.ok && x.error) console.warn('    ⚠️ ', x.object || x.pageName, x.error);
        audit.log('system', 'meta_subscribe_webhooks', `อัตโนมัติ: เพจ ${okPages}/${r.pages.length}`, '');
      })
      .catch((e) => console.warn('  ⚠️  ตั้ง webhook อัตโนมัติไม่สำเร็จ:', e.message));
  }, 5000);
}

// กันเซิร์ฟเวอร์ล่มทั้งตัวจาก error ที่หลุดมาจาก callback / promise
process.on('unhandledRejection', (err) => { console.error('[unhandledRejection]', err && err.stack ? err.stack : err); });
process.on('uncaughtException', (err) => { console.error('[uncaughtException]', err && err.stack ? err.stack : err); });

// ปิดเซิร์ฟเวอร์อย่างนุ่มนวลเมื่อ Render/Docker ส่ง SIGTERM (ตอน deploy ใหม่)
function shutdown(sig) {
  console.log(`[${sig}] กำลังปิดเซิร์ฟเวอร์...`);
  try { for (const c of realtimeClients) { try { c.res.end(); } catch {} } } catch {}
  // ส่งข้อมูลที่ยังค้างขึ้น Supabase ให้เสร็จก่อนปิด (กันแชทล่าสุดหายตอน deploy ใหม่)
  const done = () => process.exit(0);
  setTimeout(done, 9000).unref();
  server.close(() => { store.flushSupabase(7000).finally(done); });
}
if (require.main === module) {
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

server.timeout = 180000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

if (require.main === module) {
  const created = auth.ensureAdmin();
  store.ready.then(() => {
    server.listen(config.port, config.host, () => {
      console.log(`\n  Hair Clinic Ads Dashboard → http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
      if (created) {
        if (created.generated) console.log(`  สร้างผู้ใช้ "${config.adminUser}" แล้ว — รหัสผ่านชั่วคราว: ${created.password}\n  (ตั้ง ADMIN_PASSWORD ใน Environment เพื่อกำหนดเอง / เปลี่ยนรหัสหลังล็อกอินครั้งแรก)`);
        else console.log(`  สร้างผู้ใช้ "${config.adminUser}" แล้ว${config.usingDefaultPassword ? ' (รหัสผ่านเริ่มต้น: admin1234 — ระบบจะให้เปลี่ยนหลังล็อกอิน)' : ''}`);
      }
      productionWarnings();
      autoSubscribeWebhooks();
      resolveRepsOnStartup();
      try { const n = ops.migrateLegacyStatuses(); if (n) console.log(`  🔁 ย้ายลีด ${n} รายการจากสถานะที่ซ้ำไปสถานะใหม่แล้ว`); } catch (e) { console.warn('migrate status', e.message); }
      console.log(`  โหมดข้อมูล: ${providers.currentMode() === 'meta' ? 'Meta' : 'Demo'}\n`);
      
      // Background Cron: ตรวจสอบและส่งการแจ้งเตือน LINE & Web ตามรอบเวลาที่ผู้ใช้ตั้งค่าไว้ (ตรวจทุก 1 นาที)
      setInterval(async () => {
        try {
          const sched = store.read('notification_schedule.json', { enabled: false, intervalMinutes: 60, lastRun: null, target: 'all' });
          if (!sched.enabled) return;
          const nowMs = Date.now();
          const lastRunMs = sched.lastRun ? Date.parse(sched.lastRun) : 0;
          const intervalMs = (sched.intervalMinutes || 60) * 60 * 1000;
          if (nowMs - lastRunMs >= intervalMs) {
            const data = await providers.load(resolveRange({ range: '90d' }), { ads: false }).catch(() => null);
            if (!data) return;
            const fuData = ops.buildFollowups(data, providers.currentMode() === 'demo', {});
            const rows = fuData.rows || [];
            if (rows.length) {
              const overdueCount = rows.filter(r => r.overdue).length;
              const replyCount = rows.filter(r => r.kind === 'reply').length;
              let notifs = store.read('web_notifications.json', []);
              const autoNotif = {
                id: 'notif_auto_' + Date.now(),
                title: `⏰ รอบเตือนตามลูกค้าอัตโนมัติ (ทุก ${sched.intervalMinutes} นาที)`,
                message: `มีลูกค้าที่ต้องติดตาม ${rows.length} เคส (ลูกค้ารอตอบ ${replyCount} เคส, เกินกำหนด ${overdueCount} เคส)`,
                type: 'scheduled_alert',
                at: new Date().toISOString(),
                read: false,
                sender: 'ระบบอัตโนมัติ',
              };
              notifs.unshift(autoNotif);
              if (notifs.length > 100) notifs = notifs.slice(0, 100);
              store.write('web_notifications.json', notifs);

              // ส่ง LINE ด้วยหากเปิด LINE Notify
              try {
                const lineConf = line.getLineConfig();
                if (lineConf.enabled) {
                  line.sendLineNotification(`\n⏰ [เตือนตามลูกค้าอัตโนมัติ ทุก ${sched.intervalMinutes} นาที]\n📊 ลูกค้าที่ต้องตาม: ${rows.length} เคส\n⚡ รอคำตอบ: ${replyCount} เคส\n⚠️ เกินกำหนด: ${overdueCount} เคส\n🔗 ดูรายชื่อ: https://beq-ads-dashboard.onrender.com/#/followup`).catch(() => {});
                }
              } catch {}
            }
            sched.lastRun = new Date(nowMs).toISOString();
            store.write('notification_schedule.json', sched);
          }
        } catch (err) {
          console.error('[Scheduled interval error]', err.message);
        }
      }, 60 * 1000);

      // Background Cron: ตรวจสอบและส่งการแจ้งเตือน LINE สำหรับลูกค้านัดตามเกินกำหนด (ทุกๆ 1 ชั่วโมง)
      setInterval(async () => {
        try {
          const lineConf = line.getLineConfig();
          if (!lineConf.enabled || !lineConf.notifyOnOverdue) return;
          const data = await providers.load(resolveRange({ range: '90d' }), { ads: false }).catch(() => null);
          if (!data) return;
          const fuData = ops.buildFollowups(data, providers.currentMode() === 'demo', {});
          const notifiedStore = store.read('notified_alerts.json', {});
          const nowMs = Date.now();
          for (const row of (fuData.rows || [])) {
            if (row.overdue) {
              const lastNotified = notifiedStore[row.id] || 0;
              // เตือนไม่เกินวันละ 1 ครั้งต่อลูกค้า 1 คน
              if (nowMs - lastNotified > 24 * 3600 * 1000) {
                await line.sendLineNotification(line.formatOverdueAlert(row, { dueDate: row.dueDate, note: row.note }));
                notifiedStore[row.id] = nowMs;
              }
            }
          }
          store.write('notified_alerts.json', notifiedStore);
        } catch (err) {
          console.error('[Scheduled alert error]', err.message);
        }
      }, 60 * 60 * 1000);
    });
  }).catch((err) => {
    console.error('[Startup] Supabase init failed, starting anyway:', err.message);
    server.listen(config.port, config.host, () => {
      console.log(`\n  Hair Clinic Ads Dashboard → http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
      console.log(`  โหมดข้อมูล: ${providers.currentMode() === 'meta' ? 'Meta' : 'Demo'}\n`);
    });
  });
}

module.exports = { server };