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
const jobs = require('./jobs');
const store = require('./store');
const { diffDays, stampMs } = require('./dates');

// ค่าที่ใช้แทน "ทั้งหมด" (ดึงจนกว่า Meta จะไม่มีให้)
const ALL_LIMIT = 100000;
const CACHE_MS = 5 * 60 * 1000; // แคชไว้ 5 นาที (ข้อมูลโฆษณาใหม่เกือบเรียลไทม์ แต่ยังไม่ชน Rate limit ของ Meta)
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

// ไล่ทุกหน้าจนหมด (ตั้ง maxPages ไว้กันวนไม่รู้จบ) และลองใหม่ 1 ครั้งเมื่อหน้าใดหน้าหนึ่งล้มชั่วคราว
async function graphAll(pathname, params, token, version, maxPages = 20) {
  let body = await graph(pathname, params, token, version);
  const rows = [...(body.data || [])];
  for (let i = 1; i < maxPages && body.paging && body.paging.next; i++) {
    await new Promise((r) => setTimeout(r, 200)); // หน่วงเวลาเล็กน้อยป้องกัน Rate limit
    const nextUrl = body.paging.next;
    let next = null;
    for (let attempt = 0; attempt < 2 && !next; attempt++) {
      try {
        const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) });
        const j = await res.json();
        if (j.error) {
          if (attempt === 0 && (j.error.is_transient || [1, 2, 4, 17, 32, 613].includes(j.error.code))) { await new Promise((r) => setTimeout(r, 3000)); continue; }
          throw new MetaError(j.error.message);
        }
        next = j;
      } catch (e) {
        if (e instanceof MetaError || attempt === 1) throw e;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!next) break;
    body = next;
    rows.push(...(body.data || []));
  }
  if (body.paging && body.paging.next) console.warn(`[Meta] ${pathname}: ถึงเพดาน ${maxPages} หน้าแล้ว ข้อมูลอาจไม่ครบ`);
  return rows;
}

