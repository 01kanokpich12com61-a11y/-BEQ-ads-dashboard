'use strict';
// "น้อง AI" — ผู้ช่วยตอบคำถามจากข้อมูลจริงในเว็บ ด้วย Claude (Anthropic API) + เครื่องมืออ่านข้อมูล (read-only)
// ต้องตั้ง ANTHROPIC_API_KEY ใน Environment; ถ้าไม่ตั้ง หน้าเว็บจะใช้ผู้ช่วยแบบเดิม (ตอบตามคำสำคัญ)
const store = require('./store');
const providers = require('./providers');
const ops = require('./ops');
const sla = require('./sla');
const reps = require('./reps');
const { resolveRange, today } = require('./dates');
const { buildDashboard, buildInbox } = require('./metrics');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = () => process.env.ASSISTANT_MODEL || 'claude-sonnet-5-5';
const apiKey = () => String(process.env.ANTHROPIC_API_KEY || '').trim();
const enabled = () => Boolean(apiKey());

const STATUS_TH = {
  new: 'มาใหม่', intake: 'คัดกรอง', talked: 'พอได้คุย', in_progress: 'กำลังดำเนินการ', qualified: 'มีคุณสมบัติ',
  appointment: 'นัดแล้ว', converted: 'ปิดการขาย', no_reply: 'ไม่ตอบ (ลูกค้าเงียบ)', very_poor: 'แย่มาก / หลุด',
};

const r2 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : n);
const rangeOf = (input) => resolveRange({ range: input.range || '30d', from: input.from, to: input.to });
const lower = (s) => String(s || '').toLowerCase();
// เซลล์ที่เป็นชื่อเพจ/ค่าว่าง ถือว่า "ยังไม่มอบหมาย" (ไม่ให้ AI รายงานชื่อเพจเป็นชื่อคน)
const repOf = (r) => (reps.isPerson(r && r.rep) ? r.rep : null);

async function loadLeads(range) {
  const data = await providers.load(range, { ads: false });
  const isDemo = providers.currentMode() === 'demo';
  const overlay = store.read('messages.json', {});
  const messagesMap = {};
  for (const l of data.leads) messagesMap[l.id] = ops.messagesFor(l, data, isDemo, overlay);
  const out = buildInbox(data, range, { messagesMap });
  for (const row of out.rows) {
    const msgs = messagesMap[row.id] || [];
    row.last = msgs.length ? msgs[msgs.length - 1] : null;
    row.messageCount = msgs.length;
  }
  return { data, rows: out.rows, messagesMap };
}

function waitingMinutes(last) {
  if (!last || last.from !== 'customer') return null;
  const t = Date.parse(String(last.at).replace(' ', 'T') + (String(last.at).length <= 16 ? ':00+07:00' : '+07:00'));
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
}

