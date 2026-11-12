'use strict';
const demo = require('./demo');
const meta = require('./meta');
const store = require('./store');
const ops = require('./ops');

// เลือกแหล่งข้อมูลตามโหมดที่ตั้งไว้ใน Setting: 'live', 'meta' หรือ 'demo'
function currentMode() {
  const s = meta.getSettings();
  if (s.mode === 'meta' && s.meta && s.meta.accessToken) return 'meta';
  if (s.mode === 'demo') return 'demo';
  return 'live'; // ค่าเริ่มต้นเป็น live (ข้อมูลจริง สะอาด พร้อมรับข้อมูล)
}

function buildLiveData() {
  const rawLeads = store.read('leads.json', []);
  const customPages = store.read('pages.json', []);
  const pageMap = new Map();

  // ใส่เพจเริ่มต้นตามแพลตฟอร์มหลัก
  pageMap.set('P-Facebook', { id: 'P-Facebook', name: 'Facebook เพจหลัก', platform: 'Facebook' });
  pageMap.set('P-LINE', { id: 'P-LINE', name: 'LINE Official Account', platform: 'LINE' });
  pageMap.set('P-WhatsApp', { id: 'P-WhatsApp', name: 'WhatsApp Business', platform: 'WhatsApp' });

  for (const cp of customPages) {
    if (cp && cp.id && cp.name) pageMap.set(cp.id, cp);
  }

  const leads = rawLeads.map((l) => {
    const status = ops.normalizeStatus(l.status, l.dropReason || l.reason || '');
    const channel = l.channel || 'Messenger';
    let platform = l.platform;
    if (!platform) {
      const chLow = channel.toLowerCase();
      if (chLow.includes('line')) platform = 'LINE';
      else if (chLow.includes('what') || chLow.includes('wa')) platform = 'WhatsApp';
      else if (chLow.includes('ig') || chLow.includes('insta')) platform = 'Instagram';
      else platform = 'Facebook';
    }

    const pageName = l.pageName || l.page || (l.pageId ? pageMap.get(l.pageId)?.name : null) || `${platform} เพจหลัก`;
    const pageId = l.pageId || `PAGE-${pageName.replace(/\s+/g, '_')}`;

    if (!pageMap.has(pageId)) {
      pageMap.set(pageId, { id: pageId, name: pageName, platform });
    }

    return {
      ...l,
      adId: l.adId || 'Direct',
      status,
      quality: ops.QUALITY[status] || l.quality || 'average',
      channel,
      platform,
      pageId,
      pageName,
    };
  });

  const campData = store.read('campaigns_data.json', { ads: [], daily: [], campaigns: [] });
  const adMap = new Map();
  const repMap = new Map();
  const campMap = new Map();

  for (const c of campData.campaigns || []) campMap.set(c.id, c);
  for (const a of campData.ads || []) {
    const aPageId = a.pageId || 'P-Facebook';
    const aPageName = a.pageName || (pageMap.get(aPageId)?.name) || 'Facebook เพจหลัก';
    const aPlatform = a.platform || (pageMap.get(aPageId)?.platform) || 'Facebook';
    if (!pageMap.has(aPageId)) {
      pageMap.set(aPageId, { id: aPageId, name: aPageName, platform: aPlatform });
    }
    adMap.set(a.id, { ...a, pageId: aPageId, pageName: aPageName, platform: aPlatform });
  }

  for (const l of leads) {
    if (!adMap.has(l.adId)) {
      adMap.set(l.adId, {
        id: l.adId,
        name: l.adId,
        campaignId: 'C-General',
        adset: 'Adset',
        pageId: l.pageId || 'P-Facebook',
        agencyId: 'In-house',
        creative: 'IMAGE',
        thumb: null,
      });
    }
    if (l.repId && !repMap.has(l.repId)) {
      repMap.set(l.repId, { id: l.repId, name: l.repId });
    }
  }

  if (!campMap.size) campMap.set('C-General', { id: 'C-General', name: 'General Campaign' });

  return {
    pages: [...pageMap.values()],
    agencies: [{ id: 'In-house', name: 'In-house' }],
    reps: [...repMap.values()],
    campaigns: [...campMap.values()],
    ads: [...adMap.values()],
    daily: campData.daily || [],
    leads,
    spanDays: 30,
  };
}

async function load(range) {
  let data;
  const mode = currentMode();
  if (mode === 'meta') {
    data = await meta.load({ from: range.prevFrom, to: range.to });
    const rawLeads = store.read('leads.json', []);
    data = {
      ...data,
      leads: rawLeads.map((l) => {
        const status = ops.normalizeStatus(l.status, l.dropReason || l.reason || '');
        return { ...l, status, quality: ops.QUALITY[status] || l.quality || 'average' };
      }),
    };
  } else if (mode === 'demo') {
    data = demo.load();
  } else {
    data = buildLiveData();
  }
  return ops.applyOverrides(data);
}

module.exports = { currentMode, load };