// Meta ให้ดึง Insights ได้ย้อนหลังสูงสุด 37 เดือน ขอเก่ากว่านั้นจะ error ทั้งคำขอ
function clampInsightsFrom(from, to) {
  const d = new Date(String(to || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 37);
  d.setUTCDate(d.getUTCDate() + 2); // เผื่อขอบเขตวัน/เขตเวลา
  const min = d.toISOString().slice(0, 10);
  return from && from > min ? from : min;
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

// แปลงแถว insights รายวันแบบครบทุกมิติ (Engagement, Video, Link Clicks, Leads, Purchase Value)
function parseInsightRowFull(r) {
  const base = parseInsightRow(r);
  const messages = actionValue(r.actions, [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.total_messaging_connection',
  ]) || base.messages;
  const firstReplies = actionValue(r.actions, [
    'onsite_conversion.messaging_first_reply',
  ]);
  const linkClicks = Number(r.inline_link_clicks) || actionValue(r.actions, ['link_click']) || 0;
  const uniqueClicks = Number(r.unique_clicks) || 0;
  const metaLeads = actionValue(r.actions, [
    'lead',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
  ]);
  const purchaseValue = actionValue(r.action_values, [
    'omni_purchase',
    'purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
  ]);
  const postEngagement = actionValue(r.actions, ['post_engagement', 'page_engagement']);
  const reactions = actionValue(r.actions, ['post_reaction', 'like']);
  const comments = actionValue(r.actions, ['comment']);
  const shares = actionValue(r.actions, ['post']);
  const saves = actionValue(r.actions, ['onsite_conversion.post_save']);
  const landingPageViews = actionValue(r.actions, ['landing_page_view', 'omni_landing_page_view']);
  const videoPlays = actionValue(r.video_play_actions, ['video_view']) || actionValue(r.actions, ['video_view']);
  const videoThruPlays = actionValue(r.video_thruplay_watched_actions, ['video_view']);
  const videoP25 = actionValue(r.video_p25_watched_actions, ['video_view']);
  const videoP50 = actionValue(r.video_p50_watched_actions, ['video_view']);
  const videoP75 = actionValue(r.video_p75_watched_actions, ['video_view']);
  const videoP100 = actionValue(r.video_p100_watched_actions, ['video_view']);

  return {
    ...base,
    messages,
    firstReplies,
    linkClicks,
    uniqueClicks,
    metaLeads,
    purchaseValue,
    postEngagement,
    reactions,
    comments,
    shares,
    saves,
    landingPageViews,
    videoPlays,
    videoThruPlays,
    videoP25,
    videoP50,
    videoP75,
    videoP100,
  };
}

function parseMetaBudget(raw) {
  const n = Number(raw);
  if (!n || Number.isNaN(n) || n <= 0) return null;
  // Meta API คืนค่างบประมาณเป็นหน่วยสตางค์ (คูณ 100)
  return Math.round((n / 100) * 100) / 100;
}

function extractAdCopy(c, storyMedia = null, igMedia = null) {
  if (!c) return { headline: '', body: '', cta: '', linkUrl: '', permalinkUrl: '' };
  let headline = c.title || '';
  let body = c.body || '';
  let cta = c.call_to_action_type || '';
  let linkUrl = c.link_url || '';

  const oss = c.object_story_spec || {};
  if (oss.video_data) {
    const vd = oss.video_data;
    if (!headline && vd.title) headline = vd.title;
    if (!body && vd.message) body = vd.message;
    if (!cta && vd.call_to_action && vd.call_to_action.type) cta = vd.call_to_action.type;
    if (!linkUrl && vd.call_to_action && vd.call_to_action.value && vd.call_to_action.value.link) linkUrl = vd.call_to_action.value.link;
  }
  if (oss.link_data) {
    const ld = oss.link_data;
    if (!headline && (ld.name || ld.caption)) headline = ld.name || ld.caption;
    if (!body && (ld.message || ld.description)) body = ld.message || ld.description;
    if (!cta && ld.call_to_action && ld.call_to_action.type) cta = ld.call_to_action.type;
    if (!linkUrl && ld.link) linkUrl = ld.link;
  }
  if (oss.photo_data) {
    const pd = oss.photo_data;
    if (!body && (pd.caption || pd.message)) body = pd.caption || pd.message;
    if (!cta && pd.call_to_action && pd.call_to_action.type) cta = pd.call_to_action.type;
  }
  const afs = c.asset_feed_spec || {};
  if (!headline && Array.isArray(afs.titles) && afs.titles[0] && afs.titles[0].text) {
    headline = afs.titles[0].text;
  }
  if (!body && Array.isArray(afs.bodies) && afs.bodies[0] && afs.bodies[0].text) {
    body = afs.bodies[0].text;
  }
  if (!cta && Array.isArray(afs.call_to_action_types) && afs.call_to_action_types[0]) {
    cta = afs.call_to_action_types[0];
  }
  if (!linkUrl && Array.isArray(afs.link_urls) && afs.link_urls[0] && afs.link_urls[0].website_url) {
    linkUrl = afs.link_urls[0].website_url;
  }
  if (!body && storyMedia && storyMedia.message) body = storyMedia.message;
  if (!body && igMedia && igMedia.caption) body = igMedia.caption;
  const permalinkUrl = (storyMedia && storyMedia.permalinkUrl) || (igMedia && igMedia.permalinkUrl) || '';

  return {
    headline: String(headline || '').trim(),
    body: String(body || '').trim(),
    cta: String(cta || '').trim(),
    linkUrl: String(linkUrl || '').trim(),
    permalinkUrl: String(permalinkUrl || '').trim(),
  };
}

function extractTargetingSummary(targeting) {
  if (!targeting || typeof targeting !== 'object') return { summary: '', placement: '' };
  const parts = [];
  if (Array.isArray(targeting.genders) && targeting.genders.length === 1) {
    parts.push(targeting.genders[0] === 1 ? 'ชาย' : targeting.genders[0] === 2 ? 'หญิง' : 'ทุกเพศ');
  } else {
    parts.push('ชาย/หญิง');
  }
  if (targeting.age_min || targeting.age_max) {
    parts.push(`อายุ ${targeting.age_min || 18}–${targeting.age_max || 65}+ ปี`);
  }
  const geo = targeting.geo_locations || {};
  const locNames = [];
  if (Array.isArray(geo.cities)) locNames.push(...geo.cities.map((c) => c.name).filter(Boolean));
  if (Array.isArray(geo.regions)) locNames.push(...geo.regions.map((r) => r.name).filter(Boolean));
  if (!locNames.length && Array.isArray(geo.countries)) locNames.push(...geo.countries);
  if (locNames.length) parts.push(locNames.slice(0, 3).join(', '));

  const interests = [];
  if (Array.isArray(targeting.flexible_spec)) {
    for (const spec of targeting.flexible_spec) {
      if (Array.isArray(spec.interests)) interests.push(...spec.interests.map((i) => i.name).filter(Boolean));
      if (Array.isArray(spec.behaviors)) interests.push(...spec.behaviors.map((b) => b.name).filter(Boolean));
    }
  }
  if (Array.isArray(targeting.custom_audiences)) {
    interests.push(...targeting.custom_audiences.map((ca) => ca.name).filter(Boolean));
  }
  if (interests.length) parts.push(`สนใจ: ${interests.slice(0, 3).join(', ')}`);

  const pubs = [];
  if (Array.isArray(targeting.publisher_platforms)) pubs.push(...targeting.publisher_platforms);
  if (Array.isArray(targeting.facebook_positions)) pubs.push(...targeting.facebook_positions.slice(0, 2));
  if (Array.isArray(targeting.instagram_positions)) pubs.push(...targeting.instagram_positions.slice(0, 2));

  return {
    summary: parts.join(' · '),
    placement: pubs.length ? pubs.join(', ') : 'Advantage+ Placements (Auto)',
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

// Meta ตอบ "Service temporarily unavailable" / "reduce the amount of data" เมื่อคำขอหนักเกินไป
const isHeavyError = (e) => /temporarily unavailable|reduce the amount of data|unknown error|an unexpected error|please retry|timeout|ตอบสนองช้า/i.test(String(e && e.message));
const INSIGHT_FIELDS = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,unique_clicks,inline_link_clicks,actions,action_values,cost_per_action_type,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions';

// ดึงทีละหน้าแบบลดขนาดเองเมื่อ Meta บอกว่าหนักไป (100 → 50 → 25 รายการต่อหน้า)
async function graphAllShrinking(pathname, params, token, version, maxPages) {
  let limit = Number(params.limit || 100);
  for (;;) {
    try {
      return await graphAll(pathname, { ...params, limit: String(limit) }, token, version, Math.ceil(maxPages * (100 / limit)));
    } catch (e) {
      if (!isHeavyError(e) || limit <= 25) throw e;
      limit = Math.floor(limit / 2);
      console.warn(`[Meta] ${pathname}: คำขอหนักเกินไป ลดเหลือ ${limit} รายการต่อหน้า`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

const addDaysIso = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// ดึง Insights เป็นช่วงย่อย (ครั้งละ ≤ 31 วัน) ทีละช่วง — ถ้าช่วงไหน Meta บอกว่าหนักไป แบ่งครึ่งต่อจนเหลือวันเดียว
// ช่วยแก้ "Service temporarily unavailable" ที่เกิดเมื่อขอข้อมูลรายวันหลายเดือนในคำขอเดียว
async function fetchInsightsChunked(acc, from, to, increment, token, version) {
  const params = (since, until) => ({ level: 'ad', time_increment: increment, time_range: JSON.stringify({ since, until }), fields: INSIGHT_FIELDS, limit: '100' });
  if (increment !== '1') return graphAllShrinking(`${acc}/insights`, params(from, to), token, version, 400);
  const windows = [];
  for (let s = from; s <= to; s = addDaysIso(s, 31)) { const e = addDaysIso(s, 30); windows.push([s, e > to ? to : e]); }
  const rows = [];
  async function run(since, until) {
    try {
      rows.push(...await graphAll(`${acc}/insights`, params(since, until), token, version, 400));
    } catch (e) {
      if (!isHeavyError(e) || since === until) throw e;
      const days = Math.round((Date.parse(until) - Date.parse(since)) / 86400000);
      const mid = addDaysIso(since, Math.floor(days / 2));
      console.warn(`[Meta] insights ${since}..${until} หนักเกินไป แบ่งเป็น 2 ช่วง`);
      await new Promise((r) => setTimeout(r, 1500));
      await run(since, mid);
      await run(addDaysIso(mid, 1), until);
    }
  }
  // ช่วงล่าสุดก่อน (ข้อมูลสำคัญสุด) ครั้งละ 2 ช่วงพร้อมกัน — เร็วขึ้นแต่ไม่ยิงถี่จนโดน Meta จำกัด
  const queue = windows.reverse();
  await Promise.all([0, 1].map(async () => { while (queue.length) { const [s, e] = queue.shift(); await run(s, e); } }));
  return rows;
}

async function loadUncached({ from, to }) {
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
  const insightsFrom = clampInsightsFrom(from, to);
  // ต้องดึงรายวันเสมอเมื่อมีการแบ่ง "ช่วงนี้ vs ช่วงก่อน" — ถ้าดึงรายสัปดาห์/รายเดือน ก้อนที่คร่อมรอยต่อ
  // จะถูกนับเข้าช่วงใดช่วงหนึ่งทั้งก้อน ทำให้ยอดเพี้ยน (เคยเกิดกับช่วง 90 วัน)
  // ใช้รายเดือนเฉพาะช่วงยาวมาก (เช่น "ทั้งหมด" ที่ถูกตัดเหลือ 37 เดือน) ซึ่งทั้งหน้าต่างเป็นช่วงปัจจุบันอยู่แล้ว
  const spanDays = Math.round((Date.parse(to) - Date.parse(insightsFrom)) / 86400000) + 1;
  const insightsIncrement = spanDays <= 800 ? '1' : 'monthly';

  const key = `${accounts.join(',')}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  // Stale cache fallback: ถ้าเคยมีข้อมูลที่ดึงสำเร็จแล้ว แม้จะหมดเวลา CACHE_MS ไปแล้ว ให้เก็บเป็น backup ไว้กรณีติด rate limit
  const staleData = hit ? hit.data : null;

  // ดึง ads และ insights จากทุก Ad Account ที่ผูกไว้
  const adRows = [];
  const insightRows = [];
  const seenAdIds = new Set();

  for (const acc of accounts) {
    try {
      const [accAds, accInsights] = await Promise.all([
        graphAllShrinking(`${acc}/ads`, {
          fields: 'id,name,effective_status,status,configured_status,updated_time,created_time,bid_amount,campaign{id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,bid_strategy,start_time,stop_time,created_time,updated_time},adset{id,name,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,budget_remaining,destination_type,start_time,end_time,targeting},creative{id,name,title,body,object_type,call_to_action_type,link_url,actor_id,thumbnail_url,image_url,video_id,object_story_spec,effective_object_story_id,asset_feed_spec,image_crops,effective_instagram_media_id}',
          limit: '100',
        }, meta.accessToken, version, 100),
        fetchInsightsChunked(acc, insightsFrom, to, insightsIncrement, meta.accessToken, version),
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
      if (staleData && (accErr.message.includes('too many calls') || accErr.message.includes('rate-limiting') || accErr.message.includes('User request limit reached'))) {
        console.warn(`[Meta] Rate limit hit for Ad Account ${acc}. Returning stale cached data.`);
        return staleData;
      }
      if (acc === primaryAccount && accounts.length === 1) throw accErr;
      console.warn(`[Meta] Warning loading Ad Account ${acc}:`, accErr.message);
    }
  }

  // 1) ดึงรูปภาพ HD, วิดีโอ และแคปชั่นจาก Instagram Media ผ่าน Meta Batch API
  const igMediaMap = new Map(); // igId -> { thumb, videoUrl, mediaType, caption, permalinkUrl }
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
        form.append('batch', JSON.stringify(chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=id,media_type,thumbnail_url,media_url,caption,permalink` }))));
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
                  caption: b.caption || '',
                  permalinkUrl: b.permalink || '',
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
  const fbVideoMap = new Map(); // videoId -> { thumb, videoUrl, length, description }
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
        form.append('batch', JSON.stringify(chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=id,source,picture,length,description,thumbnails{uri,width,height,is_preferred}` }))));
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
                  length: b.length || null,
                  description: b.description || '',
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

  // 3) ดึงรูปความละเอียดสูง วิดีโอ และข้อความแคปชั่นจาก Page Post (effective_object_story_id)
  const storyMediaMap = new Map(); // storyId -> { thumb, videoUrl, message, permalinkUrl }
  try {
    const storyIds = [];
    const seenStory = new Set();
    for (const a of adRows) {
      const c = a.creative;
      const storyId = c && c.effective_object_story_id;
      if (storyId && !seenStory.has(storyId)) {
        seenStory.add(storyId);
        storyIds.push(storyId);
        if (storyIds.length >= 60) break;
      }
    }
    for (let i = 0; i < storyIds.length; i += 30) {
      const chunk = storyIds.slice(i, i + 30);
      try {
        const form = new URLSearchParams();
        form.append('batch', JSON.stringify(chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=id,message,permalink_url,full_picture,source,attachments{media_type,media,title,description}` }))));
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
                  message: b.message || (att && att.description) || '',
                  permalinkUrl: b.permalink_url || '',
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
    if (c.includes('danai') || c.includes('dr-danai') || c.includes('dr.nay') || c.includes('dr nay') || c.includes('ดร.เนย์') || c.includes('หมอเนย์') || c.includes('หมอดนัย') || c.includes('ปลูกผมถาวร')) return '109373461849494';
    if (c.includes('pavicon') || c.includes('พาวิคอน') || c.includes('พาคอน') || c.includes('hair clinic')) return '239105462619075';
    if (c.includes('beq') || c.includes('บีอีคิว') || c.includes('wellness')) return '1111432947713900';
    return '';
  }

  const ads = adRows.map((a) => {
    const campObj = a.campaign || {};
    const adsetObj = a.adset || {};
    if (campObj.id) {
      campaigns.set(campObj.id, {
        id: campObj.id,
        name: campObj.name || campObj.id,
        status: campObj.effective_status || campObj.status || 'ACTIVE',
        objective: campObj.objective || '',
        buyingType: campObj.buying_type || 'AUCTION',
        bidStrategy: campObj.bid_strategy || '',
        dailyBudget: parseMetaBudget(campObj.daily_budget),
        lifetimeBudget: parseMetaBudget(campObj.lifetime_budget),
        budgetRemaining: parseMetaBudget(campObj.budget_remaining),
        startTime: campObj.start_time || campObj.created_time || '',
        stopTime: campObj.stop_time || '',
        updatedTime: campObj.updated_time || '',
      });
    }
    const campName = campObj.name || '';
    const adsetName = adsetObj.name || '';
    const adName = a.name || '';
    const allNames = `${campName} ${adsetName} ${adName}`.toLowerCase();

    // ตรวจหา Page ID จริงจากชิ้นงานโฆษณา (Creative)
    // 1) ดึงจาก creative spec จริง: object_story_spec / actor_id / effective_object_story_id
    const c = a.creative || {};
    let pageId = '';
    const spec = c.object_story_spec || {};
    if (spec.page_id) pageId = String(spec.page_id);
    else if (spec.instagram_actor_id) {
      const igMatched = knownPages.find(p => String(p.id) === String(spec.instagram_actor_id));
      if (igMatched) pageId = igMatched.fbPageId || igMatched.id;
      else pageId = String(spec.instagram_actor_id);
    }
    if (!pageId && c.actor_id) pageId = String(c.actor_id);
    if (!pageId && c.effective_object_story_id && c.effective_object_story_id.includes('_')) {
      pageId = c.effective_object_story_id.split('_')[0];
    }
    // ถ้าตรวจไม่พบจาก creative ให้ใช้เพจหลัก BEQ Hair Clinic
    if (!pageId || pageId === 'unknown') {
      pageId = '111432947713900';
    }
    pageIds.add(pageId);

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

    const copyInfo = extractAdCopy(c, storyMedia, igMedia);
    if (!copyInfo.body && fbVideo && fbVideo.description) copyInfo.body = fbVideo.description;
    const targetInfo = extractTargetingSummary(adsetObj.targeting);
    const dailyBudget = parseMetaBudget(adsetObj.daily_budget) ?? parseMetaBudget(campObj.daily_budget);
    const lifetimeBudget = parseMetaBudget(adsetObj.lifetime_budget) ?? parseMetaBudget(campObj.lifetime_budget);
    const budgetRemaining = parseMetaBudget(adsetObj.budget_remaining) ?? parseMetaBudget(campObj.budget_remaining);

    return {
      id: a.id,
      name: a.name,
      status: a.effective_status || a.status || 'ACTIVE',
      configuredStatus: a.configured_status || a.status || '',
      createdTime: a.created_time || '',
      updatedTime: a.updated_time || a.created_time || '',
      campaignId: campObj.id || 'none',
      campaignStatus: campObj.effective_status || campObj.status || 'ACTIVE',
      objective: campObj.objective || '',
      buyingType: campObj.buying_type || 'AUCTION',
      adsetId: adsetObj.id || '',
      adset: adsetObj.name || '',
      adsetStatus: adsetObj.effective_status || adsetObj.status || '',
      optimizationGoal: adsetObj.optimization_goal || '',
      billingEvent: adsetObj.billing_event || '',
      bidStrategy: adsetObj.bid_strategy || campObj.bid_strategy || '',
      destinationType: adsetObj.destination_type || '',
      dailyBudget,
      lifetimeBudget,
      budgetRemaining,
      startTime: adsetObj.start_time || campObj.start_time || a.created_time || '',
      stopTime: adsetObj.end_time || campObj.stop_time || '',
      targetingSummary: targetInfo.summary,
      placement: targetInfo.placement,
      pageId,
      pageName: ((knownPages.find(p => p.id === pageId) || {}).name) || pageId,
      platform: 'Facebook',
      agencyId: a._adAccount || primaryAccount,
      creativeId: c.id || '',
      creativeName: c.name || '',
      creative: creativeKind(c, videoUrl),
      thumb,
      videoUrl,
      videoId: vid || null,
      videoLength: (fbVideo && fbVideo.length) || null,
      storyId: storyId || '',
      headline: copyInfo.headline,
      body: copyInfo.body,
      cta: copyInfo.cta,
      linkUrl: copyInfo.linkUrl,
      permalinkUrl: copyInfo.permalinkUrl,
    };
  });

  // ถ้าจับได้ว่ามี Page ID อื่นจาก Creative ให้แยกออกมาเป็นเพจใหม่ในระบบทันที
  const pages = [];
  for (const id of pageIds) {
    if (id === 'unknown') continue;
    let name = ((knownPages.find(p => p.id === id) || {}).name) || '';
    if (!name) {
      if (id === '111432947713900' || id === '11432947713900') name = 'BEQ Hair Clinic';
      else if (id === '109373461849494') name = 'Dr. Nay Hair Transplant by BEQ ปลูกผมถาวร';
      else if (id === '239105462619075') name = 'Pavicon Hair Clinic คลินิกปลูกผมมาตรฐานสากล';
      else if (id === '17841448814795762') name = 'dr.nay_hairtransplant';
      else if (id === '17841401019079620') name = 'beq_wellness';
      else name = `Page ${id}`;
    }
    try {
      if (name.startsWith('Page ')) {
        const fetched = await graph(id, { fields: 'name' }, meta.accessToken, version);
        if (fetched && fetched.name) name = fetched.name;
      }
    } catch { /* ใช้ชื่อ fallback */ }
    pages.push({ id, name, platform: 'Facebook' });
  }

  // อัปเดต pageName ของแต่ละโฆษณาให้ตรงกับชื่อเพจที่ตรวจพบ
  const pageMap = new Map(pages.map(p => [p.id, p.name]));
  for (const a of ads) {
    if (a.pageId && pageMap.has(a.pageId)) {
      a.pageName = pageMap.get(a.pageId);
    }
  }

  const activeCampIds = new Set(ads.map(a => a.campaignId));
  const filteredCampaigns = [...campaigns.values()].filter(c => activeCampIds.has(c.id));
  const activeAdIds = new Set(ads.map(a => a.id));
  const filteredDaily = insightRows.map(parseInsightRowFull).filter(d => !d.adId || activeAdIds.has(d.adId) || activeCampIds.has(d.campaignId));

  const data = {
    pages,
    agencies: accounts.map((acc) => ({ id: acc, name: acc === primaryAccount ? (meta.accountName || acc) : acc })),
    reps: [],
    campaigns: filteredCampaigns,
    ads,
    daily: filteredDaily,
    // ข้อมูลแชท/ทีมขายไม่มีใน Ads API: ต้องมาจากระบบแชท (Inbox/Upload) ในขั้นถัดไป
    leads: store.read('leads.json', []),
    spanDays: diffDays(from, to) + 1,
  };
  cache.set(key, { at: Date.now(), data });
  // บันทึกลงคลังข้อมูลโฆษณาถาวร (ดึงซ้ำ = แทนที่วันเดิมด้วยข้อมูลใหม่)
  try { require('./adstore').save(data, insightsFrom, to, { daily: insightsIncrement === '1' }); } catch (e) { console.warn('[adstore] บันทึกไม่สำเร็จ:', e.message); }
  return data;
}