/* ---------------- เครื่องมือ (อ่านอย่างเดียว) ---------------- */
const TOOLS = [
  {
    name: 'get_ads_summary',
    description: 'สรุปผลโฆษณา Facebook/Instagram ในช่วงเวลา: ค่าโฆษณา, การแสดงผล, คลิก, ทักแชท, ปิดการขาย, ต้นทุนต่อแชท, เทียบช่วงก่อนหน้า และโฆษณาที่ใช้เงินมากสุด',
    input_schema: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['7d', '30d', '90d', 'all', 'custom'], description: 'ช่วงเวลา (ค่าเริ่มต้น 30d)' },
        from: { type: 'string', description: 'YYYY-MM-DD เมื่อ range=custom' },
        to: { type: 'string', description: 'YYYY-MM-DD เมื่อ range=custom' },
        page: { type: 'string', description: 'Page ID หรือชื่อเพจ (ไม่ใส่ = ทุกเพจ)' },
        top: { type: 'integer', description: 'จำนวนโฆษณาที่ต้องการ (ค่าเริ่มต้น 10)' },
        sort_by: { type: 'string', enum: ['spend', 'messages', 'purchases', 'costMessage', 'roas', 'ctr'], description: 'เรียงโฆษณาตาม' },
      },
    },
  },
  {
    name: 'search_leads',
    description: 'ค้นหา/กรองลูกค้า (ลีด) และแชท คืนชื่อ สถานะ เซลล์ เพจ แพลตฟอร์ม วันที่ ข้อความล่าสุด และเวลาที่ลูกค้ารอ ใช้ตอบคำถามเช่น "ใครรอตอบอยู่", "ลูกค้าชื่อ...", "ลีดของเซลล์...", "นัดแล้วกี่คน"',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'คำค้นในชื่อลูกค้า เบอร์ หรือข้อความแชท' },
        status: { type: 'string', enum: Object.keys(STATUS_TH) },
        rep: { type: 'string', description: 'ชื่อเซลล์' },
        platform: { type: 'string', enum: ['Facebook', 'Instagram', 'LINE', 'WhatsApp'] },
        page: { type: 'string', description: 'ชื่อเพจหรือ Page ID' },
        needs_reply: { type: 'boolean', description: 'true = เฉพาะแชทที่ข้อความล่าสุดมาจากลูกค้า (รอเราตอบ)' },
        range: { type: 'string', enum: ['7d', '30d', '90d', 'all', 'custom'], description: 'ช่วงวันที่ของลีด (ค่าเริ่มต้น all)' },
        from: { type: 'string' }, to: { type: 'string' },
        limit: { type: 'integer', description: 'จำนวนสูงสุด (ค่าเริ่มต้น 20, ไม่เกิน 50)' },
      },
    },
  },
  {
    name: 'count_leads',
    description: 'นับจำนวนลีด/แชทแยกตาม status, rep (เซลล์), page, platform หรือ date ในช่วงเวลา',
    input_schema: {
      type: 'object',
      properties: {
        group_by: { type: 'string', enum: ['status', 'rep', 'page', 'platform', 'date'] },
        range: { type: 'string', enum: ['7d', '30d', '90d', 'all', 'custom'] },
        from: { type: 'string' }, to: { type: 'string' },
        needs_reply: { type: 'boolean' },
      },
      required: ['group_by'],
    },
  },
  {
    name: 'get_chat',
    description: 'อ่านข้อความในแชทของลูกค้า 1 คน (ล่าสุด 60 ข้อความ) ระบุ lead_id หรือชื่อลูกค้า',
    input_schema: { type: 'object', properties: { lead_id: { type: 'string' }, name: { type: 'string' } } },
  },
  {
    name: 'get_sla',
    description: 'ความเร็วการตอบแชทของเซลล์/เพจ (ตอบทันภายใน 15 นาทีกี่ครั้ง, ช้ากี่ครั้ง, แต้มที่ถูกหัก) ในช่วงเวลา',
    input_schema: { type: 'object', properties: { range: { type: 'string', enum: ['7d', '30d', '90d', 'all', 'custom'] }, from: { type: 'string' }, to: { type: 'string' } } },
  },
  {
    name: 'get_followups',
    description: 'รายชื่อลูกค้าที่ต้องติดตาม: รอเราตอบ (reply), ควรตามต่อเพราะเงียบเกิน 24 ชม. (chase), นัดตามที่ตั้งไว้/เกินกำหนด',
    input_schema: { type: 'object', properties: { rep: { type: 'string' }, limit: { type: 'integer' } } },
  },
  {
    name: 'get_comments',
    description: 'โพสต์และคอมเมนต์ใต้โพสต์ Facebook/Instagram โดยเฉพาะคอมเมนต์ที่ทีมยังไม่ตอบ',
    input_schema: { type: 'object', properties: { pending_only: { type: 'boolean' }, limit: { type: 'integer' } } },
  },
  {
    name: 'get_system_status',
    description: 'สถานะระบบ: เชื่อม Meta แล้วหรือยัง, เพจ/บัญชีในระบบ, ผู้ใช้, ฐานข้อมูล, จำนวนข้อมูล (ไม่เปิดเผยรหัส/โทเคน)',
    input_schema: { type: 'object', properties: {} },
  },
];

