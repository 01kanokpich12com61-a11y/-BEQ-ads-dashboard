'use strict';
const { addDays, eachDay, today } = require('./dates');

// ความคืบหน้าของแชท เรียงตามคอลัมน์ใน Board ตามลำดับที่ผู้ใช้กำหนด (9 คอลัมน์ หลังรวมสถานะที่ซ้ำ)
const STATUSES = [
  'no_reply',     // 1. ไม่ตอบ (กล่องสีแดง)
  'very_poor',    // 2. แย่มาก (กล่องสีแดง)
  'talked',       // 3. พอได้คุย (กล่องสีเขียว)
  'in_progress',  // 4. กำลังดำเนินการ (รวม In-progress เดิม)
  'qualified',    // 5. มีคุณสมบัติ (รวม Qualifile เดิม)
  'appointment',  // 6. นัดแล้ว
  'new',          // 7. มาใหม่
  'intake',       // 8. คัดกรอง (In-take)
  'converted',    // 9. ปิดการขาย (รวม "สร้างคอนเวอร์ชั่นแล้ว" เดิม)
];

const div = (a, b) => (b ? a / b : null);
const round = (n, d = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

function aggregate(rows) {
  const t = {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    uniqueClicks: 0,
    linkClicks: 0,
    messages: 0,
    firstReplies: 0,
    metaLeads: 0,
    purchases: 0,
    purchaseValue: 0,
    postEngagement: 0,
    reactions: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    landingPageViews: 0,
    videoPlays: 0,
    videoThruPlays: 0,
    videoP25: 0,
    videoP50: 0,
    videoP75: 0,
    videoP100: 0,
  };
  for (const r of rows) for (const k of Object.keys(t)) t[k] += r[k] || 0;
  return {
    ...t,
    frequency: div(t.impressions, t.reach),
    cpm: div(t.spend, t.impressions) === null ? null : (t.spend / t.impressions) * 1000,
    cpp: div(t.spend, t.reach) === null ? null : (t.spend / t.reach) * 1000,
    ctr: div(t.clicks, t.impressions) === null ? null : (t.clicks / t.impressions) * 100,
    linkCtr: div(t.linkClicks, t.impressions) === null ? null : (t.linkClicks / t.impressions) * 100,
    cpc: div(t.spend, t.clicks),
    costPerLinkClick: div(t.spend, t.linkClicks),
    costMessage: div(t.spend, t.messages),
    costPerMetaLead: div(t.spend, t.metaLeads),
    costPurchase: div(t.spend, t.purchases),
    conversionRate: div(t.purchases, t.messages) === null ? null : (t.purchases / t.messages) * 100,
    costPerEngagement: div(t.spend, t.postEngagement),
    costPerThruPlay: div(t.spend, t.videoThruPlays),
    videoWatchRate: div(t.videoThruPlays, t.videoPlays) === null ? null : (t.videoThruPlays / t.videoPlays) * 100,
  };
}

// [key, inverse]  inverse = ยิ่งต่ำยิ่งดี (ต้นทุน)
const KPI_DEFS = [
  ['spend', false], ['reach', false], ['impressions', false], ['cpm', true],
  ['clicks', false], ['ctr', false], ['cpc', true],
  ['messages', false], ['costMessage', true], ['purchases', false], ['conversionRate', false], ['costPurchase', true],
];

function kpis(cur, prev) {
  const out = {};
  for (const [k, inverse] of KPI_DEFS) {
    const c = cur[k]; const p = prev[k];
    out[k] = {
      value: round(c, 4),
      prev: round(p, 4),
      delta: c === null || p === null || p === 0 ? null : round(((c - p) / p) * 100, 1),
      inverse,
    };
  }
  return out;
}

function qualityLabel(score) {
  if (score === null) return 'none';
  if (score >= 55) return 'excellent';
  if (score >= 35) return 'good';
  if (score >= 20) return 'average';
  return 'poor';
}

// แพลตฟอร์มที่ระบบรองรับ — ค่าอื่น (เช่น วันที่ที่หลุดมาจากไฟล์นำเข้าที่คอลัมน์เลื่อน) ไม่นับเป็นแพลตฟอร์ม
const PLATFORMS = ['Facebook', 'Instagram', 'LINE', 'WhatsApp', 'TikTok', 'WeChat'];
function normalizePlatform(v, channel) {
  const s = String(v || '').trim().toLowerCase();
  const c = String(channel || '').toLowerCase();
  const pick = (x) => {
    if (!x) return '';
    if (x.includes('insta') || x === 'ig') return 'Instagram';
    if (x.includes('whatsapp') || x === 'wa') return 'WhatsApp';
    if (x.includes('line')) return 'LINE';
    if (x.includes('tiktok')) return 'TikTok';
    if (x.includes('wechat') || x.includes('weixin')) return 'WeChat';
    if (x.includes('facebook') || x.includes('messenger') || x === 'fb') return 'Facebook';
    return '';
  };
  return pick(s) || pick(c) || 'Facebook';
}

function listFilters(data) {
  const platforms = PLATFORMS.slice();
  const pages = (data.pages || []).filter((p) => {
    if (!p || !p.name) return false;
    const n = String(p.name).toLowerCase();
    const id = String(p.id || '').toLowerCase();
    if (n.includes('channel') || id.includes('channel')) return false;
    return true;
  });
  return {
    platforms,
    pages,
    campaigns: data.campaigns || [],
    agencies: data.agencies || [],
    reps: data.reps || [],
    statuses: STATUSES,
  };
}

function matchPage(targetPage, itemPageId, itemPageName, pages = [], fallbackPlatform = 'Facebook', isAdItem = false) {
  if (!targetPage) return true;
  const pageObj = pages.find((p) => p.id === targetPage || (targetPage && p.id && String(p.id).includes(targetPage)));
  const targetName = ((pageObj && pageObj.name) || targetPage).toLowerCase().trim();
  const targetId = String(targetPage).toLowerCase().trim();
  const pid = String(itemPageId || '').toLowerCase().trim();
  const pname = String(itemPageName || (pageObj && pageObj.id === itemPageId ? pageObj.name : '')).toLowerCase().trim();

  if (pid && targetId && pid === targetId) return true;
  if (pname && targetName && (pname === targetName || pname.includes(targetName) || targetName.includes(pname))) return true;
  if (pid && targetId && (pid.includes(targetId) || targetId.includes(pid))) return true;

  // สำหรับโฆษณา (Ads): หากเลือกเพจ Instagram ที่ผูกกับ Facebook Page แม่ (fbPageId) ให้แสดงโฆษณาของเพจคู่นั้นด้วย
  if (isAdItem && pageObj && pageObj.fbPageId && String(pageObj.fbPageId).toLowerCase() === pid) {
    return true;
  }

  // หากโฆษณาใช้แคมเปญร่วมกันหรือไม่มีระบุเพจเฉพาะ (unknown) ให้แสดงผลเมื่อเลือกเพจหลัก
  if (isAdItem && (itemPageId === 'unknown' || !itemPageId)) return true;

  // Fallback: ถ้าเป็นแพลตฟอร์มเดียวกันและมีเพียงเพจเดียวในระบบ ให้ถือว่าตรงกัน
  const plat = String(fallbackPlatform || 'Facebook').toLowerCase();
  const samePlatPages = pages.filter((p) => (p.platform || 'Facebook').toLowerCase() === plat);
  if (samePlatPages.length <= 1 && samePlatPages[0] && String(samePlatPages[0].id).toLowerCase() === targetId) return true;

  return false;
}

function buildDashboard(data, range, q = {}) {
  const campName = Object.fromEntries(data.campaigns.map((c) => [c.id, c.name]));
  const pageName = Object.fromEntries(data.pages.map((p) => [p.id, p.name]));
  const repName = Object.fromEntries(data.reps.map((r) => [r.id, r.name]));
  const igLinkedFbPageIds = new Set((data.pages || []).filter((p) => p.platform === 'Instagram' && p.fbPageId).map((p) => String(p.fbPageId)));

  const ads = data.ads.filter((a) => {
    if (q.platform) {
      const qPlat = q.platform.toLowerCase();
      const aPlat = String(a.platform || 'Facebook').toLowerCase();
      if (qPlat === 'instagram') {
        // โฆษณา Meta รันร่วมกันทั้ง Facebook & Instagram: แสดงโฆษณาที่รันบน IG หรือผูกกับเพจที่มี IG Business Account
        const hasIgPlacement = String(a.placement || '').toLowerCase().includes('instagram') || String(a.thumb || '').includes('cdninstagram.com') || Boolean(a.igMediaId);
        const hasLinkedIgPage = igLinkedFbPageIds.has(String(a.pageId));
        if (aPlat !== 'instagram' && !hasIgPlacement && !hasLinkedIgPage && aPlat !== 'facebook') return false;
      } else if (aPlat !== qPlat) {
        return false;
      }
    }
    if (q.page) {
      if (!matchPage(q.page, a.pageId, a.pageName || pageName[a.pageId], data.pages, a.platform, true)) {
        return false;
      }
    }
    if (q.campaign && a.campaignId !== q.campaign) return false;
    if (q.agency && a.agencyId !== q.agency) return false;
    return true;
  });
  const adIds = new Set(ads.map((a) => a.id));

  const daily = data.daily.filter((r) => adIds.has(r.adId));
  let cur = daily.filter((r) => r.date >= range.from && r.date <= range.to);
  let prev = daily.filter((r) => r.date >= range.prevFrom && r.date <= range.prevTo);
  if (cur.length === 0 && daily.length > 0) {
    cur = daily; // แสดงข้อมูลที่มีในระบบเพื่อไม่ให้หน้า Dashboard ว่าง
  }

  const adPageMap = Object.fromEntries(data.ads.map((a) => [a.id, a.pageId]));
  const allAdIds = new Set(data.ads.map((a) => a.id));
  const inLeadScope = (l) => {
    const effectivePageId = l.pageId || adPageMap[l.adId] || '';
    const effectivePageName = l.pageName || pageName[effectivePageId] || '';
    const lPlat = String(
      l.platform ||
      (l.channel === 'Instagram' || l.channel === 'IG' ? 'Instagram' :
       l.channel === 'LINE' ? 'LINE' :
       l.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook')
    );
    if (q.platform && lPlat.toLowerCase() !== q.platform.toLowerCase()) return false;
    if (q.page && !matchPage(q.page, effectivePageId, effectivePageName, data.pages, lPlat)) return false;
    if (q.rep && l.repId !== q.rep) return false;
    if (q.status && l.status !== q.status) return false;
    if (adIds.has(l.adId) || !adIds.size) return true;
    // ลีดที่ไม่ได้ผูกกับโฆษณาที่ดึงมา (แชททักเอง / แชทเก่าที่ Meta ไม่บอกว่ามาจากโฆษณาไหน)
    // นับรวมด้วย ยกเว้นกรองแคมเปญ/บัญชีโฆษณา (ซึ่งต้องผูกกับโฆษณาเท่านั้น)
    if (q.campaign || q.agency) return false;
    return !allAdIds.has(l.adId);
  };
  // ลีดนับตามวันที่เสมอ (แม้ช่วงนั้นไม่มีข้อมูลโฆษณาแล้วระบบแสดงโฆษณาทั้งหมดแทน)
  const leadsCur = data.leads.filter((l) => inLeadScope(l) && l.date >= range.from && l.date <= range.to);
  const leadsPrev = data.leads.filter((l) => inLeadScope(l) && l.date >= range.prevFrom && l.date <= range.prevTo);

  const campMapObj = Object.fromEntries(data.campaigns.map((c) => [c.id, c]));
  const agencyName = Object.fromEntries((data.agencies || []).map((ag) => [ag.id, ag.name]));

  // ตารางแคมเปญ/โฆษณา (ข้อมูลครบทุกมิติ)
  const sparkFrom = addDays(range.to, -13);
  let rows = ads.map((a) => {
    const rowsCur = cur.filter((r) => r.adId === a.id);
    const m = aggregate(rowsCur);
    const ls = leadsCur.filter((l) => l.adId === a.id);
    const good = ls.filter((l) => l.quality === 'good').length;
    const closedList = ls.filter((l) => (l.value || 0) > 0 || l.status === 'converted');
    const closedDeals = closedList.length;
    const closedRevenue = closedList.reduce((s, l) => s + (l.value || 0), 0);
    const totalRevenue = closedRevenue > 0 ? closedRevenue : (m.purchaseValue || 0);
    const roas = m.spend > 0 && totalRevenue > 0 ? round(totalRevenue / m.spend, 2) : null;
    const score = ls.length ? Math.round((good / ls.length) * 100) : null;
    const byDay = Object.fromEntries(rowsCur.map((r) => [r.date, r.messages]));
    const cObj = campMapObj[a.campaignId] || {};
    return {
      id: a.id,
      name: a.name,
      status: a.status || 'ACTIVE',
      configuredStatus: a.configuredStatus || a.status || 'ACTIVE',
      campaignId: a.campaignId,
      campaign: campName[a.campaignId] || a.campaign || '',
      campaignStatus: a.campaignStatus || cObj.status || 'ACTIVE',
      objective: a.objective || cObj.objective || 'OUTCOME_ENGAGEMENT',
      buyingType: a.buyingType || cObj.buyingType || 'AUCTION',
      adsetId: a.adsetId || '',
      adset: a.adset || '',
      adsetStatus: a.adsetStatus || a.status || 'ACTIVE',
      optimizationGoal: a.optimizationGoal || 'CONVERSATIONS',
      billingEvent: a.billingEvent || 'IMPRESSIONS',
      bidStrategy: a.bidStrategy || cObj.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
      destinationType: a.destinationType || 'MESSENGER',
      dailyBudget: a.dailyBudget ?? cObj.dailyBudget ?? null,
      lifetimeBudget: a.lifetimeBudget ?? cObj.lifetimeBudget ?? null,
      budgetRemaining: a.budgetRemaining ?? cObj.budgetRemaining ?? null,
      startTime: a.startTime || cObj.startTime || '',
      stopTime: a.stopTime || cObj.stopTime || '',
      updatedTime: a.updatedTime || cObj.updatedTime || '',
      targetingSummary: a.targetingSummary || a.adset || '',
      placement: a.placement || 'Facebook & Instagram Feeds, Reels, Stories',
      pageId: a.pageId || '',
      page: pageName[a.pageId] || a.pageName || '',
      platform: a.platform || 'Facebook',
      agencyId: a.agencyId || '',
      agency: agencyName[a.agencyId] || a.agencyId || 'In-house',
      creative: a.creative || 'IMAGE',
      thumb: a.thumb || null,
      videoUrl: a.videoUrl || null,
      videoId: a.videoId || null,
      headline: a.headline || a.name || '',
      body: a.body || '',
      cta: a.cta || 'SEND_MESSAGE',
      linkUrl: a.linkUrl || '',
      permalinkUrl: a.permalinkUrl || '',
      storyId: a.storyId || '',
      // Delivery & Visibility
      reach: m.reach,
      impressions: m.impressions,
      frequency: round(m.frequency, 2),
      cpm: round(m.cpm),
      cpp: round(m.cpp),
      spend: round(m.spend),
      // Clicks & Engagement
      clicks: m.clicks,
      uniqueClicks: m.uniqueClicks,
      linkClicks: m.linkClicks,
      ctr: round(m.ctr),
      linkCtr: round(m.linkCtr),
      cpc: round(m.cpc),
      costPerLinkClick: round(m.costPerLinkClick),
      postEngagement: m.postEngagement,
      reactions: m.reactions,
      comments: m.comments,
      shares: m.shares,
      saves: m.saves,
      landingPageViews: m.landingPageViews,
      costPerEngagement: round(m.costPerEngagement),
      // Video Funnel
      videoPlays: m.videoPlays,
      videoThruPlays: m.videoThruPlays,
      videoP25: m.videoP25,
      videoP50: m.videoP50,
      videoP75: m.videoP75,
      videoP100: m.videoP100,
      costPerThruPlay: round(m.costPerThruPlay),
      videoWatchRate: round(m.videoWatchRate, 1),
      // Conversions & Sales
      messages: m.messages,
      firstReplies: m.firstReplies,
      costMessage: round(m.costMessage),
      metaLeads: m.metaLeads || m.messages,
      costPerMetaLead: round(m.costPerMetaLead ?? m.costMessage),
      purchases: m.purchases,
      purchaseValue: round(m.purchaseValue),
      costPurchase: round(m.costPurchase),
      conversionRate: round(m.conversionRate, 1),
      leads: ls.length,
      qualityChats: good,
      cqc: good ? round(m.spend / good) : null,
      qualityScore: score,
      qualityLabel: qualityLabel(score),
      closedDeals,
      closedRevenue: round(closedRevenue),
      revenue: round(totalRevenue),
      roas,
      spark: eachDay(sparkFrom, range.to).map((d) => byDay[d] || 0),
    };
  }); // แสดงโฆษณาทั้งหมดที่ดึงมา ไม่ซ่อนแถวทิ้ง

  // ถ้ายังไม่มีข้อมูลสถิติ แต่มีรายชื่อโฆษณาที่นำเข้าไว้ ให้แสดงรายการโฆษณาเพื่อให้ผู้ใช้ใส่รูปและดูข้อมูลได้
  if (!rows.length && ads.length > 0) {
    rows = ads.map((a) => ({
      id: a.id, name: a.name, status: a.status || 'ACTIVE',
      campaignId: a.campaignId, campaign: campName[a.campaignId] || '',
      objective: a.objective || 'OUTCOME_ENGAGEMENT', buyingType: a.buyingType || 'AUCTION',
      adset: a.adset || '', optimizationGoal: a.optimizationGoal || 'CONVERSATIONS',
      bidStrategy: a.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
      dailyBudget: a.dailyBudget || null, lifetimeBudget: a.lifetimeBudget || null,
      targetingSummary: a.targetingSummary || a.adset || '',
      placement: a.placement || 'Facebook & Instagram',
      page: pageName[a.pageId] || a.pageName || '', platform: a.platform || 'Facebook',
      agency: agencyName[a.agencyId] || a.agencyId || 'In-house',
      creative: a.creative || 'IMAGE', thumb: a.thumb || null, videoUrl: a.videoUrl || null,
      headline: a.headline || a.name || '', body: a.body || '', cta: a.cta || 'SEND_MESSAGE',
      reach: 0, impressions: 0, frequency: 0, cpm: 0, cpp: 0, ctr: 0, linkCtr: 0,
      clicks: 0, uniqueClicks: 0, linkClicks: 0, cpc: 0, costPerLinkClick: 0,
      postEngagement: 0, reactions: 0, comments: 0, shares: 0, saves: 0, landingPageViews: 0,
      videoPlays: 0, videoThruPlays: 0, videoP25: 0, videoP50: 0, videoP75: 0, videoP100: 0,
      messages: 0, costMessage: 0, metaLeads: 0, cqc: null, purchases: 0, purchaseValue: 0,
      costPurchase: null, conversionRate: 0, spend: 0,
      leads: 0, qualityChats: 0, qualityScore: null, qualityLabel: 'none',
      closedDeals: 0, closedRevenue: 0, revenue: 0, roas: null,
      spark: [0, 0, 0, 0, 0, 0, 0],
    }));
  }

  // สรุประดับแคมเปญ (Campaign-Level Summary Rollup)
  const campaignGroupMap = new Map();
  for (const r of rows) {
    const cid = r.campaignId || r.campaign || 'none';
    if (!campaignGroupMap.has(cid)) {
      const cObj = campMapObj[cid] || {};
      campaignGroupMap.set(cid, {
        id: cid,
        name: r.campaign || cObj.name || cid,
        status: r.campaignStatus || cObj.status || 'ACTIVE',
        objective: r.objective || cObj.objective || 'OUTCOME_ENGAGEMENT',
        buyingType: r.buyingType || cObj.buyingType || 'AUCTION',
        bidStrategy: r.bidStrategy || cObj.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
        dailyBudget: cObj.dailyBudget || 0,
        lifetimeBudget: cObj.lifetimeBudget || null,
        startTime: r.startTime || cObj.startTime || '',
        updatedTime: r.updatedTime || cObj.updatedTime || '',
        adsCount: 0,
        activeAdsCount: 0,
        adsetsSet: new Set(),
        pagesSet: new Set(),
        adIds: [],
        thumb: r.thumb || null,
        videoUrl: r.videoUrl || null,
        creative: r.creative || 'IMAGE',
      });
    }
    const g = campaignGroupMap.get(cid);
    g.adsCount++;
    if (String(r.status).toUpperCase() === 'ACTIVE') g.activeAdsCount++;
    if (r.adset) g.adsetsSet.add(r.adset);
    if (r.page) g.pagesSet.add(r.page);
    if (!campMapObj[cid]?.dailyBudget && r.dailyBudget) g.dailyBudget += r.dailyBudget;
    if (!g.thumb && r.thumb) g.thumb = r.thumb;
    if (!g.videoUrl && r.videoUrl) { g.videoUrl = r.videoUrl; g.creative = 'VIDEO'; }
    g.adIds.push(r.id);
  }
  const campaignRows = [...campaignGroupMap.values()].map((g) => {
    const idSet = new Set(g.adIds);
    const rowsCur = cur.filter((r) => idSet.has(r.adId));
    const m = aggregate(rowsCur);
    const ls = leadsCur.filter((l) => idSet.has(l.adId));
    const good = ls.filter((l) => l.quality === 'good').length;
    const closedList = ls.filter((l) => (l.value || 0) > 0 || l.status === 'converted');
    const closedRevenue = closedList.reduce((s, l) => s + (l.value || 0), 0);
    const totalRevenue = closedRevenue > 0 ? closedRevenue : (m.purchaseValue || 0);
    const score = ls.length ? Math.round((good / ls.length) * 100) : null;
    return {
      id: g.id,
      name: g.name,
      status: g.status,
      objective: g.objective,
      buyingType: g.buyingType,
      bidStrategy: g.bidStrategy,
      dailyBudget: g.dailyBudget || null,
      lifetimeBudget: g.lifetimeBudget,
      startTime: g.startTime,
      updatedTime: g.updatedTime,
      adsCount: g.adsCount,
      activeAdsCount: g.activeAdsCount,
      adsetsCount: g.adsetsSet.size,
      adsetsList: [...g.adsetsSet],
      pagesList: [...g.pagesSet],
      thumb: g.thumb,
      videoUrl: g.videoUrl,
      creative: g.creative,
      spend: round(m.spend),
      reach: m.reach,
      impressions: m.impressions,
      frequency: round(m.frequency, 2),
      cpm: round(m.cpm),
      cpp: round(m.cpp),
      clicks: m.clicks,
      linkClicks: m.linkClicks,
      ctr: round(m.ctr),
      linkCtr: round(m.linkCtr),
      cpc: round(m.cpc),
      costPerLinkClick: round(m.costPerLinkClick),
      postEngagement: m.postEngagement,
      reactions: m.reactions,
      comments: m.comments,
      shares: m.shares,
      saves: m.saves,
      videoPlays: m.videoPlays,
      videoThruPlays: m.videoThruPlays,
      videoP100: m.videoP100,
      messages: m.messages,
      costMessage: round(m.costMessage),
      purchases: m.purchases,
      costPurchase: round(m.costPurchase),
      conversionRate: round(m.conversionRate, 1),
      leads: ls.length,
      qualityChats: good,
      cqc: good ? round(m.spend / good) : null,
      qualityScore: score,
      qualityLabel: qualityLabel(score),
      closedDeals: closedList.length,
      revenue: round(totalRevenue),
      roas: m.spend > 0 && totalRevenue > 0 ? round(totalRevenue / m.spend, 2) : null,
    };
  });

  // สรุประดับชุดโฆษณา (Ad Set-Level Summary Rollup)
  const adsetGroupMap = new Map();
  for (const r of rows) {
    const asKey = `${r.campaignId}::${r.adset || 'Default Ad Set'}`;
    if (!adsetGroupMap.has(asKey)) {
      adsetGroupMap.set(asKey, {
        id: r.adsetId || asKey,
        name: r.adset || 'Default Ad Set',
        campaignId: r.campaignId,
        campaign: r.campaign,
        status: r.adsetStatus || r.status || 'ACTIVE',
        optimizationGoal: r.optimizationGoal || 'CONVERSATIONS',
        destinationType: r.destinationType || 'MESSENGER',
        bidStrategy: r.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
        dailyBudget: r.dailyBudget || null,
        targetingSummary: r.targetingSummary || r.adset || '',
        placement: r.placement || '',
        adsCount: 0,
        activeAdsCount: 0,
        adIds: [],
      });
    }
    const g = adsetGroupMap.get(asKey);
    g.adsCount++;
    if (String(r.status).toUpperCase() === 'ACTIVE') g.activeAdsCount++;
    g.adIds.push(r.id);
  }
  const adsetRows = [...adsetGroupMap.values()].map((g) => {
    const idSet = new Set(g.adIds);
    const rowsCur = cur.filter((r) => idSet.has(r.adId));
    const m = aggregate(rowsCur);
    const ls = leadsCur.filter((l) => idSet.has(l.adId));
    const good = ls.filter((l) => l.quality === 'good').length;
    const closedList = ls.filter((l) => (l.value || 0) > 0 || l.status === 'converted');
    const closedRevenue = closedList.reduce((s, l) => s + (l.value || 0), 0);
    const totalRevenue = closedRevenue > 0 ? closedRevenue : (m.purchaseValue || 0);
    const score = ls.length ? Math.round((good / ls.length) * 100) : null;
    return {
      ...g,
      spend: round(m.spend),
      reach: m.reach,
      impressions: m.impressions,
      frequency: round(m.frequency, 2),
      cpm: round(m.cpm),
      clicks: m.clicks,
      linkClicks: m.linkClicks,
      ctr: round(m.ctr),
      cpc: round(m.cpc),
      postEngagement: m.postEngagement,
      videoPlays: m.videoPlays,
      videoThruPlays: m.videoThruPlays,
      messages: m.messages,
      costMessage: round(m.costMessage),
      purchases: m.purchases,
      costPurchase: round(m.costPurchase),
      conversionRate: round(m.conversionRate, 1),
      leads: ls.length,
      qualityChats: good,
      cqc: good ? round(m.spend / good) : null,
      qualityScore: score,
      qualityLabel: qualityLabel(score),
      revenue: round(totalRevenue),
      roas: m.spend > 0 && totalRevenue > 0 ? round(totalRevenue / m.spend, 2) : null,
    };
  });

  // Trend รายวัน
  const dates = eachDay(range.from, range.to);
  const dayMap = {};
  for (const r of cur) {
    const d = (dayMap[r.date] ||= { spend: 0, messages: 0, purchases: 0, clicks: 0, leads: 0 });
    d.spend += r.spend; d.messages += r.messages; d.purchases += r.purchases; d.clicks += r.clicks;
  }
  for (const l of leadsCur) (dayMap[l.date] ||= { spend: 0, messages: 0, purchases: 0, clicks: 0, leads: 0 }).leads += 1;
  const trend = {
    dates,
    spend: dates.map((d) => round((dayMap[d] || {}).spend || 0)),
    messages: dates.map((d) => (dayMap[d] || {}).messages || 0),
    purchases: dates.map((d) => (dayMap[d] || {}).purchases || 0),
    leads: dates.map((d) => (dayMap[d] || {}).leads || 0),
  };

  // แชทและคุณภาพ
  const count = (arr, f) => arr.filter(f).length;
  const resp = leadsCur.map((l) => l.firstResponseMin).filter((v) => typeof v === 'number');
  const chat = {
    leads: leadsCur.length,
    leadsPrev: leadsPrev.length,
    qualityChats: count(leadsCur, (l) => l.quality === 'good'),
    avgFirstResponse: resp.length ? round(resp.reduce((a, b) => a + b, 0) / resp.length, 1) : null,
    quality: ['good', 'average', 'poor'].map((k) => ({ key: k, count: count(leadsCur, (l) => l.quality === k) })),
    funnel: STATUSES.map((k) => ({ key: k, count: count(leadsCur, (l) => l.status === k) })),
    costPerLead: leadsCur.length ? round(aggregate(cur).spend / leadsCur.length) : null,
  };

  // ทีมขาย — นับจากลีดที่เข้ามาในช่วงที่เลือก
  // ปิดได้ = สถานะ "ปิดการขาย" หรือมียอดเงิน (จากไฟล์นำเข้า) · เซลล์ที่ได้ยอด = คนที่ปิด (ถ้ามี) ไม่งั้นเจ้าของแชท
  const isClosed = (l) => l.status === 'converted' || (Number(l.value) || 0) > 0;
  const repNameMap = new Map((data.reps || []).map((r) => [String(r.id).toLowerCase(), r.name || r.id]));
  // ชื่อที่ไม่ใช่คน (เช่น ชื่อเพจที่ตอบแชท) ไม่นับเป็นเซลล์ → รวมในแถว "ยังไม่มีเจ้าของ"
  const asRep = (v) => { const s = String(v || '').trim(); return s && (!repNameMap.size || repNameMap.has(s.toLowerCase())) ? s : ''; };
  const repKey = (l) => (isClosed(l) && asRep(l.closedRep)) || asRep(l.repId) || asRep(l.rep);
  const repGroups = new Map();
  for (const l of leadsCur) {
    const k = repKey(l);
    const id = k || '__none__';
    if (!repGroups.has(id)) repGroups.set(id, { id: k, name: k ? (repNameMap.get(k.toLowerCase()) || k) : 'ยังไม่มีเจ้าของ', ls: [] });
    repGroups.get(id).ls.push(l);
  }
  const sales = [...repGroups.values()].map((g) => {
    const ls = g.ls;
    const closed = ls.filter(isClosed);
    const rt = ls.map((l) => l.firstResponseMin).filter((v) => typeof v === 'number');
    const withValue = closed.filter((l) => (Number(l.value) || 0) > 0);
    return {
      id: g.id, name: g.name, leads: ls.length,
      qualified: count(ls, (l) => ['qualified', 'appointment', 'converted'].includes(l.status)),
      closed: closed.length,
      closedNoValue: closed.length - withValue.length,
      revenue: round(withValue.reduce((s, l) => s + Number(l.value), 0)),
      avgDeal: withValue.length ? round(withValue.reduce((s, l) => s + Number(l.value), 0) / withValue.length) : null,
      closeRate: ls.length ? round((closed.length / ls.length) * 100, 1) : null,
      avgFirstResponse: rt.length ? round(rt.reduce((s, v) => s + v, 0) / rt.length, 1) : null,
      closedLeads: closed
        .map((l) => ({ id: l.id, name: l.name || '', date: l.date || '', closedAt: l.closedAt || '', closedBy: l.closedBy || '', value: Number(l.value) || 0, page: l.pageName || '', platform: l.platform || '' }))
        .sort((a, b) => String(b.closedAt || b.date).localeCompare(String(a.closedAt || a.date))),
    };
  }).sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || b.closed - a.closed || b.revenue - a.revenue || b.leads - a.leads);
  const revenue = sales.reduce((s, r) => s + r.revenue, 0);

  // ลีดที่หลุด
  const dropped = leadsCur.filter((l) => l.status === 'no_reply' || l.status === 'very_poor');
  const reasons = {};
  for (const l of dropped) reasons[l.dropReason || 'ไม่ระบุ'] = (reasons[l.dropReason || 'ไม่ระบุ'] || 0) + 1;
  const adName = Object.fromEntries(data.ads.map((a) => [a.id, a.name]));

  // ตาราง โฆษณา × สถานะลีด (ลีดที่ไม่ผูกโฆษณา รวมเป็นแถว "ไม่ทราบโฆษณา" ตามที่มา)
  const UNLINKED = { Paid: 'ไม่ทราบโฆษณา (ลีดจากโฆษณา)', Organic: 'ทักเอง (Organic)', Direct: 'ไม่ทราบโฆษณา / ทักเอง' };
  const adById = new Map(data.ads.map((a) => [a.id, a]));
  const groups = new Map();
  for (const l of leadsCur) {
    const linked = adById.has(l.adId) && l.adId !== 'Direct';
    const key = linked ? l.adId : `~${UNLINKED[l.adId] ? l.adId : 'Direct'}`;
    let g = groups.get(key);
    if (!g) {
      const a = linked ? adById.get(l.adId) : null;
      g = { id: linked ? l.adId : null, name: a ? a.name : UNLINKED[key.slice(1)], status: a ? (a.status || 'ACTIVE') : null, linked, campaign: a ? (campName[a.campaignId] || '') : '', thumb: a ? (a.thumb || null) : null, leads: 0, last: '', byStatus: Object.fromEntries(STATUSES.map((k) => [k, 0])) };
      groups.set(key, g);
    }
    g.leads++;
    if (g.byStatus[l.status] !== undefined) g.byStatus[l.status]++;
    const when = String(l.statusAt || l.lastMessageAt || l.date || '');
    if (when > g.last) g.last = when;
  }
  const adStatus = [...groups.values()].map((g) => {
    const qualified = g.byStatus.qualified + g.byStatus.appointment + g.byStatus.converted;
    return { ...g, qualified, rate: g.leads ? round((qualified / g.leads) * 100, 1) : null };
  }).sort((a, b) => (b.linked - a.linked) || b.leads - a.leads);

  // ข้อมูลที่มีในระบบ (ไม่ขึ้นกับช่วงวันที่) + แถบ 90 วันล่าสุด
  const scopedLeads = data.leads.filter(inLeadScope);
  const end = today();
  const leadDates = scopedLeads.map((l) => String(l.date || '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= end).sort();
  const adDates = daily.map((r) => r.date).sort();
  const start = addDays(end, -89);
  const perDay = {};
  for (const d of leadDates) if (d >= start && d <= end) (perDay[d] ||= { leads: 0, spend: 0 }).leads++;
  for (const r of daily) if (r.date >= start && r.date <= end) (perDay[r.date] ||= { leads: 0, spend: 0 }).spend += r.spend || 0;
  const coverage = {
    leads: { from: leadDates[0] || null, to: leadDates[leadDates.length - 1] || null, count: leadDates.length },
    ads: { from: adDates[0] || null, to: adDates[adDates.length - 1] || null, rows: adDates.length },
    days: eachDay(start, end).map((d) => ({ date: d, leads: (perDay[d] || {}).leads || 0, spend: round((perDay[d] || {}).spend || 0) })),
  };

  return {
    range,
    adStatus,
    coverage,
    scope: { ads: rows.length, campaigns: campaignRows.length, adsets: adsetRows.length, leads: leadsCur.length, records: cur.length },
    kpis: kpis(aggregate(cur), aggregate(prev)),
    totals: aggregate(cur),
    ads: rows,
    campaigns: campaignRows,
    adsets: adsetRows,
    trend,
    chat,
    sales: { reps: sales, revenue, closed: sales.reduce((s, r) => s + r.closed, 0), closedNoValue: sales.reduce((s, r) => s + r.closedNoValue, 0), leads: leadsCur.length },
    dropped: {
      total: dropped.length,
      rate: leadsCur.length ? round((dropped.length / leadsCur.length) * 100, 1) : null,
      reasons: Object.entries(reasons).map(([reason, n]) => ({ reason, count: n })).sort((a, b) => b.count - a.count),
      list: dropped.slice(0, 25).map((l) => ({
        id: l.id, name: l.name, date: l.date, reason: l.dropReason, ad: adName[l.adId] || l.adId, rep: repName[l.repId] || '',
      })),
    },
  };
}

function leadRows(data, range, extra = {}) {
  const adName = Object.fromEntries(data.ads.map((a) => [a.id, a.name]));
  const repName = Object.fromEntries(data.reps.map((r) => [r.id, r.name]));
  const pageNameMap = Object.fromEntries((data.pages || []).map((p) => [p.id, p.name]));
  const adPageMap = Object.fromEntries((data.ads || []).map((a) => [a.id, a.pageId]));
  const { messagesMap = {}, platform, page } = extra;
  return data.leads
    .filter((l) => {
      const lDate = String(l.date || '').slice(0, 10);
      if (lDate && range && range.from && range.to) {
        if (lDate < range.from || lDate > range.to) return false;
      }
      const effectivePageId = l.pageId || adPageMap[l.adId] || '';
      const effectivePageName = l.pageName || pageNameMap[effectivePageId] || '';
      const lPlat = String(
        l.platform ||
        (l.channel === 'Instagram' || l.channel === 'IG' ? 'Instagram' :
         l.channel === 'LINE' ? 'LINE' :
         l.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook')
      );
      if (platform && lPlat.toLowerCase() !== platform.toLowerCase()) return false;
      if (page && !matchPage(page, effectivePageId, effectivePageName, data.pages, lPlat)) return false;
      return true;
    })
    .map((l) => {
      const msgs = messagesMap[l.id] || (Array.isArray(l.messages) ? l.messages : []);
      let customerMsg = '';
      if (msgs.length) {
        const custMsgs = msgs.filter((m) => m.from === 'customer');
        if (custMsgs.length) customerMsg = custMsgs[custMsgs.length - 1].text || '';
      }
      if (!customerMsg && l.dropReason) customerMsg = l.dropReason;

      let avgReply = typeof l.firstResponseMin === 'number' ? l.firstResponseMin : null;
      if (avgReply === null && msgs.length >= 2) {
        const firstCust = msgs.find((m) => m.from === 'customer');
        const firstStaff = msgs.find((m) => m.from === 'staff');
        if (firstCust && firstStaff && firstCust.at && firstStaff.at) {
          const diff = Math.max(0, Math.round((Date.parse(firstStaff.at.replace(' ', 'T')) - Date.parse(firstCust.at.replace(' ', 'T'))) / 60000));
          if (!isNaN(diff) && diff < 10000) avgReply = diff;
        }
      }

      let slaStatus = 'ontime';
      let slaLabel = 'ทันเวลา';
      if (l.status === 'no_reply' || l.status === 'very_poor') {
        slaStatus = 'late';
        slaLabel = l.status === 'no_reply' ? 'ยังไม่ตอบ' : 'หลุด';
      } else if (avgReply !== null) {
        if (avgReply <= 15) {
          slaStatus = 'ontime';
          slaLabel = `ทันเวลา (${avgReply}น.)`;
        } else {
          slaStatus = 'late';
          slaLabel = `ช้า (${avgReply}น.)`;
        }
      } else {
        slaStatus = 'ontime';
        slaLabel = 'ทันเวลา';
      }

      const effectivePageId = l.pageId || adPageMap[l.adId] || '';
      const pName = l.pageName || pageNameMap[effectivePageId] || '';
      const effectivePlatform = l.platform || (l.channel === 'Instagram' || l.channel === 'IG' ? 'Instagram' : l.channel === 'LINE' ? 'LINE' : l.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook');

      return {
        id: l.id, name: l.name, channel: l.channel || '—', platform: effectivePlatform,
        pageId: effectivePageId, pageName: pName,
        date: l.date, status: l.status,
        ad: adName[l.adId] || l.adId || '', rep: repName[l.repId] || l.repId || l.rep || (msgs.length && [...msgs].reverse().find(m => m.from === 'staff' && (m.by || m.rep))?.by) || '', value: l.value || 0, reason: l.dropReason || null,
        phone: l.phone || null, email: l.email || null,
        customerMsg: customerMsg || null,
        avgReply,
        firstResponseMin: avgReply,
        slaStatus,
        slaLabel,
      };
    })
    .sort((x, y) => (x.date !== y.date ? (x.date < y.date ? 1 : -1) : x.id < y.id ? 1 : -1));
}

function buildBoard(data, range, extra = {}) {
  const rows = leadRows(data, range, extra);
  return {
    range, total: rows.length,
    columns: STATUSES.map((status) => {
      const c = rows.filter((r) => r.status === status);
      return { status, total: c.length, cards: c.slice(0, 500) };
    }),
  };
}

function buildInbox(data, range, extra = {}) {
  const rows = leadRows(data, range, extra);
  return { range, total: rows.length, rows: rows.slice(0, 2000) };
}

function leadRow(data, l) {
  const ad = (data.ads || []).find((a) => a.id === l.adId);
  const rep = (data.reps || []).find((r) => r.id === l.repId);
  const pageNameMap = Object.fromEntries(((data && data.pages) || []).map((p) => [p.id, p.name]));
  const adPageMap = Object.fromEntries(((data && data.ads) || []).map((a) => [a.id, a.pageId]));
  const effectivePageId = l.pageId || (ad && ad.pageId) || adPageMap[l.adId] || '';
  const effectivePageName = l.pageName || pageNameMap[effectivePageId] || '';
  const effectivePlatform = l.platform || (l.channel === 'Instagram' || l.channel === 'IG' ? 'Instagram' : l.channel === 'LINE' ? 'LINE' : l.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook');
  return {
    id: l.id, name: l.name, channel: l.channel || '—', platform: effectivePlatform,
    pageId: effectivePageId, pageName: effectivePageName,
    date: l.date, status: l.status,
    ad: ad ? ad.name : (l.adId || ''), rep: rep ? rep.name : (l.repId || ''), value: l.value || 0, reason: l.dropReason || null,
    phone: l.phone || null, email: l.email || null,
  };
}

module.exports = { PLATFORMS, normalizePlatform, buildDashboard, buildBoard, buildInbox, leadRow, listFilters, aggregate, matchPage, STATUSES };