/* ---------- Messenger (ส่งข้อความ / ดึงชื่อลูกค้า) ---------- */
const pageTokens = new Map(); // pageId -> { token, at }

// ขอ Page Access Token จาก token หลัก (System User ที่ได้สิทธิ์ในเพจ + pages_messaging)
async function pageToken(pageId, m, forceRefresh = false) {
  if (!forceRefresh) {
    // 1. ตรวจสอบจากแคช
    const hit = pageTokens.get(pageId);
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.token;
  }

  // 2. ขอ Page Access Token ล่าสุดจาก Graph API ด้วย m.accessToken หลักก่อน (เพื่อให้ได้ Token ใหม่เสมอเมื่อเปลี่ยน Access Token หลัก)
  if (m && m.accessToken) {
    try {
      const r = await graph(pageId, { fields: 'access_token' }, m.accessToken, m.apiVersion || config.metaApiVersion, 12000, 0);
      if (r && r.access_token) {
        pageTokens.set(pageId, { token: r.access_token, at: Date.now() });
        return r.access_token;
      }
    } catch (e) {
      // ถ้าขอผ่าน Graph API ไม่ได้ ค่อย fallback ไปดู pageToken ที่บันทึกไว้ใน pages.json
    }
  }

  // 3. ตรวจสอบจาก pages.json ที่เคยซิงค์ตอน discover-pages
  if (!forceRefresh) {
    const pages = store.read('pages.json', []);
    const saved = pages.find((p) => p.id === pageId || String(p.id) === String(pageId));
    if (saved && saved.pageToken) {
      pageTokens.set(pageId, { token: saved.pageToken, at: Date.now() });
      return saved.pageToken;
    }
  }

  // 4. Fallback: ใช้ System User Token / User Token ตรงๆ
  return (m && m.accessToken) || '';
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
    // ตอบจาก OA ที่ลูกค้าทักเข้ามา (ลีดผูกกับบัญชีผ่าน pageId)
    const lacc = require('./channels').lineAccountById(lead.pageId) || {};
    const lineToken = lacc.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
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
    // ตอบจากเบอร์ที่ลูกค้าทักเข้ามา (ลีดผูกกับบัญชีผ่าน pageId)
    const wa = require('./channels').waAccountById(lead.pageId) || {};
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


// ไล่ paging.next ของ field ย่อย (เช่น messages ในแชท, comments ในโพสต์) ให้ได้ย้อนหลังมากที่สุดที่ Meta ยอมส่ง
// items: รายการที่มี item[field] = { data, paging }, maxPer: เพดานต่อรายการ, concurrency: ดึงพร้อมกันกี่รายการ
async function expandPaging(items, field, token, { maxPer = 300, concurrency = 4, onProgress = null, shouldStop = null } = {}) {
  const todo = items.filter((it) => it && it[field] && it[field].paging && it[field].paging.next && (it[field].data || []).length < maxPer);
  let done = 0;
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      if (shouldStop && shouldStop()) return;
      const it = todo[idx++];
      const tok = it._tok || token;
      let next = it[field].paging.next;
      const seen = new Set((it[field].data || []).map((x) => x.id));
      while (next && it[field].data.length < maxPer) {
        let j;
        try {
          const res = await fetch(next, { headers: tok ? { Authorization: `Bearer ${tok}` } : {}, signal: AbortSignal.timeout(25000) });
          j = await res.json();
        } catch { break; }
        if (!j || j.error || !Array.isArray(j.data) || !j.data.length) break; // Meta ไม่ให้ข้อความที่เก่าเกินไป → หยุด
        for (const x of j.data) if (!seen.has(x.id)) { seen.add(x.id); it[field].data.push(x); }
        next = j.paging && j.paging.next;
        await new Promise((r) => setTimeout(r, 150));
      }
      it[field].paging = next ? { next } : {};
      done++;
      if (onProgress) onProgress(done, todo.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  return { expanded: done, candidates: todo.length };
}

async function fetchFbConversations(pageId, limit = 400, platform = 'Facebook', fbPageId = null, afterDate = null, beforeDate = null, opts = {}) {
  const progress = typeof opts.onProgress === 'function' ? opts.onProgress : jobs.report;
  const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : jobs.cancelled;
  const maxMessages = Math.max(0, Number(opts.maxMessagesPerChat ?? (platform === 'Instagram' ? 200 : 300)));
  async function finish(list) {
    const out = filterByDate(list).slice(0, limit);
    if (maxMessages > 0) {
      progress({ phase: 'messages', done: 0, total: out.length });
      await expandPaging(out, 'messages', null, {
        maxPer: maxMessages, shouldStop,
        onProgress: (d, t) => progress({ phase: 'messages', done: d, total: t }),
      });
    }
    return out;
  }
  const m = getSettings().meta || {};
  if (!m.accessToken) throw new MetaError('ยังไม่ได้เชื่อม Meta');
  const version = m.apiVersion || config.metaApiVersion;

  const isIg = platform === 'Instagram';
  const allConvs = [];

  // Helper สำหรับกรองบทสนทนาและข้อความตามช่วงวันที่ (afterDate <= วันที่ <= beforeDate)
  const afterMs = afterDate ? Date.parse(afterDate + 'T00:00:00+07:00') : null;
  const beforeMs = beforeDate ? Date.parse(beforeDate + 'T23:59:59+07:00') : null;

  function filterByDate(convs) {
    if (!afterMs && !beforeMs) return convs;
    return convs.filter(c => {
      // ตรวจสอบ updated_time ของบทสนทนา
      const cTime = c.updated_time ? Date.parse(c.updated_time) : null;
      // ตรวจสอบเวลาข้อความล่าสุดหรือข้อความในแชท
      const msgs = (c.messages && c.messages.data) || [];
      const msgTimes = msgs.map(m => m.created_time ? Date.parse(m.created_time) : 0);
      const latestMsgTime = msgTimes.length ? Math.max(...msgTimes) : 0;
      const refTime = latestMsgTime || cTime;
      if (!refTime) return true; // หากไม่มีเวลา ให้เก็บไว้ก่อน

      if (afterMs && refTime < afterMs) return false;
      if (beforeMs && refTime > beforeMs) return false;
      return true;
    });
  }

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
  // สำหรับ Instagram: Meta Graph API รองรับการดึงทั้งจาก Facebook Page แม่ ({fbPageId}/conversations?platform=instagram)
  // ทั้งโฟลเดอร์หลัก (inbox) และโฟลเดอร์ทั่วไป (general) รวมถึงดึงผ่าน IG Account ID ({igId}/conversations)
  const targetEndpoints = isIg
    ? [
        ...(fbPageId && fbPageId !== pageId ? [
          { id: fbPageId, params: { platform: 'instagram' }, usePageToken: fbPageId },
          { id: fbPageId, params: { platform: 'instagram', folder: 'general' }, usePageToken: fbPageId },
        ] : []),
        { id: pageId, params: {}, usePageToken: fbPageId || pageId },
        { id: pageId, params: { platform: 'instagram' }, usePageToken: fbPageId || pageId },
      ]
    : [{ id: pageId, params: {}, usePageToken: pageId }];

  for (const ep of targetEndpoints) {
    try {
      const token = await pageToken(ep.usePageToken, m);
      const initialLimit = isIg ? '50' : String(Math.min(limit, 100));
      const queryParams = {
        fields: isIg ? 'id,updated_time,participants,messages.limit(50){id,message,from,created_time}' : 'id,updated_time,participants,tags,custom_labels,messages.limit(100){id,message,from,created_time}',
        limit: initialLimit,
        ...ep.params,
      };
      let body;
      try {
        body = await graph(ep.id + '/conversations', queryParams, token, version, isIg ? 35000 : 45000, isIg ? 1 : 2);
      } catch (gErr) {
        if (gErr.message && (gErr.message.includes('reduce the amount of data') || gErr.message.includes('Timeout') || gErr.message.includes('ตอบสนองช้า'))) {
          try {
            const lightParams = {
              fields: isIg ? 'id,updated_time,participants,messages.limit(20){id,message,from,created_time}' : 'id,updated_time,participants,messages.limit(50){id,message,from,created_time}',
              limit: isIg ? '25' : '50',
              ...ep.params,
            };
            body = await graph(ep.id + '/conversations', lightParams, token, version, isIg ? 30000 : 30000, 1);
          } catch (lightErr) {
            lastErr = lightErr;
            continue;
          }
        } else {
          lastErr = gErr;
          continue;
        }
      }
      if (body && Array.isArray(body.data)) {
        if (body.data.length > 0) {
          const seenConv = new Set(allConvs.map((x) => x.id));
          const addConvs = (list) => {
            for (const item of list) {
              if (seenConv.has(item.id)) continue;
              seenConv.add(item.id);
              Object.defineProperty(item, '_tok', { value: token, enumerable: false });
              allConvs.push(item);
            }
            progress({ phase: 'conversations', done: allConvs.length, total: limit });
          };
          addConvs(body.data);

          let pagesFetched = 1;
          const perPage = Number(initialLimit) || 25;
          const maxPages = Math.max(10, Math.ceil(limit / perPage));
          // แชทเรียงจากใหม่ไปเก่า: นับเฉพาะแชทที่อยู่ในช่วงวันที่ และหยุดเมื่อเลยวันเริ่มต้นไปแล้ว
          const matched = () => filterByDate(allConvs).length;
          const pastStart = () => {
            if (!afterMs || !allConvs.length) return false;
            const last = allConvs[allConvs.length - 1];
            const t = last.updated_time ? Date.parse(last.updated_time) : NaN;
            return Number.isFinite(t) && t < afterMs;
          };
          const maxPagesAll = afterMs || beforeMs ? Math.max(maxPages, 500) : maxPages;
          while (pagesFetched < maxPagesAll && body && body.paging && body.paging.next && matched() < limit && !pastStart() && !shouldStop()) {
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
                addConvs(body.data);
                pagesFetched++;
              } else {
                break;
              }
            } catch (_) {
              break;
            }
          }
          if (filterByDate(allConvs).length >= limit) return finish(allConvs);
        }
        // ถ้า endpoint นี้ตอบกลับ 200 OK แต่ data: [] (ไม่มีแชท) ให้ล้าง lastErr และลอง endpoint ถัดไป
        lastErr = null;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  if (allConvs.length > 0) return finish(allConvs);
  if (lastErr) {
    const msg = String(lastErr.message || '');
    if (msg.includes('Session has expired') || msg.includes('Error validating access token')) {
      throw new MetaError('Access Token ของ Meta หมดอายุแล้ว — กรุณาสร้าง Token ใหม่ใน Meta Business Suite / Graph API Explorer แล้วนำมาบันทึกในหน้า Settings');
    }
    if (isIg && (msg.includes('permission') || msg.includes('(#10)') || msg.includes('(#200)') || msg.includes('capability'))) {
      throw new MetaError(`ดึงแชท Instagram ไม่สำเร็จ (${msg}) — กรุณาตรวจสอบว่า: 1) Token มีสิทธิ์ instagram_basic, instagram_manage_messages, pages_messaging 2) เปิดปุ่ม "Allow access to messages (อนุญาตให้เข้าถึงข้อความ)" ในแอป Instagram (Settings → Messages and story replies → Message controls)`);
    }
    throw lastErr;
  }
  return [];
}

async function fetchManagedPages(customToken = null) {
  const m = getSettings().meta || {};
  const token = customToken || m.accessToken;
  if (!token) throw new MetaError('ยังไม่ได้ระบุ Access Token');
  const version = m.apiVersion || config.metaApiVersion;
  const res = await graph('me/accounts', {
    fields: 'id,name,access_token,category,tasks,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}',
    limit: '100',
  }, token, version);
  return (res && res.data) || [];
}

// สิทธิ์ที่ต้องมีเพื่ออ่านแชท Instagram ผ่าน Facebook Page
const IG_REQUIRED_SCOPES = ['instagram_basic', 'instagram_manage_messages', 'pages_manage_metadata', 'pages_messaging', 'pages_show_list', 'pages_read_engagement'];
// ฟิลด์ webhook ที่ต้อง subscribe ไว้ที่ระดับเพจ เพื่อให้ข้อความ Messenger/IG เด้งเข้าระบบทันที
const PAGE_WEBHOOK_FIELDS = ['messages', 'message_echoes', 'messaging_postbacks', 'messaging_referrals', 'feed'];

const appAccessToken = (m) => (m.appId && m.appSecret ? `${m.appId}|${m.appSecret}` : null);

// อ่านสิทธิ์จริงของ token จาก /debug_token (ใช้ app token ถ้ามี ไม่งั้นให้ token ตรวจตัวเอง)
async function debugToken(token, m, version) {
  try {
    const r = await graph('debug_token', { input_token: token }, appAccessToken(m) || token, version, 15000, 0);
    const d = (r && r.data) || {};
    return { ok: true, isValid: Boolean(d.is_valid), type: d.type || '', appId: d.app_id ? String(d.app_id) : '', scopes: Array.isArray(d.scopes) ? d.scopes : [], expiresAt: d.expires_at || 0 };
  } catch (e) {
    return { ok: false, error: e.message, scopes: [] };
  }
}

async function testInstagramConnection(customToken = null) {
  const m = getSettings().meta || {};
  const token = customToken || m.accessToken;
  if (!token) throw new MetaError('ยังไม่ได้บันทึก Meta Access Token');
  const version = m.apiVersion || config.metaApiVersion;

  const tokenInfo = await debugToken(token, m, version);
  const missingScopes = tokenInfo.ok ? IG_REQUIRED_SCOPES.filter((sc) => !tokenInfo.scopes.includes(sc)) : [];
  const appId = String(m.appId || tokenInfo.appId || '');

  const fbPages = await fetchManagedPages(token);
  const igAccounts = [];
  const unlinkedFbPages = [];

  for (const fp of fbPages) {
    const ig = fp.instagram_business_account || fp.connected_instagram_account;
    if (!ig || !ig.id) {
      unlinkedFbPages.push({ fbPageId: fp.id, fbPageName: fp.name });
      continue;
    }
    const pToken = fp.access_token || token;
    let mediaOk = false;
    let mediaCount = 0;
    try {
      const mRes = await graph(`${ig.id}/media`, { fields: 'id', limit: '5' }, pToken, version, 12000, 0);
      mediaOk = true;
      mediaCount = (mRes && Array.isArray(mRes.data)) ? mRes.data.length : 0;
    } catch { mediaOk = false; }

    // ดึงรายการแชท IG จริง (ไม่ใช่แค่เช็คว่าไม่ error) เพื่อแยกกรณี "ได้ 0 แชททั้งที่ไม่มี error"
    let messagingOk = false;
    let messagingError = null;
    let convCount = 0;
    let latestConvAt = null;
    let sampleMessagesOk = null;
    for (const params of [{ platform: 'instagram' }, { platform: 'instagram', folder: 'general' }]) {
      try {
        const r = await graph(`${fp.id}/conversations`, { ...params, fields: 'id,updated_time,messages.limit(1){id,message,created_time}', limit: '25' }, pToken, version, 25000, 1);
        messagingOk = true;
        const list = (r && r.data) || [];
        convCount += list.length;
        for (const c of list) {
          if (c.updated_time && (!latestConvAt || c.updated_time > latestConvAt)) latestConvAt = c.updated_time;
          const md = c.messages && c.messages.data;
          if (Array.isArray(md)) sampleMessagesOk = sampleMessagesOk || md.length > 0;
        }
      } catch (e) {
        if (!messagingOk) {
          const rawErr = e.message || 'Meta API ตอบสนองช้า';
          if (rawErr.includes('Timeout') || rawErr.includes('ตอบสนองช้า')) messagingError = 'Meta API ตอบสนองช้าชั่วคราว ลองกดตรวจใหม่อีกครั้ง';
          else if (/permission|\(#10\)|\(#200\)|\(#3\)|capability/i.test(rawErr)) messagingError = `Meta ปฏิเสธสิทธิ์: ${rawErr}`;
          else messagingError = rawErr;
        }
      }
    }

    // ตรวจว่าเพจนี้ subscribe webhook ให้แอปเราแล้วหรือยัง (ถ้ายัง ข้อความใหม่จะไม่เด้งเข้าระบบเอง)
    let webhook = { checked: false, subscribed: false, fields: [] };
    try {
      const r = await graph(`${fp.id}/subscribed_apps`, {}, pToken, version, 12000, 0);
      const apps = (r && r.data) || [];
      const mine = apps.find((a) => !appId || String(a.id) === appId) || null;
      webhook = { checked: true, subscribed: Boolean(mine), fields: (mine && mine.subscribed_fields) || [] };
    } catch (e) { webhook = { checked: false, error: e.message, subscribed: false, fields: [] }; }

    // สรุปสาเหตุเป็นภาษาคน
    const problems = [];
    if (!messagingOk) problems.push(messagingError || 'อ่านแชท Instagram ไม่ได้');
    else if (convCount === 0) problems.push('Meta ตอบกลับ "0 แชท" โดยไม่มี error — มักเกิดจาก (1) แอปใน Meta Developers ยังอยู่โหมด Development หรือสิทธิ์ instagram_manage_messages ยังไม่ได้ Advanced Access (จะเห็นเฉพาะแชทกับคนที่มีบทบาทในแอป) หรือ (2) Token ถูกสร้างก่อนเปิด "อนุญาตให้เข้าถึงข้อความ" ใน IG ให้สร้าง Token ใหม่');
    if (sampleMessagesOk === false) problems.push('เห็นรายการแชท แต่ Meta ไม่ส่งเนื้อหาข้อความมา (ตรวจสิทธิ์ instagram_manage_messages แบบ Advanced Access)');
    if (webhook.checked && (!webhook.subscribed || !PAGE_WEBHOOK_FIELDS.every((f) => webhook.fields.includes(f)))) problems.push('เพจยังไม่ได้ subscribe webhook ข้อความให้แอปนี้ — แชทใหม่จะไม่เด้งเข้า Inbox เอง (กดปุ่ม "เปิดรับแชทอัตโนมัติ")');

    igAccounts.push({
      igId: String(ig.id),
      username: ig.username || ig.name || `IG_${ig.id}`,
      name: ig.name || ig.username || '',
      fbPageId: String(fp.id),
      fbPageName: fp.name,
      pageToken: pToken,
      mediaOk, mediaCount,
      messagingOk, messagingError, convCount, latestConvAt, sampleMessagesOk,
      webhook,
      problems,
    });
  }

  return {
    igAccounts, unlinkedFbPages, totalFbPages: fbPages.length,
    token: { checked: tokenInfo.ok, isValid: tokenInfo.isValid, type: tokenInfo.type, missingScopes, expiresAt: tokenInfo.expiresAt || 0, error: tokenInfo.error },
  };
}

// สั่งให้ Meta ส่งข้อความ Messenger + Instagram เข้ามาที่ /webhook อัตโนมัติ
// 1) subscribe ระดับแอป (object=page และ instagram) ต้องมี App ID + App Secret
// 2) subscribe ระดับเพจ (ทุกเพจที่ token เข้าถึงได้ รวมเพจที่ผูก IG)
async function subscribeWebhooks(callbackUrl, verifyToken) {
  const m = getSettings().meta || {};
  if (!m.accessToken) throw new MetaError('ยังไม่ได้บันทึก Meta Access Token');
  const version = m.apiVersion || config.metaApiVersion;
  const results = { app: [], pages: [] };
  const appTok = appAccessToken(m);
  if (appTok) {
    for (const [object, fields] of [['page', PAGE_WEBHOOK_FIELDS.join(',')], ['instagram', 'messages,messaging_postbacks,messaging_referral,comments']]) {
      try {
        const url = new URL(`https://graph.facebook.com/${version}/${m.appId}/subscriptions`);
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${appTok}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ object, callback_url: callbackUrl, fields, verify_token: verifyToken, include_values: 'true' }),
          signal: AbortSignal.timeout(20000),
        });
        const j = await res.json().catch(() => ({}));
        results.app.push({ object, ok: Boolean(j && j.success), error: j && j.error ? j.error.message : null });
      } catch (e) { results.app.push({ object, ok: false, error: e.message }); }
    }
  } else {
    results.app.push({ object: 'app', ok: false, error: 'ยังไม่ได้บันทึก App ID / App Secret — ข้ามการตั้งค่าระดับแอป (ตั้งเองได้ใน Meta Developers > Webhooks)' });
  }
  const fbPages = await fetchManagedPages(m.accessToken);
  for (const fp of fbPages) {
    try {
      const url = new URL(`https://graph.facebook.com/${version}/${fp.id}/subscribed_apps`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${fp.access_token || m.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ subscribed_fields: PAGE_WEBHOOK_FIELDS.join(',') }),
        signal: AbortSignal.timeout(20000),
      });
      const j = await res.json().catch(() => ({}));
      results.pages.push({ pageId: String(fp.id), pageName: fp.name, ok: Boolean(j && j.success), error: j && j.error ? j.error.message : null });
    } catch (e) { results.pages.push({ pageId: String(fp.id), pageName: fp.name, ok: false, error: e.message }); }
  }
  return results;
}