async function runTool(name, input = {}) {
  if (name === 'get_ads_summary') {
    const range = rangeOf(input);
    const data = await providers.load(range);
    const d = buildDashboard(data, range, input.page ? { page: input.page } : {});
    const k = {};
    for (const [key, v] of Object.entries(d.kpis || {})) k[key] = { value: r2(v.value), previous: r2(v.prev), changePct: r2(v.delta) };
    const sortKey = input.sort_by || 'spend';
    const asc = sortKey === 'costMessage';
    const ads = (d.ads || []).filter((a) => a.spend > 0 || a.messages > 0)
      .sort((a, b) => (asc ? (a[sortKey] ?? 1e12) - (b[sortKey] ?? 1e12) : (b[sortKey] || 0) - (a[sortKey] || 0)))
      .slice(0, Math.min(input.top || 10, 25))
      .map((a) => ({ name: a.name, campaign: a.campaign, page: a.page, status: a.status, spend: r2(a.spend), impressions: a.impressions, clicks: a.clicks, ctr: r2(a.ctr), messages: a.messages, costPerMessage: r2(a.costMessage), purchases: a.purchases, revenue: r2(a.revenue), roas: r2(a.roas) }));
    return { mode: providers.currentMode(), metaError: data.metaError || null, range: d.range, kpis: k, adsInScope: (d.ads || []).length, topAds: ads, currency: 'THB' };
  }

  if (name === 'search_leads' || name === 'count_leads') {
    const range = rangeOf({ range: input.range || 'all', from: input.from, to: input.to });
    const { rows } = await loadLeads(range);
    let list = rows;
    if (input.status) list = list.filter((r) => r.status === input.status);
    if (input.platform) list = list.filter((r) => lower(r.platform) === lower(input.platform));
    if (input.rep) list = list.filter((r) => lower(repOf(r)).includes(lower(input.rep)));
    if (input.page) list = list.filter((r) => String(r.pageId) === String(input.page) || lower(r.pageName).includes(lower(input.page)));
    if (input.needs_reply) list = list.filter((r) => r.last && r.last.from === 'customer');
    if (input.query) {
      const q = lower(input.query);
      list = list.filter((r) => [r.name, r.phone, r.id, r.last && r.last.text].some((x) => lower(x).includes(q)));
    }
    if (name === 'count_leads') {
      const g = input.group_by;
      const counts = {};
      for (const r of list) {
        const key = g === 'status' ? (STATUS_TH[r.status] || r.status) : g === 'rep' ? (repOf(r) || 'ยังไม่มอบหมาย') : g === 'page' ? (r.pageName || '-') : g === 'platform' ? (r.platform || '-') : r.date;
        counts[key] = (counts[key] || 0) + 1;
      }
      return { range: { from: range.from, to: range.to }, total: list.length, groupBy: g, counts: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 60)) };
    }
    if (input.needs_reply) list = list.sort((a, b) => (waitingMinutes(b.last) || 0) - (waitingMinutes(a.last) || 0));
    const limit = Math.min(input.limit || 20, 50);
    return {
      total: list.length, shown: Math.min(limit, list.length),
      leads: list.slice(0, limit).map((r) => ({
        lead_id: r.id, name: r.name, status: STATUS_TH[r.status] || r.status, rep: repOf(r), page: r.pageName, platform: r.platform,
        date: r.date, phone: r.phone || null, messages: r.messageCount,
        lastMessage: r.last ? { from: r.last.from === 'customer' ? 'ลูกค้า' : `ทีม${r.last.by ? ` (${r.last.by})` : ''}`, text: String(r.last.text || '').slice(0, 160), at: r.last.at } : null,
        waitingMinutes: waitingMinutes(r.last),
      })),
    };
  }

  if (name === 'get_chat') {
    const { rows, messagesMap } = await loadLeads(resolveRange({ range: 'all' }));
    let lead = input.lead_id ? rows.find((r) => r.id === input.lead_id) : null;
    if (!lead && input.name) {
      const q = lower(input.name);
      const hits = rows.filter((r) => lower(r.name).includes(q));
      if (hits.length > 1 && !hits.some((h) => lower(h.name) === q)) return { ambiguous: true, candidates: hits.slice(0, 10).map((h) => ({ lead_id: h.id, name: h.name, page: h.pageName, date: h.date })) };
      lead = hits.find((h) => lower(h.name) === q) || hits[0];
    }
    if (!lead) return { error: 'ไม่พบลูกค้านี้' };
    const msgs = (messagesMap[lead.id] || []).slice(-60).map((m) => ({ from: m.from === 'customer' ? 'ลูกค้า' : `ทีม${m.by ? ` (${m.by}${m.byAssumed ? '*' : ''})` : ''}`, text: String(m.text || '').slice(0, 500), at: m.at }));
    return { lead_id: lead.id, name: lead.name, status: STATUS_TH[lead.status] || lead.status, rep: repOf(lead), page: lead.pageName, platform: lead.platform, phone: lead.phone || null, messages: msgs, note: '* = ชื่อเซลล์อนุมานจากการมอบหมายแชท' };
  }

  if (name === 'get_sla') {
    const range = rangeOf(input);
    const data = await providers.load(range, { ads: false });
    const s = sla.buildSla(data, providers.currentMode() === 'demo', range, Date.now(), {});
    return { range: { from: range.from, to: range.to }, targetMinutes: s.limitMin, totals: s.totals, byRep: (s.reps || []).slice(0, 30).map((r) => ({ rep: r.rep, page: r.pageName, replies: r.turns, onTime: r.onTime, late: r.late, pointsDeducted: r.deducted, avgMinutes: r.avgMin ?? r.avg ?? null })) };
  }

  if (name === 'get_followups') {
    const data = await providers.load(resolveRange({ range: '90d' }), { ads: false });
    const f = ops.buildFollowups(data, providers.currentMode() === 'demo', input.rep ? { rep: input.rep } : {});
    const kindTh = { reply: 'รอเราตอบ', chase: 'ควรตามต่อ (เงียบ > 24 ชม.)', scheduled: 'มีนัดตาม' };
    return { stats: { รอเราตอบ: f.stats.reply, ควรตามต่อ: f.stats.chase, นัดเกินกำหนด: f.stats.due, มีนัดตาม: f.stats.scheduled }, total: f.total,
      rows: (f.rows || []).slice(0, Math.min(input.limit || 20, 50)).map((r) => ({ lead_id: r.id, name: r.name, kind: kindTh[r.kind] || r.kind, rep: repOf(r), page: r.pageName, status: STATUS_TH[r.status] || r.status, overdue: Boolean(r.overdue), dueDate: r.dueDate || null, note: r.note || null, lastText: r.last ? String(r.last.text || '').slice(0, 120) : null })) };
  }

  if (name === 'get_comments') {
    const posts = store.read('posts_comments.json', []);
    let list = posts.map((p) => {
      const comments = p.comments || [];
      const pending = comments.filter((c) => !c.replied && !c.isStaff);
      return { post_id: p.id, platform: p.platform, page: p.pageName, date: p.timestamp, text: String(p.content || '').slice(0, 140), permalink: p.permalink, comments: comments.length, pending: pending.length, pendingSamples: pending.slice(0, 5).map((c) => ({ from: c.from, text: String(c.text || '').slice(0, 160), at: c.timestamp })) };
    });
    if (input.pending_only) list = list.filter((p) => p.pending > 0);
    list.sort((a, b) => b.pending - a.pending || String(b.date).localeCompare(String(a.date)));
    return { totalPosts: posts.length, totalPendingComments: list.reduce((s, p) => s + p.pending, 0), posts: list.slice(0, Math.min(input.limit || 15, 40)) };
  }

  if (name === 'get_system_status') {
    const meta = require('./meta');
    const s = meta.getSettings();
    const pages = store.read('pages.json', []);
    const leads = store.read('leads.json', []);
    return {
      today: today(), mode: providers.currentMode(), metaConnected: Boolean(s.meta && s.meta.accessToken), adAccount: s.meta && s.meta.adAccountId ? `act_${String(s.meta.adAccountId).replace(/^act_/, '')}` : null,
      database: store.backend, pages: pages.map((p) => ({ name: p.name, platform: p.platform || 'Facebook' })),
      users: require('./auth').listUsers().map((u) => ({ username: u.username, role: u.role })),
      salesReps: reps.collectRepNames(leads, store.read('messages.json', {}), pages, []),
      counts: { leads: leads.length, posts: store.read('posts_comments.json', []).length },
    };
  }
  return { error: `ไม่รู้จักเครื่องมือ ${name}` };
}

