'use strict';
// SLA การตอบแชทของเซลส์: ต้องตอบลูกค้าภายใน 15 นาที
//
// กติกา (เวลาไทย) — ช่วงเวลาดูจาก "เวลาที่ลูกค้าส่งข้อความที่เริ่มรอคำตอบ"
//   10:00–19:00  ตอบเกิน 15 นาที = หัก 1 แต้ม (สูงสุด 1 แต้มต่อ 1 แชทต่อ 1 เพจ ไม่ว่าจะช้ากี่ครั้ง)
//   10:00–19:00  เปิดอ่านแต่ยังไม่ตอบ (replyAt = null) เกิน 15 นาที = หัก 0.5 แต้ม
//   08:00–10:00 และ 19:00–22:00  ตอบเกิน 15 นาที = ไม่หักแต้ม แต่นับเป็นสถิติตอบช้า
//   22:00–08:00  ไม่หักแต้ม ถ้าเซลส์ "ตอบ" ในช่วงนี้ (ดูจากเวลาที่ตอบ) นับเป็นสถิติตอบนอกเวลา
// ข้อความลูกค้าที่ยังไม่มีใครตอบ และเกิน 15 นาทีแล้ว ถือว่าตอบช้า (replyAt = null)
const store = require('./store');
const ops = require('./ops');
const { stampMs } = require('./dates');

const LIMIT_MIN = 15;
const MAX_EVENTS_PER_REP = 300;

// 'work' | 'commute' | 'night' จาก 'YYYY-MM-DD HH:MM'
function windowOf(at) {
  const [h, m] = String(at).slice(11, 16).split(':').map(Number);
  const t = h * 60 + m;
  if (t >= 600 && t < 1140) return 'work'; // 10:00–19:00
  if ((t >= 480 && t < 600) || (t >= 1140 && t < 1320)) return 'commute'; // 08:00–10:00, 19:00–22:00
  return 'night'; // 22:00–08:00
}

// แปลงข้อความในแชทเป็น "รอบรอคำตอบ": ข้อความลูกค้าแรกหลังพนักงานตอบล่าสุด → ข้อความพนักงานถัดไป
function turnsOf(msgs) {
  const turns = []; let waiting = null;
  for (const m of msgs) {
    if (m.from === 'customer') { if (!waiting) waiting = m.at; }
    else if (m.from === 'staff' && waiting) { turns.push({ customerAt: waiting, replyAt: m.at }); waiting = null; }
  }
  if (waiting) turns.push({ customerAt: waiting, replyAt: null });
  return turns;
}

const r1 = (n) => Math.round(n * 10) / 10;

