'use strict';

function optimizeThumbUrl(c) {
  if (!c) return null;
  let url = c.image_url || c.thumbnail_url || null;
  if (!url && c.object_story_spec) {
    const oss = c.object_story_spec;
    url = (oss.video_data && oss.video_data.image_url)
      || (oss.link_data && oss.link_data.picture)
      || (oss.photo_data && oss.photo_data.url)
      || null;
  }
  if (!url && c.asset_feed_spec) {
    if (Array.isArray(c.asset_feed_spec.images) && c.asset_feed_spec.images.length > 0) {
      url = c.asset_feed_spec.images[0].url || null;
    }
    if (!url && Array.isArray(c.asset_feed_spec.videos) && c.asset_feed_spec.videos.length > 0) {
      url = c.asset_feed_spec.videos[0].thumbnail_url || null;
    }
  }
  return url || null;
}

function extractVideoId(c) {
  if (!c) return null;
  if (c.video_id) return String(c.video_id);
  if (c.object_story_spec && c.object_story_spec.video_data && c.object_story_spec.video_data.video_id) {
    return String(c.object_story_spec.video_data.video_id);
  }
  if (c.asset_feed_spec && Array.isArray(c.asset_feed_spec.videos) && c.asset_feed_spec.videos.length > 0 && c.asset_feed_spec.videos[0].video_id) {
    return String(c.asset_feed_spec.videos[0].video_id);
  }
  return null;
}
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

function creativeKind(c, videoUrl = null) {
  if (videoUrl || extractVideoId(c)) return 'VIDEO';
  const t = String((c && c.object_type) || '').toUpperCase();
  if (t === 'VIDEO') return 'VIDEO';
  if (c && c.object_story_spec && c.object_story_spec.link_data && Array.isArray(c.object_story_spec.link_data.child_attachments) && c.object_story_spec.link_data.child_attachments.length > 1) {
    return 'CAROUSEL';
  }
  if (t === 'PHOTO') return 'IMAGE';
  if (t === 'SHARE') return 'CAROUSEL';
  return t || 'IMAGE';
}

async function fetchAdAccounts(customToken = null) {
  const m = getSettings().meta || {};
  const token = customToken || m.accessToken;
  if (!token) throw new MetaError('ยังไม่ได้ระบุ Access Token');
  const version = m.apiVersion || config.metaApiVersion;
  const res = await graph('me/adaccounts', {
    fields: 'id,account_id,name,currency,account_status',
    limit: '50',
  }, token, version);
  return (res && res.data) || [];
}

