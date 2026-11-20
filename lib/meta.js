function optimizeThumbUrl(c) {
  if (!c) return null;
  // เลือกรูป thumbnail หรือ image_url โดยตรงโดยไม่ตัดแต่งพารามิเตอร์ของ Facebook CDN
  let url = c.image_url || c.thumbnail_url || null;
  if (!url && c.asset_feed_spec && c.asset_feed_spec.images && c.asset_feed_spec.images.length > 0) {
    url = c.asset_feed_spec.images[0].url || null;
  }
  return url || null;
}
'use strict';
// เชื่อมต่อ Meta Marketing API (Graph API)
// ใช้ Access Token แบบ System User (แนะนำ) หรือ Long-lived User Token
// สิทธิ์ที่ต้องมี: ads_read, read_insights  (ถ้าต้องการชื่อเพจ: pages_show_list / pages_read_engagement)
const config = require('./config');
const store = require('./store');
const { diffDays, stampMs } = require('./dates');

const CACHE_MS = 30 * 60 * 1000; // แคชไว้ 30 นาที เพื่อป้องกัน Rate limit ของ Meta
const cache = new Map();

class MetaError extends Error {}

function getSettings() {
  const fromFile = store.read('settings.json', {});
  const envMeta = {
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    appId: process.env.META_APP_ID,
    adAccountId: process.env.META_AD_ACCOUNT_ID,
    webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
  };
  const cleanEnvMeta = Object.fromEntries(Object.entries(envMeta).filter(([_, v]) => typeof v === 'string' && v.trim()));
  const mergedMeta = {
    webhookVerifyToken: 'beq_webhook_verify_token_secure',
    ...(fromFile.meta || {}),
    ...cleanEnvMeta,
  };
  return {
    ...fromFile,
    mode: fromFile.mode || (mergedMeta.accessToken ? 'meta' : 'demo'),
    meta: mergedMeta,
  };
}
function saveSettings(patch) {
  const cur = store.read('settings.json', {});
  store.write('settings.json', { ...cur, ...patch, meta: { ...(cur.meta || {}), ...(patch.meta || {}) } });
}

function normalizeAccountId(id) {
  const s = String(id || '').trim().replace(/^act_/i, '');
  return /^\d+$/.test(s) ? `act_${s}` : null;
}

