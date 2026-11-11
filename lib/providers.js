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
  const leads = rawLeads.map((l) => ({ ...l, adId: l.adId || 'Direct' }));
  const adMap = new Map();
  const repMap = new Map();

  for (const l of leads) {
    if (!adMap.has(l.adId)) {
      adMap.set(l.adId, {
        id: l.adId,
        name: l.adId,
        campaignId: 'C-General',
        adset: 'Adset',
        pageId: l.pageId || 'P1',
        agencyId: 'In-house',
        creative: 'IMAGE',
        thumb: null,
      });
    }
    if (l.repId && !repMap.has(l.repId)) {
      repMap.set(l.repId, { id: l.repId, name: l.repId });
    }
  }

  return {
    pages: [{ id: 'P1', name: 'Facebook Page' }],
    agencies: [{ id: 'In-house', name: 'In-house' }],
    reps: [...repMap.values()],
    campaigns: [{ id: 'C-General', name: 'Campaign' }],
    ads: [...adMap.values()],
    daily: [],
    leads,
    spanDays: 30,
  };
}

async function load(range) {
  let data;
  const mode = currentMode();
  if (mode === 'meta') {
    data = await meta.load({ from: range.prevFrom, to: range.to });
    data = { ...data, leads: store.read('leads.json', []) };
  } else if (mode === 'demo') {
    data = demo.load();
  } else {
    data = buildLiveData();
  }
  return ops.applyOverrides(data);
}

module.exports = { currentMode, load };

