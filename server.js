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
const config = require('./lib/config');
const auth = require('./lib/auth');
const store = require('./lib/store');
const meta = require('./lib/meta');
const providers = require('./lib/providers');
const ops = require('./lib/ops');
const line = require('./lib/line');
const audit = require('./lib/audit');
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
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
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

// Verify Token สำหรับ Webhook: ค่าคงที่ถาวร ไม่สุ่มใหม่ เพื่อไม่ให้หลุดเวลา Render รีสตาร์ท
function webhookToken() {
  if (process.env.WEBHOOK_VERIFY_TOKEN && process.env.WEBHOOK_VERIFY_TOKEN.trim()) {
    return process.env.WEBHOOK_VERIFY_TOKEN.trim();
  }
  const m = meta.getSettings().meta || {};
  if (m.webhookVerifyToken && m.webhookVerifyToken.trim()) return m.webhookVerifyToken.trim();
  const defaultToken = 'beq_webhook_verify_token_secure';
  meta.saveSettings({ meta: { webhookVerifyToken: defaultToken } });
  return defaultToken;
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
          if (pageName && !pageName.startsWith('Facebook ') && !pageName.startsWith('Instagram ') && pageId !== '111432947713900' && pageId !== '1040829309417229') {
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
      ops.addMessage(lead.id, {
        from: echo ? 'staff' : 'customer', text: msg.text || '[ไฟล์แนบ]', mid: msg.mid || undefined,
        at: ops.nowStamp(ev.timestamp || Date.now()), via: 'webhook',
      });
      if (!echo) {
        pushToSheets(lead, msg.text || '').catch(() => {});
      }
    }
  }
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
  const pages = store.read('pages.json', []);
  const name = clean(pageName, 80) || clean(pageId, 80);
  const id = clean(pageId, 50) || `PAGE-${name.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}`;
  const idx = pages.findIndex((p) => p.id === id);
  if (idx >= 0) {
    if (platform && (!pages[idx].platform || pages[idx].platform === 'Facebook')) {
      pages[idx].platform = platform;
    }
    if (name && (!pages[idx].name || pages[idx].name.startsWith('Facebook Page ') || pages[idx].name === id)) {
      pages[idx].name = name;
    }
  } else {
    pages.push({ id, name, platform: platform || 'Facebook', color: '#1877f2' });
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
async function handleLineWebhook(body) {
  const s = meta.getSettings();
  const ln = s.line || {};
  const lineToken = ln.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  for (const ev of body.events || []) {
    if (ev.type !== 'message' || !ev.message) continue;
    const userId = ev.source?.userId;
    if (!userId) continue;
    const text = ev.message.text || (ev.message.type === 'image' ? '[รูปภาพ]' : ev.message.type === 'video' ? '[วิดีโอ]' : '[ข้อความ]');
    const pageId = 'P-LINE';
    const pageName = ln.botName || 'LINE Official Account';
    recordPage(pageId, pageName, 'LINE');
    let leads = store.read('leads.json', []);
    let lead = leads.find((l) => l.psid === userId || l.phone === userId);
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
    ops.addMessage(lead.id, {
      from: 'customer', text, mid: ev.message.id || undefined,
      at: ops.nowStamp(ev.timestamp || Date.now()), via: 'line',
    });
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
  const s = meta.getSettings();
  const wa = s.whatsapp || {};
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const val = change.value;
      if (!val || !val.messages) continue;
      const contactMap = new Map((val.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const msg of val.messages) {
        const waId = msg.from;
        if (!waId) continue;
        const text = msg.text?.body || (msg.type ? `[${msg.type}]` : '[ข้อความ]');
        const pageId = 'P-WhatsApp';
        const pageName = wa.verifiedName || 'WhatsApp Business';
        recordPage(pageId, pageName, 'WhatsApp');
        let leads = store.read('leads.json', []);
        let lead = leads.find((l) => l.psid === waId || l.phone === waId);
        if (!lead) {
          const name = contactMap.get(waId) || `WhatsApp ${waId}`;
          lead = ops.findOrCreateLead({ psid: waId, pageId, name, adId: 'Direct', channel: 'WhatsApp', platform: 'WhatsApp', pageName }).lead;
          lead.phone = waId;
        }
        const ts = msg.timestamp ? parseInt(msg.timestamp, 10) * 1000 : Date.now();
        ops.addMessage(lead.id, {
          from: 'customer', text, mid: msg.id || undefined,
          at: ops.nowStamp(ts), via: 'whatsapp',
        });
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

async function api(req, res, url, session) {
  const route = `${req.method} ${url.pathname}`;
  const q = Object.fromEntries(url.searchParams);

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
    return send(res, 200, listFilters(await providers.load(range)));
  }

  if (route === 'GET /api/dashboard') {
    if (q.refresh) meta.clearCache();
    const range = resolveRange(q);
    const data = await providers.load(range);
    return send(res, 200, { mode: providers.currentMode(), metaError: data.metaError || null, ...buildDashboard(data, range, q) });
  }

  if (route === 'GET /api/board') {
    const range = resolveRange(q);
    const data = await providers.load(range);
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

    for (const p of targetPages) {
      try {
        const pPlat = p.platform || 'Facebook';
        const pPosts = await meta.fetchPostsAndComments(p.id, pPlat, p.fbPageId || null, 100);
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
    const data = await providers.load(range);
    return send(res, 200, { mode: providers.currentMode(), ...sla.buildSla(data, providers.currentMode() === 'demo', range, Date.now(), { platform: q.platform, page: q.page }) });
  }

  if (route === 'GET /api/inbox') {
    const range = resolveRange(q);
    const data = await providers.load(range);
    const out = buildInbox(data, range, { platform: q.platform, page: q.page });
    const isDemo = providers.currentMode() === 'demo';
    const byId = new Map(data.leads.map((l) => [l.id, l]));
    const overlay = store.read('messages.json', {});
    for (const r of out.rows) {
      const l = byId.get(r.id);
      if (l) {
        const msgs = ops.messagesFor(l, data, isDemo, overlay);
        r.last = msgs.length ? msgs[msgs.length - 1] : null; // ข้อความล่าสุด ใช้แสดงในรายการแชท
      }
    }
    out.rows.sort((a, b) => {
      const x = a.last ? a.last.at : a.date; const y = b.last ? b.last.at : b.date;
      return x === y ? 0 : x < y ? 1 : -1;
    });
    return send(res, 200, { mode: providers.currentMode(), ...out });
  }

  if (route === 'GET /api/inbox/chat') {
    const data = await providers.load(resolveRange({ range: '90d' }));
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
    const data = await providers.load(resolveRange({ range: '90d' }));
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
    audit.log(session.user.username, 'reply_sent', `${lead.id} ${lead.name} (${isDemo ? 'เดโม ไม่ได้ส่งจริง' : 'ส่งผ่าน Meta'}) ${text.length} ตัวอักษร`, clientIp(req));
    return send(res, 200, { ok: true, delivered: isDemo ? 'demo' : 'meta', message });
  }

  if (route === 'POST /api/lead/status') {
    const b = await readJson(req);
    if (!ops.STATUSES.includes(b.status)) return send(res, 400, { error: 'สถานะไม่ถูกต้อง' });
    const data = await providers.load(resolveRange({ range: '90d' }));
    const lead = data.leads.find((l) => l.id === b.id);
    if (!lead) return send(res, 404, { error: 'ไม่พบแชทนี้' });
    if (lead.status !== b.status) {
      const oldStatus = lead.status;
      ops.setStatus(lead.id, b.status);
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

  if (route === 'GET /api/notifications') {
    const data = await providers.load(resolveRange({ range: '90d' }));
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

    return send(res, 200, {
      total: overdueList.length + replyList.length,
      counts: {
        overdue: overdueList.length,
        reply: replyList.length,
        chase: chaseList.length,
        scheduled: (fuData.counts && fuData.counts.scheduled) || 0,
      },
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
    const data = await providers.load(resolveRange({ range: '90d' }));
    return send(res, 200, { mode: providers.currentMode(), ...ops.buildFollowups(data, providers.currentMode() === 'demo', q) });
  }

  if (route === 'POST /api/followups') {
    const b = await readJson(req);
    if (!isDate(b.dueDate)) return send(res, 400, { error: 'วันที่นัดไม่ถูกต้อง' });
    const data = await providers.load(resolveRange({ range: '90d' }));
    const lead = data.leads.find((l) => l.id === b.id);
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
    return send(res, 200, { mode: providers.currentMode(), ...ops.buildReview(await providers.load(range), range, q) });
  }

  if (route === 'POST /api/review') {
    const b = await readJson(req);
    const data = await providers.load(resolveRange({ range: '90d' }));
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
      const rep = clean(r.repId || r.rep || r.sales || r.owner, 30) || '';
      const dropReason = clean(r.dropReason || r.labels || r.reason || r.note, 100) || null;
      const status = normalizeStatus(r.status || r.stage || r.lead_status, dropReason || '');
      const value = Math.max(0, parseFloat(String(r.value || r.amount || r.price || 0).replace(/[^0-9.]/g, '')) || 0);
      const phone = clean(r.phone || r.phone_number || r.telephone, 40) || '';
      const email = clean(r.email || r.email_address, 80) || '';

      // ตรวจสอบแพลตฟอร์ม Instagram จาก channel, platform หรือชื่อเพจ
      const rawRowPlat = clean(r.platform, 30);
      const rawRowPage = clean(r.pageName || r.page, 80);
      const isIg = Boolean(
        (rawRowPlat && /ig|instagram/i.test(rawRowPlat)) ||
        (channel && /ig|instagram/i.test(channel)) ||
        (uploadPlatform && /ig|instagram/i.test(uploadPlatform)) ||
        (rawRowPage && /ig|instagram|dr\.nay_hairtransplant|beq_wellness/i.test(rawRowPage)) ||
        (uploadPageName && /ig|instagram|dr\.nay_hairtransplant|beq_wellness/i.test(uploadPageName))
      );

      let platform = isIg ? 'Instagram' : (uploadPlatform || rawRowPlat || channel);
      let pageName = uploadPageName || rawRowPage || (platform === 'Facebook' ? 'Pavicon Hair Clinic คลินิกปลูกผมมาตรฐานสากล' : `${platform} Channel`);

      // ค้นหา pageId และชื่อเพจจริงจาก pages.json ที่เชื่อมต่อกับ Meta (แยก Instagram และ Facebook ชัดเจน)
      let resolvedPageId = clean(r.pageId, 50);
      if (pageName) {
        const pNorm = pageName.toLowerCase().replace(/[\s_.-]/g, '');
        let matchedPage = knownPages.find((p) => {
          if (!p.name) return false;
          const kNorm = p.name.toLowerCase().replace(/[\s_.-]/g, '');
          const platMatch = isIg ? (p.platform === 'Instagram') : (p.platform !== 'Instagram');
          return platMatch && (kNorm === pNorm || kNorm.includes(pNorm) || pNorm.includes(kNorm));
        });

        // หากระบุว่าเป็น Instagram แต่ใส่ชื่อ Facebook Page มา (เช่น Dr. Nay Hair Transplant) ให้แมพไปหา Instagram Page คู่ของมัน
        if (isIg && !matchedPage) {
          const fbPage = knownPages.find((p) => p.platform === 'Facebook' && (p.name || '').toLowerCase().replace(/[\s_.-]/g, '').includes(pNorm));
          if (fbPage) {
            matchedPage = knownPages.find((p) => p.platform === 'Instagram' && p.fbPageId === fbPage.id);
          }
        }

        if (matchedPage) {
          resolvedPageId = matchedPage.id;
          pageName = matchedPage.name;
          platform = matchedPage.platform || platform;
        }
      }
      const pageId = resolvedPageId || clean(r.pageId, 50) || `P_${pageName.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}`;
      recordPage(pageId, pageName, platform);

      // ตรวจสอบว่ามี lead เดิมจาก Meta ในเพจเดียวกันหรือไม่ (ตามชื่อลูกค้า หรือเบอร์โทร)
      const cleanName = name.trim().toLowerCase();
      const existingMatch = existing.find((ex) => {
        const samePage = ex.pageId === pageId || String(ex.pageId) === String(pageId);
        if (!samePage) return false;
        if (cleanName && ex.name && ex.name.trim().toLowerCase() === cleanName) return true;
        if (phone && ex.phone && ex.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) return true;
        return false;
      });

      if (existingMatch) {
        // อัปเดตข้อมูลให้กับ lead จาก Meta เดิมเพื่อให้ข้อมูลแชทและตัวชี้วัดเชื่อมต่อกันสมบูรณ์
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
      }
    }
    if (added.length || b.replace) store.write('leads.json', existing);
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

  if (route === 'PUT /api/settings/line') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const cur = (meta.getSettings().line) || {};
    const next = {
      ...cur,
      channelId: clean(b.channelId, 50),
      connectedAt: new Date().toISOString(),
    };
    if (clean(b.channelSecret, 100)) next.channelSecret = clean(b.channelSecret, 100);
    else if (cur.channelSecret) next.channelSecret = cur.channelSecret;
    if (clean(b.channelAccessToken, 1000)) next.channelAccessToken = clean(b.channelAccessToken, 1000);
    else if (cur.channelAccessToken) next.channelAccessToken = cur.channelAccessToken;

    meta.saveSettings({ line: next });
    audit.log(session.user.username, 'line_settings_save', `ตั้งค่า LINE OA Channel: ${next.channelId || '—'}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'POST /api/settings/line/test') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const cur = (meta.getSettings().line) || {};
    const token = cur.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!token) return send(res, 200, { ok: false, error: 'กรุณาบันทึก Channel Access Token (long-lived) ก่อนกดทดสอบ' });
    try {
      const res = await fetch('https://api.line.me/v2/bot/info', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      const info = await res.json().catch(() => ({}));
      if (!res.ok) {
        return send(res, 200, { ok: false, error: info.message || `LINE API ตอบกลับสถานะ HTTP ${res.status}` });
      }
      const botName = info.displayName || 'LINE Official Account';
      const basicId = info.basicId || '';
      meta.saveSettings({
        line: {
          ...cur,
          botName,
          basicId,
          botUserId: info.userId || '',
          connectedAt: new Date().toISOString(),
        }
      });
      recordPage('P-LINE', `${botName}${basicId ? ' (' + basicId + ')' : ''}`, 'LINE');
      audit.log(session.user.username, 'line_test', `เชื่อมต่อ LINE OA สำเร็จ: ${botName} (${basicId})`, clientIp(req));
      return send(res, 200, { ok: true, bot: { displayName: botName, basicId, userId: info.userId }, settings: publicSettings() });
    } catch (e) {
      return send(res, 200, { ok: false, error: e.message || 'ไม่สามารถเชื่อมต่อ LINE Messaging API ได้' });
    }
  }

  if (route === 'PUT /api/settings/whatsapp') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const b = await readJson(req);
    const cur = (meta.getSettings().whatsapp) || {};
    const next = {
      ...cur,
      wabaId: clean(b.wabaId, 50),
      phoneId: clean(b.phoneId, 50),
      connectedAt: new Date().toISOString(),
    };
    if (clean(b.accessToken, 1000)) next.accessToken = clean(b.accessToken, 1000);
    else if (cur.accessToken) next.accessToken = cur.accessToken;

    meta.saveSettings({ whatsapp: next });
    audit.log(session.user.username, 'whatsapp_settings_save', `ตั้งค่า WhatsApp Business Phone ID: ${next.phoneId || '—'}`, clientIp(req));
    return send(res, 200, publicSettings());
  }

  if (route === 'POST /api/settings/whatsapp/test') {
    if (!auth.isAdmin(session.user)) return send(res, 403, { error: 'เฉพาะผู้ดูแล (admin) เท่านั้น' });
    const s = meta.getSettings();
    const wa = s.whatsapp || {};
    const m = s.meta || {};
    const token = wa.accessToken || m.accessToken || '';
    const phoneId = wa.phoneId || '';
    if (!phoneId) return send(res, 200, { ok: false, error: 'กรุณาระบุ Phone Number ID ก่อนกดทดสอบ' });
    if (!token) return send(res, 200, { ok: false, error: 'กรุณาระบุ Permanent Access Token ก่อนกดทดสอบ' });
    try {
      const version = m.apiVersion || config.metaApiVersion;
      const info = await meta.graph(phoneId, { fields: 'id,display_phone_number,verified_name,quality_rating' }, token, version);
      const verifiedName = info.verified_name || 'WhatsApp Business';
      const displayPhone = info.display_phone_number || phoneId;
      meta.saveSettings({
        whatsapp: {
          ...wa,
          verifiedName,
          displayPhone,
          connectedAt: new Date().toISOString(),
        }
      });
      recordPage('P-WhatsApp', `${verifiedName} (${displayPhone})`, 'WhatsApp');
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
    const color = clean(b.color, 20) || '#1877f2';
    const adAccountId = clean(b.adAccountId, 80) || '';
    const pageToken = clean(b.pageToken, 500) || '';
    if (!id || !name) return send(res, 400, { error: 'กรุณากรอก Page ID และชื่อเพจ' });

    let pages = store.read('pages.json', []);
    const idx = pages.findIndex((p) => p.id === id || String(p.id) === String(id));
    const pageItem = {
      id, name, platform, color, adAccountId,
      ...(pageToken ? { pageToken } : (idx >= 0 && pages[idx].pageToken ? { pageToken: pages[idx].pageToken } : {}))
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
    const convs = await meta.fetchFbConversations(pageId, Number(b.limit) || 400, plat, fbPageId);
      let leads = store.read('leads.json', []);
      let messages = store.read('messages.json', {});
      
      // แทนที่ข้อมูลเดิม: ลบ leads และ messages เดิมของเพจนี้ออกก่อนนำเข้าใหม่
      const oldLeadsOfPage = leads.filter((l) => l.pageId === pageId || String(l.pageId) === String(pageId));
      for (const oldLead of oldLeadsOfPage) {
        delete messages[oldLead.id];
      }
      leads = leads.filter((l) => l.pageId !== pageId && String(l.pageId) !== String(pageId));

      let importedLeads = 0;
      let importedMsgs = 0;

      for (const c of convs) {
        const parts = (c.participants && c.participants.data) || [];
        const isSelf = (pid) => String(pid) === String(pageId) || (fbPageId && String(pid) === String(fbPageId));
        const customerPart = parts.find((p) => !isSelf(p.id)) || parts[0];
        if (!customerPart) continue;
        const psid = String(customerPart.id);
        const custName = customerPart.name || ('ลูกค้า ' + psid.slice(-4));

        const actualPlat = detectConvPlatform(c, plat);
        let lead = leads.find((l) => l.psid === psid && (!l.pageId || l.pageId === pageId));
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
          const fromPage = m.from && (String(m.from.id) === String(pageId) || (fbPageId && String(m.from.id) === String(fbPageId)));
          const text = m.message || '';
          if (!text) continue;
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
            if (fromPage && staffName && !lead.repId) { lead.repId = staffName; }
            importedMsgs++;
          }
        }
      }
      for (const lid in messages) {
        if (Array.isArray(messages[lid])) {
          messages[lid].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
        }
      }
      store.write('messages.json', messages);
      store.write('leads.json', leads);
      audit.log(session.user.username, 'import_fb', 'นำเข้าบทสนทนาเพจ ' + pageName + ': ' + importedLeads + ' ลีด, ' + importedMsgs + ' ข้อความ', clientIp(req));
      return send(res, 200, { ok: true, importedLeads, importedMsgs, pageId, pageName });
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
        if (!name || name.startsWith('Page ') || id === '111432947713900' || id === '1040829309417229') continue;
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




                // ตรวจสอบว่า Facebook เพจนี้เชื่อมกับ Instagram Business Account หรือไม่
        if (fp.instagram_business_account && fp.instagram_business_account.id) {
          const ig = fp.instagram_business_account;
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
    const limit = Number(b.limit) || 400;
    const pages = store.read('pages.json', []);
    const targetPages = pages.filter((p) => (!p.platform || p.platform === 'Facebook' || p.platform === 'Instagram') && !p.id.startsWith('P-'));
    if (!targetPages.length) return send(res, 400, { error: 'ไม่พบเพจ Facebook หรือ Instagram ในระบบ กรุณากดดึงเพจจาก Meta ก่อน' });

    let leads = store.read('leads.json', []);
    let messages = store.read('messages.json', {});
    let totalImportedLeads = 0;
    let totalImportedMsgs = 0;
    const results = [];

    for (const page of targetPages) {
      const pPlat = page.platform || 'Facebook';
      try {
        const convs = await meta.fetchFbConversations(page.id, limit || 400, pPlat, page.fbPageId || null);
        
        // แทนที่ข้อมูลเดิม: ลบ leads และ messages เดิมของเพจนี้ออกก่อน
        const oldLeadsOfPage = leads.filter((l) => l.pageId === page.id || String(l.pageId) === String(page.id));
        for (const oldLead of oldLeadsOfPage) {
          delete messages[oldLead.id];
        }
        leads = leads.filter((l) => l.pageId !== page.id && String(l.pageId) !== String(page.id));

        let pLeads = 0;
        let pMsgs = 0;
        for (const c of convs) {
          const parts = (c.participants && c.participants.data) || [];
          const isSelf = (pid) => String(pid) === String(page.id) || (page.fbPageId && String(pid) === String(page.fbPageId));
          const customerPart = parts.find((p) => !isSelf(p.id)) || parts[0];
          if (!customerPart) continue;
          const psid = String(customerPart.id);
          const custName = customerPart.name || ('ลูกค้า ' + psid.slice(-4));

          const actualPlat = detectConvPlatform(c, pPlat);
          let lead = leads.find((l) => l.psid === psid && (!l.pageId || l.pageId === page.id));
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
            const fromPage = m.from && (String(m.from.id) === String(page.id) || (page.fbPageId && String(m.from.id) === String(page.fbPageId)));
            const text = m.message || '';
            if (!text) continue;
            const at = ops.nowStamp(m.created_time ? new Date(m.created_time).getTime() : Date.now());
            if (!currentLeadMsgs.some((x) => (m.id && x.mid === m.id) || (x.text === text && Math.abs(new Date(x.at) - new Date(at)) < 60000))) {
              currentLeadMsgs.push({
                from: fromPage ? 'staff' : 'customer',
                text,
                mid: m.id || undefined,
                at,
                via: 'import',
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
        store.write('messages.json', messages);
        store.write('leads.json', leads);
        totalImportedLeads += pLeads;
        totalImportedMsgs += pMsgs;
        results.push({ pageId: page.id, pageName: page.name, leads: pLeads, msgs: pMsgs, success: true });
      } catch (err) {
        results.push({ pageId: page.id, pageName: page.name, error: err.message, success: false });
      }
    }
    audit.log(session.user.username, 'import_fb_all', `นำเข้าบทสนทนาทุกเพจ: ${totalImportedLeads} ลีด, ${totalImportedMsgs} ข้อความ`, clientIp(req));
    const errors = results.filter((r) => !r.success).map((r) => `${r.pageName}: ${r.error}`);
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
          if (!name || name.startsWith('Page ') || id === '111432947713900' || id === '1040829309417229') continue;
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
          if (fp.instagram_business_account && fp.instagram_business_account.id) {
            const ig = fp.instagram_business_account;
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
      const dashData = await meta.load({ from: range.prevFrom, to: range.to });

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

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(config.publicDir, rel));
  if (!file.startsWith(config.publicDir + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
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
        const secret = (meta.getSettings().meta || {}).appSecret || process.env.META_APP_SECRET || '';
        const sig = String(req.headers['x-hub-signature-256'] || '');
        const good = secret && safeEq(sig, 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex'));
        if (!good) { audit.log('meta-webhook', 'webhook_rejected', secret ? 'ลายเซ็นไม่ถูกต้อง' : 'ยังไม่ได้บันทึก App Secret', ip); return send(res, 403, 'Forbidden'); }
        let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'Bad request'); }
        try { await handleWebhook(body); } catch (e) { console.error('webhook', e); }
        return send(res, 200, 'EVENT_RECEIVED'); // ตอบ 200 เสมอเมื่อลายเซ็นถูก เพื่อไม่ให้ Meta ส่งซ้ำ
      }
      return send(res, 405, 'Method not allowed');
    }

    // Webhook จาก LINE Official Account (Messaging API)
    if (url.pathname === '/webhook/line') {
      if (req.method === 'POST') {
        const raw = await readRaw(req);
        const secret = (meta.getSettings().line || {}).channelSecret || process.env.LINE_CHANNEL_SECRET || '';
        const sig = String(req.headers['x-line-signature'] || '');
        if (secret) {
          const expectedSig = crypto.createHmac('sha256', secret).update(raw).digest('base64');
          if (!safeEq(sig, expectedSig)) {
            audit.log('line-webhook', 'webhook_rejected', 'ลายเซ็น LINE ไม่ถูกต้อง', ip);
            return send(res, 403, 'Forbidden');
          }
        }
        let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'Bad request'); }
        try { await handleLineWebhook(body); } catch (e) { console.error('line-webhook', e); }
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
        let body; try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, 'Bad request'); }
        try { await handleWhatsAppWebhook(body); } catch (e) { console.error('wa-webhook', e); }
        return send(res, 200, 'EVENT_RECEIVED');
      }
      return send(res, 405, 'Method not allowed');
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

server.timeout = 180000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

if (require.main === module) {
  const created = auth.ensureAdmin();
  store.ready.then(() => {
    server.listen(config.port, config.host, () => {
      console.log(`\n  Hair Clinic Ads Dashboard → http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
      if (created) console.log(`  สร้างผู้ใช้ "${config.adminUser}" แล้ว${config.usingDefaultPassword ? ' (รหัสผ่านเริ่มต้น: admin1234 — ระบบจะให้เปลี่ยนหลังล็อกอิน)' : ''}`);
      console.log(`  โหมดข้อมูล: ${providers.currentMode() === 'meta' ? 'Meta' : 'Demo'}\n`);
      
      // Background Cron: ตรวจสอบและส่งการแจ้งเตือน LINE สำหรับลูกค้านัดตามเกินกำหนด (ทุกๆ 1 ชั่วโมง)
      setInterval(async () => {
        try {
          const lineConf = line.getLineConfig();
          if (!lineConf.enabled || !lineConf.notifyOnOverdue) return;
          const data = await providers.load(resolveRange({ range: '90d' })).catch(() => null);
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