async function graph(pathname, params, token, version, timeoutMs = 45000, maxRetries = 2) {
  const url = new URL(`https://graph.facebook.com/${version}/${pathname.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (err.name === 'TimeoutError' || String(err.message).toLowerCase().includes('timeout') || String(err.message).toLowerCase().includes('aborted')) {
        lastError = new MetaError('Meta Graph API ตอบสนองช้าเกินกำหนด (Timeout) — กรุณาลองใหม่อีกครั้ง');
      } else {
        lastError = err;
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw lastError;
    }

    let body;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok || body.error) {
      const e = body.error || {};
      if ((e.code === 2 || e.is_transient || res.status >= 500) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new MetaError(e.message || `Meta API error (HTTP ${res.status})`);
    }
    return body;
  }
  throw lastError || new MetaError('Meta Graph API ไม่ตอบสนอง');
}

async function graphAll(pathname, params, token, version, maxPages = 20) {
  let body = await graph(pathname, params, token, version);
  const rows = [...(body.data || [])];
  for (let i = 1; i < maxPages && body.paging && body.paging.next; i++) {
    await new Promise((r) => setTimeout(r, 200)); // หน่วงเวลาเล็กน้อยป้องกัน Rate limit
    const res = await fetch(body.paging.next, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) });
    body = await res.json();
    if (body.error) throw new MetaError(body.error.message);
    rows.push(...(body.data || []));
  }
  return rows;
}

function actionValue(actions, types) {
  if (!Array.isArray(actions)) return 0;
  for (const t of types) {
    const a = actions.find((x) => x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}

// แปลงแถว insights รายวันของ Meta เป็นรูปแบบที่ dashboard ใช้
function parseInsightRow(r) {
  return {
    date: r.date_start,
    adId: r.ad_id,
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    reach: Number(r.reach) || 0,
    clicks: Number(r.clicks) || 0, // ใช้ clicks (all) เหมือนที่ Ads Manager แสดงเป็น Clicks (all)
    messages: actionValue(r.actions, [
      'onsite_conversion.messaging_conversation_started_7d',
    ]),
    purchases: actionValue(r.actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']),
  };
}

function creativeKind(c) {
  const t = String((c && c.object_type) || '').toUpperCase();
  if (t === 'VIDEO') return 'VIDEO';
  if (t === 'PHOTO') return 'IMAGE';
  if (t === 'SHARE') return 'CAROUSEL';
  return t || 'IMAGE';
}

async function testConnection(meta) {
  const version = meta.apiVersion || config.metaApiVersion;
  const account = normalizeAccountId(meta.adAccountId);
  if (!meta.accessToken) throw new MetaError('ยังไม่ได้ใส่ Access Token');
  if (!account) throw new MetaError('Ad Account ID ต้องเป็นตัวเลข (เช่น 1234567890 หรือ act_1234567890)');
  const info = await graph(account, { fields: 'name,currency,account_status' }, meta.accessToken, version);
  return { name: info.name, currency: info.currency, status: info.account_status };
}

// แลก short-lived token เป็น long-lived (ต้องมี App ID + App Secret)
async function exchangeLongLived(meta) {
  const version = meta.apiVersion || config.metaApiVersion;
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', meta.appId);
  url.searchParams.set('client_secret', meta.appSecret);
  url.searchParams.set('fb_exchange_token', meta.accessToken);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const body = await res.json();
  if (!res.ok || body.error) throw new MetaError((body.error && body.error.message) || 'แลก token ไม่สำเร็จ');
  return body.access_token;
}

async function load({ from, to }) {
  const meta = getSettings().meta || {};
  const version = meta.apiVersion || config.metaApiVersion;
  const account = normalizeAccountId(meta.adAccountId);
  if (!meta.accessToken || !account) throw new MetaError('ยังไม่ได้เชื่อม Meta');

  const key = `${account}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  // ดึง ads และ insights ด้วย timeout 60 วิ และแบ่งหน้าทีละ 100 รายการ ป้องกัน Meta ประมวลผลช้าจน timeout
  const [adRows, insightRows] = await Promise.all([
    graphAll(`${account}/ads`, {
      fields: 'id,name,effective_status,status,updated_time,created_time,campaign{id,name},adset{id,name},creative{object_type,thumbnail_url,image_url,effective_object_story_id,asset_feed_spec,image_crops,effective_instagram_media_id}',
      effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED']),
      limit: '100',
    }, meta.accessToken, version, 15),
    graphAll(`${account}/insights`, {
      level: 'ad',
      time_increment: '1',
      time_range: JSON.stringify({ since: from, until: to }),
      fields: 'ad_id,spend,impressions,reach,clicks,actions',
      limit: '100',
    }, meta.accessToken, version, 15),
  ]);

  // ดึงรูปภาพ HD คมชัดสูงจาก Instagram Media ผ่าน Meta Batch API (ทีละ batch ละ 40 เพื่อไม่ให้เกิน limit)
  const hdThumbs = new Map();
  try {
    const igMediaIds = [];
    const seenIg = new Set();
    for (const a of adRows) {
      const igId = a.creative && a.creative.effective_instagram_media_id;
      if (igId && !seenIg.has(igId)) {
        seenIg.add(igId);
        igMediaIds.push(igId);
        if (igMediaIds.length >= 80) break;
      }
    }
    const chunks = [];
    for (let i = 0; i < igMediaIds.length; i += 40) {
      chunks.push(igMediaIds.slice(i, i + 40));
    }
    for (const chunk of chunks) {
      try {
        const form = new URLSearchParams();
        form.append('batch', JSON.stringify(chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=id,thumbnail_url,media_url` }))));
        const batchRes = await fetch(`https://graph.facebook.com/${version}/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${meta.accessToken}` },
          body: form,
          signal: AbortSignal.timeout(15000),
        });
        const batchItems = await batchRes.json();
        if (Array.isArray(batchItems)) {
          for (const it of batchItems) {
            if (it.code === 200 && it.body) {
              try {
                const b = JSON.parse(it.body);
                if (b.thumbnail_url) hdThumbs.set(b.id, b.thumbnail_url);
              } catch {}
            }
          }
        }
      } catch (chunkErr) {
        console.warn('[Meta] Chunk fetch warning:', chunkErr.message);
      }
    }
  } catch (err) {
    console.warn('[Meta] Could not fetch HD thumbnails in batch:', err.message);
  }

  const campaigns = new Map();
  const pageIds = new Set();
  // เรียงโฆษณาตามอัปเดตล่าสุดขึ้นก่อน (Active และ แคมเปญใหม่ล่าสุด)
  adRows.sort((x, y) => {
    const xActive = x.effective_status === 'ACTIVE' ? 1 : 0;
    const yActive = y.effective_status === 'ACTIVE' ? 1 : 0;
    if (xActive !== yActive) return yActive - xActive;
    return String(y.updated_time || y.id).localeCompare(String(x.updated_time || x.id));
  });
  function classifyCampaignPage(campName) {
    const c = String(campName || '').toLowerCase();
    if (c.includes('danai') || c.includes('dr-danai')) return '109373461849494';
    if (c.includes('beq')) return '122342237846683';
    return '239105462619075';
  }

  const knownPages = store.read('pages.json', []);
  const ads = adRows.map((a) => {
    if (a.campaign) campaigns.set(a.campaign.id, { id: a.campaign.id, name: a.campaign.name });
    const campName = a.campaign ? a.campaign.name : '';
    let pageId = classifyCampaignPage(campName);
    if (!pageId) {
      const story = (a.creative && a.creative.effective_object_story_id) || '';
      pageId = story.includes('_') ? story.split('_')[0] : ((a.creative && a.creative.actor_id) || '');
    }
    if (!pageId || pageId === 'unknown') {
      const fbPage = knownPages.find(p => (!p.platform || p.platform === 'Facebook') && p.id && !p.id.startsWith('P-'));
      pageId = fbPage ? fbPage.id : 'unknown';
    }
    pageIds.add(pageId);
    return {
      id: a.id,
      name: a.name,
      status: a.effective_status || a.status || 'ACTIVE',
      updatedTime: a.updated_time || a.created_time || '',
      campaignId: a.campaign ? a.campaign.id : 'none',
      adset: a.adset ? a.adset.name : '',
      pageId,
      pageName: ((knownPages.find(p => p.id === pageId) || {}).name) || pageId,
      platform: 'Facebook',
      agencyId: account,
      creative: creativeKind(a.creative),
      thumb: (a.creative && a.creative.effective_instagram_media_id && hdThumbs.get(a.creative.effective_instagram_media_id)) || optimizeThumbUrl(a.creative),
    };
  });

  const pages = [];
  for (const id of pageIds) {
    let name = id === 'unknown' ? 'Unknown page' : `Page ${id}`;
    try { if (id !== 'unknown') name = (await graph(id, { fields: 'name' }, meta.accessToken, version)).name || name; } catch { /* ไม่มีสิทธิ์อ่านชื่อเพจ ใช้ id แทน */ }
    pages.push({ id, name });
  }

  const data = {
    pages,
    agencies: [{ id: account, name: meta.accountName || account }],
    reps: [],
    campaigns: [...campaigns.values()],
    ads,
    daily: insightRows.map(parseInsightRow),
    // ข้อมูลแชท/ทีมขายไม่มีใน Ads API: ต้องมาจากระบบแชท (Inbox/Upload) ในขั้นถัดไป
    leads: store.read('leads.json', []),
    spanDays: diffDays(from, to) + 1,
  };
  cache.set(key, { at: Date.now(), data });
  try { store.write('meta_cache_' + account + '.json', data); } catch {}
  return data;
}

/* ---------- Messenger (ส่งข้อความ / ดึงชื่อลูกค้า) ---------- */
const pageTokens = new Map(); // pageId -> { token, at }

// ขอ Page Access Token จาก token หลัก (System User ที่ได้สิทธิ์ในเพจ + pages_messaging)
async function pageToken(pageId, m) {
  // 1. ตรวจสอบจากแคช
  const hit = pageTokens.get(pageId);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.token;

  // 2. ตรวจสอบจาก pages.json ที่เคยซิงค์ตอน discover-pages
  const pages = store.read('pages.json', []);
  const saved = pages.find((p) => p.id === pageId || String(p.id) === String(pageId));
  if (saved && saved.pageToken) {
    pageTokens.set(pageId, { token: saved.pageToken, at: Date.now() });
    return saved.pageToken;
  }

  // 3. ขอ Page Access Token จาก Graph API
  try {
    const r = await graph(pageId, { fields: 'access_token' }, m.accessToken, m.apiVersion || config.metaApiVersion);
    if (r && r.access_token) {
      pageTokens.set(pageId, { token: r.access_token, at: Date.now() });
      return r.access_token;
    }
  } catch (e) {
    // ถ้าขอไม่ได้ ข้ามไป fallback
  }

  // 4. Fallback: ใช้ System User Token / User Token ตรงๆ
  return m.accessToken;
}

async function fetchProfileName(pageId, psid) {
  try {
    const m = getSettings().meta || {};
    const r = await graph(psid, { fields: 'name' }, await pageToken(pageId, m), m.apiVersion || config.metaApiVersion);
    return r.name || null;
  } catch { return null; }
}

async function fetchPageInfo(pageId) {
  try {
    const m = getSettings().meta || {};
    if (!m.accessToken) return null;
    const version = m.apiVersion || config.metaApiVersion;
    const info = await graph(pageId, { fields: 'name' }, m.accessToken, version);
    return info && info.name ? { id: pageId, name: info.name } : null;
  } catch { return null; }
}

// ส่งข้อความตอบลูกค้าผ่าน Send API
// ภายใน 24 ชม. หลังลูกค้าทักล่าสุด = RESPONSE, 24 ชม.–7 วัน = HUMAN_AGENT (ต้องผ่าน App Review ฟีเจอร์ Human Agent)
async function sendMessage(lead, text, lastCustomerAt) {
  const m = getSettings().meta || {};
  if (!m.accessToken) throw new MetaError('ยังไม่ได้เชื่อม Meta');
  if (lead.channel !== 'Messenger') throw new MetaError(`ตอบผ่านระบบนี้ได้เฉพาะ Messenger (แชทนี้เป็น ${lead.channel || 'ช่องอื่น'})`);
  if (!lead.psid || !lead.pageId || lead.pageId === 'unknown') {
    throw new MetaError('แชทนี้ยังไม่มี PSID ของ Messenger — ต้องตั้ง Webhook ให้รับข้อความจากเพจก่อน (ดู docs/META-SETUP.md)');
  }
  const ageH = lastCustomerAt ? (Date.now() - stampMs(lastCustomerAt)) / 3600e3 : Infinity;
  if (ageH > 7 * 24) throw new MetaError('เกิน 7 วันนับจากข้อความล่าสุดของลูกค้า Meta ไม่อนุญาตให้ตอบผ่าน API (ให้ลูกค้าทักมาใหม่ หรือติดต่อทางช่องทางอื่น)');
  const body = { recipient: { id: lead.psid }, message: { text }, messaging_type: ageH <= 24 ? 'RESPONSE' : 'MESSAGE_TAG' };
  if (ageH > 24) body.tag = 'HUMAN_AGENT';
  const version = m.apiVersion || config.metaApiVersion;
  const token = await pageToken(lead.pageId, m);
  const res = await fetch(`https://graph.facebook.com/${version}/${lead.pageId}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  let out; try { out = await res.json(); } catch { out = {}; }
  if (!res.ok || out.error) {
    const e = out.error || {};
    throw new MetaError(e.message || `ส่งข้อความไม่สำเร็จ (HTTP ${res.status})`);
  }
  return { mid: out.message_id || null };
}


async function fetchFbConversations(pageId, limit = 500, platform = 'Facebook', fbPageId = null) {
  const m = getSettings().meta || {};
  if (!m.accessToken) throw new MetaError('ยังไม่ได้เชื่อม Meta');
  const version = m.apiVersion || config.metaApiVersion;
  const isIg = platform === 'Instagram';
  const isReduceErr = (e) => /reduce the amount of data/i.test((e && e.message) || '');

  // Instagram: ต้องใช้ Page Token ของเพจ Facebook ที่เชื่อมอยู่ และต้องมี platform=instagram เสมอ
  //   ทางที่ 1: {fbPageId}/conversations?platform=instagram   (แนะนำตามเอกสาร Meta)
  //   ทางที่ 2: {igId}/conversations?platform=instagram
  const targets = isIg
    ? [
        ...(fbPageId ? [{ id: fbPageId, params: { platform: 'instagram' }, tokenPage: fbPageId }] : []),
        { id: pageId, params: { platform: 'instagram' }, tokenPage: fbPageId || pageId },
      ]
    : [{ id: pageId, params: {}, tokenPage: pageId }];

  // ลำดับความหนักของ request: เริ่มเบา -> เบาที่สุด (ไม่มี nested messages)
  const msgFields = 'id,message,from,created_time';
  const levels = isIg
    ? [
        { fields: `id,updated_time,participants,messages.limit(5){${msgFields}}`, limit: 10 },
        { fields: 'id,updated_time,participants', limit: 10 },
      ]
    : [
        { fields: `id,updated_time,participants,tags,messages.limit(25){${msgFields}}`, limit: 25 },
        { fields: `id,updated_time,participants,messages.limit(10){${msgFields}}`, limit: 10 },
        { fields: 'id,updated_time,participants', limit: 10 },
      ];

  let lastErr = null;
  for (const ep of targets) {
    const token = await pageToken(ep.tokenPage, m);
    for (const lv of levels) {
      try {
        let body = await graph(ep.id + '/conversations', { fields: lv.fields, limit: String(lv.limit), ...ep.params }, token, version, 30000, 1);
        const all = [...(body.data || [])];
        for (let i = 1; i < 60 && body.paging && body.paging.next && all.length < limit; i++) {
          await new Promise((r) => setTimeout(r, 250));
          const res = await fetch(body.paging.next, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
          const next = await res.json();
          if (next.error) { if (!all.length) throw new MetaError(next.error.message); break; }
          body = next;
          all.push(...(body.data || []));
        }
        let convs = all.slice(0, limit);

        // ระดับเบาสุด (ไม่มี messages ในตัว) -> ดึงข้อความทีละ conversation แยก
        if (!/messages/.test(lv.fields)) {
          for (const c of convs) {
            try {
              const r = await graph(`${c.id}`, { fields: `messages.limit(10){${msgFields}}` }, token, version, 20000, 0);
              c.messages = r.messages || { data: [] };
            } catch { c.messages = { data: [] }; }
            await new Promise((r) => setTimeout(r, 100));
          }
        }
        return convs;
      } catch (e) {
        lastErr = e;
        if (isReduceErr(e) || /timeout/i.test(e.message || '')) continue; // ลองระดับที่เบากว่า
        break; // error อื่น (สิทธิ์/ token / endpoint) -> ไปลอง endpoint ถัดไป
      }
    }
  }
  // ห้ามกลืน error ของ Instagram อีกต่อไป เพื่อให้เห็นสาเหตุจริงบนหน้าจอ
  if (lastErr) throw new MetaError(`${isIg ? 'Instagram' : 'Facebook'} (${pageId}): ${lastErr.message}`);
  return [];
}

async function fetchManagedPages(customToken = null) {
  const m = getSettings().meta || {};
  const token = customToken || m.accessToken;
  if (!token) throw new MetaError('ยังไม่ได้ระบุ Access Token');
  const version = m.apiVersion || config.metaApiVersion;
  const isReduceErr = (e) => /reduce the amount of data/i.test((e && e.message) || '');

  // 1) ขอทีละน้อย (limit 10) พร้อม IG nested แล้ววนหน้า — ถ้า Meta ยังบ่นว่าข้อมูลเยอะ ให้ลดลงอัตโนมัติ
  const attempts = [
    { fields: 'id,name,access_token,instagram_business_account{id,username,name}', limit: '10' },
    { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '5' },
    { fields: 'id,name,access_token', limit: '5' },
  ];
  let pages = null, lastErr = null;
  for (const a of attempts) {
    try {
      pages = await graphAll('me/accounts', a, token, version, 30);
      break;
    } catch (e) {
      lastErr = e;
      if (!isReduceErr(e)) throw e;
    }
  }
  if (!pages) throw lastErr;

  // 2) ถ้าไม่ได้ IG มาในรอบแรก (ต้องลดเหลือ field พื้นฐาน) ให้ถามหา IG ของแต่ละเพจแยกทีละเพจ
  for (const p of pages) {
    if (p.instagram_business_account !== undefined) continue;
    try {
      const r = await graph(p.id, { fields: 'instagram_business_account{id,username}' }, p.access_token || token, version);
      if (r && r.instagram_business_account) p.instagram_business_account = r.instagram_business_account;
    } catch { /* เพจนี้ไม่มี IG หรืออ่านไม่ได้ */ }
  }
  return pages;
}

function clearCache() { cache.clear(); pageTokens.clear(); }


async function fetchPostsAndComments(pageId, platform = 'Facebook', fbPageId = null, limit = 100) {
  const m = getSettings().meta || {};
  if (!m.accessToken) throw new MetaError('ยังไม่ได้เชื่อม Meta');
  const version = m.apiVersion || config.metaApiVersion;
  const isIg = platform === 'Instagram';

  const token = await pageToken(fbPageId || pageId, m);
  const posts = [];
  const seenIds = new Set();

  if (isIg) {
    // Instagram Media & Comments (วน Paging ดึงได้สูงสุด 100 โพสต์)
    try {
      let nextUrl = `${pageId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,comments.limit(30){id,text,timestamp,from}&limit=25`;
      let fetched = 0;
      while (nextUrl && fetched < limit) {
        let res;
        if (nextUrl.startsWith('http')) {
          const r = await fetch(nextUrl, { signal: AbortSignal.timeout(20000) });
          res = await r.json();
        } else {
          res = await graph(nextUrl, {}, token, version, 20000);
        }
        const items = (res && res.data) || [];
        if (!items.length) break;

        for (const item of items) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          const commentsList = (item.comments && item.comments.data) || [];
          const normComments = [];
          for (const c of commentsList) {
            const fromUser = (c.from && c.from.username) || 'ผู้ใช้ Instagram';
            const repliesList = (c.replies && c.replies.data) || [];
            const normReplies = repliesList.map(r => ({
              id: r.id,
              text: r.text || '',
              from: (r.from && r.from.username) || 'ทีมงาน',
              timestamp: r.timestamp || '',
              isStaff: true,
            }));
            normComments.push({
              id: c.id,
              text: c.text || '',
              from: fromUser,
              timestamp: c.timestamp || '',
              replies: normReplies,
              replied: normReplies.length > 0,
            });
          }

          posts.push({
            id: item.id,
            platform: 'Instagram',
            pageId,
            content: item.caption || '(ไม่มีข้อความแคปชั่น)',
            mediaUrl: item.media_url || null,
            permalink: item.permalink || '',
            timestamp: item.timestamp || '',
            comments: normComments,
          });
          fetched++;
        }
        nextUrl = res.paging && res.paging.next ? res.paging.next : null;
      }
    } catch (e) {
      console.error('Error fetching IG media:', e.message);
      throw e;
    }
  } else {
    // Facebook: กวาดทั้ง Published Posts, Ads Posts (Dark Post / Unpublished) และ Feed
    try {
      const endpoints = [
        `${pageId}/published_posts`,
        `${pageId}/ads_posts`,
        `${pageId}/feed`
      ];

      for (const ep of endpoints) {
        try {
          let nextUrl = `${ep}?fields=id,message,story,created_time,permalink_url,comments.limit(30){id,message,created_time,from}&limit=25`;
          let epFetched = 0;
          const maxPerEp = Math.ceil(limit / 2);

          while (nextUrl && epFetched < maxPerEp && posts.length < limit) {
            let res;
            if (nextUrl.startsWith('http')) {
              const r = await fetch(nextUrl, { signal: AbortSignal.timeout(20000) });
              res = await r.json();
            } else {
              res = await graph(nextUrl, {}, token, version, 20000);
            }
            const items = (res && res.data) || [];
            if (!items.length) break;

            for (const item of items) {
              if (seenIds.has(item.id)) continue;
              seenIds.add(item.id);

              const commentsList = (item.comments && item.comments.data) || [];
              const normComments = [];
              for (const c of commentsList) {
                const fromId = c.from && c.from.id;
                const fromName = (c.from && c.from.name) || 'ผู้ใช้ Facebook';
                const isStaffComment = fromId && String(fromId) === String(pageId);

                const subReplies = (c.comments && c.comments.data) || [];
                const normReplies = subReplies.map(r => ({
                  id: r.id,
                  text: r.message || '',
                  from: (r.from && r.from.name) || 'ทีมงาน',
                  timestamp: r.created_time || '',
                  isStaff: r.from && String(r.from.id) === String(pageId),
                }));

                const hasStaffReply = normReplies.some(r => r.isStaff) || isStaffComment;

                normComments.push({
                  id: c.id,
                  text: c.message || '',
                  from: fromName,
                  timestamp: c.created_time || '',
                  isStaff: isStaffComment,
                  replies: normReplies,
                  replied: hasStaffReply,
                });
              }

              posts.push({
                id: item.id,
                platform: 'Facebook',
                pageId,
                content: item.message || item.story || '(ไม่มีข้อความโพสต์)',
                permalink: item.permalink_url || '',
                timestamp: item.created_time || '',
                comments: normComments,
              });
              epFetched++;
            }
            nextUrl = res.paging && res.paging.next ? res.paging.next : null;
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error('Error fetching FB posts:', e.message);
      throw e;
    }
  }

  return posts;
}

module.exports = {
  MetaError, load, testConnection, exchangeLongLived, getSettings, saveSettings, clearCache,
  normalizeAccountId, parseInsightRow, actionValue, sendMessage, fetchProfileName, fetchPageInfo, fetchFbConversations, fetchManagedPages, fetchPostsAndComments, graph,
};
