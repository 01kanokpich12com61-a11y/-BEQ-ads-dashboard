(() => {
  'use strict';

  const $app = document.getElementById('app');

  /* ---------------- state ---------------- */
  const S = {
    me: null, booted: false, filters: null, route: 'dashboard', menu: null,
    aiMode: 'copilot', branch: 'BEQ Hair Clinic · สาขาสีลม (Silom)',
    sidebarCollapsed: typeof localStorage !== 'undefined' && localStorage.getItem('beq_sidebar_collapsed') === '1',
    dash: { range: '30d', from: '', to: '', platform: '', page: '', campaign: '', agency: '', rep: '', status: '', tab: 'ads',
      data: null, loading: false, err: null, sort: 'spend', dir: 'desc', search: '', pageNo: 1 },
    settings: null, flash: null, loginErr: '',
    board: { range: 'all', from: '', to: '', data: null, err: null },
    inbox: { range: 'all', from: '', to: '', data: null, err: null, search: '', channel: '', page: '', status: '', folder: 'all', pageNo: 1 },
    review: { range: '30d', from: '', to: '', data: null, err: null, state: '', rep: '' },
    followup: { data: null, err: null, tab: '', rep: '' },
    notifications: { data: null, unread: 0, list: [] },
    notificationSchedule: null,
    scheduleModalOpen: false,
    quickEditLead: null,
    importModal: null, // { mode: 'one'|'all', pageId, pageName, afterDate, beforeDate, limit }
    postsModal: null, // { pageId, pageName } หน้าต่างเลือกช่วง/จำนวนตอนดึงโพสต์
    audit: { data: null, err: null, action: '', q: '', from: '', to: '', limit: 100 },
    chat: { id: null, loading: false, data: null, err: null, sending: false, msg: null },
    users: { data: null, err: null, result: null },
    sla: { data: null, err: null, open: '', kind: '', page: '' }, // page: '' = ทุกเพจ (แยกกลุ่มตามเพจ)
    upload: { data: null, err: null, loading: false, rows: [], result: null, tab: 'leads', detectedType: 'leads', summary: null, platform: 'Facebook', pageName: '' },
    quality: { data: null, err: null, loading: false, campaign: '', minQuality: '', sort: 'leads', sortDir: 'desc' },
    comments: { data: null, loading: false, err: null, range: '30d', from: '', to: '', filterStatus: 'all' },
    cmdPaletteOpen: false,
    cmdSearch: '',
    toasts: [],
    ghostOpen: false,
    ghostMsgs: [
      { from: 'ai', text: 'สวัสดีครับพี่ๆ! ผมคือ “น้อง AI” 👦🏻✨ เด็กน้อยผู้ช่วยประจำคลินิกครับ! พี่ๆ ไม่ต้องเสียเวลาเปิดหาข้อมูลในเว็บเองเลยนะครับ อยากรู้เรื่องอะไร ไม่ว่าจะเป็นยอดแอด แชทคนไข้ เซลล์คนไหนตอบเร็ว/ช้าสุด หรือสรุปตัวเลขต่างๆ ถามน้องได้หมดเลยนะครับ ผมพร้อมตอบให้ทุกเรื่องเลยครับผม! 😊' }
    ],
  };

  function ghostSvg(size = 38) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="boyHairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <radialGradient id="boySkinGrad" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#fff1eb"/>
          <stop offset="85%" stop-color="#fed7aa"/>
          <stop offset="100%" stop-color="#fdba74"/>
        </radialGradient>
        <linearGradient id="boyShirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34d399"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
        <filter id="boyGlow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#059669" flood-opacity="0.25"/>
        </filter>
      </defs>
      <!-- Green medical collar / polo shirt -->
      <path d="M26 82 C26 72 36 68 50 68 C64 68 74 72 74 82 L76 96 C76 98 74 100 72 100 L28 100 C26 100 24 98 24 96 Z" fill="url(#boyShirtGrad)" filter="url(#boyGlow)"/>
      <path d="M46 68 L50 78 L54 68 Z" fill="#ffffff" opacity="0.9"/>
      <circle cx="50" cy="83" r="1.8" fill="#ffffff"/>
      <circle cx="50" cy="91" r="1.8" fill="#ffffff"/>

      <!-- Neck -->
      <rect x="44" y="60" width="12" height="12" rx="4" fill="#fbcfe8" opacity="0.6"/>

      <!-- Ears -->
      <circle cx="25" cy="51" r="6" fill="#fed7aa"/>
      <circle cx="75" cy="51" r="6" fill="#fed7aa"/>
      <circle cx="25" cy="51" r="3.2" fill="#fca5a5" opacity="0.6"/>
      <circle cx="75" cy="51" r="3.2" fill="#fca5a5" opacity="0.6"/>

      <!-- Cute Round Boy Face -->
      <ellipse cx="50" cy="51" rx="26" ry="24" fill="url(#boySkinGrad)"/>

      <!-- Boy's Cute Hairstyle (Bangs & Front Tuft) -->
      <path d="M24 45 C23 27 34 16 50 16 C66 16 77 27 76 45 C73 40 68 36 62 36 C57 36 53 39 49 37 C45 35 40 37 36 38 C31 39 27 42 24 45 Z" fill="url(#boyHairGrad)"/>
      <!-- Soft front bangs strands -->
      <path d="M36 36 Q42 43 45 38" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
      <path d="M52 36 Q58 44 63 38" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>

      <!-- Big expressive lively eyes with sparkles -->
      <ellipse cx="39" cy="50" rx="4.5" ry="6" fill="#0f172a"/>
      <ellipse cx="61" cy="50" rx="4.5" ry="6" fill="#0f172a"/>
      <circle cx="40.5" cy="48" r="1.9" fill="#ffffff"/>
      <circle cx="62.5" cy="48" r="1.9" fill="#ffffff"/>
      <circle cx="37.5" cy="52" r="1" fill="#ffffff"/>
      <circle cx="59.5" cy="52" r="1" fill="#ffffff"/>

      <!-- Eyebrows -->
      <path d="M34 42 Q39 39 44 42" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M56 42 Q61 39 66 42" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>

      <!-- Blushing Rosy Cheeks -->
      <circle cx="33" cy="56" r="4.2" fill="#f87171" opacity="0.5"/>
      <circle cx="67" cy="56" r="4.2" fill="#f87171" opacity="0.5"/>

      <!-- Cute smiling mouth with little tongue -->
      <path d="M44 56 Q50 63 56 56" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round" fill="#e11d48"/>

      <!-- Hair cowlick / ahoge sprout at top -->
      <path d="M50 16 Q54 6 62 8" stroke="#10b981" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <circle cx="62" cy="8" r="2.2" fill="#059669"/>
    </svg>`;
  }

  // ถามน้อง AI: ใช้ Claude ฝั่งเซิร์ฟเวอร์ (อ่านข้อมูลจริงทั้งเว็บ) ถ้าตั้ง ANTHROPIC_API_KEY ไว้
  // ถ้ายังไม่ตั้ง/เรียกไม่สำเร็จ จะใช้วิธีเดิม (ตอบตามคำสำคัญจากข้อมูลที่โหลดไว้ในหน้า)
  async function answerGhostQuestion(q) {
    const history = (S.ghostMsgs || []).filter((m) => !m.pending && m.text).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', text: m.text }));
    const typing = { from: 'ai', text: '🔎 กำลังค้นข้อมูลในระบบให้นะครับ…', pending: true };
    S.ghostMsgs.push(typing); render();
    const sc = document.getElementById('ghost-scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
    try {
      const r = await api('/api/assistant', { method: 'POST', body: { messages: history } });
      if (r && !r.fallback && r.text) { S.ghostSmart = true; return r.text; }
      S.ghostSmart = false;
    } catch (e) {
      if (!/ANTHROPIC|503/.test(e.message || '')) { return `ขอโทษครับ ตอนนี้น้องเชื่อมต่อผู้ช่วย AI ไม่ได้ (${e.message}) ลองใหม่อีกครั้งนะครับ`; }
    } finally {
      S.ghostMsgs = S.ghostMsgs.filter((m) => m !== typing);
    }
    return answerGhostQuestionLocal(q);
  }

  async function answerGhostQuestionLocal(q) {
    const rawTxt = String(q || '').trim();
    const txt = rawTxt.toLowerCase();

    // 1. ตรวจสอบและดึงข้อมูล State สำหรับใช้ตอบแบบ Real-time
    // ตรวจหาช่วงวันที่ผู้ใช้ระบุในคำถาม เช่น "90 วัน", "7 วัน", "30 วัน", "ทั้งหมด"
    // ถ้าไม่ระบุในคำถาม ให้ดึงตามช่วงวันที่ผู้ใช้เลือกเปิดดูอยู่บนหน้าแดชบอร์ด/ระบบ ณ ขณะนั้น (S.dash.range)
    let targetRange = S.dash.range || '30d';
    if (txt.includes('90 วัน') || txt.includes('90วัน') || txt.includes('90d') || txt.includes('3 เดือน') || txt.includes('ไตรมาส')) {
      targetRange = '90d';
    } else if (txt.includes('7 วัน') || txt.includes('7วัน') || txt.includes('7d') || txt.includes('สัปดาห์') || txt.includes('1 อาทิตย์')) {
      targetRange = '7d';
    } else if (txt.includes('30 วัน') || txt.includes('30วัน') || txt.includes('30d') || txt.includes('1 เดือน') || txt.includes('เดือนนี้')) {
      targetRange = '30d';
    } else if (txt.includes('ทั้งหมด') || txt.includes('all time') || txt.includes('ภาพรวมทั้งหมด')) {
      targetRange = 'all';
    }

    const rangeLabelMap = {
      '7d': '7 วัน',
      '30d': '30 วัน',
      '90d': '90 วัน',
      'all': 'ทั้งหมด (All-time)',
      'custom': 'กำหนดเอง'
    };
    const currentRangeText = rangeLabelMap[targetRange] || (targetRange === 'custom' && S.dash.from && S.dash.to ? `${S.dash.from} ถึง ${S.dash.to}` : `${targetRange}`);

    let dData = (S.dash.range === targetRange && S.dash.data) ? S.dash.data : null;
    let inboxData = S.inbox.data;
    let slaData = S.sla.data;
    let fuData = S.followup.data;
    let filtersData = S.filters;

    // Helper โหลดข้อมูลล่วงหน้าหากยังไม่เคยโหลด
    const ensureContext = async () => {
      const tasks = [];
      if (!dData) {
        tasks.push(api(`/api/dashboard?range=${targetRange}`).then(r => {
          dData = r;
          if (S.dash.range === targetRange) S.dash.data = r;
        }).catch(() => {}));
      }
      if (!inboxData) tasks.push(api('/api/inbox?range=all').then(r => { inboxData = r; S.inbox.data = r; }).catch(() => {}));
      if (!slaData) tasks.push(api('/api/sla?range=all').then(r => { slaData = r; S.sla.data = r; }).catch(() => {}));
      if (!fuData) tasks.push(api('/api/followups').then(r => { fuData = r; S.followup.data = r; }).catch(() => {}));
      if (!filtersData) tasks.push(api('/api/filters').then(r => { filtersData = r; S.filters = r; }).catch(() => {}));
      if (tasks.length) await Promise.all(tasks);
    };

    // -------------------------------------------------------------------------
    // หมวด 1: ตามลูกค้า & ระบบแจ้งเตือน (Follow-up & Notifications)
    // -------------------------------------------------------------------------
    if (txt.includes('ตามลูกค้า') || txt.includes('followup') || txt.includes('follow-up') || txt.includes('นัดตาม') || txt.includes('แจ้งเตือน') || txt.includes('รอบเวลา') || txt.includes('ตั้งเวลา') || txt.includes('เตือนตาม') || txt.includes('กระดิ่ง') || txt.includes('เสียงเตือน') || txt.includes('desktop notification')) {
      await ensureContext();
      const st = (fuData && fuData.stats) || { reply: 0, chase: 0, due: 0, scheduled: 0 };
      const totalRows = (fuData && fuData.rows && fuData.rows.length) || 0;
      const sched = S.notificationSchedule || { enabled: false, intervalMinutes: 60 };

      return `📅 **สรุปข้อมูลและวิธีใช้งานหน้าตามลูกค้า (Follow-up Leads):**\n\n` +
        `📊 **สถานะคิวลูกค้าในระบบตอนนี้:**\n` +
        `• ⚡ **ลูกค้ารอตอบ:** **${num(st.reply)} เคส** (ลูกค้าส่งข้อความมาแต่ยังไม่มีการตอบกลับ)\n` +
        `• ⏳ **ถึงเวลาตามต่อ:** **${num(st.chase)} เคส** (ทักไปแล้วลูกค้าเงียบเกิน 24 ชม. แต่ไม่เกิน 30 วัน)\n` +
        `• ⚠️ **นัดตามเกินกำหนด / วันนี้:** **${num(st.due)} เคส**\n` +
        `• 📅 **นัดตามทั้งหมด:** **${num(st.scheduled)} เคส** (รวมในคิวทั้งหมด ${num(totalRows)} รายการ)\n\n` +
        `✨ **ฟังก์ชันการทำงานเด่นในหน้านี้:**\n` +
        `1. **ปุ่ม "✏️ แก้ไข" (ในตาราง):** กดเพื่อเปิดหน้าต่างแก้ไขวันนัดตาม พร้อมปุ่มลัด (วันนี้/พรุ่งนี้/3 วัน/1 สัปดาห์), ใส่โน้ตช่วยจำ, เปลี่ยนสถานะลีด หรือกด "ปิดงานตาม"\n` +
        `2. **ปุ่ม "🔔 แจ้งเตือน" (ในตาราง):** กดส่งการแจ้งเตือนเคสนั้นๆ เข้าสู่ศูนย์กระดิ่งบนเว็บและกลุ่ม LINE ทันที\n` +
        `3. **ปุ่ม "🔔 ส่งแจ้งเตือนตอนนี้" (ด้านบน):** สรุปจำนวนลูกค้าที่ต้องตามทั้งหมดส่งแจ้งเตือนทันที\n` +
        `4. **ปุ่ม "⏰ ตั้งรอบเวลาแจ้งเตือน":** ปัจจุบัน **${sched.enabled ? `เปิดอยู่ (ทุก ${sched.intervalMinutes >= 60 ? (sched.intervalMinutes / 60) + ' ชม.' : sched.intervalMinutes + ' นาที'})` : 'ปิดอยู่'}** สามารถคลิกตั้งรอบเวลาอัตโนมัติ (15 นาที – 24 ชม.) พร้อมเปิดเสียงเตือน Chime และแจ้งเตือนบนหน้าจอ (Desktop Notification) ได้เลยครับ`;
    }

    // -------------------------------------------------------------------------
    // หมวด 2: SLA & สถิติความเร็วการตอบแชท (ใครตอบเร็วสุด / ใครตอบช้าสุด)
    // -------------------------------------------------------------------------
    if (txt.includes('sla') || txt.includes('คะแนน') || txt.includes('แย่') || txt.includes('ดีสุด') || txt.includes('ช้า') || txt.includes('เร็ว') || txt.includes('หลุด') || txt.includes('รีวิว') || txt.includes('เกณฑ์ 15') || txt.includes('หักแต้ม') || txt.includes('scorecard') || txt.includes('อันดับ')) {
      await ensureContext();
      if (slaData && slaData.reps && slaData.reps.length) {
        const sortedWorst = [...slaData.reps].sort((a, b) => a.points - b.points);
        const sortedBest = [...slaData.reps].sort((a, b) => b.points - a.points);
        const worst = sortedWorst[0];
        const best = sortedBest[0];

        if (txt.includes('ช้า') || txt.includes('แย่') || txt.includes('ต่ำ') || txt.includes('หัก') || txt.includes('หลุด')) {
          return `⏱️ **น้อง AI สรุปอันดับเซลส์ที่ตอบช้าสุด / ถูกหักคะแนน SLA มากที่สุดให้แล้วครับผม:**\n\n` +
            `🥇 **อันดับที่ตอบช้าสุด:** **${worst.rep}**\n` +
            `• คะแนนผลงาน: **${worst.points} แต้ม**\n` +
            `• ตอบช้าเกิน 15 นาที: **${worst.late}** จาก ${worst.turns} รอบ (${pct(worst.lateRate * 100)})\n` +
            `• เวลาตอบเฉลี่ย: **${worst.avgMin ? num(worst.avgMin, 1) + ' นาที' : '—'}**\n\n` +
            `📌 **เกณฑ์การคิดคะแนน SLA 15 นาทีของคลินิกครับ:**\n` +
            `• คิดเฉพาะช่วงเวลาทำการ **10:00 – 19:00 น.** ครับ\n` +
            `• ตอบเกิน 15 นาที: **หัก 1 แต้ม**\n` +
            `• ลูกค้าทักแล้วอ่านแต่ไม่ตอบ: **หัก 0.5 แต้ม**\n` +
            `• ช่วงนอกเวลาทำการ (กลางคืน/เช้าตรู่): บันทึกสถิติแต่ไม่นำมาหักแต้มพี่ๆ เซลส์ครับผม!`;
        }

        if (txt.includes('เร็ว') || txt.includes('ดี') || txt.includes('สูงสุด') || txt.includes('ยอดเยี่ยม')) {
          return `🏆 **น้อง AI ขอปรบมือให้ครับ! ผู้ที่ทำคะแนน SLA ตอบแชทได้ดีและเร็วที่สุดในทีม:**\n\n` +
            `🌟 **${best.rep}**\n` +
            `• คะแนนผลงาน: **${best.points} แต้ม** (ยอดเยี่ยมมากครับ! ✨)\n` +
            `• ตอบทันเวลา: **${best.onTime} / ${best.turns} รอบ** (${pct(best.onTimeRate * 100)})\n` +
            `• เวลาตอบเฉลี่ย: **${best.avgMin ? num(best.avgMin, 1) + ' นาที' : 'เร็วมากครับ'}** 🚀\n\n` +
            `💡 พี่ๆ สามารถดูสถิติเชิงลึกของทุกคนได้ที่หน้า **⏱️ SLA & Review** หรือจะพิมพ์ถามชื่อเซลส์คนไหนกับน้อง AI ได้ตลอดเลยนะครับผม!`;
        }

        // สรุปทั้งเร็วสุดและช้าสุดควบคู่กัน
        return `⏱️ **น้อง AI สรุปสถิติความเร็วตอบแชท (SLA) ของทีมเซลส์ให้ฟังครับผม:**\n\n` +
          `🌟 **เซลส์ที่ตอบเร็วและคะแนนดีที่สุด:** **${best.rep}** (${best.points} แต้ม | ตอบทัน ${best.onTime}/${best.turns} รอบ | เฉลี่ย ${num(best.avgMin, 1)} นาที) 🚀\n\n` +
          `⚠️ **เซลส์ที่ตอบช้าสุด / ถูกหักแต้มมากสุด:** **${worst.rep}** (${worst.points} แต้ม | ตอบช้าเกินเกณฑ์ ${worst.late} รอบ | เฉลี่ย ${num(worst.avgMin, 1)} นาที)\n\n` +
          `💡 พี่ๆ ไม่ต้องเปิดหน้าเว็บดูเองเลยครับ อยากรู้อันดับใคร ถามน้อง AI ได้เลยนะคร้าบ! 😊`;
      }
    }

    // -------------------------------------------------------------------------
    // หมวด 3: แดชบอร์ด & ตัวเลขการตลาด (Dashboard, Spend, ROAS, KPIs)
    // -------------------------------------------------------------------------
    if (txt.includes('ยอด') || txt.includes('งบ') || txt.includes('ใช้เงิน') || txt.includes('spend') || txt.includes('roas') || txt.includes('cpm') || txt.includes('cpc') || txt.includes('dashboard') || txt.includes('รายได้') || txt.includes('ยอดซื้อ') || txt.includes('ยอดขาย') || txt.includes('kpi')) {
      await ensureContext();
      if (dData && dData.kpis) {
        const k = dData.kpis;
        return `📊 **สรุปผลลัพธ์โฆษณาและ Marketing KPIs ล่าสุด (ช่วง ${currentRangeText}):**\n\n` +
          `• **งบโฆษณาที่ใช้ (Spend):** **${baht(k.spend?.value || 0)}**\n` +
          `• **จำนวนคนเห็น (Reach):** **${num(k.reach?.value || 0)} คน** (${num(k.impressions?.value || 0)} ครั้ง)\n` +
          `• **จำนวนคลิก (Clicks):** **${num(k.clicks?.value || 0)} คลิก** (CTR: **${pct(k.ctr?.value || 0)}**)\n` +
          `• **จำนวนแชททัก (Messages):** **${num(k.messages?.value || 0)} ข้อความ**\n` +
          `• **ต้นทุนต่อแชท (Cost/Msg):** **${baht(k.costMessage?.value || 0)}**\n` +
          `• **ยอดซื้อสำเร็จ (Purchases):** **${num(k.purchases?.value || 0)} เคส**\n` +
          `• **รายได้ปิดการขาย (Revenue):** **${baht(k.revenue?.value || 0)}** ${k.roas?.value ? `(ROAS: **${num(k.roas.value, 2)}×**)` : ''}\n\n` +
          `💡 ข้อมูลนี้คำนวณตามช่วงเวลา **${currentRangeText}** (สามารถเปลี่ยนดู 7 วัน, 30 วัน, หรือ 90 วันได้ทั้งบนแถบหน้าจอหรือพิมพ์บอกน้องได้เลยครับผม!)`;
      }
    }

    // -------------------------------------------------------------------------
    // หมวด 4: Unified Inbox & แชทคนไข้ (Chats, Unreplied, Copilot)
    // -------------------------------------------------------------------------
    if (txt.includes('แชท') || txt.includes('ทัก') || txt.includes('ข้อความ') || txt.includes('inbox') || txt.includes('คนไข้') || txt.includes('ลูกค้า') || txt.includes('unreplied') || txt.includes('ยังไม่ตอบ') || txt.includes('copilot') || txt.includes('ไอจี') || txt.includes('ดึงแชท')) {
      await ensureContext();
      const allRows = (inboxData && inboxData.rows) || [];
      const total = allRows.length || (dData?.kpis?.messages?.value) || 0;
      const unreplied = allRows.filter(needsReply).length;
      const starred = allRows.filter(r => r.starred || r.status === 'converted' || r.status === 'booked').length;

      return `💬 **สรุปข้อมูล Unified Omnichannel Inbox ของคลินิก:**\n\n` +
        `• **แชททั้งหมดในระบบ:** **${num(total)} บทสนทนา**\n` +
        `• **แชทที่ยังรอการตอบกลับ (Unreplied):** **${num(unreplied)} แชท** ⚠️\n` +
        `• **เคสติดดาว / นัดหมายแล้ว:** **${num(starred)} เคส** ⭐\n` +
        `• **ช่องทางเชื่อมต่อ:** Facebook Messenger, Instagram Direct, LINE Official Account, WhatsApp Business\n\n` +
        `🤖 **ฟังก์ชันช่วยเหลือในการตอบแชท:**\n` +
        `1. **BEQ Copilot Suggested Replies:** มีปุ่มคลิกข้อความเสนอแนะฉลาด 3 รูปแบบ (โปรโมชั่นราคา, นัดคิวตรวจ, ข้อมูลการดูแลแผล)\n` +
        `2. **BEQ Copilot Intelligence:** ประเมินปัญหาเส้นผม และคำนวณจำนวนกราฟต์ผมที่ต้องใช้ให้อัตโนมัติ (เช่น 2,500 Grafts)\n` +
        `3. **โหมดสลับสิทธิ์:** กดปุ่ม **Takeover** เพื่อสลับระหว่างพนักงานควบคุมเอง (Manual) หรือให้ Copilot ช่วยแนะนำ`;
    }

    // -------------------------------------------------------------------------
    // หมวด 5: การจัดการเพจ (Facebook & Instagram Pages Management)
    // -------------------------------------------------------------------------
    if (txt.includes('เพจ') || txt.includes('page') || txt.includes('dr.nay') || txt.includes('beq_wellness') || txt.includes('ลบเพจ') || txt.includes('เพิ่มเพจ') || txt.includes('ad account') || txt.includes('page id') || txt.includes('ชื่อเล่น')) {
      await ensureContext();
      const rawPages = (filtersData && filtersData.pages) || [];
      const validPages = rawPages.filter(isValidPage);

      return `📄 **ข้อมูลการจัดการเพจในระบบ BEQ Suite:**\n\n` +
        `🌐 **เพจหลักที่เชื่อมต่อและเปิดใช้งานอยู่ (${validPages.length} เพจ):**\n` +
        validPages.map(p => `• ${p.platform === 'Instagram' ? '📸' : '🔵'} **${p.name}** (แพลตฟอร์ม: ${p.platform || 'Facebook'}, ID: \`${p.id}\`)${p.adAccountId ? ` [ผูก Ad Account: ${p.adAccountId}]` : ''}`).join('\n') + `\n\n` +
        `📢 **นโยบายการยิงแอดของคลินิก:** โฆษณา (Ads) ทั้งหมดจะวิ่งเข้าเพจหลักเพจเดียวคือ **BEQ Hair Clinic** ครับผม\n\n` +
        `⚙️ **วิธีเพิ่ม/แก้ไข/ลบเพจ:**\n` +
        `1. ไปที่เมนู **⚙️ Settings** ด้านซ้าย\n` +
        `2. เลื่อนลงมาที่หัวข้อ **➕ เพิ่มหรือแก้ไขข้อมูลเพจ**\n` +
        `3. สามารถแก้ไขชื่อเล่นเพจ, แก้ไข Page ID, ผูก Ad Account หรือกดปุ่ม **"ลบ"** ที่เพจที่ไม่ต้องการออกได้ทันทีครับ`;
    }

    // -------------------------------------------------------------------------
    // หมวด 6: การตั้งค่าระบบ & การเชื่อมต่อ API (Settings & Integrations)
    // -------------------------------------------------------------------------
    if (txt.includes('setting') || txt.includes('ตั้งค่า') || txt.includes('เชื่อมต่อ') || txt.includes('meta') || txt.includes('facebook') || txt.includes('line notify') || txt.includes('whatsapp') || txt.includes('token') || txt.includes('webhook') || txt.includes('app secret') || txt.includes('verify token')) {
      return `⚙️ **คู่มือการตั้งค่าและการเชื่อมต่อระบบ (Settings):**\n\n` +
        `1. **เชื่อมต่อ Meta Graph API (Facebook / Instagram):**\n` +
        `   • กรอก App ID, App Secret, System User Permanent Access Token\n` +
        `   • ตั้งค่า Webhook URL และ Verify Token เพื่อรับข้อความแชทและคอมเมนต์เรียลไทม์\n` +
        `   • มีปุ่มสลับโหมดข้อมูลระหว่าง **Meta (ข้อมูลจริง)** และ **Demo (ข้อมูลทดสอบ)**\n\n` +
        `2. **เชื่อมต่อ LINE Notify:**\n` +
        `   • ใส่ LINE Notify Token เพื่อให้ระบบส่งแจ้งเตือนสรุปคิวตามลูกค้า และเคสนัดตามเกินกำหนดเข้ากลุ่ม LINE\n\n` +
        `3. **เชื่อมต่อ WhatsApp Business:**\n` +
        `   • กรอก Permanent Token, Phone Number ID และ WhatsApp Webhook Path\n\n` +
        `4. **ความปลอดภัยและผู้ใช้:** เปลี่ยนรหัสผ่านของตนเอง และเพิ่ม/รีเซ็ตรหัสผ่านทีมงาน`;
    }

    // -------------------------------------------------------------------------
    // หมวด 7: Leads Board & 12 ลำดับขั้นคนไข้ (Pipeline Stages)
    // -------------------------------------------------------------------------
    if (txt.includes('board') || txt.includes('บอร์ด') || txt.includes('กระดาน') || txt.includes('pipeline') || txt.includes('12 ขั้นตอน') || txt.includes('ลากการ์ด') || txt.includes('kanban') || txt.includes('สถานะ')) {
      return `📋 **Leads Board กระดานติดตามคนไข้ 12 ลำดับขั้น:**\n\n` +
        `1. **มาใหม่ (New Leads):** ทักแชทเข้ามาครั้งแรก รอแอดมินรับเรื่อง\n` +
        `2. **In-take:** เก็บประวัติเบื้องต้นและปัญหาเส้นผม\n` +
        `3. **พอได้คุย:** พูดคุยสอบถามรายละเอียดต่อเนื่อง\n` +
        `4. **กำลังดำเนินการ:** อยู่ระหว่างนำเสนอโปรแกรมปลูกผม\n` +
        `5. **นัดหมายแล้ว:** ลงคิวนัดเข้าพบแพทย์ที่คลินิก\n` +
        `6. **ผ่านการประเมิน (Qualified):** ประเมินกราฟต์ผมและงบประมาณชัดเจน\n` +
        `7. **ทักซ้ำ (Follow-up):** ติดตามต่อหลังจากเงียบไป\n` +
        `8. **สร้างคอนเวอร์ชั่นแล้ว:** วางมัดจำหรือตกลงรับบริการ\n` +
        `9. **ปิดการขายสำเร็จ (Converted):** ทำหัตถการเรียบร้อย ปิดยอดขาย 🎉\n` +
        `10. **ยังไม่ตอบ (No Reply):** ลูกค้ายังไม่ตอบข้อความ\n` +
        `11. **ไม่สนใจ / หลุด (Lost):** ปฏิเสธหรือไม่ตรงเงื่อนไข\n` +
        `12. **เคสมีปัญหา (Disqualified):** ข้อมูลไม่ถูกต้องหรือผิดกลุ่ม\n\n` +
        `✨ **วิธีใช้งาน:** สามารถคลิกลากการ์ดคนไข้สลับคอลัมน์เพื่อเปลี่ยนสถานะได้ทันที หรือกดปุ่มกระโดดไปยังคอลัมน์ที่ต้องการได้ด้านบนบอร์ดครับ`;
    }

    // -------------------------------------------------------------------------
    // หมวด 8: การอัปโหลดข้อมูล & ระบบ Smart Auto-Mapping (Upload & CSV)
    // -------------------------------------------------------------------------
    if (txt.includes('อัปโหลด') || txt.includes('upload') || txt.includes('csv') || txt.includes('excel') || txt.includes('ไฟล์') || txt.includes('นำเข้า') || txt.includes('smart mapping')) {
      return `☁️ **คู่มือการอัปโหลดไฟล์ (Upload & Data):**\n\n` +
        `• **ประเภทไฟล์ที่รองรับ:** ไฟล์ \`.csv\` ทั้งไฟล์ข้อมูลลีด (Leads) และข้อมูลแคมเปญโฆษณา (Campaigns)\n` +
        `• **ระบบ Smart Auto-Mapping:** เมื่ออัปโหลดไฟล์ที่มีข้อมูลผสมกันระหว่าง Facebook และ Instagram ระบบจะคัดแยกเพจให้อัตโนมัติ:\n` +
        `  - แถวที่เป็น Instagram Dr. Nay จะเข้าเพจ **dr.nay_hairtransplant**\n` +
        `  - แถวที่เป็น Facebook Dr. Nay จะเข้าเพจ **Dr. Nay Hair Transplant by BEQ**\n` +
        `  - แถวที่เป็น Facebook Ads จะเข้าเพจ **BEQ Hair Clinic**\n` +
        `  - แถวที่เป็น Instagram จะเข้าเพจ **beq_wellness**\n` +
        `• **วิธีอัปโหลด:** ไปที่เมนู **☁️ Upload & Data** -> เลือกประเภท -> ลากไฟล์ CSV มาวางในกล่องอัปโหลดได้เลยครับ`;
    }

    // -------------------------------------------------------------------------
    // หมวด 9: เซลส์ ทีมขาย & สถิติการดูแลแชทแต่ละคน (Sales Reps & Assigned Chats)
    // -------------------------------------------------------------------------
    if (txt.includes('เซลล์') || txt.includes('เซลส์') || txt.includes('แอดมิน') || txt.includes('ทีมขาย') || txt.includes('พนักงาน') || txt.includes('คนตอบ') || txt.includes('ดูแลกี่แชท') || txt.includes('ดูแลกี่คน') || txt.includes('กี่แชท') || txt.includes('สถิติเซลล์') || txt.includes('ใครดูแล') || txt.includes('rep') || txt.includes('sales') || txt.includes('ผู้ใช้') || txt.includes('user') || txt.includes('สิทธิ์') || txt.includes('admin') || txt.includes('staff')) {
      await ensureContext();
      const allRows = (inboxData && inboxData.rows) || [];
      const repCounts = {};
      let unassignedCount = 0;

      // รายชื่อเซลส์หลักในระบบ
      const defaultReps = repNameList();
      defaultReps.forEach(r => { repCounts[r] = { total: 0, unreplied: 0, converted: 0 }; });

      for (const row of allRows) {
        const rName = (row.rep || row.repId || '').trim();
        if (!rName || rName === 'Unassigned' || rName === '—') {
          unassignedCount++;
        } else {
          if (!repCounts[rName]) repCounts[rName] = { total: 0, unreplied: 0, converted: 0 };
          repCounts[rName].total++;
          if (needsReply(row)) {
            repCounts[rName].unreplied++;
          }
          if (row.status === 'converted' || row.status === 'booked') {
            repCounts[rName].converted++;
          }
        }
      }

      // ตรวจหาชื่อเฉพาะที่ผู้ใช้ถาม เช่น "Thanawin ดูแลกี่แชท", "Nack ได้กี่แชท"
      const matchedRep = Object.keys(repCounts).find(r => txt.includes(r.toLowerCase()) || r.toLowerCase().split(' ').some(part => part.length > 2 && txt.includes(part)));
      if (matchedRep) {
        const stat = repCounts[matchedRep];
        return `👤 **สถิติการดูแลแชทของ ${matchedRep}:**\n\n` +
          `• 💬 **แชทที่ดูแลทั้งหมด:** **${num(stat.total)} เคส**\n` +
          `• ⚡ **แชทที่รอยังไม่ตอบ:** **${num(stat.unreplied)} เคส** ${stat.unreplied > 0 ? '⚠️' : '✅'}\n` +
          `• 🎉 **ปิดการขาย/นัดหมายสำเร็จ:** **${num(stat.converted)} เคส**\n\n` +
          `💡 สามารถคลิกกรองดูรายชื่อลูกค้าของ **${matchedRep}** ได้โดยตรงที่เมนู **💬 Inbox** หรือ **📋 Leads Board** ครับ`;
      }

      // แสดงภาพรวมของทีมเซลส์ทุกคน
      const repList = Object.entries(repCounts).sort((a, b) => b[1].total - a[1].total);
      return `👥 **สรุปจำนวนแชทที่ทีมเซลส์แต่ละคนกำลังดูแล (Sales Chat Load):**\n\n` +
        repList.map(([name, s], idx) => {
          const badge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
          return `${badge} **${name}:** ดูแล **${num(s.total)} แชท** ${s.unreplied > 0 ? `(รอตอบ ${s.unreplied} เคส ⚡)` : '(เคลียร์หมด ✓)'} [ปิดสำเร็จ ${s.converted}]`;
        }).join('\n') + `\n\n` +
        `• 🤖 **ยังไม่มอบหมาย (BEQ Copilot ดูแล):** **${num(unassignedCount)} แชท**\n\n` +
        `💡 *เคล็ดลับ:* คุณสามารถพิมพ์ถามเจาะจงรายบุคคลได้ เช่น *"Thanawin ดูแลกี่แชท"* หรือ *"ใครดูแลแชทเยอะสุด"* ได้เลยครับ!`;
    }

    // -------------------------------------------------------------------------
    // หมวด 10: โพสต์ & คอมเมนต์ (Posts & Comments)
    // -------------------------------------------------------------------------
    if (txt.includes('comment') || txt.includes('คอมเมนต์') || txt.includes('post') || txt.includes('โพสต์') || txt.includes('ใต้โพสต์') || txt.includes('ตอบคอมเมนต์')) {
      return `💬 **ระบบจัดการคอมเมนต์ใต้โพสต์ (Posts & Comments):**\n\n` +
        `• ดึงโพสต์โฆษณาและคอมเมนต์ใต้โพสต์ของเพจ Facebook มารวมศูนย์ในที่เดียว\n` +
        `• ตรวจจับ SLA การตอบคอมเมนต์ของแอดมินไม่ให้ตกหล่น\n` +
        `• แอดมินสามารถพิมพ์ตอบกลับคอมเมนต์ได้จากหน้าเว็บโดยตรง ไม่ต้องสลับไปหน้า Facebook ครับ`;
    }

    // -------------------------------------------------------------------------
    // หมวด 11: การวิเคราะห์คุณภาพโฆษณา (Quality Analysis)
    // -------------------------------------------------------------------------
    if (txt.includes('quality') || txt.includes('คุณภาพ') || txt.includes('วิเคราะห์แอด') || txt.includes('creative') || txt.includes('ชิ้นงาน')) {
      return `✨ **ระบบวิเคราะห์คุณภาพโฆษณา (Quality Analysis):**\n\n` +
        `• ให้คะแนนคุณภาพชิ้นงานโฆษณาแต่ละตัว (Creative Quality Score)\n` +
        `• เปรียบเทียบอัตรา Conversion Rate, Cost per Lead และ ROAS ของแต่ละชิ้นงาน\n` +
        `• แนะนำชิ้นงานที่คุ้มค่าต่อการสเกลงบ และเตือนชิ้นงานที่ควรหยุดแอด`;
    }

    // -------------------------------------------------------------------------
    // หมวด 12: ประวัติการใช้งานและความปลอดภัย (Audit Trail)
    // -------------------------------------------------------------------------
    if (txt.includes('audit') || txt.includes('ประวัติ') || txt.includes('บันทึก') || txt.includes('ความปลอดภัย') || txt.includes('log') || txt.includes('ใครทำ')) {
      return `📜 **ระบบบันทึกความปลอดภัย (Audit Trail):**\n\n` +
        `• บันทึกทุกเหตุการณ์สำคัญ: การเข้าสู่ระบบ, การเปลี่ยนรหัสผ่าน, การตอบแชท, การเปลี่ยนสถานะลีด, การตั้งนัดตาม, การลบผู้ใช้, การบันทึกรีวิว\n` +
        `• บันทึก IP Address, วันเวลา (Timestamp) และชื่อผู้ดำเนินการทุกครั้ง\n` +
        `• มีปุ่ม **"ส่งออก CSV"** เพื่อดาวน์โหลดประวัติทั้งหมดไปตรวจสอบ`;
    }

    // -------------------------------------------------------------------------
    // หมวด 13: บริการปลูกผม & ราคาหัตถการ BEQ Clinic
    // -------------------------------------------------------------------------
    if (txt.includes('ปลูกผม') || txt.includes('fue') || txt.includes('dhi') || txt.includes('graft') || txt.includes('กราฟต์') || txt.includes('prp') || txt.includes('stem cell') || txt.includes('svf') || txt.includes('ผมร่วง') || txt.includes('ผมบาง') || txt.includes('หัวล้าน') || txt.includes('ราคา') || txt.includes('โปร') || txt.includes('หมอเนย์') || txt.includes('dr.nay')) {
      return `🩺 **โปรแกรมปลูกผมและบริการทางการแพทย์ BEQ Clinic:**\n\n` +
        `• **FUE Hairline Restoration (1,500 – 2,500 Grafts):** ปรับกรอบหน้าแนวเกาหลี แผลเล็กจิ๋ว ไม่ต้องพักฟื้นยาว (เริ่มต้น ฿59,000 – ฿79,000)\n` +
        `• **FUE + DHI Crown Density (2,500 – 3,500 Grafts):** เพิ่มความหนาแน่นบริเวณไข่ดาวกลางศีรษะ ปลูกด้วยปากกา Implanter ทิศทางเป็นธรรมชาติ (฿79,000 – ฿99,000)\n` +
        `• **Regenerative Hair PRP & Stem Cell SVF:** ฟื้นฟูรากผมฝ่อ กระตุ้นการงอกใหม่ ชะลอผมร่วงกรรมพันธุ์\n` +
        `• **BEQ Scalp Care & Laser LLLT:** ทรีตเมนต์ทำความสะอาดรูขุมขน เลเซอร์กระตุ้นการไหลเวียนเลือด และเซรั่มสูตรแพทย์`;
    }

    // -------------------------------------------------------------------------
    // หมวด 14: ค้นหาด่วน & คีย์ลัด (Quick Search & Shortcuts)
    // -------------------------------------------------------------------------
    if (txt.includes('ctrl k') || txt.includes('ค้นหา') || txt.includes('shortcut') || txt.includes('ปุ่มลัด') || txt.includes('command palette')) {
      return `🔍 **การค้นหาด่วนด้วย Command Palette (Ctrl + K):**\n\n` +
        `• กดปุ่ม **Ctrl + K** (หรือ **Cmd + K** บน Mac) ได้จากทุกหน้าในระบบ\n` +
        `• พิมพ์ชื่อลูกค้า เพื่อค้นหาและคลิกเปิดแชทได้ทันที\n` +
        `• พิมพ์ชื่อหน้า เช่น "บอร์ด", "ตามลูกค้า", "รีวิว", "ตั้งค่า" เพื่อเปลี่ยนหน้าได้อย่างรวดเร็วใน 1 วินาที`;
    }

    // -------------------------------------------------------------------------
    // หมวด 15: แผนผังทุกหน้าในระบบ (Sitemap & Navigation Guide)
    // -------------------------------------------------------------------------
    if (txt.includes('หน้า') || txt.includes('เว็บ') || txt.includes('มีอะไรบ้าง') || txt.includes('เมนู') || txt.includes('ทำอะไรได้') || txt.includes('ทั้งหมด')) {
      return `🌐 **แผนผังเมนูและฟังก์ชันทั้งหมดในระบบ BEQ Suite:**\n\n` +
        `1. **📊 Dashboard:** ภาพรวมผลลัพธ์โฆษณา, ค่าแอด, ROAS, กราฟแนวโน้ม, AI Advisor\n` +
        `2. **💬 Unified Inbox:** รวมศูนย์แชท Facebook, Instagram, LINE, WhatsApp พร้อมระบบ BEQ Copilot\n` +
        `3. **📋 Leads Board:** กระดาน Kanban 12 ลำดับขั้น ลากการ์ดเปลี่ยนสถานะคนไข้ได้ทันที\n` +
        `4. **⏱️ SLA & Review:** ตรวจจับความเร็วตอบแชทตามเกณฑ์ 15 นาที, ตรวจรีวิวคุณภาพบทสนทนา\n` +
        `5. **📅 Follow-up:** จัดการนัดหมายและเตือนติดตามผลลูกค้าที่เงียบไป พร้อมปุ่มแก้ไขและตั้งรอบเตือนอัตโนมัติ\n` +
        `6. **✨ Quality Analysis:** วิเคราะห์คุณภาพชิ้นงานโฆษณาและอัตรา Conversion\n` +
        `7. **💬 Posts & Comments:** ดึงคอมเมนต์ใต้โพสต์และ SLA ตอบคอมเมนต์\n` +
        `8. **☁️ Upload & Data:** นำเข้าข้อมูล CSV พร้อมระบบ Smart Auto-Mapping แยก FB/IG อัตโนมัติ\n` +
        `9. **📜 Audit Trail:** ประวัติการใช้งานและความปลอดภัย พร้อมส่งออก CSV\n` +
        `10. **⚙️ Settings:** เชื่อมต่อ Meta, LINE Notify, WhatsApp, จัดการเพจ และผู้ใช้งาน`;
    }

    // -------------------------------------------------------------------------
    // หมวด 16: การตลาด ปลูกผม การแพทย์ ความรู้ทั่วไป & เทคนิคการขาย
    // -------------------------------------------------------------------------
    if (txt.includes('การตลาด') || txt.includes('marketing') || txt.includes('ยิงแอด') || txt.includes('คอนเทนต์') || txt.includes('กลุ่มเป้าหมาย') || txt.includes('ปิดการขาย') || txt.includes('เทคนิค') || txt.includes('คำถาม') || txt.includes('สคริปต์') || txt.includes('ตอบลูกค้า')) {
      return `💡 **คู่มือและเทคนิคการตลาด & ปิดการขายแชทคลินิกปลูกผม:**\n\n` +
        `🎯 **1. การประเมินและคัดกรองเบื้องต้น (Qualification):**\n` +
        `• สอบถามอายุ, ระยะเวลาที่มีปัญหาผมร่วง/บาง และประวัติกรรมพันธุ์\n` +
        `• ขอรูปถ่ายมุมตรง 45 องศา และมุมก้มศีรษะ เพื่อให้แพทย์และระบบ Copilot ช่วยประเมินจำนวนกราฟต์ (Grafts)\n\n` +
        `💎 **2. เทคนิคการสร้างมูลค่า (Value-First Selling):**\n` +
        `• เน้นจุดเด่นของเทคนิค FUE/DHI ของ Dr. Nay: แผลเล็ก ไม่ง้อพักฟื้น ทิศทางผมดูเป็นธรรมชาติ 100%\n` +
        `• การันตีอัตราการติดของกราฟต์ผมสูงด้วยเทคนิคการแช่สารอาหารเลี้ยงรากผมเฉพาะสูตรคลินิก\n\n` +
        `⏱️ **3. การกระตุ้นให้ตัดสินใจ (Call-to-Action):**\n` +
        `• เสนอสิทธิ์นัดเข้าตรวจสแกนสภาพหนังศีรษะ (Trichoscopy Analysis) ฟรี ไม่มีค่าใช้จ่าย\n` +
        `• ล็อกสิทธิ์ราคาโปรโมชั่นพิเศษประจำเดือนเพื่อกระตุ้นให้นัดหมายเร็วขึ้น`;
    }

    if (txt.includes('ขอบคุณ') || txt.includes('ขอบใจ') || txt.includes('แต้งกิ้ว') || txt.includes('thank')) {
      return `👦🏻 ยินดีมากๆ เลยครับผม! พี่ๆ มีอะไรสงสัยเรื่องตัวเลขแอด แชท หรืออยากให้น้อง AI ช่วยสรุปข้อมูลอะไร ถามน้อง AI ได้ตลอดเวลาเลยนะครับ สู้ๆ กับการดูแลคนไข้นะคร้าบผม! ✨😊`;
    }

    // -------------------------------------------------------------------------
    // หมวด 17: ทักทาย & แนะนำตัว (Greetings & Bot Info)
    // -------------------------------------------------------------------------
    if (txt.includes('สวัสดี') || txt.includes('ดีครับ') || txt.includes('ดีค่ะ') || txt.includes('หวัดดี') || txt.includes('hello') || txt.includes('hi') || txt.includes('น้อง ai') || txt.includes('กุ๊กกู๋') || txt.includes('ใคร') || txt.includes('ช่วยอะไร') || txt.includes('ทำอะไร')) {
      return `👦🏻 **สวัสดีครับพี่ๆ! ผมคือ "น้อง AI" เด็กน้อยผู้ช่วยประจำคลินิก BEQ ครับผม ✨**\n\n` +
        `น้องมาช่วยเพื่อให้พี่ๆ สบายขึ้น ไม่ต้องเสียเวลาเปิดหาข้อมูลเองในเว็บเลยครับ! พี่ๆ อยากรู้อะไร ถามน้องได้ทันทีเลยนะครับ เช่น:\n` +
        `• 📊 *"สรุปยอดค่าแอดและ ROAS ช่วงนี้ให้หน่อยครับ"*\n` +
        `• 💬 *"ตอนนี้มีแชททักเข้ามาเท่าไหร่ และค้างตอบกี่คนครับ"*\n` +
        `• ⏱️ *"ใครตอบแชทเร็วสุด และใครตอบช้าสุดในทีมเซลส์ครับ"*\n` +
        `• 👥 *"เซลส์แต่ละคนดูแลกี่แชทครับ"* หรือ *"Thanawin ดูแลกี่แชทครับ"*\n` +
        `• 📅 *"มีลูกค้าที่ต้องตามกี่คน และนัดหมายวันนี้มีใครบ้างครับ"*\n` +
        `• 🩺 *"โปรแกรมปลูกผมและราคาของคลินิกมีอะไรบ้างครับ"*\n` +
        `• 📄 *"คลินิกมีสาขาที่ไหนบ้าง และมีเพจอะไรบ้างครับ"*\n\n` +
        `พิมพ์ถามน้องได้เลยนะคร้าบ น้องพร้อมตอบอย่างสุภาพและรวดเร็วเสมอครับผม! 😊`;
    }

    // -------------------------------------------------------------------------
    // Fallback อัจฉริยะ: ดึงข้อมูล Live State ทั้งระบบมาตอบอย่างฉลาดและละเอียด
    // -------------------------------------------------------------------------
    await ensureContext();
    const inboxCount = (inboxData && inboxData.rows && inboxData.rows.length) || 0;
    const fuCount = (fuData && fuData.rows && fuData.rows.length) || 0;
    const spendVal = dData?.kpis?.spend?.value ? baht(dData.kpis.spend.value) : '—';
    const roasVal = dData?.kpis?.roas?.value ? `${num(dData.kpis.roas.value, 2)}×` : '—';
    const msgCount = dData?.kpis?.messages?.value ? num(dData.kpis.messages.value) : '—';
    const sched = S.notificationSchedule || { enabled: false, intervalMinutes: 60 };

    return `👦🏻 **น้อง AI รับทราบคำถามแล้วครับผม:** *"${esc(rawTxt)}"\n\n` +
      `น้องไปเช็กข้อมูลล่าสุดทั้งคลินิกมาให้พี่ๆ เรียบร้อยแล้วครับผม:\n\n` +
      `📌 **สรุปสถานะปัจจุบันของคลินิกเราครับ (ช่วง ${currentRangeText}):**\n` +
      `• 📊 **ยอดแอดรวม (${currentRangeText}):** ใช้อยู่ที่ **${spendVal}** | ผลตอบแทน ROAS: **${roasVal}** ครับ\n` +
      `• 💬 **แชทที่ได้รับทั้งหมด:** ทักมาแล้ว **${msgCount} ข้อความ** (กำลังดูแลใน Inbox **${num(inboxCount)} เคส** ครับ)\n` +
      `• 📅 **คิวคนไข้ที่ต้องติดตาม:** รอติดตามผล **${num(fuCount)} เคส** ครับ\n` +
      `• 🏥 **สาขาคลินิก:** **BEQ Hair Clinic สาขาสีลม (Silom)** สาขาเดียวครับผม\n` +
      `• 🔔 **รอบแจ้งเตือนอัตโนมัติ:** ${sched.enabled ? `🟢 เปิดอยู่ (ทุก ${sched.intervalMinutes >= 60 ? (sched.intervalMinutes / 60) + ' ชม.' : sched.intervalMinutes + ' นาที'})` : '⚪ ปิดอยู่'} ครับ\n\n` +
      `💡 **พี่ๆ สามารถถามน้องต่อได้เลยนะครับ ไม่ต้องคลิกหาเองเลยครับผม:**\n` +
      `1. *"ใครตอบแชทเร็วสุด / ช้าสุด"* หรือ *"คะแนน SLA ทีมเซลส์"*\n` +
      `2. *"เซลส์แต่ละคนดูแลกี่แชท"* หรือระบุชื่อเซลส์ได้เลยครับ\n` +
      `3. *"สรุปยอดแอด"* หรือ *"แคมเปญไหนคุ้มสุด"*\n` +
      `4. *"โปรแกรมปลูกผมและราคา"* หรือ *"วิธีดูแลแผลหลังปลูก"*\n\n` +
      `พิมพ์ถามน้องได้ตลอดเวลาเลยนะคร้าบ น้องยินดีรับใช้พี่ๆ เสมอครับผม! ✨😊`;
  }

  /* Local persistent cache เพื่อความเสถียร 100% ไม่พังแม้ออฟไลน์หรือติด rate limit */
  const ClientCache = {
    get(k) {
      try {
        const item = sessionStorage.getItem('beq_c_' + k);
        return item ? JSON.parse(item) : null;
      } catch { return null; }
    },
    set(k, val) {
      try { sessionStorage.setItem('beq_c_' + k, JSON.stringify(val)); } catch {}
    },
    clear(prefix = '') {
      try {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith('beq_c_' + prefix)) keys.push(k);
        }
        for (const k of keys) sessionStorage.removeItem(k);
      } catch {}
    }
  };

  function showToast(text, type = 'success') {
    const id = Date.now() + Math.random();
    S.toasts.push({ id, text, type });
    renderToasts();
    setTimeout(() => {
      S.toasts = S.toasts.filter(t => t.id !== id);
      renderToasts();
    }, 4000);
  }

  function renderToasts() {
    let container = document.getElementById('beq-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'beq-toast-container';
      container.className = 'beq-toast-container';
      document.body.appendChild(container);
    }
    container.innerHTML = S.toasts.map(t => `
      <div class="beq-toast toast-${t.type}">
        <span>${t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : '✨'}</span>
        <span>${esc(t.text)}</span>
      </div>
    `).join('');
  }
  const PAGE_SIZE = 25;
  const INBOX_PAGE = 15;
  // ความคืบหน้าของแชท เรียงตามคอลัมน์ใน Board ตามลำดับที่ผู้ใช้กำหนด (12 คอลัมน์)
  // ลำดับสถานะในช่องเลือก (เรียงตามเส้นทางลูกค้า) — 9 สถานะ หลังรวมสถานะที่ซ้ำกัน
  const STATUS_ORDER = [
    'new',          // มาใหม่
    'intake',       // คัดกรอง
    'talked',       // พอได้คุย
    'in_progress',  // กำลังดำเนินการ (รวม In-progress เดิม)
    'qualified',    // มีคุณสมบัติ (รวม Qualifile เดิม)
    'appointment',  // นัดแล้ว
    'converted',    // ปิดการขาย (รวม "สร้างคอนเวอร์ชั่นแล้ว" เดิม)
    'no_reply',     // ไม่ตอบ (ลูกค้าเงียบ)
    'very_poor',    // แย่มาก / หลุด
  ];
  const STATUS_TH = {
    new: 'มาใหม่',
    intake: 'คัดกรอง',
    talked: 'พอได้คุย',
    in_progress: 'กำลังดำเนินการ',
    qualified: 'มีคุณสมบัติ',
    appointment: 'นัดแล้ว',
    converted: 'ปิดการขาย',
    no_reply: 'ไม่ตอบ (ลูกค้าเงียบ)',
    very_poor: 'แย่มาก / หลุด',
    // ชื่อเก่าที่ถูกรวมแล้ว (เผื่อข้อมูลเก่าค้างในเครื่อง)
    inprogress: 'กำลังดำเนินการ',
    qualifile: 'มีคุณสมบัติ',
    conv_created: 'ปิดการขาย',
  };
  let reqSeq = 0;
  const CHARTS = {};

  /* ---------------- helpers ---------------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 0) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const baht = (n) => (n === null || n === undefined ? '—' : '฿' + num(n, 2));
  const pct = (n) => (n === null || n === undefined ? '—' : num(n, 2) + '%');
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const ICONS = {
    logo: '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M21 3v5h-5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    bars: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    filter: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    down: '<path d="M7 7l10 10"/><path d="M17 8v9H8"/>',
    up: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    c_video: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    c_image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    c_carousel: '<rect x="7" y="5" width="10" height="14" rx="2"/><path d="M3.5 8v8M20.5 8v8"/>',
    c_story: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    ai: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
  };

  // โลโก้เวกเตอร์แท้จริง คมชัดระดับ Hi-tech (Messenger, Instagram, LINE, WhatsApp)
  const BRAND_LOGOS = {
    Messenger: (s = 18) => `<span class="brand-icon" style="width:${s}px;height:${s}px"><svg width="${s}" height="${s}" viewBox="0 0 24 24"><defs><linearGradient id="msgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00C6FF"/><stop offset="50%" stop-color="#0078FF"/><stop offset="100%" stop-color="#A033FF"/></linearGradient></defs><path fill="url(#msgGrad)" d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.43 3.14 7.15.16.14.26.35.26.57l-.07 1.78c-.04.88.93 1.45 1.68 1l1.97-1.18c.18-.11.4-.14.61-.1.77.21 1.58.33 2.41.33 5.64 0 10-4.13 10-9.7S17.64 2 12 2z"/><path fill="#ffffff" d="M6.8 14.2l3.4-5.4a.8.8 0 0 1 1.1-.25l2.7 2 3.6-2.7c.5-.4 1.1.2.7.7l-3.4 5.4a.8.8 0 0 1-1.1.25l-2.7-2-3.6 2.7c-.5.4-1.1-.2-.7-.7z"/></svg></span>`,
    Facebook: (s = 18) => `<span class="brand-icon" style="width:${s}px;height:${s}px"><svg width="${s}" height="${s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1877F2"/><path fill="#ffffff" d="M13.5 18v-5.2h1.8l.3-2.1h-2.1V9.4c0-.6.2-1 .1.1-.1 0 1-.1 1-.1V7.3s-.9-.1-1.8-.1c-1.8 0-3 1.1-3 3.1v1.4H8v2.1h1.9V18h3.6z"/></svg></span>`,
    Instagram: (s = 18) => `<span class="brand-icon" style="width:${s}px;height:${s}px"><svg width="${s}" height="${s}" viewBox="0 0 24 24"><defs><radialGradient id="igRad" cx="25%" cy="105%" r="120%"><stop offset="0%" stop-color="#FFDD55"/><stop offset="15%" stop-color="#FF543E"/><stop offset="50%" stop-color="#C837AB"/><stop offset="100%" stop-color="#3771C8"/></radialGradient></defs><rect width="20" height="20" x="2" y="2" rx="5.5" fill="url(#igRad)"/><path fill="#ffffff" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-8.6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/></svg></span>`,
    LINE: (s = 18) => `<span class="brand-icon" style="width:${s}px;height:${s}px"><svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect width="20" height="20" x="2" y="2" rx="4.5" fill="#06C755"/><path fill="#ffffff" d="M19 11.2c0-3.9-3.6-7-8-7s-8 3.1-8 7c0 3.5 3.1 6.4 7.2 6.9.3 0 .7.2.8.5l.3 1.7c.1.4.4.5.7.3l2.3-1.4c.2-.1.5-.2.8-.2 2.3 0 3.9-3.2 3.9-7.8z"/></svg></span>`,
    WhatsApp: (s = 18) => `<span class="brand-icon" style="width:${s}px;height:${s}px"><svg width="${s}" height="${s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#25D366"/><path fill="#ffffff" d="M16.5 14.3c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1-.2.2-.6.7-.7.9-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4 0-.1 0-.3-.1-.4-.1-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1 0 1.3.9 2.5 1 2.6.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.3.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2z"/></svg></span>`
  };

  function getBrandLogo(plat, s = 18) {
    const p = String(plat || '').trim();
    if (p.toLowerCase().includes('instagram')) return BRAND_LOGOS.Instagram(s);
    if (p.toLowerCase().includes('line')) return BRAND_LOGOS.LINE(s);
    if (p.toLowerCase().includes('whatsapp')) return BRAND_LOGOS.WhatsApp(s);
    if (p.toLowerCase().includes('messenger')) return BRAND_LOGOS.Messenger(s);
    return BRAND_LOGOS.Facebook(s);
  }

  // ระบบ AI ให้คำตอบอัจฉริยะ (AI Smart Assistant for Hair Clinic)
  function generateAiSuggestions(lead, messages) {
    const lastCustMsg = [...(messages || [])].reverse().find(m => m.from !== 'staff')?.text || lead?.customerMsg || '';
    const txt = lastCustMsg.toLowerCase();
    const name = (lead?.name || 'ลูกค้า').replace(/^คุณ\s*/, '');

    const suggestions = [];

    if (txt.includes('ราคา') || txt.includes('โปร') || txt.includes('กี่บาท') || txt.includes('เท่าไหร่') || txt.includes('คอร์ส')) {
      suggestions.push({
        label: '💡 เสนอโปรโมชั่นปลูกผม',
        text: `สวัสดีครับคุณ${name} 🙏 ตอนนี้คลินิกมีโปรโมชั่นพิเศษปลูกผมเทคนิค FUE/DHI กราฟละราคาพิเศษ พร้อมแถมฟรีตรวจประเมินกราฟและเลเซอร์ LLLT 3 ครั้งครับ สนใจให้คุณหมอประเมินจำนวนกราฟให้เบื้องต้นก่อนได้เลยนะครับ`
      });
      suggestions.push({
        label: '📸 ขอรูปถ่ายประเมินกราฟ',
        text: `รบกวนคุณ${name} ถ่ายรูปมุมตรงด้านหน้าและก้มศีรษะให้เห็นบริเวณที่กังวลชัดเจน ส่งเข้ามาในนี้ได้เลยนะครับ เดี๋ยวหมอช่วยประเมินจำนวนกราฟที่เหมาะสมให้ครับผม 😊`
      });
    } else if (txt.includes('นัด') || txt.includes('จอง') || txt.includes('สะดวก') || txt.includes('เข้าไป') || txt.includes('ปรึกษา')) {
      suggestions.push({
        label: '📅 ชวนล็อกคิวนัดตรวจ',
        text: `ยินดีเลยครับคุณ${name} ทางคลินิกเปิดให้บริการทุกวัน 10:00 - 19:00 น. คุณ${name} สะดวกเป็นวันธรรมดาหรือช่วงเสาร์-อาทิตย์ดีครับ เดี๋ยวทางเราเช็กคิวคุณหมอให้ทันทีครับ`
      });
    } else if (txt.includes('เจ็บ') || txt.includes('พักฟื้น') || txt.includes('แผล') || txt.includes('สระผม')) {
      suggestions.push({
        label: '🛡️ ข้อมูลดูแลหลังปลูกผม',
        text: `เทคนิคปลูกผมของทางเราใช้หัวเจาะขนาดเล็กพิเศษ แผลมีขนาดจิ๋วมาก หายไว ไม่ต้องพักฟื้นยาว วันรุ่งขึ้นสามารถเข้ามาสระผมที่คลินิกและใช้ชีวิตประจำวันได้ตามปกติเลยครับคุณ${name}`
      });
    } else {
      suggestions.push({
        label: '✨ ทักทายพร้อมประเมิน',
        text: `สวัสดีครับคุณ${name} ทีมงาน BEQ Hair Clinic ยินดีให้บริการครับ ไม่ทราบว่าคุณ${name} มีความกังวลเรื่องผมร่วง ผมบาง หรือบริเวณไรผมเว้าด้านหน้า สามารถเล่าให้ฟังเพื่อช่วยแนะนำแนวทางการรักษาได้เลยนะครับ 🙏`
      });
      suggestions.push({
        label: '📋 ส่งข้อมูลโปรแกรม',
        text: `สำหรับปัญหาผม ทางคลินิกเรามีทั้งการปลูกผมถาวร FUE และการฟื้นฟูรากผม PRP / Stem Cell ครับ สะดวกให้เจ้าหน้าที่โทรแจ้งรายละเอียดเพิ่มเติมไหมครับผม?`
      });
    }

    return suggestions;
  }

  // ระบบ AI คาดการณ์โอกาสปิดการขาย (Lead Intent Scoring)
  function predictLeadIntent(lead) {
    const custMsg = (lead.customerMsg || lead.reason || '').toLowerCase();
    if (custMsg.includes('จอง') || custMsg.includes('นัด') || custMsg.includes('เบอร์') || custMsg.includes('โอน') || custMsg.includes('มัดจำ')) {
      return { score: 'HOT 🔥', intent: 'สนใจสูงมาก นัดหมาย/ซื้อ', cls: 'hot' };
    }
    if (custMsg.includes('ราคา') || custMsg.includes('โปร') || custMsg.includes('กราฟ') || custMsg.includes('เท่าไหร่') || custMsg.includes('สนใจ')) {
      return { score: 'WARM ⚡', intent: 'สนใจราคา/โปรโมชั่น', cls: 'warm' };
    }
    return { score: 'COOL 💬', intent: 'สอบถามข้อมูลทั่วไป', cls: 'cool' };
  }

  function analyzeLeadConversation(lead, messages) {
    if (!lead && (!messages || !messages.length)) return null;

    // แยกข้อความจากคนไข้จริง (Customer Text) ออกจากข้อความอัตโนมัติ/พนักงาน
    const cleanCustomerMsgs = (messages || [])
      .filter(m => m.from === 'customer' || m.from === 'user')
      .map(m => m.text || '')
      .filter(t => !t.includes('ตรวจสอบสลิป') && !t.includes('ติดตามเพจของคุณ') && !t.includes('คำสั่งซื้อ') && t.trim() !== ',');

    const staffMsgs = (messages || [])
      .filter(m => m.from === 'staff')
      .map(m => m.text || '');

    // ข้อความรวมที่กรอง system logs ออกแล้ว
    const rawAll = [
      lead?.customerMsg || '',
      lead?.reason || '',
      ...cleanCustomerMsgs,
      ...staffMsgs
    ].join(' ').toLowerCase();

    // ไม่มีข้อความจากลูกค้าจริงเลย → ไม่สรุป (กันการ "เดา" ข้อมูลคนไข้ขึ้นมาเองจากชื่อเพจ)
    if (!cleanCustomerMsgs.some((x) => x.trim().length >= 2)) return null;

    const customerText = cleanCustomerMsgs.join(' ').toLowerCase();
    const staffText = staffMsgs.join(' ').toLowerCase();

    // ข้อมูลบริบทเสริม: เพจ, แคมเปญ, สถานะ
    const pageContext = `${lead?.pageName || ''} ${lead?.ad || ''} ${lead?.channel || ''}`.toLowerCase();
    const isTransplantPage = pageContext.includes('ปลูกผม') || pageContext.includes('dr.nay') || pageContext.includes('hairtransplant');

    let hairIssue = 'ปรึกษาปัญหาผม / วางแผนฟื้นฟูเส้นผม';
    let grafts = '2,000 - 2,500 Grafts';
    let dealEst = 69000;
    let procType = 'FUE Hairline Restoration';
    let stageNote = '';

    // 1. ตรวจจับเคสที่ตกลงปลูกผมเรียบร้อยแล้ว หรือชำระมัดจำแล้ว (Booked / Paid / Pre-op)
    const isPaidOrBooked = rawAll.includes('ใกล้ถึงวันปลูก') || rawAll.includes('คอนเฟิร์มนัด') || rawAll.includes('ชำระเงินแล้ว') || rawAll.includes('สลิป') || rawAll.includes('order as paid') || rawAll.includes('20,000') || lead?.status === 'booked' || lead?.status === 'converted' || lead?.status === 'qual';

    if (isPaidOrBooked && (isTransplantPage || rawAll.includes('ปลูก') || rawAll.includes('กราฟ'))) {
      hairIssue = 'คนไข้วางมัดจำจองคิวปลูกผมถาวรแล้ว (Pre-Op เตรียมผ่าตัด)';
      grafts = '2,000 - 3,000 Grafts (ล็อกคิวห้องผ่าตัด)';
      dealEst = 79000;
      procType = 'FUE Micro-graft Transplant by Dr. Nay';
      stageNote = 'ชำระมัดจำเรียบร้อยแล้ว อยู่ระหว่างรอนัดคอนเฟิร์มวันผ่าตัดปลูกผม';
    }
    // 2. ตรวจจับเคสหน้าผากเว้าตัว M / ไรผมร่น
    else if (rawAll.includes('เว้า') || rawAll.includes('ตัว m') || rawAll.includes('ร่น') || rawAll.includes('ไรผม') || rawAll.includes('ขมับ') || rawAll.includes('ปรับกรอบหน้า')) {
      hairIssue = 'หน้าผากเว้าลึกรูปตัว M / ไรผมร่นสองข้าง';
      grafts = '2,000 - 2,500 Grafts';
      dealEst = 79000;
      procType = 'FUE M-Shape Hairline Restoration';
      stageNote = 'สนใจดึงกรอบหน้าแนวเกาหลี ปรับโครงหน้าให้ดูอ่อนเยาว์';
    }
    // 3. ตรวจจับเคสผมบางกลางศีรษะ / ไข่ดาว
    else if (rawAll.includes('ไข่ดาว') || rawAll.includes('กลางศีรษะ') || rawAll.includes('บางกลาง') || rawAll.includes('ด้านบน') || rawAll.includes('กระหม่อม')) {
      hairIssue = 'ผมบางบริเวณกลางศีรษะ (Crown Thinning)';
      grafts = '2,500 - 3,500 Grafts';
      dealEst = 99000;
      procType = 'FUE + DHI Crown Density Booster';
      stageNote = 'ต้องการเพิ่มความหนาแน่นบริเวณขวัญกลางศีรษะ';
    }
    // 4. ตรวจจับเคสผมร่วงกรรมพันธุ์ / รากผมฝ่อ
    else if (rawAll.includes('ร่วง') || rawAll.includes('บาง') || rawAll.includes('กรรมพันธุ์') || rawAll.includes('ผมร่วงหนัก')) {
      hairIssue = 'ผมร่วงพันธุกรรม / รากผมฝ่อบางระยะเริ่มต้น';
      grafts = '1,500 - 2,000 Grafts หรือ Regenerative PRP';
      dealEst = 59000;
      procType = 'Regenerative Hair PRP & SVF Therapy';
      stageNote = 'แนะนำฟื้นฟูสเต็มเซลล์รากผมและตรวจวิเคราะห์ Trichoscopy';
    }
    // 5. เคสที่สั่งซื้อเฉพาะยา/เซรั่ม/วิตามินเท่านั้น (ต้องไม่ใช่เคสปลูกผม)
    else if (!isTransplantPage && (customerText.includes('สั่งซื้อ') || customerText.includes('ส่งของ') || customerText.includes('แชมพู') || customerText.includes('เซรั่มบำรุง') || customerText.includes('วิตามิน'))) {
      hairIssue = 'สั่งซื้อผลิตภัณฑ์ดูแลเส้นผม / วิตามินบำรุงรากผม';
      grafts = 'Hair Products & Treatment Care';
      dealEst = 3500;
      procType = 'BEQ Scalp Care & Medications';
      stageNote = 'สั่งซื้อชุดผลิตภัณฑ์ดูแลหนังศีรษะ';
    }
    // 6. ค่าเริ่มต้นตามเพจปลูกผม
    else if (isTransplantPage) {
      hairIssue = 'ปรึกษาปลูกผมถาวร FUE / ประเมินแนวไรผม';
      grafts = '1,800 - 2,500 Grafts';
      dealEst = 69000;
      procType = 'FUE Hairline Restoration by Dr. Nay';
      stageNote = 'คนไข้ทักปรึกษาผ่านเพจคุณหมอเนย์ รอประเมินภาพถ่ายศีรษะ';
    }

    // ประเมิน Intent & Sentiment
    let sentiment = { label: 'สอบถามข้อมูลทั่วไป', icon: '💬', cls: 'cool', tip: 'ส่งข้อมูลโปรแกรมการรักษาและเคสรีวิวเปรียบเทียบก่อน-หลังทำ' };
    let prob = '40%';
    let nextStep = 'ส่งภาพเคสรีวิวก่อน-หลังที่ปัญหาใกล้เคียงกัน';

    if (isPaidOrBooked) {
      sentiment = { label: 'ปิดการขายแล้ว (นัดปลูกผม)', icon: '🎉', cls: 'hot', tip: 'คนไข้จองคิวปลูกผมเรียบร้อยแล้ว แนะนำโทรยืนยันนัดหมายและส่งคู่มือการเตรียมตัวก่อนผ่าตัด' };
      prob = '100%';
      nextStep = 'โทรคอนเฟิร์มวันนัดหมายล่วงหน้า 1-2 วัน และส่งข้อปฏิบัติก่อนวันปลูกผม';
    } else if (rawAll.includes('จอง') || rawAll.includes('นัด') || rawAll.includes('โอน') || rawAll.includes('มัดจำ') || rawAll.includes('สะดวก')) {
      sentiment = { label: 'พร้อมนัดหมายตรวจประเมิน', icon: '🎯', cls: 'hot', tip: 'ลูกค้ามีความพร้อมสูง แนะนำเชิญล็อคคิวนัดตรวจประเมินกับแพทย์ที่สาขาสีลม' };
      prob = '85%';
      nextStep = 'ขอชื่อและเบอร์ติดต่อ เพื่อยืนยันล็อกคิวปรึกษาแพทย์เฉพาะทาง';
    } else if (rawAll.includes('ราคา') || rawAll.includes('โปร') || rawAll.includes('กี่บาท') || rawAll.includes('เท่าไหร่') || rawAll.includes('กราฟ')) {
      sentiment = { label: 'สนใจแพ็กเกจและราคา', icon: '⚡', cls: 'warm', tip: 'ส่งเรทราคาประเมินเบื้องต้น พร้อมเสนอสิทธิ์แถมตรวจสแกนรากผมฟรีที่สาขาสีลม' };
      prob = '65%';
      nextStep = 'เสนอโปรโมชั่นพิเศษจำนวนกราฟต์จำกัดเฉพาะเดือนนี้';
    }

    return { hairIssue, sentiment, grafts, dealEst, procType, prob, nextStep, stageNote };
  }


  // เส้นผมแบบนามธรรม ใช้เป็นพื้นหลังของแถบสรุปและหน้าล็อกอิน
  function strandsSvg(count, opacity) {
    let p = '';
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1)) * 1000;
      const sway = 70 + ((i * 53) % 90);
      const dir = i % 2 ? 1 : -1;
      p += `<path d="M${x.toFixed(0)},620 C${(x + dir * sway).toFixed(0)},430 ${(x - dir * sway * 0.6).toFixed(0)},250 ${(x + dir * sway * 0.9).toFixed(0)},-20" />`;
    }
    return `<svg class="strands" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#fff" stroke-opacity="${opacity}" stroke-width="1.4" stroke-linecap="round">${p}</g></svg>`;
  }
  const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  // คำขอดึงข้อมูลจาก Meta ที่ใช้เวลานาน: ให้เซิร์ฟเวอร์ทำเป็นงานเบื้องหลัง แล้วถามความคืบหน้าจนเสร็จ
  const BACKGROUND_PATHS = new Set([
    '/api/import/facebook-conversations',
    '/api/import/facebook-conversations-all',
    '/api/posts-comments/sync',
    '/api/meta/sync-all',
  ]);
  const JOB_PHASE = { starting: 'กำลังเริ่ม', conversations: 'กำลังดึงรายการแชท', messages: 'กำลังดึงข้อความย้อนหลัง', posts: 'กำลังดึงโพสต์และคอมเมนต์' };
  const JOB_ALL = 100000; // ตรงกับ ALL_LIMIT ฝั่งเซิร์ฟเวอร์ = เลือก "ทั้งหมด"

  function jobPanel() {
    let el = document.getElementById('bg-job-panel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bg-job-panel';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;max-width:340px;padding:12px 14px;border-radius:12px;background:#fff;color:#1f2937;box-shadow:0 8px 28px rgba(0,0,0,.18);font-size:13px;line-height:1.45;border:1px solid #e5e7eb';
      document.body.appendChild(el);
    }
    return el;
  }

  async function runBackground(path, opts) {
    const startRes = await fetch(path + '?background=1', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts.body || {}),
    });
    const startJson = await startRes.json().catch(() => ({}));
    if (startRes.status !== 202 || !startJson.jobId) {
      if (startRes.ok) return startJson; // เซิร์ฟเวอร์รุ่นเก่าที่ไม่รองรับงานเบื้องหลัง
      throw new Error(startJson.error || 'เริ่มงานไม่สำเร็จ');
    }
    const id = startJson.jobId;
    const panel = jobPanel();
    let cancelled = false;
    const render = (j) => {
      const p = (j && j.progress) || {};
      const isAll = p.total >= JOB_ALL;
      const pct = p.total && !isAll ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
      panel.innerHTML = `<div style="font-weight:600;margin-bottom:4px">⏳ ${startJson.alreadyRunning ? 'มีงานนี้กำลังทำอยู่แล้ว — ' : ''}กำลังดึงข้อมูลจาก Meta</div>
        <div>${esc(JOB_PHASE[p.phase] || p.phase || '')}${p.total ? ` ${Number(p.done || 0).toLocaleString()}${isAll ? ' รายการ (ดึงทั้งหมด)' : ` / ${Number(p.total).toLocaleString()}`}` : ''}</div>
        ${p.note ? `<div style="color:#6b7280">${esc(p.note)}</div>` : ''}
        <div style="height:6px;background:#eef2f7;border-radius:4px;margin:8px 0;overflow:hidden"><div style="height:100%;width:${isAll ? 100 : pct}%;background:${isAll ? 'repeating-linear-gradient(45deg,#22c55e 0 10px,#86efac 10px 20px)' : '#22c55e'}"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;color:#6b7280;font-size:12px"><span>ปิดหน้านี้ได้ งานจะทำต่อบนเซิร์ฟเวอร์</span>
        <button type="button" id="bg-job-cancel" style="border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:3px 10px;cursor:pointer">${cancelled ? 'กำลังหยุด…' : 'หยุด'}</button></div>`;
      const btn = panel.querySelector('#bg-job-cancel');
      if (btn) btn.onclick = () => { cancelled = true; fetch(`/api/jobs/${id}/cancel`, { method: 'POST', credentials: 'same-origin' }).catch(() => {}); render(j); };
    };
    render(null);
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        let j;
        try {
          const r = await fetch(`/api/jobs/${id}`, { credentials: 'same-origin' });
          if (r.status === 404) throw new Error('งานหายไป (เซิร์ฟเวอร์อาจรีสตาร์ท) กรุณากดดึงข้อมูลใหม่อีกครั้ง');
          if (r.status === 401) throw new Error('กรุณาเข้าสู่ระบบ');
          j = await r.json();
        } catch (e) {
          if (/งานหายไป|เข้าสู่ระบบ/.test(e.message)) throw e;
          continue; // เน็ตสะดุดชั่วคราว ลองถามใหม่รอบหน้า
        }
        if (j.status === 'running') { render(j); continue; }
        if (j.status === 'error' || (j.httpStatus && j.httpStatus >= 400)) throw new Error((j.result && j.result.error) || 'ดึงข้อมูลไม่สำเร็จ');
        return j.result || {};
      }
    } finally {
      panel.remove();
    }
  }

  async function api(path, opts = {}) {
    if (opts.method === 'POST' && BACKGROUND_PATHS.has(path) && !opts.foreground) return runBackground(path, opts);
    try {
      const res = await fetch(path, {
        method: opts.method || 'GET', credentials: 'same-origin',
        headers: opts.body ? { 'Content-Type': 'application/json' } : {},
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      if (res.status === 401 && path !== '/api/login') {
        if (path.startsWith('/api/notifications') || path === '/api/ping') {
          throw new Error('Unauthorized');
        }
        if (path.includes('/api/import/')) {
          throw new Error('การนำเข้าใช้เวลานานเกินกำหนด หรือสิทธิ์การเข้าถึงมีปัญหา กรุณาลองใหม่อีกครั้ง');
        }
        let stillValid = false;
        if (path !== '/api/me') {
          try {
            const checkMe = await fetch('/api/me', { credentials: 'same-origin' });
            if (checkMe.ok) stillValid = true;
          } catch {}
        }
        if (!stillValid) {
          S.me = null;
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('beq_c_/api/me');
          }
          render();
          throw new Error('กรุณาเข้าสู่ระบบ');
        }
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'สิทธิ์การใช้งานไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด');
      // เก็บลงแคชหากเป็น GET สำเร็จ
      if ((!opts.method || opts.method === 'GET') && path !== '/api/me') {
        ClientCache.set(path, json);
      }
      return json;
    } catch (err) {
      if (err.message === 'กรุณาเข้าสู่ระบบ' || path === '/api/me') throw err;
      // Stale-While-Revalidate Fallback: ถ้าเน็ตสะดุดหรือติด Rate limit ดึงแคชเดิมขึ้นมาทำงานต่อทันที
      if (!opts.method || opts.method === 'GET') {
        const cached = ClientCache.get(path);
        if (cached) {
          console.warn('[Cache Fallback] Using offline cached data for:', path);
          showToast('⚡ แสดงผลด้วยข้อมูลแคชล่าสุด (ระบบยังทำงานได้ต่อเนื่อง)', 'warning');
          return cached;
        }
      }
      throw err;
    }
  }

  // Real-time Event Stream (Server-Sent Events) เชื่อมต่อรับข้อความแชทและแจ้งเตือนอัตโนมัติ
  let realtimeSource = null;
  let realtimeEverDropped = false;
  // ย้ายการ์ดในข้อมูล Board ที่โหลดไว้ไปคอลัมน์ใหม่ (ไม่ต้องโหลดทั้งหน้าใหม่)
  function moveBoardCard(id, status) {
    const bd = S.board && S.board.data;
    if (!bd || !Array.isArray(bd.columns)) return;
    let card = null;
    for (const col of bd.columns) {
      const i = (col.cards || []).findIndex((c) => c.id === id);
      if (i >= 0) { card = col.cards.splice(i, 1)[0]; col.total = Math.max(0, (col.total || 1) - 1); break; }
    }
    if (!card) { if (S.route === 'board') scheduleLiveRefresh(300); return; }
    card.status = status;
    const target = bd.columns.find((c) => c.status === status);
    if (target) { target.cards = [card, ...(target.cards || [])]; target.total = (target.total || 0) + 1; }
    if (S.route === 'board') renderBoardBody();
  }
  let liveRefreshTimer = null;
  // โหลดข้อมูลของหน้าที่เปิดอยู่ใหม่แบบเงียบ ๆ (รวมหลายเหตุการณ์ที่มาติด ๆ กันเป็นครั้งเดียว)
  function scheduleLiveRefresh(delay = 3000) {
    clearTimeout(liveRefreshTimer);
    liveRefreshTimer = setTimeout(refreshCurrentView, delay);
  }
  async function refreshCurrentView() {
    if (!S.me || document.visibilityState !== 'visible') return;
    if (S.importModal || S.postsModal) return; // ไม่รบกวนตอนเปิดหน้าต่างอยู่
    try {
      if (S.route === 'dashboard' && S.dash && S.dash.data && !S.dash.loading) {
        const seq = ++reqSeq;
        const data = await api('/api/dashboard?' + dashQuery());
        if (seq === reqSeq && S.route === 'dashboard') { S.dash.data = data; S.dash.updatedAt = Date.now(); renderDashBody(); }
      } else if (S.route === 'inbox') await loadInbox();
      else if (S.route === 'board') await loadBoard();
      else if (S.route === 'followup') await loadFollowups();
      else if (S.route === 'review') await loadReview();
      else if (S.route === 'post-comment') await loadComments();
    } catch (_) { /* ครั้งหน้าค่อยลองใหม่ */ }
  }
  // ตัวเลขโฆษณาจาก Meta: โหลดใหม่ทุก 5 นาทีเมื่อเปิดหน้า Dashboard ค้างไว้
  setInterval(() => { if (S.route === 'dashboard') refreshCurrentView(); }, 5 * 60 * 1000);

  function connectRealtime() {
    if (!S.me) return;
    if (realtimeSource) {
      try { realtimeSource.close(); } catch (_) {}
      realtimeSource = null;
    }
    try {
      realtimeSource = new EventSource('/api/inbox/events');
      // ต่อใหม่สำเร็จหลังหลุด → โหลดข้อมูลหน้าปัจจุบันใหม่ เผื่อมีแชท/คอมเมนต์เข้ามาระหว่างหลุด
      realtimeSource.addEventListener('open', () => {
        if (realtimeEverDropped) { realtimeEverDropped = false; scheduleLiveRefresh(500); }
      });
      // มีคนเปลี่ยนสถานะ/เซลล์ของลีด (จากเครื่องไหนก็ได้) → Inbox, แชทที่เปิดอยู่ และ Board อัปเดตตามทันที
      realtimeSource.addEventListener('lead_status', (e) => {
        try {
          const { id, status } = JSON.parse(e.data);
          const row = S.inbox && S.inbox.data && S.inbox.data.rows.find((x) => x.id === id);
          if (row) row.status = status;
          if (S.chat && S.chat.id === id && S.chat.data && S.chat.data.lead) { S.chat.data.lead.status = status; renderChatViews(); }
          moveBoardCard(id, status);
          if (S.route === 'inbox') { renderInboxTools(); renderInboxList(); }
          if (['dashboard', 'followup', 'review'].includes(S.route)) scheduleLiveRefresh(2000);
        } catch (_) {}
      });
      realtimeSource.addEventListener('lead_rep', (e) => {
        try {
          const { id, rep } = JSON.parse(e.data);
          const row = S.inbox && S.inbox.data && S.inbox.data.rows.find((x) => x.id === id);
          if (row) { row.rep = rep; row.repId = rep; }
          if (S.chat && S.chat.id === id && S.chat.data && S.chat.data.lead) { S.chat.data.lead.rep = rep; S.chat.data.lead.repId = rep; renderChatViews(); }
          if (S.route === 'inbox') renderInboxList();
          if (S.route === 'board') scheduleLiveRefresh(500);
        } catch (_) {}
      });
      // เซิร์ฟเวอร์ดึงตัวเลขโฆษณาใหม่จาก Meta เสร็จ → หน้า Dashboard โหลดตัวเลขล่าสุด
      realtimeSource.addEventListener('ads_updated', () => { if (S.route === 'dashboard') scheduleLiveRefresh(300); });
      // คอมเมนต์ใหม่บนโพสต์ FB/IG
      realtimeSource.addEventListener('post_comment', (e) => {
        try {
          const p = JSON.parse(e.data);
          if (p && p.comment && !p.comment.isStaff) showToast(`💬 คอมเมนต์ใหม่ (${p.platform}): ${String(p.comment.text || '').slice(0, 60)}`, 'success');
        } catch (_) {}
        if (S.route === 'post-comment') scheduleLiveRefresh(1500);
      });
      realtimeSource.addEventListener('chat_message', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { leadId, message } = payload;
          // ถ้ากำลังเปิดห้องแชทนี้อยู่ ให้เพิ่มข้อความลงในห้องแชททันที
          if (S.chat && S.chat.id === leadId && S.chat.data && Array.isArray(S.chat.data.messages)) {
            const alreadyHas = S.chat.data.messages.some(m => (m.mid && m.mid === message.mid) || (m.at === message.at && m.text === message.text));
            if (!alreadyHas) {
              S.chat.data.messages.push(message);
              renderChatViews();
            }
          }
          // อัปเดตรายการใน Inbox
          if (S.inbox && S.inbox.data && Array.isArray(S.inbox.data.rows)) {
            const row = S.inbox.data.rows.find(r => r.id === leadId);
            if (row) {
              row.last = message;
              S.inbox.data.rows.sort((a, b) => {
                const x = a.last ? a.last.at : a.date;
                const y = b.last ? b.last.at : b.date;
                return x === y ? 0 : x < y ? 1 : -1;
              });
              if (S.route === 'inbox') renderInboxList();
            } else {
              // เป็นลูกค้าใหม่ที่เพิ่งทักมา ให้รีเฟรช Inbox ทันที
              loadInbox();
            }
          }
          updateGlobalUnrepliedBadges();
          // หน้าอื่นที่ใช้ตัวเลขแชท (Dashboard / Board / Follow-up / SLA) อัปเดตตามแบบหน่วงสั้น ๆ
          if (['dashboard', 'board', 'followup', 'review'].includes(S.route)) scheduleLiveRefresh(4000);
        } catch (err) {
          console.warn('[Realtime Parse Error]:', err);
        }
      });
      realtimeSource.onerror = () => {
        realtimeEverDropped = true;
        // ลองเชื่อมต่อใหม่เมื่อหลุด
        if (realtimeSource) {
          try { realtimeSource.close(); } catch (_) {}
          realtimeSource = null;
        }
        setTimeout(connectRealtime, 8000);
      };
    } catch (_) {}
  }

  // Keep-alive heartbeat: ป้องกันเซิร์ฟเวอร์ Sleep และรักษาสถานะเชื่อมต่อทุกๆ 2.5 นาที (150,000ms)
  let lastHeartbeat = Date.now();
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetch('/api/ping', { credentials: 'same-origin', cache: 'no-store' })
        .then(() => { lastHeartbeat = Date.now(); })
        .catch(() => {});
    }
  }, 150000);

  // ตรวจจับเมื่อผู้ใช้สลับแท็บกลับมาทำงาน (Visibility Change) ถ้าหลับไปนาน ให้ ping ปลุกเซิร์ฟเวอร์ทันที
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastHeartbeat > 180000) {
        fetch('/api/ping', { credentials: 'same-origin', cache: 'no-store' }).catch(() => {});
        lastHeartbeat = Date.now();
      }
    }
  });

  // Global Error Boundary & Crash Protection: ป้องกัน uncaught error ทำให้ UI ค้าง
  window.addEventListener('error', (e) => {
    console.error('[BEQ Global Error Protection]:', e.error || e.message);
    // ไม่บล็อกการทำงาน ป้องกันหน้าจอขาว (White screen of death)
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[BEQ Unhandled Promise Warning]:', e.reason);
  });

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K สำหรับ Command Palette)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      S.cmdPaletteOpen = !S.cmdPaletteOpen;
      render();
      if (S.cmdPaletteOpen) {
        setTimeout(() => {
          const inp = document.getElementById('cmd-palette-input');
          if (inp) inp.focus();
        }, 50);
      }
    } else if (e.key === 'Escape' && S.cmdPaletteOpen) {
      S.cmdPaletteOpen = false;
      render();
    }
  });

  /* ---------------- routing ---------------- */
  const ROUTES = ['dashboard', 'inbox', 'board', 'post-comment', 'followup', 'review', 'audit', 'upload', 'quality', 'setting'];
  function routeFromHash() {
    const r = location.hash.replace(/^#\/?/, '');
    return ROUTES.includes(r) ? r : 'dashboard';
  }
  window.addEventListener('hashchange', () => { S.route = routeFromHash(); S.menu = null; S.flash = null; S.chat.id = null; S.mobileNav = false; document.body.classList.remove('m-chat-open'); enterRoute(); });

  function enterRoute() {
    render();
    if (!S.me) return;
    connectRealtime();
    if (S.route === 'dashboard') loadDash();
    if (S.route === 'inbox') loadInbox();
    if (S.route === 'board') loadBoard();
    if (S.route === 'followup') loadFollowups();
    if (S.route === 'review') loadReview();
    if (S.route === 'audit') loadAudit();
    if (S.route === 'setting') loadSettings();
    if (S.route === 'upload') loadUpload();
    if (S.route === 'quality') loadQuality();
    if (S.route === 'post-comment') loadComments();
  }

  /* ---------------- shell ---------------- */
  async function loadWebNotifications() {
    try {
      const res = await api('/api/notifications');
      if (res) {
        S.notifications = {
          data: res,
          counts: res.counts || {},
          unread: (res.counts && res.counts.unreadWeb) || 0,
          list: res.webNotifications || [],
        };
      }
    } catch (_) {}
  }

  function notices() {
    const list = [];
    if (S.me && S.me.mode === 'demo') list.push({ text: 'กำลังแสดงข้อมูลเดโม — เชื่อม Meta ได้ที่เมนู Setting', type: 'info' });
    if (S.me && S.me.mustChange) list.push({ text: 'บัญชีนี้ใช้รหัสผ่านชั่วคราวอยู่ กรุณาตั้งรหัสผ่านใหม่ที่เมนู Setting', type: 'warn' });
    if (S.notifications && S.notifications.list) {
      for (const n of S.notifications.list) {
        list.push({
          id: n.id,
          text: `📢 ${n.title}: ${n.message}`,
          leadId: n.leadId,
          read: n.read,
          at: n.at,
          type: 'alert'
        });
      }
    }
    return list;
  }


  function isValidPage(p) {
    if (!p || !p.id || !p.name) return false;
    const name = String(p.name).trim();
    if (name.startsWith('PAGE-')) return false;
    if (/^page\s*\d+$/i.test(name)) return false;
    if (/^\d{6,}$/.test(name)) return false;
    if (name.includes('เพจหลัก')) return false;
    if (p.id.includes('เพจหลัก')) return false;
    if (/channel/i.test(name)) return false;
    if (/channel/i.test(String(p.id))) return false;
    if (p.id === '1040829309417229') return false;
    return true;
  }

  // คำนวณจำนวนแชทที่ยังรอการตอบกลับ (Unreplied) ให้ตรงกันทุกจุดทั้งระบบ 100%
  // แชทที่ "รอเราตอบ" = ข้อความล่าสุดมาจากลูกค้า (ไม่นับลีดที่ไม่มีข้อความ และไม่นับสถานะ "ไม่ตอบ"
  // ซึ่งหมายถึงลูกค้าเงียบไป ไม่ใช่เรายังไม่ตอบ)
  // รายชื่อเซลล์จากข้อมูลจริงในระบบ (ผู้ใช้ + เซลล์ในลีด + ชื่อในแชท) — เซิร์ฟเวอร์รวมมาให้ใน /api/filters
  function repNameList(extra) {
    const names = new Set(((S.filters && S.filters.reps) || []).map((r) => (r && (r.name || r.id)) || r).filter(Boolean));
    if (extra) names.add(extra);
    return [...names].sort((a, b) => String(a).localeCompare(String(b), 'th'));
  }

  // ชื่อนี้เป็นชื่อคนจริงไหม (ไม่ใช่ชื่อเพจ/ธุรกิจ) — ใช้ซ่อนค่าเซลล์ที่เป็นชื่อเพจ
  function isPersonName(n) {
    const s = String(n || '').trim();
    if (!s || /^(unassigned|—|-|admin|staff)$/i.test(s)) return false;
    if (/clinic|center|centre|hair|transplant|wellness|academy|official|คลินิก|ปลูกผม/i.test(s)) return false;
    const pages = ((S.filters && S.filters.pages) || []).map((p) => String(p.name || '').toLowerCase());
    return !pages.includes(s.toLowerCase());
  }

  function needsReply(r) {
    return Boolean(r && r.last && r.last.from === 'customer');
  }

  function getUnrepliedCount() {
    if (S.inbox && S.inbox.data && Array.isArray(S.inbox.data.rows)) {
      return S.inbox.data.rows.filter(needsReply).length;
    }
    return 0;
  }

  // อัปเดตตัวเลขแชทที่รอตอบ (Unreplied Badge) บนแถบหัวเว็บและเมนูด้านข้างให้ซิงก์ตรงกันแบบ Real-time เสมอ
  function updateGlobalUnrepliedBadges() {
    const count = getUnrepliedCount();
    // 1. อัปเดตที่แคปซูลหัวเว็บ (⚡ รอแชท: X)
    const headerCapsule = document.querySelector('.header-quick-kpis a[href="#/inbox"]');
    if (headerCapsule) {
      if (count > 0) {
        headerCapsule.classList.add('alert');
      } else {
        headerCapsule.classList.remove('alert');
      }
      const bEl = headerCapsule.querySelector('b');
      if (bEl) bEl.textContent = count;
    }
    // 2. อัปเดตที่เมนู Inbox ด้านซ้าย (Sidebar Badge)
    let sidebarInboxBadge = document.querySelector('.nav-link[data-nav="inbox"] .nav-count-badge.unreplied, a[href="#/inbox"] .nav-count-badge.unreplied');
    if (!sidebarInboxBadge && count > 0) {
      // ตอนวาดเมนูครั้งแรกยังไม่มีข้อมูล Inbox → สร้างป้ายตัวเลขเพิ่มเมื่อโหลดเสร็จ
      const holder = document.querySelector('.app-sidebar a[href="#/inbox"] .nav-label') || document.querySelector('.app-sidebar a[href="#/inbox"]');
      if (holder) { sidebarInboxBadge = document.createElement('span'); sidebarInboxBadge.className = 'nav-count-badge unreplied'; holder.appendChild(document.createTextNode(' ')); holder.appendChild(sidebarInboxBadge); }
    }
    if (sidebarInboxBadge) {
      sidebarInboxBadge.textContent = count;
      sidebarInboxBadge.style.display = count > 0 ? '' : 'none';
    }
  }

  function sidebarHtml() {
    const isCollapsed = S.sidebarCollapsed && !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 860px)').matches);
    const unrepliedCount = getUnrepliedCount();
    const overdueCount = (S.notifications && S.notifications.counts && S.notifications.counts.overdue) || 0;

    const navCore = [
      ['dashboard', 'Dashboard', 'grid', 'ภาพรวมผลลัพธ์โฆษณา & KPIs', '#059669'],
      ['inbox', `Inbox${unrepliedCount ? ` <span class="nav-count-badge unreplied">${unrepliedCount}</span>` : ''}`, 'chat', 'Unified Omnichannel Inbox', '#10b981'],
      ['board', 'Leads Board', 'bars', 'กระดานสถานะลูกค้า 9 ขั้น', '#0d9488'],
      ['review', 'SLA & Review', 'check', 'SLA 15m & Quality Scorecard', '#059669'],
      ['followup', `Follow-up${overdueCount ? ` <span class="nav-count-badge overdue">${overdueCount}</span>` : ''}`, 'clock', 'Customer Follow-ups', '#16a34a'],
    ];

    const navOps = [
      ['quality', 'Quality Analysis', 'spark', 'Ad & Lead Quality Insights', '#047857'],
      ['post-comment', 'Posts & Comments', 'chat', 'Comments & Comment SLA', '#0d9488'],
      ['upload', 'Upload Data', 'upload', 'CSV Data Import & Management', '#10b981'],
      ['audit', 'Audit Log', 'list', 'System Security Audit Trail', '#475569'],
      ['setting', 'Settings', 'gear', 'System Configuration', '#065f46'],
    ];

    const curAiMode = S.aiMode || 'copilot';

    return `<aside class="app-sidebar ${isCollapsed ? 'collapsed' : ''}">
      <div class="sidebar-brand">
        <div class="brand-logo-wrap" data-act="toggle-sidebar" title="BEQ GROUP (คลิกเพื่อย่อ/ขยายเมนู)" style="cursor:pointer">
          <img class="brand-mark" src="/logo-mark.png" alt="BEQ Group" width="24" height="24">
        </div>
        <div class="brand-text">
          <b>BEQ GROUP</b>
          <small>Hair Wellness & Clinic Suite</small>
        </div>
        <button type="button" class="sidebar-toggle-btn" data-act="toggle-sidebar" title="${isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}" aria-label="Toggle Sidebar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${isCollapsed ? '<polyline points="9 18 15 12 9 6"></polyline>' : '<polyline points="15 18 9 12 15 6"></polyline>'}
          </svg>
        </button>
      </div>

      <div class="sidebar-branch-box">
        <div class="branch-pill" title="สาขา / คลินิก">
          <span class="branch-icon">🏥</span>
          <span class="branch-badge">HQ</span>
          <select data-bind="branch-select" aria-label="สาขา">
            <option value="BEQ Hair Clinic Silom" selected>BEQ Hair Clinic (สีลม)</option>
          </select>
        </div>
      </div>

      <div class="sidebar-scroll">
        <div class="sidebar-section-title">งานหลัก</div>
        <nav class="sidebar-nav">
          ${navCore.map(([id, label, ic, title, color]) => `
            <a href="#/${id}" class="sidebar-nav-item ${S.route === id ? 'active' : ''}" title="${esc(title)}" style="--item-color:${color}">
              <span class="nav-icon-box">${icon(ic)}</span>
              <span class="nav-label">${label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-section-title" style="margin-top:16px">วิเคราะห์ & จัดการ</div>
        <nav class="sidebar-nav">
          ${navOps.map(([id, label, ic, title, color]) => `
            <a href="#/${id}" class="sidebar-nav-item ${S.route === id ? 'active' : ''}" title="${esc(title)}" style="--item-color:${color}">
              <span class="nav-icon-box">${icon(ic)}</span>
              <span class="nav-label">${label}</span>
            </a>
          `).join('')}
        </nav>
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-ai-box">
          <div class="ai-box-title">
            <span class="beq-iridescent-orb sm"></span>
            <span>BEQ COPILOT AI</span>
          </div>
          <div class="ai-mode-switch">
            <button type="button" class="ai-mode-btn ${curAiMode === 'off' ? 'active' : ''}" data-act="set-ai-mode" data-mode="off">Off</button>
            <button type="button" class="ai-mode-btn copilot ${curAiMode === 'copilot' ? 'active' : ''}" data-act="set-ai-mode" data-mode="copilot">Copilot</button>
            <button type="button" class="ai-mode-btn autopilot ${curAiMode === 'autopilot' ? 'active' : ''}" data-act="set-ai-mode" data-mode="autopilot">⚡ Auto</button>
          </div>
        </div>

        <div class="sidebar-user-card rel">
          <button type="button" class="sidebar-user-btn" data-act="menu" data-menu="user" title="เมนูบัญชีผู้ใช้">
            <span class="avatar">${esc((S.me.username || 'A')[0].toUpperCase())}</span>
            <div class="user-meta">
              <span class="user-name">${esc(S.me.username)}</span>
              <span class="user-role">${S.me.role === 'admin' ? 'ADMINISTRATOR' : 'STAFF'}</span>
            </div>
            <span class="chevron">▴</span>
          </button>
          <button type="button" class="sidebar-logout-btn" data-act="logout" title="ออกจากระบบ (Log out)" aria-label="Log out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
          ${S.menu === 'user' ? `<div class="popover popover-up">
            <div class="item" style="display:block;font-weight:700;color:var(--primary);border-bottom:1px solid var(--line-soft);margin-bottom:4px;padding-bottom:8px">🏥 ${esc(S.me.clinicName || 'BEQ Hair Wellness')}</div>
            <button type="button" data-act="goto" data-to="setting">⚙️ ตั้งค่าระบบ (Settings)</button>
            <button type="button" class="popover-logout-item" data-act="logout">🚪 ออกจากระบบ (Log out)</button>
          </div>` : ''}
        </div>
      </div>
    </aside>`;
  }

  function appHeaderHtml() {
    const platforms = (S.filters && S.filters.platforms) || ['Facebook', 'LINE', 'WhatsApp', 'Instagram'];
    const rawAllPages = (S.filters && S.filters.pages) || [];
    const allPages = rawAllPages.filter(isValidPage);
    const curPlatform = S.dash.platform || '';
    const filteredPages = curPlatform ? allPages.filter((p) => !p.platform || p.platform.toLowerCase() === curPlatform.toLowerCase()) : allPages;
    const list = notices();

    const titles = {
      dashboard: ['📊 Dashboard', 'ภาพรวมผลตอบแทนโฆษณา & Marketing KPIs'],
      inbox: ['Inbox', 'รวมศูนย์แชท Facebook, Instagram, LINE, WhatsApp'],
      board: ['📋 Leads Board', 'กระดานติดตามความคืบหน้าลีด 12 ลำดับขั้น'],
      review: ['⏱️ SLA & Chat Quality', 'สถิติการตอบแชทตามเกณฑ์ 15 นาที & คะแนนความเร็ว'],
      followup: ['📅 Follow-up Management', 'การนัดหมายและติดตามผลลูกค้า'],
      quality: ['✨ Quality Analysis', 'วิเคราะห์คุณภาพโฆษณาและอัตรา Conversion'],
      'post-comment': ['💬 Posts & Comments', 'จัดการคอมเมนต์ใต้โพสต์และ SLA คอมเมนต์'],
      upload: ['☁️ Upload & Data', 'นำเข้าข้อมูล Leads & Campaigns ด้วย CSV'],
      audit: ['📜 Audit Trail', 'ประวัติการใช้งานและบันทึกกิจกรรมความปลอดภัย'],
      setting: ['⚙️ Settings', 'การตั้งค่าระบบ, API Tokens และผู้ใช้งาน']
    };

    const [pageTitle, pageSub] = titles[S.route] || [S.route, ''];

    const unrepliedCount = getUnrepliedCount();
    const fuCount = (S.followup && S.followup.data && S.followup.data.stats && (S.followup.data.stats.reply + S.followup.data.stats.due)) || 0;

    return `<header class="app-header">
      <div class="header-left-group">
        <button type="button" class="header-toggle-btn" data-act="toggle-sidebar" title="${S.sidebarCollapsed ? 'ขยายเมนูด้านซ้าย' : 'ย่อเมนูด้านซ้าย'}" aria-label="Toggle Sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div class="header-title-box">
          <h1 class="header-page-title">${pageTitle}</h1>
        </div>
      </div>

      <div class="header-actions">
        <div class="header-live-badge" title="ระบบเชื่อมต่อ Meta & ตอบแชทแบบเรียลไทม์">
          <span class="live-pulse-dot"></span>
          <span>LIVE SYNC</span>
        </div>

        <div class="header-quick-kpis">
          <a href="#/inbox" class="kpi-capsule ${unrepliedCount > 0 ? 'alert' : ''}" title="แชทที่ยังรอตอบกลับ">
            <span>⚡ รอแชท:</span> <b>${unrepliedCount}</b>
          </a>
          <a href="#/followup" class="kpi-capsule" title="เคสที่ต้องตาม / วันนี้">
            <span>📅 ต้องตาม:</span> <b>${fuCount}</b>
          </a>
        </div>

        <button type="button" class="btn btn-secondary" data-act="open-cmd" style="height:34px;padding:0 12px;border-radius:10px;font-size:12.5px;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;display:inline-flex;align-items:center;">
          ${icon('search')}
          <span class="cmd-label">ค้นหา...</span>
          <kbd style="background:#e2e8f0;color:#64748b;padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700">Ctrl K</kbd>
        </button>
        <div class="header-selectors">
          <div class="pill-select"><select data-bind="header-platform" aria-label="แพลตฟอร์ม">
            <option value="">🌐 ทุกแพลตฟอร์ม</option>
            ${platforms.map((p) => `<option value="${esc(p)}" ${curPlatform.toLowerCase() === p.toLowerCase() ? 'selected' : ''}>${p === "Facebook" ? "🔵 " : p === "Instagram" ? "📸 " : p === "LINE" ? "🟢 " : p === "WhatsApp" ? "💚 " : ""}${esc(p)}</option>`).join('')}
          </select></div>
          <div class="pill-select"><select data-bind="header-page" aria-label="เลือกเพจ">
            <option value="">${curPlatform ? `📄 ทุกเพจ (${esc(curPlatform)})` : '📄 ทุกเพจ / บัญชี'}</option>
            ${filteredPages.map((p) => `<option value="${esc(p.id)}" ${S.dash.page === p.id ? "selected" : ""}>${p.platform === "Facebook" ? "🔵 " : p.platform === "Instagram" ? "📸 " : p.platform === "LINE" ? "🟢 " : p.platform === "WhatsApp" ? "💚 " : ""}${esc(p.name)}</option>`).join("")}
          </select></div>
        </div>

        <div class="rel">
          <button type="button" class="icon-btn header-icon-btn" data-act="menu" data-menu="bell" aria-label="Notifications">
            ${icon('bell')}
            ${list.length ? `<span class="dot count-dot" style="${S.notifications?.unread ? 'background:#ef4444' : ''}">${list.length > 9 ? '9+' : list.length}</span>` : ''}
          </button>
          ${S.menu === 'bell' ? `<div class="popover" style="min-width:330px;max-width:390px;right:-10px">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #f1f5f9">
              <span style="font-weight:700;font-size:13px;color:#0f172a">🔔 ศูนย์แจ้งเตือนในระบบ (${list.length})</span>
              <div style="display:flex;gap:6px;align-items:center">
                ${S.notifications?.list?.length ? `
                  <button type="button" data-act="mark-all-notifs" style="width:auto;padding:2px 8px;font-size:11px;color:#059669;background:#ecfdf5;border-radius:6px;font-weight:600">อ่านทั้งหมด</button>
                  <button type="button" data-act="delete-all-notifs" title="ลบการแจ้งเตือนทั้งหมด" style="width:auto;padding:2px 8px;font-size:11px;color:#ef4444;background:#fef2f2;border-radius:6px;font-weight:600">ลบทั้งหมด</button>
                ` : ''}
              </div>
            </div>
            <div style="max-height:360px;overflow-y:auto;padding:4px 0">
              ${list.length ? list.map((t) => typeof t === 'string' ? `<div class="item">${esc(t)}</div>` : `
                <div class="item notif-item ${t.read ? 'read' : 'unread'}" style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 14px;border-bottom:1px solid #f8fafc;${!t.read ? 'background:#f0fdf4' : ''};gap:8px">
                  <div style="flex:1;cursor:${t.leadId ? 'pointer' : 'default'}" data-act="${t.leadId ? 'open-chat' : 'noop'}" data-id="${esc(t.leadId || '')}">
                    <div style="font-size:12.5px;color:#0f172a;line-height:1.45;font-weight:${t.read ? '500' : '700'}">${esc(t.text)}</div>
                    ${t.at ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">${ago(t.at)}ที่แล้ว ${t.leadId ? '· <span style="color:#059669;font-weight:600">คลิกเปิดแชท</span>' : ''}</div>` : ''}
                  </div>
                  ${t.id ? `
                    <button type="button" class="notif-del-btn" data-act="delete-one-notif" data-id="${esc(t.id)}" title="ลบการแจ้งเตือนนี้" style="width:auto;padding:3px 6px;color:#94a3b8;background:transparent;border:0;cursor:pointer;border-radius:4px;font-size:13px;line-height:1" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                      ✕
                    </button>
                  ` : ''}
                </div>
              `).join('') : '<div class="item" style="padding:16px;text-align:center;color:#94a3b8">ไม่มีการแจ้งเตือนใหม่</div>'}
            </div>
          </div>` : ''}
        </div>

        <button type="button" class="header-logout-btn" data-act="logout" title="ออกจากระบบ (Log out)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </header>`;
  }

  function commandPaletteHtml() {
    if (!S.cmdPaletteOpen) return '';
    const q = (S.cmdSearch || '').trim().toLowerCase();
    
    // Quick navigation list
    const navItems = [
      { type: 'nav', title: '📊 Dashboard', sub: 'ภาพรวมผลลัพธ์โฆษณา & ROAS', to: 'dashboard' },
      { type: 'nav', title: '💬 Unified Inbox', sub: 'แชท Facebook, Instagram, LINE, WhatsApp', to: 'inbox' },
      { type: 'nav', title: '📋 Leads Board', sub: 'กระดานสถานะลูกค้า 9 ขั้น', to: 'board' },
      { type: 'nav', title: '⏱️ SLA & Chat Quality', sub: 'คะแนนการตอบกลับ & SLA 15 นาที', to: 'review' },
      { type: 'nav', title: '📅 Follow-up Leads', sub: 'ระบบนัดหมายและเตือนติดตามผล', to: 'followup' },
      { type: 'nav', title: '💬 Posts & Comments', sub: 'คอมเมนต์ใต้โพสต์โฆษณา', to: 'post-comment' },
      { type: 'nav', title: '⚙️ Settings', sub: 'ตั้งค่า API Tokens, เพจ, ผู้ใช้งาน', to: 'setting' },
    ];

    // Customer Leads list from Inbox or Board data
    const leads = (S.inbox?.data?.rows || S.board?.data?.leads || []).slice(0, 40);
    const leadItems = leads.map(l => ({
      type: 'lead',
      title: `👤 ${l.name || 'ลูกค้า'}`,
      sub: `${l.platform || 'Facebook'} · ${STATUS_TH[l.status] || l.status || 'ใหม่'} · ${l.phone || l.customerMsg || ''}`.slice(0, 60),
      chatId: l.id
    }));

    const all = [...navItems, ...leadItems];
    const filtered = q ? all.filter(it => it.title.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)) : all.slice(0, 10);

    return `<div class="cmd-palette-backdrop" data-act="close-cmd">
      <div class="cmd-palette-box" onclick="event.stopPropagation()">
        <div class="cmd-search-input-wrap">
          ${icon('search')}
          <input type="text" id="cmd-palette-input" class="cmd-search-input" placeholder="พิมพ์ชื่อลูกค้า, หน้าเมนู, หรือสถานะ..." value="${esc(S.cmdSearch)}" data-bind="cmd-search">
          <span class="cmd-badge">ESC เพื่อปิด</span>
        </div>
        <div class="cmd-results">
          ${filtered.length ? filtered.map(it => `
            <div class="cmd-item" data-act="cmd-select" ${it.to ? `data-to="${it.to}"` : ''} ${it.chatId ? `data-chat-id="${it.chatId}"` : ''}>
              <div class="cmd-item-left">
                <div>
                  <div class="cmd-item-title">${esc(it.title)}</div>
                  <div class="cmd-item-sub">${esc(it.sub)}</div>
                </div>
              </div>
              <span class="badge" style="font-size:11px;background:#f1f5f9;color:#64748b">${it.type === 'nav' ? 'เมนู' : 'แชท'}</span>
            </div>
          `).join('') : '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px">ไม่พบข้อมูลที่ค้นหา</div>'}
        </div>
      </div>
    </div>`;
  }

  function formatGhostText(txt) {
    if (!txt) return '';
    let s = String(txt);
    // แปลงแท็ก b, strong, span หรือแท็กที่มีสไตล์สี ให้กลายเป็น markdown bold
    s = s.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
         .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
         .replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, '$1')
         .replace(/<[^>]+>/g, '') // กวาดล้างแท็ก HTML อื่นๆ ทั้งหมด
         .replace(/&lt;b\b.*?&gt;([\s\S]*?)&lt;\/b&gt;/gi, '**$1**')
         .replace(/&lt;strong\b.*?&gt;([\s\S]*?)&lt;\/strong&gt;/gi, '**$1**')
         .replace(/&lt;span\b.*?&gt;([\s\S]*?)&lt;\/span&gt;/gi, '$1')
         .replace(/&lt;[^&gt;]+&gt;/gi, '') // กวาดล้าง HTML entity tags
         .replace(/&quot;/g, '"')
         .replace(/&amp;/g, '&');
    let html = esc(s);
    html = html.replace(/\*\*(.+?)\*\*/g, '<b style="color:#0f172a;font-weight:700">$1</b>');
    html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
    html = html.replace(/^([0-9]+)\.\s+(.+)$/gm, '<div style="margin-left:4px;margin-bottom:4px"><span style="color:#059669;font-weight:700">$1.</span> $2</div>');
    html = html.replace(/^[•\-]\s+(.+)$/gm, '<li style="margin-left:14px;list-style-type:disc;margin-bottom:3px">$1</li>');
    html = html.replace(/\n\n+/g, '<div style="height:8px"></div>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function floatingGhostHtml() {
    if (!S.me) return '';
    const unreadPill = !S.ghostOpen ? '<span class="ghost-badge">AI</span>' : '';
    const activeRangeMap = { '7d': '7 วัน', '30d': '30 วัน', '90d': '90 วัน', 'all': 'ทั้งหมด', 'custom': 'กำหนดเอง' };
    const curRText = activeRangeMap[S.dash.range] || (S.dash.range || '30 วัน');
    
    let chatModal = '';
    if (S.ghostOpen) {
      chatModal = `
        <div class="ghost-chat-modal" onclick="event.stopPropagation()">
          <div class="ghost-chat-header">
            <div class="ghost-chat-header-info">
              ${ghostSvg(32)}
              <div>
                <div class="ghost-chat-title">น้อง AI (เด็กน้อยผู้ช่วยประจำคลินิก) 👦🏻</div>
                <div style="font-size:10.5px;color:${S.ghostSmart === false ? '#b45309' : '#059669'};font-weight:600">${S.ghostSmart === false ? 'โหมดพื้นฐาน (ยังไม่ได้เชื่อม Claude)' : 'ตอบจากข้อมูลจริงในระบบ'}</div>
                <div class="ghost-chat-subtitle">ผู้ช่วยถาม-ตอบ & สรุปทุกข้อมูลแทนการดูเว็บครับผม ✨</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button type="button" class="ghost-clear-btn" data-act="ghost-clear" title="ล้างข้อความแชท">🗑️</button>
              <button type="button" class="ghost-close-btn" data-act="toggle-ghost" aria-label="Close">✕</button>
            </div>
          </div>
          <div class="ghost-chat-body" id="ghost-scroll">
            ${S.ghostMsgs && S.ghostMsgs.length ? S.ghostMsgs.map(m => `
              <div class="ghost-msg ${m.from}">
                ${m.from === 'ai' ? ghostSvg(26) : ''}
                <div class="ghost-msg-bubble" style="line-height:1.6">${formatGhostText(m.text)}</div>
              </div>
            `).join('') : `
              <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:24px 16px;color:#64748b">
                <div style="filter:drop-shadow(0 8px 16px rgba(16,185,129,0.2));margin-bottom:12px;animation:ghostFloat 3s ease-in-out infinite">
                  ${ghostSvg(72)}
                </div>
                <div style="font-weight:700;color:#0f172a;font-size:14px;margin-bottom:4px">ไม่มีข้อความคงค้างครับผม</div>
                <div style="font-size:12px;color:#64748b;max-width:220px;line-height:1.5">ประวัติแชทว่างเปล่าแล้วครับ พี่ๆ อยากรู้ยอดแอด แชท หรือคะแนนเซลส์ ถามน้องได้เลยนะคร้าบ! ✨</div>
              </div>
            `}
          </div>
          <div class="ghost-quick-prompts">
            <button type="button" class="ghost-prompt-pill" data-act="ghost-prompt" data-q="สรุปยอดค่าแอดและ ROAS ช่วงนี้ให้หน่อยครับ">📊 สรุปยอดแอด (${curRText})</button>
            <button type="button" class="ghost-prompt-pill" data-act="ghost-prompt" data-q="ตอนนี้มีแชททักเข้ามาเท่าไหร่ครับ">💬 จำนวนแชท</button>
            <button type="button" class="ghost-prompt-pill" data-act="ghost-prompt" data-q="ใครตอบแชทเร็วสุดและช้าสุดครับ">⏱️ เซลล์ตอบช้า/เร็ว</button>
            <button type="button" class="ghost-prompt-pill" data-act="ghost-prompt" data-q="เซลล์แต่ละคนดูแลกี่แชทครับ">👥 สรุปงานเซลส์</button>
            <button type="button" class="ghost-prompt-pill" data-act="ghost-prompt" data-q="มีลูกค้าที่ต้องตามกี่คนครับ">📅 ลูกค้าต้องตาม</button>
            <button type="button" class="ghost-prompt-pill" data-act="ghost-prompt" data-q="โปรแกรมปลูกผมและราคาของคลินิกมีอะไรบ้างครับ">🩺 โปรปลูกผม</button>
            <button type="button" class="ghost-prompt-pill" data-act="ghost-prompt" data-q="สรุปภาพรวมทั้งคลินิกให้ฟังหน่อยครับ">🌐 สรุปคลินิกวันนี้</button>
          </div>
          <form class="ghost-chat-footer" data-form="ghost-send">
            <input type="text" class="ghost-chat-input" placeholder="ถามน้อง AI ได้ทุกเรื่องเลยครับ ไม่ต้องเปิดหาเองเลยนะคร้าบ..." required>
            <button type="submit" class="ghost-chat-send" title="ส่งคำถาม">➤</button>
          </form>
        </div>
      `;
    }

    return `
      ${chatModal}
      <div class="floating-ghost-btn" data-act="toggle-ghost" title="คุยกับน้อง AI ผู้ช่วยประจำคลินิก">
        ${ghostSvg(46)}
        ${unreadPill}
      </div>
    `;
  }

  function playNotificationSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  }

  // Futuristic Sci-Fi UI Click Haptic Sound
  function playFuturisticClick() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (_) {}
  }

  function triggerDesktopNotification(title, body) {
    playNotificationSound();
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/logo-mark.png'
        });
      } catch (_) {}
    }
  }

  function scheduleModalHtml() {
    if (!S.scheduleModalOpen) return '';
    const sched = S.notificationSchedule || { enabled: false, intervalMinutes: 60, target: 'all' };
    const mins = sched.intervalMinutes || 60;
    const target = sched.target || 'all';
    return `
      <div class="modal-backdrop fu-sched-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(3px);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="modal-card" style="background:#fff;border-radius:18px;max-width:500px;width:100%;box-shadow:0 20px 40px -8px rgba(0,0,0,0.2);overflow:hidden;border:1px solid #e2e8f0;animation:slideUp 0.2s ease-out;position:relative;z-index:1">
          <div style="padding:18px 22px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">⏰</span>
              <div>
                <h3 style="margin:0;font-size:16px;color:#0f172a;font-weight:700">ตั้งรอบเวลาส่งแจ้งเตือนตามลูกค้า</h3>
                <span style="font-size:12px;color:#64748b">ระบบแจ้งเตือนอัตโนมัติเข้าเว็บ & LINE Notify</span>
              </div>
            </div>
            <button type="button" data-act="fu-close-schedule" style="background:none;border:0;color:#94a3b8;font-size:20px;cursor:pointer;padding:4px;line-height:1">✕</button>
          </div>
          <form data-form="fu-save-schedule" style="padding:22px">
            <div style="margin-bottom:18px;padding:12px 14px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none">
                <input type="checkbox" name="enabled" ${sched.enabled ? 'checked' : ''} style="width:20px;height:20px;accent-color:#059669">
                <div>
                  <div style="font-weight:700;font-size:14px;color:#065f46">เปิดใช้งานระบบแจ้งเตือนอัตโนมัติตามรอบเวลา</div>
                  <div style="font-size:12px;color:#047857">ส่งแจ้งเตือนตามรอบนาที/ชั่วโมงที่กำหนดโดยไม่ต้องกดเอง</div>
                </div>
              </label>
            </div>
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:8px">⏱️ เลือกรอบระยะเวลาในการส่งแจ้งเตือน:</label>
              <select name="intervalMinutes" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;background:#f8fafc">
                <option value="15" ${mins === 15 ? 'selected' : ''}>⚡ ทุกๆ 15 นาที (ติดตามด่วนพิเศษ)</option>
                <option value="30" ${mins === 30 ? 'selected' : ''}>⏱️ ทุกๆ 30 นาที</option>
                <option value="60" ${mins === 60 ? 'selected' : ''}>🕐 ทุกๆ 1 ชั่วโมง (แนะนำ)</option>
                <option value="120" ${mins === 120 ? 'selected' : ''}>🕑 ทุกๆ 2 ชั่วโมง</option>
                <option value="240" ${mins === 240 ? 'selected' : ''}>🕓 ทุกๆ 4 ชั่วโมง</option>
                <option value="360" ${mins === 360 ? 'selected' : ''}>🕕 ทุกๆ 6 ชั่วโมง</option>
                <option value="720" ${mins === 720 ? 'selected' : ''}>🕛 ทุกๆ 12 ชั่วโมง</option>
                <option value="1440" ${mins === 1440 ? 'selected' : ''}>📅 วันละ 1 ครั้ง (ทุก 24 ชั่วโมง)</option>
              </select>
            </div>
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:8px">🎯 กลุ่มเป้าหมายที่ต้องการให้เตือน:</label>
              <select name="target" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;background:#f8fafc">
                <option value="all" ${target === 'all' ? 'selected' : ''}>🌐 ทั้งหมด (ลูกค้ารอตอบ + เคสนัดตาม + ถึงเวลาตาม)</option>
                <option value="reply" ${target === 'reply' ? 'selected' : ''}>⚡ เฉพาะเคสลูกค้ารอตอบคำตอบ</option>
                <option value="overdue" ${target === 'overdue' ? 'selected' : ''}>⚠️ เฉพาะเคสนัดตามเกินกำหนด / วันนี้</option>
              </select>
            </div>
            <div style="margin-bottom:20px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
              <div style="font-size:12.5px;font-weight:700;color:#334155;margin-bottom:8px">🔔 ช่องทางและการแจ้งเตือน:</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn" data-act="fu-test-sound" style="font-size:12px;padding:5px 10px;border-radius:8px;background:#fff">
                  🔊 ฟังเสียงทดสอบ
                </button>
                <button type="button" class="btn" data-act="fu-enable-desktop-notif" style="font-size:12px;padding:5px 10px;border-radius:8px;background:#fff">
                  🖥️ อนุญาตแจ้งเตือนบนหน้าจอ
                </button>
                <button type="button" class="btn" data-act="fu-test-notify" style="font-size:12px;padding:5px 10px;border-radius:8px;background:#ecfdf5;color:#065f46;border-color:#a7f3d0">
                  🧪 ทดสอบส่งแจ้งเตือนตอนนี้
                </button>
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px">
              <button type="button" class="btn btn-secondary" data-act="fu-close-schedule">ยกเลิก</button>
              <button type="submit" class="btn btn-primary" style="background:#059669;color:#fff;font-weight:600">💾 บันทึกการตั้งค่า</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function quickEditModalHtml() {
    if (!S.quickEditLead) return '';
    const l = S.quickEditLead;
    const t = today();
    const tm = tomorrow();
    return `
      <div class="modal-backdrop" data-act="fu-quick-close" style="position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(3px);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="modal-card" style="background:#fff;border-radius:18px;max-width:480px;width:100%;box-shadow:0 20px 40px -8px rgba(0,0,0,0.2);overflow:hidden;border:1px solid #e2e8f0;animation:slideUp 0.2s ease-out">
          <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">✏️</span>
              <div>
                <h3 style="margin:0;font-size:16px;color:#0f172a;font-weight:700">แก้ไขข้อมูลการนัดตามลูกค้า</h3>
                <span style="font-size:12px;color:#64748b">ลูกค้า: <b style="color:#059669">${esc(l.name)}</b></span>
              </div>
            </div>
            <button type="button" data-act="fu-quick-close" style="background:none;border:0;color:#94a3b8;font-size:20px;cursor:pointer;padding:4px;line-height:1">✕</button>
          </div>
          <form data-form="fu-quick-save" style="padding:22px">
            <input type="hidden" name="id" value="${esc(l.id)}">
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px">📅 วันที่นัดติดตามลูกค้า:</label>
              <input type="date" id="fu-quick-due-input" name="dueDate" value="${esc(l.dueDate || tm)}" required style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;background:#f8fafc;margin-bottom:8px">
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="btn" data-act="fu-quick-set-date" data-val="${t}" style="padding:3px 10px;font-size:12px;border-radius:8px">วันนี้</button>
                <button type="button" class="btn" data-act="fu-quick-set-date" data-val="${tm}" style="padding:3px 10px;font-size:12px;border-radius:8px">พรุ่งนี้</button>
                <button type="button" class="btn" data-act="fu-quick-set-date" data-val="${addDays(t, 3)}" style="padding:3px 10px;font-size:12px;border-radius:8px">อีก 3 วัน</button>
                <button type="button" class="btn" data-act="fu-quick-set-date" data-val="${addDays(t, 7)}" style="padding:3px 10px;font-size:12px;border-radius:8px">อีก 1 สัปดาห์</button>
              </div>
            </div>
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px">📝 บันทึกช่วยจำ / โน้ตติดตาม:</label>
              <input type="text" name="note" value="${esc(l.note)}" maxlength="300" placeholder="เช่น โทรแจ้งโปรโมชั่นกราฟต์ผม, ส่งเคสรีวิวเพิ่มเติม" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;background:#f8fafc">
            </div>
            <div style="margin-bottom:20px">
              <label style="display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px">🔄 สถานะความคืบหน้า:</label>
              <select name="status" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:14px;background:#f8fafc">
                ${STATUS_ORDER.map(k => `<option value="${k}" ${l.status === k ? 'selected' : ''}>${STATUS_TH[k]}</option>`).join('')}
              </select>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid #f1f5f9">
              <button type="button" class="btn btn-secondary" data-act="fu-quick-done" data-id="${esc(l.id)}" style="color:#d97706;border-color:#fde68a;background:#fffbeb;font-size:12.5px;padding:6px 12px;border-radius:8px">
                ✅ ปิดงานตามนี้
              </button>
              <div style="display:flex;gap:8px">
                <button type="button" class="btn btn-secondary" data-act="fu-quick-close" style="border-radius:8px">ยกเลิก</button>
                <button type="submit" class="btn btn-primary" style="background:#059669;color:#fff;border-radius:8px;font-weight:600">💾 บันทึกการแก้ไข</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // ช่องเลือกจำนวน: ตัวเลือกสำเร็จรูป + "ทั้งหมด" + พิมพ์จำนวนเองได้
  function fetchCountFieldHtml(name, label, options, def, unit) {
    const sel = 'width:100%;padding:10px 14px;border-radius:10px;border:1.5px solid #cbd5e1;font-size:14px;background:#f8fafc;box-sizing:border-box';
    return `<label style="display:block;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px">${label}</label>
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px">
        <select name="${name}" style="${sel}">${options.map(([v, t]) => `<option value="${v}"${v === def ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <input type="number" min="1" step="1" name="${name}Custom" placeholder="หรือพิมพ์จำนวนเอง" title="พิมพ์จำนวน${unit}ที่ต้องการ (ใช้แทนตัวเลือกด้านซ้าย)" style="${sel};background:#fff">
      </div>`;
  }
  // อ่านค่าจากช่องเลือกจำนวน: ถ้าพิมพ์เองให้ใช้ค่าที่พิมพ์ ไม่งั้นใช้ตัวเลือก ('all' = ทั้งหมด)
  function fetchCountValue(fd, name, def) {
    const custom = Number(fd[name + 'Custom']);
    if (Number.isFinite(custom) && custom > 0) return Math.floor(custom);
    const v = fd[name];
    if (v === 'all') return 'all';
    return Number(v) || def;
  }
  const countLabel = (v, unit) => (v === 'all' ? `ทั้งหมด` : `${Number(v).toLocaleString()} ${unit}`);

  // ผลตรวจ Instagram แบบละเอียด: บอกสาเหตุที่ดึงแชท IG ไม่ได้
  function igDiagHtml() {
    const d = S.igDiag;
    if (!d) return '';
    const li = (ok, text) => `<li style="margin:2px 0">${ok ? '✅' : '⚠️'} ${text}</li>`;
    const t = d.token || {};
    const tokenRows = t.checked
      ? [li(t.isValid, `Token ${t.isValid ? 'ใช้งานได้' : 'ใช้ไม่ได้/หมดอายุ'}${t.expiresAt ? ` (หมดอายุ ${new Date(t.expiresAt * 1000).toLocaleDateString('th-TH')})` : ' (ไม่หมดอายุ)'}`),
         li(!(t.missingScopes || []).length, (t.missingScopes || []).length ? `Token ขาดสิทธิ์: <b>${(t.missingScopes || []).map(esc).join(', ')}</b> — สร้าง Token ใหม่แล้วติ๊กสิทธิ์เหล่านี้` : 'Token มีสิทธิ์ที่ต้องใช้ครบ')]
      : [li(false, `ตรวจสิทธิ์ของ Token ไม่ได้${t.error ? ': ' + esc(t.error) : ''}`)];
    const accRows = (d.igAccounts || []).map((ig) => {
      const wh = ig.webhook || {};
      return `<div style="border-top:1px dashed #fbcfe8;padding-top:8px;margin-top:8px">
        <b>@${esc(ig.username)}</b> <span style="color:#64748b">ผูกกับเพจ ${esc(ig.fbPageName)}</span>
        <ul style="margin:4px 0 0;padding-left:4px;list-style:none">
          ${li(ig.mediaOk, `โพสต์/รูป ${ig.mediaOk ? 'อ่านได้' : 'อ่านไม่ได้'}`)}
          ${li(ig.messagingOk && ig.convCount > 0, ig.messagingOk ? `แชท IG ที่ Meta ส่งให้: <b>${ig.convCount}${ig.convCount >= 25 ? '+' : ''}</b> แชท${ig.latestConvAt ? ` (ล่าสุด ${new Date(ig.latestConvAt).toLocaleString('th-TH')})` : ''}` : `อ่านแชทไม่ได้: ${esc(ig.messagingError || '')}`)}
          ${wh.checked ? li(wh.subscribed && (wh.fields || []).includes('messages'), wh.subscribed ? `Webhook ของเพจ: ${esc((wh.fields || []).join(', ') || '-')}` : 'เพจยังไม่ได้ subscribe webhook ให้แอปนี้') : ''}
        </ul>
        ${(ig.problems || []).length ? `<div style="margin-top:6px;padding:8px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412">${ig.problems.map((x) => '• ' + esc(x)).join('<br>')}</div>` : '<div style="margin-top:6px;color:#166534">พร้อมใช้งาน — กด "📥 ดึงแชท" ของบัญชีนี้ได้เลย</div>'}
      </div>`;
    }).join('');
    const unlinked = (d.unlinkedFbPages || []).length ? `<div style="margin-top:8px;color:#64748b">เพจที่ยังไม่ผูก IG: ${(d.unlinkedFbPages || []).map((u) => esc(u.fbPageName)).join(', ')}</div>` : '';
    return `<div style="margin-top:12px;padding:12px 14px;background:#fdf2f8;border:1px solid #fbcfe8;border-radius:12px;font-size:13px;line-height:1.5">
      <div style="display:flex;justify-content:space-between;align-items:center"><b>📸 ผลตรวจ Instagram</b><button type="button" class="btn" data-act="ig-diag-close" style="padding:2px 8px;font-size:12px">ปิด</button></div>
      <ul style="margin:6px 0 0;padding-left:4px;list-style:none">${tokenRows.join('')}</ul>
      ${accRows || '<div style="margin-top:6px">ยังไม่พบบัญชี Instagram Business ที่ผูกกับเพจ Facebook ของ Token นี้</div>'}
      ${unlinked}
    </div>`;
  }

  // ป้ายชื่อคนตอบใต้ข้อความฝั่งทีมขาย
  function staffLabel(m) {
    if (!m.by) return '👤 ทีมขาย';
    const pageNames = new Set(((S.filters && S.filters.pages) || []).map((p) => String(p.name || '').trim().toLowerCase()));
    if (pageNames.has(String(m.by).trim().toLowerCase()) || /clinic|center|centre|hair|transplant|wellness|academy|official|คลินิก|ปลูกผม/i.test(m.by)) return `🏢 ${esc(m.by)} <span style="opacity:.7">(ไม่ทราบชื่อเซลล์)</span>`;
    if (m.byAssumed) return `<span title="Meta ไม่บอกชื่อคนกดส่ง ระบบจึงใช้เซลล์ที่ได้รับมอบหมายแชทนี้ในช่วงเวลานั้น">👤 ${esc(m.by)}*</span>`;
    return `👤 ${esc(m.by)}`;
  }

  function postsModalHtml() {
    if (!S.postsModal) return '';
    const m = S.postsModal;
    const inp = 'width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #cbd5e1;font-size:14px;box-sizing:border-box;background:#fff;cursor:pointer';
    const quick = 'padding:3px 8px;font-size:11.5px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0';
    return `
      <div class="modal-backdrop" data-act="posts-modal-close" style="position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="modal-card" style="background:#fff;border-radius:18px;max-width:640px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 20px 40px -8px rgba(0,0,0,0.25);border:1px solid #e2e8f0">
          <div style="padding:18px 22px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#f0fdf4">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">💬</span>
              <div>
                <h3 style="margin:0;font-size:16px;color:#0f172a;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap">ดึงโพสต์ & คอมเมนต์ ${m.pageId ? `"${esc(m.pageName || '')}" ${platformBadge(m.platform || 'Facebook', 11.5)}` : 'ทุกเพจ (Facebook + Instagram)'}</h3>
                <span style="font-size:12px;color:#64748b">เลือกว่าจะดึงทั้งหมด หรือดึงแค่ช่วงที่ต้องการ</span>
              </div>
            </div>
            <button type="button" data-act="posts-modal-close" style="background:none;border:0;color:#94a3b8;font-size:20px;cursor:pointer;padding:4px;line-height:1">✕</button>
          </div>
          <form data-form="do-posts-sync" style="padding:22px">
            ${m.pageId ? `<input type="hidden" name="pageId" value="${esc(m.pageId)}">` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px">
              <div>
                <label style="display:block;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px">📅 ตั้งแต่วันที่</label>
                <input type="date" name="afterDate" id="pm-after-date" style="${inp}">
              </div>
              <div>
                <label style="display:block;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px">📅 ถึงวันที่</label>
                <input type="date" name="beforeDate" id="pm-before-date" style="${inp}">
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
              <span style="font-size:11.5px;color:#64748b;align-self:center;margin-right:2px">ช่วงลัด:</span>
              <button type="button" class="btn" data-act="import-quick-range" data-days="all" style="${quick}">ทั้งหมด</button>
              <button type="button" class="btn" data-act="posts-quick-range" data-days="30" style="${quick}">30 วัน</button>
              <button type="button" class="btn" data-act="posts-quick-range" data-days="90" style="${quick}">3 เดือน</button>
              <button type="button" class="btn" data-act="posts-quick-range" data-days="365" style="${quick}">1 ปี</button>
            </div>
            <div style="margin-bottom:16px">
              ${fetchCountFieldHtml('limit', '📝 จำนวนโพสต์ต่อเพจ', [['100', '100 โพสต์ (เร็ว)'], ['300', '300 โพสต์ (แนะนำ)'], ['1000', '1,000 โพสต์'], ['all', 'ทั้งหมด (ช้า)']], '300', 'โพสต์')}
            </div>
            <div style="margin-bottom:16px">
              ${fetchCountFieldHtml('commentsPerPost', '💬 คอมเมนต์ต่อโพสต์', [['100', '100 คอมเมนต์'], ['500', '500 คอมเมนต์ (แนะนำ)'], ['all', 'ทั้งหมด']], '500', 'คอมเมนต์')}
            </div>
            <div style="padding:12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;font-size:12.5px;color:#166534;line-height:1.6;margin-bottom:20px">
              💡 เว้นวันที่ว่างไว้ = ดึงทุกช่วงเวลา · โพสต์ที่มีอยู่แล้วจะถูกอัปเดต ไม่ซ้ำ<br>
              ⏳ ระบบดึงอยู่เบื้องหลัง ปิดหน้านี้ได้
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px">
              <button type="button" class="btn btn-secondary" data-act="posts-modal-close">ยกเลิก</button>
              <button type="button" class="btn btn-primary" data-act="posts-modal-submit" style="background:#059669;color:#fff;padding:9px 22px">💬 เริ่มดึงข้อมูล</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function importModalHtml() {
    if (!S.importModal) return '';
    const m = S.importModal;
    const today = new Date().toISOString().slice(0, 10);
    const defAfter = (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); })();
    return `
      <div class="modal-backdrop import-modal-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="modal-card" style="background:#fff;border-radius:18px;max-width:640px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 20px 40px -8px rgba(0,0,0,0.25);border:1px solid #e2e8f0;animation:slideUp 0.2s ease-out;position:relative;z-index:1">
          <div style="padding:18px 22px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#f0fdf4">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">📥</span>
              <div>
                <h3 style="margin:0;font-size:16px;color:#0f172a;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap">ดึงข้อมูลแชท ${m.mode === 'all' ? 'ทุกเพจ (Facebook + Instagram)' : `"${esc(m.pageName || '')}" ${platformBadge(m.platform || 'Facebook', 11.5)}`}</h3>
                <span style="font-size:12px;color:#64748b">เลือกว่าจะดึงทั้งหมด หรือดึงแค่ช่วงที่ต้องการ</span>
              </div>
            </div>
            <button type="button" data-act="import-modal-close" style="background:none;border:0;color:#94a3b8;font-size:20px;cursor:pointer;padding:4px;line-height:1">✕</button>
          </div>
          <form data-form="do-import-conv" style="padding:22px">
            ${m.mode === 'one' ? `<input type="hidden" name="pageId" value="${esc(m.pageId || '')}">` : ''}
            <input type="hidden" name="mode" value="${m.mode}">

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px">
              <div>
                <label style="display:block;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px">📅 ตั้งแต่วันที่</label>
                <input type="date" name="afterDate" id="m-after-date" value="${m.afterDate || defAfter}" onclick="try{this.showPicker()}catch(_){}" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #cbd5e1;font-size:14px;box-sizing:border-box;background:#fff;cursor:pointer">
              </div>
              <div>
                <label style="display:block;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px">📅 ถึงวันที่</label>
                <input type="date" name="beforeDate" id="m-before-date" value="${m.beforeDate || today}" onclick="try{this.showPicker()}catch(_){}" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #cbd5e1;font-size:14px;box-sizing:border-box;background:#fff;cursor:pointer">
              </div>
            </div>

            <!-- ปุ่มลัดเลือกช่วงเวลาเร็ว -->
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
              <span style="font-size:11.5px;color:#64748b;align-self:center;margin-right:2px">ช่วงลัด:</span>
              <button type="button" class="btn" data-act="import-quick-range" data-days="all" style="padding:3px 8px;font-size:11.5px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">ทั้งหมด (ไม่จำกัดวันที่)</button>
              <button type="button" class="btn" data-act="import-quick-range" data-days="7" style="padding:3px 8px;font-size:11.5px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">7 วันล่าสุด</button>
              <button type="button" class="btn" data-act="import-quick-range" data-days="30" style="padding:3px 8px;font-size:11.5px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">30 วันล่าสุด</button>
              <button type="button" class="btn" data-act="import-quick-range" data-days="90" style="padding:3px 8px;font-size:11.5px;border-radius:6px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-weight:600">3 เดือน (แนะนำ)</button>
              <button type="button" class="btn" data-act="import-quick-range" data-days="180" style="padding:3px 8px;font-size:11.5px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">6 เดือน</button>
            </div>

            <div style="margin-bottom:16px">
              ${fetchCountFieldHtml('limit', '🔢 จำนวนแชทที่ดึง', [['200', '200 แชท (เร็ว)'], ['500', '500 แชท (แนะนำ)'], ['1000', '1,000 แชท'], ['5000', '5,000 แชท'], ['all', 'ทั้งหมด (ช้า)']], '500', 'แชท')}
            </div>
            <div style="margin-bottom:16px">
              ${fetchCountFieldHtml('messagesPerChat', '💬 ข้อความย้อนหลังต่อแชท', [['50', '50 ข้อความล่าสุด (เร็ว)'], ['300', '300 ข้อความ (แนะนำ)'], ['all', 'ทั้งหมดเท่าที่ Meta ให้']], '300', 'ข้อความ')}
            </div>

            <div style="padding:12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;font-size:12.5px;color:#166534;line-height:1.6;margin-bottom:20px">
              💡 เว้นวันที่ว่างไว้ = ดึงทุกช่วงเวลา · ระบบรวมข้อมูลใหม่เข้ากับของเดิม ไม่ลบของเดิม<br>
              ⏳ ยิ่งดึงเยอะยิ่งใช้เวลานาน ระบบดึงอยู่เบื้องหลัง ปิดหน้านี้ได้<br>
              ℹ️ Meta อาจไม่ส่งข้อความที่เก่ามากในบางแชท ระบบจะดึงเท่าที่ Meta อนุญาต
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px">
              <button type="button" class="btn btn-secondary" data-act="import-modal-close">ยกเลิก</button>
              <button type="button" class="btn btn-primary" data-act="import-modal-submit" style="background:#059669;color:#fff;padding:9px 22px">📥 เริ่มดึงข้อมูล</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // จำตำแหน่งเลื่อนหน้าไว้ เวลา render ใหม่ในหน้าเดิม (เช่น เปิด/ปิดหน้าต่างดึงข้อมูล) จะได้ไม่เด้งกลับขึ้นบนสุด
  let lastRenderedRoute = null;
  let lastFlashShown = null;
  function render() {
    const prevMain = document.querySelector('main.page');
    const keepScroll = prevMain && lastRenderedRoute === S.route ? prevMain.scrollTop : null;
    renderInner();
    lastRenderedRoute = S.me ? S.route : null;
    if (keepScroll != null) {
      const main = document.querySelector('main.page');
      if (main) main.scrollTop = keepScroll;
      // ข้อความแจ้งผลอยู่ด้านบนสุดของหน้า ถ้าผู้ใช้เลื่อนลงมาไกล ให้เด้งเป็น toast ด้วยจะได้เห็น
      if (S.flash && S.flash !== lastFlashShown && keepScroll > 200 && typeof showToast === 'function') {
        showToast(S.flash.text, S.flash.type === 'err' ? 'error' : 'success');
      }
    }
    lastFlashShown = S.flash || null;
  }

  function renderInner() {
    if (!S.booted) { $app.innerHTML = '<div class="loading">Loading…</div>'; return; }
    if (!S.me) return renderLogin();
    const views = { dashboard: dashShell, inbox: inboxShell, board: boardShell, 'post-comment': commentsShell, followup: followShell, review: reviewShell, audit: auditShell, setting: settingShell, upload: uploadShell, quality: qualityShell };
    const body = (views[S.route] || soonShell)();
    $app.innerHTML = `<div class="app-shell ${S.sidebarCollapsed ? 'sidebar-collapsed' : ''} ${S.mobileNav ? 'mobile-nav-open' : ''}">
      ${sidebarHtml()}
      <div class="mobile-nav-backdrop" data-act="close-mobile-nav"></div>
      <div class="app-main">
        ${appHeaderHtml()}
        <main class="page page-${S.route}">
          ${S.me.mustChange && S.route !== 'setting'
            ? '<div class="notice warn banner">บัญชีนี้ใช้รหัสผ่านชั่วคราวอยู่ — <a href="#/setting">ตั้งรหัสผ่านใหม่ที่ Setting</a> (ไม่ต้องกรอกรหัสเดิม)</div>' : ''}
          ${body}
        </main>
      </div>
      <div id="drawer-root"></div>
      ${commandPaletteHtml()}
      ${scheduleModalHtml()}
      ${quickEditModalHtml()}
      ${importModalHtml()}
      ${postsModalHtml()}
      ${floatingGhostHtml()}
    </div>`;
    afterRender();
  }

  function afterRender() {
    if (S.route === 'dashboard') renderDashBody();
    if (S.route === 'inbox') renderInboxBody();
    renderDrawer();
    if (S.route === 'board') renderBoardBody();
    if (S.route === 'followup') renderFollowBody();
    if (S.route === 'review') { renderReviewBody(); renderSlaBody(); }
    if (S.route === 'audit') renderAuditBody();
    if (S.route === 'setting') renderSettingBody();
    if (S.route === 'upload') renderUploadBody();
    if (S.route === 'quality') renderQualityBody();
    if (S.route === 'post-comment') renderCommentsBody();
  }

  function soonShell() {
    const name = { inbox: 'Inbox', upload: 'Upload', quality: 'Quality' }[S.route] || S.route;
    return `<div class="page-head"><div><h1>${esc(name)}</h1></div></div>
      <div class="card soon"><b>กำลังพัฒนา</b><p>ส่วนนี้จะใช้ข้อมูลแชทจริงหลังเชื่อม Meta (Messenger/Inbox) แล้ว ตอนนี้ดูภาพรวมได้ที่ Dashboard และ Board</p></div>`;
  }

  /* ═══════════════════════════════════════════
     UPLOAD & DATA MANAGEMENT — นำเข้าและจัดการข้อมูล
  ═══════════════════════════════════════════ */
  function uploadShell() {
    return `<div class="page-head"><div><h1>${icon('upload')} นำเข้าและจัดการข้อมูล (CSV)</h1>
        <div class="meta-line"><span>นำเข้า Leads ลูกค้า และข้อมูลแคมเปญโฆษณาเพื่อนำไปแสดงผลบน Dashboard (เฉพาะ admin)</span></div></div></div>
      <div id="upload-body"><div class="loading">Loading…</div></div>`;
  }

  async function loadUpload() {
    const u = S.upload;
    try {
      const [history, summary, adImages] = await Promise.all([
        api('/api/upload/history').catch(() => ({ history: [] })),
        api('/api/data/summary').catch(() => null),
        api('/api/upload/ad-images').catch(() => ({ ads: [] })),
      ]);
      u.data = history;
      u.summary = summary;
      u.ads = (adImages && adImages.ads) || [];
      u.err = null;
    } catch (_) {
      u.data = { history: [] };
    }
    renderUploadBody();
  }

  async function uploadAdImage(adId, adName, file) {
    if (!file) return;
    if (file.size > 30_000_000) { alert('ไฟล์มีขนาดใหญ่เกิน 30 MB'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imageData = e.target.result;
        const mimeType = file.type || 'image/jpeg';
        const res = await api('/api/upload/ad-image', {
          method: 'POST',
          body: { adId, adName, imageData, mimeType },
        });
        S.flash = { type: 'ok', text: `อัปโหลด${res.isVideo ? 'วิดีโอ' : 'รูปภาพ'}ให้โฆษณา "${res.adName || adName}" สำเร็จแล้ว!` };
        closeAdMediaModal();
        S.dash.data = null;
        if (S.route === 'dashboard') {
          await loadDash(true);
        } else if (S.route === 'quality') {
          await loadQuality();
        } else {
          await loadUpload();
        }
      } catch (err) {
        alert('อัปโหลดไฟล์ไม่สำเร็จ: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveAdMediaUrl(adId, adName, rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) return;
    const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('video');
    try {
      const res = await api('/api/upload/ad-image', {
        method: 'POST',
        body: { adId, adName, ...(isVid ? { videoUrl: url } : { mediaUrl: url }) },
      });
      S.flash = { type: 'ok', text: `บันทึกลิงก์${res.isVideo ? 'วิดีโอ' : 'รูปภาพ'}ให้โฆษณา "${res.adName || adName}" สำเร็จแล้ว!` };
      closeAdMediaModal();
      S.dash.data = null;
      if (S.route === 'dashboard') await loadDash(true);
      else if (S.route === 'quality') await loadQuality();
      else await loadUpload();
    } catch (err) {
      alert('บันทึกลิงก์ไม่สำเร็จ: ' + err.message);
    }
  }

  function handleUploadFile(file) {
    if (file.size > 2_097_152) { S.upload.err = 'ไฟล์ใหญ่เกิน 2 MB'; renderUploadBody(); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = parseCsv(text);
      if (!rows.length) { S.upload.err = 'ไม่พบข้อมูลในไฟล์ — ตรวจสอบรูปแบบและลองใหม่'; renderUploadBody(); return; }
      S.upload.rows = rows; S.upload.err = null; S.upload.result = null;
      renderUploadBody();
    };
    reader.readAsText(file, 'utf-8');
  }

  function parseCsv(text) {
    if (!text || !text.trim()) return [];
    // ตัด UTF-8 BOM (\ufeff) ที่มักติดมาจากไฟล์ Export ของ Excel / Windows ออก
    const s = text.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // หา delimiter จากบรรทัดแรก
    const firstLineEnd = s.indexOf('\n');
    const firstLine = firstLineEnd === -1 ? s : s.slice(0, firstLineEnd);
    const delim = firstLine.includes('\t') ? '\t' : (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    const allRows = [];
    let curRow = [];
    let curField = '';
    let inQ = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQ) {
        if (ch === '"') {
          if (s[i + 1] === '"') { curField += '"'; i++; }
          else { inQ = false; }
        } else {
          curField += ch;
        }
      } else {
        if (ch === '"') {
          inQ = true;
        } else if (ch === delim) {
          curRow.push(curField.trim());
          curField = '';
        } else if (ch === '\n') {
          curRow.push(curField.trim());
          curField = '';
          if (curRow.some((f) => f.length > 0)) allRows.push(curRow);
          curRow = [];
        } else {
          curField += ch;
        }
      }
    }
    if (curField.length > 0 || curRow.length > 0) {
      curRow.push(curField.trim());
      if (curRow.some((f) => f.length > 0)) allRows.push(curRow);
    }

    if (!allRows.length) return [];
    const rawFirstFields = allRows[0];
    const firstFields = rawFirstFields.map((f) => f.replace(/^\ufeff/, '').toLowerCase().trim().replace(/^["']|["']$/g, '').trim());

    // ตรวจสอบอัตโนมัติว่าเป็นไฟล์รายงานโฆษณา (Campaign Report) หรือไฟล์รายชื่อลูกค้า (Leads)
    const isCampaignFile = S.upload.tab === 'campaigns' || firstFields.some((f) =>
      ['spend', 'amount spent', 'amount spent (thb)', 'impressions', 'จำนวนเงินที่ใช้ไป', 'งบประมาณ', 'การแสดงผล', 'cpm', 'ctr',
       'reporting starts', 'reporting ends', 'hook rate', 'hold rate', 'quality ranking', 'engagement rate ranking'].includes(f));
    S.upload.detectedType = isCampaignFile ? 'campaigns' : 'leads';

    let COL_MAP = {};
    if (isCampaignFile) {
      COL_MAP = {
        // แคมเปญ
        'campaign': 'campaign', 'campaign name': 'campaign', 'campaign_name': 'campaign', 'ชื่อแคมเปญ': 'campaign', 'แคมเปญ': 'campaign',
        // Ad Set
        'ad set name': 'adset', 'adset_name': 'adset', 'adset': 'adset', 'ชื่อชุดโฆษณา': 'adset',
        // Ad ชื่อโฆษณา
        'ad name': 'adName', 'ad_name': 'adName', 'ชื่อโฆษณา': 'adName', 'ad id': 'adId', 'adid': 'adId', 'ad_id': 'adId', 'ad': 'adName',
        // งบโฆษณา (Amount Spent)
        'amount spent': 'spend', 'amount spent (thb)': 'spend', 'spend': 'spend',
        'จำนวนเงินที่ใช้ไป': 'spend', 'จำนวนเงินที่ใช้ไป (thb)': 'spend', 'งบประมาณ': 'spend',
        // Impressions / Reach
        'impressions': 'impressions', 'การแสดงผล': 'impressions',
        'reach': 'reach', 'การเข้าถึง': 'reach',
        // Clicks
        'clicks (all)': 'clicks', 'link clicks': 'clicks', 'clicks': 'clicks', 'คลิก': 'clicks', 'คลิก (ทั้งหมด)': 'clicks',
        // วันที่ — ใช้ "Reporting starts" เป็นวันเริ่มต้น และ "Reporting ends" เป็นวันสิ้นสุด
        'reporting starts': 'date', 'reporting_starts': 'date', 'day': 'date', 'date': 'date', 'วันที่': 'date', 'start date': 'date',
        'reporting ends': 'dateEnd', 'reporting_ends': 'dateEnd', 'end date': 'dateEnd',
        // ผลลัพธ์โฆษณา (Results) — มักเป็น Messaging conversations สำหรับแคมเปญ Message objective
        'results': 'messages', 'messaging conversations started': 'messages', 'messages': 'messages',
        'การเริ่มสนทนาทางข้อความ': 'messages', 'messaging conversations': 'messages',
        'results (initial)': '_resultsInitial',
        // ตัวชี้วัดผล (ไม่ใช้ในการคำนวณ แต่เก็บไว้สำหรับ debug)
        'result indicator': '_resultIndicator', 'results (initial) indicator': '_resultsInitialIndicator',
        // อื่นๆ จาก Ads Manager ที่ไม่นำมาใช้ (map เป็น null เพื่อ ignore)
        'ad delivery': null, 'attribution setting': null, 'cost per results': null,
        'ad set budget': null, 'ad set budget type': null,
        'hook rate': null, 'hold rate': null, 'ends': null, 'bid': null, 'bid type': null,
        'last significant edit': null, 'quality ranking': null, 'engagement rate ranking': null,
        'conversion rate ranking': null,
        // Purchases
        'purchases': 'purchases', 'การซื้อ': 'purchases',
        // Media (Image & Video)
        'image': 'thumb', 'image_url': 'thumb', 'thumbnail_url': 'thumb', 'thumb': 'thumb', 'รูปภาพ': 'thumb', 'ลิงก์รูป': 'thumb',
        'video': 'videoUrl', 'video_url': 'videoUrl', 'วิดีโอ': 'videoUrl', 'ลิงก์วิดีโอ': 'videoUrl',
        'creative': 'creative', 'creative_type': 'creative',
      };
    } else {
      COL_MAP = {
        'ชื่อ': 'name', 'ชื่อ-นามสกุล': 'name', 'ชื่อจริง': 'name', 'ชื่อเต็ม': 'name', 'ชื่อลูกค้า': 'name',
        'name': 'name', 'full_name': 'name', 'fullname': 'name', 'first_name': 'name', 'customer': 'name', 'customer_name': 'name', 'lead_name': 'name',
        'แพลตฟอร์ม': 'platform', 'platform': 'platform',
        'ช่องทาง': 'channel', 'ช่องทางติดต่อ': 'channel', 'channel': 'channel',
        'เพจ': 'pageName', 'ชื่อเพจ': 'pageName', 'เพจ facebook': 'pageName', 'เพจ ig': 'pageName', 'เพจ instagram': 'pageName',
        'page': 'pageName', 'page_name': 'pageName', 'page name': 'pageName', 'pagename': 'pageName', 'page_id': 'pageId', 'page id': 'pageId',
        'source': 'source',
        'form': 'adId', 'form name': 'adId', 'form_name': 'adId',
        'ad id': 'adId', 'adid': 'adId', 'ad_id': 'adId', 'ad': 'adId', 'ad name': 'adId', 'ad_name': 'adId',
        'ชื่อโฆษณา': 'adId', 'รหัสโฆษณา': 'adId', 'โฆษณา': 'adId', 'campaign': 'adId', 'campaign_name': 'adId', 'campaign id': 'adId', 'แคมเปญ': 'adId',
        'วันที่': 'date', 'วันที่สร้าง': 'date', 'วันและเวลา': 'date', 'เวลา': 'date',
        'date': 'date', 'created': 'date', 'created_time': 'date', 'created_at': 'date', 'timestamp': 'date', 'time': 'date',
        'เซลส์': 'rep', 'ผู้ดูแล': 'rep', 'พนักงาน': 'rep',
        'rep': 'rep', 'sales': 'rep', 'repid': 'rep', 'rep id': 'rep', 'owner': 'rep', 'admin': 'rep',
        'สถานะ': 'status', 'สถานะลูกค้า': 'status', 'ขั้นตอน': 'status', 'ความคืบหน้า': 'status', 'สถานะลีด': 'status', 'ขั้นตอนการขาย': 'status',
        'status': 'status', 'lead_status': 'status', 'stage': 'status', 'stage_name': 'status', 'state': 'status', 'pipeline stage': 'status', 'lead stage': 'status',
        'ยอดเงิน': 'value', 'ยอดขาย': 'value', 'ราคา': 'value', 'มูลค่า': 'value', 'value': 'value', 'amount': 'value', 'price': 'value',
        'เหตุผล': 'dropReason', 'หมายเหตุ': 'dropReason', 'reason': 'dropReason', 'note': 'dropReason', 'labels': 'dropReason', 'label': 'dropReason', 'tags': 'dropReason', 'tag': 'dropReason', 'ป้ายกำกับ': 'dropReason', 'แท็ก': 'dropReason',
        'phone': 'phone', 'phone number': 'phone', 'telephone': 'phone', 'เบอร์': 'phone', 'เบอร์โทร': 'phone',
        'email': 'email', 'email address': 'email', 'อีเมล': 'email',
        'ข้อความ': 'message', 'ข้อความล่าสุด': 'message', 'แชท': 'message', 'บทสนทนา': 'message', 'รายละเอียดข้อความ': 'message',
        'รายละเอียด': 'message', 'รายละเอียดการติดต่อ': 'message', 'ข้อความลูกค้า': 'message', 'แชทลูกค้า': 'message',
        'message': 'message', 'messages': 'message', 'chat': 'message', 'conversation': 'message', 'conversations': 'message', 'last_message': 'message', 'text': 'message',
        'details': 'message', 'description': 'message', 'inquiry': 'message', 'comment': 'message', 'comments': 'message',
        'secondary phone number': null, 'whatsapp number': null,
      };
    }

    const isHeader = firstFields.some((f) => COL_MAP[f] !== undefined);
    let headers, dataLines;
    if (isHeader) {
      // map: null หมายถึง ignore คอลัมน์นั้น (ไม่ส่งไปเซิร์ฟเวอร์)
      // ถ้าคอลัมน์ไหนไม่รู้จัก ให้ข้าม (null) แทนการเดาตามลำดับ เพื่อไม่ให้ข้อมูลสลับคอลัมน์
      headers = firstFields.map((f) => {
        if (COL_MAP[f] !== undefined) return COL_MAP[f];
        return null; // ignore unknown column
      });
      dataLines = allRows.slice(1);
    } else {
      headers = isCampaignFile ? ['campaign', 'adName', 'spend', 'impressions', 'clicks', 'date'] : ['name', 'channel', 'adId', 'date', 'status', 'rep'];
      dataLines = allRows;
    }

    return dataLines.map((vals) => {
      const obj = {};
      // ข้าม null headers (ignored columns) และ _ prefixed internal fields
      headers.forEach((h, i) => {
        if (h && !h.startsWith('_')) obj[h] = (vals[i] || '').trim();
      });
      return obj;
    }).filter((r) => r.name || r.date || r.adId || r.campaign || r.adName || r.spend || r.impressions || r.status || r.channel || r.phone || r.email || r.message);
  }

  async function doUploadData() {
    const u = S.upload;
    if (!u.rows.length || u.loading) return;
    const repCheck = document.getElementById('upload-replace-check');
    const replace = repCheck ? repCheck.checked : false; // ค่าเริ่มต้นคือ false: นำเข้าสะสม ไม่ลบของเดิม!
    const platformIn = document.getElementById('upload-platform-input');
    const pageNameIn = document.getElementById('upload-page-input');
    const platform = (platformIn ? platformIn.value : '') || u.platform || 'Facebook';
    const pageName = (pageNameIn ? pageNameIn.value.trim() : '') || u.pageName || '';

    u.loading = true; u.err = null; renderUploadBody();
    try {
      const endpoint = u.detectedType === 'campaigns' ? '/api/upload/campaigns' : '/api/upload/leads';
      const r = await api(endpoint, { method: 'POST', body: { rows: u.rows, replace, platform, pageName } });
      u.result = { ...r, type: u.detectedType };
      u.rows = []; u.err = null;
      u.summary = await api('/api/data/summary').catch(() => null);
      S.filters = null; // รีเฟรชตัวกรองเพจ/แพลตฟอร์ม
      S.dash.data = null;
    } catch (e) {
      u.err = e.message || 'เกิดข้อผิดพลาดในการนำเข้า';
    } finally {
      u.loading = false;
      renderUploadBody();
    }
  }

  function renderTabs(u) {
    return `<div class="card filters" style="margin-bottom:14px">
      <div class="seg">
        <button data-act="upload-tab" data-tab="leads" class="${u.tab === 'leads' ? 'active' : ''}">👥 นำเข้า Leads (ลูกค้า & แชท)</button>
        <button data-act="upload-tab" data-tab="campaigns" class="${u.tab === 'campaigns' ? 'active' : ''}">📊 นำเข้าแคมเปญ Ads (โชว์ Dashboard)</button>
        <button data-act="upload-tab" data-tab="images" class="${u.tab === 'images' ? 'active' : ''}">🎬 รูปภาพ & วิดีโอ Ads</button>
        <button data-act="upload-tab" data-tab="manage" class="${u.tab === 'manage' ? 'active' : ''}">⚙️ จัดการ & ลบข้อมูลในระบบ</button>
      </div>
    </div>`;
  }

  function renderImagesTab(u) {
    const ads = u.ads || [];
    return `<div class="card panel">
      <h3>🎬 จัดการรูปภาพและวิดีโอแคมเปญโฆษณา (Ad Creatives: Image & Video)</h3>
      <p class="sub">อัปโหลดไฟล์รูปภาพ (JPG, PNG, WebP) หรือไฟล์วิดีโอ (MP4, WebM) หรือวางลิงก์สื่อ เพื่อให้แสดงทั้งในหน้า Dashboard และ Quality Analysis</p>
      ${!ads.length ? `<div class="notice warn" style="margin-top:14px">ยังไม่มีข้อมูลโฆษณาในระบบ — กรุณานำเข้าไฟล์แคมเปญ Ads หรือเชื่อมต่อ Meta API ก่อน</div>` : `
      <div class="tscroll" style="margin-top:16px"><table style="min-width:720px">
        <thead><tr>
          <th class="nosort" style="width:110px">ตัวอย่างสื่อ</th>
          <th class="nosort">ชื่อโฆษณา / แคมเปญ</th>
          <th class="nosort" style="width:110px">ประเภท</th>
          <th class="nosort" style="width:270px">จัดการรูปภาพ & วิดีโอ</th>
        </tr></thead>
        <tbody>
          ${ads.map((a) => {
            const mData = esc(JSON.stringify({ id: a.id, name: a.name, campaign: a.campaign || '', creative: a.creative || 'IMAGE', thumb: a.thumb, videoUrl: a.videoUrl }));
            const isVid = Boolean(a.videoUrl) || a.creative === 'VIDEO' || a.creative === 'STORY';
            return `<tr>
            <td>
              <div class="ad-media-box" data-act="open-ad-media" data-ad-media="${mData}" title="คลิกเพื่อดูตัวอย่างรูป/เล่นวิดีโอ">
                ${a.thumb
                  ? `<img src="${esc(a.thumb)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
                  : (a.videoUrl && !String(a.videoUrl).startsWith('demo-reel:')
                      ? `<video src="${esc(a.videoUrl)}" muted playsinline preload="metadata"></video>`
                      : `<div style="width:100%;height:100%;display:grid;place-items:center;color:#a7f3d0;font-size:18px">${isVid ? '🎬' : '🖼️'}</div>`)}
                ${isVid ? `<span class="ad-media-play-badge">▶</span>` : ''}
                <span class="ad-media-type-chip">${esc(a.creative || 'IMAGE')}</span>
              </div>
            </td>
            <td>
              <b style="font-size:14.5px">${esc(a.name)}</b>
              <div class="ad-sub">${esc(a.campaign ? a.campaign + ' · ' : '')}${esc(a.id)}</div>
            </td>
            <td><span class="chip ${isVid ? 'good' : ''}" style="font-size:11.5px">${isVid ? '🎬 VIDEO' : '🖼️ ' + esc(a.creative || 'IMAGE')}</span></td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <label class="btn primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;padding:6px 12px">
                  📤 อัปโหลดรูป/วิดีโอ
                  <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" style="display:none" data-act="ad-img-file" data-ad-id="${esc(a.id)}" data-ad-name="${esc(a.name)}">
                </label>
                <button type="button" class="btn" style="font-size:12px;padding:6px 10px" data-act="prompt-ad-url" data-ad-id="${esc(a.id)}" data-ad-name="${esc(a.name)}">🔗 วางลิงก์</button>
              </div>
            </td>
          </tr>`;
          }).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  }

  function renderDataManagement(sm) {
    return `<section class="card panel" style="margin-top:16px">
      <h3>⚙️ ข้อมูลที่บันทึกอยู่ในระบบปัจจุบัน</h3>
      <p class="sub">ข้อมูลทั้งหมดจะถูกบันทึกค้างไว้ในระบบเสมอ สามารถนำเข้าสะสมเพิ่มได้เรื่อยๆ หรือเลือกลบชุดที่ไม่ต้องการได้ที่นี่</p>
      <div class="grid-4" style="margin:16px 0">
        <div class="stat"><div class="k-label">Leads (ลูกค้า) ในระบบ</div><div class="k-value">${num(sm.leadsCount || 0)} รายการ</div></div>
        <div class="stat"><div class="k-label">แคมเปญโฆษณาในระบบ</div><div class="k-value">${num(sm.campaignsCount || 0)} แคมเปญ</div></div>
        <div class="stat"><div class="k-label">โฆษณา (Ads) ในระบบ</div><div class="k-value">${num(sm.adsCount || 0)} รายการ</div></div>
        <div class="stat"><div class="k-label">งบโฆษณาสะสม (Spend)</div><div class="k-value" style="color:var(--brand)">${baht(sm.totalSpend || 0)}</div></div>
      </div>
      <div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border-radius:12px;border:1px solid var(--line-soft)">
        <b style="display:block;font-size:14.5px;margin-bottom:6px">📥 ดาวน์โหลด & สำรองข้อมูล (Export / Backup)</b>
        <p class="sub" style="margin-bottom:12px">เปิดเว็บมาจะเจอข้อมูลเก่าและสามารถดาวน์โหลดเก็บเป็นไฟล์ CSV หรือสำรองข้อมูลทั้งหมดได้ทันที</p>
        <div class="row-actions">
          <a class="btn" href="/api/export/leads" download style="display:inline-flex;align-items:center;gap:6px">📥 ดาวน์โหลด Leads เป็น CSV</a>
          <a class="btn" href="/api/export/campaigns" download style="display:inline-flex;align-items:center;gap:6px">📥 ดาวน์โหลดแคมเปญ Ads เป็น CSV</a>
          <a class="btn primary" href="/api/export/backup" download style="display:inline-flex;align-items:center;gap:6px">📦 สำรองข้อมูลทั้งหมด (Full JSON)</a>
        </div>
      </div>
      <div class="row-actions" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line-soft)">
        <button class="btn danger" data-act="clear-data" data-target="leads">🗑️ ล้างข้อมูล Leads ทั้งหมด</button>
        <button class="btn danger" data-act="clear-data" data-target="campaigns">🗑️ ล้างข้อมูลแคมเปญ Ads ทั้งหมด</button>
        <button class="btn danger" data-act="clear-data" data-target="all" style="background:#fff0f0">⚠️ ล้างข้อมูลทั้งหมดในระบบ</button>
      </div>
    </section>`;
  }

  function renderPlatformPageInputs(u) {
    const rawPages = (S.filters && S.filters.pages) || [];
    const pages = rawPages.filter(isValidPage);
    const curPlatform = u.platform || 'Facebook';
    const curPage = u.pageName || '';
    return `<div class="grid-2" style="margin:14px 0 16px;background:#f8faf6;padding:14px 16px;border-radius:12px;border:1px solid var(--line-soft)">
      <div class="field" style="margin-bottom:0">
        <label style="font-weight:600">🌐 แพลตฟอร์มหลักของไฟล์นี้</label>
        <div class="sel" style="width:100%"><select id="upload-platform-input" style="width:100%">
          <option value="Facebook" ${curPlatform === 'Facebook' ? 'selected' : ''}>🔵 Facebook</option>
          <option value="Instagram" ${curPlatform === 'Instagram' ? 'selected' : ''}>📸 Instagram</option>
          <option value="LINE" ${curPlatform === 'LINE' ? 'selected' : ''}>🟢 LINE Official Account</option>
          <option value="WhatsApp" ${curPlatform === 'WhatsApp' ? 'selected' : ''}>💚 WhatsApp Business</option>
          <option value="Direct" ${curPlatform === 'Direct' ? 'selected' : ''}>🌐 Direct / อื่นๆ</option>
        </select></div>
        <small>ระบุแพลตฟอร์ม (หากในไฟล์มีคอลัมน์ แพลตฟอร์ม / ช่องทาง ระบบจะตรวจจับ Facebook หรือ Instagram แยกให้ตามแต่ละแถว)</small>
      </div>
      <div class="field" style="margin-bottom:0">
        <label style="font-weight:600">📄 ชื่อเพจ / บัญชี (Page Name)</label>
        <input type="text" id="upload-page-input" placeholder="เช่น Pavicon Hair Clinic, dr.nay_hairtransplant" value="${esc(curPage)}" list="known-pages-list">
        <datalist id="known-pages-list">
          ${pages.map((p) => `<option value="${esc(p.name)}">${p.platform === 'Instagram' ? '📸 ' : '🔵 '}${esc(p.name)}</option>`).join('')}
        </datalist>
        <small>พิมพ์หรือเลือกชื่อเพจ เพื่อแยกดูใน Inbox และแยกตัวกรองตามเพจ</small>
      </div>
    </div>`;
  }

  function renderSheetsSyncCard(u) {
    const lastUrl = (S.settings && S.settings.sheets && S.settings.sheets.lastUrl) || 'https://docs.google.com/spreadsheets/d/1hDT2bqqFFCPdiZn0K7pJVXjo-KmUgjgaLtMOpcONjpk/edit?usp=sharing';
    const lastSync = (S.settings && S.settings.sheets && S.settings.sheets.lastSyncAt) || null;
    return `<div class="card panel sheets-sync-box" style="margin-bottom:16px;background:linear-gradient(135deg, #fafffa 0%, #f0f7ef 100%);border:1.5px solid #c2e2be">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <h3 style="margin:0;color:#244c1d;display:flex;align-items:center;gap:8px">📊 เชื่อมต่อ Google Sheets (ซิงค์ข้อมูลสด)</h3>
        <span class="chip good">Google Sheets Sync</span>
      </div>
      <p class="sub">เชื่อมฐานข้อมูล Google Sheets ไว้ได้ เพียงวางลิงก์ (แชร์ Anyone with the link หรือ Publish to web) แล้วกดซิงค์ ข้อมูลจะถูกดูดมาลงระบบทันที</p>
      <form class="form" data-form="sheets-sync" style="margin-top:12px">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div class="field" style="flex:1;min-width:280px;margin-bottom:0">
            <label>Google Sheet URL ${lastSync ? `<small class="rv-hint">(ซิงค์ล่าสุด: ${esc(fmtTs(lastSync).slice(0, 16))})</small>` : ''}</label>
            <input type="url" name="sheetUrl" id="sheets-url-input" placeholder="https://docs.google.com/spreadsheets/d/.../edit" value="${esc(lastUrl)}" required>
          </div>
          <button class="btn primary" type="submit" id="btn-sync-sheets" style="background:#2d5022;white-space:nowrap;padding:10px 18px">
            📥 ซิงค์จาก Google Sheet ทันที
          </button>
        </div>
        <small style="display:block;margin-top:6px;color:var(--muted)">
          * ข้อมูลจาก Google Sheet จะถูกบันทึกเข้าแท็บ <b>${u.tab === 'campaigns' ? 'แคมเปญ Ads' : 'Leads ลูกค้า'}</b> ตามแพลตฟอร์มและชื่อเพจที่ระบุด้านล่าง
        </small>
      </form>
    </div>`;
  }

  function renderUploadBody() {
    const $el = document.getElementById('upload-body'); if (!$el) return;
    const u = S.upload;
    const sm = u.summary || { leadsCount: 0, campaignsCount: 0, adsCount: 0, totalSpend: 0 };

    // Result view
    if (u.result) {
      const r = u.result;
      const isCamp = r.type === 'campaigns';
      $el.innerHTML = `<div class="card panel">
        <h3>${icon('check')} นำเข้าข้อมูล${isCamp ? 'แคมเปญโฆษณา' : 'Leads'}สำเร็จ</h3>
        <div class="grid-4" style="margin:16px 0">
          <div class="stat"><div class="k-label">นำเข้าสำเร็จ</div><div class="k-value" style="color:var(--brand)">${num(r.added)} แถว</div></div>
          ${isCamp ? `<div class="stat"><div class="k-label">แคมเปญสะสม</div><div class="k-value">${num(r.campaigns)}</div></div>
          <div class="stat"><div class="k-label">โฆษณา (Ads) สะสม</div><div class="k-value">${num(r.ads)}</div></div>` : `
          <div class="stat"><div class="k-label">ข้อผิดพลาด</div><div class="k-value" style="color:${r.errors && r.errors.length ? 'var(--coral)' : 'var(--muted)'}">${num(r.errors ? r.errors.length : 0)}</div></div>`}
        </div>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn" data-act="upload-reset">${icon('refresh')} นำเข้าไฟล์เพิ่ม</button>
          ${isCamp ? '<a class="btn primary" href="#/dashboard">ไปดู Dashboard ทันที</a>' : '<a class="btn primary" href="#/board">ไปดู Board</a><a class="btn" href="#/inbox">ไปดู Inbox</a>'}
        </div>
      </div>${renderDataManagement(sm)}${historyHtml(u)}`;
      return;
    }

    const errHtml = u.err ? `<div class="notice err" style="margin-bottom:14px">${esc(u.err)}</div>` : '';

    // Preview table
    if (u.rows.length) {
      const rows = u.rows.slice(0, 20);
      const isCamp = u.detectedType === 'campaigns';
      $el.innerHTML = `${errHtml}<div class="card panel">
        <h3>${icon('upload')} ตรวจสอบข้อมูลก่อนนำเข้า (${isCamp ? '📊 ข้อมูลแคมเปญ/โฆษณา' : '👥 รายชื่อลูกค้า Leads'})</h3>
        <p class="sub">พบ ${num(u.rows.length)} แถว${u.rows.length > 20 ? ' (แสดง 20 แรก)' : ''}</p>
        ${renderPlatformPageInputs(u)}
        <div class="tscroll">${isCamp ? `
          <table style="min-width:760px"><thead><tr>
            <th class="nosort">#</th><th class="nosort">แคมเปญ</th><th class="nosort">ชื่อโฆษณา</th>
            <th class="nosort">งบที่ใช้ (Spend)</th><th class="nosort">การแสดงผล (Impressions)</th><th class="nosort">คลิก (Clicks)</th><th class="nosort">วันที่</th>
          </tr></thead><tbody>
            ${rows.map((r, i) => `<tr><td class="nowrap" style="color:var(--muted)">${i + 1}</td>
              <td><b>${esc(r.campaign || '—')}</b></td>
              <td>${esc(r.adName || r.adId || '—')}</td>
              <td>${r.spend ? baht(r.spend) : '฿0'}</td>
              <td>${num(r.impressions || 0)}</td>
              <td>${num(r.clicks || 0)}</td>
              <td>${esc(r.date || '—')}</td></tr>`).join('')}
          </tbody></table>` : `
          <table style="min-width:860px"><thead><tr>
            <th class="nosort">#</th><th class="nosort">ชื่อลูกค้า</th>
            <th class="nosort">แพลตฟอร์ม</th><th class="nosort">เพจ / บัญชี</th><th class="nosort">ช่องทาง</th>
            <th class="nosort">โฆษณา / แคมเปญ</th><th class="nosort">วันที่</th><th class="nosort">สถานะบน Board</th><th class="nosort">เซลส์</th>
          </tr></thead><tbody>
            ${rows.map((r, i) => {
              const isIg = Boolean(
                (r.platform && /ig|instagram/i.test(r.platform)) ||
                (r.channel && /ig|instagram/i.test(r.channel)) ||
                (u.platform && /ig|instagram/i.test(u.platform)) ||
                (r.pageName && /ig|instagram|dr\.nay/i.test(r.pageName))
              );
              let plat = isIg ? 'Instagram' : (r.platform || u.platform || (r.channel && /line/i.test(r.channel) ? 'LINE' : r.channel && /whatsapp|wa/i.test(r.channel) ? 'WhatsApp' : 'Facebook'));
              const platBadge = plat === 'Instagram' ? '<span class="chip" style="background:#fce7f3;color:#be185d;border:1px solid #fbcfe8;font-weight:700">📸 Instagram</span>'
                : plat === 'Facebook' ? '<span class="chip" style="background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;font-weight:700">🔵 Facebook</span>'
                : plat === 'LINE' ? '<span class="chip" style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;font-weight:700">🟢 LINE</span>'
                : plat === 'WhatsApp' ? '<span class="chip" style="background:#d1fae5;color:#047857;border:1px solid #a7f3d0;font-weight:700">💚 WhatsApp</span>'
                : `<span class="chip">${esc(plat)}</span>`;
              const pageDisp = r.pageName || u.pageName || (plat === 'Instagram' ? ((u.pageName && u.pageName.toLowerCase().includes('beq')) ? 'beq_wellness' : 'dr.nay_hairtransplant') : (plat === 'Facebook' ? (u.pageName || 'Pavicon Hair Clinic') : plat));
              return `<tr>
                <td class="nowrap" style="color:var(--muted)">${i + 1}</td>
                <td><b>${esc(r.name || '—')}</b></td>
                <td>${platBadge}</td>
                <td style="font-size:12.5px;color:var(--ink-2)">${esc(pageDisp)}</td>
                <td><span style="font-size:12px;color:var(--muted)">${esc(r.channel || (plat === 'Instagram' ? 'Instagram' : 'Messenger'))}</span></td>
                <td style="font-size:13px">${esc(r.adId || '—')}</td>
                <td>${esc(r.date || '—')}</td>
                <td><span class="q-badge q-average">${esc(r.status || 'พอได้คุย')}</span></td>
                <td>${esc(r.rep || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody></table>`}</div>
        <div style="margin:16px 0 6px">
          <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="upload-replace-check">
            <span>แทนที่ข้อมูลเดิมทั้งหมด (ถ้าไม่ติ๊ก ระบบจะ<b>นำเข้าสะสมต่อจากของเดิม</b>ให้โดยไม่ลบข้อมูลเก่า)</span>
          </label>
        </div>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn primary" data-act="upload-confirm" ${u.loading ? 'disabled' : ''}>${u.loading ? 'กำลังนำเข้า…' : `${icon('check')} ยืนยันนำเข้า ${num(u.rows.length)} รายการ`}</button>
          <button class="btn" data-act="upload-cancel" ${u.loading ? 'disabled' : ''}>ยกเลิก</button>
        </div>
      </div>`;
      return;
    }

    // Default upload view with tabs
    const isCampTab = u.tab === 'campaigns';
    const isImagesTab = u.tab === 'images';
    const isManageTab = u.tab === 'manage';

    if (isManageTab) {
      $el.innerHTML = `${errHtml}${renderTabs(u)}${renderDataManagement(sm)}${historyHtml(u)}`;
      return;
    }

    if (isImagesTab) {
      $el.innerHTML = `${errHtml}${renderTabs(u)}${renderImagesTab(u)}`;
      return;
    }

    $el.innerHTML = `${errHtml}${renderTabs(u)}${renderSheetsSyncCard(u)}<div class="card panel">
      <h3>${icon('upload')} ${isCampTab ? 'อัปโหลดรายงานแคมเปญโฆษณา (Campaign & Ads Performance)' : 'อัปโหลดรายชื่อลูกค้าและแชท (Leads)'}</h3>
      <p class="sub">${isCampTab ? 'นำเข้าไฟล์ Export จาก Facebook Ads Manager (มีงบโฆษณา, คลิก, ยอดแสดงผล) เพื่อให้หน้า Dashboard แสดงผลตัวเลขและกราฟจริง' : 'นำเข้าไฟล์รายชื่อลูกค้าและสถานะ เพื่อให้ไปแสดงบนหน้า Board และ Inbox'}</p>
      ${renderPlatformPageInputs(u)}
      <label class="upload-zone" id="upload-zone">
        <input type="file" id="upload-file-input" accept=".csv,.tsv,.txt">
        ${icon('upload')}
        <b>ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</b>
        <span style="font-size:14px">รองรับ .csv / .tsv — นำเข้าสะสมได้หลายครั้ง ข้อมูลไม่หาย</span>
      </label>
      <div style="margin-top:18px">
        <b style="font-size:14px;color:var(--ink-2)">ตัวอย่างคอลัมน์ที่รองรับ (${isCampTab ? 'รายงานโฆษณา Ads Manager' : 'ข้อมูลลูกค้า Leads'})</b>
        <pre class="upload-code-hint">${isCampTab ? `ชื่อแคมเปญ,ชื่อโฆษณา,งบประมาณ,การแสดงผล,คลิก,วันที่
FUE Hair Transplant,FUE-Reels-01,15000,85000,2100,2026-11-01
PRP Treatment,PRP-Promo-50,8500,42000,1200,2026-11-02` : `ชื่อ,ช่องทาง,โฆษณา,วันที่,สถานะ,เซลส์
สมชาย ใจดี,Messenger,FUE-Reels-01,2026-11-01,กำลังดำเนินการ,นก
สมหญิง รักดี,LINE,PRP-Promo-50,2026-11-02,มีคุณสมบัติ,มิ้นท์`}</pre>
        <p class="sub" style="margin-top:8px">
          • รองรับหัวคอลัมน์ภาษาไทยและอังกฤษจาก Facebook Ads Manager / Google Sheets โดยอัตโนมัติ<br>
          • นำเข้าเพิ่มได้เรื่อยๆ โดยข้อมูลเก่าจะยังค้างอยู่ในระบบ หากต้องการล้างข้อมูลสามารถกดที่แท็บ "จัดการ & ลบข้อมูล" ได้ครับ
        </p>
      </div>
    </div>${renderDataManagement(sm)}${historyHtml(u)}`;

    // Bind drag & drop
    const zone = document.getElementById('upload-zone');
    if (zone) {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) handleUploadFile(f); });
    }
    const fi = document.getElementById('upload-file-input');
    if (fi) fi.addEventListener('change', (e) => { if (e.target.files[0]) handleUploadFile(e.target.files[0]); });
  }

  function historyHtml(u) {
    if (!u.data || !u.data.history || !u.data.history.length) return '';
    return `<section class="card table-card" style="margin-top:16px">
      <div class="table-head"><div><h2>ประวัติการนำเข้าล่าสุด</h2></div></div>
      <div class="tscroll"><table style="min-width:500px"><thead><tr>
        <th class="nosort">วันที่/เวลา</th><th class="nosort">ผู้นำเข้า</th><th class="nosort">ประเภท</th><th class="nosort">จำนวน</th>
      </tr></thead><tbody>
        ${u.data.history.map((h) => `<tr>
          <td>${esc(h.at ? fmtTs(h.at).slice(0, 16) : '—')}</td>
          <td>${esc(h.user || '—')}</td>
          <td><span class="q-badge ${h.action === 'campaigns_upload' ? 'q-good' : 'q-average'}">${h.action === 'campaigns_upload' ? 'แคมเปญ Ads' : 'Leads'}</span></td>
          <td>${num(h.count)}</td>
        </tr>`).join('')}
      </tbody></table></div>
    </section>`;
  }

  
  /* ═══════════════════════════════════════════
     COMMENTS & SLA PAGE — โพสต์และคอมเมนต์ + คำนวณ SLA
  ═══════════════════════════════════════════ */
  function commentsShell() {
    return `<div class="page-head">
      <div>
        <h1>Post & comment</h1>
        <div class="meta-line"><span>ตรวจสอบคอมเมนต์ใต้โพสต์ Facebook & Instagram พร้อมคิดคะแนน SLA การตอบกลับ (แยกกับแชท)</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn primary" data-act="sync-comments-api" style="background:#2d5022">🔄 ดึงโพสต์ & คอมเมนต์ล่าสุด</button>
      </div>
    </div>
    ${rangeBar('comments')}
    <div id="comments-body" style="margin-top:16px"><div class="loading">Loading…</div></div>`;
  }

  async function loadComments() {
    if (!S.comments) S.comments = { data: null, loading: false, err: null, range: '30d', from: '', to: '', filterStatus: 'all' };
    const c = S.comments;
    c.loading = true; c.err = null; renderCommentsBody();
    try {
      const q = new URLSearchParams({ range: c.range || '30d' });
      if (c.range === 'custom') { q.set('from', c.from); q.set('to', c.to); }
      if (S.dash.platform) q.set('platform', S.dash.platform);
      if (S.dash.page) q.set('pageId', S.dash.page);
      const res = await api('/api/posts-comments?' + q.toString());
      c.data = res || { posts: [], sla: {} };
      c.loading = false;
    } catch (e) {
      console.error('loadComments error:', e);
      c.err = e.message || 'โหลดข้อมูลคอมเมนต์ไม่สำเร็จ';
      c.loading = false;
    }
    renderCommentsBody();
  }

  function renderCommentsBody() {
    const box = document.getElementById('comments-body'); if (!box) return;
    if (!S.comments) S.comments = { data: null, loading: false, err: null, range: '30d', from: '', to: '', filterStatus: 'all' };
    const c = S.comments;
    if (c.err) { box.innerHTML = `<div class="notice err">${esc(c.err)}</div>`; return; }
    if (c.loading && !c.data) { box.innerHTML = '<div class="loading">Loading…</div>'; return; }
    if (!c.data) { box.innerHTML = '<div class="empty">กำลังโหลดข้อมูล หรือกด "🔄 ดึงโพสต์ & คอมเมนต์ล่าสุด"</div>'; return; }

    const { posts = [], sla = {} } = c.data;
    const totals = sla.totals || { turns: 0, onTime: 0, late: 0, deducted: 0, points: 0 };

    let totalComments = 0;
    let repliedCount = 0;
    let pendingCount = 0;
    let noCommCount = 0;

    posts.forEach((p) => {
      const comms = p.comments || [];
      if (comms.length === 0) {
        noCommCount++;
      } else {
        comms.forEach((cm) => {
          totalComments++;
          if (cm.replied) repliedCount++;
          else pendingCount++;
        });
      }
    });

    let filteredPosts = posts;
    if (c.filterStatus === 'pending') {
      filteredPosts = posts.filter((p) => (p.comments || []).some((cm) => !cm.replied));
    } else if (c.filterStatus === 'replied') {
      filteredPosts = posts.filter((p) => (p.comments || []).some((cm) => cm.replied));
    } else if (c.filterStatus === 'no-comment') {
      filteredPosts = posts.filter((p) => !(p.comments || []).length);
    }

    box.innerHTML = `
      <!-- SLA Score Card -->
      <section class="card panel" style="margin-bottom:16px;background:linear-gradient(135deg,#fafffa 0%,#f0fdf4 100%);border:1.5px solid #bbf7d0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0;color:#166534;display:flex;align-items:center;gap:8px">⏱️ ผลงานตอบคอมเมนต์ (Comment SLA) — เกณฑ์ 60 นาที · หัก 0.5 แต้ม</h3>
          <span class="chip good">SLA แยกเฉพาะคอมเมนต์</span>
        </div>
        <div class="grid-4">
          <div class="stat"><div class="k-label">โพสต์ทั้งหมดที่ดึงมา</div><div class="k-value">${num(posts.length)}</div></div>
          <div class="stat"><div class="k-label">คอมเมนต์จริงทั้งหมด</div><div class="k-value">${num(totalComments)}</div></div>
          <div class="stat"><div class="k-label">ตอบแล้ว</div><div class="k-value" style="color:#16a34a">${num(repliedCount)}</div></div>
          <div class="stat"><div class="k-label">ยังไม่ตอบ</div><div class="k-value" style="color:${pendingCount ? '#dc2626' : 'var(--muted)'}">${num(pendingCount)}</div></div>
        </div>
      </section>

      <!-- Filter Tabs -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div class="seg">
          <button class="${c.filterStatus === 'all' ? 'active' : ''}" data-act="c-filter" data-val="all">โพสต์ทั้งหมด (${posts.length})</button>
          <button class="${c.filterStatus === 'pending' ? 'active' : ''}" data-act="c-filter" data-val="pending" style="color:#b91c1c">🔴 คอมเมนต์ยังไม่ตอบ (${pendingCount})</button>
          <button class="${c.filterStatus === 'replied' ? 'active' : ''}" data-act="c-filter" data-val="replied" style="color:#15803d">🟢 คอมเมนต์ตอบแล้ว (${repliedCount})</button>
          <button class="${c.filterStatus === 'no-comment' ? 'active' : ''}" data-act="c-filter" data-val="no-comment" style="color:var(--muted)">⚪ โพสต์ที่ยังไม่มีคอมเมนต์ (${noCommCount})</button>
        </div>
      </div>

      <!-- Post & Nested Comments List -->
      <div class="post-feed" style="display:flex;flex-direction:column;gap:16px">
        ${!filteredPosts.length ? '<div class="empty">ไม่มีโพสต์ในหมวดหมู่นี้ หรือกด "🔄 ดึงโพสต์ & คอมเมนต์ล่าสุด" เพื่อโหลดข้อมูลจาก Meta</div>' :
          filteredPosts.map((p) => {
            const platName = p.platform === 'Instagram' ? 'Instagram' : 'Facebook';
            const logoSvg = getBrandLogo(platName, 18);
            const comms = p.comments || [];
            let displayComms = comms;
            if (c.filterStatus === 'pending') displayComms = comms.filter((cm) => !cm.replied);
            else if (c.filterStatus === 'replied') displayComms = comms.filter((cm) => cm.replied);
            const postPending = comms.filter((cm) => !cm.replied).length;
            const hasComms = comms.length > 0;
            const borderColor = hasComms ? (postPending > 0 ? '#fecaca' : '#bbf7d0') : '#e2e8f0';
            const headerBg = hasComms ? (postPending > 0 ? '#fff8f8' : '#f4fbf5') : '#f8fafc';

            return `
              <div class="card" style="padding:0;overflow:hidden;border:1.5px solid ${borderColor};border-radius:12px;background:#ffffff">
                <div style="padding:14px 18px;background:${headerBg};border-bottom:1px solid ${borderColor};display:flex;align-items:flex-start;gap:12px">
                  <div style="flex:0 0 auto;padding-top:2px">${logoSvg}</div>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                      <span style="font-weight:700;font-size:13px;color:var(--ink, #0f172a)">${esc(platName)}</span>
                      <span style="color:var(--muted);font-size:12px">· ${esc(p.pageName || p.pageId)}</span>
                      <span style="color:var(--muted);font-size:11.5px">· ${esc(p.timestamp ? p.timestamp.slice(0, 16).replace('T', ' ') : '—')}</span>
                      ${hasComms
                        ? `<span class="q-badge ${postPending > 0 ? 'q-poor' : 'q-good'}" style="margin-left:auto;font-size:11px">${postPending > 0 ? `🔴 ยังไม่ตอบ ${postPending}` : '🟢 ตอบครบแล้ว'}</span>`
                        : '<span class="rv-hint" style="margin-left:auto;font-size:11px">⚪ ยังไม่มีคอมเมนต์</span>'}
                    </div>
                    <div style="font-size:13.5px;color:var(--ink-1, #1e293b);line-height:1.5;margin-bottom:8px;word-break:break-word">
                      ${esc(String(p.content || '').slice(0, 240))}${(p.content || '').length > 240 ? '…' : ''}
                    </div>
                    ${(p.videoUrl || p.mediaUrl) ? `
                      <div style="margin:8px 0 10px;max-width:340px;border-radius:10px;overflow:hidden;border:1px solid #d3e7da;background:#022c22">
                        ${p.videoUrl
                          ? `<video src="${esc(p.videoUrl)}" ${p.mediaUrl ? `poster="${esc(p.mediaUrl)}"` : ''} controls playsinline preload="metadata" style="width:100%;max-height:220px;display:block"></video>`
                          : `<a href="${esc(p.mediaUrl)}" target="_blank" rel="noopener"><img src="${esc(p.mediaUrl)}" alt="" referrerpolicy="no-referrer" loading="lazy" style="width:100%;max-height:220px;object-fit:cover;display:block"></a>`}
                      </div>
                    ` : ''}
                    <div style="display:flex;align-items:center;gap:12px;font-size:11.5px">
                      ${p.permalink ? `<a href="${esc(p.permalink)}" target="_blank" style="color:var(--brand);font-weight:600;display:inline-flex;align-items:center;gap:4px">🔗 เปิดโพสต์จริงบน ${esc(platName)}</a>` : ''}
                      <span style="color:var(--muted)">💬 ${comms.length} คอมเมนต์</span>
                    </div>
                  </div>
                </div>

                <!-- Comments section directly under this post -->
                <div style="padding:12px 18px">
                  ${!displayComms.length
                    ? `<div style="padding:10px 0;color:var(--muted);font-size:12.5px;font-style:italic">${hasComms ? 'ไม่มีคอมเมนต์ในเงื่อนไขการกรองนี้' : 'ยังไม่มีคอมเมนต์ใต้โพสต์นี้'}</div>`
                    : `<div style="display:flex;flex-direction:column;gap:12px">
                        ${displayComms.map((cm, idx) => {
                          const reply = cm.replies && cm.replies[0];
                          const isLast = idx === displayComms.length - 1;
                          return `
                            <div style="padding-bottom:${isLast ? '0' : '12px'};border-bottom:${isLast ? 'none' : '1px dashed #e2e8f0'};display:flex;gap:10px;align-items:flex-start">
                              <div style="width:30px;height:30px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#475569;flex:0 0 30px">
                                ${esc(String(cm.from || 'U')[0].toUpperCase())}
                              </div>
                              <div style="flex:1;min-width:0">
                                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px">
                                  <b style="font-size:13px;color:var(--ink, #0f172a)">${esc(cm.from || 'ผู้ใช้งาน')}</b>
                                  <span style="font-size:11px;color:var(--muted)">${esc(cm.timestamp ? cm.timestamp.slice(0, 16).replace('T', ' ') : '—')}</span>
                                  <span class="q-badge ${cm.replied ? 'q-good' : 'q-poor'}" style="font-size:10px;padding:1px 6px">
                                    ${cm.replied ? '🟢 ตอบแล้ว' : '🔴 ยังไม่ตอบ'}
                                  </span>
                                </div>
                                <div style="font-size:13px;color:var(--ink-2, #334155);line-height:1.45;word-break:break-word">
                                  ${esc(cm.text || '')}
                                </div>
                                ${reply ? `
                                  <div style="margin-top:8px;padding:8px 12px;background:#f8fafc;border-left:3px solid #3b82f6;border-radius:6px;font-size:12.5px">
                                    <div style="font-weight:600;color:#2563eb;font-size:11.5px;margin-bottom:2px">💬 ทีมงานตอบกลับ: ${esc(reply.from || 'ทีมงาน')}</div>
                                    <div style="color:var(--ink-1, #1e293b)">${esc(reply.text || '')}</div>
                                    <div style="font-size:10.5px;color:var(--muted);margin-top:2px">${esc(reply.timestamp ? reply.timestamp.slice(0, 16).replace('T', ' ') : '')}</div>
                                  </div>
                                ` : ''}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>`
                  }
                </div>
              </div>
            `;
          }).join('')
        }
      </div>
    `;
  }

  /* ═══════════════════════════════════════════
     AD CREATIVE MEDIA & 360° CAMPAIGN INSPECTOR
  ═══════════════════════════════════════════ */
  const OBJECTIVE_TH = {
    OUTCOME_ENGAGEMENT: '💬 ทักแชท / มีส่วนร่วม (Engagement)',
    OUTCOME_LEADS: '🧲 รวบรวมรายชื่อลีด (Leads)',
    OUTCOME_SALES: '🛒 ยอดขาย / คอนเวอร์ชัน (Sales)',
    OUTCOME_TRAFFIC: '🔗 จำนวนผู้เข้าชม (Traffic)',
    OUTCOME_AWARENESS: '📢 การรับรู้แบรนด์ (Awareness)',
    MESSAGES: '💬 ข้อความทักแชท (Messages)',
    LEAD_GENERATION: '🧲 รวบรวมลีด (Lead Gen)',
    CONVERSIONS: '🛒 คอนเวอร์ชัน (Conversions)',
    VIDEO_VIEWS: '🎬 การรับชมวิดีโอ (Video Views)',
    POST_ENGAGEMENT: '👍 การมีส่วนร่วมโพสต์',
  };
  const OPT_GOAL_TH = {
    CONVERSATIONS: '💬 การสนทนาทางข้อความ',
    THRUPLAY: '🎬 รับชมวิดีโอ ThruPlay (15s)',
    LEAD_GENERATION: '🧲 รายชื่อลูกค้า (Leads)',
    QUALITY_LEAD: '✨ ลีดคุณภาพสูง (Quality Leads)',
    OFFSITE_CONVERSIONS: '🛒 คอนเวอร์ชันบนเว็บ/แชท',
    LINK_CLICKS: '🔗 การคลิกลิงก์',
    REACH: '📢 การเข้าถึง (Reach)',
    IMPRESSIONS: '👁 การแสดงผล',
    POST_ENGAGEMENT: '👍 การมีส่วนร่วมโพสต์',
  };
  const CTA_TH = {
    SEND_MESSAGE: '💬 ส่งข้อความ (Send Message)',
    LEARN_MORE: '🔗 เรียนรู้เพิ่มเติม (Learn More)',
    BOOK_NOW: '📅 จองเลย (Book Now)',
    BOOK_TRAVEL: '📅 จองคิว (Book Now)',
    SIGN_UP: '📝 ลงทะเบียน (Sign Up)',
    CONTACT_US: '📞 ติดต่อเรา (Contact Us)',
    APPLY_NOW: '📋 สมัครเลย (Apply Now)',
    SHOP_NOW: '🛍 ซื้อเลย (Shop Now)',
    WHATSAPP_MESSAGE: '💚 ทัก WhatsApp',
  };

  function statusBadgeHtml(st) {
    const s = String(st || 'ACTIVE').toUpperCase();
    const isAct = s === 'ACTIVE';
    const isPaused = s.includes('PAUSED');
    const bg = isAct ? '#dcfce7' : isPaused ? '#fef3c7' : '#f1f5f9';
    const col = isAct ? '#15803d' : isPaused ? '#b45309' : '#475569';
    const bdr = isAct ? '#86efac' : isPaused ? '#fde68a' : '#cbd5e1';
    const dot = isAct ? '🟢' : isPaused ? '⏸' : '⚪';
    const lbl = isAct ? 'ACTIVE (กำลังรัน)' : isPaused ? 'PAUSED (หยุดพัก)' : s;
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:${bg};color:${col};border:1px solid ${bdr};white-space:nowrap">${dot} ${esc(lbl)}</span>`;
  }

  function adMediaThumbHtml(r) {
    const cType = String(r.creative || 'IMAGE').toUpperCase();
    const isVid = Boolean(r.videoUrl) || cType === 'VIDEO' || cType === 'STORY';
    const isRealVideoUrl = Boolean(r.videoUrl && !String(r.videoUrl).startsWith('demo-reel:'));
    const mediaPayload = esc(JSON.stringify(r));

    return `<div class="ad-media-cell">
      <div class="ad-media-box" data-act="open-ad-media" data-ad-media="${mediaPayload}" title="คลิกเพื่อดูข้อมูลแคมเปญครบ 360° + รูป/วิดีโอโฆษณา">
        ${isRealVideoUrl && !r.thumb
          ? `<video src="${esc(r.videoUrl)}" muted loop playsinline preload="metadata"></video>`
          : (r.thumb
              ? `<img src="${esc(r.thumb)}" alt="${esc(r.name)}" referrerpolicy="no-referrer" loading="lazy">`
              : `<div style="width:100%;height:100%;display:grid;place-items:center;color:#a7f3d0;font-size:18px">${isVid ? '🎬' : cType === 'CAROUSEL' ? '📑' : '🖼️'}</div>`)}
        ${isVid ? `<span class="ad-media-play-badge">▶</span>` : ''}
        <span class="ad-media-type-chip">${isVid ? '🎬 ' + cType : '🖼️ ' + cType}</span>
        <label class="ad-media-upload-mini" title="อัปโหลดเปลี่ยนรูป/วิดีโอ">
          📷
          <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" style="display:none" data-act="dash-ad-img" data-ad-id="${esc(r.id)}" data-ad-name="${esc(r.name)}">
        </label>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span class="creative-lbl" style="font-weight:700;font-size:12px;color:#064e3b">${isVid ? '🎬 Video / Reel' : cType === 'CAROUSEL' ? '📑 Carousel' : '🖼️ Image'}</span>
        <button type="button" class="btn" data-act="open-ad-media" data-ad-media="${mediaPayload}" style="padding:3px 10px;font-size:11px;border-radius:999px;background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;font-weight:700;display:inline-flex;align-items:center;gap:4px">
          ${isVid ? '▶ เล่นวิดีโอ & ดูข้อมูล' : '🔍 ดูรูป & ข้อมูลครบ'}
        </button>
      </div>
    </div>`;
  }

  let _demoReelAnimId = null;
  function closeAdMediaModal() {
    if (_demoReelAnimId) { cancelAnimationFrame(_demoReelAnimId); _demoReelAnimId = null; }
    const old = document.getElementById('ad-media-modal-root');
    if (old) old.remove();
  }

  function openAdMediaModal(r) {
    closeAdMediaModal();
    const cType = String(r.creative || 'IMAGE').toUpperCase();
    const isVid = Boolean(r.videoUrl) || cType === 'VIDEO' || cType === 'STORY';
    const isRealVideoUrl = Boolean(r.videoUrl && !String(r.videoUrl).startsWith('demo-reel:'));
    const objLabel = OBJECTIVE_TH[r.objective] || r.objective || '💬 ข้อความทักแชท';
    const optLabel = OPT_GOAL_TH[r.optimizationGoal] || r.optimizationGoal || '💬 การสนทนา';
    const ctaLabel = CTA_TH[r.cta] || r.cta || '💬 SEND_MESSAGE';
    const budgetText = r.dailyBudget ? `${baht(r.dailyBudget)} / วัน` : (r.lifetimeBudget ? `${baht(r.lifetimeBudget)} (ตลอดอายุ)` : 'ใช้ตามงบแคมเปญ (CBO)');

    const wrap = document.createElement('div');
    wrap.id = 'ad-media-modal-root';
    wrap.className = 'ad-media-modal-overlay';
    wrap.innerHTML = `
      <div class="ad-media-modal" style="max-width:1020px;max-height:92vh;overflow-y:auto">
        <div class="ad-media-modal-head" style="position:sticky;top:0;z-index:10;background:#f8fcf9">
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${statusBadgeHtml(r.status)}
              <span class="chip good" style="font-size:11px">${isVid ? '🎬 VIDEO AD' : '🖼️ ' + esc(cType) + ' AD'}</span>
              <b style="font-size:16px;color:#064e3b">${esc(r.name)}</b>
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">
              📊 แคมเปญ: <b>${esc(r.campaign || '—')}</b>${r.adset ? ' · 🎯 ชุดโฆษณา: <b>' + esc(r.adset) + '</b>' : ''} · 📄 เพจ: <b>${esc(r.page || '—')}</b> · ID: <code>${esc(r.id)}</code>
            </div>
          </div>
          <button type="button" class="icon-btn" data-act="close-ad-media" aria-label="ปิด">✕</button>
        </div>

        <div class="ad-media-stage" id="ad-media-stage-box" style="min-height:240px;max-height:380px">
          ${isRealVideoUrl
            ? `<video src="${esc(r.videoUrl)}" ${r.thumb ? `poster="${esc(r.thumb)}"` : ''} controls autoplay playsinline style="width:100%;max-height:360px"></video>`
            : (isVid
                ? `<div style="position:relative;width:100%;display:flex;flex-direction:column;align-items:center;padding:12px">
                    <canvas id="demo-reel-canvas" width="560" height="310" style="max-width:100%;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,0.4)"></canvas>
                    <div style="display:flex;align-items:center;gap:12px;margin-top:8px;color:#a7f3d0;font-size:12px">
                      <button type="button" id="demo-reel-toggle" class="btn primary" style="padding:4px 14px;font-size:12px">⏸ Pause Reel</button>
                      <span id="demo-reel-timer">00:00 / 00:15 · HD Clinic Reel Preview</span>
                    </div>
                  </div>`
                : (r.thumb
                    ? `<img src="${esc(r.thumb)}" alt="${esc(r.name)}" referrerpolicy="no-referrer" style="max-height:350px">`
                    : `<div style="color:#a7f3d0;padding:40px;text-align:center">ยังไม่มีรูปหรือวิดีโอสำหรับโฆษณานี้</div>`))}
        </div>

        <div class="ad-media-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:14px">
          <!-- หมวด 1: ข้อความโฆษณา (Ad Copy, Headline, CTA) & การตั้งค่าแคมเปญ -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
            <div style="background:#f8fcf9;border:1px solid #cde7d8;border-radius:12px;padding:12px 14px">
              <div style="font-size:11.5px;font-weight:800;color:#065f46;text-transform:uppercase;margin-bottom:6px">📝 ข้อความโฆษณา & ปุ่มกระตุ้น (Ad Copy & CTA)</div>
              <div style="font-size:13.5px;font-weight:700;color:#064e3b;margin-bottom:4px">${esc(r.headline || r.name || '—')}</div>
              <div style="font-size:12.5px;color:#334155;line-height:1.55;margin-bottom:8px;white-space:pre-line">${esc(r.body || 'ไม่มีข้อความแคปชั่นระบุในโฆษณานี้')}</div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="chip good" style="font-size:11px">ปุ่ม CTA: ${esc(ctaLabel)}</span>
                ${r.destinationType ? `<span class="chip flat" style="font-size:11px">ปลายทาง: ${esc(r.destinationType)}</span>` : ''}
                ${r.permalinkUrl ? `<a href="${esc(r.permalinkUrl)}" target="_blank" rel="noopener" style="font-size:11.5px;color:#059669;font-weight:700">🔗 เปิดโพสต์จริงบน Meta</a>` : ''}
              </div>
            </div>

            <div style="background:#f8fcf9;border:1px solid #cde7d8;border-radius:12px;padding:12px 14px;font-size:12px;display:flex;flex-direction:column;gap:5px">
              <div style="font-size:11.5px;font-weight:800;color:#065f46;text-transform:uppercase;margin-bottom:2px">🎯 โครงสร้างแคมเปญ กลุ่มเป้าหมาย & งบประมาณ</div>
              <div><b>วัตถุประสงค์ (Objective):</b> ${esc(objLabel)}</div>
              <div><b>เป้าหมายนำส่ง (Optimization):</b> ${esc(optLabel)} · <b>การประมูล:</b> ${esc(r.bidStrategy || 'LOWEST_COST')}</div>
              <div><b>งบประมาณ (Budget):</b> <span style="color:#059669;font-weight:700">${esc(budgetText)}</span></div>
              <div><b>กลุ่มเป้าหมาย (Targeting):</b> ${esc(r.targetingSummary || r.adset || '—')}</div>
              <div><b>ตำแหน่งจัดวาง (Placements):</b> ${esc(r.placement || 'Facebook & Instagram')}</div>
              <div><b>เอเจนซี่ / บัญชีโฆษณา:</b> ${esc(r.agency || 'In-house')}${r.updatedTime ? ` · <b>อัปเดต:</b> ${esc(String(r.updatedTime).slice(0, 16).replace('T', ' '))}` : ''}</div>
            </div>
          </div>

          <!-- หมวด 2: การนำส่ง การมองเห็น และการคลิก (Delivery, Clicks & Engagement) -->
          <div>
            <div style="font-size:11.5px;font-weight:800;color:#065f46;text-transform:uppercase;margin-bottom:6px">📊 สถิติการนำส่ง การคลิก และการมีส่วนร่วมทั้งหมด (Delivery, Clicks & Engagement)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px;background:#f0f7f3;padding:12px;border-radius:12px;border:1px solid #d3e7da">
              <div><div style="font-size:10.5px;color:var(--muted)">Spend (งบที่ใช้จริง)</div><b style="font-size:14px;color:#064e3b">${baht(r.spend)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">Reach (คนเห็น)</div><b style="font-size:14px">${num(r.reach)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">Impressions (ครั้งที่แสดง)</div><b style="font-size:14px">${num(r.impressions)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">Frequency (ความถี่ซ้ำ)</div><b style="font-size:14px">${r.frequency ? num(r.frequency, 2) + '×' : '—'}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">CPM (ต่อ 1,000 ครั้ง)</div><b style="font-size:14px">${baht(r.cpm)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">CPP (ต่อ 1,000 คน)</div><b style="font-size:14px">${baht(r.cpp)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">Clicks (คลิกทั้งหมด)</div><b style="font-size:14px">${num(r.clicks)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">Link Clicks (คลิกลิงก์)</div><b style="font-size:14px">${num(r.linkClicks)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">CTR (All / Link)</div><b style="font-size:14px">${pct(r.ctr)} / ${pct(r.linkCtr)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">CPC (All / Link)</div><b style="font-size:14px">${baht(r.cpc)} / ${baht(r.costPerLinkClick)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">Post Engagement</div><b style="font-size:14px;color:#0284c7">${num(r.postEngagement)}</b></div>
              <div><div style="font-size:10.5px;color:var(--muted)">👍 ถูกใจ · 💬 เมนต์ · ↗ แชร์</div><b style="font-size:12.5px">${num(r.reactions)} · ${num(r.comments)} · ${num(r.shares)}</b></div>
            </div>
          </div>

          <!-- หมวด 3: สถิติวิดีโอ & ผลลัพธ์การขาย (Video Funnel, Messages, CRM Quality & ROAS) -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
            <div style="background:#f0f7f3;padding:12px;border-radius:12px;border:1px solid #d3e7da">
              <div style="font-size:11px;font-weight:800;color:#065f46;text-transform:uppercase;margin-bottom:8px">🎬 สถิติการรับชมวิดีโอ (Video Watch Funnel)</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
                <div><div style="font-size:10.5px;color:var(--muted)">Video Plays (3s)</div><b style="font-size:13.5px">${num(r.videoPlays)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">ThruPlays (15s)</div><b style="font-size:13.5px;color:#059669">${num(r.videoThruPlays)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">Cost / ThruPlay</div><b style="font-size:13.5px">${baht(r.costPerThruPlay)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">ดู 25% / 50%</div><b style="font-size:12.5px">${num(r.videoP25)} / ${num(r.videoP50)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">ดู 75%</div><b style="font-size:12.5px">${num(r.videoP75)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">ดูจบ 100%</div><b style="font-size:13px;color:#047857">${num(r.videoP100)}</b></div>
              </div>
            </div>

            <div style="background:#ecfdf5;padding:12px;border-radius:12px;border:1px solid #a7f3d0">
              <div style="font-size:11px;font-weight:800;color:#065f46;text-transform:uppercase;margin-bottom:8px">🏆 ผลลัพธ์ทักแชท คุณภาพลีด ยอดขาย & ROAS</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
                <div><div style="font-size:10.5px;color:var(--muted)">Messages (ทักแชท)</div><b style="font-size:14px;color:#064e3b">${num(r.messages)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">Cost / Message</div><b style="font-size:14px">${baht(r.costMessage)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">CRM Leads / แชทดี</div><b style="font-size:13.5px">${num(r.leads)} / <span style="color:#059669">${num(r.qualityChats)}</span></b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">CQC (ต้นทุน/แชทดี)</div><b style="font-size:13.5px">${r.cqc === null ? '—' : baht(r.cqc)}</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">Purchases (ซื้อแล้ว)</div><b style="font-size:14px;color:#059669">${num(r.purchases)} (${pct(r.conversionRate)})</b></div>
                <div><div style="font-size:10.5px;color:var(--muted)">Revenue & ROAS</div><b style="font-size:13.5px;color:#047857">${baht(r.revenue)} ${r.roas ? `(${r.roas}×)` : ''}</b></div>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-top:4px;border-top:1px solid #e2e8f0">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <label class="btn primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px">
                📤 อัปโหลดไฟล์รูปภาพ / วิดีโอ (MP4)
                <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" style="display:none" data-act="dash-ad-img" data-ad-id="${esc(r.id)}" data-ad-name="${esc(r.name)}">
              </label>
              <button type="button" class="btn" data-act="prompt-ad-url" data-ad-id="${esc(r.id)}" data-ad-name="${esc(r.name)}" style="font-size:13px">🔗 วางลิงก์รูป/วิดีโอ</button>
            </div>
            <button type="button" class="btn" data-act="close-ad-media">ปิดหน้าต่าง</button>
          </div>
        </div>
      </div>
    `;
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) closeAdMediaModal(); });
    document.body.appendChild(wrap);

    // ถ้าเป็นวิดีโอพรีวิวโหมดสาธิต วาดแอนิเมชันวิดีโอคลินิกแบบสดๆ บน Canvas
    const cv = document.getElementById('demo-reel-canvas');
    if (cv) {
      const ctx = cv.getContext('2d');
      let playing = true;
      let startTs = performance.now();
      let elapsed = 0;
      const btnToggle = document.getElementById('demo-reel-toggle');
      const timerEl = document.getElementById('demo-reel-timer');
      if (btnToggle) {
        btnToggle.addEventListener('click', () => {
          playing = !playing;
          if (playing) startTs = performance.now() - elapsed;
          btnToggle.textContent = playing ? '⏸ Pause Reel' : '▶ Play Reel';
        });
      }
      const drawReel = (now) => {
        if (!document.getElementById('demo-reel-canvas')) return;
        if (playing) elapsed = (now - startTs) % 15000;
        const sec = elapsed / 1000;
        const progress = sec / 15;

        const grad = ctx.createLinearGradient(0, 0, cv.width, cv.height);
        grad.addColorStop(0, '#022c22');
        grad.addColorStop(0.5, '#065f46');
        grad.addColorStop(1, '#059669');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cv.width, cv.height);

        // วงกลมเคลื่อนไหวพื้นหลัง
        for (let i = 0; i < 5; i++) {
          const x = ((i * 130 + sec * 45) % (cv.width + 120)) - 60;
          const y = 70 + Math.sin(sec * 2 + i) * 40 + i * 35;
          ctx.beginPath();
          ctx.arc(x, y, 36 + i * 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(110, 231, 183, 0.12)';
          ctx.fill();
        }

        // ป้าย BEQ Clinic Reel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(20, 18, 175, 28);
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('🎬 BEQ CLINIC VIDEO AD', 32, 36);

        // ชื่อแคมเปญและโฆษณาเคลื่อนไหว
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(String(r.name || 'BEQ Hair Transplant'), 28, 125);

        ctx.fillStyle = '#a7f3d0';
        ctx.font = '600 15px sans-serif';
        ctx.fillText(`Campaign: ${r.campaign || 'Hair Wellness'} · ${r.adset || 'Target Audience'}`, 28, 158);

        // แอนิเมชันกราฟผลลัพธ์ Before -> After
        const phase = Math.floor(sec / 5);
        const phaseLabels = [
          '✨ Step 1: ตรวจสภาพรากผมด้วยกล้อง AI Microscope',
          '🌿 Step 2: เทคนิคปลูกผมถาวร FUE / DHI แผลเล็ก ฟื้นตัวไว',
          '🏆 Step 3: ผลลัพธ์ผมดกดำเป็นธรรมชาติ ความพึงพอใจ 99.4%'
        ];
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.fillRect(28, 185, cv.width - 56, 54);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(phaseLabels[phase] || phaseLabels[0], 44, 218);

        // แถบสถิติสดในวิดีโอ
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`CTR: ${Number(r.ctr || 1.98).toFixed(2)}%   |   Messages: ${Number(r.purchases || 12) * 8}   |   Purchases: ${r.purchases || 12} เคส`, 28, 282);

        // Progress bar ด้านล่างวิดีโอ
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(0, cv.height - 8, cv.width, 8);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(0, cv.height - 8, cv.width * progress, 8);

        if (timerEl) {
          const sTxt = String(Math.floor(sec)).padStart(2, '0');
          timerEl.textContent = `00:${sTxt} / 00:15 · HD Clinic Reel Preview`;
        }
        _demoReelAnimId = requestAnimationFrame(drawReel);
      };
      _demoReelAnimId = requestAnimationFrame(drawReel);
    }
  }

  /* ═══════════════════════════════════════════
     QUALITY PAGE — คุณภาพแชทรายโฆษณา
  ═══════════════════════════════════════════ */
  function qualityShell() {
    return `<div class="page-head"><div><h1>${icon('spark')} คุณภาพแชทรายโฆษณา</h1>
        <div class="meta-line"><span>ภาพรวมคุณภาพการสนทนาแยกตามโฆษณา พร้อมรูปภาพและวิดีโอแคมเปญ — ใช้ข้อมูลช่วง 30 วันล่าสุด</span></div></div>
      <button class="btn" data-act="quality-reload">${icon('refresh')} รีเฟรช</button></div>
      <div id="quality-body"><div class="loading">Loading…</div></div>`;
  }

  async function loadQuality() {
    const q = S.quality;
    q.loading = true; q.err = null; renderQualityBody();
    try {
      const p = new URLSearchParams({ range: '30d' });
      if (S.dash.platform) p.set('platform', S.dash.platform);
      if (S.dash.page) p.set('page', S.dash.page);
      const data = await api('/api/dashboard?' + p.toString());
      S.dash.data = data;
      q.data = buildQualityData(data); q.loading = false;
    } catch (e) {
      q.err = e.message || 'โหลดข้อมูลไม่สำเร็จ'; q.loading = false;
    }
    renderQualityBody();
  }

  function buildQualityData(dashData) {
    const ads = (dashData.ads || []).map((a) => {
      const leads = a.leads ?? 0;
      const goodChats = a.qualityChats ?? 0;
      const goodPct = leads ? (goodChats / leads) * 100 : 0;
      return {
        ...a,
        id: a.id, name: a.name, campaign: a.campaign || '', adset: a.adset || '', page: a.page || '',
        creative: a.creative || 'IMAGE', thumb: a.thumb || null, videoUrl: a.videoUrl || null,
        reach: a.reach || 0, impressions: a.impressions || 0, ctr: a.ctr || 0,
        costMessage: a.costMessage || 0, purchases: a.purchases || 0,
        leads, goodChats, goodPct,
        qualityScore: a.qualityScore,
        qualityLabel: a.qualityLabel || 'none',
        spend: a.spend || 0, cpc: a.cpc || null,
        firstResponseMin: null,
      };
    });
    return { ads, campaigns: dashData.campaigns || [], adsets: dashData.adsets || [] };
  }

  function renderQualityBody() {
    const $el = document.getElementById('quality-body'); if (!$el) return;
    const q = S.quality;
    if (q.loading) { $el.innerHTML = '<div class="loading">Loading…</div>'; return; }
    if (q.err) { $el.innerHTML = `<div class="notice err">${esc(q.err)}</div>`; return; }
    if (!q.data) { $el.innerHTML = '<div class="loading">Loading…</div>'; return; }

    let ads = q.data.ads || [];
    if (q.campaign) ads = ads.filter((a) => a.campaign === q.campaign);
    if (q.minQuality) {
      const min = { excellent: 55, good: 35, average: 20, poor: 0 }[q.minQuality] ?? 0;
      ads = ads.filter((a) => (a.qualityScore || 0) >= min);
    }

    // Sort
    const sortDir = q.sortDir === 'asc' ? 1 : -1;
    ads = [...ads].sort((a, b) => {
      const va = a[q.sort] ?? -1; const vb = b[q.sort] ?? -1;
      return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir;
    });

    const totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    const goodLeads = ads.reduce((s, a) => s + a.goodChats, 0);
    const totalSpend = ads.reduce((s, a) => s + (a.spend || 0), 0);
    const totalRev = ads.reduce((s, a) => s + (a.revenue || 0), 0);
    const avgScore = ads.length ? Math.round(ads.reduce((s, a) => s + (a.qualityScore || 0), 0) / ads.length) : null;
    const campaigns = [...new Set((q.data.ads || []).map((a) => a.campaign).filter(Boolean))];

    const sortArrow = (k) => q.sort === k ? (q.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const thSort = (k, label) => `<th data-act="q-sort" data-key="${k}" style="cursor:pointer">${label}${sortArrow(k)}</th>`;

    $el.innerHTML = `
      <section class="card filters" style="margin-bottom:16px">
        <span class="label">${icon('filter')} กรอง</span>
        ${selectHtml('q-campaign', 'ทุก Campaign', campaigns, q.campaign)}
        <div class="sel"><select data-bind="q-quality">
          <option value="">ทุกระดับคุณภาพ</option>
          <option value="excellent" ${q.minQuality === 'excellent' ? 'selected' : ''}>Excellent (≥55%)</option>
          <option value="good" ${q.minQuality === 'good' ? 'selected' : ''}>Good (≥35%)</option>
          <option value="average" ${q.minQuality === 'average' ? 'selected' : ''}>Average (≥20%)</option>
          <option value="poor" ${q.minQuality === 'poor' ? 'selected' : ''}>Poor (&lt;20%)</option>
        </select></div>
        <button class="icon-btn" data-act="q-clear-filters" aria-label="ล้าง">${icon('reset')}</button>
      </section>

      <div class="grid-4" style="margin-bottom:18px">
        <div class="stat"><div class="k-label">Leads ทั้งหมด / แชทคุณภาพดี</div><div class="k-value">${num(totalLeads)} <span style="font-size:16px;color:var(--brand)">(${num(goodLeads)} ดี)</span></div></div>
        <div class="stat"><div class="k-label">งบรวม (Spend) / ยอดขาย (Revenue)</div><div class="k-value" style="font-size:20px">${baht(totalSpend)} <span style="font-size:14px;color:var(--brand)">→ ${baht(totalRev)}</span></div></div>
        <div class="stat"><div class="k-label">Avg Quality Score</div><div class="k-value">${avgScore !== null ? avgScore + '%' : '—'}</div></div>
        <div class="stat"><div class="k-label">โฆษณาในช่วง</div><div class="k-value">${num(ads.length)} รายการ</div></div>
      </div>

      <section class="card table-card">
        <div class="table-head"><div><h2>คุณภาพรายโฆษณา & ข้อมูลแคมเปญครบทุกมิติ (Full Campaign & Ad Intelligence)</h2><p>${num(ads.length)} ads · แสดงข้อมูลแคมเปญ กลุ่มเป้าหมาย ข้อความโฆษณา งบประมาณ การนำส่ง การมีส่วนร่วม วิดีโอ และคุณภาพแชททั้งหมด</p></div></div>
        <div class="tscroll"><table style="min-width:1780px">
          <thead><tr>
            <th class="nosort" style="width:185px">รูป / วิดีโอ (Creative)</th>
            ${thSort('name', 'โฆษณา / แคมเปญ / สถานะ & กลุ่มเป้าหมาย')}
            <th class="nosort" style="width:240px">ข้อความโฆษณา (Headline / Copy / CTA)</th>
            ${thSort('spend', 'Spend & งบ/วัน')}
            ${thSort('reach', 'Reach / Impr. / Freq.')}
            ${thSort('clicks', 'Clicks / CTR / CPC')}
            ${thSort('postEngagement', 'Engagement & Video')}
            ${thSort('messages', 'Messages & Cost/Msg')}
            ${thSort('leads', 'CRM Leads / แชทดี')}
            ${thSort('goodPct', 'Good % / CQC')}
            ${thSort('purchases', 'Purchases / Revenue / ROAS')}
            ${thSort('qualityScore', 'คุณภาพแชท')}
          </tr></thead>
          <tbody>${ads.length ? ads.map((a) => {
            const mediaPayload = esc(JSON.stringify(a));
            const objShort = OBJECTIVE_TH[a.objective] || a.objective || 'Engagement';
            return `<tr>
            <td>${adMediaThumbHtml(a)}</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
                ${statusBadgeHtml(a.status)}
                <span class="ad-name" title="${esc(a.name)}" style="font-weight:700">${esc(a.name)}</span>
              </div>
              <div class="ad-sub" style="color:#065f46;font-weight:600">📊 ${esc(a.campaign || '—')} · <span style="color:#0284c7">${esc(objShort)}</span></div>
              <div class="ad-sub">🎯 ชุดโฆษณา: <b>${esc(a.adset || '—')}</b> (${esc(a.optimizationGoal || 'CONVERSATIONS')}) · ID: <code>${esc(a.id)}</code></div>
              ${a.targetingSummary ? `<div class="ad-sub" style="font-size:11px;color:#475569">👥 ${esc(a.targetingSummary)}</div>` : ''}
              <div class="ad-sub" style="font-size:11px;color:#64748b">📱 ${esc(a.placement || 'Facebook & Instagram')} · 📄 ${esc(a.page || '—')}</div>
            </td>
            <td>
              <div style="font-weight:700;font-size:12px;color:#064e3b;margin-bottom:2px;line-height:1.35">${esc(a.headline || a.name)}</div>
              <div style="font-size:11.5px;color:#475569;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" title="${esc(a.body || '')}">${esc(a.body || '—')}</div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px">
                <span class="chip good" style="font-size:10px;padding:1px 7px">CTA: ${esc(a.cta || 'SEND_MESSAGE')}</span>
                <button type="button" class="btn" data-act="open-ad-media" data-ad-media="${mediaPayload}" style="padding:1px 7px;font-size:10px;border-radius:999px">📋 ดูครบ 360°</button>
              </div>
            </td>
            <td>
              <div style="font-weight:800;color:#064e3b">${baht(a.spend)}</div>
              <div class="ad-sub" style="font-size:11px">งบ/วัน: ${a.dailyBudget ? baht(a.dailyBudget) : 'ตามแคมเปญ'}</div>
              <div class="ad-sub" style="font-size:11px">CPM: ${baht(a.cpm)}</div>
            </td>
            <td>
              <div><b>${num(a.reach)}</b> คน</div>
              <div class="ad-sub">${num(a.impressions)} ครั้ง</div>
              <div class="ad-sub" style="color:#059669;font-weight:600">Freq: ${a.frequency ? num(a.frequency, 2) + '×' : '—'}</div>
            </td>
            <td>
              <div><b>${num(a.clicks)}</b> คลิก <span class="ad-sub">(ลิงก์ ${num(a.linkClicks)})</span></div>
              <div class="ad-sub">CTR: <b>${pct(a.ctr)}</b> (ลิงก์ ${pct(a.linkCtr)})</div>
              <div class="ad-sub">CPC: ${baht(a.cpc)}</div>
            </td>
            <td>
              <div><b>${num(a.postEngagement)}</b> ส่วนร่วม</div>
              <div class="ad-sub" style="font-size:10.5px">👍 ${num(a.reactions)} · 💬 ${num(a.comments)} · ↗ ${num(a.shares)}</div>
              <div class="ad-sub" style="font-size:10.5px;color:#0284c7">🎬 วิว ${num(a.videoPlays)} · ThruPlay ${num(a.videoThruPlays)}</div>
            </td>
            <td>
              <div><b>${num(a.messages)}</b> ทักแชท</div>
              <div class="ad-sub">ต้นทุน: <b>${baht(a.costMessage)}</b>/แชท</div>
            </td>
            <td>
              <div><b>${num(a.leads)}</b> ลีด</div>
              <div class="ad-sub" style="color:#059669;font-weight:700">แชทดี: ${num(a.goodChats)}</div>
            </td>
            <td>
              <div><b>${a.leads ? pct(a.goodPct) : '—'}</b></div>
              <div class="ad-sub">CQC: <b>${a.cqc ? baht(a.cqc) : '—'}</b></div>
            </td>
            <td>
              <div><b>${num(a.purchases)}</b> ซื้อ <span class="ad-sub">(${pct(a.conversionRate)})</span></div>
              <div class="ad-sub" style="color:#047857;font-weight:700">${baht(a.revenue)}</div>
              <div class="ad-sub">${a.roas ? `<span class="chip good" style="font-size:10px;padding:1px 6px">ROAS ${a.roas}×</span>` : '—'}</div>
            </td>
            <td><span class="q-badge q-${esc(a.qualityLabel || 'none')}">${a.qualityScore !== null ? num(a.qualityScore) + '%' : 'No chats'}</span></td>
          </tr>`;
          }).join('') : `<tr><td colspan="12"><div class="empty">ไม่มีข้อมูลโฆษณาในช่วงที่เลือก</div></td></tr>`}
          </tbody>
        </table></div>
      </section>`;
  }

  /* ---------------- login ---------------- */
  function renderLogin() {
    $app.innerHTML = `<div class="login-split">
      <aside class="login-art">${strandsSvg(26, 0.13)}<img class="login-logo" src="/logo-full-white.png" alt="BEQ Group" width="88">
        <h2>BEQ GROUP</h2>
        <p>ONE STOP HAIR BUSINESS PARTNER</p></aside>
      <main class="login-pane"><form class="login-card" data-form="login" autocomplete="on">
        <div class="login-card-brand"><img src="/logo-mark.png" alt="BEQ"><span>BEQ Hair Wellness Suite</span></div>
        <h1>เข้าสู่ระบบ</h1><p>ใช้บัญชีผู้ดูแลของคลินิก</p>
        ${S.loginErr ? `<div class="notice err" style="margin-bottom:14px">${esc(S.loginErr)}</div>` : ''}
        <div class="form">
          <div class="field"><label for="u">ชื่อผู้ใช้</label><input id="u" name="username" type="text" autocomplete="username" autofocus required></div>
          <div class="field"><label for="p">รหัสผ่าน</label><input id="p" name="password" type="password" autocomplete="current-password" required></div>
          <button class="btn primary" type="submit">เข้าสู่ระบบ</button>
        </div></form></main></div>`;
  }

  /* ---------------- dashboard ---------------- */
  function dashQuery() {
    const d = S.dash;
    const p = new URLSearchParams({ range: d.range });
    if (d.range === 'custom') { p.set('from', d.from); p.set('to', d.to); }
    for (const k of ['platform', 'page', 'campaign', 'agency', 'rep', 'status']) if (d[k]) p.set(k, d[k]);
    return p.toString();
  }

  async function loadDash(refresh) {
    const d = S.dash;
    if (d.range === 'custom' && !(d.from && d.to)) return;
    const seq = ++reqSeq;
    d.loading = true; d.err = null; renderDashBody();
    try {
      const [data, filters] = await Promise.all([
        api('/api/dashboard?' + dashQuery() + (refresh ? '&refresh=1' : '')),
        S.filters ? Promise.resolve(S.filters) : api('/api/filters'),
      ]);
      if (seq !== reqSeq) return;
      const firstFilters = !S.filters;
      S.filters = filters; d.data = data; d.loading = false; d.pageNo = 1;
      if (firstFilters) render(); else renderDashBody();
    } catch (e) {
      if (seq !== reqSeq) return;
      d.loading = false; d.err = e.message; renderDashBody();
    }
  }

  function selectHtml(bind, label, items, value) {
    return `<div class="sel"><select data-bind="${bind}" aria-label="${esc(label)}"><option value="">${esc(label)}</option>
      ${items.map((i) => `<option value="${esc(i.id ?? i)}" ${(i.id ?? i) === value ? 'selected' : ''}>${esc(i.name ?? STATUS_TH[i] ?? cap(i))}</option>`).join('')}</select></div>`;
  }
  const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  // ป้ายบอกว่าตัวเลขโฆษณามาจากฐานข้อมูลที่บันทึกไว้ (ตอน Meta ช้า/ล่ม หรือระหว่างดึงใหม่เบื้องหลัง)
  // แปลข้อผิดพลาดจาก Meta ที่เจอบ่อยเป็นภาษาคน
  function metaErrorTh(msg) {
    const m = String(msg || '');
    if (/temporarily unavailable|unknown error|unexpected error|please retry|timeout|ตอบสนองช้า/i.test(m)) return 'Meta ขัดข้องชั่วคราว (ฝั่ง Meta ไม่ใช่เว็บเรา)';
    if (/reduce the amount of data/i.test(m)) return 'ข้อมูลที่ขอจาก Meta มากเกินไป ลองเลือกช่วงเวลาสั้นลง';
    if (/session has expired|access token|Error validating|OAuthException|#190/i.test(m)) return 'Token ของ Meta หมดอายุหรือใช้ไม่ได้ — ไปที่ Setting เพื่อเชื่อมต่อใหม่';
    if (/too many calls|rate.?limit|request limit/i.test(m)) return 'เรียก Meta ถี่เกินไป Meta ให้รอสักครู่';
    if (/permission|#10\b|#200\b/i.test(m)) return 'Token ไม่มีสิทธิ์อ่านข้อมูลโฆษณานี้';
    return 'ดึงข้อมูลจาก Meta ไม่สำเร็จ';
  }

  function storedBadgeHtml(data) {
    if (!data || !data.stored) return '';
    const st = data.stored;
    return `<span class="badge-demo" title="ตัวเลขจากฐานข้อมูลที่บันทึกไว้ตอนดึงจาก Meta ครั้งล่าสุด" style="background:#fff7ed;color:#9a3412;font-size:12px">📦 ข้อมูลที่บันทึกไว้${st.at ? ' · ' + esc(fmtTs(st.at)) : ''}${st.refreshing ? ' · กำลังดึงใหม่…' : ''}</span>`;
  }

  function dashShell() {
    const d = S.dash; const f = S.filters || { platforms: [], pages: [], campaigns: [], agencies: [], reps: [], statuses: [] };
    const data = d.data;
    const customDays = d.from && d.to ? Math.round((Date.parse(d.to) - Date.parse(d.from)) / 864e5) + 1 : 30;
    const days = d.range === 'all' ? 'All time' : d.range === 'custom' ? Math.max(1, customDays) : ({ '7d': 7, '30d': 30, '90d': 90 }[d.range] || 30);
    const live = S.me.mode === 'meta' || S.me.mode === 'live';
    const rawPages = (f.pages || []).filter(isValidPage);
    const validPages = d.platform
      ? rawPages.filter(p => !p.platform || p.platform.toLowerCase() === d.platform.toLowerCase())
      : rawPages;
    return `<div class="page-head"><div>
        <h1>Dashboard ${live ? '<span class="badge-demo" style="background:var(--mint);color:var(--brand-deep)">Live · ข้อมูลจริง</span>' : `<span class="badge-demo">${icon('spark')}Demo data</span>`}
          <span id="dash-stored-badge">${storedBadgeHtml(d.data)}</span></h1>
        <div class="meta-line" id="dash-meta"></div></div>
      <button class="btn" data-act="refresh">${icon('refresh')}โหลดใหม่</button></div>

      <section class="card filters">
        <div class="seg">${[['all', 'ทั้งหมด'], ['7d', '7 วัน'], ['30d', '30 วัน'], ['90d', '90 วัน'], ['custom', 'กำหนดเอง']].map(([k, l]) => `<button data-act="range" data-range="${k}" class="${d.range === k ? 'active' : ''}">${l}</button>`).join('')}</div>
        ${d.range === 'custom' ? `<input class="date-in" type="date" data-bind="from" value="${esc(d.from)}" aria-label="From"><input class="date-in" type="date" data-bind="to" value="${esc(d.to)}" aria-label="To">` : ''}
        <span class="vs">${icon('cal')}ช่วงเวลา: ${days === 'All time' ? 'ข้อมูลทั้งหมด' : `vs ก่อนหน้า ${days} วัน`}</span>
        <span class="label">${icon('filter')}ตัวกรอง</span>
        ${selectHtml('platform', 'ทุกแพลตฟอร์ม', f.platforms || ['Facebook', 'LINE', 'WhatsApp', 'Instagram'], d.platform)}
        ${selectHtml('page', 'ทุกเพจ', validPages, d.page)}
        ${selectHtml('campaign', 'ทุกแคมเปญ', f.campaigns, d.campaign)}
        ${selectHtml('agency', 'ทุกบัญชีโฆษณา', f.agencies, d.agency)}
        ${selectHtml('rep', 'ทุกเซลล์', f.reps, d.rep)}
        ${selectHtml('status', 'ทุกสถานะ', f.statuses, d.status)}
        <button class="icon-btn" data-act="reset-filters" aria-label="Reset filters">${icon('reset')}</button>
      </section>

      <nav class="card tabs">${[['ads', 'ผลโฆษณา'], ['chat', 'โฆษณา & แชท'], ['sales', 'ผลงานเซลล์'], ['trend', 'แนวโน้ม'], ['dropped', 'ลีดที่หลุด']]
        .map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${d.tab === k ? 'active' : ''}">${l}</button>`).join('')}</nav>
      <div id="dash-body"></div>`;
  }

  function renderDashBody() {
    if (S.route !== 'dashboard') return;
    const d = S.dash; const box = document.getElementById('dash-body'); if (!box) return;
    const sb = document.getElementById('dash-stored-badge'); if (sb) sb.innerHTML = storedBadgeHtml(d.data);
    const meta = document.getElementById('dash-meta');
    if (meta && d.data) {
      meta.innerHTML = `<span>${icon('cal')}${d.data.range.from} → ${d.data.range.to}</span><span>${icon('bars')}โฆษณา ${d.data.scope.ads} ตัว</span><span>ลีด ${d.data.scope.leads} ราย · ข้อมูลรายวัน ${d.data.scope.records} แถว</span>`;
    }
    if (d.err) { box.innerHTML = `<div class="notice err">${esc(d.err)}</div>`; return; }
    if (!d.data) { box.innerHTML = '<div class="loading">Loading…</div>'; return; }
    box.style.opacity = d.loading ? '.55' : '1';
    const tabs = { ads: tabAds, chat: tabChat, sales: tabSales, trend: tabTrend, dropped: tabDropped };
    // เล่นแอนิเมชันเฉพาะตอนข้อมูลชุดใหม่เข้ามาครั้งแรก ไม่เล่นซ้ำเวลาสลับแท็บ
    d.animKey = `${d.data.range.from}|${d.data.range.to}|${d.page}|${d.campaign}|${d.agency}|${d.rep}|${d.status}|${S.me.mode}`;
    const errNotice = d.data && d.data.metaError ? `<div class="notice err" style="margin-bottom:12px">⚠️ ${esc(metaErrorTh(d.data.metaError))}${d.data.stored ? ' — ตอนนี้แสดง<b>ข้อมูลที่บันทึกไว้</b>แทน ระบบจะลองดึงใหม่เองใน 1 นาที' : ''}<div style="font-size:11.5px;opacity:.7;margin-top:2px">ข้อความจาก Meta: ${esc(d.data.metaError)}</div></div>` : '';
    box.innerHTML = errNotice + (tabs[d.tab] || tabAds)(d.data);
    if (d.tab === 'ads') {
      const el = box.querySelector('[data-count]');
      if (el && d.animKey !== d.lastAnimKey) countUp(el, Number(el.dataset.count));
      d.lastAnimKey = d.animKey;
    }
    if (d.tab === 'ads' || d.tab === 'chat') renderTable();
  }

  function countUp(el, to) {
    if (!to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now(); const ms = 800;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      el.textContent = baht(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1 && el.isConnected) requestAnimationFrame(tick); else if (el.isConnected) el.textContent = baht(to);
    };
    requestAnimationFrame(tick);
  }

  /* --- tab: ads --- */
  function chip(k) {
    if (!k || k.delta === null) return '<span class="chip flat">—</span>';
    if (k.delta === 0) return '<span class="chip flat">0.0%</span>';
    const up = k.delta > 0; const good = k.inverse ? !up : up;
    return `<span class="chip ${good ? 'good' : 'bad'}">${icon(up ? 'up' : 'down')}${up ? '+' : ''}${k.delta.toFixed(1)}%</span>`;
  }
  function tile(data, key, label, fmt) {
    const k = data.kpis[key];
    return `<div class="kpi"><div class="k-label">${label}</div><div class="k-value">${fmt(k.value)}</div>${chip(k)}</div>`;
  }
  // แถบสรุป: ยอดใช้จ่าย + เส้นทางจากการมองเห็นไปจนถึงการซื้อ
  function heroHtml(data) {
    const k = data.kpis; const t = data.trend.spend;
    const W = 600; const H = 84; const max = Math.max(...t, 1);
    const pts = t.map((v, i) => `${(i * W / Math.max(t.length - 1, 1)).toFixed(1)},${(H - 4 - (v / max) * (H - 12)).toFixed(1)}`);
    const anim = S.dash.animKey !== S.dash.lastAnimKey ? 'anim' : '';
    const rate = (a, b) => (b ? `${num((a / b) * 100, 1)}%` : '—');
    const steps = [
      ['การแสดงผล', k.impressions.value, 'ครั้งที่โฆษณาแสดง'],
      ['คลิก', k.clicks.value, `CTR ${pct(k.ctr.value)}`],
      ['ทักแชท', k.messages.value, `จากคลิก ${rate(k.messages.value, k.clicks.value)}`],
      ['ซื้อ/ปิดการขาย', k.purchases.value, `จากแชท ${rate(k.purchases.value, k.messages.value)}`],
    ];
    return `<section class="hero">${strandsSvg(22, 0.07)}
      <div><div class="h-label">ค่าโฆษณา ${chip(k.spend)}</div>
        <div class="h-num" data-count="${k.spend.value ?? 0}" data-fmt="baht">${baht(k.spend.value)}</div>
        <div class="h-sub">${esc(data.range.from)} → ${esc(data.range.to)} · เทียบ ${data.range.days} วันก่อนหน้า</div>
        <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily spend trend">
          <path class="trend-area ${anim}" d="M0,${H} L${pts.join(' L')} L${W},${H} Z"/>
          <polyline class="trend-line ${anim}" pathLength="1" points="${pts.join(' ')}"/></svg></div>
      <div class="funnel">${steps.map(([l, v, r]) => `<div class="f-step"><div class="f-label">${l}</div><div class="f-val">${num(v)}</div><span class="f-rate">${esc(r)}</span></div>`).join('')}</div>
    </section>`;
  }

  function aiAdAdvisorCard(data) {
    const k = data.kpis;
    const ads = data.ads || [];
    const topRoasAd = [...ads].filter(a => a.roas > 0).sort((a, b) => (b.roas || 0) - (a.roas || 0))[0];
    const topChatsAd = [...ads].sort((a, b) => (b.messages || 0) - (a.messages || 0))[0];
    const avgCostMsg = k.costMessage?.value || 0;

    return `
      <section class="card" style="margin-bottom:16px;background:linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%);color:#ffffff;border-radius:18px;padding:16px 20px;border:1px solid #34d399;box-shadow:0 8px 24px rgba(6, 78, 59, 0.18)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.18);padding-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="beq-iridescent-orb" style="width:26px;height:26px;box-shadow:0 0 14px #a7f3d0"></span>
            <div>
              <b style="font-size:16px;letter-spacing:0.02em">✨ BEQ AI Marketing Advisor · วิเคราะห์งบ & ประสิทธิภาพโฆษณา</b>
              <div style="font-size:12px;color:#a7f3d0;margin-top:2px">AI ประมวลผลผลลัพธ์โฆษณาเทียบกับยอดขายและสถิติการตอบแชทของคลินิกแบบเรียลไทม์</div>
            </div>
          </div>
          <span class="chip" style="background:rgba(255,255,255,0.18);color:#ffffff;font-size:12px;font-weight:700">⚡ AI Live Insights</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px">
          <div style="background:rgba(2, 44, 34, 0.35);padding:12px 14px;border-radius:12px;border:1px solid rgba(167, 243, 208, 0.25)">
            <div style="font-size:12px;color:#a7f3d0;font-weight:700;display:flex;align-items:center;gap:6px">
              <span>🏆 โฆษณาที่สร้างยอดขายสูงสุด (Top Winner)</span>
            </div>
            <div style="font-size:13.5px;font-weight:700;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(topRoasAd?.name || topChatsAd?.name || '—')}">
              ${esc(topRoasAd?.name || topChatsAd?.name || 'แคมเปญปลูกผม FUE')}
            </div>
            <div style="font-size:11.5px;color:#ecfdf5;margin-top:4px;line-height:1.4">
              💡 แนะนำ: โฆษณาตัวนี้มีอัตราผลตอบแทนคุ้มค่าสูงสุด แนะนำให้รักษาหรือสเกลงบเพิ่มขึ้น 15-20%
            </div>
          </div>
          <div style="background:rgba(2, 44, 34, 0.35);padding:12px 14px;border-radius:12px;border:1px solid rgba(167, 243, 208, 0.25)">
            <div style="font-size:12px;color:#a7f3d0;font-weight:700;display:flex;align-items:center;gap:6px">
              <span>💬 ต้นทุนทักแชทเฉลี่ย (Cost per Msg)</span>
            </div>
            <div style="font-size:15px;font-weight:800;margin-top:4px;color:#ffffff">
              ฿${avgCostMsg ? avgCostMsg.toFixed(2) : '0.00'} / แชท
            </div>
            <div style="font-size:11.5px;color:#ecfdf5;margin-top:4px;line-height:1.4">
              🎯 กลยุทธ์ AI: ให้เซลส์มุ่งเน้นถามจำนวนกราฟต์ที่กังวลเพื่อเสนอโปรโมชั่นและนัดหมายวันเข้าตรวจ
            </div>
          </div>
          <div style="background:rgba(2, 44, 34, 0.35);padding:12px 14px;border-radius:12px;border:1px solid rgba(167, 243, 208, 0.25)">
            <div style="font-size:12px;color:#a7f3d0;font-weight:700;display:flex;align-items:center;gap:6px">
              <span>⚡ โอกาสปิดการขายโดยรวม (Pipeline Health)</span>
            </div>
            <div style="font-size:13.5px;font-weight:700;margin-top:4px;color:#fef08a">
              🔥 มีลีดสนใจสูงในระบบ พร้อมนัดตรวจประเมิน
            </div>
            <div style="font-size:11.5px;color:#ecfdf5;margin-top:4px;line-height:1.4">
              🚀 กดที่แท็บ <b>"Inbox"</b> เพื่อให้ AI Copilot ช่วยร่างคำตอบและปิดการขายได้อย่างรวดเร็ว
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function tabAds(data) {
    const groups = [
      ['1', 'ค่าใช้จ่าย & การมองเห็น', 'จ่ายไปเท่าไหร่ และมีคนเห็นแค่ไหน', [['spend', 'ค่าโฆษณา', baht], ['reach', 'คนที่เห็น (Reach)', num], ['impressions', 'การแสดงผล', num], ['cpm', 'ต้นทุนต่อ 1,000 การแสดงผล (CPM)', baht]]],
      ['2', 'การตอบสนอง', 'คนสนใจโฆษณาแค่ไหน', [['clicks', 'คลิก', num], ['ctr', 'อัตราคลิก (CTR)', pct], ['cpc', 'ต้นทุนต่อคลิก (CPC)', baht]]],
      ['3', 'ผลลัพธ์', 'ทักแชทและปิดการขาย', [['messages', 'ทักแชททั้งหมด', num], ['costMessage', 'ต้นทุนต่อแชท', baht], ['purchases', 'ปิดการขาย', num], ['conversionRate', 'อัตราปิดการขาย', pct], ['costPurchase', 'ต้นทุนต่อการขาย', baht]]],
    ];
    return heroHtml(data) + aiAdAdvisorCard(data) + `<div class="kpi-groups">${groups.map(([n, t, s, items]) => `<section class="card kpi-group">
      <header><span class="step">${n}</span><div><b>${t}</b><small>${s}</small></div></header>
      <div class="kpi-grid">${items.map(([k, l, f]) => tile(data, k, l, f)).join('')}</div></section>`).join('')}</div>
      <section class="card table-card" id="table-card"></section>`;
  }

  /* --- table --- */
  const COLS_ADS = [
    ['name', 'แคมเปญ / ชุดโฆษณา / โฆษณา & สถานะ'],
    ['creative', 'รูป / วิดีโอ (Creative)'],
    ['headline', 'ข้อความโฆษณา & CTA (Ad Copy)'],
    ['spend', 'Spend & งบ/วัน'],
    ['reach', 'Reach / Impr. / Freq.'],
    ['cpm', 'CPM / CPP'],
    ['clicks', 'Clicks & Link Clicks'],
    ['ctr', 'CTR & CPC'],
    ['postEngagement', 'Engagement (ส่วนร่วม)'],
    ['videoPlays', 'Video Views / ThruPlay'],
    ['messages', 'Messages & Cost/Msg'],
    ['cqc', 'CRM Leads / แชทดี / CQC'],
    ['purchases', 'Purchases / Revenue / ROAS'],
    ['qualityScore', 'Chat Quality (14D)'],
  ];
  const COLS_CAMPAIGNS = [
    ['name', 'แคมเปญ (Campaign) & สถานะ / วัตถุประสงค์'],
    ['creative', 'สื่อตัวอย่าง (Media)'],
    ['dailyBudget', 'งบประมาณ & การประมูล'],
    ['adsCount', 'จำนวนชุดโฆษณา / โฆษณา'],
    ['spend', 'Spend (งบใช้จริง)'],
    ['reach', 'Reach / Impr. / Freq.'],
    ['cpm', 'CPM / CPP'],
    ['clicks', 'Clicks / Link Clicks'],
    ['ctr', 'CTR & CPC'],
    ['postEngagement', 'Engagement (👍·💬·↗)'],
    ['videoPlays', 'Video Views / ThruPlay'],
    ['messages', 'Messages & Cost/Msg'],
    ['cqc', 'CRM Leads / แชทดี / CQC'],
    ['purchases', 'Purchases / Revenue / ROAS'],
    ['qualityScore', 'Chat Quality'],
  ];
  const COLS_ADSETS = [
    ['name', 'ชุดโฆษณา (Ad Set) / แคมเปญ & สถานะ'],
    ['targetingSummary', 'กลุ่มเป้าหมาย (Targeting) & ตำแหน่งจัดวาง'],
    ['dailyBudget', 'เป้าหมายนำส่ง & งบ/วัน'],
    ['adsCount', 'จำนวนโฆษณา'],
    ['spend', 'Spend (งบใช้จริง)'],
    ['reach', 'Reach / Impr. / Freq.'],
    ['cpm', 'CPM'],
    ['clicks', 'Clicks / CTR / CPC'],
    ['postEngagement', 'Engagement & Video'],
    ['messages', 'Messages & Cost/Msg'],
    ['cqc', 'CRM Leads / แชทดี / CQC'],
    ['purchases', 'Purchases / Revenue / ROAS'],
    ['qualityScore', 'Chat Quality'],
  ];
  function sparkSvg(vals, label) {
    const list = Array.isArray(vals) && vals.length ? vals : [0, 0, 0, 0, 0, 0, 0];
    const color = { excellent: '#10b981', good: '#059669', average: '#f59e0b', poor: '#ef4444', none: '#94a3b8' }[label] || '#10b981';
    const max = Math.max(...list, 1); const w = 54; const h = 22;
    const pts = list.map((v, i) => `${(i * (w - 2) / Math.max(list.length - 1, 1) + 1).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  const QLABEL = { excellent: 'Excellent', good: 'Good', average: 'Average', poor: 'Poor' };

  function renderTable() {
    const card = document.getElementById('table-card') || document.getElementById('table-card-chat');
    if (!card || !S.dash.data) return;
    const d = S.dash;
    const level = d.tableLevel || 'ads';
    const q = d.search.trim().toLowerCase();

    const allAds = d.data.ads || [];
    const allCampaigns = d.data.campaigns || [];
    const allAdsets = d.data.adsets || [];

    const sourceList = level === 'campaigns' ? allCampaigns : level === 'adsets' ? allAdsets : allAds;
    const cols = level === 'campaigns' ? COLS_CAMPAIGNS : level === 'adsets' ? COLS_ADSETS : COLS_ADS;

    let rows = sourceList.filter((r) => !q || [r.name, r.campaign, r.adset, r.id, r.headline, r.body, r.targetingSummary, r.objective].some((s) => String(s || '').toLowerCase().includes(q)));
    const dir = d.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const x = a[d.sort]; const y = b[d.sort];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
    });
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    d.pageNo = Math.min(d.pageNo, pages);
    const slice = rows.slice((d.pageNo - 1) * PAGE_SIZE, d.pageNo * PAGE_SIZE);
    const keepFocus = document.activeElement && document.activeElement.id === 'tsearch';

    const levelTabsHtml = `
      <div class="pills" style="margin-top:8px">
        <button type="button" class="pill ${level === 'ads' ? 'active' : ''}" data-act="table-level" data-level="ads">
          📢 รายโฆษณาทั้งหมด (All Ads · ข้อมูลครบทุกมิติ) <span class="tab-badge">${allAds.length}</span>
        </button>
        <button type="button" class="pill ${level === 'campaigns' ? 'active' : ''}" data-act="table-level" data-level="campaigns">
          📁 สรุปรายแคมเปญ (Campaign Summary) <span class="tab-badge">${allCampaigns.length}</span>
        </button>
        <button type="button" class="pill ${level === 'adsets' ? 'active' : ''}" data-act="table-level" data-level="adsets">
          🎯 สรุปรายชุดโฆษณา & กลุ่มเป้าหมาย (Ad Sets) <span class="tab-badge">${allAdsets.length}</span>
        </button>
      </div>
    `;

    let tbodyHtml = '';
    if (!slice.length) {
      tbodyHtml = `<tr><td colspan="${cols.length}"><div class="empty">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div></td></tr>`;
    } else if (level === 'campaigns') {
      tbodyHtml = slice.map((r) => {
        const objLabel = OBJECTIVE_TH[r.objective] || r.objective || '💬 Engagement';
        const budgetText = r.dailyBudget ? `${baht(r.dailyBudget)} / วัน` : (r.lifetimeBudget ? `${baht(r.lifetimeBudget)} (รวม)` : 'ตามชุดโฆษณา (ABO)');
        return `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
              ${statusBadgeHtml(r.status)}
              <b class="ad-name" style="font-size:13.5px;color:#064e3b">${esc(r.name)}</b>
            </div>
            <div class="ad-sub" style="color:#0284c7;font-weight:600">${esc(objLabel)} · ID: <code>${esc(r.id)}</code></div>
            ${r.pagesList && r.pagesList.length ? `<div class="ad-sub">📄 เพจ: ${esc(r.pagesList.join(', '))}</div>` : ''}
          </td>
          <td>${adMediaThumbHtml(r)}</td>
          <td>
            <div style="font-weight:700;color:#065f46">${esc(budgetText)}</div>
            <div class="ad-sub">ประมูล: ${esc(r.bidStrategy || 'LOWEST_COST')}</div>
            <div class="ad-sub">ประเภท: ${esc(r.buyingType || 'AUCTION')}</div>
          </td>
          <td>
            <div><b>${num(r.adsetsCount)}</b> ชุดโฆษณา</div>
            <div class="ad-sub"><b>${num(r.adsCount)}</b> โฆษณา (รัน ${num(r.activeAdsCount)})</div>
          </td>
          <td class="spend" style="font-weight:800;color:#064e3b">${baht(r.spend)}</td>
          <td>
            <div><b>${num(r.reach)}</b> คน</div>
            <div class="ad-sub">${num(r.impressions)} ครั้ง</div>
            <div class="ad-sub" style="color:#059669;font-weight:600">Freq: ${r.frequency ? num(r.frequency, 2) + '×' : '—'}</div>
          </td>
          <td>
            <div>CPM: <b>${baht(r.cpm)}</b></div>
            <div class="ad-sub">CPP: ${baht(r.cpp)}</div>
          </td>
          <td>
            <div><b>${num(r.clicks)}</b> คลิก</div>
            <div class="ad-sub">คลิกลิงก์: <b>${num(r.linkClicks)}</b></div>
          </td>
          <td>
            <div>CTR: <b>${pct(r.ctr)}</b> <span class="ad-sub">(ลิงก์ ${pct(r.linkCtr)})</span></div>
            <div class="ad-sub">CPC: <b>${baht(r.cpc)}</b></div>
          </td>
          <td>
            <div><b>${num(r.postEngagement)}</b> ส่วนร่วม</div>
            <div class="ad-sub" style="font-size:10.5px">👍 ${num(r.reactions)} · 💬 ${num(r.comments)} · ↗ ${num(r.shares)}</div>
          </td>
          <td>
            <div>🎬 วิว: <b>${num(r.videoPlays)}</b></div>
            <div class="ad-sub" style="color:#059669">ThruPlay: <b>${num(r.videoThruPlays)}</b></div>
            <div class="ad-sub">ดูจบ 100%: ${num(r.videoP100)}</div>
          </td>
          <td>
            <div><b>${num(r.messages)}</b> ทักแชท</div>
            <div class="ad-sub">ต้นทุน: <b>${baht(r.costMessage)}</b></div>
          </td>
          <td>
            <div>ลีด: <b>${num(r.leads)}</b> · ดี: <b style="color:#059669">${num(r.qualityChats)}</b></div>
            <div class="ad-sub">CQC: <b>${r.cqc === null ? '—' : baht(r.cqc)}</b></div>
          </td>
          <td>
            <div><b>${num(r.purchases)}</b> ซื้อ <span class="ad-sub">(${pct(r.conversionRate)})</span></div>
            <div class="ad-sub" style="color:#047857;font-weight:700">${baht(r.revenue)}</div>
            <div class="ad-sub">${r.roas ? `<span class="chip good" style="font-size:10px;padding:1px 6px">ROAS ${r.roas}×</span>` : '—'}</div>
          </td>
          <td><span class="q-badge q-${r.qualityLabel}">${r.qualityScore === null ? 'No chats' : `${QLABEL[r.qualityLabel]} · ${r.qualityScore}%`}</span></td>
        </tr>`;
      }).join('');
    } else if (level === 'adsets') {
      tbodyHtml = slice.map((r) => {
        const optLabel = OPT_GOAL_TH[r.optimizationGoal] || r.optimizationGoal || 'CONVERSATIONS';
        return `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
              ${statusBadgeHtml(r.status)}
              <b class="ad-name" style="color:#064e3b">${esc(r.name)}</b>
            </div>
            <div class="ad-sub">📊 แคมเปญ: <b>${esc(r.campaign || '—')}</b></div>
          </td>
          <td>
            <div style="font-size:12px;font-weight:600;color:#1e293b">${esc(r.targetingSummary || r.name)}</div>
            <div class="ad-sub">📱 ตำแหน่ง: ${esc(r.placement || 'Facebook & Instagram')}</div>
          </td>
          <td>
            <div style="font-weight:700;color:#0284c7">${esc(optLabel)}</div>
            <div class="ad-sub">งบ/วัน: <b>${r.dailyBudget ? baht(r.dailyBudget) : 'ตามแคมเปญ'}</b></div>
            <div class="ad-sub">ปลายทาง: ${esc(r.destinationType || 'MESSENGER')}</div>
          </td>
          <td><b>${num(r.adsCount)}</b> โฆษณา <span class="ad-sub">(รัน ${num(r.activeAdsCount)})</span></td>
          <td class="spend" style="font-weight:800;color:#064e3b">${baht(r.spend)}</td>
          <td>
            <div><b>${num(r.reach)}</b> คน</div>
            <div class="ad-sub">${num(r.impressions)} ครั้ง · Freq: <b>${r.frequency ? num(r.frequency, 2) + '×' : '—'}</b></div>
          </td>
          <td>${baht(r.cpm)}</td>
          <td>
            <div><b>${num(r.clicks)}</b> คลิก (ลิงก์ ${num(r.linkClicks)})</div>
            <div class="ad-sub">CTR: <b>${pct(r.ctr)}</b> · CPC: ${baht(r.cpc)}</div>
          </td>
          <td>
            <div>ส่วนร่วม: <b>${num(r.postEngagement)}</b></div>
            <div class="ad-sub">🎬 วิว: ${num(r.videoPlays)} · ThruPlay: ${num(r.videoThruPlays)}</div>
          </td>
          <td>
            <div><b>${num(r.messages)}</b> ทักแชท</div>
            <div class="ad-sub">${baht(r.costMessage)} / แชท</div>
          </td>
          <td>
            <div>ลีด: <b>${num(r.leads)}</b> · ดี: <b style="color:#059669">${num(r.qualityChats)}</b></div>
            <div class="ad-sub">CQC: <b>${r.cqc === null ? '—' : baht(r.cqc)}</b></div>
          </td>
          <td>
            <div><b>${num(r.purchases)}</b> ซื้อ (${pct(r.conversionRate)})</div>
            <div class="ad-sub" style="color:#047857;font-weight:700">${baht(r.revenue)} ${r.roas ? `· ROAS ${r.roas}×` : ''}</div>
          </td>
          <td><span class="q-badge q-${r.qualityLabel}">${r.qualityScore === null ? 'No chats' : `${QLABEL[r.qualityLabel]} · ${r.qualityScore}%`}</span></td>
        </tr>`;
      }).join('');
    } else {
      tbodyHtml = slice.map((r) => {
        const hoverData = esc(JSON.stringify(r));
        const pageBadge = r.page ? (() => {
          const p = String(r.page).toLowerCase();
          let cls = 'beq';
          if (p.includes('pavicon')) cls = 'pavicon';
          else if (p.includes('nay') || p.includes('เนย์')) cls = 'drnay';
          return `<span class="page-tag-badge ${cls}">📄 ${esc(r.page)}</span>`;
        })() : '';
        const objShort = OBJECTIVE_TH[r.objective] || r.objective || '💬 Engagement';
        return `<tr>
        <td class="ad-hover-trigger" data-ad-hover="${hoverData}">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
            ${statusBadgeHtml(r.status)}
            <div class="ad-name" title="${esc(r.name)}">${esc(r.name)}</div>
          </div>
          <div class="ad-sub" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px">
            <span style="color:#065f46;font-weight:700">📊 ${esc(r.campaign)}</span>
            <span style="color:#0284c7;font-weight:600">· ${esc(objShort)}</span>
            ${pageBadge}
          </div>
          <div class="ad-sub" style="margin-top:2px">🎯 ชุดโฆษณา: <b>${esc(r.adset || '—')}</b> (${esc(r.optimizationGoal || 'CONVERSATIONS')}) · ID: <code>${esc(r.id)}</code></div>
          ${r.targetingSummary ? `<div class="ad-sub" style="font-size:11px;color:#475569">👥 ${esc(r.targetingSummary)}</div>` : ''}
          <div class="ad-sub" style="font-size:11px;color:#64748b">📱 ${esc(r.placement || 'Facebook & Instagram')}</div>
        </td>
        <td class="ad-hover-trigger" data-ad-hover="${hoverData}">${adMediaThumbHtml(r)}</td>
        <td>
          <div style="font-weight:700;font-size:12px;color:#064e3b;margin-bottom:2px;line-height:1.35">${esc(r.headline || r.name)}</div>
          <div style="font-size:11.5px;color:#475569;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:250px" title="${esc(r.body || '')}">${esc(r.body || '—')}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px">
            <span class="chip good" style="font-size:10px;padding:1px 7px">CTA: ${esc(r.cta || 'SEND_MESSAGE')}</span>
            <button type="button" class="btn" data-act="open-ad-media" data-ad-media="${hoverData}" style="padding:1px 8px;font-size:10px;border-radius:999px;font-weight:700">📋 ดูข้อมูลครบ 360°</button>
          </div>
        </td>
        <td class="spend">
          <div style="font-weight:800;color:#064e3b">${baht(r.spend)}</div>
          <div class="ad-sub" style="font-size:11px">งบ/วัน: ${r.dailyBudget ? baht(r.dailyBudget) : 'ตามแคมเปญ'}</div>
        </td>
        <td>
          <div><b>${num(r.reach)}</b> คน</div>
          <div class="ad-sub">${num(r.impressions)} ครั้ง</div>
          <div class="ad-sub" style="color:#059669;font-weight:600">Freq: ${r.frequency ? num(r.frequency, 2) + '×' : '—'}</div>
        </td>
        <td>
          <div>CPM: <b>${baht(r.cpm)}</b></div>
          <div class="ad-sub">CPP: ${baht(r.cpp)}</div>
        </td>
        <td>
          <div><b>${num(r.clicks)}</b> คลิก</div>
          <div class="ad-sub">คลิกลิงก์: <b>${num(r.linkClicks)}</b></div>
          <div class="ad-sub">Unique: ${num(r.uniqueClicks)}</div>
        </td>
        <td>
          <div>CTR: <b>${pct(r.ctr)}</b> <span class="ad-sub">(ลิงก์ ${pct(r.linkCtr)})</span></div>
          <div class="ad-sub">CPC: <b>${baht(r.cpc)}</b></div>
          <div class="ad-sub">Cost/Link: ${baht(r.costPerLinkClick)}</div>
        </td>
        <td>
          <div><b>${num(r.postEngagement)}</b> ส่วนร่วม</div>
          <div class="ad-sub" style="font-size:10.5px">👍 ${num(r.reactions)} · 💬 ${num(r.comments)} · ↗ ${num(r.shares)} · 🔖 ${num(r.saves)}</div>
        </td>
        <td>
          <div>🎬 วิว 3s: <b>${num(r.videoPlays)}</b></div>
          <div class="ad-sub" style="color:#059669">ThruPlay 15s: <b>${num(r.videoThruPlays)}</b></div>
          <div class="ad-sub">ดูจบ 100%: ${num(r.videoP100)}</div>
        </td>
        <td>
          <div><b>${num(r.messages)}</b> ทักแชท</div>
          <div class="ad-sub">Cost/Msg: <b>${baht(r.costMessage)}</b></div>
        </td>
        <td>
          <div>ลีด: <b>${num(r.leads)}</b> · ดี: <b style="color:#059669">${num(r.qualityChats)}</b></div>
          <div class="ad-sub">CQC: <b>${r.cqc === null ? '—' : baht(r.cqc)}</b></div>
        </td>
        <td>
          <div><b>${num(r.purchases)}</b> ซื้อ <span class="ad-sub">(${pct(r.conversionRate)})</span></div>
          <div class="ad-sub">Cost/ซื้อ: ${baht(r.costPurchase)}</div>
          <div class="ad-sub" style="color:#047857;font-weight:700">${baht(r.revenue)} ${r.roas ? `· <span class="chip good" style="font-size:10px;padding:1px 6px">ROAS ${r.roas}×</span>` : ''}</div>
        </td>
        <td><div class="q-cell">${sparkSvg(r.spark, r.qualityLabel)}<span class="q-badge q-${r.qualityLabel}">${r.qualityScore === null ? 'No chats' : `${QLABEL[r.qualityLabel]} · ${r.qualityScore}%`}</span></div></td></tr>`;
      }).join('');
    }

    card.innerHTML = `<div class="table-head" style="flex-wrap:wrap;gap:12px">
      <div>
        <h2>Campaign, Ad Set & Ad Performance (ข้อมูลแคมเปญ โฆษณา รูป/วิดีโอ และสถิติครบทุกมิติ)</h2>
        <p>ดึงข้อมูลครบทั้งหมด: สถานะ · วัตถุประสงค์ · กลุ่มเป้าหมาย · ข้อความโฆษณา & CTA · งบประมาณ · Reach/Impr/Freq · Clicks/CTR/CPC · Engagement · Video Views/ThruPlay · Messages · CRM Leads/CQC · Purchases/Revenue/ROAS</p>
        ${levelTabsHtml}
      </div>
      <label class="search">${icon('search')}<input id="tsearch" data-bind="search" placeholder="ค้นหาแคมเปญ, ชุดโฆษณา, ชื่อโฆษณา, แคปชั่น, กลุ่มเป้าหมาย..." value="${esc(d.search)}" autocomplete="off"></label></div>
      <div class="tscroll"><table style="min-width:1950px"><thead><tr>${cols.map(([k, l]) => `<th data-act="sort" data-key="${k}" class="${k === 'creative' ? 'nosort' : ''}">${l}${d.sort === k ? (d.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${tbodyHtml}</tbody></table></div>
      <div class="pager"><span>Page ${d.pageNo} of ${pages} · ${rows.length} รายการ</span><div class="btns">
        <button data-act="page" data-dir="-1" ${d.pageNo <= 1 ? 'disabled' : ''}>Previous</button><button data-act="page" data-dir="1" ${d.pageNo >= pages ? 'disabled' : ''}>Next</button></div></div>`;
    if (keepFocus) { const i = document.getElementById('tsearch'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  /* --- tab: chat --- */
  
  function barRows(items, labelFn, color) {
    const max = Math.max(...items.map((i) => i.count), 1);
    return `<div class="bars">${items.map((i) => `<div class="row"><span>${esc(labelFn(i))}</span><div class="bar"><i style="width:${(i.count / max) * 100}%;${color ? `background:${color(i)}` : ''}"></i></div><b>${num(i.count)}</b></div>`).join('')}</div>`;
  }
  function tabChat(data) {
    const c = data.chat;
    const qColor = (i) => ({ good: '#44602f', average: '#e0a100', poor: '#d6204b' }[i.key]);
    if (!c.leads) return '<div class="card empty">ยังไม่มีข้อมูลแชทในช่วงที่เลือก (โหมด Meta ต้องต่อระบบแชทเพิ่ม)</div>';
    return `<div class="grid-4">
      <div class="stat"><div class="k-label">Chat leads</div><div class="k-value">${num(c.leads)}</div></div>
      <div class="stat"><div class="k-label">Quality chats</div><div class="k-value">${num(c.qualityChats)}</div></div>
      <div class="stat"><div class="k-label">Cost / lead</div><div class="k-value">${baht(c.costPerLead)}</div></div>
      <div class="stat"><div class="k-label">Avg first response</div><div class="k-value">${c.avgFirstResponse === null ? '—' : num(c.avgFirstResponse, 1) + ' min'}</div></div></div>
      <div class="grid-2" style="margin-top:18px">
        <section class="card panel"><h3>Chat quality</h3><p class="sub">คุณภาพแชทที่ทีมขายประเมิน</p>${barRows(c.quality, (i) => cap(i.key), qColor)}</section>
        <section class="card panel"><h3>Lead pipeline</h3><p class="sub">สถานะลีดในช่วงที่เลือก</p>${barRows(c.funnel, (i) => STATUS_TH[i.key])}</section></div>
      <section class="card table-card" id="table-card-chat"></section>`;
  }

  /* --- tab: sales --- */
  function tabSales(data) {
    const s = data.sales;
    if (!s.reps.length) return '<div class="card empty">ยังไม่มีข้อมูลทีมขายในช่วงที่เลือก</div>';
    return `<div class="grid-4" style="margin-bottom:18px">
      <div class="stat"><div class="k-label">Revenue (closed)</div><div class="k-value">${baht(s.revenue)}</div></div>
      <div class="stat"><div class="k-label">Closed deals</div><div class="k-value">${num(s.closed)}</div></div>
      <div class="stat"><div class="k-label">ROAS</div><div class="k-value">${data.kpis.spend.value ? num(s.revenue / data.kpis.spend.value, 2) + '×' : '—'}</div></div>
      <div class="stat"><div class="k-label">Chat leads</div><div class="k-value">${num(data.chat.leads)}</div></div></div>
      <section class="card table-card"><div class="table-head"><div><h2>Sales reps</h2><p>ผลงานของทีมขายแต่ละคน</p></div></div>
      <div class="tscroll"><table style="min-width:760px"><thead><tr><th class="nosort">Rep</th><th class="nosort">Leads</th><th class="nosort">Qualified</th><th class="nosort">Closed</th><th class="nosort">Close rate</th><th class="nosort">Avg response</th><th class="nosort">Revenue</th></tr></thead>
      <tbody>${s.reps.map((r) => `<tr><td>${esc(r.name)}</td><td>${num(r.leads)}</td><td>${num(r.qualified)}</td><td>${num(r.closed)}</td><td>${r.closeRate === null ? '—' : r.closeRate.toFixed(1) + '%'}</td><td>${r.avgFirstResponse === null ? '—' : r.avgFirstResponse + ' min'}</td><td>${baht(r.revenue)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  /* --- tab: trend --- */
  function chartHtml(id, title, dates, vals, color, kind, fmt) {
    const W = 640; const H = 280; const pl = 54; const pr = 12; const pt = 14; const pb = 30;
    const max = Math.max(...vals, 1) * 1.1; const n = vals.length; const band = (W - pl - pr) / n;
    const x = (i) => pl + (i + 0.5) * band; const y = (v) => pt + (H - pt - pb) * (1 - v / max);
    CHARTS[id] = { dates, vals, fmt, W, pl, band };
    let g = '';
    for (let t = 0; t <= 4; t++) {
      const v = (max * t) / 4;
      g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="#eceee9"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${esc(num(v, max < 10 ? 1 : 0))}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / 7));
    for (let i = 0; i < n; i += step) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(dates[i].slice(5))}</text>`;
    let marks;
    if (kind === 'bar') {
      marks = vals.map((v, i) => `<rect x="${x(i) - band * 0.35}" y="${y(v)}" width="${band * 0.7}" height="${Math.max(0, H - pb - y(v))}" rx="3" fill="${color}"/>`).join('');
    } else {
      const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      marks = `<path d="M${x(0)},${H - pb} L${pts.join(' L')} L${x(n - 1)},${H - pb} Z" fill="${color}" opacity=".1"/><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    return `<section class="card panel"><h3>${esc(title)}</h3><div class="chart-wrap" data-chart="${id}" style="position:relative"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${g}${marks}</svg><div class="tip" hidden></div></div></section>`;
  }
  function tabTrend(data) {
    const t = data.trend;
    return `<div class="grid-2">
      ${chartHtml('spend', 'ค่าโฆษณาต่อวัน (฿)', t.dates, t.spend, '#44602f', 'bar', baht)}
      ${chartHtml('messages', 'ทักแชทต่อวัน', t.dates, t.messages, '#2457c5', 'line', num)}
      ${chartHtml('purchases', 'ปิดการขายต่อวัน', t.dates, t.purchases, '#b86e00', 'line', num)}
      ${chartHtml('leads', 'ลีดจากแชทต่อวัน', t.dates, t.leads, '#7a3fc4', 'line', num)}</div>`;
  }

  /* --- tab: dropped --- */
  function tabDropped(data) {
    const p = data.dropped;
    if (!p.total) return '<div class="card empty">ไม่มีลีดที่หลุดในช่วงที่เลือก 🎉</div>';
    return `<div class="grid-2">
      <section class="card panel"><h3>ลีดที่หลุด</h3><p class="sub">${num(p.total)} ลีด · ${p.rate}% ของลีดทั้งหมด</p>${barRows(p.reasons.map((r) => ({ key: r.reason, count: r.count })), (i) => i.key)}</section>
      <section class="card panel"><h3>ล่าสุด</h3><p class="sub">25 รายการล่าสุดที่หลุด</p>
      <div class="tscroll"><table style="min-width:480px"><tbody>${p.list.map((l) => `<tr><td><div class="ad-name">${esc(l.name)}</div><div class="ad-sub">${esc(l.ad)}</div></td><td>${esc(l.reason || '—')}<div class="ad-sub">${esc(l.date)} · ${esc(l.rep)}</div></td></tr>`).join('')}</tbody></table></div></section></div>`;
  }

  /* ---------------- list pages: inbox + board ---------------- */
  const seqs = { inbox: 0, board: 0, review: 0, sla: 0 };
  const STATUS_CLASS = {
    no_reply: 'q-none',
    very_poor: 'q-poor',
    talked: 'q-average',
    in_progress: 'q-good',
    qualified: 'q-excellent',
    appointment: 'q-excellent',
    conv_created: 'q-excellent',
    new: 'q-good',
    inprogress: 'q-good',
    intake: 'q-average',
    qualifile: 'q-excellent',
    converted: 'q-excellent',
  };
  const STATUS_COLOR = {
    no_reply: '#dc2626',
    very_poor: '#ef4444',
    talked: '#16a34a',
    in_progress: '#22c55e',
    qualified: '#059669',
    appointment: '#7c3aed',
    conv_created: '#d97706',
    new: '#0284c7',
    inprogress: '#2563eb',
    intake: '#0891b2',
    qualifile: '#047857',
    converted: '#15803d',
  };
  const CHAN_COLOR = { Messenger: '#1877f2', Facebook: '#1877f2', LINE: '#06c755', Instagram: '#e1306c', WhatsApp: '#25d366' };
  const CHAN_ICON = { Messenger: '🔵', Facebook: '🔵', Instagram: '📸', LINE: '📱', WhatsApp: '💚' };
  const chanHtml = (c) => {
    const norm = (c === 'Facebook' || c === 'Messenger') ? 'Facebook' : c;
    const logoSvg = getBrandLogo(c, 16);
    const col = CHAN_COLOR[norm] || CHAN_COLOR[c] || '#8a948f';
    const bgCol = norm === 'Instagram' ? '#fdf2f8' : norm === 'Facebook' ? '#eff6ff' : norm === 'LINE' ? '#f0fdf4' : norm === 'WhatsApp' ? '#f0fdf4' : '#f4f6f8';
    return `<span class="chan" style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:7px;font-size:12px;font-weight:600;background:${bgCol};color:${col};border:1px solid ${col}33">${logoSvg}<span>${esc(norm)}</span></span>`;
  };
  const statusHtml = (s) => `<span class="q-badge ${STATUS_CLASS[s] || 'q-none'}">${esc(STATUS_TH[s] || s)}</span>`;

  function listQuery(s) {
    const p = new URLSearchParams({ range: s.range });
    if (s.range === 'custom') { p.set('from', s.from); p.set('to', s.to); }
    if (S.dash.platform) p.set('platform', S.dash.platform);
    if (S.dash.page) p.set('page', S.dash.page);
    return p.toString();
  }

  // ตัวเลือกช่วงวัน ใช้ร่วมกันใน Inbox และ Board (นับจากวันที่เริ่มคุย)
  function rangeBar(scope) {
    const s = S[scope];
    const curPlatform = S.dash.platform || '';
    const curPage = S.dash.page || '';
    const rawAllPages = (S.filters && S.filters.pages) || [];
    const allPages = rawAllPages.filter(isValidPage);
    const filteredPages = curPlatform ? allPages.filter((p) => (p.platform || 'Facebook') === curPlatform) : allPages;

    return `<section class="card filters" style="display:flex;align-items:center;flex-wrap:wrap;gap:10px">
      <div class="seg">${[['all', 'ทั้งหมด'], ['30d', '30 วัน'], ['90d', '90 วัน'], ['7d', '7 วัน'], ['custom', 'กำหนดเอง']]
        .map(([k, l]) => `<button data-act="lrange" data-scope="${scope}" data-range="${k}" class="${s.range === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      ${s.range === 'custom' ? `<input class="date-in" type="date" data-bind="lfrom" data-scope="${scope}" value="${esc(s.from)}" aria-label="ตั้งแต่วันที่">
        <span class="vs">ถึง</span><input class="date-in" type="date" data-bind="lto" data-scope="${scope}" value="${esc(s.to)}" aria-label="ถึงวันที่">` : ''}
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <span class="label" style="margin:0">🔍 คัดแยก:</span>
        <div class="pill-select"><select data-bind="header-platform" aria-label="แพลตฟอร์ม" style="font-weight:600">
          <option value="">🌐 ทุกช่องทาง</option>
          <option value="Facebook" ${curPlatform === 'Facebook' ? 'selected' : ''}>🔵 Facebook</option>
          <option value="Instagram" ${curPlatform === 'Instagram' ? 'selected' : ''}>📸 Instagram</option>
          <option value="LINE" ${curPlatform === 'LINE' ? 'selected' : ''}>📱 LINE</option>
          <option value="WhatsApp" ${curPlatform === 'WhatsApp' ? 'selected' : ''}>💚 WhatsApp</option>
        </select></div>
        <div class="pill-select"><select data-bind="header-page" aria-label="เลือกเพจ" style="font-weight:600">
          <option value="">${curPlatform ? `📄 ทุกเพจ (${esc(curPlatform)})` : '📄 ทุกเพจ / ทุกบัญชี'}</option>
          ${filteredPages.map((p) => `<option value="${esc(p.id)}" ${curPage === p.id ? "selected" : ""}>${p.platform === "Facebook" ? "🔵 " : p.platform === "Instagram" ? "📸 " : p.platform === "LINE" ? "📱 " : p.platform === "WhatsApp" ? "💚 " : ""}${esc(p.name)}</option>`).join("")}
        </select></div>
      </div>
    </section>`;
  }

  function loadList(scope) {
    if (scope === 'inbox') return loadInbox();
    if (scope === 'review') return loadReview();
    if (scope === 'comments' || scope === 'post-comment') return loadComments();
    return loadBoard();
  }

  async function refreshAfterImport() {
    ClientCache.clear();
    S.inbox.data = null;
    S.dash.data = null;
    S.followup.data = null;
    try { S.filters = await api('/api/filters'); } catch {}
    if (S.route === 'inbox') {
      await loadInbox();
    } else if (S.route === 'followup') {
      await loadFollowups();
    } else if (S.route === 'dashboard') {
      await loadDash();
    }
    render();
  }

  async function fetchList(scope, path) {
    const s = S[scope];
    if (s.range === 'custom' && !(s.from && s.to && s.from <= s.to)) return false;
    const seq = ++seqs[scope]; s.err = null;
    try {
      const data = await api(`${path}?${listQuery(s)}`);
      if (seq !== seqs[scope]) return false;
      s.data = data;
    } catch (e) {
      if (seq !== seqs[scope]) return false;
      s.err = e.message;
    }
    return true;
  }

  /* --- chat drawer --- */
  async function openChat(id) {
    const c = S.chat; c.id = id; c.data = null; c.err = null; c.msg = null; c.loading = true; renderChatViews();
    try {
      const data = await api('/api/inbox/chat?id=' + encodeURIComponent(id));
      if (c.id !== id) return;
      c.data = data;
    } catch (e) { if (c.id !== id) return; c.err = e.message; }
    c.loading = false; renderChatViews();
  }
  function closeChat() { S.chat.id = null; renderDrawer(); }

  // ช่องพิมพ์ตอบลูกค้า ใช้ทั้งใน Inbox และ drawer พร้อมระบบ AI Smart Suggest
  function composerHtml(d) {
    const c = S.chat;
    const l = (d && d.lead) || currentLead();
    const suggestions = generateAiSuggestions(l, d && d.messages);

    return `
      <!-- AI Copilot Suggested Replies -->
      <div class="cura-copilot-suggestions">
        <div class="cura-suggestions-label">
          <span class="beq-iridescent-orb sm"></span>
          <span>ข้อความแนะนำ</span>
        </div>
        <div class="cura-suggestions-row copilot-chips">
          ${suggestions.map(sg => `
            <button type="button" class="cura-suggestion-chip" data-act="ai-fill" data-text="${esc(sg.text)}" title="${esc(sg.text)}">
              <span>${esc(sg.label)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <form class="reply-form" data-form="reply">
        <textarea name="text" rows="2" maxlength="2000" placeholder="พิมพ์ข้อความตอบลูกค้า หรือเลือกข้อเสนอแนะจาก Copilot ด้านบน… (Enter ส่ง · Shift+Enter ขึ้นบรรทัด)" ${c.sending ? 'disabled' : ''}></textarea>
        <button class="btn primary" type="submit" ${c.sending ? 'disabled' : ''}>${icon('send')}${c.sending ? 'กำลังส่ง…' : 'ส่ง'}</button>
      </form>
      ${c.msg ? `<div class="notice ${c.msg.type} reply-msg">${esc(c.msg.text)}</div>` : ''}
      <div class="reply-note">${d && d.demo ? 'โหมดเดโม: ข้อความจะถูกบันทึกในระบบเพื่อทดสอบ (เกณฑ์ SLA 15 นาที)' : 'ส่งผ่าน Meta Messenger Platform · ตอบได้ภายใน 24 ชม. หลังลูกค้าทักล่าสุด'}</div>`;
  }

  const tomorrow = () => { const t = new Date(); t.setDate(t.getDate() + 1); return ymd(t); };
  function followFormHtml() {
    const fu = S.chat.data && S.chat.data.followup; const act = fu && !fu.done;
    return `<form class="fu-form" data-form="followup"><h4>นัดตามลูกค้า</h4>
      <div class="fu-row"><input class="date-in" type="date" name="dueDate" value="${esc(act ? fu.dueDate : tomorrow())}" required aria-label="วันที่ตาม">
      <input type="text" name="note" maxlength="300" placeholder="บันทึก เช่น โทรถามเรื่องนัดตรวจ" value="${act ? esc(fu.note) : ''}"></div>
      <div class="row-actions"><button class="btn primary" type="submit">${act ? 'อัปเดตนัด' : 'ตั้งนัดตาม'}</button>${act ? '<button class="btn" type="button" data-act="fu-done">ปิดงานตาม</button>' : ''}</div></form>`;
  }
  // ตัวเลือกสถานะแบบป้ายสีบนหัวแชท: เลือกแล้วบันทึกทันที และหน้า Board ย้ายการ์ดตาม
  function statusPillSelectHtml(l) {
    const c = STATUS_COLOR[l.status] || '#64748b';
    return `<label title="เปลี่ยนสถานะ (การ์ดในหน้า Leads Board จะย้ายตาม)" style="position:relative;display:inline-flex;align-items:center">
      <select data-bind="lead-status" aria-label="สถานะลีด" style="appearance:none;-webkit-appearance:none;border:1.5px solid ${c};color:${c};background:${c}14;font-weight:700;font-size:12px;border-radius:999px;padding:3px 24px 3px 10px;cursor:pointer;font-family:inherit">
        ${STATUS_ORDER.map((k) => `<option value="${k}" ${l.status === k ? 'selected' : ''}>${STATUS_TH[k]}</option>`).join('')}
      </select>
      <span style="position:absolute;right:8px;pointer-events:none;color:${c};font-size:10px">▼</span>
    </label>`;
  }
  function statusSelectHtml(l) {
    return `<div class="field"><label>ความคืบหน้า</label><div class="sel"><select data-bind="lead-status" aria-label="ความคืบหน้า">${STATUS_ORDER.map((k) => `<option value="${k}" ${l.status === k ? 'selected' : ''}>${STATUS_TH[k]}</option>`).join('')}</select></div></div>`;
  }

  const RV = [['greeting', 'การทักทาย / เปิดบทสนทนา'], ['needs', 'ถามความต้องการลูกค้า'], ['info', 'ให้ข้อมูลและราคาชัดเจน'], ['closing', 'ชวนนัด / ปิดการขาย'], ['speed', 'ความเร็วในการตอบ']];
  const scoreClass = (v) => (v >= 80 ? 'excellent' : v >= 60 ? 'good' : v >= 40 ? 'average' : 'poor');
  function reviewFormHtml() {
    const rv = S.chat.data && S.chat.data.review;
    return `<form class="rv-form" data-form="review"><h4>รีวิวแชทนี้ ${rv ? `<span class="q-badge q-${scoreClass(rv.score)}">${rv.score}% · โดย ${esc(rv.reviewer)}</span>` : ''}</h4>
      ${RV.map(([k, label]) => `<div class="rv-row"><span>${label}</span><div class="rv-scale">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="s_${k}" value="${n}" ${rv && rv.scores[k] === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>`).join('')}
      <textarea name="note" rows="2" maxlength="600" placeholder="ความเห็นถึงเซลส์ (ไม่บังคับ)">${rv ? esc(rv.note) : ''}</textarea>
      <div class="row-actions"><button class="btn primary" type="submit">${rv ? 'อัปเดตรีวิว' : 'บันทึกรีวิว'}</button><small class="rv-hint">1 = ต้องปรับปรุง · 5 = ดีเยี่ยม</small></div></form>`;
  }

  function renderDrawer() {
    const root = document.getElementById('drawer-root'); if (!root || S.route === 'inbox') return;
    const c = S.chat;
    if (!c.id) { root.innerHTML = ''; document.body.classList.remove('drawer-open'); return; }
    document.body.classList.add('drawer-open');
    const d = c.data; const l = d && d.lead;
    let body;
    if (c.err) body = `<div class="notice err" style="margin:16px">${esc(c.err)}</div>`;
    else if (c.loading || !d) body = '<div class="loading">Loading…</div>';
    else if (!d.messages.length) body = '<div class="empty">ยังไม่มีข้อความของแชทนี้<br>ต้องเชื่อมระบบแชทของคลินิกเพื่อดึงข้อความจริง</div>';
    else {
      let lastDay = '';
      body = d.messages.map((m) => {
        const [day, time] = m.at.split(' ');
        const sep = day !== lastDay ? `<div class="day-sep"><span>${esc(day)}</span></div>` : '';
        lastDay = day;
        return `${sep}<div class="msg ${m.from === 'staff' ? 'out' : 'in'}"><div class="bubble">${esc(m.text)}</div><small>${m.from === 'staff' ? staffLabel(m) + ' · ' : ''}${esc(time)}</small></div>`;
      }).join('');
    }
    const ready = d && !c.err && !c.loading;
    const tools = ready ? `<div class="drawer-tools">${composerHtml(d)}${S.route === 'review' ? reviewFormHtml() : ''}${S.route === 'followup' ? statusSelectHtml(l) + followFormHtml() : ''}</div>` : '';
    root.innerHTML = `<div class="drawer-overlay" data-act="close-chat"></div>
      <aside class="drawer" role="dialog" aria-label="ข้อความแชท">
        <header><div><b>${l ? esc(l.name) : ''}</b>
          ${l ? `<div class="d-meta">${chanHtml(l.channel)}${statusHtml(l.status)}</div><small>${esc(l.ad)} · เริ่มคุย ${esc(l.date)}${l.rep ? ' · ดูแลโดย ' + esc(l.rep) : ''}</small>` : ''}</div>
          <button class="icon-btn" data-act="close-chat" aria-label="ปิด">✕</button></header>
        <div class="chat-scroll">${body}</div>${tools}</aside>`;
    const sc = root.querySelector('.chat-scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  }

  /* --- inbox (หน้าต่างแชทแบบ Messenger) --- */
  const AV_COLORS = ['#44602f', '#2a56b8', '#a86400', '#8a3a7a', '#b8301f', '#2f7f8a'];
  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const $id = (x) => document.getElementById(x);

  function curaAvatarHtml(name, id, size = 42) {
    const ch = String(name || '').replace(/^คุณ\s*/, '').trim().charAt(0) || '?';
    let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const blobColors = [
      ['#10b981', '#059669'],
      ['#059669', '#064e3b'],
      ['#34d399', '#059669'],
      ['#0d9488', '#115e59'],
      ['#0284c7', '#0369a1'],
      ['#6366f1', '#4338ca'],
      ['#8b5cf6', '#6d28d9'],
      ['#d97706', '#b45309'],
    ];
    const pair = blobColors[h % blobColors.length];
    const radiuses = [
      '42% 58% 70% 30% / 45% 45% 55% 55%',
      '50% 50% 34% 66% / 56% 68% 32% 44%',
      '60% 40% 30% 70% / 60% 30% 70% 40%',
      '38% 62% 63% 37% / 41% 44% 56% 59%',
      '52% 48% 65% 35% / 43% 57% 43% 57%'
    ];
    const rad = radiuses[h % radiuses.length];
    return `<div class="cura-blob-avatar" style="width:${size}px;height:${size}px;border-radius:${rad};background:linear-gradient(135deg, ${pair[0]}, ${pair[1]});font-size:${Math.round(size * 0.42)}px;">${esc(ch)}</div>`;
  }

  function curaSlaRingHtml(r, size = 40) {
    if (!r) return '';
    let state = 'ontime';
    let pct = 80;
    if (r.status === 'no_reply' || (r.last && r.last.from !== 'staff')) {
      const waitMin = r.last ? Math.floor((Date.now() - atMs(r.last.at)) / 60000) : 20;
      if (waitMin > 15) { state = 'late'; pct = 100; }
      else if (waitMin >= 10) { state = 'warning'; pct = Math.round((waitMin / 15) * 100); }
      else { state = 'ontime'; pct = Math.round((Math.max(1, waitMin) / 15) * 100); }
    } else {
      state = 'ontime';
      pct = 100;
    }
    const rRadius = Math.round(size / 2) + 1;
    const circ = 2 * Math.PI * rRadius;
    const offset = circ * (1 - Math.min(100, pct) / 100);
    const boxSize = size + 6;
    return `<div class="cura-sla-ring sla-${state}">
      <svg viewBox="0 0 ${boxSize} ${boxSize}">
        <circle class="track" cx="${boxSize/2}" cy="${boxSize/2}" r="${rRadius}"></circle>
        <circle class="fill" cx="${boxSize/2}" cy="${boxSize/2}" r="${rRadius}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
      </svg>
    </div>`;
  }
  function avatarHtml(name, id, size) {
    const ch = String(name).replace(/^คุณ\s*/, '').trim().charAt(0) || '?';
    let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `<span class="avatar-lg" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;background:${AV_COLORS[h % AV_COLORS.length]}">${esc(ch)}</span>`;
  }
  const atMs = (at) => Date.parse(at.replace(' ', 'T') + ':00+07:00');
  function ago(at) {
    const m = Math.floor((Date.now() - atMs(at)) / 60000);
    if (m < 1) return 'ตอนนี้';
    if (m < 60) return `${m} นาที`;
    if (m < 1440) return `${Math.floor(m / 60)} ชั่วโมง`;
    if (m < 10080) return `${Math.floor(m / 1440)} วัน`;
    return `${Math.floor(m / 10080)} สัปดาห์`;
  }
  function sepLabel(at) {
    const [d, t] = at.split(' '); const [, mo, dd] = d.split('-');
    return `${Number(dd)} ${MONTHS[Number(mo) - 1]} ${t} น.`;
  }

  async function loadInbox() {
    if (await fetchList('inbox', '/api/inbox')) {
      renderInboxBody();
      updateGlobalUnrepliedBadges();
    }
  }

  function inboxShell() {
    return `
      <div class="cura-inbox-header">
        <div class="cura-inbox-title-wrap">
          <h1>Inbox</h1>
          <span class="cura-copilot-pill"><span class="pulse-dot"></span> แชทเข้าแบบเรียลไทม์</span>
        </div>
        <div class="inline-range">${rangeBar('inbox')}</div>
      </div>
      <div id="inbox-body"><div class="loading">Loading…</div></div>
    `;
  }

  function filteredRows() {
    const s = S.inbox; if (!s.data) return [];
    const q = s.search.trim().toLowerCase();
    const folder = s.folder || 'all';
    const activeChan = (s.channel || '').toLowerCase();
    const activePage = (s.page || '').toLowerCase();
    return s.data.rows.filter((r) => {
      const rPlat = String(r.platform || (r.channel === 'Instagram' ? 'Instagram' : r.channel === 'LINE' ? 'LINE' : r.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook')).toLowerCase();
      const rChan = String(r.channel || '').toLowerCase();
      if (activeChan) {
        if (activeChan === 'facebook' || activeChan === 'messenger') {
          if (rPlat !== 'facebook' && rChan !== 'messenger') return false;
        } else if (activeChan === 'instagram' || activeChan === 'ig') {
          if (rPlat !== 'instagram' && rChan !== 'instagram') return false;
        } else if (activeChan === 'line') {
          if (rPlat !== 'line' && rChan !== 'line') return false;
        } else if (activeChan === 'whatsapp') {
          if (rPlat !== 'whatsapp' && rChan !== 'whatsapp') return false;
        } else if (rChan !== activeChan && rPlat !== activeChan) {
          return false;
        }
      }
      if (activePage) {
        const rPid = String(r.pageId || '').toLowerCase();
        const rPname = String(r.pageName || '').toLowerCase();
        if (rPid !== activePage && !rPname.includes(activePage) && !activePage.includes(rPname)) {
          return false;
        }
      }
      if (s.status && r.status !== s.status) return false;
      if (folder === 'unreplied') {
        if (!needsReply(r)) return false;
      } else if (folder === 'starred') {
        if (!r.starred && r.status !== 'converted' && r.status !== 'booked') return false;
      }
      if (q && ![r.name, r.id, r.ad, r.pageName, r.platform, r.channel, r.phone].some((x) => String(x || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function renderInboxBody() {
    const box = $id('inbox-body'); const s = S.inbox; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err">${esc(s.err)}</div>`; return; }
    if (!s.data) return;
    box.innerHTML = `
      <div class="cura-panels-row">
        <!-- Panel 1: Conversation List (Clean Full Width) -->
        <div class="cura-panel-left">
          <div class="cura-convs-col" style="display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden">
            <div id="mess-tools"></div>
            <div class="cura-conv-feed" id="mess-list" style="flex:1;overflow-y:auto"></div>
          </div>
        </div>
        <!-- Panel 2: Center Active Chat Area (Flex-1) -->
        <div class="cura-panel-center" id="mess-chat"></div>
        <!-- Panel 3: Right Contact & CRM Info Panel (320px) -->
        <div class="cura-panel-right" id="mess-info"></div>
      </div>
    `;
    renderInboxTools(); renderInboxList();
    if (s.focus) { const id = s.focus; s.focus = ''; openChat(id); return; }
    const ids = new Set(s.data.rows.map((r) => r.id));
    if (S.chat.id && ids.has(S.chat.id)) { renderInboxChat(); renderInboxInfo(); }
    else {
      const first = filteredRows()[0] || s.data.rows[0];
      if (first) openChat(first.id); else { S.chat.id = null; renderInboxChat(); renderInboxInfo(); }
    }
  }

  function renderInboxTools() {
    const el = $id('mess-tools'); const s = S.inbox; if (!el || !s.data) return;
    const allRows = s.data.rows;
    const totalCount = allRows.length;
    const unrepliedCount = allRows.filter(needsReply).length;
    const starredCount = allRows.filter((r) => r.starred || r.status === 'converted' || r.status === 'booked').length;
    const activeFolder = s.folder || 'all';

    // นับจำนวนแชทแยกตามแต่ละแพลตฟอร์ม
    const platCounts = { Facebook: 0, Instagram: 0, LINE: 0, WhatsApp: 0 };
    for (const r of allRows) {
      const p = r.platform || (r.channel === 'Instagram' ? 'Instagram' : r.channel === 'LINE' ? 'LINE' : r.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook');
      if (platCounts[p] !== undefined) platCounts[p]++;
      else platCounts[p] = (platCounts[p] || 0) + 1;
    }
    const activeChan = s.channel || '';

    el.innerHTML = `
      <div class="cura-conv-search-wrap" style="padding:12px 14px 10px;border-bottom:1px solid #f1f5f9;background:#ffffff">
        <div class="cura-search-inner">
          ${icon('search')}
          <input id="isearch" data-bind="isearch" placeholder="ค้นหาแชท, ชื่อลูกค้า, เบอร์..." value="${esc(s.search)}" autocomplete="off">
        </div>
        <div class="cura-inbox-pills-row" style="display:flex;align-items:center;gap:6px;margin-top:10px;overflow-x:auto;padding-bottom:2px">
          <button type="button" class="cura-pill-tab ${activeFolder === 'all' && !activeChan ? 'active' : ''}" data-act="inbox-folder" data-folder="all">
            💬 ทั้งหมด <span class="badge">${num(totalCount)}</span>
          </button>
          <button type="button" class="cura-pill-tab ${activeFolder === 'unreplied' ? 'active' : ''}" data-act="inbox-folder" data-folder="unreplied">
            ⌛ ยังไม่ตอบ ${unrepliedCount > 0 ? `<span class="badge unreplied">${unrepliedCount}</span>` : ''}
          </button>
          <button type="button" class="cura-pill-tab ${activeFolder === 'starred' ? 'active' : ''}" data-act="inbox-folder" data-folder="starred">
            ⭐ ติดดาว ${starredCount > 0 ? `<span class="badge">${starredCount}</span>` : ''}
          </button>
          <span style="width:1px;height:16px;background:#e2e8f0;margin:0 2px;flex-shrink:0"></span>
          <button type="button" class="cura-pill-tab ${activeChan.toLowerCase() === 'facebook' ? 'active' : ''}" data-act="inbox-channel" data-channel="Facebook" title="Facebook Messenger">
            🔵 FB ${platCounts.Facebook > 0 ? `<span class="badge">${platCounts.Facebook}</span>` : ''}
          </button>
          <button type="button" class="cura-pill-tab ${activeChan.toLowerCase() === 'instagram' ? 'active' : ''}" data-act="inbox-channel" data-channel="Instagram" title="Instagram Direct">
            📸 IG ${platCounts.Instagram > 0 ? `<span class="badge">${platCounts.Instagram}</span>` : ''}
          </button>
          <button type="button" class="cura-pill-tab ${activeChan.toLowerCase() === 'line' ? 'active' : ''}" data-act="inbox-channel" data-channel="LINE" title="LINE Official Account">
            🟢 LINE ${platCounts.LINE > 0 ? `<span class="badge">${platCounts.LINE}</span>` : ''}
          </button>
          <button type="button" class="cura-pill-tab ${activeChan.toLowerCase() === 'whatsapp' ? 'active' : ''}" data-act="inbox-channel" data-channel="WhatsApp" title="WhatsApp Business">
            💚 WA ${platCounts.WhatsApp > 0 ? `<span class="badge">${platCounts.WhatsApp}</span>` : ''}
          </button>
        </div>
      </div>
    `;
  }

  function renderInboxList() {
    const list = $id('mess-list'); if (!list) return;
    const rows = filteredRows(); const MAX = 400;
    if (!rows.length) {
      list.innerHTML = '<div class="empty" style="padding:24px 10px;text-align:center">ไม่พบบทสนทนาที่ตรงกับตัวกรอง</div>';
      return;
    }
    list.innerHTML = rows.slice(0, MAX).map((r) => {
      const isSelected = r.id === S.chat.id;
      const snippet = r.last ? `${r.last.from === 'staff' ? '<span style="color:#94a3b8">คุณ: </span>' : ''}${esc(r.last.text)}` : '<span style="color:#94a3b8;font-style:italic">ยังไม่มีข้อความ</span>';
      const timeStr = r.last ? ago(r.last.at) : esc(r.date);
      const ch = r.platform || (r.channel === 'Instagram' ? 'Instagram' : r.channel === 'LINE' ? 'LINE' : r.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook');
      const miniLogo = getBrandLogo(ch, 12);
      // ป้ายเวลารอ: แสดงเฉพาะแชทที่ลูกค้ารอเราตอบ (เป้าหมายตอบภายใน 15 นาที)
      let waitBadge = '';
      if (needsReply(r)) {
        const waitMin = Math.max(0, Math.floor((Date.now() - atMs(r.last.at)) / 60000));
        const waitTxt = waitMin < 60 ? `${waitMin} นาที` : waitMin < 1440 ? `${Math.floor(waitMin / 60)} ชม.` : `${Math.floor(waitMin / 1440)} วัน`;
        const st = waitMin > 15 ? 'late' : waitMin >= 10 ? 'warning' : 'ontime';
        waitBadge = `<span class="cura-sla-badge ${st}" title="ลูกค้ารอคำตอบ (เป้าหมาย 15 นาที)">⏱ รอตอบ ${waitTxt}</span>`;
      }

      // ป้ายแพลตฟอร์ม (Platform Badge)
      const platBadge = ch === 'Instagram'
        ? `<span class="cura-tag-pill" style="background:#fce7f3;color:#be185d;border:1px solid #fbcfe8;font-weight:700">📸 Instagram</span>`
        : ch === 'LINE'
        ? `<span class="cura-tag-pill" style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;font-weight:700">🟢 LINE</span>`
        : ch === 'WhatsApp'
        ? `<span class="cura-tag-pill" style="background:#d1fae5;color:#047857;border:1px solid #a7f3d0;font-weight:700">💚 WhatsApp</span>`
        : `<span class="cura-tag-pill" style="background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;font-weight:700">🔵 Facebook</span>`;

      // ป้ายชื่อเพจ (Page Badge)
      const pageBadge = r.pageName
        ? `<span class="cura-tag-pill" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis" title="${esc(r.pageName)}">📄 ${esc(r.pageName)}</span>`
        : '';

      return `
        <div class="cura-conv-card ${isSelected ? 'active' : ''}" data-act="select-chat" data-id="${esc(r.id)}">
          <div class="cura-avatar-shell">
            ${curaSlaRingHtml(r, 40)}
            ${curaAvatarHtml(r.name, r.id, 40)}
            <span class="cura-chan-badge-overlay" title="${esc(ch)}">${miniLogo}</span>
          </div>
          <div class="cura-card-content">
            <div class="cura-card-head">
              <span class="cura-card-name">${esc(r.name)}</span>
              <span class="cura-card-time">${timeStr}</span>
            </div>
            <div class="cura-card-snippet">${snippet}</div>
            <div class="cura-card-footer">
              ${waitBadge}
              <span class="cura-tag-pill" style="background:${(STATUS_COLOR[r.status] || '#64748b')}14;color:${STATUS_COLOR[r.status] || '#64748b'};border:1px solid ${(STATUS_COLOR[r.status] || '#64748b')}33;font-weight:700">${esc(STATUS_TH[r.status] || 'มาใหม่')}</span>
              ${isPersonName(r.rep) ? `<span class="cura-tag-pill" style="background:#f8fafc;color:#0369a1;font-weight:600">👤 ${esc(r.rep)}</span>` : ''}
            </div>
            ${r.pageName ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(r.pageName)}">${ch === 'Instagram' ? '📸' : ch === 'LINE' ? '💬' : ch === 'WhatsApp' ? '🟢' : '📘'} ${esc(r.pageName)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('') + (rows.length > MAX ? `<div class="ad-sub" style="text-align:center;padding:10px">แสดง ${MAX} จาก ${num(rows.length)} แชท (ใช้ช่องค้นหาเพื่อหาแชทที่เหลือ)</div>` : '');
  }

  function currentLead() {
    const c = S.chat; if (!c.id) return null;
    return (c.data && c.data.lead) || (S.inbox.data && S.inbox.data.rows.find((r) => r.id === c.id)) || null;
  }

  function renderInboxChat() {
    const box = $id('mess-chat'); if (!box) return;
    const c = S.chat; const l = currentLead();
    if (!l) {
      box.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px 20px;color:#64748b">
          <div style="filter:drop-shadow(0 10px 25px rgba(16,185,129,0.25));margin-bottom:16px;animation:ghostFloat 3s ease-in-out infinite">
            ${ghostSvg(88)}
          </div>
          <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px">เลือกบทสนทนาเพื่อเริ่มตอบแชท</div>
          <div style="font-size:13px;color:#64748b;max-width:320px;line-height:1.6">คลิกเลือกลูกค้าจากรายการด้านซ้าย หรือดูคำแนะนำประเมินกราฟต์ผมและปิดการขายจาก BEQ Copilot ได้ทันทีครับ ✨</div>
        </div>
      `;
      return;
    }
    const d = c.data; let body;
    if (c.err) body = `<div class="notice err" style="margin:16px">${esc(c.err)}</div>`;
    else if (c.loading || !d) body = '<div class="loading">Loading chat messages…</div>';
    else if (!d.messages.length) {
      body = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;color:#64748b">
          <div style="filter:drop-shadow(0 8px 20px rgba(16,185,129,0.2));margin-bottom:14px;animation:ghostFloat 3s ease-in-out infinite">
            ${ghostSvg(72)}
          </div>
          <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px">ยังไม่มีข้อความในบทสนทนานี้</div>
          <div style="font-size:12.5px;color:#64748b">พิมพ์ข้อความด้านล่างเพื่อเปิดบทสนทนากับคนไข้ได้เลยครับ</div>
        </div>
      `;
    }
    else {
      const ms = d.messages;
      body = ms.map((m, i) => {
        const gap = i === 0 || atMs(m.at) - atMs(ms[i - 1].at) >= 3600e3 || m.at.slice(0, 10) !== ms[i - 1].at.slice(0, 10);
        const sep = gap ? `<div class="cura-date-divider"><span>${esc(sepLabel(m.at))}</span></div>` : '';
        const isStaff = m.from === 'staff';
        return `
          ${sep}
          <div class="cura-bubble-row ${isStaff ? 'out' : 'in'}">
            ${!isStaff ? curaAvatarHtml(l.name, l.id, 32) : ''}
            <div class="cura-bubble ${isStaff ? 'out' : 'in'}" title="${esc(m.at)}">
              <div>${esc(m.text)}</div>
              <div class="cura-bubble-time">
                <span>${ago(m.at)}</span>
                ${isStaff ? `<span style="white-space:nowrap">· ${staffLabel(m)}</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
    const aiAnalysis = analyzeLeadConversation(l, d && d.messages);
    const aiSummaryCard = aiAnalysis ? `
      <div class="cura-ai-summary-box">
        <div class="cura-ai-summary-header">
          <span class="cura-ai-summary-badge" title="AI อ่านจากข้อความของลูกค้าในแชทนี้ ควรตรวจสอบก่อนใช้">✨ สรุปจากแชท (AI)</span>
          <span class="sentiment-pill sentiment-${aiAnalysis.sentiment.cls}">${aiAnalysis.sentiment.icon} ${esc(aiAnalysis.sentiment.label)}</span>
        </div>
        <div><b>🩺 ลูกค้าพูดถึง:</b> ${esc(aiAnalysis.hairIssue)}</div>
        <div><b>💡 แนะนำ:</b> ${esc(aiAnalysis.sentiment.tip)}</div>
      </div>
    ` : '';

    // Calculate SLA 15m target countdown
    let slaUrgent = false;
    let timeLeftStr = 'ตอบแล้ว ✓';
    const lastMsg = (d && Array.isArray(d.messages) && d.messages.length) ? d.messages[d.messages.length - 1] : l.last;
    if (needsReply({ last: lastMsg })) {
      const elapsedMin = Math.floor((Date.now() - atMs(lastMsg.at)) / 60000);
      const remain = 15 - elapsedMin;
      const fmt = (m) => (m < 60 ? `${m} นาที` : m < 1440 ? `${Math.floor(m / 60)} ชม.` : `${Math.floor(m / 1440)} วัน`);
      if (remain <= 0) { slaUrgent = true; timeLeftStr = `เกินมา ${fmt(Math.abs(remain))}`; }
      else { slaUrgent = remain <= 5; timeLeftStr = `เหลือ ${remain} นาที`; }
    } else if (!lastMsg) {
      timeLeftStr = 'ยังไม่มีข้อความ';
    }

    box.innerHTML = `
      <div class="cura-thread-header">
        <div class="cura-thread-user-info">
          <button type="button" class="m-back-btn" data-act="m-chat-back" aria-label="กลับไปรายการแชท">←</button>
          <div class="cura-avatar-shell">
            ${curaSlaRingHtml(l, 38)}
            ${curaAvatarHtml(l.name, l.id, 38)}
          </div>
          <div>
            <div class="cura-thread-title">
              <b>${esc(l.name)}</b>
              ${statusPillSelectHtml(l)}
            </div>
            <div class="cura-thread-sub">
              <span>${chanHtml(l.channel)}</span>
              ${l.pageName ? `<span>· 📄 <b>${esc(l.pageName)}</b></span>` : ''}
              <span>· เซลล์ผู้ดูแล: <b style="color:var(--brand-deep)">${esc(isPersonName(l.rep) ? l.rep : 'ยังไม่มอบหมาย')}</b></span>
            </div>
          </div>
        </div>
        <div class="cura-thread-actions">
          <div class="sla-target-pill ${slaUrgent ? 'urgent' : ''}">
            <span class="sla-pulse"></span>
            <span>ตอบภายใน 15 นาที: ⏱️ <b>${timeLeftStr}</b></span>
          </div>
          <button type="button" class="cura-takeover-btn ${c.takenOver ? 'ai-active' : ''}" data-act="takeover-chat">
            ${c.takenOver ? '⚡ คุณกำลังดูแลแชทนี้' : 'รับดูแลแชทนี้'}
          </button>
        </div>
      </div>
      ${aiSummaryCard}
      <div class="cura-thread-feed" id="chat-scroll">${body}</div>
      <div class="cura-composer-box cura-composer">
        ${d && !c.err && !c.loading ? composerHtml(d) : ''}
      </div>
    `;
    const sc = $id('chat-scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function renderInboxInfo() {
    const box = $id('mess-info'); if (!box) return;
    const l = currentLead();
    if (!l) { box.innerHTML = '<div class="empty">เลือกแชทเพื่อดูข้อมูลลูกค้า</div>'; return; }
    const aiAnalysis = analyzeLeadConversation(l, S.chat.data && S.chat.data.messages);
    const curTab = S.chat.tab || 'overview';

    let tabContent = '';
    if (curTab === 'overview') {
      tabContent = `
        <!-- Warm Tinted Notes Card -->
        <div class="cura-notes-card">
          <div class="cura-notes-head">
            <span>📝 บันทึกลูกค้า</span>
            <span style="font-size:10px;color:#b45309">${l.notes ? 'บันทึกโดยทีม' : aiAnalysis ? 'AI ประเมินจากแชท · โปรดตรวจสอบ' : ''}</span>
          </div>
          <div class="cura-notes-body">
            ${l.notes ? esc(l.notes)
              : aiAnalysis ? esc(aiAnalysis.stageNote ? `${aiAnalysis.stageNote} · ปัญหาหลัก: ${aiAnalysis.hairIssue} · แพ็กเกจที่น่าจะเหมาะ: ${aiAnalysis.procType} (${aiAnalysis.grafts})` : `ปัญหาที่ลูกค้าพูดถึง: ${aiAnalysis.hairIssue} · แพ็กเกจที่น่าจะเหมาะ: ${aiAnalysis.procType} (${aiAnalysis.grafts})`)
              : '<span style="color:#94a3b8">ยังไม่มีข้อความจากลูกค้าให้สรุป</span>'}
          </div>
        </div>

        <!-- Conversation Actions Card -->
        <div class="cura-section-card">
          <div class="cura-section-card-title">⚡ จัดการแชท</div>
          <div class="cura-section-card-body" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">
            <div class="cura-field-group">
              <label style="font-size:11px;font-weight:700;color:#64748b">เซลล์ที่ดูแลแชทนี้</label>
              <select data-bind="rep-select" data-id="${esc(l.id)}" style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:12.5px;font-weight:600">
                <option value="">— ยังไม่มอบหมาย —</option>
                ${repNameList(l.rep || l.repId).map((repName) => `<option value="${esc(repName)}" ${l.rep === repName || l.repId === repName ? 'selected' : ''}>👤 ${esc(repName)}</option>`).join('')}
              </select>
            </div>
            <div class="cura-field-group">
              <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">สถานะลูกค้า</label>
              ${statusSelectHtml(l)}
            </div>
            ${S.chat.data && S.chat.data.lead && S.chat.data.lead.id === l.id ? followFormHtml() : ''}
          </div>
        </div>

        <!-- AI Lead Analysis Card -->
        <div class="cura-section-card" style="border:1.5px solid #a7f3d0;background:#f0fdf4">
          <div class="cura-section-card-title" style="color:#065f46">
            <span>✨ ผู้ช่วย AI วิเคราะห์แชท</span>
            <button type="button" class="cura-regen-btn" data-act="regenerate-summary" style="background:#dcfce7;color:#059669">🔄 วิเคราะห์ใหม่</button>
          </div>
          <div class="cura-section-card-body" style="padding:12px 14px;font-size:12.5px;line-height:1.5;display:flex;flex-direction:column;gap:6px">
            <div><b>🩺 ปัญหาเส้นผม:</b> <span style="color:#065f46;font-weight:600">${esc(aiAnalysis ? aiAnalysis.hairIssue : 'ผมร่วง / ปรึกษาฟื้นฟูเส้นผมทั่วไป')}</span></div>
            <div><b>🔬 กราฟต์ผมประเมิน:</b> <span class="chip good" style="font-size:11px;padding:2px 8px;font-weight:700">${esc(aiAnalysis ? aiAnalysis.grafts : '2,500 Grafts')}</span></div>
            <div><b>💡 กลยุทธ์ปิดการขาย:</b> ${esc(aiAnalysis && aiAnalysis.sentiment ? aiAnalysis.sentiment.tip : 'ส่งข้อมูลโปรแกรมการรักษาและเคสรีวิวเปรียบเทียบ')}</div>
            <div style="margin-top:4px;padding-top:6px;border-top:1px dashed #bbf7d0;color:#047857;font-size:11.5px"><b>🚀 ก้าวถัดไปที่แนะนำ:</b> ${esc(aiAnalysis ? aiAnalysis.nextStep : 'ส่งเคสรีวิว')}</div>
          </div>
        </div>

        <!-- Contact Details Card -->
        <div class="cura-section-card">
          <div class="cura-section-card-title">👤 ข้อมูลติดต่อ</div>
          <div class="cura-section-card-body" style="padding:12px 14px;display:flex;flex-direction:column;gap:6px">
            <div class="cura-detail-row" style="display:flex;justify-content:space-between;font-size:12px"><span>Platform:</span> <b>${esc(l.platform || (l.channel === 'Instagram' ? 'Instagram' : 'Facebook'))}</b></div>
            <div class="cura-detail-row" style="display:flex;justify-content:space-between;font-size:12px"><span>Page / Account:</span> <b>${esc(l.pageName || '—')}</b></div>
            <div class="cura-detail-row" style="display:flex;justify-content:space-between;font-size:12px"><span>Channel:</span> <b>${esc(l.channel)}</b></div>
            <div class="cura-detail-row" style="display:flex;justify-content:space-between;font-size:12px"><span>Started Date:</span> <b>${esc(l.date)}</b></div>
            <div class="cura-detail-row" style="display:flex;justify-content:space-between;font-size:12px"><span>Phone:</span> <b>${esc(l.phone || '—')}</b></div>
            <div class="cura-detail-row" style="display:flex;justify-content:space-between;font-size:12px"><span>Ad Source:</span> <b>${esc(l.ad || 'Direct / Organic')}</b></div>
          </div>
        </div>
      `;
    } else if (curTab === 'activity') {
      tabContent = `
        <div class="cura-section-card">
          <div class="cura-section-card-title">📅 Patient Activity Timeline</div>
          <div class="cura-section-card-body" style="padding:14px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:16px">🎯</span>
              <div>
                <b style="font-size:12.5px;display:block">Lead Captured via Ad</b>
                <small style="color:#64748b">${esc(l.date)} · ${esc(l.ad || 'FUE Hair Transplant Campaign')}</small>
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:16px">💬</span>
              <div>
                <b style="font-size:12.5px;display:block">First Response Recorded</b>
                <small style="color:#059669;font-weight:600">ตอบกลับภายใน ${l.firstResponseMin || 4} นาที (SLA Met ✓)</small>
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:16px">✨</span>
              <div>
                <b style="font-size:12.5px;display:block">BEQ Copilot Case Analysis</b>
                <small style="color:#64748b">AI ตรวจพบความต้องการกราฟต์ผม 2,500 กราฟต์</small>
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:16px">🏥</span>
              <div>
                <b style="font-size:12.5px;display:block">Branch Visit Scheduled</b>
                <small style="color:#64748b">BEQ Hair Clinic สาขาสีลม · นัดพบแพทย์ผู้เชี่ยวชาญ</small>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (curTab === 'gallery') {
      tabContent = `
        <div class="cura-section-card">
          <div class="cura-section-card-title">📷 Scalp Assessment Photos (3)</div>
          <div class="cura-section-card-body" style="padding:12px;display:grid;grid-template-columns:repeat(2, 1fr);gap:8px">
            <div style="border-radius:10px;background:#f1f5f9;height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;padding:4px">
              <span style="font-size:22px">📐</span>
              <b>M-Shape Scalp</b>
            </div>
            <div style="border-radius:10px;background:#f1f5f9;height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;padding:4px">
              <span style="font-size:22px">🔬</span>
              <b>Donor Area</b>
            </div>
            <div style="border-radius:10px;background:#f1f5f9;height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;padding:4px;grid-column:span 2">
              <span style="font-size:22px">✨</span>
              <b>2,500 Grafts Hairline Simulation</b>
            </div>
          </div>
        </div>
      `;
    }

    box.innerHTML = `
      <!-- Profile Header -->
      <div class="cura-profile-center">
        <div class="cura-avatar-shell">
          ${curaSlaRingHtml(l, 64)}
          ${curaAvatarHtml(l.name, l.id, 64)}
        </div>
        <h3 class="cura-profile-header-name">${esc(l.name)}</h3>
        <div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap">
          ${chanHtml(l.channel)}
          ${statusHtml(l.status)}
        </div>
        <div class="cura-quick-actions-bar">
          <button type="button" class="cura-quick-act-btn" data-act="quick-call" data-phone="${esc(l.phone || '')}" title="โทรหาลูกค้า">📞</button>
          <button type="button" class="cura-quick-act-btn" data-act="star-chat" title="${l.starred ? 'Starred' : 'Star'}" style="${l.starred ? 'color:#f59e0b' : ''}">⭐</button>
          <button type="button" class="cura-quick-act-btn" data-act="copy-chat-link" title="คัดลอกลิงก์แชท">🔗</button>
        </div>
      </div>

      <!-- Segmented Tabs -->
      <div class="cura-profile-pill-tabs">
        <button type="button" class="cura-pill-tab ${curTab === 'overview' ? 'active' : ''}" data-act="info-tab" data-tab="overview">ภาพรวม</button>
        <button type="button" class="cura-pill-tab ${curTab === 'activity' ? 'active' : ''}" data-act="info-tab" data-tab="activity">ประวัติ</button>
        <button type="button" class="cura-pill-tab ${curTab === 'gallery' ? 'active' : ''}" data-act="info-tab" data-tab="gallery">รูปภาพ</button>
      </div>

      ${tabContent}
    `;
  }

  function renderChatViews() {
    if (S.route === 'inbox') {
      document.querySelectorAll('.cura-conv-card, .conv').forEach((el) => el.classList.toggle('active', el.dataset.id === S.chat.id));
      renderInboxChat(); renderInboxInfo();
    } else renderDrawer();
  }

  /* --- board --- */
  async function loadBoard() { loadSla(); if (await fetchList('board', '/api/board')) renderBoardBody(); }

  /* --- SLA ตอบแชท 15 นาที (ใช้ช่วงวันเดียวกับ Board) --- */
  async function loadSla() {
    const b = S.route === 'review' ? S.review : S.board; const s = S.sla;
    if (b.range === 'custom' && !(b.from && b.to && b.from <= b.to)) return;
    const seq = ++seqs.sla; s.err = null;
    try { const data = await api('/api/sla?' + listQuery(b)); if (seq !== seqs.sla) return; s.data = data; }
    catch (e) { if (seq !== seqs.sla) return; s.err = e.message; }
    renderSlaBody();
  }
  const fmtDur = (m) => (m < 60 ? `${num(m, m % 1 ? 1 : 0)} นาที` : m < 1440 ? `${num(m / 60, 1)} ชม.` : `${num(m / 1440, 1)} วัน`);
  const SLA_WIN = { work: '10:00–19:00', commute: 'ช่วงเดินทาง', night: 'กลางคืน' };
  const SLA_OUT = {
    ontime: ['ทันเวลา', 'q-excellent'], deduct: ['หัก 1 แต้ม', 'q-poor'], dup: ['ช้า (ไม่หักซ้ำ)', 'q-average'],
    read_no_reply: ['อ่านไม่ตอบ หัก 0.5', 'q-average'],
    commute: ['ช้า · ช่วงเดินทาง ไม่หัก', 'q-average'], late_night: ['ช้า · กลางคืน ไม่หัก', 'q-none'],
  };
  const SLA_KINDS = [
    ['', 'ทั้งหมด', 'all', '🌐'],
    ['deduct', 'หักคะแนน', 'deduct', '⚠️'],
    ['commute', 'ช้าช่วงเดินทาง', 'commute', '🚗'],
    ['night', 'ตอบนอกเวลา 22:00–08:00', 'night', '🌙']
  ];
  function renderSlaBody() {
    const box = $id('sla-body'); const s = S.sla; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err" style="margin-bottom:14px">${esc(s.err)}</div>`; return; }
    if (!s.data) { box.innerHTML = '<div class="loading" style="padding:30px">Loading…</div>'; return; }
    const d = s.data;
    // แยกดูตามเพจ: เลือกเพจเดียว → ตัวเลขสรุปด้านบนคิดเฉพาะเพจนั้น
    const pageOf = (r) => r.pageName || 'ไม่ระบุเพจ';
    const pageNames = [...new Set(d.reps.map(pageOf))];
    if (s.page && !pageNames.includes(s.page)) s.page = '';
    const repsShown = s.page ? d.reps.filter((r) => pageOf(r) === s.page) : d.reps;
    const sumReps = (list) => list.reduce((a, r) => ({
      turns: a.turns + (r.turns || 0), onTime: a.onTime + (r.onTime || 0), late: a.late + (r.late || 0),
      deducted: a.deducted + (r.deducted || 0), commuteLate: a.commuteLate + (r.commuteLate || 0), nightReplies: a.nightReplies + (r.nightReplies || 0),
    }), { turns: 0, onTime: 0, late: 0, deducted: 0, commuteLate: 0, nightReplies: 0 });
    const t = s.page ? sumReps(repsShown) : d.totals;
    const open = d.reps.find((r) => r.repId === s.open);
    const evFilter = (e) => {
      if (!s.kind) return true;
      if (s.kind === 'night') return e.replyWindow === 'night';
      if (s.kind === 'commute') return e.outcome === 'commute';
      if (s.kind === 'deduct') return e.outcome === 'deduct' || e.outcome === 'read_no_reply';
      return e.outcome === s.kind;
    };
    const evs = open ? open.events.filter(evFilter) : [];

    const kindPills = SLA_KINDS.map(([k, l, cls, ico]) =>
      `<button type="button" class="sla-kind-pill ${cls} ${s.kind === k ? 'active' : ''}" data-act="sla-kind" data-kind="${k}"><span class="pill-ico">${ico}</span><span>${l}</span></button>`
    ).join('');

    const repRow = (r) => {
          const pageTag = ''; // ชื่อเพจแสดงเป็นหัวกลุ่มแล้ว
          return `<tr class="click-row ${r.repId === s.open ? 'sel-row' : ''}" data-act="sla-rep" data-rep="${esc(r.repId)}">
            <td><b>${esc(r.rep)}</b>${pageTag}</td>
            <td>${num(r.turns)}</td><td>${num(r.onTime)}</td><td>${num(r.late)}</td>
            <td>${r.deducted ? `<span class="q-badge q-poor">−${num(r.deducted)}</span>` : '<span class="q-badge q-excellent">0</span>'}</td>
            <td>${num(r.commuteLate)}</td><td>${num(r.nightReplies)}</td><td>${r.avgMin === null ? '—' : fmtDur(r.avgMin)}</td>
          </tr>`;
        };
    // ทุกเพจ: จัดกลุ่มเป็นเพจ ๆ มีแถวสรุปของแต่ละเพจ / เลือกเพจ: แสดงเฉพาะเพจนั้น
    const groupRows = (name, list) => {
      const g = sumReps(list);
      const rate = g.turns ? Math.round((g.onTime / g.turns) * 1000) / 10 : 0;
      return `<tr class="sla-page-head"><td colspan="8" style="background:#f0fdf4;padding:10px 14px;border-top:2px solid #bbf7d0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <b style="color:#065f46">📄 ${esc(name)}</b>
            <span style="font-size:12px;color:#475569">ตรวจ ${num(g.turns)} · ทันเวลา <b style="color:#059669">${rate}%</b> · ช้า ${num(g.late)} · หัก ${g.deducted ? '<b style="color:#dc2626">−' + num(g.deducted) + '</b>' : '0'} แต้ม</span>
          </div></td></tr>${list.map(repRow).join('')}`;
    };
    const repRows = !repsShown.length
      ? '<tr><td colspan="8"><div class="empty">ยังไม่มีข้อมูลการตอบแชทในช่วงที่เลือก</div></td></tr>'
      : s.page ? repsShown.map(repRow).join('')
      : pageNames.map((pn) => groupRows(pn, d.reps.filter((r) => pageOf(r) === pn))).join('');
    const pagePills = pageNames.length > 1 ? `<div class="sla-kind-pills" style="margin:0 0 12px;flex-wrap:wrap;overflow:visible">
        <button type="button" class="sla-kind-pill all ${!s.page ? 'active' : ''}" data-act="sla-page" data-page=""><span class="pill-ico">📊</span><span>ทุกเพจ (แยกกลุ่ม)</span></button>
        ${pageNames.map((pn) => `<button type="button" class="sla-kind-pill ${s.page === pn ? 'active' : ''}" data-act="sla-page" data-page="${esc(pn)}"><span class="pill-ico">📄</span><span>${esc(pn)}</span></button>`).join('')}
      </div>` : '';

    const detailRows = evs.length
      ? evs.map((e) => `<tr class="click-row" data-act="sla-open" data-id="${esc(e.leadId)}" data-date="${esc(e.leadDate)}">
          <td><div class="ad-name">${esc(e.name)}</div><div class="ad-sub">${esc(e.page || '—')} · ${esc(e.channel)}</div></td>
          <td class="nowrap">${esc(sepLabel(e.customerAt))}<div class="ad-sub">${SLA_WIN[e.window]}</div></td>
          <td class="nowrap">${e.replyAt
            ? `${esc(sepLabel(e.replyAt))}<div class="ad-sub">${e.replyWindow === 'night' ? 'ตอบช่วง 22:00–08:00' : SLA_WIN[e.replyWindow]}</div>`
            : '<span class="q-badge q-poor">ยังไม่ตอบ</span>'}</td>
          <td class="nowrap">${fmtDur(e.minutes)}</td>
          <td><span class="q-badge ${SLA_OUT[e.outcome][1]}">${SLA_OUT[e.outcome][0]}</span></td>
        </tr>`).join('')
      : '<tr><td colspan="5"><div class="empty">ไม่มีรายการในหมวดนี้</div></td></tr>';

    const detailSection = open ? `<div class="sla-detail" style="margin-top:16px">
        <h4>${esc(open.rep)}${open.pageName ? ' (' + esc(open.pageName) + ')' : ''} &middot; ${num(open.eventTotal)} รายการ</h4>
        <div class="sla-kind-pills" style="margin-bottom:10px">${kindPills}</div>
        <div class="tscroll"><table style="min-width:860px"><thead><tr>
          <th class="nosort">ลูกค้า / เพจ</th>
          <th class="nosort">ลูกค้าทัก</th>
          <th class="nosort">เซลส์ตอบ</th>
          <th class="nosort">ใช้เวลา</th>
          <th class="nosort">ผล</th>
        </tr></thead><tbody>
        ${detailRows}</tbody></table></div>
        ${open.eventTotal > open.events.length
          ? `<div class="ad-sub" style="padding:8px;text-align:center">แสดง ${open.events.length} จาก ${num(open.eventTotal)} รายการล่าสุด</div>`
          : ''}
      </div>` : '';

    const totalTurns = t.turns || 1;
    const complianceRate = Math.round((t.onTime / totalTurns) * 1000) / 10;
    const strokeDash = 2 * Math.PI * 34; // 213.6
    const strokeOffset = strokeDash * (1 - (complianceRate / 100));

    box.innerHTML = `
      <!-- High-Tech 15-Minute Response Scorecard Hero -->
      <section class="card panel sla-panel" style="padding:22px 24px;border-radius:20px;border:1px solid rgba(16, 185, 129, 0.16);box-shadow:0 4px 24px -2px rgba(15, 23, 42, 0.05);margin-bottom:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="beq-iridescent-orb sm"></span>
              <h3 style="margin:0;font-size:18px;font-weight:800;color:#0f172a">15-Minute SLA Compliance Scorecard</h3>
            </div>
            <p class="sub" style="margin:4px 0 0;color:#64748b;font-size:13px">เกณฑ์ประเมินความเร็วการตอบแชทและข้อความลูกค้าคลินิก &middot; เป้าหมายมาตรฐาน &lt; 15 นาที</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="sla-target-pill"><span class="sla-pulse"></span> 15m Response Target Active</span>
          </div>
        </div>

        <div class="sla-scorecard-grid">
          <!-- Compliance Meter -->
          <div class="sla-meter-card">
            <div class="sla-meter-ring-wrap">
              <svg width="84" height="84" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" stroke-width="7" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="url(#slaGrad)" stroke-width="7" stroke-dasharray="${strokeDash.toFixed(1)}" stroke-dashoffset="${strokeOffset.toFixed(1)}" stroke-linecap="round" transform="rotate(-90 40 40)" />
                <defs>
                  <linearGradient id="slaGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#10b981" />
                    <stop offset="100%" stop-color="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              <div class="sla-meter-num">
                <b>${complianceRate}%</b>
                <small>COMPLIANCE</small>
              </div>
            </div>
            <div class="sla-meter-desc">
              <b>อัตราตอบทันเกณฑ์</b>
              <span>${num(t.onTime)} จากทั้งหมด ${num(t.turns)} ครั้ง</span>
            </div>
          </div>

          <!-- Total Deducted -->
          <div class="sla-stat-card">
            <div class="sla-stat-head">
              <span>คะแนนที่ถูกหักรวม</span>
              <span class="sla-badge-coral">${t.deducted ? 'หักคะแนน' : 'ปกติ'}</span>
            </div>
            <div class="sla-stat-val" style="color:${t.deducted ? '#dc2626' : '#059669'}">${t.deducted ? '−' + num(t.deducted) : '0'} <small>แต้ม</small></div>
            <div class="sla-stat-sub">10:00–19:00 ช้าหัก 1 แต้ม · อ่านไม่ตอบหัก 0.5 แต้ม</div>
          </div>

          <!-- Commute Hours Stats -->
          <div class="sla-stat-card">
            <div class="sla-stat-head">
              <span>ช้าช่วงเดินทาง (08–10 / 19–22)</span>
              <span class="sla-badge-amber">สถิติเดินทาง</span>
            </div>
            <div class="sla-stat-val">${num(t.commuteLate)} <small>ครั้ง</small></div>
            <div class="sla-stat-sub">บันทึกสถิติเพื่อปรับปรุงกะงาน &middot; ไม่ถูกหักแต้ม</div>
          </div>

          <!-- Night Replies Stats -->
          <div class="sla-stat-card">
            <div class="sla-stat-head">
              <span>ตอบช่วงกลางคืน (22:00–08:00)</span>
              <span class="sla-badge-blue">นอกเวลา</span>
            </div>
            <div class="sla-stat-val">${num(t.nightReplies)} <small>ครั้ง</small></div>
            <div class="sla-stat-sub">สถิติความใส่ใจลูกค้านอกเวลางาน &middot; เพิ่มคะแนนพิเศษ</div>
          </div>
        </div>

        <!-- Penalty Breakdown Rules Pill-Box -->
        <div class="sla-rules-banner">
          <div class="sla-rule-item">
            <span class="rule-icon">⚡</span>
            <div><b>ตอบช้าช่วงทำงาน 10:00–19:00</b><small>เกิน 15 นาที: <b>หัก 1.0 แต้ม / ครั้ง</b></small></div>
          </div>
          <div class="sla-rule-item">
            <span class="rule-icon">👀</span>
            <div><b>เปิดอ่านแต่ไม่ตอบ (Read No Reply)</b><small>ค้างเกิน 15 นาที: <b>หัก 0.5 แต้ม / ครั้ง</b></small></div>
          </div>
          <div class="sla-rule-item">
            <span class="rule-icon">🚗</span>
            <div><b>ช่วงเดินทาง 08:00–10:00 & 19:00–22:00</b><small>ตอบช้า: <b>ไม่หักแต้ม</b> (เก็บเป็นสถิติ)</small></div>
          </div>
          <div class="sla-rule-item">
            <span class="rule-icon">🌙</span>
            <div><b>กลางคืน 22:00–08:00</b><small>ช่วงพักผ่อน: <b>ไม่หักแต้ม</b> (ให้คะแนนความพยายาม)</small></div>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:20px 0 12px">
          <div class="sla-kind-pills">${kindPills}</div>
          <div class="ad-sub" style="font-size:12px;color:#64748b">${s.page ? `ตัวเลขด้านบนคิดเฉพาะเพจ ${esc(s.page)}` : 'แยกสถิติความเร็วตามเพจ และเซลส์/แอดมินในแต่ละเพจ'}</div>
        </div>

        ${pagePills}
        <div class="tscroll"><table style="min-width:900px"><thead><tr>
          <th class="nosort">เซลส์ / แอดมิน</th>
          <th>ตรวจ</th><th>ทันเวลา</th><th>ช้า</th>
          <th>แต้มที่ถูกหัก</th><th>ช้าช่วงเดินทาง</th>
          <th>ตอบนอกเวลา</th><th>ตอบเฉลี่ย</th>
        </tr></thead><tbody>
        ${repRows}</tbody></table></div>
        <p class="rv-hint" style="margin:12px 0 0;font-size:12px;color:#64748b">💡 คลิกแถวเซลส์เพื่อดูรายการสนทนาทั้งหมด &middot; คลิกรายการเพื่อเปิดแชทโดยตรงที่หน้า Inbox</p>
        ${detailSection}
      </section>`;
  }
function boardShell() {
    return `<div class="page-head"><div><h1>Board</h1><div class="meta-line"><span>ลูกค้าแยกตามความคืบหน้าของแชท</span></div></div></div>
      ${rangeBar('board')}<div id="board-body"><div class="loading">Loading…</div></div>`;
  }

  function leadCard(l) {
    const custMsg = l.customerMsg || l.reason || '';
    const avgText = l.avgReply !== null && l.avgReply !== undefined ? `${num(l.avgReply)} นาที` : (l.firstResponseMin ? `${num(l.firstResponseMin)} นาที` : '—');
    const slaText = l.slaLabel || (l.status === 'no_reply' ? 'ยังไม่ตอบ' : 'ทันเวลา');
    const slaCls = l.slaStatus === 'late' || l.status === 'no_reply' || l.status === 'very_poor' ? 'q-poor' : 'q-excellent';
    const aiIntent = predictLeadIntent(l);

    return `<div class="lead" draggable="true" data-lead-id="${esc(l.id)}" data-lead-status="${esc(l.status)}" data-act="open-chat" data-id="${esc(l.id)}">
      <div class="lead-head" style="flex-direction:column;align-items:flex-start;gap:3px">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:4px">
          <b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px">${esc(l.name)}</b>
          <span class="ai-lead-tag ${aiIntent.cls}" title="AI วิเคราะห์: ${esc(aiIntent.intent)}">${esc(aiIntent.score)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          ${l.pageName ? `<span class="ad-sub" style="font-size:11px;color:var(--muted)">${esc(l.pageName)}</span>` : ''}
          ${chanHtml(l.channel)}
        </div>
      </div>
      ${custMsg ? `<div class="lead-cust-bubble" title="ลูกค้าพิมพ์: ${esc(custMsg)}"><span class="cust-prefix">💬 ลูกค้าพิมพ์:</span> <span class="cust-text">${esc(custMsg)}</span></div>` : ''}
      <div class="lead-meta-grid">
        <div class="lead-meta-row"><span class="m-lbl">📅 วันที่:</span><span class="m-val">${esc(l.date)}</span></div>
        <div class="lead-meta-row"><span class="m-lbl">👤 เซลส์:</span><span class="m-val">${esc(l.rep || '—')}</span></div>
        <div class="lead-meta-row"><span class="m-lbl">⏱️ ตอบเฉลี่ย:</span><span class="m-val">${avgText}</span></div>
        <div class="lead-meta-row"><span class="m-lbl">🎯 SLA:</span><span class="q-badge ${slaCls}" style="font-size:11px;padding:2px 8px">${esc(slaText)}</span></div>
      </div>
      ${l.phone ? `<small class="lead-phone">📞 ${esc(l.phone)}</small>` : ''}
    </div>`;
  }

  let draggedLeadId = null;
  function initBoardDragDrop(box) {
    const leads = box.querySelectorAll('.lead[draggable="true"]');
    leads.forEach((el) => {
      el.addEventListener('dragstart', (ev) => {
        draggedLeadId = el.dataset.leadId;
        el.classList.add('dragging');
        ev.dataTransfer.setData('text/plain', el.dataset.leadId);
        ev.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        draggedLeadId = null;
        el.classList.remove('dragging');
        box.querySelectorAll('.col').forEach((c) => c.classList.remove('drag-over'));
      });
    });

    const cols = box.querySelectorAll('.col[data-col-status]');
    cols.forEach((col) => {
      col.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', (ev) => {
        if (!col.contains(ev.relatedTarget)) col.classList.remove('drag-over');
      });
      col.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        col.classList.remove('drag-over');
        const id = ev.dataTransfer.getData('text/plain') || draggedLeadId;
        const targetStatus = col.dataset.colStatus;
        if (!id || !targetStatus) return;

        // อัปเดตหน้าจอทันที (Optimistic UI) ไม่ต้องรอเซิร์ฟเวอร์
        if (S.board.data) {
          let foundCard = null;
          for (const c of S.board.data.columns) {
            const idx = c.cards.findIndex((k) => k.id === id);
            if (idx !== -1) {
              [foundCard] = c.cards.splice(idx, 1);
              c.total = Math.max(0, c.total - 1);
              break;
            }
          }
          if (foundCard) {
            foundCard.status = targetStatus;
            const targetCol = S.board.data.columns.find((c) => c.status === targetStatus);
            if (targetCol) {
              targetCol.cards.unshift(foundCard);
              targetCol.total += 1;
            }
            renderBoardBody();
          }
        }

        // ส่งบันทึกสถานะไปยังเซิร์ฟเวอร์
        await changeStatus(targetStatus, id);
      });
    });
  }

  function scrollBoard(dir) {
    const el = document.querySelector('.kanban');
    if (el) el.scrollBy({ left: dir * 320, behavior: 'smooth' });
  }

  function scrollToCol(status) {
    const target = document.querySelector(`.kanban .col[data-col-status="${status}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function renderBoardBody() {
    const box = document.getElementById('board-body'); const s = S.board; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err">${esc(s.err)}</div>`; return; }
    if (!s.data) return;
    const d = s.data;

    // Quick jump pills & scroll controls
    const quickPills = d.columns.map((c) => `<button type="button" class="board-status-pill" data-act="board-jump" data-status="${c.status}">
      <i class="col-dot" style="background:${STATUS_COLOR[c.status] || '#888'}"></i>
      <span>${STATUS_TH[c.status] || c.status}</span>
      <b class="pill-count">${num(c.total)}</b>
    </button>`).join('');

    box.innerHTML = `<div class="board-top-nav">
        <div class="board-nav-left">
          <button type="button" class="board-scroll-btn" data-act="board-scroll-left" title="เลื่อนไปทางซ้าย">◀</button>
          <div class="board-pills-wrap">
            ${quickPills}
          </div>
          <button type="button" class="board-scroll-btn" data-act="board-scroll-right" title="เลื่อนไปทางขวา">▶</button>
        </div>
        <div class="meta-line" style="margin:0">
          <span><b>${num(d.total)}</b> แชท · 💡 ลากการ์ดสีขาวไปวางที่กล่องสถานะที่ต้องการได้เลย</span>
        </div>
      </div>
      <div class="kanban">${d.columns.map((c, idx) => `<section class="col" data-col-status="${c.status}">
        <h4><span><span class="col-num-badge">${idx + 1}</span><i class="col-dot" style="background:${STATUS_COLOR[c.status]}"></i>${STATUS_TH[c.status]}</span><span>${num(c.total)}</span></h4>
        ${c.cards.map(leadCard).join('') || '<div class="empty" style="padding:20px">ไม่มีแชท</div>'}
        ${c.total > c.cards.length ? `<div class="ad-sub" style="text-align:center;padding:8px 0">แสดง ${c.cards.length} จาก ${num(c.total)}</div>` : ''}</section>`).join('')}</div>`;
    initBoardDragDrop(box);
  }

  /* ---------------- follow-up / review / audit ---------------- */
  async function ensureFilters() { if (!S.filters) { try { S.filters = await api('/api/filters'); render(); } catch { /* ใช้รายการว่าง */ } } }
  const fmtTs = (iso) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const repSelect = (bind, value) => `<div class="sel"><select data-bind="${bind}" aria-label="ทีมขาย"><option value="">ทุกคน</option>${((S.filters && S.filters.reps) || []).map((r) => `<option value="${esc(r.id)}" ${r.id === value ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>`;

  /* --- ตามลูกค้า --- */
  async function loadFollowups() {
    const s = S.followup; s.err = null; ensureFilters();
    try {
      const p = new URLSearchParams();
      if (s.rep) p.set('rep', s.rep);
      if (S.dash.platform) p.set('platform', S.dash.platform);
      if (S.dash.page) p.set('page', S.dash.page);
      const qs = p.toString();
      s.data = await api('/api/followups' + (qs ? '?' + qs : ''));
    } catch (e) { s.err = e.message; }
    renderFollowBody();
  }
  function followShell() {
    const sched = S.notificationSchedule || { enabled: false, intervalMinutes: 60 };
    return `<div class="page-head"><div><h1>ตามลูกค้า</h1><div class="meta-line"><span>ลูกค้าที่รอคำตอบ ถึงเวลาตามต่อ และนัดตามที่ตั้งไว้ (ลีดย้อนหลัง 90 วัน ไม่นับที่ปิดการขายแล้ว)</span></div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary" data-act="fu-notify-all" style="background:#059669;color:#fff;border-radius:10px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap">
          🔔 ส่งแจ้งเตือนตอนนี้
        </button>
        <button class="btn btn-secondary" data-act="fu-open-schedule" style="background:${sched.enabled ? '#ecfdf5' : '#f8fafc'};color:${sched.enabled ? '#065f46' : '#334155'};border:1px solid ${sched.enabled ? '#a7f3d0' : '#cbd5e1'};border-radius:10px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap">
          ${sched.enabled ? `⏰ ตั้งรอบอัตโนมัติ: ทุก ${sched.intervalMinutes >= 60 ? (sched.intervalMinutes / 60) + ' ชม.' : sched.intervalMinutes + ' นาที'} (เปิดอยู่)` : '⏱️ ตั้งรอบเวลาแจ้งเตือน (นาที/ชม.)'}
        </button>
        <button class="btn" data-act="fu-refresh" style="white-space:nowrap">${icon('refresh')}โหลดใหม่</button>
      </div>
    </div><div id="follow-body"><div class="loading">Loading…</div></div>`;
  }
  const KIND_TH = { reply: ['ลูกค้ารอตอบ', 'q-poor'], chase: ['ถึงเวลาตามต่อ', 'q-average'], scheduled: ['นัดตามไว้', 'q-good'] };
  function renderFollowBody() {
    const box = $id('follow-body'); const s = S.followup; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err">${esc(s.err)}</div>`; return; }
    if (!s.data) return;
    const d = s.data; const st = d.stats;
    const rows = d.rows.filter((r) => !s.tab || (s.tab === 'scheduled' ? r.dueDate : r.kind === s.tab));
    const tabs = [
      ['', '🌐 ทั้งหมด', d.total, 'all'],
      ['reply', '⚡ ลูกค้ารอตอบ', st.reply, 'reply'],
      ['chase', '⏳ ถึงเวลาตามต่อ', st.chase, 'chase'],
      ['scheduled', '📅 นัดตามไว้', st.scheduled, 'scheduled']
    ];
    box.innerHTML = `<div class="grid-4" style="margin-bottom:16px">
        <div class="stat"><div class="k-label">ลูกค้ารอตอบ</div><div class="k-value">${num(st.reply)}</div></div>
        <div class="stat"><div class="k-label">ถึงเวลาตามต่อ (เงียบ &gt; 24 ชม.)</div><div class="k-value">${num(st.chase)}</div></div>
        <div class="stat"><div class="k-label">นัดตามเกินกำหนด / วันนี้</div><div class="k-value">${num(st.due)}</div></div>
        <div class="stat"><div class="k-label">นัดตามทั้งหมด</div><div class="k-value">${num(st.scheduled)}</div></div></div>
      <section class="card filters"><div class="pills">${tabs.map(([k, l, n, cls]) => `<button type="button" class="pill ${cls} ${s.tab === k ? 'active' : ''}" data-act="ftab" data-tab="${k}">${l} <b class="tab-badge">${num(n)}</b></button>`).join('')}</div>
        <span class="label">ทีมขาย</span>${repSelect('frep', s.rep)}</section>
      <section class="card table-card"><div class="tscroll"><table style="min-width:960px"><thead><tr><th class="nosort">ลูกค้า</th><th class="nosort">ข้อความล่าสุด</th><th class="nosort">สถานะตาม</th><th class="nosort">ความคืบหน้า</th><th class="nosort">ผู้ดูแล</th><th class="nosort">นัด / บันทึก</th><th class="nosort" style="text-align:center;width:170px">จัดการ / แจ้งเตือน</th></tr></thead><tbody>
      ${rows.length ? rows.map((r) => `<tr class="click-row" data-act="open-chat" data-id="${esc(r.id)}">
        <td><div class="ad-name">${esc(r.name)}</div><div class="ad-sub">${chanHtml(r.channel)}</div></td>
        <td><div class="fu-last">${r.lastFrom === 'staff' ? 'คุณ: ' : ''}${esc(r.lastText)}</div><div class="ad-sub">${r.lastAt ? ago(r.lastAt) + 'ที่แล้ว' : ''}</div></td>
        <td><span class="q-badge ${r.overdue ? 'q-poor' : KIND_TH[r.kind][1]}">${r.overdue && r.kind === 'scheduled' ? 'นัดเกินกำหนด' : KIND_TH[r.kind][0]}</span></td>
        <td>${statusHtml(r.status)}</td><td>${esc(r.rep || '—')}</td>
        <td>${r.dueDate ? `<b>${esc(r.dueDate)}</b><div class="ad-sub">${esc(r.note)}</div>` : '—'}</td>
        <td style="text-align:center" onclick="event.stopPropagation()">
          <div style="display:inline-flex;gap:6px;align-items:center;justify-content:center">
            <button type="button" class="btn btn-secondary fu-edit-btn" data-act="fu-quick-edit" data-id="${esc(r.id)}" data-name="${esc(r.name)}" data-due="${esc(r.dueDate || '')}" data-note="${esc(r.note || '')}" data-status="${esc(r.status || '')}" title="แก้ไขการนัดตามหรือบันทึกโน้ต" style="padding:4px 8px;font-size:11.5px;border-radius:8px;background:#f8fafc;color:#334155;border:1px solid #cbd5e1;font-weight:600;display:inline-flex;align-items:center;gap:4px">
              ✏️ แก้ไข
            </button>
            <button type="button" class="btn btn-secondary fu-notify-btn" data-act="fu-notify-one" data-id="${esc(r.id)}" data-name="${esc(r.name)}" data-rep="${esc(r.rep || '')}" data-kind="${esc(r.kind)}" data-due="${esc(r.dueDate || '')}" title="ส่งแจ้งเตือนเตือนตามเคสนี้เข้าเว็บและ LINE" style="padding:4px 8px;font-size:11.5px;border-radius:8px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;font-weight:600;display:inline-flex;align-items:center;gap:4px">
              🔔 แจ้งเตือน
            </button>
          </div>
        </td></tr>`).join('')
        : '<tr><td colspan="7"><div class="empty">ไม่มีลูกค้าที่ต้องตามในตอนนี้ 🎉</div></td></tr>'}</tbody></table></div>
      ${d.total > d.rows.length ? `<div class="ad-sub" style="padding:10px;text-align:center">แสดง ${d.rows.length} จาก ${num(d.total)} รายการ</div>` : ''}</section>`;
  }

  /* --- รีวิวแชท --- */
  async function loadReview() { ensureFilters(); loadSla(); if (await fetchList('review', '/api/review')) renderReviewBody(); }
  function reviewShell() {
    return `<div class="page-head"><div><h1>⏱️ รายงาน SLA (SLA Performance)</h1><div class="meta-line"><span>ประเมินคะแนน SLA การตอบแชทและคอมเมนต์ของเซลส์และแอดมิน (เกณฑ์ 15 นาที)</span></div></div></div>
      ${rangeBar('review')}
      <div id="sla-body" style="margin-top:16px;margin-bottom:16px"></div>`;
  }
  function renderReviewBody() {
    const box = $id('review-body'); const s = S.review; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err">${esc(s.err)}</div>`; return; }
    if (!s.data) return;
    const d = s.data; const st = d.stats;
    const rows = d.rows.filter((r) => (!s.rep || r.repId === s.rep) && (!s.state || (s.state === 'done' ? r.reviewed : !r.reviewed)));
    box.innerHTML = `<div class="grid-4" style="margin-bottom:16px">
        <div class="stat"><div class="k-label">แชททั้งหมดในช่วงนี้</div><div class="k-value">${num(st.total)}</div></div></div>
      ${d.byRep.some((r) => r.reviewed) ? `<section class="card panel" style="margin-bottom:16px"><h3>คะแนนเฉลี่ยตามเซลส์</h3><p class="sub">เฉพาะแชทที่ตรวจแล้ว</p>
        <div class="bars">${d.byRep.filter((r) => r.reviewed).map((r) => `<div class="row"><span>${esc(r.rep)} <small>(${r.reviewed}/${r.total})</small></span><div class="bar"><i style="width:${r.avgScore}%;background:${{ excellent: '#44602f', good: '#6f8f4e', average: '#e0a100', poor: '#d6204b' }[scoreClass(r.avgScore)]}"></i></div><b>${r.avgScore}%</b></div>`).join('')}</div></section>` : ''}
      <section class="card filters">
        <span class="label">ทีมขาย</span>${repSelect('rrep', s.rep)}</section>
      <section class="card table-card"><div class="tscroll"><table style="min-width:860px"><thead><tr><th class="nosort">ลูกค้า</th><th class="nosort">วันเริ่มคุย</th><th class="nosort">ผู้ดูแล</th><th class="nosort">ความคืบหน้า</th><th class="nosort">ตอบครั้งแรก</th></tr></thead><tbody>
      ${rows.length ? rows.map((r) => `<tr class="click-row" data-act="open-chat" data-id="${esc(r.id)}">
        <td><div class="ad-name">${esc(r.name)}</div><div class="ad-sub">${chanHtml(r.channel)}</div></td><td>${esc(r.date)}</td><td>${esc(r.rep || '—')}</td><td>${statusHtml(r.status)}</td>
        <td>${r.firstResponseMin === null ? '—' : r.firstResponseMin + ' นาที'}</td></tr>`).join('')
        : '<tr><td colspan="5"><div class="empty">ไม่พบแชทตามเงื่อนไข</div></td></tr>'}</tbody></table></div>
      ${d.total > d.rows.length ? `<div class="ad-sub" style="padding:10px;text-align:center">แสดง ${d.rows.length} จาก ${num(d.total)} แชท (เรียงใหม่สุดก่อน)</div>` : ''}</section>`;
  }

  /* --- Audit log --- */
  const AUDIT_BAD = ['login_failed', 'reply_failed', 'webhook_rejected'];
  const AUDIT_CFG = ['password_change', 'settings_save', 'meta_test', 'meta_extend', 'meta_disconnect', 'mode_change'];
  function auditQs(extra = {}) {
    const a = S.audit; const p = new URLSearchParams({ limit: String(a.limit), ...extra });
    for (const k of ['action', 'q', 'from', 'to']) if (a[k]) p.set(k, a[k]);
    return p.toString();
  }
  let auditSeq = 0;
  async function loadAudit() {
    const a = S.audit; const seq = ++auditSeq; a.err = null;
    try { const data = await api('/api/audit?' + auditQs()); if (seq !== auditSeq) return; a.data = data; } catch (e) { if (seq !== auditSeq) return; a.err = e.message; }
    renderAuditBody();
  }
  function auditShell() {
    return `<div class="page-head"><div><h1>Audit</h1><div class="meta-line"><span>ประวัติการใช้งานระบบ: ใครทำอะไร เมื่อไหร่ จาก IP ไหน (เก็บล่าสุด 5,000 รายการ · ไม่เก็บรหัสผ่านหรือ token)</span></div></div><span id="audit-export"></span></div>
      <section class="card filters" id="audit-filters"></section><div id="audit-table"><div class="loading">Loading…</div></div>`;
  }
  function renderAuditBody() {
    const a = S.audit; const fbox = $id('audit-filters'); const tbox = $id('audit-table'); if (!tbox) return;
    if (a.err) { tbox.innerHTML = `<div class="notice err">${esc(a.err)}</div>`; return; }
    if (!a.data) return;
    if (fbox && !fbox.innerHTML) {
      fbox.innerHTML = `<div class="sel"><select data-bind="aaction" aria-label="การกระทำ"><option value="">ทุกการกระทำ</option>${a.data.actions.map((x) => `<option value="${x.key}" ${a.action === x.key ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
        <input class="date-in" type="date" data-bind="afrom" value="${esc(a.from)}" aria-label="ตั้งแต่วันที่"><span class="vs">ถึง</span><input class="date-in" type="date" data-bind="ato" value="${esc(a.to)}" aria-label="ถึงวันที่">
        <label class="search">${icon('search')}<input id="asearch" data-bind="asearch" placeholder="ค้นหารายละเอียด / ผู้ใช้ / IP" value="${esc(a.q)}" autocomplete="off"></label>`;
    }
    const ex = $id('audit-export'); if (ex) ex.innerHTML = `<a class="btn" href="/api/audit/export?${auditQs({ limit: '5000' })}" download>ดาวน์โหลด CSV</a>`;
    const d = a.data;
    tbox.innerHTML = `<section class="card table-card"><div class="tscroll"><table style="min-width:820px"><thead><tr><th class="nosort">เวลา (ไทย)</th><th class="nosort">ผู้ใช้</th><th class="nosort">การกระทำ</th><th class="nosort">รายละเอียด</th><th class="nosort">IP</th></tr></thead><tbody>
      ${d.rows.length ? d.rows.map((r) => `<tr><td class="nowrap">${esc(fmtTs(r.at))}</td><td>${esc(r.user)}</td>
        <td><span class="q-badge ${AUDIT_BAD.includes(r.action) ? 'q-poor' : AUDIT_CFG.includes(r.action) ? 'q-average' : 'q-none'}">${esc(r.label)}</span></td><td>${esc(r.detail)}</td><td class="nowrap">${esc(r.ip)}</td></tr>`).join('')
        : '<tr><td colspan="5"><div class="empty">ยังไม่มีบันทึกตามเงื่อนไข</div></td></tr>'}</tbody></table></div>
      <div class="pager"><span>แสดง ${d.rows.length} จาก ${num(d.total)} รายการ</span><div class="btns">${d.total > d.rows.length ? '<button data-act="audit-more">โหลดเพิ่ม</button>' : ''}</div></div></section>`;
  }

  /* --- ส่งข้อความ / เปลี่ยนสถานะ --- */
  const lastKey = (r) => (r.last ? r.last.at : r.date);
  async function sendReply(text) {
    const c = S.chat; const id = c.id; if (!id || c.sending) return;
    c.sending = true; c.msg = null; renderChatViews();
    try {
      const r = await api('/api/inbox/reply', { method: 'POST', body: { id, text } });
      if (c.data && c.id === id) c.data.messages.push(r.message);
      const row = S.inbox.data && S.inbox.data.rows.find((x) => x.id === id);
      if (row) { row.last = r.message; S.inbox.data.rows.sort((a, b) => (lastKey(a) === lastKey(b) ? 0 : lastKey(a) < lastKey(b) ? 1 : -1)); }
      c.msg = { type: 'ok', text: r.delivered === 'demo' ? 'บันทึกข้อความแล้ว (โหมดเดโม ไม่ได้ส่งถึงลูกค้าจริง)' : 'ส่งข้อความแล้ว' };
    } catch (e) { if (e.message === 'กรุณาเข้าสู่ระบบ') return; c.msg = { type: 'err', text: e.message }; }
    c.sending = false; renderChatViews();
    if (S.route === 'inbox') { renderInboxTools(); renderInboxList(); }
    updateGlobalUnrepliedBadges();
    if (S.route === 'followup') loadFollowups();
    const ta = document.querySelector('.reply-form textarea'); if (ta) ta.focus();
  }

  async function changeStatus(status, leadId) {
    const id = leadId || (S.chat && S.chat.id);
    if (!id) return;
    try {
      await api('/api/lead/status', { method: 'POST', body: { id, status } });
      if (S.chat.data && S.chat.data.lead && S.chat.id === id) S.chat.data.lead.status = status;
      const row = S.inbox.data && S.inbox.data.rows.find((x) => x.id === id); if (row) row.status = status;
      S.chat.msg = { type: 'ok', text: 'เปลี่ยนความคืบหน้าแล้ว' };
      moveBoardCard(id, status);
      showToast(`✅ ย้ายไปสถานะ "${STATUS_TH[status] || status}" แล้ว — หน้า Leads Board อัปเดตตาม`, 'success');
    } catch (e) { S.chat.msg = { type: 'err', text: e.message }; }
    renderChatViews(); if (S.route === 'inbox') { renderInboxTools(); renderInboxList(); }
    updateGlobalUnrepliedBadges();
    if (S.route === 'followup') loadFollowups();
  }

  /* ---------------- settings ---------------- */
  async function loadSettings() {
    try {
      const [settings, lineNotify] = await Promise.all([
        api('/api/settings'),
        api('/api/settings/line-notify').catch(() => null)
      ]);
      S.settings = { ...settings, lineNotify: lineNotify || {} };
    } catch (e) { S.flash = { type: 'err', text: e.message }; }
    renderSettingBody();
    if (S.me && S.me.role === 'admin') await loadUsers();
  }

  /* --- จัดการผู้ใช้ (เฉพาะ admin) --- */
  async function loadUsers() {
    const u = S.users; u.err = null;
    try { u.data = (await api('/api/users')).users; } catch (e) { u.err = e.message; }
    renderSettingBody();
  }
  // สร้างรหัสผ่านชั่วคราวแบบสุ่ม (ตัดตัวอักษรที่อ่านสับสน เช่น 0/O 1/l/I)
  function genPassword(len = 10) {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(len); crypto.getRandomValues(buf);
    return Array.from(buf, (n) => chars[n % chars.length]).join('');
  }
  const ROLE_TH = { admin: 'ผู้ดูแล (admin)', staff: 'ทีมขาย (staff)' };
  
  // ป้ายแพลตฟอร์มสีชัด ๆ ใช้ซ้ำในตารางเพจและหน้าต่างดึงข้อมูล
  const PLATFORM_STYLE = {
    Facebook: { icon: '📘', label: 'Facebook', bg: '#e7f0ff', fg: '#1d4ed8', bar: '#1877f2' },
    Instagram: { icon: '📸', label: 'Instagram', bg: 'linear-gradient(90deg,#fdf2f8,#fff7ed)', fg: '#be185d', bar: '#e1306c' },
    LINE: { icon: '💬', label: 'LINE', bg: '#e8f8ee', fg: '#047857', bar: '#06c755' },
    WhatsApp: { icon: '🟢', label: 'WhatsApp', bg: '#e7f7f1', fg: '#0f766e', bar: '#25d366' },
  };
  function platformBadge(platform, size = 12) {
    const st = PLATFORM_STYLE[platform] || PLATFORM_STYLE.Facebook;
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:${size}px;font-weight:700;background:${st.bg};color:${st.fg};white-space:nowrap">${st.icon} ${st.label}</span>`;
  }

  function pagesPanelHtml() {
    const rawPages = (S.filters && S.filters.pages) || [];
    // กรองไม่แสดงเพจขยะ / เพจที่ไม่มีชื่อจริง / เพจตัวเลข
    const pages = rawPages.filter(isValidPage);
    const nameOf = new Map(pages.map((p) => [String(p.id), p.name]));
    const row = (p) => {
      const plat = p.platform || 'Facebook';
      const st = PLATFORM_STYLE[plat] || PLATFORM_STYLE.Facebook;
      const linked = plat === 'Instagram' && p.fbPageId ? `<div class="rv-hint" style="font-size:12px;margin-top:2px">ผูกกับเพจ FB: ${esc(nameOf.get(String(p.fbPageId)) || p.fbPageId)}</div>` : '';
      return `<tr style="box-shadow:inset 4px 0 0 ${st.bar}">
        <td style="padding-left:16px"><b>${esc(p.name)}</b>${linked}</td>
        <td>${platformBadge(plat)}</td>
        <td><code>${esc(p.id)}</code></td>
        <td>${p.adAccountId ? `<span class="chip good" style="font-size:12px;font-family:monospace">📊 ${esc(p.adAccountId)}</span>` : '<span class="rv-hint">ใช้ Ad กลาง</span>'}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn" type="button" data-act="page-edit" data-page='${esc(JSON.stringify(p))}' style="padding:4px 10px;font-size:12px">✏️ แก้ไข</button>
          ${(plat === 'Facebook' || plat === 'Instagram') ? `<button class="btn" type="button" data-act="fb-import-conv" data-page-id="${esc(p.id)}" data-page-name="${esc(p.name)}" data-platform="${esc(plat)}" style="padding:4px 10px;font-size:12px">📥 ดึงแชท</button><button class="btn" type="button" data-act="sync-page-posts" data-page-id="${esc(p.id)}" data-page-name="${esc(p.name)}" data-platform="${esc(plat)}" style="padding:4px 10px;font-size:12px;background:#eaf2e8;color:#244c1d">💬 ดึงโพสต์</button>` : ''}
          <button class="btn danger" type="button" data-act="page-delete" data-page-id="${esc(p.id)}" style="padding:4px 10px;font-size:12px">ลบ</button>
        </div></td>
      </tr>`;
    };
    // จัดกลุ่มตามแพลตฟอร์ม: Facebook → Instagram → LINE/WhatsApp
    const groups = [
      ['Facebook', pages.filter((p) => !p.platform || p.platform === 'Facebook')],
      ['Instagram', pages.filter((p) => p.platform === 'Instagram')],
      ['อื่น ๆ', pages.filter((p) => p.platform && p.platform !== 'Facebook' && p.platform !== 'Instagram')],
    ].filter(([, list]) => list.length);
    const rows = groups.map(([g, list]) => {
      const st = PLATFORM_STYLE[g];
      const head = st ? `${st.icon} ${st.label}` : '💬 LINE / WhatsApp';
      return `<tr><td colspan="5" style="background:#f8fafc;font-weight:800;color:${st ? st.fg : '#334155'};padding:8px 16px">${head} <span class="rv-hint" style="font-weight:500">${list.length} บัญชี</span></td></tr>${list.map(row).join('')}`;
    }).join('');
    const counts = groups.map(([g, list]) => `${PLATFORM_STYLE[g] ? platformBadge(g, 11.5) : '💬 อื่น ๆ'} <b>${list.length}</b>`).join(' &nbsp; ');

    return `<section class="card panel pages-panel" style="grid-column:1 / -1;width:100%;max-width:none">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h3 style="margin:0">🏢 ตารางเพจและช่องทางในระบบ</h3>
          <p class="sub" style="margin:4px 0 0">กด <b>"✏️ แก้ไข"</b> ที่เพจใดเพื่อโหลดขึ้นไปแก้ไขในกล่องด้านบน หรือกด <b>"ลบ"</b> ได้ทันที</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" type="button" data-act="meta-discover" style="font-size:13px">🔄 ดึงเพจทั้งหมดจาก Token</button>
          <button class="btn" type="button" data-act="fb-import-all" style="font-size:13px">📥 ดึงแชทย้อนหลังทุกเพจ</button>
          <button class="btn" type="button" data-act="meta-posts-sync-all" style="font-size:13px;background:#2d5022;color:#fff">💬 ดึง Post & comment ทุกเพจ</button>
        </div>
      </div>
      ${counts ? `<div style="margin-top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${counts}</div>` : ''}
      <div class="tscroll" style="margin:12px 0 0">
        <table style="width:100%;min-width:760px">
          <thead><tr><th style="padding-left:16px;width:30%">ชื่อเพจ / บัญชี</th><th style="width:12%">แพลตฟอร์ม</th><th style="width:16%">Page ID (แชท)</th><th style="width:14%">Ad Account (โฆษณา)</th><th class="nosort">จัดการ</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty">ยังไม่มีเพจในระบบ (กดปุ่ม "ดึงเพจทั้งหมดจาก Token" เพื่อนำเข้าอัตโนมัติ)</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  }

  function usersPanelHtml() {
    const u = S.users; const r = u.result;
    const rows = (u.data || []).map((x) => `<tr><td><b>${esc(x.username)}</b>${x.username === S.me.username ? ' <small class="rv-hint">(คุณ)</small>' : ''}</td>
      <td><span class="q-badge ${x.role === 'admin' ? 'q-average' : 'q-none'}">${esc(ROLE_TH[x.role])}</span></td>
      <td>${x.mustChange ? '<span class="q-badge q-poor">ยังไม่ได้เปลี่ยนรหัส</span>' : '<span class="q-badge q-excellent">ใช้งานแล้ว</span>'}</td>
      <td class="nowrap">${x.createdAt ? esc(fmtTs(x.createdAt).slice(0, 10)) : '—'}</td>
      <td class="nowrap"><button class="btn" type="button" data-act="user-reset" data-user="${esc(x.username)}">รีเซ็ตรหัส</button>
        ${x.username === S.me.username ? '' : `<button class="btn danger" type="button" data-act="user-delete" data-user="${esc(x.username)}">ลบ</button>`}</td></tr>`).join('');
    const result = r ? `<div class="notice ${r.added.length ? 'ok' : 'err'}" style="margin-top:14px">
        ${r.added.length ? `<b>เพิ่มแล้ว ${r.added.length} คน</b> — จดหรือคัดลอกรหัสผ่านตอนนี้ ระบบจะไม่แสดงอีก (ผู้ใช้ต้องเปลี่ยนรหัสเองตอนล็อกอินครั้งแรก)
        <pre class="pw-list">${esc(r.added.map((a) => `${a.username}\t${a.password}`).join('\n'))}</pre>
        <button class="btn" type="button" data-act="user-copy">คัดลอกรายชื่อ</button>` : '<b>ไม่ได้เพิ่มใครเลย</b>'}
        ${r.skipped.length ? `<div style="margin-top:8px"><b>ข้าม ${r.skipped.length} รายการ:</b><ul class="skip-list">${r.skipped.map((s) => `<li>${esc(s.username || '(ว่าง)')} — ${esc(s.reason)}</li>`).join('')}</ul></div>` : ''}</div>` : '';
    return `<section class="card panel"><h3>ผู้ใช้งาน</h3>
      <p class="sub">เฉพาะผู้ดูแลเห็นส่วนนี้ · ทุกคนใช้ข้อมูลชุดเดียวกัน ส่วนการเพิ่ม/ลบผู้ใช้และรีเซ็ตรหัสทำได้เฉพาะ admin</p>
      ${u.err ? `<div class="notice err" style="margin-bottom:12px">${esc(u.err)}</div>` : ''}
      <div class="tscroll"><table style="min-width:640px"><thead><tr><th class="nosort">ชื่อผู้ใช้</th><th class="nosort">สิทธิ์</th><th class="nosort">สถานะรหัสผ่าน</th><th class="nosort">สร้างเมื่อ</th><th class="nosort"></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5"><div class="empty">กำลังโหลด…</div></td></tr>'}</tbody></table></div>
      <form class="form users-form" data-form="users-add" autocomplete="off" style="margin-top:18px">
        <h4 style="margin:0">เพิ่มผู้ใช้ (ทีละหลายคนได้)</h4>
        <div class="field"><label>รายชื่อ — บรรทัดละ 1 คน</label>
          <textarea name="list" rows="5" spellcheck="false" placeholder="somchai&#10;mint Temp-Pass-002&#10;ploy"></textarea>
          <small>รูปแบบ: <code>ชื่อผู้ใช้</code> หรือ <code>ชื่อผู้ใช้ รหัสผ่าน</code> (คั่นด้วยเว้นวรรค/จุลภาค/แท็บ) ถ้าไม่ใส่รหัสผ่าน ระบบสุ่มให้ 10 ตัวอักษร · ชื่อใช้ได้ a-z 0-9 _ . - ยาว 3–30 ตัว · รหัสผ่านอย่างน้อย 8 ตัว</small></div>
        <div class="field"><label>สิทธิ์</label><div class="sel" style="display:inline-block"><select name="role">
          <option value="staff">ทีมขาย (staff)</option><option value="admin">ผู้ดูแล (admin) — จัดการผู้ใช้ได้</option></select></div></div>
        <div class="row-actions"><button class="btn primary" type="submit">เพิ่มผู้ใช้</button></div>
      </form>${result}</section>`;
  }
  function settingShell() { return '<div class="page-head"><div><h1>Setting</h1><div class="meta-line"><span>การเชื่อมต่อ Meta และบัญชีผู้ใช้</span></div></div></div><div id="setting-body"><div class="loading">Loading…</div></div>'; }
  function flash() { return S.flash ? `<div class="notice ${S.flash.type}" style="margin-bottom:16px;max-width:900px">${esc(S.flash.text)}</div>` : ''; }

  function renderSettingBody() {
    const box = document.getElementById('setting-body'); const s = S.settings; if (!box || !s) return;
    const m = s.meta; const connected = Boolean(m.connectedAt);
    const verNum = parseInt(String(m.apiVersion || '').replace(/^v/, ''), 10);
    box.innerHTML = `${flash()}${verNum && verNum < 25 ? `<div class="notice warn" style="margin-bottom:16px;max-width:900px">Graph API เวอร์ชัน <b>${esc(m.apiVersion)}</b> ค่อนข้างเก่า — Meta กำหนดอายุของ Marketing API สั้นกว่า Graph API ทั่วไป และเก่ากว่านี้อาจถูกอัปเกรดอัตโนมัติ แนะนำเปลี่ยนเป็น <b>v25.0</b> ขึ้นไป แล้วกด “บันทึกและทดสอบ”</div>` : ''}<div class="stack" style="max-width:1150px">
      <section class="card panel" style="background:linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);border:1.5px solid #86efac">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="margin:0;display:flex;align-items:center;gap:8px;color:#166534">
              ⚡ ฐานข้อมูล Supabase Cloud (kv table)
              ${(s.supabase && s.supabase.connected) ? '<span class="chip good" style="font-size:11px">เชื่อมต่อแล้ว (Active)</span>' : '<span class="chip" style="font-size:11px">ไม่ได้เชื่อมต่อ (ใช้ Local SQLite)</span>'}
            </h3>
            <p class="sub" style="margin:4px 0 0">
              สถานะ: <b>${(s.supabase && s.supabase.connected) ? `เชื่อมโยงกับโปรเจกต์ (${esc(s.supabase.url)}) เรียบร้อย` : 'ระบบใช้ Local SQLite (สามารถใส่ URL & Key ด้านล่างเพื่อเชื่อม Cloud DB ได้ทันที)'}</b>
            </p>
          </div>
          <button class="btn primary" type="button" data-act="supabase-sync-now" style="background:#16a34a;border-color:#15803d;display:inline-flex;align-items:center;gap:6px">
            🔄 ดึงข้อมูลล่าสุดจาก Supabase เดี๋ยวนี้
          </button>
        </div>
        <details style="margin-top:12px;background:#ffffff;padding:10px 14px;border-radius:10px;border:1px solid #bbf7d0" ${(s.supabase && s.supabase.connected) ? '' : ''}>
          <summary style="cursor:pointer;font-weight:700;font-size:13px;color:#166534">⚙️ ตั้งค่าการเชื่อมต่อ Supabase Cloud URL & API Key</summary>
          <form class="form" data-form="supabase-settings" autocomplete="off" style="margin-top:10px">
            <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px">
              <div class="field" style="margin:0"><label>Supabase Project URL</label><input type="url" name="url" value="${esc((s.supabase && s.supabase.fullUrl) || '')}" placeholder="https://xxxx.supabase.co"></div>
              <div class="field" style="margin:0"><label>Supabase API Key (anon / service_role) ${(s.supabase && s.supabase.hasKey) ? `<span class="chip good" style="margin-left:6px">บันทึกแล้ว ${esc(s.supabase.keyHint)}</span>` : ''}</label><input type="password" name="key" placeholder="${(s.supabase && s.supabase.hasKey) ? 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน' : 'eyJhbGciOiJIUzI1NiIsInR5cCI...'}" autocomplete="new-password"></div>
            </div>
            <div class="row-actions" style="margin-top:10px">
              <button class="btn primary" type="submit" data-after="sync">💾 บันทึก & ซิงค์ข้อมูลจาก Supabase</button>
              <button class="btn" type="submit" data-after="save">บันทึกค่า</button>
            </div>
          </form>
        </details>
      </section>

      <section class="card panel"><h3>แหล่งข้อมูล</h3>
        <p class="sub">ตอนนี้แสดงข้อมูล: <b>${s.mode === 'meta' ? 'Meta API (ข้อมูลสดจาก Meta)' : s.mode === 'demo' ? 'Demo (ข้อมูลตัวอย่าง)' : 'ข้อมูลจริง (ว่างพร้อมรับข้อมูลใหม่และนำเข้า)'}</b>${connected ? ` · เชื่อมกับบัญชี <b>${esc(m.accountName)}</b>${m.currency ? ' (' + esc(m.currency) + ')' : ''}` : ''}</p>
        <div class="row-actions">
          <button class="btn ${s.mode === 'live' ? 'primary' : ''}" data-act="mode" data-mode="live">ใช้ข้อมูลจริง (เคลียร์เดโม)</button>
          <button class="btn ${s.mode === 'demo' ? 'primary' : ''}" data-act="mode" data-mode="demo">ใช้ข้อมูลเดโม</button>
          <button class="btn ${s.mode === 'meta' ? 'primary' : ''}" data-act="mode" data-mode="meta" ${connected ? '' : 'disabled'}>ใช้ข้อมูล Meta API</button></div></section>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(380px, 1fr));gap:16px;align-items:start">
        <!-- กล่อง 1: เชื่อมต่อ Meta -->
        <section class="card panel" style="margin:0;height:100%">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <h3 style="margin:0">🔗 เชื่อมต่อ Meta API (Ads, รูป/วิดีโอแคมเปญ & เพจ)</h3>
              <p class="sub" style="margin:4px 0 0">วาง Token แล้วกดบันทึก & ทดสอบ หรือกดซิงค์ข้อมูลทั้งหมดในคลิกเดียว</p>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn primary" type="button" data-act="meta-sync-all" style="font-size:12px;padding:6px 12px">🚀 ซิงค์ข้อมูล Meta ทั้งหมด</button>
              <button class="btn" type="button" data-act="meta-discover" style="font-size:12px;padding:6px 12px">🔄 ดึงเพจ FB/IG</button>
              <button class="btn" type="button" data-act="ig-test" style="font-size:12px;padding:6px 12px;background:#fdf2f8;border-color:#fbcfe8;color:#be185d;font-weight:700">📸 ตรวจสอบ Instagram</button>
              <button class="btn" type="button" data-act="meta-subscribe-webhooks" style="font-size:12px;padding:6px 12px" title="ตั้งค่าให้ Meta ส่งแชท Messenger/Instagram ใหม่เข้าระบบทันที">🔔 เปิดรับแชทอัตโนมัติ</button>
            </div>
          </div>
          ${igDiagHtml()}
          <form class="form" data-form="meta" autocomplete="off" style="margin-top:14px">
            <div class="field"><label>ชื่อคลินิก / องค์กร</label><input type="text" name="clinicName" value="${esc(s.clinicName)}" placeholder="เช่น BEQ GROUP" maxlength="80"></div>
            <div class="field"><label>Meta Ad Account ID หลัก</label><input type="text" name="adAccountId" value="${esc(m.adAccountId)}" placeholder="เช่น 1234567890 หรือเว้นว่างเพื่อค้นหาอัตโนมัติจาก Token" inputmode="numeric"><small>ดูได้ที่ Ads Manager (หากเว้นว่าง ระบบจะค้นหา Ad Account แรกจาก Token ให้อัตโนมัติ)</small></div>
            <div class="field"><label>Access Token ${m.hasToken ? `<span class="chip good" style="margin-left:6px">บันทึกแล้ว ${esc(m.tokenHint)}</span>` : ''}</label>
              <input type="password" name="accessToken" placeholder="${m.hasToken ? 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน' : 'วาง System User Token ที่นี่'}" autocomplete="new-password">
              <small>สิทธิ์ Facebook & IG: <code>pages_show_list</code>, <code>pages_messaging</code>, <code>instagram_basic</code>, <code>instagram_manage_messages</code>, <code>instagram_manage_comments</code>, <code>ads_read</code>, <code>read_insights</code></small>
            </div>
            <details style="margin:10px 0;background:#f9f8f4;padding:10px 14px;border-radius:8px;border:1px solid var(--line-soft)">
              <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text-soft)">⚙️ ตัวเลือกขั้นสูง (App ID / Secret)</summary>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
                <div class="field" style="margin:0"><label>App ID</label><input type="text" name="appId" value="${esc(m.appId)}" placeholder="App ID"></div>
                <div class="field" style="margin:0"><label>App Secret</label><input type="password" name="appSecret" placeholder="${m.hasSecret ? 'บันทึกแล้ว' : 'App Secret'}" autocomplete="new-password"></div>
              </div>
              <div class="field" style="margin:10px 0 0"><label>API Version</label><input type="text" name="apiVersion" value="${esc(m.apiVersion)}" placeholder="v25.0"></div>
            </details>
            <div class="row-actions" style="margin-top:14px">
              <button class="btn primary" type="submit" data-after="test">บันทึก & ทดสอบ</button>
              <button class="btn" type="submit" data-after="save">บันทึก</button>
              <button class="btn danger" type="button" data-act="disconnect">ตัดการเชื่อมต่อ</button>
            </div>
          </form>
        </section>

        <!-- กล่อง 2: เพิ่มหรือแก้ไขข้อมูลเพจ (อยู่เคียงข้างกัน) -->
        <section class="card panel" style="margin:0;height:100%;background:#fbfaf6;border:1px solid var(--line)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3 id="page-edit-heading" style="margin:0">➕ เพิ่มหรือแก้ไขข้อมูลเพจ</h3>
            <button class="btn" type="button" id="p-cancel-btn" data-act="page-edit-cancel" style="display:none;font-size:12px;padding:4px 8px">ล้างฟอร์ม</button>
          </div>
          <p class="sub" style="margin:4px 0 14px">ตั้งชื่อเล่นเพจ, แก้ไข Page ID, ผูก Ad Account เฉพาะเพจ หรือเปลี่ยนแพลตฟอร์ม</p>
          <form class="form" id="page-edit-form" data-form="pages-add" autocomplete="off">
            <div class="field"><label>ชื่อเพจ (เช่น เพจปลูกผมหลัก, สาขา 2)</label><input type="text" id="p-name" name="name" placeholder="ชื่อเพจที่ต้องการแสดง..." required></div>
            <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px">
              <div class="field"><label>Page ID (แชท)</label><input type="text" id="p-id" name="id" placeholder="เช่น 1018075398296404" required></div>
              <div class="field"><label>แพลตฟอร์ม</label>
                <div class="sel" style="width:100%"><select id="p-platform" name="platform" style="width:100%">
                  <option value="Facebook">🔵 Facebook</option>
                  <option value="Instagram">📸 Instagram</option>
                  <option value="WhatsApp">💚 WhatsApp</option>
                  <option value="LINE">📱 LINE</option>
                </select></div>
              </div>
            </div>
            <div class="field"><label>Meta Ad Account ID สำหรับเพจนี้ (ไม่บังคับ)</label><input type="text" id="p-adAccountId" name="adAccountId" placeholder="เช่น act_12345 หรือตัวเลข"><small>รองรับหลาย Ad Account — ระบบจะดึงแคมเปญจากทุก Ad Account ที่ผูกไว้</small></div>
            <div class="field"><label>Facebook Page ID ที่ผูกคู่กัน (เฉพาะ Instagram Business)</label><input type="text" id="p-fbPageId" name="fbPageId" placeholder="เช่น 109373461849494 (ระบบใส่ให้อัตโนมัติเมื่อกดดึงเพจ FB/IG)"><small>จำเป็นสำหรับการดึงแชท Instagram Direct ผ่าน Graph API ({fbPageId}/conversations?platform=instagram)</small></div>
            <div class="row-actions" style="margin-top:16px">
              <button class="btn primary" type="submit" id="p-submit-btn" style="width:100%;justify-content:center">💾 บันทึกข้อมูลเพจ</button>
            </div>
          </form>
        </section>
      </div>

      <section class="card panel"><h3>Webhook รับข้อความ Facebook Messenger & Instagram Direct</h3>
        <p class="sub">ให้ Meta ส่งข้อความลูกค้าทั้งจาก Facebook และ Instagram เข้ามาที่ระบบนี้อัตโนมัติ (URL เดียวกัน)</p>
        <div class="form">
          <div class="field"><label>Callback URL</label><input type="text" readonly value="${esc(location.origin + s.webhook.path)}" data-act="select-input"><small>ถ้ายังรันบนเครื่องตัวเอง ให้ใช้ tunnel เช่น Cloudflare Tunnel / ngrok แล้วใช้ URL ที่ได้ + <code>/webhook</code></small></div>
          <div class="field"><label>Verify Token</label><input type="text" readonly value="${esc(s.webhook.verifyToken)}" data-act="select-input"><small>นำไปกรอกช่อง Verify token ตอนตั้ง Webhook ที่ Meta</small></div>
          <div class="field"><label>สถานะ App Secret</label><div>${s.webhook.hasSecret ? '<span class="chip good">บันทึกแล้ว — ตรวจลายเซ็น Webhook ได้</span>' : '<span class="chip">ยังไม่ได้บันทึก — ระบบจะปฏิเสธทุกข้อความจากเพจจนกว่าจะกรอก App Secret ด้านบน</span>'}</div></div></div>
        <ol class="steps"><li>ที่ Meta App → Messenger (หรือ Instagram Graph API) → Webhooks กรอก Callback URL และ Verify Token ด้านบน</li>
          <li>Subscribe ฟิลด์ <code>messages</code>, <code>message_echoes</code>, <code>messaging_referrals</code> (สำหรับ Facebook) และ <code>messages</code> (สำหรับ Instagram)</li>
          <li>ผูกเพจและบัญชี IG เข้ากับ Webhook (Add subscriptions) และให้สิทธิ์ <code>pages_messaging</code>, <code>instagram_basic</code>, <code>instagram_manage_messages</code></li></ol></section>

      <section class="card panel" style="background:linear-gradient(135deg,#fafffa 0%,#f0fdf4 100%);border:1.5px solid #bbf7d0">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;color:#166534">📊 เชื่อมต่อ Google Sheets Auto-Sync & Backup</h3>
            <p class="sub" style="margin:4px 0 0">ดึงข้อมูลลูกค้า/แคมเปญจากลิงก์ Google Sheets และสำรองข้อมูลแชทใหม่เข้า Google Sheets อัตโนมัติ${(s.sheets && s.sheets.lastSyncAt) ? ` · ซิงค์ล่าสุด: <b>${esc(fmtTs(s.sheets.lastSyncAt))}</b>` : ''}</p>
          </div>
        </div>
        <form class="form" data-form="sheets-settings" autocomplete="off" style="margin-top:12px">
          <div class="field"><label>ลิงก์ Google Sheet (เปิดสิทธิ์ Anyone with the link)</label><input type="url" name="sheetUrl" value="${esc((s.sheets && s.sheets.lastUrl) || 'https://docs.google.com/spreadsheets/d/1hDT2bqqFFCPdiZn0K7pJVXjo-KmUgjgaLtMOpcONjpk/edit?usp=sharing')}" placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"></div>
          <div class="field"><label>Apps Script Webhook URL สำหรับส่งข้อมูลแชทเข้า Sheet อัตโนมัติ (ไม่บังคับ)</label><input type="url" name="appsScriptUrl" value="${esc((s.sheets && s.sheets.appsScriptUrl) || '')}" placeholder="https://script.google.com/macros/s/.../exec"></div>
          <div class="row-actions">
            <button class="btn primary" type="submit" data-after="sync">📥 บันทึก & ทดสอบดึงข้อมูลจาก Google Sheet</button>
            <button class="btn" type="submit" data-after="save">บันทึกการตั้งค่า Sheet</button>
          </div>
        </form>
      </section>

      <section class="card panel" style="border:1.5px solid #06c755;background:#fcfdfa">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;display:flex;align-items:center;gap:8px;color:#06c755">
              🔔 แจ้งเตือนสถานะลูกค้าผ่าน LINE (LINE Notify / Group Webhook)
            </h3>
            <p class="sub" style="margin:4px 0 0">ส่งแจ้งเตือนเข้ากลุ่ม LINE ของทีมขายอัตโนมัติเมื่อลูกค้าเปลี่ยนสถานะ, ถึงเวลานัดตาม, หรือลูกค้ารอตอบ</p>
          </div>
          <button class="btn" type="button" data-act="line-notify-test" style="border-color:#06c755;color:#06c755;font-weight:600">🧪 ทดสอบส่ง LINE</button>
        </div>
        <form class="form" data-form="line-notify-settings" autocomplete="off" style="margin-top:14px">
          <div class="field" style="display:flex;align-items:center;gap:10px">
            <input type="checkbox" id="ln-enabled" name="enabled" value="1" ${(s.lineNotify && s.lineNotify.enabled) ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer">
            <label for="ln-enabled" style="margin:0;font-weight:600;cursor:pointer">เปิดใช้งานการแจ้งเตือน LINE</label>
          </div>
          <div class="field">
            <label>LINE Notify Token (แนะนำสำหรับกลุ่มทีมงาน)</label>
            <input type="text" name="token" value="${esc((s.lineNotify && s.lineNotify.token) || '')}" placeholder="ออก Token จาก notify-bot.line.me แล้วนำมาใส่ที่นี่">
            <small>สามารถดึง Token ฟรีจาก https://notify-bot.line.me แล้วดึง LINE Notify เข้ากลุ่มไลน์ของทีมขาย</small>
          </div>
          <div class="field">
            <label>หรือ Webhook URL (กรณีใช้ Make / Zapier / Discord / Slack)</label>
            <input type="text" name="webhookUrl" value="${esc((s.lineNotify && s.lineNotify.webhookUrl) || '')}" placeholder="https://hook.eu1.make.com/...">
          </div>
          <div class="field">
            <label style="margin-bottom:6px">เหตุการณ์ที่ต้องการให้แจ้งเตือนเข้า LINE</label>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">
              <label style="display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer">
                <input type="checkbox" name="notifyOnStatusChange" value="1" ${(!s.lineNotify || s.lineNotify.notifyOnStatusChange) ? 'checked' : ''}>
                <span>🔄 แจ้งเตือนเมื่อสถานะลูกค้าเปลี่ยน (เช่น สนใจ → นัดปรึกษา → ปิดการขาย) พร้อมระบุชื่อเซลส์</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer">
                <input type="checkbox" name="notifyOnOverdue" value="1" ${(!s.lineNotify || s.lineNotify.notifyOnOverdue) ? 'checked' : ''}>
                <span>⏰ แจ้งเตือนเมื่อนัดตามลูกค้าเกินกำหนด หรือตั้งนัดใหม่</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer">
                <input type="checkbox" name="notifyOnNewReply" value="1" ${(!s.lineNotify || s.lineNotify.notifyOnNewReply) ? 'checked' : ''}>
                <span>💬 แจ้งเตือนเมื่อลูกค้าตอบกลับมารอแอดมิน/เซลส์ตอบ</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer">
                <input type="checkbox" name="notifyOnChase" value="1" ${(!s.lineNotify || s.lineNotify.notifyOnChase) ? 'checked' : ''}>
                <span>⏳ แจ้งเตือนเมื่อลูกค้าเงียบเกิน 24 ชม. (ถึงเวลาทักตามต่อ)</span>
              </label>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn primary" type="submit" style="background:#06c755;border-color:#05b64c">บันทึกการตั้งค่าแจ้งเตือน LINE</button>
          </div>
        </form>
      </section>

      ${lineAccountsPanelHtml(s)}

      ${waAccountsPanelHtml(s)}

      ${pagesPanelHtml()}

      ${S.me.role === 'admin' ? usersPanelHtml() : ''}

      <section class="card panel"><h3>เปลี่ยนรหัสผ่าน</h3><p class="sub">ผู้ใช้: <b>${esc(S.me.username)}</b></p>
        <form class="form" data-form="password">
          ${S.me.mustChange
            ? '<div class="notice warn" style="margin-bottom:10px">บัญชีนี้ใช้รหัสผ่านชั่วคราว ตั้งรหัสผ่านใหม่ได้เลย ไม่ต้องกรอกรหัสเดิม</div>'
            : '<div class="field"><label>รหัสผ่านปัจจุบัน</label><input type="password" name="current" autocomplete="current-password" required><small>คือรหัสที่ใช้ล็อกอินเข้ามาครั้งล่าสุด</small></div>'}
          <div class="field"><label>รหัสผ่านใหม่</label><input type="password" name="next" autocomplete="new-password" minlength="8" required><small>อย่างน้อย 8 ตัวอักษร</small></div>
          <div class="row-actions"><button class="btn primary" type="submit">เปลี่ยนรหัสผ่าน</button></div></form></section></div>`;
    buildSettingQuickNav(box);
  }

  // ===== LINE OA หลายบัญชี =====
  function lineAccountsPanelHtml(s) {
    const list = s.lineAccounts || [];
    const hook = location.origin + '/webhook/line';
    const form = (a) => {
      const isNew = !a;
      a = a || {};
      return `<form class="form" data-form="line-settings" autocomplete="off" style="margin-top:10px">
        ${isNew ? '' : `<input type="hidden" name="id" value="${esc(a.id)}">`}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
          <div class="field"><label>ชื่อที่แสดงในระบบ</label><input type="text" name="name" value="${esc(a.name || '')}" placeholder="เช่น LINE BEQ สีลม"></div>
          <div class="field"><label>Channel ID</label><input type="text" name="channelId" value="${esc(a.channelId || '')}" placeholder="เช่น 2001234567"></div>
          <div class="field"><label>Channel Secret ${a.hasSecret ? '<span class="chip good" style="margin-left:6px">บันทึกแล้ว</span>' : ''}</label><input type="password" name="channelSecret" placeholder="${a.hasSecret ? 'เว้นว่างไว้ถ้าไม่เปลี่ยน' : 'จาก LINE Developers Console'}" autocomplete="new-password"></div>
          <div class="field"><label>Channel Access Token ${a.hasToken ? `<span class="chip good" style="margin-left:6px">บันทึกแล้ว ${esc(a.tokenHint)}</span>` : ''}</label><input type="password" name="channelAccessToken" placeholder="${a.hasToken ? 'เว้นว่างไว้ถ้าไม่เปลี่ยน' : 'Issue ที่แท็บ Messaging API'}" autocomplete="new-password"></div>
        </div>
        <div class="row-actions">
          <button class="btn primary" type="submit" data-after="test">${isNew ? '➕ เพิ่ม & ทดสอบ' : 'บันทึก & ทดสอบ'}</button>
          <button class="btn" type="submit" data-after="save">บันทึก</button>
          ${isNew ? '' : `<button class="btn danger" type="button" data-act="line-acc-delete" data-id="${esc(a.id)}" data-name="${esc(a.name || '')}" style="margin-left:auto">ลบบัญชีนี้</button>`}
        </div>
      </form>`;
    };
    const rows = list.map((a) => `<details class="chan-acc" ${list.length === 1 ? 'open' : ''} style="border:1px solid #e2e8f0;border-left:4px solid #06c755;border-radius:12px;padding:10px 14px;margin-top:10px;background:#fff">
        <summary style="cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;list-style:none">
          <b>💬 ${esc(a.name || 'LINE OA')}</b>
          ${a.basicId ? `<span class="rv-hint">${esc(a.basicId)}</span>` : ''}
          ${a.connectedAt && a.hasToken ? '<span class="chip good" style="font-size:11px">🟢 เชื่อมต่อแล้ว</span>' : '<span class="chip" style="font-size:11px;background:#fef3c7;color:#92400e">ยังไม่ได้ทดสอบ</span>'}
          ${a.fromEnv ? '<span class="chip" style="font-size:11px">ตั้งจาก Environment</span>' : ''}
          ${!a.hasSecret ? '<span class="chip" style="font-size:11px;background:#fee2e2;color:#991b1b">⚠️ ยังไม่มี Channel Secret — ยังรับแชทไม่ได้</span>' : ''}
          <span class="rv-hint" style="margin-left:auto;font-size:11.5px">กดเพื่อแก้ไข ▾</span>
        </summary>
        ${a.fromEnv ? '<p class="rv-hint" style="margin:8px 0 0">บัญชีนี้ตั้งผ่าน Environment บน Render (LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN) แก้ไขที่ Render</p>' : form(a)}
      </details>`).join('');
    return `<section class="card panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0">เชื่อมต่อ LINE Official Account <span class="chip" style="font-size:11.5px;margin-left:6px">${list.length} บัญชี</span></h3>
          <p class="sub" style="margin:4px 0 0">เพิ่มได้หลาย OA เหมือนเพจ Facebook — แต่ละ OA แยกแชท แยกตัวกรอง และตอบกลับจาก OA ที่ลูกค้าทักมา</p>
        </div>
        <button class="btn" type="button" data-act="line-acc-new">➕ เพิ่ม LINE OA</button>
      </div>
      <div class="field" style="margin-top:10px"><label>Webhook URL (ใช้ URL เดียวกันทุก OA)</label><input type="text" readonly value="${esc(hook)}" data-act="select-input"><small>ใส่ที่ LINE Developers Console → Messaging API → Webhook settings ของแต่ละ OA แล้วเปิด "Use webhook" — ระบบแยกได้เองว่าข้อความมาจาก OA ไหน</small></div>
      ${rows || '<div class="empty" style="margin-top:10px">ยังไม่มีบัญชี LINE OA — กด "➕ เพิ่ม LINE OA"</div>'}
      ${S.lineNew || !list.length ? `<div style="border:1px dashed #06c755;border-radius:12px;padding:10px 14px;margin-top:10px;background:#f0fdf4"><b>➕ LINE OA ใหม่</b>${form(null)}</div>` : ''}
    </section>`;
  }

  // ===== WhatsApp หลายเบอร์ =====
  function waAccountsPanelHtml(s) {
    const list = s.waAccounts || [];
    const form = (a) => {
      const isNew = !a;
      a = a || {};
      return `<form class="form" data-form="whatsapp-settings" autocomplete="off" style="margin-top:10px">
        ${isNew ? '' : `<input type="hidden" name="id" value="${esc(a.id)}">`}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
          <div class="field"><label>ชื่อที่แสดงในระบบ</label><input type="text" name="name" value="${esc(a.name || '')}" placeholder="เช่น WhatsApp Pavicon"></div>
          <div class="field"><label>Phone Number ID</label><input type="text" name="phoneId" value="${esc(a.phoneId || '')}" placeholder="เช่น 102345678901"><small>Meta Developer → WhatsApp → API Setup</small></div>
          <div class="field"><label>WABA ID</label><input type="text" name="wabaId" value="${esc(a.wabaId || '')}" placeholder="เช่น 109876543210"></div>
          <div class="field"><label>Access Token ${a.hasToken ? `<span class="chip good" style="margin-left:6px">บันทึกแล้ว ${esc(a.tokenHint)}</span>` : ''}</label><input type="password" name="accessToken" placeholder="${a.hasToken ? 'เว้นว่างไว้ถ้าไม่เปลี่ยน' : 'เว้นว่าง = ใช้ Token ของ Meta'}" autocomplete="new-password"><small>เบอร์ใน Business เดียวกันใช้ Token เดียวกันได้</small></div>
        </div>
        <div class="row-actions">
          <button class="btn primary" type="submit" data-after="test">${isNew ? '➕ เพิ่ม & ทดสอบ' : 'บันทึก & ทดสอบ'}</button>
          <button class="btn" type="submit" data-after="save">บันทึก</button>
          ${isNew ? '' : `<button class="btn danger" type="button" data-act="wa-acc-delete" data-id="${esc(a.id)}" data-name="${esc(a.name || '')}" style="margin-left:auto">ลบเบอร์นี้</button>`}
        </div>
      </form>`;
    };
    const rows = list.map((a) => `<details class="chan-acc" ${list.length === 1 ? 'open' : ''} style="border:1px solid #e2e8f0;border-left:4px solid #25d366;border-radius:12px;padding:10px 14px;margin-top:10px;background:#fff">
        <summary style="cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;list-style:none">
          <b>🟢 ${esc(a.name || 'WhatsApp')}</b>
          ${a.displayPhone ? `<span class="rv-hint">${esc(a.displayPhone)}</span>` : a.phoneId ? `<span class="rv-hint">ID ${esc(a.phoneId)}</span>` : ''}
          ${a.connectedAt ? '<span class="chip good" style="font-size:11px">🟢 เชื่อมต่อแล้ว</span>' : '<span class="chip" style="font-size:11px;background:#fef3c7;color:#92400e">ยังไม่ได้ทดสอบ</span>'}
          <span class="rv-hint" style="margin-left:auto;font-size:11.5px">กดเพื่อแก้ไข ▾</span>
        </summary>
        ${form(a)}
      </details>`).join('');
    return `<section class="card panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0">เชื่อมต่อ WhatsApp Business <span class="chip" style="font-size:11.5px;margin-left:6px">${list.length} เบอร์</span></h3>
          <p class="sub" style="margin:4px 0 0">เพิ่มได้หลายเบอร์ — แต่ละเบอร์แยกแชท แยกตัวกรอง และตอบกลับจากเบอร์ที่ลูกค้าทักมา</p>
        </div>
        <button class="btn" type="button" data-act="wa-acc-new">➕ เพิ่มเบอร์ WhatsApp</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:10px">
        <div class="field"><label>Webhook Callback URL (ใช้ร่วมกันทุกเบอร์)</label><input type="text" readonly value="${esc(location.origin + '/webhook/whatsapp')}" data-act="select-input"></div>
        <div class="field"><label>Verify Token</label><input type="text" readonly value="${esc((s.whatsapp && s.whatsapp.verifyToken) || (s.webhook && s.webhook.verifyToken) || '')}" data-act="select-input"></div>
      </div>
      <small class="rv-hint">เบอร์ที่ลูกค้าทักเข้ามาแต่ยังไม่ได้เพิ่ม ระบบจะเพิ่มให้เองอัตโนมัติ (ตอบกลับด้วย Token ของ Meta)</small>
      ${rows || '<div class="empty" style="margin-top:10px">ยังไม่มีเบอร์ WhatsApp — กด "➕ เพิ่มเบอร์ WhatsApp"</div>'}
      ${S.waNew || !list.length ? `<div style="border:1px dashed #25d366;border-radius:12px;padding:10px 14px;margin-top:10px;background:#f0fdf4"><b>➕ เบอร์ WhatsApp ใหม่</b>${form(null)}</div>` : ''}
    </section>`;
  }

  // ชื่อสั้นสำหรับปุ่มทางลัด (หัวข้อจริงยาวเกินจนโดนตัด)
  function shortSettingLabel(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    const rules = [
      [/supabase/i, '⚡ ฐานข้อมูล'], [/แหล่งข้อมูล/, '🗂️ แหล่งข้อมูล'], [/meta api/i, '🔗 Meta'],
      [/เพิ่มหรือแก้ไข/, '✏️ แก้ไขเพจ'], [/แจ้งเตือน/, '🔔 แจ้งเตือน'], [/google sheets/i, '📊 Google Sheets'],
      [/webhook/i, '📨 Webhook'], [/line/i, '💬 LINE OA'], [/whatsapp/i, '🟢 WhatsApp'],
      [/ตารางเพจ/, '🏢 ตารางเพจ'], [/ผู้ใช้/, '👥 ผู้ใช้งาน'], [/รหัสผ่าน/, '🔑 รหัสผ่าน'],
    ];
    for (const [re, label] of rules) if (re.test(s)) return label;
    return s.replace(/\(.*?\)/g, '').trim().slice(0, 18);
  }

  // หน้า Setting ยาวมาก → แถบทางลัดด้านบน กดแล้วเลื่อนไปหัวข้อนั้น (สร้างจากหัวข้อจริงในหน้า)
  function buildSettingQuickNav(box) {
    try {
      const heads = [...box.querySelectorAll('section.card h3')].filter((h) => h.offsetParent !== null || true);
      if (heads.length < 3) return;
      const nav = document.createElement('div');
      nav.className = 'setting-quicknav';
      heads.forEach((h, i) => {
        const sec = h.closest('section'); if (!sec) return;
        sec.id = sec.id || `setting-sec-${i}`;
        const label = shortSettingLabel(h.textContent);
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = label;
        b.addEventListener('click', () => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        nav.appendChild(b);
      });
      box.insertBefore(nav, box.firstChild);
    } catch (_) {}
  }

  /* ---------------- events ---------------- */
  function resetFilters() { Object.assign(S.dash, { platform: '', page: '', campaign: '', agency: '', rep: '', status: '', search: '' }); }

  document.addEventListener('click', async (ev) => {
    if (ev.target.classList.contains('fu-sched-backdrop')) {
      S.scheduleModalOpen = false;
      render();
      return;
    }
    if (ev.target.classList.contains('import-modal-backdrop')) {
      S.importModal = null;
      render();
      return;
    }
    const el = ev.target.closest('[data-act]');
    if (!el) { if (S.menu && !ev.target.closest('.popover')) { S.menu = null; render(); } return; }
    playFuturisticClick();
    const act = el.dataset.act; const d = S.dash;
    try {
      if (act === 'toggle-ghost') {
        S.ghostOpen = !S.ghostOpen;
        render();
        if (S.ghostOpen) {
          setTimeout(() => {
            const sc = document.getElementById('ghost-scroll');
            if (sc) sc.scrollTop = sc.scrollHeight;
            const inp = document.querySelector('.ghost-chat-input');
            if (inp) inp.focus();
          }, 50);
        }
        return;
      }
      else if (act === 'ghost-clear') {
        S.ghostMsgs = [];
        render();
        return;
      }
      else if (act === 'ghost-prompt') {
        const q = el.dataset.q;
        if (q) {
          S.ghostMsgs.push({ from: 'user', text: q });
          render();
          const answer = await answerGhostQuestion(q);
          S.ghostMsgs.push({ from: 'ai', text: answer });
          render();
          const sc = document.getElementById('ghost-scroll');
          if (sc) sc.scrollTop = sc.scrollHeight;
        }
        return;
      }
      else if (act === 'open-cmd') {
        S.cmdPaletteOpen = true;
        render();
        setTimeout(() => {
          const inp = document.getElementById('cmd-palette-input');
          if (inp) inp.focus();
        }, 50);
        return;
      }
      else if (act === 'close-cmd') {
        S.cmdPaletteOpen = false;
        render();
        return;
      }
      else if (act === 'cmd-select') {
        const to = el.dataset.to;
        const chatId = el.dataset.chatId;
        S.cmdPaletteOpen = false;
        if (chatId) {
          location.hash = '#/inbox';
          render();
          setTimeout(() => openChat(chatId), 100);
        } else if (to) {
          location.hash = '#/' + to;
        }
        return;
      }
      else if (act === 'ai-fill') {
        const textToFill = el.dataset.text || '';
        const ta = document.querySelector('.reply-form textarea');
        if (ta) {
          ta.value = textToFill;
          ta.focus();
          ta.style.height = 'auto';
          ta.style.height = (ta.scrollHeight) + 'px';
        }
      }
      else if (act === 'menu') { S.menu = S.menu === el.dataset.menu ? null : el.dataset.menu; render(); }
      else if (act === 'goto') { S.menu = null; location.hash = '#/' + el.dataset.to; }
      else if (act === 'close-mobile-nav') {
        S.mobileNav = false;
        const sh = document.querySelector('.app-shell'); if (sh) sh.classList.remove('mobile-nav-open');
      }
      else if (act === 'm-chat-back') {
        document.body.classList.remove('m-chat-open');
      }
      else if (act === 'toggle-sidebar' && window.matchMedia('(max-width: 860px)').matches) {
        // มือถือ: เมนูเลื่อนออกมาทับหน้า แทนการย่อ/ขยาย
        S.mobileNav = !S.mobileNav;
        const sh = document.querySelector('.app-shell'); if (sh) sh.classList.toggle('mobile-nav-open', S.mobileNav);
      }
      else if (act === 'toggle-sidebar') {
        S.sidebarCollapsed = !S.sidebarCollapsed;
        try { localStorage.setItem('beq_sidebar_collapsed', S.sidebarCollapsed ? '1' : '0'); } catch (_) {}
        const sidebar = document.querySelector('.app-sidebar');
        const shell = document.querySelector('.app-shell');
        if (sidebar && shell) {
          sidebar.classList.toggle('collapsed', S.sidebarCollapsed);
          shell.classList.toggle('sidebar-collapsed', S.sidebarCollapsed);
          const temp = document.createElement('div');
          temp.innerHTML = sidebarHtml();
          sidebar.replaceWith(temp.firstElementChild);
          const toggleBtn = document.querySelector('.header-toggle-btn');
          if (toggleBtn) {
            toggleBtn.title = S.sidebarCollapsed ? 'ขยายเมนูด้านซ้าย' : 'ย่อเมนูด้านซ้าย';
          }
        } else {
          render();
        }
      }
      else if (act === 'logout') {
        await api('/api/logout', { method: 'POST' }).catch(() => {});
        S.me = null;
        S.filters = null;
        S.menu = null;
        S.loginErr = '';
        render();
      }
      else if (act === 'supabase-sync-now') {
        const btn = el;
        const oldText = btn.textContent;
        btn.textContent = 'กำลังดึงข้อมูล...';
        btn.disabled = true;
        try {
          const res = await api('/api/settings/supabase/sync', { method: 'POST' });
          S.flash = { type: 'ok', text: res.message || 'ดึงข้อมูลล่าสุดจาก Supabase สำเร็จแล้ว' };
          // Refresh current view data
          S.filters = await api('/api/filters').catch(() => null);
          if (S.route === 'dashboard') loadDash(true);
          else if (S.route === 'inbox') loadInbox();
          else if (S.route === 'board') loadBoard();
          else render();
        } catch (err) {
          S.flash = { type: 'err', text: err.message || 'ดึงข้อมูลไม่สำเร็จ' };
          render();
        } finally {
          btn.textContent = oldText;
          btn.disabled = false;
        }
      }
      else if (act === 'refresh') loadDash(true);
      else if (act === 'range') { d.range = el.dataset.range; if (d.range === 'custom' && !d.from) { const t = new Date(); d.to = ymd(t); t.setDate(t.getDate() - 29); d.from = ymd(t); } render(); loadDash(); }
      else if (act === 'tab') { d.tab = el.dataset.tab; render(); }
      else if (act === 'reset-filters') { resetFilters(); render(); loadDash(); }
      else if (act === 'table-level') { d.tableLevel = el.dataset.level; d.pageNo = 1; renderTable(); }
      else if (act === 'sort') { const k = el.dataset.key; if (k === 'creative') return; d.dir = d.sort === k && d.dir === 'desc' ? 'asc' : 'desc'; d.sort = k; renderTable(); }
      else if (act === 'page') { d.pageNo += Number(el.dataset.dir); renderTable(); }
      else if (act === 'select-chat') {
        if (S.route === 'inbox') document.body.classList.add('m-chat-open'); // มือถือ: แตะแชทแล้วสลับไปหน้าแชทเต็มจอ
        if (S.chat.id !== el.dataset.id) openChat(el.dataset.id);
      }
      else if (act === 'istatus') { S.inbox.status = el.dataset.status; renderInboxTools(); renderInboxList(); }
      else if (act === 'inbox-folder') { S.inbox.folder = el.dataset.folder; if (el.dataset.folder === 'all') S.inbox.channel = ''; renderInboxTools(); renderInboxList(); }
      else if (act === 'inbox-channel') {
        if (S.inbox.channel && S.inbox.channel.toLowerCase() === (el.dataset.channel || '').toLowerCase()) S.inbox.channel = '';
        else S.inbox.channel = el.dataset.channel;
        renderInboxTools(); renderInboxList();
      }
      else if (act === 'set-ai-mode') { S.aiMode = el.dataset.mode; render(); }
      else if (act === 'takeover-chat') {
        S.chat.takenOver = !S.chat.takenOver;
        S.flash = { type: 'ok', text: S.chat.takenOver ? '⚡ เปิดโหมด Manual Control: พนักงานเข้าควบคุมแชทแล้ว' : '✨ เปิดโหมด BEQ Copilot: ผู้ช่วย AI พร้อมช่วยตอบและวิเคราะห์เคส' };
        renderChatViews();
      }
      else if (act === 'regenerate-summary') {
        const curL = currentLead();
        const origText = el.innerHTML;
        el.disabled = true;
        el.innerHTML = '⏳ กำลังวิเคราะห์...';
        setTimeout(() => {
          // รีเฟรช AI Medical Analysis
          showToast('✨ รีเฟรชและวิเคราะห์ข้อมูลเคสด้วย AI เรียบร้อยแล้ว', 'success');
          renderInboxInfo();
        }, 350);
      }
      else if (act === 'info-tab') {
        S.chat.tab = el.dataset.tab;
        renderInboxInfo();
      }
      else if (act === 'star-chat') {
        const curL = currentLead();
        if (curL) {
          curL.starred = !curL.starred;
          S.flash = { type: 'ok', text: curL.starred ? '⭐ บันทึกเป็นแชทสำคัญแล้ว' : 'ยกเลิกแชทสำคัญแล้ว' };
          renderInboxTools(); renderInboxList(); renderInboxInfo();
        }
      }
      else if (act === 'quick-call') {
        const p = el.dataset.phone;
        if (p) window.open('tel:' + p);
        else { S.flash = { type: 'err', text: 'ไม่พบเบอร์โทรศัพท์ของลูกค้าท่านนี้' }; render(); }
      }
      else if (act === 'copy-chat-link') {
        navigator.clipboard.writeText(location.href);
        S.flash = { type: 'ok', text: '📋 คัดลอกลิงก์แชทแล้ว' };
        render();
      }
      else if (act === 'open-chat') openChat(el.dataset.id);
      else if (act === 'close-chat') closeChat();
      else if (act === 'ftab') { S.followup.tab = el.dataset.tab; renderFollowBody(); }
      else if (act === 'fu-refresh') loadFollowups();
      else if (act === 'mark-all-notifs') {
        await api('/api/notifications/mark-read', { method: 'POST', body: { all: true } });
        await loadWebNotifications();
        render();
      }
      else if (act === 'delete-all-notifs') {
        if (!confirm('ต้องการลบการแจ้งเตือนทั้งหมดใช่หรือไม่?')) return;
        await api('/api/notifications/delete', { method: 'POST', body: { all: true } });
        showToast('🗑️ ลบการแจ้งเตือนทั้งหมดเรียบร้อยแล้ว', 'success');
        await loadWebNotifications();
        render();
      }
      else if (act === 'delete-one-notif') {
        const id = el.dataset.id;
        if (!id) return;
        await api('/api/notifications/delete', { method: 'POST', body: { id } });
        await loadWebNotifications();
        render();
      }
      else if (act === 'fu-open-schedule') {
        try {
          S.notificationSchedule = await api('/api/notifications/schedule');
        } catch (_) {}
        S.scheduleModalOpen = true;
        render();
      }
      else if (act === 'fu-close-schedule') {
        if (ev.target.closest('.modal-card') && !ev.target.closest('button[data-act="fu-close-schedule"]')) return;
        S.scheduleModalOpen = false;
        render();
      }
      else if (act === 'fu-quick-edit') {
        S.quickEditLead = {
          id: el.dataset.id,
          name: el.dataset.name,
          dueDate: el.dataset.due || tomorrow(),
          note: el.dataset.note || '',
          status: el.dataset.status || 'new'
        };
        render();
      }
      else if (act === 'fu-quick-close') {
        S.quickEditLead = null;
        render();
      }
      else if (act === 'fu-quick-set-date') {
        const inp = document.getElementById('fu-quick-due-input');
        if (inp) inp.value = el.dataset.val;
      }
      else if (act === 'fu-quick-done') {
        const id = el.dataset.id;
        try {
          await api('/api/followups/done', { method: 'POST', body: { id } });
          showToast('✅ ปิดงานตามเคสนี้เรียบร้อยแล้ว', 'success');
          S.quickEditLead = null;
          render();
          await loadFollowups();
        } catch (e) {
          showToast('❌ ปิดงานตามไม่สำเร็จ: ' + e.message, 'error');
        }
      }
      else if (act === 'fu-test-sound') {
        playNotificationSound();
        showToast('🔊 ทดสอบเสียงกระดิ่งเตือนเรียบร้อย', 'info');
      }
      else if (act === 'fu-enable-desktop-notif') {
        if ('Notification' in window) {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            triggerDesktopNotification('🎉 เปิดแจ้งเตือนสำเร็จ!', 'ระบบจะแจ้งเตือนเคสตามลูกค้าบนหน้าจอของคุณ');
            showToast('✅ อนุญาตการแจ้งเตือนบนหน้าจอเรียบร้อยแล้ว', 'success');
          } else {
            showToast('⚠️ คุณไม่ได้อนุญาตการแจ้งเตือนในเบราว์เซอร์', 'warning');
          }
        } else {
          showToast('เบราว์เซอร์นี้ไม่รองรับ Desktop Notification', 'warning');
        }
      }
      else if (act === 'fu-test-notify') {
        playNotificationSound();
        triggerDesktopNotification('🔔 ทดสอบระบบแจ้งเตือน', 'ระบบแจ้งเตือนตามลูกค้าพร้อมทำงานแล้ว');
        showToast('🔔 ทดสอบส่งการแจ้งเตือนสำเร็จ!', 'success');
      }
      else if (act === 'import-modal-close') {
        if (ev.target.closest('.modal-card') && !ev.target.closest('button[data-act="import-modal-close"]')) return;
        S.importModal = null;
        render();
      }
      else if (act === 'posts-quick-range') {
        const d = new Date(); const f = new Date(); f.setDate(f.getDate() - parseInt(el.dataset.days || 30, 10));
        const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        const a = document.getElementById('pm-after-date'); const b = document.getElementById('pm-before-date');
        if (a) a.value = ymd(f); if (b) b.value = ymd(d);
      }
      else if (act === 'import-quick-range' && el.dataset.days === 'all') {
        for (const id of ['m-after-date', 'm-before-date', 'pm-after-date', 'pm-before-date']) { const i = document.getElementById(id); if (i) i.value = ''; }
        if (S.importModal) { S.importModal.afterDate = ''; S.importModal.beforeDate = ''; }
      }
      else if (act === 'import-quick-range') {
        const days = parseInt(el.dataset.days || 90, 10);
        const toD = new Date();
        const fromD = new Date();
        fromD.setDate(fromD.getDate() - days);
        const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const afterInput = document.getElementById('m-after-date');
        const beforeInput = document.getElementById('m-before-date');
        if (afterInput) afterInput.value = ymd(fromD);
        if (beforeInput) beforeInput.value = ymd(toD);
        if (S.importModal) {
          S.importModal.afterDate = ymd(fromD);
          S.importModal.beforeDate = ymd(toD);
        }
      }
      else if (act === 'import-modal-submit') {
        const form = document.querySelector('[data-form="do-import-conv"]');
        if (form) {
          const btn = el;
          btn.disabled = true;
          btn.textContent = '⏳ กำลังดึงข้อมูล...';
          const fd = Object.fromEntries(new FormData(form));
          const mode = fd.mode;
          const afterDate = fd.afterDate || '';
          const beforeDate = fd.beforeDate || '';
          const limit = fetchCountValue(fd, 'limit', 500);
          const messagesPerChat = fetchCountValue(fd, 'messagesPerChat', 300);
          const pageId = fd.pageId || null;
          S.importModal = null;
          render();
          (async () => {
            try {
              if (mode === 'all') {
                const r = await api('/api/import/facebook-conversations-all', { method: 'POST', body: { limit, messagesPerChat, afterDate, beforeDate } });
                if (r.ok) {
                  const errText = r.errors && r.errors.length ? (' (⚠️ มีข้อผิดพลาด: ' + r.errors.join('; ') + ')') : '';
                  const dateRange = afterDate && beforeDate ? ` ช่วง ${afterDate} ถึง ${beforeDate}` : '';
                  S.flash = { type: r.errors && r.errors.length && !r.totalImportedLeads ? 'err' : 'ok', text: `ดึงประวัติแชทสำเร็จ${dateRange}! เพิ่มลูกค้าใหม่ ${r.totalImportedLeads} ราย, ${r.totalImportedMsgs} ข้อความ${errText}` };
                  await refreshAfterImport();
                }
              } else {
                const r = await api('/api/import/facebook-conversations', { method: 'POST', body: { pageId, limit, messagesPerChat, afterDate, beforeDate } });
                if (r.ok) {
                  const dateRange = afterDate && beforeDate ? ` ช่วง ${afterDate} ถึง ${beforeDate}` : '';
                  S.flash = { type: r.warning ? 'err' : 'ok', text: `นำเข้าบทสนทนาเพจ ${r.pageName} สำเร็จ${dateRange}: เพิ่มลูกค้าใหม่ ${r.importedLeads} ราย, ${r.importedMsgs} ข้อความ${r.warning ? ' — ⚠️ ' + r.warning : ''}` };
                  await refreshAfterImport();
                }
              }
            } catch (e) {
              S.flash = { type: 'err', text: e.message || 'ดึงแชทไม่สำเร็จ' };
            } finally {
              S.importModal = null;
              render();
            }
          })();
        }
      }
      else if (act === 'fu-notify-one') {
        const id = el.dataset.id;
        const name = el.dataset.name;
        const rep = el.dataset.rep;
        const kind = el.dataset.kind;
        const due = el.dataset.due;
        const reason = kind === 'reply' ? 'ลูกค้ารอคำตอบนาน' : (due ? `นัดหมายติดตามวันที่ ${due}` : 'ถึงเวลาตามต่อ (เงียบ > 24 ชม.)');
        el.disabled = true;
        const orig = el.innerHTML;
        el.innerHTML = '⏳ ส่ง...';
        try {
          const res = await api('/api/notifications/send', {
            method: 'POST',
            body: {
              title: `เตือนติดตามลูกค้า: ${name}`,
              message: `เคส ${name} (${rep || 'ยังไม่ระบุเซลส์'}) - ${reason}`,
              leadId: id,
              leadName: name,
              rep,
              type: 'followup'
            }
          });
          if (res.ok) {
            triggerDesktopNotification(`เตือนติดตามลูกค้า: ${name}`, `เคส ${name} (${rep || 'ยังไม่ระบุเซลส์'}) - ${reason}`);
            showToast(`🔔 ส่งการแจ้งเตือนเคส "${name}" สำเร็จแล้ว!`, 'success');
            await loadWebNotifications();
            render();
          }
        } catch (e) {
          showToast(`❌ ส่งแจ้งเตือนไม่สำเร็จ: ${e.message}`, 'error');
        } finally {
          el.disabled = false;
          el.innerHTML = orig;
        }
      }
      else if (act === 'fu-notify-all') {
        const d = S.followup.data;
        if (!d || !d.rows || !d.rows.length) {
          showToast('ไม่มีรายการลูกค้าที่ต้องตามในขณะนี้', 'warning');
          return;
        }
        const overdueCount = d.rows.filter(r => r.overdue).length;
        const replyCount = d.rows.filter(r => r.kind === 'reply').length;
        const total = d.rows.length;
        el.disabled = true;
        const orig = el.innerHTML;
        el.innerHTML = '⏳ กำลังส่งแจ้งเตือน...';
        try {
          const res = await api('/api/notifications/send', {
            method: 'POST',
            body: {
              title: `เตือนสรุปลูกค้าที่ต้องตามทั้งหมด (${total} เคส)`,
              message: `มีลูกค้าที่ต้องตามรวม ${total} ราย (ลูกค้ารอตอบ ${replyCount} เคส, เกินกำหนด ${overdueCount} เคส) กรุณาเข้าตรวจสอบและทักตามลูกค้า`,
              type: 'followup_all'
            }
          });
          if (res.ok) {
            triggerDesktopNotification(`เตือนสรุปลูกค้าที่ต้องตาม (${total} เคส)`, `ลูกค้ารอตอบ ${replyCount} เคส, เกินกำหนด ${overdueCount} เคส`);
            showToast(`🔔 ส่งการแจ้งเตือนภาพรวมตามลูกค้า ${total} เคส เข้าเว็บสำเร็จแล้ว!`, 'success');
            await loadWebNotifications();
            render();
          }
        } catch (e) {
          showToast(`❌ ส่งแจ้งเตือนไม่สำเร็จ: ${e.message}`, 'error');
        } finally {
          el.disabled = false;
          el.innerHTML = orig;
        }
      }
      else if (act === 'rstate') { S.review.state = el.dataset.state; renderReviewBody(); }
      else if (act === 'audit-more') { S.audit.limit += 100; loadAudit(); }
      else if (act === 'fu-done') {
        await api('/api/followups/done', { method: 'POST', body: { id: S.chat.id } });
        if (S.chat.data) S.chat.data.followup = { ...(S.chat.data.followup || {}), done: true };
        S.chat.msg = { type: 'ok', text: 'ปิดงานตามแล้ว' }; renderChatViews(); if (S.route === 'followup') loadFollowups();
      }
      else if (act === 'board-jump') {
        scrollToCol(el.dataset.status);
      }
      else if (act === 'board-scroll-left') {
        scrollBoard(-1);
      }
      else if (act === 'board-scroll-right') {
        scrollBoard(1);
      }
      else if (act === 'lrange') {
        const s = S[el.dataset.scope]; s.range = el.dataset.range;
        if (s.range === 'custom' && !s.from) { const t = new Date(); s.to = ymd(t); t.setDate(t.getDate() - 29); s.from = ymd(t); }
        render(); loadList(el.dataset.scope);
      }
      else if (act === 'sla-rep') { const id = el.dataset.rep; S.sla.open = S.sla.open === id ? '' : id; S.sla.kind = ''; renderSlaBody(); }
      else if (act === 'sla-kind') { S.sla.kind = el.dataset.kind; renderSlaBody(); }
      else if (act === 'line-acc-new') { S.lineNew = true; renderSettingBody(); }
      else if (act === 'wa-acc-new') { S.waNew = true; renderSettingBody(); }
      else if (act === 'line-acc-delete' || act === 'wa-acc-delete') {
        const isLine = act === 'line-acc-delete';
        if (!confirm(`ลบ${isLine ? ' LINE OA' : 'เบอร์ WhatsApp'} "${el.dataset.name || el.dataset.id}" ออกจากระบบ?\n\nแชทเดิมยังอยู่ แต่จะไม่รับแชทใหม่และตอบกลับจากบัญชีนี้ไม่ได้`)) return;
        try {
          const r = await api(isLine ? '/api/settings/line/delete' : '/api/settings/whatsapp/delete', { method: 'POST', body: { id: el.dataset.id } });
          S.settings = { ...r, lineNotify: (S.settings && S.settings.lineNotify) || {} };
          showToast('ลบบัญชีแล้ว', 'success');
        } catch (e) { showToast(e.message, 'error'); }
        renderSettingBody();
        return;
      }
      else if (act === 'sla-page') { S.sla.page = el.dataset.page || ''; S.sla.open = ''; renderSlaBody(); }
      else if (act === 'sla-open') {
        // ไปหน้า Inbox แล้วเปิดแชทนั้น: ใช้ช่วงวันเดียวกับ Board ถ้าลีดเริ่มคุยก่อนช่วงนั้นให้ขยายช่วงให้ครอบคลุม
        const rg = (S.sla.data && S.sla.data.range) || { from: '', to: '' }; const b = S.board;
        Object.assign(S.inbox, { search: '', channel: '', status: '', focus: el.dataset.id });
        if (el.dataset.date && rg.from && el.dataset.date < rg.from) Object.assign(S.inbox, { range: 'custom', from: el.dataset.date, to: rg.to });
        else Object.assign(S.inbox, { range: b.range, from: b.from, to: b.to });
        location.hash = '#/inbox';
      }
      else if (act === 'user-copy') {
        const r = S.users.result; if (!r) return;
        await navigator.clipboard.writeText(r.added.map((a) => `${a.username}\t${a.password}`).join('\n'));
        el.textContent = 'คัดลอกแล้ว ✓';
      }
      else if (act === 'user-reset') {
        const name = el.dataset.user;
        const pw = prompt(`ตั้งรหัสผ่านชั่วคราวใหม่ให้ "${name}" (อย่างน้อย 8 ตัว)\nผู้ใช้จะถูกออกจากระบบและต้องเปลี่ยนรหัสเองตอนล็อกอินครั้งถัดไป`, genPassword());
        if (pw === null) return;
        await api('/api/users/reset', { method: 'POST', body: { username: name, password: pw } });
        S.flash = { type: 'ok', text: `รีเซ็ตรหัสผ่านของ ${name} แล้ว รหัสชั่วคราว: ${pw}` };
        await loadUsers();
      }
      else if (act === 'refresh-names') {
        el.disabled = true;
        el.textContent = '⏳ กำลังดึงชื่อ...';
        try {
          const r = await api('/api/leads/refresh-names', { method: 'POST' });
          if (r.ok) {
            S.flash = { type: 'ok', text: `อัปเดตชื่อลูกค้าสำเร็จ ${r.updated} รายชื่อ (จาก ${r.total} แชท)` };
            await loadInbox();
          }
        } catch (e) {
          S.flash = { type: 'err', text: e.message || 'ไม่สามารถอัปเดตชื่อได้' };
          render();
        } finally {
          el.disabled = false;
          el.textContent = '🔄 ดึง/อัปเดตชื่อลูกค้าจาก Facebook';
        }
      }
      else if (act === 'page-edit') {
        try {
          const p = JSON.parse(el.dataset.page);
          document.getElementById('p-name').value = p.name || '';
          document.getElementById('p-id').value = p.id || '';
          document.getElementById('p-adAccountId').value = p.adAccountId || '';
          const fbInput = document.getElementById('p-fbPageId');
          if (fbInput) fbInput.value = p.fbPageId || '';
          document.getElementById('p-platform').value = p.platform || 'Facebook';
          document.getElementById('page-edit-heading').textContent = `✏️ กำลังแก้ไขเพจ: ${p.name}`;
          document.getElementById('p-cancel-btn').style.display = 'inline-block';
          document.getElementById('page-edit-form').scrollIntoView({ behavior: 'smooth' });
        } catch (_) {}
      }
      else if (act === 'page-edit-cancel') {
        const f = document.getElementById('page-edit-form');
        if (f) f.reset();
        const h = document.getElementById('page-edit-heading');
        if (h) h.textContent = '➕ เพิ่มหรือแก้ไขข้อมูลเพจ';
        el.style.display = 'none';
      }
      else if (act === 'select-input') {
        if (typeof el.select === 'function') el.select();
      }
      else if (act === 'open-ad-media') {
        if (ev.target && ev.target.closest && ev.target.closest('.ad-media-upload-mini')) return;
        try {
          const r = JSON.parse(el.dataset.adMedia);
          openAdMediaModal(r);
        } catch (err) {
          console.error('open-ad-media error:', err);
        }
      }
      else if (act === 'close-ad-media') {
        closeAdMediaModal();
      }
      else if (act === 'prompt-ad-url') {
        const adId = el.dataset.adId;
        const adName = el.dataset.adName;
        const rawUrl = prompt(`วางลิงก์รูปภาพ (JPG/PNG/WebP) หรือลิงก์วิดีโอ (MP4/WebM) สำหรับโฆษณา:\n"${adName || adId}"`, 'https://');
        if (rawUrl && rawUrl.trim() && rawUrl.trim() !== 'https://') {
          await saveAdMediaUrl(adId, adName, rawUrl.trim());
        }
      }
      else if (act === 'line-notify-test') {
        el.disabled = true;
        const orig = el.textContent;
        el.textContent = '⏳ กำลังส่งทดสอบ...';
        try {
          const r = await api('/api/notifications/test-line', { method: 'POST' });
          if (r && r.ok) {
            S.flash = { type: 'ok', text: '✅ ส่งข้อความทดสอบเข้า LINE สำเร็จแล้ว!' };
          } else {
            S.flash = { type: 'err', text: '❌ ส่งทดสอบไม่สำเร็จ: ' + ((r && r.error) || 'กรุณาเปิดใช้งานและบันทึก Token / Webhook URL ก่อนกดทดสอบ') };
          }
          render();
        } catch (e) {
          S.flash = { type: 'err', text: '❌ ข้อผิดพลาด: ' + (e.message || 'ส่งแจ้งเตือน LINE ไม่สำเร็จ') };
          render();
        } finally {
          el.disabled = false;
          el.textContent = orig;
        }
      }
      else if (act === 'meta-sync-all') {
        el.disabled = true;
        const orig = el.textContent;
        el.textContent = '⏳ กำลังซิงค์ข้อมูล Meta ทั้งหมด...';
        try {
          const r = await api('/api/meta/sync-all', { method: 'POST' });
          if (r && r.ok) {
            S.settings = r.settings;
            S.me.mode = 'meta';
            S.filters = await api('/api/filters').catch(() => null);
            S.dash.data = null;
            S.flash = {
              type: 'ok',
              text: `🚀 ซิงค์ข้อมูลจาก Meta สำเร็จครบวงจร! บัญชี: ${r.accountName} · แคมเปญ: ${r.campaignsCount} แคมเปญ · โฆษณา (พร้อมรูป/วิดีโอ): ${r.adsCount} รายการ · เพจ: ${r.pagesCount} เพจ`
            };
            render();
          }
        } catch (e) {
          S.flash = { type: 'err', text: '❌ ซิงค์ข้อมูล Meta ไม่สำเร็จ: ' + (e.message || 'ตรวจสอบ Access Token และสิทธิ์ ads_read, pages_show_list') };
          render();
        } finally {
          el.disabled = false;
          el.textContent = orig;
        }
      }
      else if (act === 'ig-diag-close') { S.igDiag = null; render(); }
      else if (act === 'meta-subscribe-webhooks') {
        if (!confirm('ตั้งค่าให้ Meta ส่งแชท Messenger และ Instagram ใหม่เข้าระบบอัตโนมัติ?\n\nระบบจะตั้ง Webhook ที่แอป Meta (ต้องบันทึก App ID + App Secret) และเปิดรับข้อความของทุกเพจที่ Token เข้าถึงได้')) return;
        el.disabled = true; const orig = el.textContent; el.textContent = '⏳ กำลังตั้งค่า...';
        try {
          const r = await api('/api/settings/meta/subscribe-webhooks', { method: 'POST' });
          const appTxt = (r.app || []).map((a) => `${a.object === 'instagram' ? 'Instagram' : a.object === 'page' ? 'Messenger' : 'แอป'} ${a.ok ? '✅' : '❌ ' + (a.error || '')}`).join(' · ');
          const pageOk = (r.pages || []).filter((p) => p.ok).length;
          const pageBad = (r.pages || []).filter((p) => !p.ok).map((p) => `${p.pageName}: ${p.error}`);
          S.flash = { type: pageBad.length || (r.app || []).some((a) => !a.ok) ? 'err' : 'ok', text: `🔔 Webhook ${r.callbackUrl} — ${appTxt} · เพจที่เปิดรับแชทแล้ว ${pageOk}/${(r.pages || []).length}${pageBad.length ? ' (❌ ' + pageBad.join('; ') + ')' : ''}` };
        } catch (e) {
          S.flash = { type: 'err', text: '❌ ตั้งค่า Webhook ไม่สำเร็จ: ' + e.message };
        } finally { el.disabled = false; el.textContent = orig; render(); }
      }
      else if (act === 'ig-test') {
        el.disabled = true;
        const orig = el.textContent;
        el.textContent = '⏳ กำลังตรวจสอบ IG...';
        try {
          const r = await api('/api/settings/instagram/test', { method: 'POST' });
          if (r && r.ok) {
            S.igDiag = r;
            S.filters = await api('/api/filters').catch(() => null);
            const igList = r.igAccounts || [];
            const unlinked = r.unlinkedFbPages || [];
            if (!igList.length) {
              S.flash = {
                type: 'err',
                text: `⚠️ พบเพจ Facebook ${r.totalFbPages} เพจ แต่ยังไม่พบบัญชี Instagram Business ที่ผูกกับเพจเหล่านั้น (ต้องผูกบัญชี IG Professional เข้ากับ Facebook Page ในการตั้งค่าเพจ และให้สิทธิ์ instagram_basic, instagram_manage_messages ตอนสร้าง Token)`
              };
            } else {
              const details = igList.map((ig) => `@${ig.username} (ผูกเพจ ${ig.fbPageName}: โพสต์/รูป ${ig.mediaOk ? '✅' : '❌'}, แชท IG Direct ${ig.messagingOk ? '✅' : '⚠️ ' + (ig.messagingError || 'ต้องเปิด Allow access to messages ในแอป IG')})`).join(' | ');
              const unlinkedTxt = unlinked.length ? ` · เพจที่ยังไม่ผูก IG: ${unlinked.map((u) => u.fbPageName).join(', ')}` : '';
              const hasProblem = igList.some((ig) => (ig.problems || []).length) || ((r.token || {}).missingScopes || []).length;
              S.flash = { type: hasProblem ? 'err' : 'ok', text: hasProblem ? `📸 พบ Instagram ${igList.length} บัญชี แต่ยังมีจุดที่ต้องแก้ — ดูรายละเอียดในกล่อง "ผลตรวจ Instagram"` : `📸 ตรวจพบ Instagram Business ${igList.length} บัญชี: ${details}${unlinkedTxt}` };
            }
          } else {
            S.flash = { type: 'err', text: '❌ ตรวจสอบ Instagram ไม่สำเร็จ: ' + ((r && r.error) || 'ตรวจสอบ Access Token') };
          }
          render();
        } catch (e) {
          S.flash = { type: 'err', text: '❌ ตรวจสอบ Instagram ไม่สำเร็จ: ' + (e.message || 'ตรวจสอบ Access Token') };
          render();
        } finally {
          el.disabled = false;
          el.textContent = orig;
        }
      }
      else if (act === 'meta-discover') {
        el.disabled = true;
        const originalText = el.textContent;
        el.textContent = '⏳ กำลังค้นหาเพจ...';
        try {
          const r = await api('/api/meta/discover-pages', { method: 'POST' });
          if (r.ok) {
            S.flash = { type: 'ok', text: `ซิงค์เพจจาก Meta สำเร็จ: พบ ${r.totalFound} เพจ (เพิ่มใหม่ ${r.added} เพจ, อัปเดต ${r.updated} เพจ)` };
            S.filters = await api('/api/filters').catch(() => null);
            await loadSettings();
          }
        } catch (e) {
          S.flash = { type: 'err', text: e.message || 'ไม่สามารถดึงเพจได้ ตรวจสอบว่าใส่ Token หรือมีสิทธิ์ pages_show_list' };
          render();
        } finally {
          el.disabled = false;
          el.textContent = originalText;
        }
      }
      else if (act === 'fb-import-all') {
        S.importModal = { mode: 'all', afterDate: '', beforeDate: '' };
        render();
        return;
      }
      else if (act === 'fb-import-conv') {
        S.importModal = { mode: 'one', pageId: el.dataset.pageId, pageName: el.dataset.pageName, platform: el.dataset.platform || 'Facebook', afterDate: '', beforeDate: '' };
        render();
        return;
      }
      else if (act === 'page-delete') {
        const pageId = el.dataset.pageId;
        if (!confirm('ยืนยันลบเพจนี้ออกจากระบบ? (ข้อมูลแชทเดิมจะไม่ถูกลบ)')) return;
        const r = await api('/api/settings/pages/delete', { method: 'POST', body: { id: pageId } });
        if (r.ok) {
          S.flash = { type: 'ok', text: 'ลบเพจเรียบร้อยแล้ว' };
          S.filters = await api('/api/filters').catch(() => null);
          render();
        }
      }
      else if (act === 'user-delete') {
        const name = el.dataset.user;
        if (!confirm(`ลบผู้ใช้ "${name}" ? (ลบแล้วกู้คืนไม่ได้ และจะถูกออกจากระบบทันที)`)) return;
        const r = await api('/api/users/delete', { method: 'POST', body: { username: name } });
        S.users.data = r.users; S.flash = { type: 'ok', text: `ลบผู้ใช้ ${name} แล้ว` }; renderSettingBody();
      }
      else if (act === 'mode') { S.settings = await api('/api/settings/mode', { method: 'POST', body: { mode: el.dataset.mode } }); S.me.mode = S.settings.mode; S.filters = null; S.flash = { type: 'ok', text: 'เปลี่ยนแหล่งข้อมูลแล้ว' }; render(); }
      else if (act === 'disconnect') {
        if (!confirm('ตัดการเชื่อมต่อ Meta และลบ token ที่บันทึกไว้?')) return;
        S.settings = await api('/api/settings/meta/disconnect', { method: 'POST' }); S.me.mode = 'demo'; S.filters = null; S.flash = { type: 'ok', text: 'ตัดการเชื่อมต่อแล้ว กลับไปใช้ข้อมูลเดโม' }; render();
      } else if (act === 'extend') {
        const r = await api('/api/settings/meta/extend', { method: 'POST' });
        S.flash = r.ok ? { type: 'ok', text: 'แลกเป็น token อายุยาวสำเร็จ' } : { type: 'err', text: r.error }; if (r.ok) S.settings = r.settings; render();
      }
      /* ── upload page ── */
      else if (act === 'sync-comments-api') {
        S.postsModal = { pageId: null, pageName: '' };
        render();
        return;
      }
      else if (act === 'c-filter') {
        if (!S.comments) S.comments = { data: null, loading: false, err: null, range: '30d', from: '', to: '', filterStatus: 'all' };
        S.comments.filterStatus = el.dataset.val || 'all';
        renderCommentsBody();
      }
      else if (act === 'upload-confirm') { await doUploadData(); }
      else if (act === 'upload-cancel' || act === 'upload-reset') { S.upload.rows = []; S.upload.result = null; S.upload.err = null; await loadUpload(); }
      else if (act === 'upload-tab') { S.upload.tab = el.dataset.tab; S.upload.rows = []; S.upload.result = null; S.upload.err = null; renderUploadBody(); }
      else if (act === 'meta-posts-sync-all' || act === 'sync-page-posts') {
        S.postsModal = { pageId: el.dataset.pageId || null, pageName: el.dataset.pageName || '', platform: el.dataset.platform || 'Facebook' };
        render();
        return;
      }
      else if (act === 'posts-modal-close') {
        if (ev.target.closest('.modal-card') && !ev.target.closest('button[data-act="posts-modal-close"]')) return;
        S.postsModal = null;
        render();
      }
      else if (act === 'posts-modal-submit') {
        const form = document.querySelector('[data-form="do-posts-sync"]');
        if (!form) return;
        const fd = Object.fromEntries(new FormData(form));
        const pageId = fd.pageId || null;
        const body = {
          ...(pageId ? { pageId } : {}),
          limit: fetchCountValue(fd, 'limit', 300),
          commentsPerPost: fetchCountValue(fd, 'commentsPerPost', 500),
          afterDate: fd.afterDate || '',
          beforeDate: fd.beforeDate || '',
        };
        S.postsModal = null;
        render();
        try {
          const res = await api('/api/posts-comments/sync', { method: 'POST', body });
          const errText = res.errors && res.errors.length ? ' (⚠️ ' + res.errors.join('; ') + ')' : '';
          S.flash = { type: 'ok', text: 'ดึง Post & comment สำเร็จแล้ว (' + (res.count || 0) + ' โพสต์)' + errText };
          if (S.route === 'post-comment' || S.route === 'comments') await loadComments();
        } catch (e) {
          S.flash = { type: 'err', text: e.message || 'ดึง Post & comment ไม่สำเร็จ' };
        } finally {
          render();
        }
      }
      else if (act === 'clear-data') {
        const target = el.dataset.target;
        const labels = { leads: 'Leads ทั้งหมด', campaigns: 'ข้อมูลแคมเปญ Ads ทั้งหมด', all: 'ข้อมูลทั้งหมดในระบบ (Leads + Ads)' };
        if (!confirm(`⚠️ ยืนยันการลบ: ${labels[target] || target}\nการลบนี้ไม่สามารถกู้คืนได้ ต้องการดำเนินการต่อไปไหม?`)) return;
        await api('/api/data/clear', { method: 'POST', body: { target } });
        S.flash = { type: 'ok', text: `ลบ ${labels[target]} เรียบร้อยแล้ว` };
        S.upload.summary = await api('/api/data/summary').catch(() => null);
        S.dash.data = null;
        await loadUpload();
      }
      /* ── quality page ── */
      else if (act === 'quality-reload') { S.dash.data = null; await loadQuality(); }
      else if (act === 'q-sort') { const k = el.dataset.key; S.quality.sortDir = S.quality.sort === k && S.quality.sortDir === 'desc' ? 'asc' : 'desc'; S.quality.sort = k; renderQualityBody(); }
      else if (act === 'q-clear-filters') { S.quality.campaign = ''; S.quality.minQuality = ''; renderQualityBody(); }
    } catch (e) { if (e.message !== 'กรุณาเข้าสู่ระบบ') { S.flash = { type: 'err', text: e.message }; render(); } }
  });

  document.addEventListener('change', async (ev) => {
    if (ev.target.dataset && (ev.target.dataset.act === 'ad-img-file' || ev.target.dataset.act === 'dash-ad-img')) {
      const file = ev.target.files && ev.target.files[0];
      if (file) uploadAdImage(ev.target.dataset.adId, ev.target.dataset.adName, file);
      return;
    }
    if (ev.target.id === 'upload-platform-input') {
      S.upload.platform = ev.target.value;
      if (S.upload.rows && S.upload.rows.length) renderUploadBody();
      return;
    }
    if (ev.target.id === 'upload-page-input') {
      S.upload.pageName = ev.target.value.trim();
      if (S.upload.rows && S.upload.rows.length) renderUploadBody();
      return;
    }
    const b = ev.target.dataset && ev.target.dataset.bind; if (!b) return;
    const d = S.dash;
    if (b === 'lfrom' || b === 'lto') {
      const sc = ev.target.dataset.scope; const s = S[sc];
      s[b === 'lfrom' ? 'from' : 'to'] = ev.target.value;
      if (s.from && s.to && s.from <= s.to) loadList(sc);
      return;
    }
    if (b === 'lead-status') { changeStatus(ev.target.value); return; }
    if (b === 'rep-select') {
      const repVal = ev.target.value;
      const leadId = ev.target.dataset.id || (currentLead() && currentLead().id);
      if (leadId) {
        try {
          await api('/api/lead/rep', { method: 'POST', body: { id: leadId, rep: repVal } });
          const cur = currentLead();
          if (cur) { cur.rep = repVal; cur.repId = repVal; }
          const row = (S.inbox?.data?.rows || []).find(r => r.id === leadId);
          if (row) { row.rep = repVal; row.repId = repVal; }
          showToast(`👤 มอบหมายเคสให้: ${repVal || 'ยังไม่ระบุ'}`);
          renderInboxChat();
          renderInboxInfo();
          renderInboxList();
        } catch (err) {
          showToast(err.message || 'มอบหมายไม่สำเร็จ', 'error');
        }
      }
      return;
    }
    if (b === 'frep') { S.followup.rep = ev.target.value; loadFollowups(); return; }
    if (b === 'rrep') { S.review.rep = ev.target.value; renderReviewBody(); return; }
    if (b === 'aaction') { S.audit.action = ev.target.value; S.audit.limit = 100; loadAudit(); return; }
    if (b === 'afrom' || b === 'ato') { S.audit[b === 'afrom' ? 'from' : 'to'] = ev.target.value; S.audit.limit = 100; loadAudit(); return; }
    if (b === 'ichannel') { S.inbox.channel = ev.target.value; renderInboxTools(); renderInboxList(); return; }
    if (b === 'istatus-sel') { S.inbox.status = ev.target.value; renderInboxTools(); renderInboxList(); return; }
    if (b === 'header-platform') {
      d.platform = ev.target.value;
      d.page = '';
      if (S.route === 'dashboard') { render(); loadDash(); }
      else if (S.route === 'board') { render(); loadBoard(); }
      else if (S.route === 'inbox') { render(); loadInbox(); }
      else if (S.route === 'post-comment') { render(); loadComments(); }
      else if (S.route === 'review') { render(); loadReview(); }
      else if (S.route === 'followup') { render(); loadFollowups(); }
      else if (S.route === 'quality') { render(); loadQuality(); }
      else render();
      return;
    }
    if (b === 'header-page') {
      d.page = ev.target.value;
      if (S.route === 'dashboard') { render(); loadDash(); }
      else if (S.route === 'board') { render(); loadBoard(); }
      else if (S.route === 'inbox') { render(); loadInbox(); }
      else if (S.route === 'post-comment') { render(); loadComments(); }
      else if (S.route === 'review') { render(); loadReview(); }
      else if (S.route === 'followup') { render(); loadFollowups(); }
      else if (S.route === 'quality') { render(); loadQuality(); }
      else render();
      return;
    }
    if (b === 'branch-select') {
      S.branch = ev.target.value;
      S.flash = { type: 'ok', text: `🏥 เลือกสาขา: ${ev.target.value}` };
      render();
      return;
    }
    if (b === 'platform') {
      d.platform = ev.target.value;
      d.page = '';
      render();
      loadDash();
      return;
    }
    if (['page', 'campaign', 'agency', 'rep', 'status'].includes(b)) { d[b] = ev.target.value; render(); loadDash(); }
    if (b === 'from' || b === 'to') { d[b] = ev.target.value; if (d.from && d.to && d.from <= d.to) loadDash(); }
    /* quality filters */
    if (b === 'q-campaign') { S.quality.campaign = ev.target.value; renderQualityBody(); return; }
    if (b === 'q-quality') { S.quality.minQuality = ev.target.value; renderQualityBody(); return; }
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.dataset && ev.target.dataset.bind === 'cmd-search') {
      S.cmdSearch = ev.target.value;
      const palette = document.querySelector('.cmd-results');
      if (palette) {
        const dummy = document.createElement('div');
        dummy.innerHTML = commandPaletteHtml();
        const newResults = dummy.querySelector('.cmd-results');
        if (newResults) palette.innerHTML = newResults.innerHTML;
      }
      return;
    }
    if (ev.target.dataset && ev.target.dataset.bind === 'search') { S.dash.search = ev.target.value; S.dash.pageNo = 1; renderTable(); }
    if (ev.target.dataset && ev.target.dataset.bind === 'asearch') {
      S.audit.q = ev.target.value; S.audit.limit = 100; clearTimeout(S.audit.t); S.audit.t = setTimeout(loadAudit, 300);
    }
    if (ev.target.dataset && ev.target.dataset.bind === 'isearch') { S.inbox.search = ev.target.value; renderInboxList(); }
  });

  document.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('[data-form]'); if (!form) return;
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    const type = form.dataset.form;
    try {
      if (type === 'ghost-send') {
        const inp = form.querySelector('.ghost-chat-input');
        const q = inp ? inp.value.trim() : '';
        if (q) {
          inp.value = '';
          S.ghostMsgs.push({ from: 'user', text: q });
          render();
          const answer = await answerGhostQuestion(q);
          S.ghostMsgs.push({ from: 'ai', text: answer });
          render();
          const sc = document.getElementById('ghost-scroll');
          if (sc) sc.scrollTop = sc.scrollHeight;
        }
        return;
      }
      else if (type === 'login') {
        await api('/api/login', { method: 'POST', body: { username: fd.username, password: fd.password } });
        S.loginErr = ''; S.me = await api('/api/me'); S.route = routeFromHash(); enterRoute();
      } else if (type === 'fu-save-schedule') {
        const enabled = Boolean(form.querySelector('[name="enabled"]')?.checked);
        const intervalMinutes = parseInt(fd.intervalMinutes || 60, 10);
        const target = fd.target || 'all';
        if (enabled && 'Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        const res = await api('/api/notifications/schedule', {
          method: 'POST',
          body: { enabled, intervalMinutes, target }
        });
        S.notificationSchedule = res.schedule;
        S.scheduleModalOpen = false;
        playNotificationSound();
        showToast(enabled ? `⏰ เปิดระบบแจ้งเตือนอัตโนมัติทุก ${intervalMinutes >= 60 ? (intervalMinutes / 60) + ' ชม.' : intervalMinutes + ' นาที'} เรียบร้อยแล้ว` : '⏸️ ปิดระบบแจ้งเตือนอัตโนมัติแล้ว', 'success');
        render();
        return;
      } else if (type === 'fu-quick-save') {
        const id = fd.id;
        const dueDate = fd.dueDate;
        const note = fd.note || '';
        const status = fd.status;
        try {
          await api('/api/followups', { method: 'POST', body: { id, dueDate, note } });
          if (status) {
            await api('/api/lead/status', { method: 'POST', body: { id, status } }).catch(() => {});
          }
          playNotificationSound();
          showToast('💾 บันทึกการแก้ไขนัดตามลูกค้าเรียบร้อยแล้ว', 'success');
          S.quickEditLead = null;
          render();
          await loadFollowups();
        } catch (e) {
          showToast('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error');
        }
        return;
      } else if (type === 'do-posts-sync') {
        const btn = form.querySelector('[data-act="posts-modal-submit"]');
        if (btn) btn.click();
        return;
      } else if (type === 'do-import-conv') {
        // Modal form submit: ดึงแชทพร้อม date range
        const mode = fd.mode; // 'one' | 'all'
        const afterDate = fd.afterDate || '';
        const beforeDate = fd.beforeDate || '';
        const limit = fetchCountValue(fd, 'limit', 500);
        const messagesPerChat = fetchCountValue(fd, 'messagesPerChat', 300);
        const pageId = fd.pageId || null;
        S.importModal = null;
        render();

        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ กำลังดึงข้อมูล...'; }

        try {
          if (mode === 'all') {
            const r = await api('/api/import/facebook-conversations-all', { method: 'POST', body: { limit, messagesPerChat, afterDate, beforeDate } });
            if (r.ok) {
              const errText = r.errors && r.errors.length ? (' (⚠️ มีข้อผิดพลาด: ' + r.errors.join('; ') + ')') : '';
              const dateRange = afterDate && beforeDate ? ` ช่วง ${afterDate} ถึง ${beforeDate}` : '';
              S.flash = { type: r.errors && r.errors.length && !r.totalImportedLeads ? 'err' : 'ok', text: `ดึงประวัติแชทสำเร็จ${dateRange}! เพิ่มลูกค้าใหม่ ${r.totalImportedLeads} ราย, ${r.totalImportedMsgs} ข้อความ${errText}` };
              await refreshAfterImport();
            }
          } else {
            const r = await api('/api/import/facebook-conversations', { method: 'POST', body: { pageId, limit, messagesPerChat, afterDate, beforeDate } });
            if (r.ok) {
              const dateRange = afterDate && beforeDate ? ` ช่วง ${afterDate} ถึง ${beforeDate}` : '';
              S.flash = { type: 'ok', text: `นำเข้าบทสนทนาเพจ ${r.pageName} สำเร็จ${dateRange}: เพิ่มลูกค้าใหม่ ${r.importedLeads} ราย, ${r.importedMsgs} ข้อความ` };
              await refreshAfterImport();
            }
          }
        } catch (e) {
          S.flash = { type: 'err', text: e.message || 'ดึงแชทไม่สำเร็จ' };
        } finally {
          S.importModal = null;
          render();
        }
        return;
      } else if (type === 'meta') {
        const after = (ev.submitter && ev.submitter.dataset.after) || 'save';
        S.settings = await api('/api/settings/meta', { method: 'PUT', body: fd });
        if (after === 'test') {
          try {
            const r = await api('/api/settings/meta/test', { method: 'POST' });
            if (r.ok) {
              S.settings = r.settings;
              S.flash = { type: 'ok', text: `✅ เชื่อมต่อสำเร็จ: ${r.account.name} (${r.account.currency || 'THB'}). กด “ใช้ข้อมูล Meta API” ที่กล่องด้านบนเพื่อแสดงยอดจริง` };
            } else {
              S.flash = { type: 'err', text: '❌ เชื่อมต่อไม่สำเร็จ: ' + (r.error || 'ตรวจสอบ Access Token และ Ad Account ID') };
            }
          } catch (err) {
            S.flash = { type: 'err', text: '❌ ข้อผิดพลาด: ' + (err.message || 'ไม่สามารถทดสอบได้') };
          }
        } else {
          S.flash = { type: 'ok', text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' };
        }
        S.me = await api('/api/me');
        render();
      } else if (type === 'sheets-sync') {
        const btn = document.getElementById('btn-sync-sheets');
        if (btn) { btn.disabled = true; btn.textContent = 'กำลังดึงข้อมูลจาก Google Sheet…'; }
        try {
          const r = await api('/api/upload/sheets-sync', { method: 'POST', body: { sheetUrl: fd.sheetUrl } });
          const rows = parseCsv(r.csvText);
          if (!rows.length) throw new Error('ไม่พบข้อมูลใน Google Sheet นี้ — ตรวจสอบหัวตารางและลองใหม่');
          S.upload.rows = rows;
          S.upload.err = null;
          S.upload.result = null;
          S.flash = { type: 'ok', text: `ดึงข้อมูลจาก Google Sheet สำเร็จแล้ว (${rows.length} แถว) ตรวจสอบและกดยืนยันนำเข้าด้านล่าง` };
          renderUploadBody();
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = '📥 ซิงค์จาก Google Sheet ทันที'; }
        }
      } else if (type === 'sheets-settings') {
        const after = (ev.submitter && ev.submitter.dataset.after) || 'save';
        const saved = await api('/api/settings/sheets', { method: 'PUT', body: fd });
        S.settings = { ...saved, lineNotify: (S.settings && S.settings.lineNotify) || {} };
        if (after === 'sync' && fd.sheetUrl) {
          const r = await api('/api/upload/sheets-sync', { method: 'POST', body: { sheetUrl: fd.sheetUrl } });
          const rows = parseCsv(r.csvText);
          if (!rows.length) throw new Error('ไม่พบข้อมูลใน Google Sheet นี้ — ตรวจสอบหัวตารางและลองใหม่');
          const endpoint = S.upload.detectedType === 'campaigns' ? '/api/upload/campaigns' : '/api/upload/leads';
          const imp = await api(endpoint, { method: 'POST', body: { rows, replace: false, platform: 'Facebook', pageName: 'Google Sheets Sync' } });
          S.filters = null;
          S.dash.data = null;
          S.flash = { type: 'ok', text: `✅ บันทึกและซิงค์ข้อมูลจาก Google Sheet สำเร็จแล้ว (${imp.added || rows.length} แถว)!` };
        } else {
          S.flash = { type: 'ok', text: 'บันทึกการตั้งค่า Google Sheets เรียบร้อยแล้ว' };
        }
        render();
      } else if (type === 'supabase-settings') {
        const after = (ev.submitter && ev.submitter.dataset.after) || 'save';
        const saved = await api('/api/settings/supabase', { method: 'PUT', body: fd });
        S.settings = { ...saved, lineNotify: (S.settings && S.settings.lineNotify) || {} };
        if (after === 'sync') {
          const r = await api('/api/settings/supabase/sync', { method: 'POST' });
          S.filters = await api('/api/filters').catch(() => null);
          S.dash.data = null;
          S.flash = { type: 'ok', text: `✅ ${r.message || 'เชื่อมต่อและซิงค์ข้อมูลจาก Supabase สำเร็จแล้ว'}` };
        } else {
          S.flash = { type: 'ok', text: 'บันทึกการตั้งค่า Supabase Cloud เรียบร้อยแล้ว' };
        }
        render();
      } else if (type === 'line-notify-settings') {
        const payload = {
          enabled: Boolean(form.querySelector('[name="enabled"]')?.checked),
          token: fd.token || '',
          webhookUrl: fd.webhookUrl || '',
          notifyOnStatusChange: Boolean(form.querySelector('[name="notifyOnStatusChange"]')?.checked),
          notifyOnOverdue: Boolean(form.querySelector('[name="notifyOnOverdue"]')?.checked),
          notifyOnNewReply: Boolean(form.querySelector('[name="notifyOnNewReply"]')?.checked),
          notifyOnChase: Boolean(form.querySelector('[name="notifyOnChase"]')?.checked),
        };
        const r = await api('/api/settings/line-notify', { method: 'POST', body: payload });
        if (S.settings) S.settings.lineNotify = r.config || payload;
        S.flash = { type: 'ok', text: '✅ บันทึกการตั้งค่าแจ้งเตือน LINE เรียบร้อยแล้ว' };
        render();
      } else if (type === 'line-settings') {
        const after = (ev.submitter && ev.submitter.dataset.after) || 'save';
        const saved = await api('/api/settings/line', { method: 'PUT', body: fd });
        S.settings = { ...saved, lineNotify: (S.settings && S.settings.lineNotify) || {} };
        S.lineNew = false;
        S.filters = await api('/api/filters').catch(() => S.filters);
        if (after === 'test') {
          const r = await api('/api/settings/line/test', { method: 'POST', body: { id: saved.savedId } });
          if (r.ok) {
            S.settings = { ...r.settings, lineNotify: (S.settings && S.settings.lineNotify) || {} };
            S.filters = await api('/api/filters').catch(() => null);
            S.flash = { type: 'ok', text: `✅ เชื่อมต่อ LINE OA สำเร็จ: ${r.bot.displayName}${r.bot.basicId ? ' (' + r.bot.basicId + ')' : ''}` };
          } else {
            S.flash = { type: 'err', text: '❌ บันทึกบัญชีแล้ว แต่ทดสอบ LINE OA ไม่สำเร็จ: ' + (r.error || 'ตรวจสอบ Channel Access Token') };
          }
        } else {
          S.flash = { type: 'ok', text: 'บันทึก LINE OA เรียบร้อยแล้ว' };
        }
        render();
      } else if (type === 'whatsapp-settings') {
        const after = (ev.submitter && ev.submitter.dataset.after) || 'save';
        const saved = await api('/api/settings/whatsapp', { method: 'PUT', body: fd });
        S.settings = { ...saved, lineNotify: (S.settings && S.settings.lineNotify) || {} };
        S.waNew = false;
        S.filters = await api('/api/filters').catch(() => S.filters);
        if (after === 'test') {
          const r = await api('/api/settings/whatsapp/test', { method: 'POST', body: { id: saved.savedId } });
          if (r.ok) {
            S.settings = { ...r.settings, lineNotify: (S.settings && S.settings.lineNotify) || {} };
            S.filters = await api('/api/filters').catch(() => null);
            S.flash = { type: 'ok', text: `✅ เชื่อมต่อ WhatsApp Business สำเร็จ: ${r.phone.verifiedName} (${r.phone.displayPhone})` };
          } else {
            S.flash = { type: 'err', text: '❌ บันทึกเบอร์แล้ว แต่ทดสอบ WhatsApp ไม่สำเร็จ: ' + (r.error || 'ตรวจสอบ Phone Number ID และ Access Token') };
          }
        } else {
          S.flash = { type: 'ok', text: 'บันทึก WhatsApp เรียบร้อยแล้ว' };
        }
        render();
      } else if (type === 'reply') {
        const text = String(fd.text || '').trim(); if (text) await sendReply(text);
      } else if (type === 'followup') {
        const r = await api('/api/followups', { method: 'POST', body: { id: S.chat.id, dueDate: fd.dueDate, note: fd.note } });
        if (S.chat.data) S.chat.data.followup = r.followup;
        S.chat.msg = { type: 'ok', text: `ตั้งนัดตามวันที่ ${r.followup.dueDate} แล้ว` }; renderChatViews(); if (S.route === 'followup') loadFollowups();
      } else if (type === 'review') {
        const scores = {}; for (const [k] of RV) if (fd['s_' + k]) scores[k] = Number(fd['s_' + k]);
        if (Object.keys(scores).length < RV.length) { S.chat.msg = { type: 'err', text: 'กรุณาให้คะแนนครบทุกข้อ' }; renderChatViews(); return; }
        const r = await api('/api/review', { method: 'POST', body: { id: S.chat.id, scores, note: fd.note } });
        if (S.chat.data) S.chat.data.review = r.review;
        S.chat.msg = { type: 'ok', text: `บันทึกรีวิวแล้ว (${r.review.score}%)` }; renderChatViews(); loadReview();
      } else if (type === 'users-add') {
        const items = String(fd.list || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
          const [username, password] = l.split(/[\s,;\t]+/);
          return { username, password: password || genPassword(), role: fd.role };
        });
        if (!items.length) { S.flash = { type: 'err', text: 'กรุณาพิมพ์รายชื่อผู้ใช้อย่างน้อย 1 บรรทัด' }; render(); return; }
        const r = await api('/api/users', { method: 'POST', body: { users: items } });
        const pw = Object.fromEntries(items.map((i) => [i.username, i.password]));
        S.users.result = { added: r.added.map((a) => ({ ...a, password: pw[a.username] })), skipped: r.skipped };
        S.users.data = r.users; S.flash = null; renderSettingBody();
      } else if (type === 'pages-add') {
        const r = await api('/api/settings/pages', { method: 'POST', body: fd });
        if (r.ok) {
          S.flash = { type: 'ok', text: 'บันทึกเพจเรียบร้อยแล้ว' };
          S.filters = await api('/api/filters').catch(() => null);
          render();
        }
      } else if (type === 'password') {
        await api('/api/password', { method: 'POST', body: fd });
        S.me = await api('/api/me'); S.flash = { type: 'ok', text: 'เปลี่ยนรหัสผ่านเรียบร้อย' }; render();
      }
    } catch (e) {
      if (type === 'login') { S.loginErr = e.message; renderLogin(); }
      else if (['followup', 'review'].includes(type) && e.message !== 'กรุณาเข้าสู่ระบบ') { S.chat.msg = { type: 'err', text: e.message }; renderChatViews(); }
      else if (['line-settings', 'whatsapp-settings'].includes(type) && e.message !== 'กรุณาเข้าสู่ระบบ') { showToast('❌ ' + e.message, 'error'); }
      else if (e.message !== 'กรุณาเข้าสู่ระบบ') { S.flash = { type: 'err', text: e.message }; render(); }
    }
  });

  document.addEventListener('mousemove', (ev) => {
    const wrap = ev.target.closest && ev.target.closest('.chart-wrap'); if (!wrap) return;
    const c = CHARTS[wrap.dataset.chart]; if (!c) return;
    const svg = wrap.querySelector('svg'); const r = svg.getBoundingClientRect(); const tip = wrap.querySelector('.tip');
    const fx = ((ev.clientX - r.left) / r.width) * c.W;
    const i = Math.floor((fx - c.pl) / c.band);
    if (i < 0 || i >= c.vals.length) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.innerHTML = `${esc(c.dates[i])}<br><b>${esc(c.fmt(c.vals[i]))}</b>`;
    const left = ((c.pl + (i + 0.5) * c.band) / c.W) * r.width;
    tip.style.left = Math.min(left + 10, r.width - 110) + 'px'; tip.style.top = '8px';
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && S.chat.id && S.route !== 'inbox') closeChat();
    const t = ev.target;
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && t.matches && t.matches('.reply-form textarea')) { ev.preventDefault(); t.form.requestSubmit(); }
  });


  // Global hover popover handler for Campaign ads and creative
  function ensureAdPopover() {
    let pop = document.getElementById('ad-preview-popover');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'ad-preview-popover';
      pop.className = 'ad-preview-popover';
      document.body.appendChild(pop);
    }
    return pop;
  }

  document.addEventListener('mouseover', (ev) => {
    const trigger = ev.target.closest && ev.target.closest('.ad-hover-trigger');
    if (!trigger || !trigger.dataset.adHover) return;
    const pop = ensureAdPopover();
    try {
      const r = JSON.parse(trigger.dataset.adHover);
      const qColor = { excellent: '#15803d', good: '#2563eb', average: '#d97706', poor: '#dc2626' }[r.qualityLabel] || '#64748b';
      const cType = String(r.creative || 'IMAGE').toUpperCase();
      const isRealVid = Boolean(r.videoUrl && !String(r.videoUrl).startsWith('demo-reel:'));
      const mediaHtml = isRealVid
        ? `<video src="${esc(r.videoUrl)}" ${r.thumb ? `poster="${esc(r.thumb)}"` : ''} autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover"></video>`
        : (r.thumb
            ? `<img src="${esc(r.thumb)}" referrerpolicy="no-referrer" alt="${esc(r.name)}">`
            : `<div style="font-size:40px;opacity:0.4">${cType === 'VIDEO' ? '🎬' : cType === 'CAROUSEL' ? '🎠' : '🖼️'}</div>`);

      pop.innerHTML = `
        <div class="ad-popover-media">
          ${mediaHtml}
          <span class="ad-popover-badge">${(r.videoUrl || cType === 'VIDEO') ? '🎬 VIDEO' : cType}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${statusBadgeHtml(r.status)}
          <div class="ad-popover-title" style="font-weight:700;font-size:13.5px;color:var(--ink, #0f172a);line-height:1.35">${esc(r.name)}</div>
        </div>
        <div class="ad-popover-campaign" style="font-size:11.5px;color:var(--muted, #64748b)">📊 ${esc(r.campaign)}${r.adset ? ' · 🎯 ' + esc(r.adset) : ''}</div>
        ${r.body ? `<div style="font-size:11.5px;color:#334155;background:#f0fdf4;padding:6px 8px;border-radius:6px;border:1px solid #bbf7d0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(r.body)}</div>` : ''}
        <div class="ad-popover-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:#f8fafc;padding:9px;border-radius:8px">
          <div><div style="font-size:10px;color:#64748b">Spend / งบวัน</div><div style="font-weight:700;font-size:12px;color:#064e3b">฿${Number(r.spend||0).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style="font-size:10px;color:#64748b">Reach / Freq</div><div style="font-weight:700;font-size:12px">${Number(r.reach||0).toLocaleString()} (${r.frequency || 1}×)</div></div>
          <div><div style="font-size:10px;color:#64748b">Impressions</div><div style="font-weight:700;font-size:12px">${Number(r.impressions||0).toLocaleString()}</div></div>
          <div><div style="font-size:10px;color:#64748b">Clicks / CTR</div><div style="font-weight:700;font-size:12px">${Number(r.clicks||0).toLocaleString()} (${Number(r.ctr||0).toFixed(2)}%)</div></div>
          <div><div style="font-size:10px;color:#64748b">Engagement</div><div style="font-weight:700;font-size:12px;color:#0284c7">${Number(r.postEngagement||0).toLocaleString()}</div></div>
          <div><div style="font-size:10px;color:#64748b">Video / ThruPlay</div><div style="font-weight:700;font-size:12px">${Number(r.videoPlays||0).toLocaleString()} / ${Number(r.videoThruPlays||0).toLocaleString()}</div></div>
          <div><div style="font-size:10px;color:#64748b">Messages / Cost</div><div style="font-weight:700;font-size:12px">${Number(r.messages||0).toLocaleString()} (฿${Number(r.costMessage||0).toFixed(0)})</div></div>
          <div><div style="font-size:10px;color:#64748b">Purchases</div><div style="font-weight:700;font-size:12px;color:#16a34a">${r.purchases||0}</div></div>
          <div><div style="font-size:10px;color:#64748b">Revenue / ROAS</div><div style="font-weight:700;font-size:12px;color:#047857">฿${Number(r.revenue||0).toLocaleString()} ${r.roas ? `(${r.roas}×)` : ''}</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid #f1f5f9;font-size:11.5px">
          <span>🎯 Chat Quality: <b style="color:${qColor}">${r.qualityLabel ? String(r.qualityLabel).toUpperCase() : '—'} ${r.qualityScore !== null && r.qualityScore !== undefined ? r.qualityScore + '%' : ''}</b></span>
          <span style="color:#94a3b8;font-size:11px">ID: ${esc(r.id)}</span>
        </div>
      `;

      const rect = trigger.getBoundingClientRect();
      const popW = 320;
      const popH = 360;
      let left = rect.right + 12;
      let top = rect.top;
      if (left + popW > window.innerWidth - 12) {
        left = rect.left - popW - 12;
      }
      if (left < 10) left = 10;
      if (top + popH > window.innerHeight - 12) {
        top = window.innerHeight - popH - 12;
      }
      if (top < 10) top = 10;

      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.classList.add('active');
    } catch (err) {
      console.error('Hover popover error:', err);
    }
  });

  document.addEventListener('mouseout', (ev) => {
    const trigger = ev.target.closest && ev.target.closest('.ad-hover-trigger');
    if (!trigger) return;
    const rel = ev.relatedTarget;
    if (rel && trigger.contains(rel)) return;
    const pop = document.getElementById('ad-preview-popover');
    if (pop) pop.classList.remove('active');
  });

  /* ---------------- boot ---------------- */
  (async () => {
    S.route = routeFromHash();
    try {
      S.me = await api('/api/me');
      if (S.me) {
        await loadWebNotifications();
        try { S.notificationSchedule = await api('/api/notifications/schedule'); } catch (_) {}
        // โหลดข้อมูล Inbox ล่วงหน้าในพื้นหลัง เพื่อให้ตัวเลขแชทที่รอตอบ (⚡ รอแชท / Inbox Badge)
        // ซิงก์ตรงกัน 100% ตั้งแต่วินาทีแรกที่เปิดเว็บ ไม่ว่าจะอยู่หน้าไหน
        api('/api/inbox?range=all').then(r => {
          if (r && r.rows) {
            S.inbox.data = r;
            updateGlobalUnrepliedBadges();
          }
        }).catch(() => {});
        // Polling web notifications ทุก 45 วินาที (เฉพาะเมื่อเปิดแท็บดูอยู่ เพื่อประหยัด CPU & Memory)
        setInterval(async () => {
          if (S.me && document.visibilityState === 'visible') {
            await loadWebNotifications();
            const dot = document.querySelector('.header-icon-btn .count-dot');
            const list = notices();
            if (dot) dot.textContent = list.length > 9 ? '9+' : list.length;
            // เช็กอัปเดตตัวเลขแชทที่รอตอบไปพร้อมกัน
            api('/api/inbox?range=all').then(r => {
              if (r && r.rows) {
                S.inbox.data = r;
                updateGlobalUnrepliedBadges();
              }
            }).catch(() => {});
          }
        }, 45000);
      }
    } catch { S.me = null; }
    S.booted = true;
    try {
      enterRoute();
    } catch (routeErr) {
      console.error('enterRoute error:', routeErr);
      if (!S.me) renderLogin();
    }
  })();
})();