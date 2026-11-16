'use strict';
const { addDays, eachDay } = require('./dates');

// ความคืบหน้าของแชท เรียงตามคอลัมน์ใน Board ตามลำดับที่ผู้ใช้กำหนด (12 คอลัมน์)
const STATUSES = [
  'no_reply',     // 1. ไม่ตอบ (กล่องสีแดง)
  'very_poor',    // 2. แย่มาก (กล่องสีแดง)
  'talked',       // 3. พอได้คุย (กล่องสีเขียว)
  'in_progress',  // 4. กำลังดำเนินการ (กล่องสีเขียว)
  'qualified',    // 5. มีคุณสมบัติ
  'appointment',  // 6. นัดแล้ว
  'conv_created', // 7. สร้างคอนเวอร์ชั่นแล้ว
  'new',          // 8. มาใหม่
  'inprogress',   // 9. In-progress
  'intake',       // 10. In-take
  'qualifile',    // 11. Qualifile
  'converted',    // 12. Converted
];

const div = (a, b) => (b ? a / b : null);
const round = (n, d = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

function aggregate(rows) {
  const t = { spend: 0, impressions: 0, reach: 0, clicks: 0, messages: 0, purchases: 0 };
  for (const r of rows) for (const k of Object.keys(t)) t[k] += r[k] || 0;
  return {
    ...t,
    cpm: div(t.spend, t.impressions) === null ? null : (t.spend / t.impressions) * 1000,
    ctr: div(t.clicks, t.impressions) === null ? null : (t.clicks / t.impressions) * 100,
    cpc: div(t.spend, t.clicks),
    costMessage: div(t.spend, t.messages),
    costPurchase: div(t.spend, t.purchases),
    conversionRate: div(t.purchases, t.messages) === null ? null : (t.purchases / t.messages) * 100,
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

function listFilters(data) {
  const platforms = [...new Set([
    'Facebook', 'LINE', 'WhatsApp', 'Instagram',
    ...(data.pages || []).map((p) => p.platform).filter(Boolean),
    ...(data.leads || []).map((l) => l.platform || l.channel).filter(Boolean),
  ])];
  return {
    platforms,
    pages: data.pages || [],
    campaigns: data.campaigns || [],
    agencies: data.agencies || [],
    reps: data.reps || [],
    statuses: STATUSES,
  };
}

function matchPage(targetPage, itemPageId, itemPageName, pages = [], fallbackPlatform = 'Facebook') {
  if (!targetPage) return true;
  const pageObj = pages.find((p) => p.id === targetPage || (targetPage && p.id && String(p.id).includes(targetPage)));
  const targetName = ((pageObj && pageObj.name) || targetPage).toLowerCase().trim();
  const targetId = String(targetPage).toLowerCase().trim();
  const pid = String(itemPageId || '').toLowerCase().trim();
  const pname = String(itemPageName || (pageObj && pageObj.id === itemPageId ? pageObj.name : '')).toLowerCase().trim();

  if (pid === targetId) return true;
  if (pname && targetName && (pname === targetName || pname.includes(targetName) || targetName.includes(pname))) return true;
  if (pid && targetId && (pid.includes(targetId) || targetId.includes(pid))) return true;

  // ตรวจสอบชื่อพิเศษหรือ ID เก่า/ใหม่ เช่น 'รักเพื่อน' หรือ 'rakphuean'
  const isTargetRakPhuean = targetId.includes('rakphuean') || targetName.includes('รักเพื่อน') || targetId.includes('1018075398296404');
  const isItemRakPhuean = pid.includes('rakphuean') || pname.includes('รักเพื่อน') || pid.includes('1018075398296404');
  if (isTargetRakPhuean && isItemRakPhuean) return true;
  // หากโฆษณาใช้แคมเปญร่วมกันหรือไม่มีระบุเพจเฉพาะ (unknown) ให้แสดงผลเมื่อเลือกเพจหลัก
  if (itemPageId === 'unknown' || !itemPageId) return true;

  // ถ้า targetId เป็น 'P-Facebook' หรือ 'เพจหลัก' และเป็น lead ของ Facebook ให้ถือว่า match
  if ((targetId.includes('p-facebook') || targetName.includes('เพจหลัก')) && (pid.includes('1018075398296404') || pname.includes('รักเพื่อน'))) return true;

  // Fallback: ถ้าเป็นแพลตฟอร์มเดียวกันและมีเพียงเพจเดียวในระบบ ให้ถือว่าตรงกัน
  const plat = String(fallbackPlatform || 'Facebook').toLowerCase();
  const samePlatPages = pages.filter((p) => (p.platform || 'Facebook').toLowerCase() === plat);
  if (samePlatPages.length <= 1) return true;

  return false;
}

function buildDashboard(data, range, q = {}) {
  const campName = Object.fromEntries(data.campaigns.map((c) => [c.id, c.name]));
  const pageName = Object.fromEntries(data.pages.map((p) => [p.id, p.name]));
  const repName = Object.fromEntries(data.reps.map((r) => [r.id, r.name]));

  const ads = data.ads.filter((a) => {
    if (q.platform && a.platform && a.platform.toLowerCase() !== q.platform.toLowerCase()) return false;
    if (q.page && !matchPage(q.page, a.pageId, a.pageName || pageName[a.pageId], data.pages, a.platform)) return false;
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

  const inLeadScope = (l) => {
    const lPlat = String(l.platform || (l.channel === 'LINE' ? 'LINE' : l.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook'));
    if (q.platform && lPlat.toLowerCase() !== q.platform.toLowerCase()) return false;
    if (q.page && !matchPage(q.page, l.pageId, l.pageName || pageName[l.pageId], data.pages, lPlat)) return false;
    if (q.rep && l.repId !== q.rep) return false;
    if (q.status && l.status !== q.status) return false;
    return adIds.has(l.adId) || !adIds.size;
  };
  const leadsCur = data.leads.filter((l) => inLeadScope(l) && (cur === daily || (l.date >= range.from && l.date <= range.to)));
  const leadsPrev = data.leads.filter((l) => inLeadScope(l) && l.date >= range.prevFrom && l.date <= range.prevTo);

  // ตารางแคมเปญ/โฆษณา
  const sparkFrom = addDays(range.to, -13);
  let rows = ads.map((a) => {
    const rowsCur = cur.filter((r) => r.adId === a.id);
    const m = aggregate(rowsCur);
    const ls = leadsCur.filter((l) => l.adId === a.id);
    const good = ls.filter((l) => l.quality === 'good').length;
    const score = ls.length ? Math.round((good / ls.length) * 100) : null;
    const byDay = Object.fromEntries(rowsCur.map((r) => [r.date, r.messages]));
    return {
      id: a.id, name: a.name, campaign: campName[a.campaignId] || '', adset: a.adset,
      page: pageName[a.pageId] || '', creative: a.creative, thumb: a.thumb || null,
      reach: m.reach, impressions: m.impressions, cpm: round(m.cpm), ctr: round(m.ctr), costMessage: round(m.costMessage),
      cqc: good ? round(m.spend / good) : null, purchases: m.purchases, spend: round(m.spend), cpc: round(m.cpc),
      leads: ls.length, qualityChats: good, qualityScore: score, qualityLabel: qualityLabel(score),
      spark: eachDay(sparkFrom, range.to).map((d) => byDay[d] || 0),
    };
  }); // แสดงโฆษณาทั้งหมดที่ดึงมา ไม่ซ่อนแถวทิ้ง

  // ถ้ายังไม่มีข้อมูลสถิติ แต่มีรายชื่อโฆษณาที่นำเข้าไว้ ให้แสดงรายการโฆษณาเพื่อให้ผู้ใช้ใส่รูปและดูข้อมูลได้
  if (!rows.length && ads.length > 0) {
    rows = ads.map((a) => ({
      id: a.id, name: a.name, campaign: campName[a.campaignId] || '', adset: a.adset,
      page: pageName[a.pageId] || '', creative: a.creative, thumb: a.thumb || null,
      reach: 0, impressions: 0, cpm: 0, ctr: 0, costMessage: 0,
      cqc: null, purchases: 0, spend: 0, cpc: 0,
      leads: 0, qualityChats: 0, qualityScore: null, qualityLabel: 'none',
      spark: [0, 0, 0, 0, 0, 0, 0],
    }));
  }

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

  // ทีมขาย
  const sales = data.reps.map((r) => {
    const ls = leadsCur.filter((l) => l.repId === r.id);
    const closed = ls.filter((l) => l.value > 0);
    const rt = ls.map((l) => l.firstResponseMin).filter((v) => typeof v === 'number');
    return {
      id: r.id, name: r.name, leads: ls.length,
      qualified: count(ls, (l) => ['qualified', 'conv_created', 'converted', 'qualifile'].includes(l.status)),
      closed: closed.length,
      revenue: closed.reduce((s, l) => s + l.value, 0),
      closeRate: ls.length ? round((closed.length / ls.length) * 100, 1) : null,
      avgFirstResponse: rt.length ? round(rt.reduce((s, v) => s + v, 0) / rt.length, 1) : null,
    };
  }).filter((r) => r.leads > 0);
  const revenue = sales.reduce((s, r) => s + r.revenue, 0);

  // ลีดที่หลุด
  const dropped = leadsCur.filter((l) => l.status === 'no_reply' || l.status === 'very_poor');
  const reasons = {};
  for (const l of dropped) reasons[l.dropReason || 'ไม่ระบุ'] = (reasons[l.dropReason || 'ไม่ระบุ'] || 0) + 1;
  const adName = Object.fromEntries(data.ads.map((a) => [a.id, a.name]));

  return {
    range,
    scope: { ads: rows.length, leads: leadsCur.length, records: cur.length },
    kpis: kpis(aggregate(cur), aggregate(prev)),
    ads: rows,
    trend,
    chat,
    sales: { reps: sales, revenue, closed: sales.reduce((s, r) => s + r.closed, 0) },
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
  const { messagesMap = {}, platform, page } = extra;
  return data.leads
    .filter((l) => {
      const lDate = String(l.date || '').slice(0, 10);
      if (lDate && range && range.from && range.to) {
        if (lDate < range.from || lDate > range.to) return false;
      }
      const lPlat = String(l.platform || (l.channel === 'LINE' ? 'LINE' : l.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook'));
      if (platform && lPlat.toLowerCase() !== platform.toLowerCase()) return false;
      if (page && !matchPage(page, l.pageId, l.pageName || pageNameMap[l.pageId], data.pages, lPlat)) return false;
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

      const pName = l.pageName || pageNameMap[l.pageId] || '';

      return {
        id: l.id, name: l.name, channel: l.channel || '—', platform: l.platform || l.channel || 'Facebook',
        pageId: l.pageId || '', pageName: pName,
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
  const ad = data.ads.find((a) => a.id === l.adId);
  const rep = data.reps.find((r) => r.id === l.repId);
  return {
    id: l.id, name: l.name, channel: l.channel || '—', date: l.date, status: l.status,
    ad: ad ? ad.name : (l.adId || ''), rep: rep ? rep.name : (l.repId || ''), value: l.value || 0, reason: l.dropReason || null,
    phone: l.phone || null, email: l.email || null,
  };
}

module.exports = { buildDashboard, buildBoard, buildInbox, leadRow, listFilters, aggregate, STATUSES };
