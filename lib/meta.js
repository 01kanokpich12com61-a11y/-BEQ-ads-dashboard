
function optimizeThumbUrl(c) {
  if (!c) return null;
  // เลือกภาพความละเอียดสูงที่สุดจาก creative
  let url = c.image_url || c.thumbnail_url || null;
  if (!url && c.asset_feed_spec && c.asset_feed_spec.images && c.asset_feed_spec.images.length > 0) {
    url = c.asset_feed_spec.images[0].url || null;
  }
  if (!url) return null;
  // ลบ crop พารามิเตอร์ขนาดเล็ก _p64x64 และ stp crop ออก เพื่อให้ได้รูปขนาดความละเอียดสูงสุดจาก CDN
  return url
    .replace(/_p\d+x\d+/, '')
    .replace(/stp=c[\d.]+x[\d.]+f_dst-[^&]+_q\d+_tt\d+&?/, '')
    .replace(/stp=[^&]+&?/, '');
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
      fields: 'id,name,effective_status,status,updated_time,created_time,campaign{id,name},adset{id,name},creative{object_type,thumbnail_url,image_url,effective_object_story_id,asset_feed_spec,image_crops}',
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
      const knownPages = store.read('pages.json', []);
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
      thumb: optimizeThumbUrl(a.creative),
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


async function fetchFbConversations(pageId, limit = 100, platform = 'Facebook', fbPageId = null) {
  const m = getSettings().meta || {};
  if (!m.accessToken) throw new MetaError('ยังไม่ได้เชื่อม Meta');
  const version = m.apiVersion || config.metaApiVersion;

  const isIg = platform === 'Instagram';
  const allConvs = [];

  // สำหรับ Instagram: ลองดึง 2 ช่องทางตามโครงสร้าง Meta Graph API
  // ทางที่ 1: ดึงผ่าน IG User ID ตรงๆ {igId}/conversations
  // ทางที่ 2: ดึงผ่าน Facebook Page แม่ {fbPageId}/conversations?platform=instagram
  const endpoints = [];
  if (isIg) {
    endpoints.push({ id: pageId, params: { platform: 'instagram' }, usePageToken: fbPageId || pageId });
    if (fbPageId && fbPageId !== pageId) {
      endpoints.push({ id: fbPageId, params: { platform: 'instagram' }, usePageToken: fbPageId });
    }
    endpoints.push({ id: pageId, params: {}, usePageToken: fbPageId || pageId });
  } else {
    endpoints.push({ id: pageId, params: {}, usePageToken: pageId });
  }

  let lastErr = null;
  // สำหรับ Instagram เรียกตรงที่ {igId}/conversations โดยใช้ Page Token ของ Facebook ที่เชื่อมอยู่
  const targetEndpoints = isIg
    ? [
        { id: pageId, params: {}, usePageToken: fbPageId || pageId },
        { id: pageId, params: { platform: 'instagram' }, usePageToken: fbPageId || pageId },
        ...(fbPageId ? [{ id: fbPageId, params: { platform: 'instagram' }, usePageToken: fbPageId }] : []),
      ]
    : [{ id: pageId, params: {}, usePageToken: pageId }];

  for (const ep of targetEndpoints) {
    try {
      const token = await pageToken(ep.usePageToken, m);
      const initialLimit = isIg ? '5' : String(Math.min(limit, 100));
      const queryParams = {
        fields: isIg ? 'id,updated_time,participants,messages.limit(5){id,message,from,created_time}' : 'id,updated_time,participants,tags,custom_labels,messages.limit(15){id,message,from,created_time}',
        limit: initialLimit,
        ...ep.params,
      };
      let body;
      try {
        body = await graph(ep.id + '/conversations', queryParams, token, version, isIg ? 15000 : 35000, isIg ? 0 : 2);
      } catch (gErr) {
        if (gErr.message && (gErr.message.includes('reduce the amount of data') || gErr.message.includes('Timeout') || isIg)) {
          try {
            const lightParams = {
              fields: 'id,updated_time,participants',
              limit: isIg ? '5' : '25',
              ...ep.params,
            };
            body = await graph(ep.id + '/conversations', lightParams, token, version, isIg ? 15000 : 25000, 0);
          } catch (lightErr) {
            lastErr = lightErr;
            continue;
          }
        } else {
          throw gErr;
        }
      }
      if (body && Array.isArray(body.data) && body.data.length > 0) {
        allConvs.push(...body.data);

        let pagesFetched = 1;
        const perPage = Number(initialLimit) || 20;
        const maxPages = Math.max(5, Math.ceil(limit / perPage));
        while (pagesFetched < maxPages && body && body.paging && body.paging.next && allConvs.length < limit) {
          await new Promise((r) => setTimeout(r, 300));
          try {
            const res = await fetch(body.paging.next, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
            const pageData = await res.json();
            if (pageData && pageData.error) {
              console.warn('[Meta] Pagination warning:', pageData.error.message);
              break;
            }
            body = pageData;
            if (body && Array.isArray(body.data) && body.data.length > 0) {
              allConvs.push(...body.data);
              pagesFetched++;
            } else {
              break;
            }
          } catch (_) {
            break;
          }
        }
        return allConvs.slice(0, limit);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  if (allConvs.length > 0) return allConvs.slice(0, limit);
  if (lastErr && !isIg) throw lastErr;
  return [];
}

async function fetchManagedPages(customToken = null) {
  const m = getSettings().meta || {};
  const token = customToken || m.accessToken;
  if (!token) throw new MetaError('ยังไม่ได้ระบุ Access Token');
  const version = m.apiVersion || config.metaApiVersion;
  const res = await graph('me/accounts', {
    fields: 'id,name,access_token,category,tasks,instagram_business_account{id,username,name}',
    limit: '100',
  }, token, version);
  return (res && res.data) || [];
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
