'use strict';
const demo = require('./demo');
const meta = require('./meta');
const store = require('./store');
const ops = require('./ops');

// เลือกแหล่งข้อมูลตามโหมดที่ตั้งไว้ใน Setting: 'live', 'meta' หรือ 'demo'
function currentMode() {
  const s = meta.getSettings();
  if (s.mode === 'meta' && s.meta && s.meta.accessToken) return 'meta';
  if (s.mode === 'live') return 'live';
  return 'demo'; // ค่าเริ่มต้นถ้าไม่มีการระบุให้เป็น demo
}

function buildLiveData() {
  const rawLeads = store.read('leads.json', []);
  const messages = store.read('messages.json', {});
  const customPages = store.read('pages.json', []);
  const pageMap = new Map();

  for (const cp of customPages) {
    if (cp && cp.id && cp.name) pageMap.set(cp.id, cp);
  }

  // ใส่เพจ LINE/WhatsApp เป็น fallback เฉพาะแพลตฟอร์มที่ยังไม่มีเพจจาก pages.json
  // Facebook: ไม่ hardcode — ให้ดึงจาก Webhook อัตโนมัติเท่านั้น
  if (![...pageMap.values()].some((p) => p.platform === 'LINE')) {
    pageMap.set('P-LINE', { id: 'P-LINE', name: 'LINE Official Account', platform: 'LINE' });
  }
  if (![...pageMap.values()].some((p) => p.platform === 'WhatsApp')) {
    pageMap.set('P-WhatsApp', { id: 'P-WhatsApp', name: 'WhatsApp Business', platform: 'WhatsApp' });
  }

  // หา Facebook เพจที่มีอยู่จริงใน pages.json (ไม่ hardcode)
  const fbCustomPages = customPages.filter((p) => (!p.platform || p.platform === 'Facebook'));
  const singleFbPage = fbCustomPages.length === 1 ? fbCustomPages[0] : null;

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

    let pageName = l.pageName || l.page || (l.pageId ? pageMap.get(l.pageId)?.name : null);
    if (!pageName && singleFbPage && platform === 'Facebook') {
      pageName = singleFbPage.name;
    }
    if (!pageName) pageName = `${platform} เพจหลัก`;

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
    const leadRep = l.repId || l.rep || (messages[l.id] && [...messages[l.id]].reverse().find(m => m.from === 'staff' && (m.by || m.rep))?.by) || '';
    if (leadRep && !repMap.has(leadRep)) {
      repMap.set(leadRep, { id: leadRep, name: leadRep });
    }
  }

  if (!campMap.size) campMap.set('C-General', { id: 'C-General', name: 'General Campaign' });

  const resolvedLeads = leads.map((l) => {
    const leadRep = l.repId || l.rep || (messages[l.id] && [...messages[l.id]].reverse().find(m => m.from === 'staff' && (m.by || m.rep))?.by) || '';
    return { ...l, repId: leadRep || l.repId || '', rep: leadRep || l.rep || '' };
  });
  return {
    pages: [...pageMap.values()],
    agencies: [{ id: 'In-house', name: 'In-house' }],
    reps: [...repMap.values()],
    campaigns: [...campMap.values()],
    ads: [...adMap.values()],
    daily: campData.daily || [],
    leads: resolvedLeads,
    spanDays: 30,
  };
}

async function load(range) {
  let data;
  const mode = currentMode();
  if (mode === 'meta') {
    try {
      data = await meta.load({ from: range.prevFrom, to: range.to });
    } catch (metaErr) {
      console.error('Meta API Load Error, falling back to local data:', metaErr.message);
      // ถ้า Meta API โหลดไม่สำเร็จ ให้ fallback ใช้ local data แต่แนบ metaError แจ้งเตือน
      data = buildLiveData();
      data.metaError = metaErr.message;
    }
    const rawLeads = store.read('leads.json', []);
    const customPages = store.read('pages.json', []);
    const pageMap = new Map();
    for (const p of (data.pages || [])) pageMap.set(p.id, p);
    for (const cp of customPages) {
      if (cp && cp.id && cp.name) pageMap.set(cp.id, cp);
    }
    const fbCustomPages = customPages.filter((p) => (!p.platform || p.platform === 'Facebook'));
    const singleFbPage = fbCustomPages.length === 1 ? fbCustomPages[0] : null;

    const messages = store.read('messages.json', {});
    const repMap = new Map();
    for (const u of (require('./auth').listUsers() || [])) {
      repMap.set(u.username, { id: u.username, name: u.username });
    }
    data = {
      ...data,
      pages: [...pageMap.values()],
      leads: rawLeads.map((l) => {
        const leadRep = l.repId || l.rep || (messages[l.id] && [...messages[l.id]].reverse().find(m => m.from === 'staff' && (m.by || m.rep))?.by) || '';
        if (leadRep && !repMap.has(leadRep)) repMap.set(leadRep, { id: leadRep, name: leadRep });
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
        let pageName = l.pageName || l.page || (l.pageId ? pageMap.get(l.pageId)?.name : null);
        if (!pageName && singleFbPage && platform === 'Facebook') {
          pageName = singleFbPage.name;
        }
        if (!pageName) pageName = `${platform} เพจหลัก`;
        const pageId = l.pageId || `PAGE-${pageName.replace(/\s+/g, '_')}`;
        if (!pageMap.has(pageId)) {
          pageMap.set(pageId, { id: pageId, name: pageName, platform });
        }
        return {
          ...l,
          adId: l.adId || 'Direct',
          channel,
          platform,
          pageId,
          pageName,
          repId: leadRep || l.repId || '',
          rep: leadRep || l.rep || '',
          status,
          quality: ops.QUALITY[status] || l.quality || 'average',
        };
      }),
      reps: [...repMap.values()],
    };
  } else if (mode === 'demo') {
    data = demo.load();
  } else {
    data = buildLiveData();
  }
  return ops.applyOverrides(data);
}

module.exports = { currentMode, load };

