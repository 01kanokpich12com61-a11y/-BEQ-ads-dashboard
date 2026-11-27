'use strict';
// ช่องทางเพิ่มเติม: TikTok (โฆษณา / แชท DM) และ WeChat Official Account — เพิ่มได้หลายบัญชี
const crypto = require('node:crypto');
const meta = require('./meta');

// ช่องที่ต้องกรอกของแต่ละช่องทาง (secret = เก็บเป็นความลับ ไม่ส่งกลับหน้าเว็บ)
const KINDS = {
  tiktokAds: { prefix: 'TTADS', platform: 'TikTok', fields: ['name', 'appId', 'secret', 'accessToken', 'advertiserId'], secrets: ['secret', 'accessToken'], required: ['accessToken', 'advertiserId'] },
  tiktokMsg: { prefix: 'TT', platform: 'TikTok', fields: ['name', 'clientKey', 'clientSecret', 'accessToken', 'businessId'], secrets: ['clientSecret', 'accessToken'], required: ['clientKey'] },
  wechat: { prefix: 'WC', platform: 'WeChat', fields: ['name', 'originalId', 'appId', 'appSecret', 'token', 'aesKey'], secrets: ['appSecret', 'token', 'aesKey'], required: ['appId', 'appSecret', 'token'] },
};

function all() { const s = meta.getSettings(); return s.extAccounts && typeof s.extAccounts === 'object' ? s.extAccounts : {}; }
function list(kind) { return Array.isArray(all()[kind]) ? all()[kind].filter(Boolean) : []; }
function save(kind, arr) { meta.saveSettings({ extAccounts: { ...all(), [kind]: arr } }); }
function byId(kind, id) { return list(kind).find((a) => a.id === id) || null; }

function upsert(kind, input) {
  const K = KINDS[kind];
  if (!K) throw new Error('ไม่รู้จักช่องทางนี้');
  const arr = list(kind);
  let acc = input.id ? arr.find((a) => a.id === input.id) : null;
  if (!acc) {
    const missing = K.required.filter((f) => !String(input[f] || '').trim());
    if (missing.length) { const e = new Error(`กรุณากรอก: ${missing.join(', ')}`); e.status = 400; throw e; }
    acc = { id: `${K.prefix}-${crypto.randomBytes(4).toString('hex')}`, connectedAt: null, createdAt: new Date().toISOString() };
    arr.push(acc);
  }
  for (const f of K.fields) {
    if (input[f] === undefined) continue;
    const v = String(input[f] || '').trim().slice(0, f === 'accessToken' ? 2000 : 200);
    if (K.secrets.includes(f) && !v) continue; // เว้นว่าง = ไม่เปลี่ยนความลับเดิม
    acc[f] = v;
  }
  if (!acc.name) acc.name = kind === 'wechat' ? 'WeChat Official Account' : kind === 'tiktokAds' ? 'TikTok Ads' : 'TikTok Business';
  save(kind, arr);
  return acc;
}
function update(kind, id, patch) { const arr = list(kind); const a = arr.find((x) => x.id === id); if (a) { Object.assign(a, patch); save(kind, arr); } return a; }
function remove(kind, id) { save(kind, list(kind).filter((a) => a.id !== id)); }

const mask = (t) => (t ? (String(t).length >= 12 ? `••••${String(t).slice(-4)}` : '••••') : '');
function publicAll() {
  const out = {};
  for (const [kind, K] of Object.entries(KINDS)) {
    out[kind] = list(kind).map((a) => {
      const o = { id: a.id, connectedAt: a.connectedAt || null, info: a.info || '' };
      for (const f of K.fields) {
        if (K.secrets.includes(f)) { o[`has_${f}`] = Boolean(a[f]); o[`hint_${f}`] = mask(a[f]); } else o[f] = a[f] || '';
      }
      return o;
    });
  }
  return out;
}

// ---------- WeChat ----------
const wcTokens = new Map(); // appId → { token, exp }
async function wechatAccessToken(acc, force = false) {
  const c = wcTokens.get(acc.appId);
  if (!force && c && c.exp > Date.now()) return c.token;
  const u = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(acc.appId)}&secret=${encodeURIComponent(acc.appSecret)}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) {
    const hint = j.errcode === 40164 || j.errcode === 61004 ? ' — ต้องเพิ่ม IP ของเซิร์ฟเวอร์ใน IP Whitelist ของ WeChat' : '';
    throw new Error(`WeChat: ${j.errmsg || 'ขอ access_token ไม่สำเร็จ'} (errcode ${j.errcode ?? r.status})${hint}`);
  }
  wcTokens.set(acc.appId, { token: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 7200) - 300) * 1000 });
  return j.access_token;
}

// ลายเซ็น WeChat: sha1 ของ [token, timestamp, nonce, (encrypt)] ที่เรียงแล้ว
function wechatSignature(...parts) { return crypto.createHash('sha1').update(parts.map(String).sort().join('')).digest('hex'); }
function safeEq(a, b) { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

function xmlField(xml, name) {
  const m = new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${name}>`).exec(xml);
  return m ? (m[1] !== undefined ? m[1] : m[2]) : '';
}
// โหมดปลอดภัย (Safe mode): ถอดรหัส AES-256-CBC ด้วย EncodingAESKey
function wechatDecrypt(acc, encrypted) {
  const key = Buffer.from(`${acc.aesKey}=`, 'base64');
  const d = crypto.createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  d.setAutoPadding(false);
  let buf = Buffer.concat([d.update(Buffer.from(encrypted, 'base64')), d.final()]);
  const pad = buf[buf.length - 1];
  if (pad >= 1 && pad <= 32) buf = buf.subarray(0, buf.length - pad);
  const len = buf.readUInt32BE(16);
  return buf.subarray(20, 20 + len).toString('utf8');
}

async function wechatSend(acc, openId, text) {
  const send = async (force) => {
    const token = await wechatAccessToken(acc, force);
    const r = await fetch(`https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ touser: openId, msgtype: 'text', text: { content: text } }), signal: AbortSignal.timeout(20000),
    });
    return r.json().catch(() => ({}));
  };
  let j = await send(false);
  if (j.errcode === 40001 || j.errcode === 42001) j = await send(true); // token หมดอายุ → ขอใหม่ 1 ครั้ง
  if (j.errcode) {
    const why = j.errcode === 45015 ? ' — เกิน 48 ชั่วโมงนับจากข้อความล่าสุดของลูกค้า' : j.errcode === 45047 ? ' — ส่งเกิน 5 ข้อความโดยลูกค้ายังไม่ตอบ' : '';
    throw new Error(`ส่งข้อความ WeChat ไม่สำเร็จ: ${j.errmsg || ''} (errcode ${j.errcode})${why}`);
  }
  return { mid: `wc_${Date.now()}` };
}

// ---------- TikTok Ads ----------
async function tiktokAdsTest(acc) {
  const u = `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([String(acc.advertiserId)]))}`;
  const r = await fetch(u, { headers: { 'Access-Token': acc.accessToken }, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (j.code !== 0) throw new Error(`TikTok: ${j.message || 'เชื่อมต่อไม่สำเร็จ'} (code ${j.code ?? r.status})`);
  const adv = (j.data && j.data.list && j.data.list[0]) || {};
  return { name: adv.name || '', currency: adv.currency || '', status: adv.status || '' };
}

module.exports = { KINDS, list, byId, upsert, update, remove, publicAll, wechatAccessToken, wechatSignature, safeEq, xmlField, wechatDecrypt, wechatSend, tiktokAdsTest };