function systemPrompt(user) {
  const s = require('./meta').getSettings();
  return `คุณคือ "น้อง AI" ผู้ช่วยประจำแดชบอร์ดของ ${s.clinicName || 'คลินิก'} (คลินิกปลูกผม/ดูแลเส้นผม) ตอบเป็นภาษาไทย สุภาพ เป็นกันเอง ลงท้าย "ครับ"
วันนี้คือ ${today()} (เวลาประเทศไทย) ผู้ใช้ที่ถามคือ ${user.username} (${user.role === 'admin' || !user.role ? 'ผู้ดูแลระบบ' : 'เซลล์'})

กฎสำคัญ:
- ตัวเลขและข้อมูลทุกอย่างต้องมาจากเครื่องมือเท่านั้น ห้ามเดาหรือแต่งตัวเลข ถ้าเครื่องมือไม่มีข้อมูล ให้บอกตรง ๆ
- เลือกเครื่องมือให้ตรงคำถาม เรียกหลายตัวได้ ถ้าคำถามไม่ระบุช่วงเวลา ให้ใช้ 30 วันล่าสุดสำหรับโฆษณา และทั้งหมดสำหรับลีด แล้วบอกช่วงเวลาที่ใช้
- ตอบกระชับ อ่านง่ายบนมือถือ ใช้หัวข้อย่อย/ตัวหนา (**ข้อความ**) ได้ เงินใช้ ฿ และคั่นหลักพัน
- "รอตอบ" หมายถึงข้อความล่าสุดมาจากลูกค้า; สถานะ "ไม่ตอบ" หมายถึงลูกค้าเงียบไป ไม่ใช่ทีมยังไม่ตอบ
- ชื่อเซลล์ที่มี * อนุมานจากการมอบหมายแชท ไม่ใช่ชื่อคนกดส่งที่แน่นอน
- ถ้าโหมดข้อมูลเป็น demo ให้บอกว่าเป็นข้อมูลตัวอย่าง ถ้ามี metaError ให้บอกว่าตัวเลขโฆษณาอาจไม่อัปเดต
- คุณอ่านข้อมูลได้อย่างเดียว แก้ไข/ส่งข้อความแทนผู้ใช้ไม่ได้ ถ้าขอให้ทำ ให้บอกว่าต้องทำเองที่หน้าไหนของเว็บ
- คำแนะนำทางการแพทย์ ให้แนะนำให้ปรึกษาแพทย์ของคลินิก ไม่วินิจฉัยเอง`;
}