// มีข้อมูลช่วงนี้ในหน่วยความจำที่ยังไม่หมดอายุไหม (ใช้ตัดสินว่าจะตอบด้วยข้อมูลที่บันทึกไว้ก่อน แล้วค่อยดึงใหม่เบื้องหลัง)
function hasFresh({ from, to }) {
  for (const [k, v] of cache) if (k.endsWith(`|${from}|${to}`) && Date.now() - v.at < CACHE_MS) return true;
  return false;
}

// ข้อมูล Meta ชุดล่าสุดที่โหลดสำเร็จ (ช่วงไหนก็ได้) — ใช้กับหน้าที่ไม่ต้องการตัวเลขโฆษณา เช่น Inbox / Board
function lastSnapshot() {
  let best = null;
  for (const v of cache.values()) if (!best || v.at > best.at) best = v;
  return best ? best.data : null;
}

function clearCache() { cache.clear(); pageTokens.clear(); loadFailures.clear(); }

// ห่อการโหลดจาก Meta ให้เสถียร:
// 1) คำขอพร้อมกันหลายตัว (หน้า Dashboard ยิงหลาย API พร้อมกัน) ใช้ผลการโหลดเดียวกัน ไม่ยิง Meta ซ้ำซ้อนจนติด rate limit
// 2) ถ้า Meta ล้ม (token หมดอายุ / rate limit / เน็ตล่ม) จำไว้ 60 วินาที แล้วตอบด้วยข้อมูลสำรองทันที ไม่ต้องรอ timeout ทุกคำขอ
const loadInflight = new Map();
const loadFailures = new Map();
const LOAD_FAIL_BACKOFF_MS = 60 * 1000;
async function load(range) {
  const key = `${range.from}|${range.to}`;
  const f = loadFailures.get(key);
  if (f && Date.now() - f.at < LOAD_FAIL_BACKOFF_MS) throw f.err;
  if (loadInflight.has(key)) return loadInflight.get(key);
  const p = loadUncached(range)
    .then((d) => { loadFailures.delete(key); return d; }, (e) => { loadFailures.set(key, { at: Date.now(), err: e }); throw e; })
    .finally(() => loadInflight.delete(key));
  loadInflight.set(key, p);
  return p;
}