function buildSla(data, isDemo, range, nowMs = Date.now(), filter = {}) {
  const overlay = store.read('messages.json', {});
  const repName = Object.fromEntries(data.reps.map((r) => [r.id, r.name]));
  const adById = new Map(data.ads.map((a) => [a.id, a]));
  const pageNameMap = Object.fromEntries(data.pages.map((p) => [p.id, p.name]));
  const knownPageNames = new Set(data.pages.map((p) => p.name));
  knownPageNames.add('Pavicon Hair Clinic คลินิกปลูกผมมาตรฐานสากล');
  knownPageNames.add('Dr. Nay Hair Transplant by BEQ ปลูกผมถาวร');
  knownPageNames.add('Beq Hair Wellness Center');

  const assignRegex = /(?:assigned this conversation to|มอบหมายการสนทนานี้ให้)\s+([^.\n\r]+)/i;
  const reps = new Map();
  const deducted = new Set();

  const repOf = (id, displayName, pageNameStr, pageIdStr) => {
    if (!reps.has(id)) {
      reps.set(id, {
        repId: id,
        rep: displayName,
        pageName: pageNameStr,
        pageId: pageIdStr,
        turns: 0,
        onTime: 0,
        late: 0,
        deducted: 0,
        commuteLate: 0,
        nightReplies: 0,
        sumMin: 0,
        nMin: 0,
        events: []
      });
    }
    return reps.get(id);
  };

  for (const l of data.leads) {
    const ad = adById.get(l.adId);
    const pageId = l.pageId || (ad && ad.pageId) || 'unknown';
    const resolvedPageName = pageNameMap[pageId] || l.pageName || '';
    const platform = String(l.platform || (l.channel === 'LINE' ? 'LINE' : l.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook'));

    if (filter.platform && platform.toLowerCase() !== filter.platform.toLowerCase()) {
      continue;
    }
    if (filter.page) {
      const target = String(filter.page).toLowerCase().trim();
      const p1 = String(pageId || '').toLowerCase().trim();
      const p2 = String(resolvedPageName || '').toLowerCase().trim();
      const matched = p1 === target || (p2 && target && (p2 === target || p2.includes(target) || target.includes(p2)));
      if (!matched) continue;
    }

    const msgs = ops.messagesFor(l, data, isDemo, overlay);
    if (!msgs.length) continue;

    let rep = l.repId || l.rep;
    let isPageName = knownPageNames.has(rep) || rep === 'Unassigned' || !rep;
    if (isPageName) {
      let foundRep = null;
      for (const m of msgs) {
        const match = (m.text || '').match(assignRegex);
        if (match) foundRep = match[1].trim();
      }
      if (foundRep) {
        rep = foundRep;
      } else {
        rep = 'ทีมแอดมินเพจ (' + (resolvedPageName || 'ไม่ระบุเพจ') + ')';
      }
    }

    const repKey = rep + ' @ ' + (resolvedPageName || pageId);
    const key = l.id + '|' + pageId;

    for (const t of turnsOf(msgs)) {
      const day = t.customerAt.slice(0, 10);
      if (day < range.from || day > range.to) continue;
      const minutes = t.replyAt ? (stampMs(t.replyAt) - stampMs(t.customerAt)) / 60000 : (nowMs - stampMs(t.customerAt)) / 60000;
      if (!t.replyAt && minutes <= LIMIT_MIN) continue;
      const window = windowOf(t.customerAt);
      const replyWindow = t.replyAt ? windowOf(t.replyAt) : null;
      const late = minutes > LIMIT_MIN;
      let outcome = 'ontime';
      if (late) {
        if (window === 'work') {
          if (!t.replyAt) {
            outcome = 'read_no_reply';
          } else if (deducted.has(key)) {
            outcome = 'dup';
          } else {
            deducted.add(key);
            outcome = 'deduct';
          }
        } else {
          outcome = window === 'commute' ? 'commute' : 'late_night';
        }
      }
      const rp = repOf(repKey, rep, resolvedPageName, pageId);
      rp.turns += 1;
      if (late) rp.late += 1; else rp.onTime += 1;
      if (outcome === 'deduct') rp.deducted += 1;
      if (outcome === 'read_no_reply') rp.deducted += 0.5;
      if (outcome === 'commute') rp.commuteLate += 1;
      if (replyWindow === 'night') rp.nightReplies += 1;
      if (t.replyAt && window !== 'night') { rp.sumMin += minutes; rp.nMin += 1; }
      if (outcome !== 'ontime' || replyWindow === 'night') {
        rp.events.push({
          leadId: l.id, name: l.name, channel: l.channel || '—', leadDate: l.date, page: resolvedPageName || '', pageId,
          customerAt: t.customerAt, replyAt: t.replyAt, minutes: r1(minutes), unanswered: !t.replyAt,
          window, replyWindow, outcome,
          points: outcome === 'deduct' ? -1 : outcome === 'read_no_reply' ? -0.5 : 0,
        });
      }
    }
  }

  const list = [...reps.values()].map((r) => {
    const events = r.events.sort((a, b) => (a.customerAt < b.customerAt ? 1 : a.customerAt > b.customerAt ? -1 : 0));
    return {
      repId: r.repId, rep: r.rep, pageName: r.pageName, pageId: r.pageId, turns: r.turns, onTime: r.onTime, late: r.late, deducted: r1(r.deducted), points: r1(-r.deducted),
      commuteLate: r.commuteLate, nightReplies: r.nightReplies, avgMin: r.nMin ? r1(r.sumMin / r.nMin) : null,
      eventTotal: events.length, events: events.slice(0, MAX_EVENTS_PER_REP),
    };
  }).sort((a, b) => b.deducted - a.deducted || b.late - a.late || a.rep.localeCompare(b.rep));

  const sum = (k) => list.reduce((s, r) => s + r[k], 0);
  return {
    range, limitMin: LIMIT_MIN,
    totals: { turns: sum('turns'), onTime: sum('onTime'), late: sum('late'), deducted: r1(sum('deducted')), points: r1(-sum('deducted')), commuteLate: sum('commuteLate'), nightReplies: sum('nightReplies') },
    reps: list,
  };
}

// คำนวณ SLA เฉพาะของโพสต์และคอมเมนต์ (แยกชัดเจนกับแชท)
function buildCommentSla(postsList, range, nowMs = Date.now()) {
  const reps = new Map();
  const LIMIT = 60; // ไม่ตอบคอมเมนต์ภายใน 60 นาที = หัก 0.5 แต้ม

  const repOf = (id, name) => {
    if (!reps.has(id)) {
      reps.set(id, { repId: id, rep: name || 'ทีมแอดมินเพจ', turns: 0, onTime: 0, late: 0, deducted: 0, points: 0, commuteLate: 0, nightReplies: 0, sumMin: 0, nMin: 0, events: [] });
    }
    return reps.get(id);
  };

  for (const post of (postsList || [])) {
    const pageName = post.pageName || post.pageId || 'เพจ';
    for (const c of (post.comments || [])) {
      if (c.isStaff) continue; // ข้ามคอมเมนต์ของแอดมินเอง
      const cTime = c.timestamp;
      if (!cTime) continue;
      const cDate = new Date(cTime).toISOString().slice(0, 10);
      if (range && range.from && range.to) {
        if (cDate < range.from || cDate > range.to) continue;
      }

      // ตรวจสอบการตอบกลับ (replies)
      let replyTime = null;
      let staffRepName = 'ทีมแอดมินเพจ';
      if (c.replies && c.replies.length > 0) {
        const firstReply = c.replies[0];
        replyTime = firstReply.timestamp;
        if (firstReply.from) staffRepName = firstReply.from;
      }

      const cMs = new Date(cTime).getTime();
      const rMs = replyTime ? new Date(replyTime).getTime() : nowMs;
      const minutes = Math.max(0, Math.round((rMs - cMs) / 60000));

      const cWindow = windowOf(cTime.slice(0, 16).replace('T', ' '));
      const replyWindow = replyTime ? windowOf(replyTime.slice(0, 16).replace('T', ' ')) : null;

      const late = minutes > LIMIT;
      let outcome = 'ontime';
      if (late) {
        if (cWindow === 'work') outcome = 'deduct';
        else outcome = cWindow === 'commute' ? 'commute' : 'late_night';
      }

      const rp = repOf(post.pageId || 'page_admin', staffRepName);
      rp.turns += 1;
      if (late) rp.late += 1; else rp.onTime += 1;
      if (outcome === 'deduct') { rp.deducted += 0.5; rp.points -= 0.5; }
      if (outcome === 'commute') rp.commuteLate += 1;
      if (replyWindow === 'night') rp.nightReplies += 1;
      if (replyTime && cWindow !== 'night') { rp.sumMin += minutes; rp.nMin += 1; }

      if (outcome !== 'ontime' || replyWindow === 'night' || !replyTime) {
        rp.events.push({
          postId: post.id,
          commentId: c.id,
          postTitle: post.content ? post.content.slice(0, 40) + '…' : 'โพสต์',
          customerName: c.from,
          customerText: c.text,
          pageName,
          platform: post.platform || 'Facebook',
          customerAt: cTime.slice(0, 16).replace('T', ' '),
          replyAt: replyTime ? replyTime.slice(0, 16).replace('T', ' ') : null,
          minutes,
          unanswered: !replyTime,
          window: cWindow,
          replyWindow,
          outcome,
          points: outcome === 'deduct' ? -0.5 : 0
        });
      }
    }
  }

  const list = [...reps.values()].map((r) => {
    const events = r.events.sort((a, b) => (a.customerAt < b.customerAt ? 1 : a.customerAt > b.customerAt ? -1 : 0));
    return {
      repId: r.repId, rep: r.rep, turns: r.turns, onTime: r.onTime, late: r.late, deducted: r.deducted, points: r.points,
      commuteLate: r.commuteLate, nightReplies: r.nightReplies, avgMin: r.nMin ? Math.round((r.sumMin / r.nMin) * 10) / 10 : null,
      eventTotal: events.length, events: events.slice(0, 300),
    };
  }).sort((a, b) => b.deducted - a.deducted || b.late - a.late);

  const sum = (k) => list.reduce((s, r) => s + r[k], 0);
  return {
    range,
    limitMin: LIMIT,
    totals: {
      turns: sum('turns'), onTime: sum('onTime'), late: sum('late'),
      deducted: r1(sum('deducted')), points: r1(sum('points')),
      commuteLate: sum('commuteLate'), nightReplies: sum('nightReplies')
    },
    admins: list
  };
}

module.exports = { buildSla, buildCommentSla, windowOf, turnsOf, LIMIT_MIN };