async function callClaude(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (j && j.error && j.error.message) || `HTTP ${res.status}`;
    const err = new Error(res.status === 401 ? 'ANTHROPIC_API_KEY ไม่ถูกต้อง' : res.status === 429 ? 'ใช้งาน AI ถี่เกินไป ลองใหม่อีกครั้งในอีกสักครู่' : `AI ตอบกลับไม่ได้: ${msg}`);
    err.status = 502;
    throw err;
  }
  return j;
}

// history: [{ role: 'user'|'assistant', text }] (ล่าสุดอยู่ท้าย)
async function ask(history, user) {
  if (!enabled()) { const e = new Error('ยังไม่ได้ตั้ง ANTHROPIC_API_KEY'); e.status = 503; throw e; }
  const messages = (history || []).slice(-12)
    .filter((m) => m && m.text && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: String(m.text).slice(0, 4000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) throw Object.assign(new Error('ไม่มีคำถาม'), { status: 400 });

  const usedTools = [];
  for (let step = 0; step < 8; step++) {
    const resp = await callClaude({ model: MODEL(), max_tokens: 1500, system: systemPrompt(user), tools: TOOLS, messages });
    const blocks = resp.content || [];
    const calls = blocks.filter((b) => b.type === 'tool_use');
    if (resp.stop_reason !== 'tool_use' || !calls.length) {
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { text: text || 'ขอโทษครับ น้องยังตอบคำถามนี้ไม่ได้', tools: usedTools };
    }
    messages.push({ role: 'assistant', content: blocks });
    const results = [];
    for (const c of calls) {
      usedTools.push(c.name);
      let out;
      try { out = await runTool(c.name, c.input || {}); } catch (e) { out = { error: e.message }; }
      let txt = JSON.stringify(out);
      if (txt.length > 60000) txt = txt.slice(0, 60000) + '…(ตัดให้สั้นลง)';
      results.push({ type: 'tool_result', tool_use_id: c.id, content: txt });
    }
    messages.push({ role: 'user', content: results });
  }
  return { text: 'คำถามนี้ซับซ้อนเกินไปสำหรับน้อง ลองถามให้แคบลงหน่อยนะครับ', tools: usedTools };
}

module.exports = { ask, enabled, runTool, TOOLS, model: MODEL };