async function fetchPostsAndComments(pageId, platform = 'Facebook', fbPageId = null, limit = 300, commentLimit = 500, opts = {}) {
  // กรองตามช่วงวันที่ (ไม่ระบุ = ทั้งหมด) โพสต์เรียงจากใหม่ไปเก่า จึงหยุดได้เมื่อเลยวันเริ่มต้น
  const afterMs = opts.afterDate ? Date.parse(opts.afterDate + 'T00:00:00+07:00') : null;
  const beforeMs = opts.beforeDate ? Date.parse(opts.beforeDate + 'T23:59:59+07:00') : null;
  let reachedOld = false;
  const inRange = (item) => {
    const t = Date.parse(item.timestamp || item.created_time || '');
    if (!Number.isFinite(t)) return true;
    if (afterMs && t < afterMs) { reachedOld = true; return false; }
    if (beforeMs && t > beforeMs) return false;
    return true;
  };
  const progress = typeof opts.onProgress === 'function' ? opts.onProgress : jobs.report;
  const shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : jobs.cancelled;
  const m = getSettings().meta || {};
  if (!m.accessToken) throw new MetaError('ยังไม่ได้เชื่อม Meta');
  const version = m.apiVersion || config.metaApiVersion;
  const isIg = platform === 'Instagram';

  const token = await pageToken(fbPageId || pageId, m);
  const posts = [];
  const seenIds = new Set();

  if (isIg) {
    // Instagram Media & Comments (วน Paging ดึงได้สูงสุดตาม limit พร้อมรูปและวิดีโอ)
    try {
      let nextUrl = `${pageId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments.limit(100){id,text,timestamp,from,replies{id,text,timestamp,from}}&limit=50`;
      let fetched = 0;
      while (nextUrl && fetched < limit) {
        let res;
        if (nextUrl.startsWith('http')) {
          const r = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
          res = await r.json();
        } else {
          res = await graph(nextUrl, {}, token, version, 20000);
        }
        if (res && res.error) { console.warn('[Meta] IG media paging:', res.error.message); break; }
        const rawItems = (res && res.data) || [];
        if (!rawItems.length) break;
        reachedOld = false;
        const items = rawItems.filter(inRange).slice(0, Math.max(0, limit - fetched));
        // ดึงคอมเมนต์หน้าถัดไปของแต่ละโพสต์ (เกิน 100 คอมเมนต์)
        await expandPaging(items, 'comments', token, { maxPer: commentLimit });

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
        progress({ phase: 'posts', done: fetched, total: limit, note: '' });
        nextUrl = !reachedOld && !shouldStop() && res.paging && res.paging.next ? res.paging.next : null;
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
          let nextUrl = `${ep}?fields=id,message,story,full_picture,source,attachments{media_type,media},created_time,permalink_url,comments.limit(100){id,message,created_time,from,comments.limit(50){id,message,created_time,from}}&limit=50`;
          let epFetched = 0;
          const maxPerEp = limit >= ALL_LIMIT ? limit : Math.ceil(limit / 2); // แบ่งโควตาให้โพสต์โฆษณา (dark post) ด้วย

          while (nextUrl && epFetched < maxPerEp && posts.length < limit) {
            let res;
            if (nextUrl.startsWith('http')) {
              const r = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
              res = await r.json();
            } else {
              res = await graph(nextUrl, {}, token, version, 20000);
            }
            if (res && res.error) { console.warn('[Meta] posts paging:', res.error.message); break; }
            const rawItems = (res && res.data) || [];
            if (!rawItems.length) break;
            reachedOld = false;
            const items = rawItems.filter((it) => !seenIds.has(it.id) && inRange(it)).slice(0, Math.max(0, limit - posts.length));
            await expandPaging(items, 'comments', token, { maxPer: commentLimit });

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
            progress({ phase: 'posts', done: posts.length, total: limit });
            nextUrl = !reachedOld && !shouldStop() && res.paging && res.paging.next ? res.paging.next : null;
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
  fetchFbConversations, fetchManagedPages, fetchAdAccounts, fetchPostsAndComments, testInstagramConnection, graph,
  clampInsightsFrom, expandPaging, ALL_LIMIT, subscribeWebhooks, lastSnapshot, hasFresh,
};