async function testConnection(meta) {
  const version = meta.apiVersion || config.metaApiVersion;
  if (!meta.accessToken) throw new MetaError('ยังไม่ได้ใส่ Access Token');
  let account = normalizeAccountId(meta.adAccountId);
  if (!account) {
    // ลองค้นหา Ad Account อัตโนมัติจาก Token
    const accs = await fetchAdAccounts(meta.accessToken).catch(() => []);
    if (accs.length > 0) {
      const activeAcc = accs.find((a) => a.account_status === 1) || accs[0];
      account = normalizeAccountId(activeAcc.account_id || activeAcc.id);
    }
  }
  if (!account) throw new MetaError('Ad Account ID ต้องเป็นตัวเลข (เช่น 1234567890 หรือ act_1234567890)');
  const info = await graph(account, { fields: 'name,currency,account_status' }, meta.accessToken, version);
  return { name: info.name, currency: info.currency, status: info.account_status, adAccountId: account.replace(/^act_/, '') };
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
  const knownPages = store.read('pages.json', []);
  let primaryAccount = normalizeAccountId(meta.adAccountId);
  if (!primaryAccount) {
    const pageAcc = knownPages.map((p) => normalizeAccountId(p.adAccountId)).find(Boolean);
    if (pageAcc) primaryAccount = pageAcc;
  }
  if (!meta.accessToken || !primaryAccount) throw new MetaError('ยังไม่ได้เชื่อม Meta');

  // รวบรวม Ad Account ทั้งหมด (Ad Account หลัก + Ad Account เฉพาะเพจใน pages.json)
  const accountSet = new Set([primaryAccount]);
  const accountToPageId = new Map();
  for (const p of knownPages) {
    const pAcc = normalizeAccountId(p.adAccountId);
    if (pAcc) {
      accountSet.add(pAcc);
      if (p.id && !accountToPageId.has(pAcc)) accountToPageId.set(pAcc, p.id);
    }
  }
  const accounts = [...accountSet];

  const key = `${accounts.join(',')}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  // ดึง ads และ insights จากทุก Ad Account ที่ผูกไว้
  const adRows = [];
  const insightRows = [];
  const seenAdIds = new Set();

  for (const acc of accounts) {
    try {
      const [accAds, accInsights] = await Promise.all([
        graphAll(`${acc}/ads`, {
          fields: 'id,name,effective_status,status,updated_time,created_time,campaign{id,name},adset{id,name},creative{id,name,object_type,thumbnail_url,image_url,video_id,object_story_spec,effective_object_story_id,asset_feed_spec,image_crops,effective_instagram_media_id}',
          effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED']),
          limit: '100',
        }, meta.accessToken, version, 15),
        graphAll(`${acc}/insights`, {
          level: 'ad',
          time_increment: '1',
          time_range: JSON.stringify({ since: from, until: to }),
          fields: 'ad_id,spend,impressions,reach,clicks,actions',
          limit: '100',
        }, meta.accessToken, version, 15),
      ]);
      for (const a of accAds) {
        if (!seenAdIds.has(a.id)) {
          seenAdIds.add(a.id);
          a._adAccount = acc;
          adRows.push(a);
        }
      }
      insightRows.push(...accInsights);
    } catch (accErr) {
      if (acc === primaryAccount && accounts.length === 1) throw accErr;
      console.warn(`[Meta] Warning loading Ad Account ${acc}:`, accErr.message);
    }
  }

  // 1) ดึงรูปภาพ HD และวิดีโอจาก Instagram Media ผ่าน Meta Batch API
  const igMediaMap = new Map(); // igId -> { thumb, videoUrl, mediaType }
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
    for (let i = 0; i < igMediaIds.length; i += 40) {
      const chunk = igMediaIds.slice(i, i + 40);
      try {
        const form = new URLSearchParams();
        form.append('batch', JSON.stringify(chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=id,media_type,thumbnail_url,media_url` }))));
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
                const mType = String(b.media_type || '').toUpperCase();
                igMediaMap.set(b.id, {
                  thumb: b.thumbnail_url || b.media_url || null,
                  videoUrl: mType === 'VIDEO' ? (b.media_url || null) : null,
                  mediaType: mType,
                });
              } catch {}
            }
          }
        }
      } catch (chunkErr) {
        console.warn('[Meta] IG chunk fetch warning:', chunkErr.message);
      }
    }
  } catch (err) {
    console.warn('[Meta] Could not fetch IG media in batch:', err.message);
  }

  // 2) ดึงข้อมูลวิดีโอ (source MP4 URL + HD picture) จาก Facebook Video ID ผ่าน Meta Batch API
  const fbVideoMap = new Map(); // videoId -> { thumb, videoUrl }
  try {
    const videoIds = [];
    const seenVid = new Set();
    for (const a of adRows) {
      const vid = extractVideoId(a.creative);
      if (vid && !seenVid.has(vid)) {
        seenVid.add(vid);
        videoIds.push(vid);
        if (videoIds.length >= 80) break;
      }
    }
    for (let i = 0; i < videoIds.length; i += 40) {
      const chunk = videoIds.slice(i, i + 40);
      try {
        const form = new URLSearchParams();
        form.append('batch', JSON.stringify(chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=id,source,picture,thumbnails{uri,width,height,is_preferred}` }))));
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
                let bestThumb = b.picture || null;
                const tList = (b.thumbnails && b.thumbnails.data) || [];
                if (tList.length > 0) {
                  const pref = tList.find(t => t.is_preferred && t.uri) || [...tList].sort((x, y) => (y.width || 0) - (x.width || 0))[0];
                  if (pref && pref.uri) bestThumb = pref.uri;
                }
                fbVideoMap.set(String(b.id), {
                  thumb: bestThumb,
                  videoUrl: b.source || null,
                });
              } catch {}
            }
          }
        }
      } catch (vErr) {
        console.warn('[Meta] Video chunk fetch warning:', vErr.message);
      }
    }
  } catch (err) {
    console.warn('[Meta] Could not fetch FB videos in batch:', err.message);
  }

  // 3) ดึงรูปความละเอียดสูงและวิดีโอจาก Page Post (effective_object_story_id) สำหรับโฆษณาที่ยังไม่มี source
  const storyMediaMap = new Map(); // storyId -> { thumb, videoUrl }
  try {
    const storyIds = [];
    const seenStory = new Set();
    for (const a of adRows) {
      const c = a.creative;
      const storyId = c && c.effective_object_story_id;
      const vid = extractVideoId(c);
      const hasVidSource = vid && fbVideoMap.has(vid) && fbVideoMap.get(vid).videoUrl;
      const igId = c && c.effective_instagram_media_id;
      const hasIgMedia = igId && igMediaMap.has(igId);
      if (storyId && !seenStory.has(storyId) && !hasVidSource && !hasIgMedia) {
        seenStory.add(storyId);
        storyIds.push(storyId);
        if (storyIds.length >= 60) break;
      }
    }
    for (let i = 0; i < storyIds.length; i += 30) {
      const chunk = storyIds.slice(i, i + 30);
      try {
        const form = new URLSearchParams();
        form.append('batch', JSON.stringify(chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=id,full_picture,source,attachments{media_type,media}` }))));
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
                const att = b.attachments && Array.isArray(b.attachments.data) ? b.attachments.data[0] : null;
                const attImg = att && att.media && att.media.image ? att.media.image.src : null;
                const attVid = att && att.media ? att.media.source : null;
                storyMediaMap.set(String(b.id), {
                  thumb: b.full_picture || attImg || null,
                  videoUrl: b.source || attVid || null,
                });
              } catch {}
            }
          }
        }
      } catch {}
    }
  } catch {}

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
    if (c.includes('pavicon')) return '239105462619075';
    return '';
  }

  const ads = adRows.map((a) => {
    if (a.campaign) campaigns.set(a.campaign.id, { id: a.campaign.id, name: a.campaign.name });
    const campName = a.campaign ? a.campaign.name : '';
    let pageId = classifyCampaignPage(campName);
    if (!pageId && a._adAccount && accountToPageId.has(a._adAccount)) {
      pageId = accountToPageId.get(a._adAccount);
    }
    if (!pageId) {
      const story = (a.creative && a.creative.effective_object_story_id) || '';
      pageId = story.includes('_') ? story.split('_')[0] : ((a.creative && a.creative.actor_id) || '');
    }
    if (!pageId || pageId === 'unknown') {
      const fbPage = knownPages.find(p => (!p.platform || p.platform === 'Facebook') && p.id && !p.id.startsWith('P-'));
      pageId = fbPage ? fbPage.id : 'unknown';
    }
    pageIds.add(pageId);

    const c = a.creative || {};
    const igId = c.effective_instagram_media_id;
    const vid = extractVideoId(c);
    const storyId = c.effective_object_story_id;
    const igMedia = igId ? igMediaMap.get(igId) : null;
    const fbVideo = vid ? fbVideoMap.get(vid) : null;
    const storyMedia = storyId ? storyMediaMap.get(storyId) : null;

    const videoUrl = (igMedia && igMedia.videoUrl)
      || (fbVideo && fbVideo.videoUrl)
      || (storyMedia && storyMedia.videoUrl)
      || null;
    const thumb = (igMedia && igMedia.thumb)
      || (fbVideo && fbVideo.thumb)
      || (storyMedia && storyMedia.thumb)
      || optimizeThumbUrl(c);

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
      agencyId: a._adAccount || primaryAccount,
      creative: creativeKind(c, videoUrl),
      thumb,
      videoUrl,
      videoId: vid || null,
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
    agencies: accounts.map((acc) => ({ id: acc, name: acc === primaryAccount ? (meta.accountName || acc) : acc })),
    reps: [],
    campaigns: [...campaigns.values()],
    ads,
    daily: insightRows.map(parseInsightRow),
    // ข้อมูลแชท/ทีมขายไม่มีใน Ads API: ต้องมาจากระบบแชท (Inbox/Upload) ในขั้นถัดไป
    leads: store.read('leads.json', []),
    spanDays: diffDays(from, to) + 1,
  };
  cache.set(key, { at: Date.now(), data });
  try { store.write('meta_cache_' + primaryAccount + '.json', data); } catch {}
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

// ส่งข้อความตอบลูกค้าผ่าน Send API (รองรับ Messenger, Instagram Direct, LINE OA, WhatsApp Cloud API)
async function sendMessage(lead, text, lastCustomerAt) {
  const s = getSettings();
  const m = s.meta || {};
  const ch = String(lead.channel || lead.platform || '').toLowerCase();

  // 1) กรณี LINE Official Account (Messaging API)
  if (ch.includes('line')) {
    const ln = s.line || {};
    const lineToken = ln.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!lineToken) throw new MetaError('ยังไม่ได้ตั้งค่า LINE Channel Access Token ในหน้า Settings');
    if (!lead.psid) throw new MetaError('แชท LINE นี้ยังไม่มี User ID จาก Webhook ของ LINE OA');
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lineToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: lead.psid, messages: [{ type: 'text', text }] }),
      signal: AbortSignal.timeout(20000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new MetaError(out.message || `ส่งข้อความ LINE ไม่สำเร็จ (HTTP ${res.status})`);
    return { mid: (out.sentMessages && out.sentMessages[0] && out.sentMessages[0].id) || `line_${Date.now()}` };
  }

  // 2) กรณี WhatsApp Business (Cloud API)
  if (ch.includes('what') || ch.includes('wa')) {
    const wa = s.whatsapp || {};
    const waToken = wa.accessToken || m.accessToken || '';
    const phoneId = wa.phoneId || '';
    const recipientPhone = lead.psid || lead.phone || '';
    if (!waToken || !phoneId) throw new MetaError('ยังไม่ได้ตั้งค่า WhatsApp Phone Number ID และ Access Token ในหน้า Settings');
    if (!recipientPhone) throw new MetaError('แชท WhatsApp นี้ไม่มีเบอร์โทรศัพท์หรือ WhatsApp ID ของลูกค้า');
    const version = m.apiVersion || config.metaApiVersion;
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: String(recipientPhone).replace(/[^0-9]/g, ''),
        type: 'text',
        text: { body: text },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.error) throw new MetaError((out.error && out.error.message) || `ส่งข้อความ WhatsApp ไม่สำเร็จ (HTTP ${res.status})`);
    return { mid: (out.messages && out.messages[0] && out.messages[0].id) || `wa_${Date.now()}` };
  }

  // 3) กรณี Facebook Messenger หรือ Instagram Direct
  if (!m.accessToken) throw new MetaError('ยังไม่ได้เชื่อม Meta');
  if (lead.channel !== 'Messenger' && lead.channel !== 'Instagram' && lead.platform !== 'Instagram') {
    throw new MetaError(`ตอบผ่านระบบนี้ได้เฉพาะ Messenger, Instagram, LINE OA หรือ WhatsApp (แชทนี้เป็น ${lead.channel || 'ช่องอื่น'})`);
  }
  if (!lead.psid || !lead.pageId || lead.pageId === 'unknown') {
    throw new MetaError('แชทนี้ยังไม่มี PSID ของลูกค้า — ต้องตั้ง Webhook หรือดึงแชทจากเพจก่อน');
  }
  const ageH = lastCustomerAt ? (Date.now() - stampMs(lastCustomerAt)) / 3600e3 : Infinity;
  if (ageH > 7 * 24) throw new MetaError('เกิน 7 วันนับจากข้อความล่าสุดของลูกค้า Meta ไม่อนุญาตให้ตอบผ่าน API (ให้ลูกค้าทักมาใหม่ หรือติดต่อทางช่องทางอื่น)');
  const body = { recipient: { id: lead.psid }, message: { text }, messaging_type: ageH <= 24 ? 'RESPONSE' : 'MESSAGE_TAG' };
  if (ageH > 24) body.tag = 'HUMAN_AGENT';
  const version = m.apiVersion || config.metaApiVersion;
  const pages = store.read('pages.json', []);
  const matchedPage = pages.find((p) => p.id === lead.pageId || String(p.id) === String(lead.pageId));
  const tokenPageId = (matchedPage && matchedPage.fbPageId) || lead.pageId;
  const token = await pageToken(tokenPageId, m);
  const res = await fetch(`https://graph.facebook.com/${version}/${tokenPageId}/messages`, {
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
      const initialLimit = isIg ? '15' : String(Math.min(limit, 100));
      const queryParams = {
        fields: isIg ? 'id,updated_time,participants,messages.limit(25){id,message,from,created_time}' : 'id,updated_time,participants,tags,custom_labels,messages.limit(50){id,message,from,created_time}',
        limit: initialLimit,
        ...ep.params,
      };
      let body;
      try {
        body = await graph(ep.id + '/conversations', queryParams, token, version, isIg ? 20000 : 45000, isIg ? 0 : 2);
      } catch (gErr) {
        if (gErr.message && (gErr.message.includes('reduce the amount of data') || gErr.message.includes('Timeout') || isIg)) {
          try {
            const lightParams = {
              fields: 'id,updated_time,participants,messages.limit(15){id,message,from,created_time}',
              limit: isIg ? '10' : '50',
              ...ep.params,
            };
            body = await graph(ep.id + '/conversations', lightParams, token, version, isIg ? 15000 : 30000, 0);
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
        const perPage = Number(initialLimit) || 25;
        const maxPages = Math.max(10, Math.ceil(limit / perPage));
        while (pagesFetched < maxPages && body && body.paging && body.paging.next && allConvs.length < limit) {
          await new Promise((r) => setTimeout(r, 200));
          try {
            const res = await fetch(body.paging.next, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000) });
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
    // Instagram Media & Comments (วน Paging ดึงได้สูงสุด 100 โพสต์ พร้อมรูปและวิดีโอ)
    try {
      let nextUrl = `${pageId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments.limit(30){id,text,timestamp,from}&limit=25`;
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

          const mType = String(item.media_type || 'IMAGE').toUpperCase();
          posts.push({
            id: item.id,
            platform: 'Instagram',
            pageId,
            content: item.caption || '(ไม่มีข้อความแคปชั่น)',
            mediaUrl: item.thumbnail_url || item.media_url || null,
            videoUrl: mType === 'VIDEO' ? (item.media_url || null) : null,
            mediaType: mType,
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
    // Facebook: กวาดทั้ง Published Posts, Ads Posts (Dark Post / Unpublished) และ Feed พร้อมรูปภาพและวิดีโอ
    try {
      const endpoints = [
        `${pageId}/published_posts`,
        `${pageId}/ads_posts`,
        `${pageId}/feed`
      ];

      for (const ep of endpoints) {
        try {
          let nextUrl = `${ep}?fields=id,message,story,full_picture,source,attachments{media_type,media},created_time,permalink_url,comments.limit(30){id,message,created_time,from}&limit=25`;
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

              const att = item.attachments && Array.isArray(item.attachments.data) ? item.attachments.data[0] : null;
              const attImg = att && att.media && att.media.image ? att.media.image.src : null;
              const attVid = att && att.media ? att.media.source : null;
              const videoUrl = item.source || attVid || null;
              const mediaUrl = item.full_picture || attImg || null;

              posts.push({
                id: item.id,
                platform: 'Facebook',
                pageId,
                content: item.message || item.story || '(ไม่มีข้อความโพสต์)',
                mediaUrl,
                videoUrl,
                mediaType: videoUrl ? 'VIDEO' : 'IMAGE',
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
  normalizeAccountId, parseInsightRow, actionValue, sendMessage, fetchProfileName, fetchPageInfo,
  fetchFbConversations, fetchManagedPages, fetchAdAccounts, fetchPostsAndComments, graph,
};
