(() => {
  'use strict';

  const $app = document.getElementById('app');

  /* ---------------- state ---------------- */
  const S = {
    me: null, booted: false, filters: null, route: 'dashboard', menu: null,
    dash: { range: '30d', from: '', to: '', platform: '', page: '', campaign: '', agency: '', rep: '', status: '', tab: 'ads',
      data: null, loading: false, err: null, sort: 'spend', dir: 'desc', search: '', pageNo: 1 },
    settings: null, flash: null, loginErr: '',
    board: { range: 'all', from: '', to: '', data: null, err: null },
    inbox: { range: 'all', from: '', to: '', data: null, err: null, search: '', channel: '', status: '', pageNo: 1 },
    review: { range: '30d', from: '', to: '', data: null, err: null, state: '', rep: '' },
    followup: { data: null, err: null, tab: '', rep: '' },
    audit: { data: null, err: null, action: '', q: '', from: '', to: '', limit: 100 },
    chat: { id: null, loading: false, data: null, err: null, sending: false, msg: null },
    users: { data: null, err: null, result: null },
    sla: { data: null, err: null, open: '', kind: '' },
    upload: { data: null, err: null, loading: false, rows: [], result: null, tab: 'leads', detectedType: 'leads', summary: null },
    quality: { data: null, err: null, loading: false, campaign: '', minQuality: '', sort: 'leads', sortDir: 'desc' },
  };
  const PAGE_SIZE = 25;
  const INBOX_PAGE = 15;
  // ความคืบหน้าของแชท เรียงตามคอลัมน์ใน Board ตามลำดับที่ผู้ใช้กำหนด (12 คอลัมน์)
  const STATUS_ORDER = [
    'new',          // 1. มาใหม่ (New Leads)
    'intake',       // 2. In-take (รับเรื่อง/คัดกรอง)
    'talked',       // 3. พอได้คุย (Contacted)
    'in_progress',  // 4. กำลังดำเนินการ (In Progress)
    'inprogress',   // 5. In-progress (สำรอง)
    'qualified',    // 6. มีคุณสมบัติ (Qualified)
    'qualifile',    // 7. Qualifile (สำรอง)
    'appointment',  // 8. นัดแล้ว (Appointment Booked)
    'conv_created', // 9. สร้างคอนเวอร์ชั่นแล้ว
    'converted',    // 10. สำเร็จ/ปิดการขาย (Won / Converted)
    'no_reply',     // 11. ไม่ตอบ (Unresponsive)
    'very_poor',    // 12. แย่มาก/หลุด (Lost / Unqualified)
  ];
  const STATUS_TH = {
    no_reply: 'ไม่ตอบ',
    very_poor: 'แย่มาก',
    talked: 'พอได้คุย',
    in_progress: 'กำลังดำเนินการ',
    qualified: 'มีคุณสมบัติ',
    appointment: 'นัดแล้ว',
    conv_created: 'สร้างคอนเวอร์ชั่นแล้ว',
    new: 'มาใหม่',
    inprogress: 'In-progress',
    intake: 'In-take',
    qualifile: 'Qualifile',
    converted: 'Converted',
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
  };

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

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET', credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401 && path !== '/api/login') { S.me = null; render(); throw new Error('กรุณาเข้าสู่ระบบ'); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด');
    return json;
  }

  /* ---------------- routing ---------------- */
  const ROUTES = ['dashboard', 'inbox', 'board', 'followup', 'review', 'audit', 'upload', 'quality', 'setting'];
  function routeFromHash() {
    const r = location.hash.replace(/^#\/?/, '');
    return ROUTES.includes(r) ? r : 'dashboard';
  }
  window.addEventListener('hashchange', () => { S.route = routeFromHash(); S.menu = null; S.flash = null; S.chat.id = null; enterRoute(); });

  function enterRoute() {
    render();
    if (!S.me) return;
    if (S.route === 'dashboard') loadDash();
    if (S.route === 'inbox') loadInbox();
    if (S.route === 'board') loadBoard();
    if (S.route === 'followup') loadFollowups();
    if (S.route === 'review') loadReview();
    if (S.route === 'audit') loadAudit();
    if (S.route === 'setting') loadSettings();
    if (S.route === 'upload') loadUpload();
    if (S.route === 'quality') loadQuality();
  }

  /* ---------------- shell ---------------- */
  function notices() {
    const list = [];
    if (S.me && S.me.mode === 'demo') list.push('กำลังแสดงข้อมูลเดโม — เชื่อม Meta ได้ที่เมนู Setting');
    if (S.me && S.me.mustChange) list.push('ยังใช้รหัสผ่านเริ่มต้นอยู่ กรุณาเปลี่ยนที่เมนู Setting');
    return list;
  }

  function topbar() {
    const nav = [['dashboard', 'Dashboard', 'grid'], ['inbox', 'Inbox', 'chat'], ['board', 'Board', 'grid'],
      ['post-comment', 'Post & comment', 'chat'],
      ['followup', 'ตามลูกค้า', 'clock'], ['review', '⏱️ SLA', 'check'], ['audit', 'Audit', 'list'],
      ['upload', 'Upload', 'upload'], ['quality', 'Quality', 'shield'], ['setting', 'ตั้งค่า', 'gear']];
    const platforms = (S.filters && S.filters.platforms) || ['Facebook', 'LINE', 'WhatsApp', 'Instagram'];
    const allPages = (S.filters && S.filters.pages) || [];
    const curPlatform = S.dash.platform || '';
    const filteredPages = curPlatform ? allPages.filter((p) => !p.platform || p.platform.toLowerCase() === curPlatform.toLowerCase()) : allPages;
    const list = notices();
    return `<header class="topbar">
      <div class="brand"><img class="brand-mark" src="/logo-mark.png" alt="BEQ Group" width="44" height="44"><div><b>BEQ Group</b><small>Ads · Chat · Lead Suite</small></div></div>
      <nav class="nav">${nav.map(([id, label, ic]) => `<a href="#/${id}" class="${S.route === id ? 'active' : ''}">${icon(ic)}${label}</a>`).join('')}</nav>
      <div class="spacer"></div>
      <div class="topbar-selectors" style="display:inline-flex;gap:8px;align-items:center">
        <div class="pill-select"><select data-bind="header-platform" aria-label="แพลตฟอร์ม">
          <option value="">🌐 ทุกแพลตฟอร์ม</option>
          ${platforms.map((p) => `<option value="${esc(p)}" ${curPlatform.toLowerCase() === p.toLowerCase() ? 'selected' : ''}>${esc(p)}</option>`).join('')}
        </select></div>
        <div class="pill-select"><select data-bind="header-page" aria-label="เลือกเพจ">
          <option value="">${curPlatform ? `📄 ทุกเพจ (${esc(curPlatform)})` : '📄 ทุกเพจ / บัญชี'}</option>
          ${filteredPages.map((p) => `<option value="${esc(p.id)}" ${S.dash.page === p.id ? "selected" : ""}>${p.platform === "Facebook" ? "🔵 " : p.platform === "LINE" ? "🟢 " : p.platform === "WhatsApp" ? "💚 " : ""}${esc(p.name)}</option>`).join("")}
        </select></div>
      </div>
      <div class="rel"><button class="icon-btn" data-act="menu" data-menu="bell" aria-label="Notifications">${icon('bell')}${list.length ? '<span class="dot"></span>' : ''}</button>
        ${S.menu === 'bell' ? `<div class="popover">${list.length ? list.map((t) => `<div class="item">${esc(t)}</div>`).join('') : '<div class="item">ไม่มีการแจ้งเตือน</div>'}</div>` : ''}</div>
      <div class="rel"><button class="user-btn" data-act="menu" data-menu="user"><span class="avatar">${esc(S.me.username[0])}</span>${esc(S.me.username)}<span style="opacity:.6">▾</span></button>
        ${S.menu === 'user' ? `<div class="popover"><a class="item" style="display:block">${esc(S.me.clinicName || '')}</a><button data-act="goto" data-to="setting">Setting</button><button data-act="logout">Log out</button></div>` : ''}</div>
    </header>`;
  }

  function render() {
    if (!S.booted) { $app.innerHTML = '<div class="loading">Loading…</div>'; return; }
    if (!S.me) return renderLogin();
    const views = { dashboard: dashShell, inbox: inboxShell, board: boardShell, followup: followShell, review: reviewShell, audit: auditShell, setting: settingShell, upload: uploadShell, quality: qualityShell };
    const body = (views[S.route] || soonShell)();
    $app.innerHTML = topbar() + `<main class="page">${S.me.mustChange && S.route !== 'setting'
      ? '<div class="notice warn banner">ยังใช้รหัสผ่านเริ่มต้นอยู่ — <a href="#/setting">เปลี่ยนรหัสผ่านที่ Setting</a></div>' : ''}${body}</main><div id="drawer-root"></div>`;
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
    if (file.size > 10_000_000) { alert('รูปภาพมีขนาดใหญ่เกิน 10 MB'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imageData = e.target.result;
        const mimeType = file.type || 'image/jpeg';
        const res = await api('/api/upload/ad-image', {
          method: 'POST',
          body: { adId, adName, imageData, mimeType },
        });
        S.flash = { type: 'ok', text: `อัปโหลดรูปให้โฆษณา "${res.adName || adName}" สำเร็จแล้ว!` };
        S.dash.data = null; // รีเฟรชข้อมูล Dashboard เพื่อให้รูปโชว์
        if (S.route === 'dashboard') {
          await loadDash(true);
        } else {
          await loadUpload();
        }
      } catch (err) {
        alert('อัปโหลดรูปไม่สำเร็จ: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
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
      };
    } else {
      COL_MAP = {
        'ชื่อ': 'name', 'ชื่อ-นามสกุล': 'name', 'ชื่อจริง': 'name', 'ชื่อเต็ม': 'name', 'ชื่อลูกค้า': 'name',
        'name': 'name', 'full_name': 'name', 'fullname': 'name', 'first_name': 'name', 'customer': 'name', 'customer_name': 'name', 'lead_name': 'name',
        'ช่องทาง': 'channel', 'ช่องทางติดต่อ': 'channel', 'แพลตฟอร์ม': 'channel',
        'channel': 'channel', 'platform': 'channel',
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
    }).filter((r) => r.name || r.date || r.adId || r.campaign || r.adName || r.spend || r.impressions || r.status || r.channel || r.phone || r.email);
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
        <button data-act="upload-tab" data-tab="images" class="${u.tab === 'images' ? 'active' : ''}">🖼️ รูปภาพ Ads</button>
        <button data-act="upload-tab" data-tab="manage" class="${u.tab === 'manage' ? 'active' : ''}">⚙️ จัดการ & ลบข้อมูลในระบบ</button>
      </div>
    </div>`;
  }

  function renderImagesTab(u) {
    const ads = u.ads || [];
    return `<div class="card panel">
      <h3>🖼️ จัดการรูปภาพโฆษณา (Ad Creatives)</h3>
      <p class="sub">เลือกรูปภาพเพื่อแสดงในคอลัมน์ Creative ในหน้า Dashboard และ Quality เพื่อให้เห็นรูปโฆษณาจริงประกอบตัวเลขสถิติ</p>
      ${!ads.length ? `<div class="notice warn" style="margin-top:14px">ยังไม่มีข้อมูลโฆษณาในระบบ — กรุณานำเข้าไฟล์แคมเปญ Ads ที่แท็บ "📊 นำเข้าแคมเปญ Ads" ก่อน เพื่อให้มีรายชื่อโฆษณามาจับคู่กับรูป</div>` : `
      <div class="tscroll" style="margin-top:16px"><table style="min-width:650px">
        <thead><tr>
          <th class="nosort" style="width:70px">รูปภาพ</th>
          <th class="nosort">ชื่อโฆษณา (Ad Name)</th>
          <th class="nosort" style="width:180px">จัดการรูปภาพ</th>
        </tr></thead>
        <tbody>
          ${ads.map((a) => `<tr>
            <td>
              ${a.thumb ? `<img class="thumb" src="${esc(a.thumb)}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;box-shadow:0 1px 3px rgba(0,0,0,.15);cursor:pointer" onclick="window.open('${esc(a.thumb)}')">` : `<span class="thumb" style="width:48px;height:48px;border-radius:10px;background:#eceae2;display:grid;place-items:center;color:var(--muted);font-size:11px">ไม่มีรูป</span>`}
            </td>
            <td>
              <b style="font-size:14.5px">${esc(a.name)}</b>
              <div class="ad-sub">${esc(a.id)}</div>
            </td>
            <td>
              <label class="btn primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:6px 14px">
                📷 ${a.thumb ? 'เปลี่ยนรูป' : 'เลือกรูปภาพ'}
                <input type="file" accept="image/*" style="display:none" data-act="ad-img-file" data-ad-id="${esc(a.id)}" data-ad-name="${esc(a.name)}">
              </label>
            </td>
          </tr>`).join('')}
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
    const pages = (S.filters && S.filters.pages) || [];
    const curPlatform = u.platform || 'Facebook';
    const curPage = u.pageName || '';
    return `<div class="grid-2" style="margin:14px 0 16px;background:#f8faf6;padding:14px 16px;border-radius:12px;border:1px solid var(--line-soft)">
      <div class="field" style="margin-bottom:0">
        <label style="font-weight:600">🌐 แพลตฟอร์ม</label>
        <div class="sel" style="width:100%"><select id="upload-platform-input" style="width:100%">
          <option value="Facebook" ${curPlatform === 'Facebook' ? 'selected' : ''}>Facebook</option>
          <option value="LINE" ${curPlatform === 'LINE' ? 'selected' : ''}>LINE Official Account</option>
          <option value="WhatsApp" ${curPlatform === 'WhatsApp' ? 'selected' : ''}>WhatsApp Business</option>
          <option value="Instagram" ${curPlatform === 'Instagram' ? 'selected' : ''}>Instagram</option>
          <option value="Direct" ${curPlatform === 'Direct' ? 'selected' : ''}>Direct / อื่นๆ</option>
        </select></div>
        <small>ระบุว่าไฟล์นี้เป็นข้อมูลของแพลตฟอร์มใด (เช่น Facebook, LINE)</small>
      </div>
      <div class="field" style="margin-bottom:0">
        <label style="font-weight:600">📄 ชื่อเพจ / บัญชี</label>
        <input type="text" id="upload-page-input" placeholder="เช่น เพจรักเพื่อน, Hairlab Clinic, LINE OA คลินิก" value="${esc(curPage)}" list="known-pages-list">
        <datalist id="known-pages-list">
          ${pages.map((p) => `<option value="${esc(p.name)}">`).join('')}
        </datalist>
        <small>พิมพ์หรือเลือกชื่อเพจ เพื่อแยกดูรายงานบนแถบด้านบน</small>
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
          <table style="min-width:760px"><thead><tr>
            <th class="nosort">#</th><th class="nosort">ชื่อ</th><th class="nosort">ช่องทาง</th>
            <th class="nosort">โฆษณา / แคมเปญ</th><th class="nosort">วันที่</th><th class="nosort">สถานะบน Board</th><th class="nosort">เซลส์</th>
          </tr></thead><tbody>
            ${rows.map((r, i) => `<tr><td class="nowrap" style="color:var(--muted)">${i + 1}</td>
              <td><b>${esc(r.name || '—')}</b></td><td>${esc(r.channel || '—')}</td>
              <td style="font-size:13px">${esc(r.adId || '—')}</td>
              <td>${esc(r.date || '—')}</td>
              <td><span class="q-badge q-average">${esc(r.status || 'พอได้คุย')}</span></td>
              <td>${esc(r.rep || '—')}</td></tr>`).join('')}
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
    <div id="comments-body"><div class="loading">Loading…</div></div>`;
  }

  async function loadComments() {
    const c = S.comments;
    c.loading = true; c.err = null; renderCommentsBody();
    try {
      const q = new URLSearchParams({ range: c.range });
      if (c.range === 'custom') { q.set('from', c.from); q.set('to', c.to); }
      if (S.dash.platform) q.set('platform', S.dash.platform);
      if (S.dash.page) q.set('pageId', S.dash.page);
      c.data = await api('/api/posts-comments?' + q.toString());
      c.loading = false;
    } catch (e) {
      c.err = e.message || 'โหลดข้อมูลคอมเมนต์ไม่สำเร็จ';
      c.loading = false;
    }
    renderCommentsBody();
  }

  function renderCommentsBody() {
    const box = document.getElementById('comments-body'); if (!box) return;
    const c = S.comments;
    if (c.err) { box.innerHTML = `<div class="notice err">${esc(c.err)}</div>`; return; }
    if (c.loading || !c.data) { box.innerHTML = '<div class="loading">Loading…</div>'; return; }

    const { posts = [], sla = {} } = c.data;
    const totals = sla.totals || { turns: 0, onTime: 0, late: 0, deducted: 0, points: 0 };

    let allComments = [];
    posts.forEach(p => {
      (p.comments || []).forEach(com => {
        allComments.push({ ...com, post: p });
      });
    });

    const repliedCount = allComments.filter(x => x.replied).length;
    const pendingCount = allComments.filter(x => !x.replied).length;

    let filtered = allComments;
    if (c.filterStatus === 'pending') filtered = allComments.filter(x => !x.replied);
    else if (c.filterStatus === 'replied') filtered = allComments.filter(x => x.replied);

    box.innerHTML = `
      <!-- SLA Score Card -->
      <section class="card panel" style="margin-bottom:16px;background:linear-gradient(135deg,#fafffa 0%,#f0fdf4 100%);border:1.5px solid #bbf7d0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0;color:#166534;display:flex;align-items:center;gap:8px">⏱️ ผลงานตอบคอมเมนต์ (Comment SLA) — เกณฑ์ 15 นาที</h3>
          <span class="chip good">SLA แยกเฉพาะคอมเมนต์</span>
        </div>
        <div class="grid-4">
          <div class="stat"><div class="k-label">คอมเมนต์ทั้งหมด</div><div class="k-value">${num(totals.turns || allComments.length)}</div></div>
          <div class="stat"><div class="k-label">ตอบทันเวลา (≤ 15 น.)</div><div class="k-value" style="color:#16a34a">${num(totals.onTime || repliedCount)}</div></div>
          <div class="stat"><div class="k-label">ตอบช้า / หลุด SLA</div><div class="k-value" style="color:${totals.late ? '#dc2626' : 'var(--muted)'}">${num(totals.late)}</div></div>
          <div class="stat"><div class="k-label">แต้ม SLA โดนหัก (10–19 น.)</div><div class="k-value" style="color:${totals.points < 0 ? '#dc2626' : '#16a34a'}">${totals.points || 0} แต้ม</div></div>
        </div>
      </section>

      <!-- Filter Tabs -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div class="seg">
          <button class="${c.filterStatus === 'all' ? 'active' : ''}" data-act="c-filter" data-val="all">ทั้งหมด (${allComments.length})</button>
          <button class="${c.filterStatus === 'pending' ? 'active' : ''}" data-act="c-filter" data-val="pending" style="color:#b91c1c">🔴 ยังไม่ตอบ (${pendingCount})</button>
          <button class="${c.filterStatus === 'replied' ? 'active' : ''}" data-act="c-filter" data-val="replied" style="color:#15803d">🟢 ตอบแล้ว (${repliedCount})</button>
        </div>
      </div>

      <!-- Comments Table -->
      <div class="card panel">
        <h3>📝 รายการคอมเมนต์ล่าสุด</h3>
        ${!filtered.length ? '<div class="empty">ยังไม่มีคอมเมนต์ในหมวดนี้ หรือกด "🔄 ดึงโพสต์ & คอมเมนต์ล่าสุด" ด้านบนเพื่อดูดข้อมูลจริงจาก Meta</div>' : `
          <div class="tscroll"><table><thead><tr>
            <th>แพลตฟอร์ม / เพจ</th>
            <th>โพสต์</th>
            <th>ลูกค้า / คอมเมนต์</th>
            <th>เวลาที่คอมเมนต์</th>
            <th>สถานะการตอบ</th>
            <th>การตอบกลับของทีมงาน</th>
          </tr></thead><tbody>
            ${filtered.map(x => {
              const p = x.post;
              const isReplied = x.replied;
              const reply = x.replies && x.replies[0];
              const platIcon = p.platform === 'Instagram' ? '📸 Instagram' : '🔵 Facebook';
              return `<tr>
                <td class="nowrap"><b>${platIcon}</b><br><small style="color:var(--muted)">${esc(p.pageName || p.pageId)}</small></td>
                <td style="max-width:240px;font-size:13px">${esc(p.content.slice(0, 60))}${p.content.length > 60 ? '…' : ''}${p.permalink ? `<br><a href="${esc(p.permalink)}" target="_blank" style="font-size:11px;color:var(--brand)">🔗 เปิดโพสต์จริง</a>` : ''}</td>
                <td><b>${esc(x.from)}</b><div style="font-size:13.5px;margin-top:2px;color:var(--ink-2)">${esc(x.text)}</div></td>
                <td class="nowrap" style="font-size:12.5px">${esc(x.timestamp ? x.timestamp.slice(0, 16).replace('T', ' ') : '—')}</td>
                <td><span class="q-badge ${isReplied ? 'q-good' : 'q-poor'}">${isReplied ? '🟢 ตอบแล้ว' : '🔴 ยังไม่ตอบ'}</span></td>
                <td>${reply ? `<div style="font-size:12.5px"><b>${esc(reply.from)}:</b> ${esc(reply.text)}</div><small style="color:var(--muted)">${esc(reply.timestamp ? reply.timestamp.slice(0, 16).replace('T', ' ') : '')}</small>` : '<span style="color:var(--muted);font-size:12px">—</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody></table></div>
        `}
      </div>
    `;
  }

  /* ═══════════════════════════════════════════
     QUALITY PAGE — คุณภาพแชทรายโฆษณา
  ═══════════════════════════════════════════ */
  function qualityShell() {
    return `<div class="page-head"><div><h1>${icon('spark')} คุณภาพแชทรายโฆษณา</h1>
        <div class="meta-line"><span>ภาพรวมคุณภาพการสนทนาแยกตามโฆษณา — ใช้ข้อมูลช่วง 30 วันล่าสุด</span></div></div>
      <button class="btn" data-act="quality-reload">${icon('refresh')} รีเฟรช</button></div>
      <div id="quality-body"><div class="loading">Loading…</div></div>`;
  }

  async function loadQuality() {
    const q = S.quality;
    // Reuse dashboard data if available, else load fresh
    if (S.dash.data) {
      q.data = buildQualityData(S.dash.data); q.loading = false; q.err = null;
      renderQualityBody(); return;
    }
    q.loading = true; q.err = null; renderQualityBody();
    try {
      const data = await api('/api/dashboard?range=30d');
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
        id: a.id, name: a.name, campaign: a.campaign || '',
        leads, goodChats, goodPct,
        qualityScore: a.qualityScore,
        qualityLabel: a.qualityLabel || 'none',
        spend: a.spend || 0, cpc: a.cpc || null,
        firstResponseMin: null, // not in ad-level data; available from leads
      };
    });
    return { ads };
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
        <div class="stat"><div class="k-label">Leads ทั้งหมด</div><div class="k-value">${num(totalLeads)}</div></div>
        <div class="stat"><div class="k-label">แชทคุณภาพดี</div><div class="k-value" style="color:var(--brand)">${num(goodLeads)}</div></div>
        <div class="stat"><div class="k-label">Avg Quality Score</div><div class="k-value">${avgScore !== null ? avgScore + '%' : '—'}</div></div>
        <div class="stat"><div class="k-label">โฆษณาในช่วง</div><div class="k-value">${num(ads.length)}</div></div>
      </div>

      <section class="card table-card">
        <div class="table-head"><div><h2>คุณภาพรายโฆษณา</h2><p>${num(ads.length)} ads</p></div></div>
        <div class="tscroll"><table style="min-width:800px">
          <thead><tr>
            ${thSort('name', 'ชื่อโฆษณา')}
            <th class="nosort">Campaign</th>
            ${thSort('leads', 'Leads')}
            ${thSort('goodPct', 'Good %')}
            ${thSort('spend', 'Spend')}
            <th class="nosort">คุณภาพ</th>
          </tr></thead>
          <tbody>${ads.length ? ads.map((a) => `<tr>
            <td><div class="ad-name" title="${esc(a.name)}">${esc(a.name)}</div><div class="ad-sub">${esc(a.id)}</div></td>
            <td style="color:var(--muted)">${esc(a.campaign || '—')}</td>
            <td>${num(a.leads)}</td>
            <td>${a.leads ? pct(a.goodPct) : '—'}</td>
            <td>${baht(a.spend)}</td>
            <td><span class="q-badge q-${esc(a.qualityLabel || 'none')}">${a.qualityScore !== null ? num(a.qualityScore) + '%' : 'No chats'}</span></td>
          </tr>`).join('') : `<tr><td colspan="6"><div class="empty">ไม่มีข้อมูลโฆษณาในช่วงที่เลือก</div></td></tr>`}
          </tbody>
        </table></div>
      </section>`;
  }

  /* ---------------- login ---------------- */
  function renderLogin() {
    $app.innerHTML = `<div class="login-split">
      <aside class="login-art">${strandsSvg(26, 0.13)}<img class="login-logo" src="/logo-full-white.png" alt="BEQ Group">
        <h2>BEQ GROUP</h2>
        <p>ONE STOP HAIR BUSINESS PARTNER</p></aside>
      <main class="login-pane"><form class="login-card" data-form="login" autocomplete="on">
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

  function dashShell() {
    const d = S.dash; const f = S.filters || { platforms: [], pages: [], campaigns: [], agencies: [], reps: [], statuses: [] };
    const data = d.data;
    const customDays = d.from && d.to ? Math.round((Date.parse(d.to) - Date.parse(d.from)) / 864e5) + 1 : 30;
    const days = d.range === 'all' ? 'All time' : d.range === 'custom' ? Math.max(1, customDays) : ({ '7d': 7, '30d': 30, '90d': 90 }[d.range] || 30);
    const live = S.me.mode === 'meta' || S.me.mode === 'live';
    return `<div class="page-head"><div>
        <h1>Dashboard ${live ? '<span class="badge-demo" style="background:var(--mint);color:var(--brand-deep)">Live · ข้อมูลจริง</span>' : `<span class="badge-demo">${icon('spark')}Demo data</span>`}</h1>
        <div class="meta-line" id="dash-meta"></div></div>
      <button class="btn" data-act="refresh">${icon('refresh')}Refresh</button></div>

      <section class="card filters">
        <div class="seg">${[['all', 'ทั้งหมด'], ['7d', '7D'], ['30d', '30D'], ['90d', '90D'], ['custom', 'Custom']].map(([k, l]) => `<button data-act="range" data-range="${k}" class="${d.range === k ? 'active' : ''}">${l}</button>`).join('')}</div>
        ${d.range === 'custom' ? `<input class="date-in" type="date" data-bind="from" value="${esc(d.from)}" aria-label="From"><input class="date-in" type="date" data-bind="to" value="${esc(d.to)}" aria-label="To">` : ''}
        <span class="vs">${icon('cal')}ช่วงเวลา: ${days === 'All time' ? 'ข้อมูลทั้งหมด' : `vs ก่อนหน้า ${days} วัน`}</span>
        <span class="label">${icon('filter')}Filters</span>
        ${selectHtml('platform', 'All platforms', f.platforms || ['Facebook', 'LINE', 'WhatsApp', 'Instagram'], d.platform)}
        ${selectHtml('page', 'All pages', f.pages, d.page)}
        ${selectHtml('campaign', 'All campaigns', f.campaigns, d.campaign)}
        ${selectHtml('agency', 'All agencies', f.agencies, d.agency)}
        ${selectHtml('rep', 'All sales reps', f.reps, d.rep)}
        ${selectHtml('status', 'Any status', f.statuses, d.status)}
        <button class="icon-btn" data-act="reset-filters" aria-label="Reset filters">${icon('reset')}</button>
      </section>

      <nav class="card tabs">${[['ads', 'Ads Performance'], ['chat', 'Ads & Chat'], ['sales', 'Sales Performance'], ['trend', 'Trend'], ['dropped', 'Dropped']]
        .map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${d.tab === k ? 'active' : ''}">${l}</button>`).join('')}</nav>
      <div id="dash-body"></div>`;
  }

  function renderDashBody() {
    if (S.route !== 'dashboard') return;
    const d = S.dash; const box = document.getElementById('dash-body'); if (!box) return;
    const meta = document.getElementById('dash-meta');
    if (meta && d.data) {
      meta.innerHTML = `<span>${icon('cal')}${d.data.range.from} → ${d.data.range.to}</span><span>${icon('bars')}${d.data.scope.ads} ads in scope</span><span>${d.data.scope.leads} leads · ${d.data.scope.records} daily records</span>`;
    }
    if (d.err) { box.innerHTML = `<div class="notice err">${esc(d.err)}</div>`; return; }
    if (!d.data) { box.innerHTML = '<div class="loading">Loading…</div>'; return; }
    box.style.opacity = d.loading ? '.55' : '1';
    const tabs = { ads: tabAds, chat: tabChat, sales: tabSales, trend: tabTrend, dropped: tabDropped };
    // เล่นแอนิเมชันเฉพาะตอนข้อมูลชุดใหม่เข้ามาครั้งแรก ไม่เล่นซ้ำเวลาสลับแท็บ
    d.animKey = `${d.data.range.from}|${d.data.range.to}|${d.page}|${d.campaign}|${d.agency}|${d.rep}|${d.status}|${S.me.mode}`;
    const errNotice = d.data && d.data.metaError ? `<div class="notice err" style="margin-bottom:12px">⚠️ Meta API: ${esc(d.data.metaError)}</div>` : '';
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
      ['Impressions', k.impressions.value, 'คนที่เห็นโฆษณา'],
      ['Clicks', k.clicks.value, `CTR ${pct(k.ctr.value)}`],
      ['Messages', k.messages.value, `จากคลิก ${rate(k.messages.value, k.clicks.value)}`],
      ['Purchases', k.purchases.value, `จากแชท ${rate(k.purchases.value, k.messages.value)}`],
    ];
    return `<section class="hero">${strandsSvg(22, 0.07)}
      <div><div class="h-label">Amount spent ${chip(k.spend)}</div>
        <div class="h-num" data-count="${k.spend.value ?? 0}" data-fmt="baht">${baht(k.spend.value)}</div>
        <div class="h-sub">${esc(data.range.from)} → ${esc(data.range.to)} · เทียบ ${data.range.days} วันก่อนหน้า</div>
        <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily spend trend">
          <path class="trend-area ${anim}" d="M0,${H} L${pts.join(' L')} L${W},${H} Z"/>
          <polyline class="trend-line ${anim}" pathLength="1" points="${pts.join(' ')}"/></svg></div>
      <div class="funnel">${steps.map(([l, v, r]) => `<div class="f-step"><div class="f-label">${l}</div><div class="f-val">${num(v)}</div><span class="f-rate">${esc(r)}</span></div>`).join('')}</div>
    </section>`;
  }

  function tabAds(data) {
    const groups = [
      ['1', 'Cost & Visibility', 'What you paid to be seen', [['spend', 'Amount Spent', baht], ['reach', 'Reach', num], ['impressions', 'Impressions', num], ['cpm', 'CPM', baht]]],
      ['2', 'Acquisition', 'How people respond to ads', [['clicks', 'Clicks', num], ['ctr', 'CTR', pct], ['cpc', 'CPC', baht]]],
      ['3', 'Conversion', 'Messages and purchases', [['messages', 'Total Messages', num], ['costMessage', 'Cost / Message', baht], ['purchases', 'Total Purchases', num], ['conversionRate', 'Conversion Rate', pct], ['costPurchase', 'Cost / Purchase', baht]]],
    ];
    return heroHtml(data) + `<div class="kpi-groups">${groups.map(([n, t, s, items]) => `<section class="card kpi-group">
      <header><span class="step">${n}</span><div><b>${t}</b><small>${s}</small></div></header>
      <div class="kpi-grid">${items.map(([k, l, f]) => tile(data, k, l, f)).join('')}</div></section>`).join('')}</div>
      <section class="card table-card" id="table-card"></section>`;
  }

  /* --- table --- */
  const COLS = [
    ['name', 'Campaign / Ads'], ['creative', 'Creative'], ['reach', 'Reach'], ['impressions', 'Impressions'], ['cpm', 'CPM'], ['ctr', 'CTR'],
    ['costMessage', 'Cost / Msg'], ['cqc', 'CQC'], ['purchases', 'Purchases'], ['spend', 'Spend'], ['cpc', 'CPC'], ['qualityScore', 'Chat Quality'],
  ];
  function sparkSvg(vals, label) {
    const color = { excellent: '#44602f', good: '#44602f', average: '#44602f', poor: '#d6204b', none: '#9aa39e' }[label] || '#44602f';
    const max = Math.max(...vals, 1); const w = 54; const h = 22;
    const pts = vals.map((v, i) => `${(i * (w - 2) / Math.max(vals.length - 1, 1) + 1).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  const QLABEL = { excellent: 'Excellent', good: 'Good', average: 'Average', poor: 'Poor' };

  function renderTable() {
    const card = document.getElementById('table-card') || document.getElementById('table-card-chat');
    if (!card || !S.dash.data) return;
    const d = S.dash;
    const q = d.search.trim().toLowerCase();
    let rows = d.data.ads.filter((r) => !q || [r.name, r.campaign, r.adset, r.id].some((s) => String(s).toLowerCase().includes(q)));
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
    card.innerHTML = `<div class="table-head"><div><h2>Campaign performance</h2><p>Ad-level results joined with sales chat quality · ${d.data.ads.length} ads</p></div>
      <label class="search">${icon('search')}<input id="tsearch" data-bind="search" placeholder="Search campaign or ad" value="${esc(d.search)}" autocomplete="off"></label></div>
      <div class="tscroll"><table><thead><tr>${COLS.map(([k, l]) => `<th data-act="sort" data-key="${k}" class="${k === 'creative' ? 'nosort' : ''}">${l}${d.sort === k ? (d.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${slice.length ? slice.map((r) => `<tr>
        <td><div class="ad-name" title="${esc(r.name)}">${esc(r.name)}</div><div class="ad-sub">${esc(r.campaign)}${r.adset ? ' – ' + esc(r.adset) : ''} · ${esc(r.id)}</div></td>
        <td><div class="creative">
          <label class="dash-thumb-wrap" title="${r.thumb ? 'คลิกเพื่อเปลี่ยนรูปภาพ' : 'คลิกเพื่อใส่รูปโฆษณา'}">
            ${r.thumb
              ? `<img class="thumb" src="${esc(r.thumb)}" alt="" referrerpolicy="no-referrer" loading="lazy"><span class="thumb-badge">📷</span>`
              : `<span class="thumb ct-${esc(String(r.creative).toLowerCase())}" style="border:1.5px dashed var(--brand);color:var(--brand);font-size:11px;font-weight:600;background:#f5f7f2">+ รูป</span>`}
            <input type="file" accept="image/*" style="display:none" data-act="dash-ad-img" data-ad-id="${esc(r.id)}" data-ad-name="${esc(r.name)}">
          </label>
          <span class="creative-lbl">${esc(cap(String(r.creative || 'IMAGE').toLowerCase()))}</span>
        </div></td>
        <td>${num(r.reach)}</td><td>${num(r.impressions)}</td><td>${baht(r.cpm)}</td><td>${pct(r.ctr)}</td><td>${baht(r.costMessage)}</td>
        <td>${r.cqc === null ? '—' : baht(r.cqc)}</td><td>${num(r.purchases)}</td><td class="spend">${baht(r.spend)}</td><td>${baht(r.cpc)}</td>
        <td><div class="q-cell">${sparkSvg(r.spark, r.qualityLabel)}<span class="q-badge q-${r.qualityLabel}">${r.qualityScore === null ? 'No chats' : `${QLABEL[r.qualityLabel]} · ${r.qualityScore}%`}</span></div></td></tr>`).join('')
        : `<tr><td colspan="${COLS.length}"><div class="empty">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div></td></tr>`}</tbody></table></div>
      <div class="pager"><span>Page ${d.pageNo} of ${pages} · ${rows.length} ads</span><div class="btns">
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
      ${chartHtml('spend', 'Spend per day (฿)', t.dates, t.spend, '#44602f', 'bar', baht)}
      ${chartHtml('messages', 'Messages per day', t.dates, t.messages, '#2457c5', 'line', num)}
      ${chartHtml('purchases', 'Purchases per day', t.dates, t.purchases, '#b86e00', 'line', num)}
      ${chartHtml('leads', 'Chat leads per day', t.dates, t.leads, '#7a3fc4', 'line', num)}</div>`;
  }

  /* --- tab: dropped --- */
  function tabDropped(data) {
    const p = data.dropped;
    if (!p.total) return '<div class="card empty">ไม่มีลีดที่หลุดในช่วงที่เลือก 🎉</div>';
    return `<div class="grid-2">
      <section class="card panel"><h3>Dropped leads</h3><p class="sub">${num(p.total)} ลีด · ${p.rate}% ของลีดทั้งหมด</p>${barRows(p.reasons.map((r) => ({ key: r.reason, count: r.count })), (i) => i.key)}</section>
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
    const iconSym = CHAN_ICON[norm] || CHAN_ICON[c] || '💬';
    const col = CHAN_COLOR[norm] || CHAN_COLOR[c] || '#8a948f';
    const bgCol = norm === 'Instagram' ? '#fdf2f8' : norm === 'Facebook' ? '#eff6ff' : norm === 'LINE' ? '#f0fdf4' : '#f4f6f8';
    return `<span class="chan" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;background:${bgCol};color:${col};border:1px solid ${col}33"><span>${iconSym}</span>${esc(norm)}</span>`;
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
    const allPages = (S.filters && S.filters.pages) || [];
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

  function loadList(scope) { return scope === 'inbox' ? loadInbox() : scope === 'review' ? loadReview() : loadBoard(); }

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

  // ช่องพิมพ์ตอบลูกค้า ใช้ทั้งใน Inbox และ drawer
  function composerHtml(d) {
    const c = S.chat;
    return `<form class="reply-form" data-form="reply"><textarea name="text" rows="2" maxlength="2000" placeholder="พิมพ์ข้อความตอบลูกค้า… (Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่)" ${c.sending ? 'disabled' : ''}></textarea>
      <button class="btn primary" type="submit" ${c.sending ? 'disabled' : ''}>${icon('send')}${c.sending ? 'กำลังส่ง…' : 'ส่ง'}</button></form>
      ${c.msg ? `<div class="notice ${c.msg.type} reply-msg">${esc(c.msg.text)}</div>` : ''}
      <div class="reply-note">${d && d.demo ? 'โหมดเดโม: ข้อความจะถูกบันทึกในระบบเท่านั้น ไม่ได้ส่งถึงลูกค้าจริง' : 'ส่งผ่าน Meta Messenger Platform · ตอบได้ภายใน 24 ชม. หลังลูกค้าทักล่าสุด'}</div>`;
  }

  const tomorrow = () => { const t = new Date(); t.setDate(t.getDate() + 1); return ymd(t); };
  function followFormHtml() {
    const fu = S.chat.data && S.chat.data.followup; const act = fu && !fu.done;
    return `<form class="fu-form" data-form="followup"><h4>นัดตามลูกค้า</h4>
      <div class="fu-row"><input class="date-in" type="date" name="dueDate" value="${esc(act ? fu.dueDate : tomorrow())}" required aria-label="วันที่ตาม">
      <input type="text" name="note" maxlength="300" placeholder="บันทึก เช่น โทรถามเรื่องนัดตรวจ" value="${act ? esc(fu.note) : ''}"></div>
      <div class="row-actions"><button class="btn primary" type="submit">${act ? 'อัปเดตนัด' : 'ตั้งนัดตาม'}</button>${act ? '<button class="btn" type="button" data-act="fu-done">ปิดงานตาม</button>' : ''}</div></form>`;
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
        return `${sep}<div class="msg ${m.from === 'staff' ? 'out' : 'in'}"><div class="bubble">${esc(m.text)}</div><small>${m.from === 'staff' ? (m.by ? esc(m.by) : 'ทีมขาย') + ' · ' : ''}${esc(time)}</small></div>`;
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

  async function loadInbox() { if (await fetchList('inbox', '/api/inbox')) renderInboxBody(); }

  function inboxShell() {
    return `<div class="page-head inbox-head"><h1>Inbox</h1><div class="inline-range">${rangeBar('inbox')}</div></div>
      <div id="inbox-body"><div class="loading">Loading…</div></div>`;
  }

  function filteredRows() {
    const s = S.inbox; if (!s.data) return [];
    const q = s.search.trim().toLowerCase();
    return s.data.rows.filter((r) => (!s.channel || r.channel === s.channel) && (!s.status || r.status === s.status)
      && (!q || [r.name, r.id, r.ad].some((x) => String(x).toLowerCase().includes(q))));
  }

  function renderInboxBody() {
    const box = $id('inbox-body'); const s = S.inbox; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err">${esc(s.err)}</div>`; return; }
    if (!s.data) return;
    box.innerHTML = `<div class="mess">
      <section class="mess-list">
        <div class="ml-head"><h2>แชท</h2><span class="ml-count" id="ml-count"></span></div>
        <label class="search">${icon('search')}<input id="isearch" data-bind="isearch" placeholder="ค้นหาแชท" value="${esc(s.search)}" autocomplete="off"></label>
        <div id="mess-tools"></div>
        <div class="conv-list" id="mess-list"></div>
      </section>
      <section class="mess-chat" id="mess-chat"></section>
      <aside class="mess-info" id="mess-info"></aside></div>`;
    renderInboxTools(); renderInboxList();
    if (s.focus) { const id = s.focus; s.focus = ''; openChat(id); return; } // มาจากหน้า Board (SLA)
    const ids = new Set(s.data.rows.map((r) => r.id));
    if (S.chat.id && ids.has(S.chat.id)) { renderInboxChat(); renderInboxInfo(); }
    else {
      const first = filteredRows()[0] || s.data.rows[0];
      if (first) openChat(first.id); else { S.chat.id = null; renderInboxChat(); renderInboxInfo(); }
    }
  }

  function renderInboxTools() {
    const el = $id('mess-tools'); const s = S.inbox; if (!el || !s.data) return;
    const channels = [...new Set(s.data.rows.map((r) => r.channel))].sort();
    el.innerHTML = `<div class="pills">${[['', 'ทั้งหมด'], ...STATUS_ORDER.map((k) => [k, STATUS_TH[k]])]
      .map(([k, l]) => `<button class="pill ${s.status === k ? 'active' : ''}" data-act="istatus" data-status="${k}">${l}</button>`).join('')}</div>
      <div class="sel"><select data-bind="ichannel" aria-label="ช่องแชต"><option value="">ทุกช่องแชต</option>
      ${channels.map((c) => `<option value="${esc(c)}" ${c === s.channel ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`;
  }

  function renderInboxList() {
    const list = $id('mess-list'); if (!list) return;
    const rows = filteredRows(); const MAX = 300;
    const cnt = $id('ml-count'); if (cnt) cnt.textContent = `${num(rows.length)} แชท`;
    if (!rows.length) { list.innerHTML = '<div class="empty">ไม่พบแชทในช่วงวันที่หรือตัวกรองที่เลือก</div>'; return; }
    list.innerHTML = rows.slice(0, MAX).map((r) => {
      const pv = r.last ? `${r.last.from === 'staff' ? 'คุณ: ' : ''}${esc(r.last.text)} · ${ago(r.last.at)}` : `ยังไม่มีข้อความ · ${esc(r.date)}`;
      return `<button class="conv ${r.id === S.chat.id ? 'active' : ''}" data-act="select-chat" data-id="${esc(r.id)}">${avatarHtml(r.name, r.id, 48)}
        <span class="conv-main"><b>${(r.platform === 'Instagram' || r.channel === 'Instagram') ? '<span style="font-size:13px" title="Instagram">📸</span>' : (r.platform === 'LINE' || r.channel === 'LINE') ? '<span style="font-size:13px" title="LINE">📱</span>' : (r.platform === 'WhatsApp' || r.channel === 'WhatsApp') ? '<span style="font-size:13px" title="WhatsApp">💚</span>' : '<span style="font-size:13px" title="Facebook Messenger">🔵</span>'} ${esc(r.name)}${(r.platform === 'Instagram' || r.channel === 'Instagram') ? '<small style="display:inline;font-size:11px;color:#c13584;background:#fce7f3;padding:1px 6px;border-radius:4px;margin-left:5px;font-weight:700">Instagram</small>' : '<small style="display:inline;font-size:11px;color:#1877f2;background:#e0f2fe;padding:1px 6px;border-radius:4px;margin-left:5px;font-weight:700">Facebook</small>'}${r.pageName ? `<small style="display:inline;font-size:11px;color:var(--brand-deep);background:#e4eedc;padding:1px 6px;border-radius:4px;margin-left:5px">${esc(r.pageName)}</small>` : ""}</b><small>${pv}</small></span>
        <i class="s-dot" style="background:${STATUS_COLOR[r.status] || '#8a948f'}" title="${esc(STATUS_TH[r.status] || r.status)}"></i></button>`;
    }).join('') + (rows.length > MAX ? `<div class="ad-sub" style="text-align:center;padding:10px">แสดง ${MAX} จาก ${num(rows.length)} แชท ใช้ช่องค้นหาเพื่อกรอง</div>` : '');
  }

  function currentLead() {
    const c = S.chat; if (!c.id) return null;
    return (c.data && c.data.lead) || (S.inbox.data && S.inbox.data.rows.find((r) => r.id === c.id)) || null;
  }

  function renderInboxChat() {
    const box = $id('mess-chat'); if (!box) return;
    const c = S.chat; const l = currentLead();
    if (!l) { box.innerHTML = '<div class="empty" style="margin:auto">เลือกแชทจากรายการด้านซ้าย</div>'; return; }
    const d = c.data; let body;
    if (c.err) body = `<div class="notice err" style="margin:16px">${esc(c.err)}</div>`;
    else if (c.loading || !d) body = '<div class="loading">Loading…</div>';
    else if (!d.messages.length) body = '<div class="empty">ยังไม่มีข้อความของแชทนี้<br>ต้องเชื่อมระบบแชทของคลินิกเพื่อดึงข้อความจริง</div>';
    else {
      const ms = d.messages;
      body = ms.map((m, i) => {
        const gap = i === 0 || atMs(m.at) - atMs(ms[i - 1].at) >= 3600e3 || m.at.slice(0, 10) !== ms[i - 1].at.slice(0, 10);
        const sep = gap ? `<div class="day-sep"><span>${esc(sepLabel(m.at))}</span></div>` : '';
        return `${sep}<div class="msg ${m.from === 'staff' ? 'out' : 'in'}"><div class="bubble" title="${esc(m.at)}">${esc(m.text)}</div></div>`;
      }).join('');
      const last = ms[ms.length - 1];
      if (last.from === 'staff') { const a = ago(last.at); body += `<div class="sent">${a === 'ตอนนี้' ? 'ส่งเมื่อสักครู่' : `ส่งเมื่อ ${esc(a)}ที่แล้ว`}</div>`; }
    }
    box.innerHTML = `<header class="mc-head">${avatarHtml(l.name, l.id, 40)}<div><b>${esc(l.name)}</b><div>${chanHtml(l.channel)}</div></div><span class="grow"></span>${statusHtml(l.status)}</header>
      <div class="chat-scroll" id="chat-scroll">${body}</div>
      ${d && d.demo ? '<div class="demo-note">ข้อความตัวอย่าง (โหมดเดโม)</div>' : ''}
      <div class="composer-wrap">${d && !c.err && !c.loading ? composerHtml(d) : ''}</div>`;
    const sc = $id('chat-scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function renderInboxInfo() {
    const box = $id('mess-info'); if (!box) return;
    const l = currentLead();
    if (!l) { box.innerHTML = ''; return; }
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    box.innerHTML = `<div class="info-top">${avatarHtml(l.name, l.id, 80)}<b>${esc(l.name)}</b>${chanHtml(l.channel)}${statusHtml(l.status)}</div>
      <details open><summary>ข้อมูลแชท</summary><dl>${row('ช่องแชต', esc(l.channel))}${row('วันเริ่มคุย', esc(l.date))}${row('ความคืบหน้า', esc(STATUS_TH[l.status] || l.status))}${row('โฆษณา', esc(l.ad || '—'))}</dl></details>
      <details open><summary>จัดการลีด</summary><div class="info-tools">${statusSelectHtml(l)}${S.chat.data && S.chat.data.lead && S.chat.data.lead.id === l.id ? followFormHtml() : ''}</div></details>
      ${S.chat.data && S.chat.data.review ? `<details open><summary>รีวิวแชท</summary><dl>${row('คะแนน', `<span class="q-badge q-${scoreClass(S.chat.data.review.score)}">${S.chat.data.review.score}%</span>`)}${row('ผู้ตรวจ', esc(S.chat.data.review.reviewer))}${row('ความเห็น', esc(S.chat.data.review.note || '—'))}</dl></details>` : ''}
      <details open><summary>การขาย</summary><dl>${row('ผู้ดูแล', esc(l.rep || '—'))}${row('ยอดขาย', l.value ? baht(l.value) : '—')}${row('หมายเหตุ', esc(l.reason || '—'))}</dl></details>`;
  }

  function renderChatViews() {
    if (S.route === 'inbox') {
      document.querySelectorAll('.conv').forEach((el) => el.classList.toggle('active', el.dataset.id === S.chat.id));
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
    commute: ['ช้า · ช่วงเดินทาง ไม่หัก', 'q-average'], late_night: ['ช้า · กลางคืน ไม่หัก', 'q-none'],
  };
  const SLA_KINDS = [['', 'ทั้งหมด'], ['deduct', 'หักคะแนน'], ['commute', 'ช้าช่วงเดินทาง'], ['night', 'ตอบนอกเวลา 22:00–08:00']];
  function renderSlaBody() {
    const box = $id('sla-body'); const s = S.sla; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err" style="margin-bottom:14px">${esc(s.err)}</div>`; return; }
    if (!s.data) { box.innerHTML = '<div class="loading" style="padding:30px">Loading…</div>'; return; }
    const d = s.data; const t = d.totals;
    const open = d.reps.find((r) => r.repId === s.open);
    const evs = open ? open.events.filter((e) => !s.kind || (s.kind === 'night' ? e.replyWindow === 'night' : e.outcome === s.kind)) : [];
    box.innerHTML = `<section class="card panel sla-panel"><h3>SLA ตอบแชทภายใน ${d.limitMin} นาที</h3>
      <p class="sub">นับจากเวลาที่ลูกค้าทัก · 10:00–19:00 ตอบช้าหัก 1 แต้ม (สูงสุด 1 แต้มต่อแชทต่อเพจ) · 08:00–10:00 และ 19:00–22:00 ไม่หักแต่เก็บเป็นสถิติตอบช้า · 22:00–08:00 ไม่หัก และเก็บสถิติถ้าเซลส์ตอบในช่วงนี้</p>
      <div class="grid-4" style="margin-bottom:16px">
        <div class="stat"><div class="k-label">แต้มที่ถูกหักรวม</div><div class="k-value" style="color:${t.deducted ? 'var(--coral)' : 'inherit'}">${t.deducted ? '−' + num(t.deducted) : '0'}</div></div>
        <div class="stat"><div class="k-label">ตอบทัน / ตรวจทั้งหมด</div><div class="k-value">${num(t.onTime)} / ${num(t.turns)}</div></div>
        <div class="stat"><div class="k-label">ช้าช่วงเดินทาง (สถิติ)</div><div class="k-value">${num(t.commuteLate)}</div></div>
        <div class="stat"><div class="k-label">ตอบนอกเวลา 22:00–08:00</div><div class="k-value">${num(t.nightReplies)}</div></div></div>
      <div class="tscroll"><table style="min-width:900px"><thead><tr><th class="nosort">เซลส์</th><th>ตรวจ</th><th>ทันเวลา</th><th>ช้า</th><th>แต้มที่ถูกหัก</th><th>ช้าช่วงเดินทาง</th><th>ตอบนอกเวลา</th><th>ตอบเฉลี่ย</th></tr></thead><tbody>
      ${d.reps.length ? d.reps.map((r) => `<tr class="click-row ${r.repId === s.open ? 'sel-row' : ''}" data-act="sla-rep" data-rep="${esc(r.repId)}">
        <td><b>${esc(r.rep)}</b></td><td>${num(r.turns)}</td><td>${num(r.onTime)}</td><td>${num(r.late)}</td>
        <td>${r.deducted ? `<span class="q-badge q-poor">−${num(r.deducted)}</span>` : '<span class="q-badge q-excellent">0</span>'}</td>
        <td>${num(r.commuteLate)}</td><td>${num(r.nightReplies)}</td><td>${r.avgMin === null ? '—' : fmtDur(r.avgMin)}</td></tr>`).join('')
        : '<tr><td colspan="8"><div class="empty">ยังไม่มีข้อมูลการตอบแชทในช่วงที่เลือก</div></td></tr>'}</tbody></table></div>
      <p class="rv-hint" style="margin:10px 0 0">คลิกแถวเซลส์เพื่อดูรายการ · คลิกรายการเพื่อเปิดแชทนั้นที่หน้า Inbox</p>
      ${open ? `<div class="sla-detail"><h4>${esc(open.rep)} · ${num(open.eventTotal)} รายการ</h4>
        <div class="pills" style="margin-bottom:10px">${SLA_KINDS.map(([k, l]) => `<button class="pill ${s.kind === k ? 'active' : ''}" data-act="sla-kind" data-kind="${k}">${l}</button>`).join('')}</div>
        <div class="tscroll"><table style="min-width:860px"><thead><tr><th class="nosort">ลูกค้า / เพจ</th><th class="nosort">ลูกค้าทัก</th><th class="nosort">เซลส์ตอบ</th><th class="nosort">ใช้เวลา</th><th class="nosort">ผล</th></tr></thead><tbody>
        ${evs.length ? evs.map((e) => `<tr class="click-row" data-act="sla-open" data-id="${esc(e.leadId)}" data-date="${esc(e.leadDate)}">
          <td><div class="ad-name">${esc(e.name)}</div><div class="ad-sub">${esc(e.page || '—')} · ${esc(e.channel)}</div></td>
          <td class="nowrap">${esc(sepLabel(e.customerAt))}<div class="ad-sub">${SLA_WIN[e.window]}</div></td>
          <td class="nowrap">${e.replyAt ? `${esc(sepLabel(e.replyAt))}<div class="ad-sub">${e.replyWindow === 'night' ? 'ตอบช่วง 22:00–08:00' : SLA_WIN[e.replyWindow]}</div>` : '<span class="q-badge q-poor">ยังไม่ตอบ</span>'}</td>
          <td class="nowrap">${fmtDur(e.minutes)}</td>
          <td><span class="q-badge ${SLA_OUT[e.outcome][1]}">${SLA_OUT[e.outcome][0]}</span></td></tr>`).join('')
          : '<tr><td colspan="5"><div class="empty">ไม่มีรายการในหมวดนี้</div></td></tr>'}</tbody></table></div>
        ${open.eventTotal > open.events.length ? `<div class="ad-sub" style="padding:8px;text-align:center">แสดง ${open.events.length} จาก ${num(open.eventTotal)} รายการล่าสุด</div>` : ''}</div>` : ''}
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

    return `<div class="lead" draggable="true" data-lead-id="${esc(l.id)}" data-lead-status="${esc(l.status)}" data-act="open-chat" data-id="${esc(l.id)}">
      <div class="lead-head">
        <b>${esc(l.name)}</b>
        <span style="display:inline-flex;align-items:center;gap:4px">
          ${l.pageName ? `<span class="ad-sub" style="font-size:11px;color:var(--muted)">${esc(l.pageName)}</span>` : ''}
          ${chanHtml(l.channel)}
        </span>
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

  function renderBoardBody() {
    const box = document.getElementById('board-body'); const s = S.board; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err">${esc(s.err)}</div>`; return; }
    if (!s.data) return;
    const d = s.data;
    box.innerHTML = `<div class="meta-line" style="margin:0 0 12px 4px"><span>${num(d.total)} แชท · ${esc(d.range.from)} → ${esc(d.range.to)} · 💡 ลากการ์ดสีขาวไปวางที่กล่องสถานะที่ต้องการได้เลย</span></div>
      <div class="kanban">${d.columns.map((c) => `<section class="col" data-col-status="${c.status}">
        <h4><span><i class="col-dot" style="background:${STATUS_COLOR[c.status]}"></i>${STATUS_TH[c.status]}</span><span>${num(c.total)}</span></h4>
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
    return `<div class="page-head"><div><h1>ตามลูกค้า</h1><div class="meta-line"><span>ลูกค้าที่รอคำตอบ ถึงเวลาตามต่อ และนัดตามที่ตั้งไว้ (ลีดย้อนหลัง 90 วัน ไม่นับที่ปิดการขายแล้ว)</span></div></div>
      <button class="btn" data-act="fu-refresh">${icon('refresh')}Refresh</button></div><div id="follow-body"><div class="loading">Loading…</div></div>`;
  }
  const KIND_TH = { reply: ['ลูกค้ารอตอบ', 'q-poor'], chase: ['ถึงเวลาตามต่อ', 'q-average'], scheduled: ['นัดตามไว้', 'q-good'] };
  function renderFollowBody() {
    const box = $id('follow-body'); const s = S.followup; if (!box) return;
    if (s.err) { box.innerHTML = `<div class="notice err">${esc(s.err)}</div>`; return; }
    if (!s.data) return;
    const d = s.data; const st = d.stats;
    const rows = d.rows.filter((r) => !s.tab || (s.tab === 'scheduled' ? r.dueDate : r.kind === s.tab));
    const tabs = [['', 'ทั้งหมด', d.total], ['reply', 'ลูกค้ารอตอบ', st.reply], ['chase', 'ถึงเวลาตามต่อ', st.chase], ['scheduled', 'นัดตามไว้', st.scheduled]];
    box.innerHTML = `<div class="grid-4" style="margin-bottom:16px">
        <div class="stat"><div class="k-label">ลูกค้ารอตอบ</div><div class="k-value">${num(st.reply)}</div></div>
        <div class="stat"><div class="k-label">ถึงเวลาตามต่อ (เงียบ &gt; 24 ชม.)</div><div class="k-value">${num(st.chase)}</div></div>
        <div class="stat"><div class="k-label">นัดตามเกินกำหนด / วันนี้</div><div class="k-value">${num(st.due)}</div></div>
        <div class="stat"><div class="k-label">นัดตามทั้งหมด</div><div class="k-value">${num(st.scheduled)}</div></div></div>
      <section class="card filters"><div class="pills">${tabs.map(([k, l, n]) => `<button class="pill ${s.tab === k ? 'active' : ''}" data-act="ftab" data-tab="${k}">${l} (${num(n)})</button>`).join('')}</div>
        <span class="label">ทีมขาย</span>${repSelect('frep', s.rep)}</section>
      <section class="card table-card"><div class="tscroll"><table style="min-width:860px"><thead><tr><th class="nosort">ลูกค้า</th><th class="nosort">ข้อความล่าสุด</th><th class="nosort">สถานะตาม</th><th class="nosort">ความคืบหน้า</th><th class="nosort">ผู้ดูแล</th><th class="nosort">นัด / บันทึก</th></tr></thead><tbody>
      ${rows.length ? rows.map((r) => `<tr class="click-row" data-act="open-chat" data-id="${esc(r.id)}">
        <td><div class="ad-name">${esc(r.name)}</div><div class="ad-sub">${chanHtml(r.channel)}</div></td>
        <td><div class="fu-last">${r.lastFrom === 'staff' ? 'คุณ: ' : ''}${esc(r.lastText)}</div><div class="ad-sub">${r.lastAt ? ago(r.lastAt) + 'ที่แล้ว' : ''}</div></td>
        <td><span class="q-badge ${r.overdue ? 'q-poor' : KIND_TH[r.kind][1]}">${r.overdue && r.kind === 'scheduled' ? 'นัดเกินกำหนด' : KIND_TH[r.kind][0]}</span></td>
        <td>${statusHtml(r.status)}</td><td>${esc(r.rep || '—')}</td>
        <td>${r.dueDate ? `<b>${esc(r.dueDate)}</b><div class="ad-sub">${esc(r.note)}</div>` : '—'}</td></tr>`).join('')
        : '<tr><td colspan="6"><div class="empty">ไม่มีลูกค้าที่ต้องตามในตอนนี้ 🎉</div></td></tr>'}</tbody></table></div>
      ${d.total > d.rows.length ? `<div class="ad-sub" style="padding:10px;text-align:center">แสดง ${d.rows.length} จาก ${num(d.total)} รายการ</div>` : ''}</section>`;
  }

  /* --- รีวิวแชท --- */
  async function loadReview() { ensureFilters(); loadSla(); if (await fetchList('review', '/api/review')) renderReviewBody(); }
  function reviewShell() {
    return `<div class="page-head"><div><h1>⏱️ รายงาน SLA (SLA Performance)</h1><div class="meta-line"><span>ประเมินคะแนน SLA การตอบแชทและคอมเมนต์ของเซลส์และแอดมิน (เกณฑ์ 15 นาที)</span></div></div></div>
      <div id="sla-body" style="margin-bottom:16px"></div>${rangeBar('review')}<div id="review-body"><div class="loading">Loading…</div></div>`;
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
    if (S.route === 'inbox') renderInboxList();
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
    } catch (e) { S.chat.msg = { type: 'err', text: e.message }; }
    renderChatViews(); if (S.route === 'inbox') { renderInboxTools(); renderInboxList(); }
    if (S.route === 'followup') loadFollowups();
  }

  /* ---------------- settings ---------------- */
  async function loadSettings() {
    try { S.settings = await api('/api/settings'); } catch (e) { S.flash = { type: 'err', text: e.message }; }
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
  
  function pagesPanelHtml() {
    const pages = (S.filters && S.filters.pages) || [];
    const rows = pages.map((p) => {
      const colorDot = `<span class="page-dot" style="background:${p.color || '#1877f2'};margin-right:6px"></span>`;
      const platformIcon = p.platform === 'LINE' ? '📱' : p.platform === 'WhatsApp' ? '💚' : p.platform === 'Instagram' ? '📸' : '🔵';
      return `<tr>
        <td><b>${colorDot}${esc(p.name)}</b></td>
        <td><span class="chip" style="font-size:12px">${platformIcon} ${esc(p.platform || 'Facebook')}</span></td>
        <td><code>${esc(p.id)}</code></td>
        <td>${p.adAccountId ? `<span class="chip good" style="font-size:12px;font-family:monospace">📊 ${esc(p.adAccountId)}</span>` : '<span class="rv-hint">ใช้ Ad กลาง</span>'}</td>
        <td class="nowrap" style="display:flex;gap:6px">
          <button class="btn" type="button" data-act="page-edit" data-page='${esc(JSON.stringify(p))}' style="padding:4px 10px;font-size:12px">✏️ แก้ไข</button>
          ${(p.platform === 'Facebook' || p.platform === 'Instagram') ? `<button class="btn" type="button" data-act="fb-import-conv" data-page-id="${esc(p.id)}" data-page-name="${esc(p.name)}" style="padding:4px 10px;font-size:12px">📥 ดึงแชท</button><button class="btn" type="button" data-act="sync-page-posts" data-page-id="${esc(p.id)}" data-page-name="${esc(p.name)}" style="padding:4px 10px;font-size:12px;background:#eaf2e8;color:#244c1d">💬 ดึงโพสต์</button>` : ''}
          <button class="btn danger" type="button" data-act="page-delete" data-page-id="${esc(p.id)}" style="padding:4px 10px;font-size:12px">ลบ</button>
        </td>
      </tr>`;
    }).join('');

    return `<section class="card panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h3 style="margin:0">🏢 ตารางเพจและช่องทางในระบบ</h3>
          <p class="sub" style="margin:4px 0 0">กด <b>"✏️ แก้ไข"</b> ที่เพจใดเพื่อโหลดขึ้นไปแก้ไขในกล่องด้านบน หรือกด <b>"ลบ"</b> ได้ทันที</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn primary" type="button" data-act="meta-discover" style="font-size:13px">🔄 ดึงเพจทั้งหมดจาก Token</button>
          <button class="btn" type="button" data-act="fb-import-all" style="font-size:13px">📥 ดึงแชทย้อนหลังทุกเพจ</button>
          <button class="btn" type="button" data-act="meta-posts-sync-all" style="font-size:13px;background:#2d5022;color:#fff">💬 ดึง Post & comment ทุกเพจ</button>
        </div>
      </div>
      <div class="tscroll" style="margin:14px 0 0">
        <table style="min-width:540px">
          <thead><tr><th>ชื่อเพจ</th><th>แพลตฟอร์ม</th><th>Page ID (แชท)</th><th>Meta Ad Account ID (โฆษณา)</th><th class="nosort">จัดการ</th></tr></thead>
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
              <h3 style="margin:0">🔗 เชื่อมต่อ Meta API</h3>
              <p class="sub" style="margin:4px 0 0">วาง Token ดูแลทั้ง 3 เพจ แล้วกดบันทึกหรือดึงเพจ</p>
            </div>
            <button class="btn primary" type="button" data-act="meta-discover" style="font-size:12px;padding:6px 12px">🔄 ดึงเพจทั้งหมด</button>
          </div>
          <form class="form" data-form="meta" autocomplete="off" style="margin-top:14px">
            <div class="field"><label>ชื่อคลินิก / องค์กร</label><input type="text" name="clinicName" value="${esc(s.clinicName)}" placeholder="เช่น BEQ GROUP" maxlength="80"></div>
            <div class="field"><label>Meta Ad Account ID หลัก</label><input type="text" name="adAccountId" value="${esc(m.adAccountId)}" placeholder="เช่น 1234567890 หรือ act_1234567890" inputmode="numeric"><small>ดูได้ที่ Ads Manager (ตัวเลขหลัง act_)</small></div>
            <div class="field"><label>Access Token ${m.hasToken ? `<span class="chip good" style="margin-left:6px">บันทึกแล้ว ${esc(m.tokenHint)}</span>` : ''}</label>
              <input type="password" name="accessToken" placeholder="${m.hasToken ? 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน' : 'วาง System User Token ที่นี่'}" autocomplete="new-password">
              <small>สิทธิ์: <code>pages_show_list</code>, <code>pages_messaging</code>, <code>ads_read</code></small>
            </div>
            <details style="margin:10px 0;background:#f9f8f4;padding:10px 14px;border-radius:8px;border:1px solid var(--line-soft)">
              <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text-soft)">⚙️ ตัวเลือกขั้นสูง (App ID / Secret)</summary>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
                <div class="field" style="margin:0"><label>App ID</label><input type="text" name="appId" value="${esc(m.appId)}" placeholder="App ID"></div>
                <div class="field" style="margin:0"><label>App Secret</label><input type="password" name="appSecret" placeholder="${m.hasSecret ? 'บันทึกแล้ว' : 'App Secret'}" autocomplete="new-password"></div>
              </div>
              <div class="field" style="margin:10px 0 0"><label>API Version</label><input type="text" name="apiVersion" value="${esc(m.apiVersion)}" placeholder="v21.0"></div>
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
            <button class="btn" type="button" id="p-cancel-btn" style="display:none;font-size:12px;padding:4px 8px" onclick="document.getElementById('page-edit-form').reset();document.getElementById('page-edit-heading').textContent='➕ เพิ่มหรือแก้ไขข้อมูลเพจ';this.style.display='none';">ล้างฟอร์ม</button>
          </div>
          <p class="sub" style="margin:4px 0 14px">ตั้งชื่อเล่นเพจ, แก้ไข Page ID, ผูก Ad Account หรือเปลี่ยนแพลตฟอร์ม</p>
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
            <div class="field"><label>Meta Ad Account ID สำหรับเพจนี้ (ไม่บังคับ)</label><input type="text" id="p-adAccountId" name="adAccountId" placeholder="เช่น act_12345 หรือตัวเลข"><small>หากไม่ใส่ จะใช้ Ad Account หลักจากกล่องซ้ายมือ</small></div>
            <div class="row-actions" style="margin-top:16px">
              <button class="btn primary" type="submit" id="p-submit-btn" style="width:100%;justify-content:center">💾 บันทึกข้อมูลเพจ</button>
            </div>
          </form>
        </section>
      </div>

      <section class="card panel"><h3>Webhook รับข้อความ Facebook Messenger & Instagram Direct</h3>
        <p class="sub">ให้ Meta ส่งข้อความลูกค้าทั้งจาก Facebook และ Instagram เข้ามาที่ระบบนี้อัตโนมัติ (URL เดียวกัน)</p>
        <div class="form">
          <div class="field"><label>Callback URL</label><input type="text" readonly value="${esc(location.origin + s.webhook.path)}" onclick="this.select()"><small>ถ้ายังรันบนเครื่องตัวเอง ให้ใช้ tunnel เช่น Cloudflare Tunnel / ngrok แล้วใช้ URL ที่ได้ + <code>/webhook</code></small></div>
          <div class="field"><label>Verify Token</label><input type="text" readonly value="${esc(s.webhook.verifyToken)}" onclick="this.select()"><small>นำไปกรอกช่อง Verify token ตอนตั้ง Webhook ที่ Meta</small></div>
          <div class="field"><label>สถานะ App Secret</label><div>${s.webhook.hasSecret ? '<span class="chip good">บันทึกแล้ว — ตรวจลายเซ็น Webhook ได้</span>' : '<span class="chip">ยังไม่ได้บันทึก — ระบบจะปฏิเสธทุกข้อความจากเพจจนกว่าจะกรอก App Secret ด้านบน</span>'}</div></div></div>
        <ol class="steps"><li>ที่ Meta App → Messenger (หรือ Instagram Graph API) → Webhooks กรอก Callback URL และ Verify Token ด้านบน</li>
          <li>Subscribe ฟิลด์ <code>messages</code>, <code>message_echoes</code>, <code>messaging_referrals</code> (สำหรับ Facebook) และ <code>messages</code> (สำหรับ Instagram)</li>
          <li>ผูกเพจและบัญชี IG เข้ากับ Webhook (Add subscriptions) และให้สิทธิ์ <code>pages_messaging</code>, <code>instagram_basic</code>, <code>instagram_manage_messages</code></li></ol></section>

      <section class="card panel"><h3>เชื่อมต่อ LINE Official Account (Messaging API)</h3>
        <p class="sub">เชื่อมต่อกับ LINE Developers เพื่อดึงข้อความจากลูกค้า LINE OA เข้ามาในระบบ</p>
        <form class="form" data-form="line-settings" autocomplete="off">
          <div class="field"><label>Channel ID</label><input type="text" name="channelId" value="${esc((s.line && s.line.channelId) || '')}" placeholder="เช่น 2001234567"></div>
          <div class="field"><label>Channel Secret ${(s.line && s.line.hasSecret) ? '<span class="chip good" style="margin-left:6px">บันทึกแล้ว</span>' : ''}</label><input type="password" name="channelSecret" placeholder="${(s.line && s.line.hasSecret) ? 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน' : 'คัดลอกจาก LINE Developers Console'}" autocomplete="new-password"></div>
          <div class="field"><label>Channel Access Token (long-lived) ${(s.line && s.line.hasToken) ? `<span class="chip good" style="margin-left:6px">บันทึกแล้ว ${esc(s.line.tokenHint)}</span>` : ''}</label><input type="password" name="channelAccessToken" placeholder="${(s.line && s.line.hasToken) ? 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน' : 'Issue token ที่แท็บ Messaging API'}" autocomplete="new-password"></div>
          <div class="field"><label>Webhook URL สำหรับใส่ใน LINE Console</label><input type="text" readonly value="${esc(location.origin + ((s.line && s.line.webhookPath) || '/webhook/line'))}" onclick="this.select()"><small>นำ URL นี้ไปใส่ที่ LINE Developers Console → Messaging API → Webhook settings แล้วกด "Verify" และเปิด "Use webhook"</small></div>
          <div class="row-actions">
            <button class="btn primary" type="submit">บันทึกการเชื่อมต่อ LINE</button>
          </div>
        </form>
      </section>

      <section class="card panel"><h3>เชื่อมต่อ WhatsApp Business (Cloud API)</h3>
        <p class="sub">เชื่อมต่อกับ Meta for Developers WhatsApp Cloud API เพื่อรับข้อความลูกค้าผ่าน WhatsApp</p>
        <form class="form" data-form="whatsapp-settings" autocomplete="off">
          <div class="field"><label>WhatsApp Business Account ID (WABA ID)</label><input type="text" name="wabaId" value="${esc((s.whatsapp && s.whatsapp.wabaId) || '')}" placeholder="เช่น 109876543210"></div>
          <div class="field"><label>Phone Number ID</label><input type="text" name="phoneId" value="${esc((s.whatsapp && s.whatsapp.phoneId) || '')}" placeholder="เช่น 102345678901"><small>ดูได้ที่ Meta Developer Dashboard → WhatsApp → API Setup</small></div>
          <div class="field"><label>Permanent Access Token ${(s.whatsapp && s.whatsapp.hasToken) ? `<span class="chip good" style="margin-left:6px">บันทึกแล้ว ${esc(s.whatsapp.tokenHint)}</span>` : ''}</label><input type="password" name="accessToken" placeholder="${(s.whatsapp && s.whatsapp.hasToken) ? 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน' : 'System User Token หรือ Cloud API Token'}" autocomplete="new-password"></div>
          <div class="field"><label>Webhook Callback URL</label><input type="text" readonly value="${esc(location.origin + ((s.whatsapp && s.whatsapp.webhookPath) || '/webhook/whatsapp'))}" onclick="this.select()"></div>
          <div class="field"><label>Verify Token</label><input type="text" readonly value="${esc((s.whatsapp && s.whatsapp.verifyToken) || (s.webhook && s.webhook.verifyToken) || '')}" onclick="this.select()"></div>
          <div class="row-actions">
            <button class="btn primary" type="submit">บันทึกการเชื่อมต่อ WhatsApp</button>
          </div>
        </form>
      </section>

      ${pagesPanelHtml()}

      ${S.me.role === 'admin' ? usersPanelHtml() : ''}

      <section class="card panel"><h3>เปลี่ยนรหัสผ่าน</h3><p class="sub">ผู้ใช้: <b>${esc(S.me.username)}</b></p>
        <form class="form" data-form="password">
          <div class="field"><label>รหัสผ่านปัจจุบัน</label><input type="password" name="current" autocomplete="current-password" required></div>
          <div class="field"><label>รหัสผ่านใหม่</label><input type="password" name="next" autocomplete="new-password" minlength="8" required><small>อย่างน้อย 8 ตัวอักษร</small></div>
          <div class="row-actions"><button class="btn primary" type="submit">เปลี่ยนรหัสผ่าน</button></div></form></section></div>`;
  }

  /* ---------------- events ---------------- */
  function resetFilters() { Object.assign(S.dash, { platform: '', page: '', campaign: '', agency: '', rep: '', status: '', search: '' }); }

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) { if (S.menu && !ev.target.closest('.popover')) { S.menu = null; render(); } return; }
    const act = el.dataset.act; const d = S.dash;
    try {
      if (act === 'menu') { S.menu = S.menu === el.dataset.menu ? null : el.dataset.menu; render(); }
      else if (act === 'goto') { S.menu = null; location.hash = '#/' + el.dataset.to; }
      else if (act === 'logout') { await api('/api/logout', { method: 'POST' }); S.me = null; S.filters = null; S.menu = null; render(); }
      else if (act === 'refresh') loadDash(true);
      else if (act === 'range') { d.range = el.dataset.range; if (d.range === 'custom' && !d.from) { const t = new Date(); d.to = ymd(t); t.setDate(t.getDate() - 29); d.from = ymd(t); } render(); loadDash(); }
      else if (act === 'tab') { d.tab = el.dataset.tab; render(); }
      else if (act === 'reset-filters') { resetFilters(); render(); loadDash(); }
      else if (act === 'sort') { const k = el.dataset.key; if (k === 'creative') return; d.dir = d.sort === k && d.dir === 'desc' ? 'asc' : 'desc'; d.sort = k; renderTable(); }
      else if (act === 'page') { d.pageNo += Number(el.dataset.dir); renderTable(); }
      else if (act === 'select-chat') { if (S.chat.id !== el.dataset.id) openChat(el.dataset.id); }
      else if (act === 'istatus') { S.inbox.status = el.dataset.status; renderInboxTools(); renderInboxList(); }
      else if (act === 'open-chat') openChat(el.dataset.id);
      else if (act === 'close-chat') closeChat();
      else if (act === 'ftab') { S.followup.tab = el.dataset.tab; renderFollowBody(); }
      else if (act === 'fu-refresh') loadFollowups();
      else if (act === 'rstate') { S.review.state = el.dataset.state; renderReviewBody(); }
      else if (act === 'audit-more') { S.audit.limit += 100; loadAudit(); }
      else if (act === 'fu-done') {
        await api('/api/followups/done', { method: 'POST', body: { id: S.chat.id } });
        if (S.chat.data) S.chat.data.followup = { ...(S.chat.data.followup || {}), done: true };
        S.chat.msg = { type: 'ok', text: 'ปิดงานตามแล้ว' }; renderChatViews(); if (S.route === 'followup') loadFollowups();
      }
      else if (act === 'lrange') {
        const s = S[el.dataset.scope]; s.range = el.dataset.range;
        if (s.range === 'custom' && !s.from) { const t = new Date(); s.to = ymd(t); t.setDate(t.getDate() - 29); s.from = ymd(t); }
        render(); loadList(el.dataset.scope);
      }
      else if (act === 'sla-rep') { const id = el.dataset.rep; S.sla.open = S.sla.open === id ? '' : id; S.sla.kind = ''; renderSlaBody(); }
      else if (act === 'sla-kind') { S.sla.kind = el.dataset.kind; renderSlaBody(); }
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
          document.getElementById('p-platform').value = p.platform || 'Facebook';
          document.getElementById('page-edit-heading').textContent = `✏️ กำลังแก้ไขเพจ: ${p.name}`;
          document.getElementById('p-cancel-btn').style.display = 'inline-block';
          document.getElementById('page-edit-form').scrollIntoView({ behavior: 'smooth' });
        } catch (_) {}
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
        if (!confirm('ต้องการดึงแชทและลูกค้าย้อนหลังของทุกเพจ Facebook พร้อมกันหรือไม่?')) return;
        el.disabled = true;
        const originalText = el.textContent;
        el.textContent = '⏳ กำลังดึงแชททุกเพจ...';
        try {
          const r = await api('/api/import/facebook-conversations-all', { method: 'POST', body: { limit: 50 } });
          if (r.ok) {
            const errText = r.errors && r.errors.length ? (' (⚠️ มีข้อผิดพลาด: ' + r.errors.join('; ') + ')') : '';
            S.flash = { type: r.errors && r.errors.length && !r.totalImportedLeads ? 'err' : 'ok', text: `ดึงประวัติแชทสำเร็จ! เพิ่มลูกค้าใหม่ ${r.totalImportedLeads} ราย, ${r.totalImportedMsgs} ข้อความ${errText}` };
            S.filters = await api('/api/filters').catch(() => null);
            render();
          }
        } catch (e) {
          S.flash = { type: 'err', text: e.message || 'ดึงแชทไม่สำเร็จ' };
          render();
        } finally {
          el.disabled = false;
          el.textContent = originalText;
        }
      }
      else if (act === 'fb-import-conv') {
        const pageId = el.dataset.pageId;
        const pageName = el.dataset.pageName;
        if (!confirm(`ต้องการดึงข้อมูลแชทและลูกค้าเก่าย้อนหลังของเพจ "${pageName}" (ID: ${pageId}) หรือไม่?`)) return;
        el.disabled = true;
        el.textContent = '⏳ กำลังดึงแชท...';
        try {
          const r = await api('/api/import/facebook-conversations', { method: 'POST', body: { pageId, limit: 50 } });
          if (r.ok) {
            S.flash = { type: 'ok', text: `นำเข้าบทสนทนาเพจ ${r.pageName} สำเร็จ: เพิ่มลูกค้าใหม่ ${r.importedLeads} ราย, ${r.importedMsgs} ข้อความ` };
            S.filters = await api('/api/filters').catch(() => null);
            render();
          }
        } catch (e) {
          S.flash = { type: 'err', text: e.message || 'ดึงแชทย้อนหลังไม่สำเร็จ' };
          render();
        } finally {
          el.disabled = false;
          el.textContent = '📥 ดึงแชทย้อนหลัง';
        }
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
      else if (act === 'upload-confirm') { await doUploadData(); }
      else if (act === 'upload-cancel' || act === 'upload-reset') { S.upload.rows = []; S.upload.result = null; S.upload.err = null; await loadUpload(); }
      else if (act === 'upload-tab') { S.upload.tab = el.dataset.tab; S.upload.rows = []; S.upload.result = null; S.upload.err = null; renderUploadBody(); }
      else if (act === 'meta-posts-sync-all' || act === 'sync-page-posts') {
        const pageId = el.dataset.pageId;
        el.disabled = true;
        const orig = el.textContent;
        el.textContent = 'กำลังดึง Post & comment…';
        try {
          const res = await api('/api/posts-comments/sync', { method: 'POST', body: pageId ? { pageId } : {} });
          S.flash = { type: 'ok', text: 'ดึง Post & comment สำเร็จแล้ว (' + (res.count || 0) + ' โพสต์)' };
          if (S.route === 'post-comment' || S.route === 'comments') await loadComments();
        } catch (e) {
          S.flash = { type: 'err', text: e.message || 'ดึง Post & comment ไม่สำเร็จ' };
        } finally {
          el.disabled = false;
          el.textContent = orig;
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

  document.addEventListener('change', (ev) => {
    if (ev.target.dataset && (ev.target.dataset.act === 'ad-img-file' || ev.target.dataset.act === 'dash-ad-img')) {
      const file = ev.target.files && ev.target.files[0];
      if (file) uploadAdImage(ev.target.dataset.adId, ev.target.dataset.adName, file);
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
    if (b === 'frep') { S.followup.rep = ev.target.value; loadFollowups(); return; }
    if (b === 'rrep') { S.review.rep = ev.target.value; renderReviewBody(); return; }
    if (b === 'aaction') { S.audit.action = ev.target.value; S.audit.limit = 100; loadAudit(); return; }
    if (b === 'afrom' || b === 'ato') { S.audit[b === 'afrom' ? 'from' : 'to'] = ev.target.value; S.audit.limit = 100; loadAudit(); return; }
    if (b === 'ichannel') { S.inbox.channel = ev.target.value; renderInboxTools(); renderInboxList(); return; }
    if (b === 'header-platform') {
      d.platform = ev.target.value;
      d.page = '';
      if (S.route === 'dashboard') { render(); loadDash(); }
      else if (S.route === 'board') { render(); loadBoard(); }
      else if (S.route === 'inbox') { render(); loadInbox(); }
      else render();
      return;
    }
    if (b === 'header-page') {
      d.page = ev.target.value;
      if (S.route === 'dashboard') { render(); loadDash(); }
      else if (S.route === 'board') { render(); loadBoard(); }
      else if (S.route === 'inbox') { render(); loadInbox(); }
      else render();
      return;
    }
    if (['platform', 'page', 'campaign', 'agency', 'rep', 'status'].includes(b)) { d[b] = ev.target.value; render(); loadDash(); }
    if (b === 'from' || b === 'to') { d[b] = ev.target.value; if (d.from && d.to && d.from <= d.to) loadDash(); }
    /* quality filters */
    if (b === 'q-campaign') { S.quality.campaign = ev.target.value; renderQualityBody(); return; }
    if (b === 'q-quality') { S.quality.minQuality = ev.target.value; renderQualityBody(); return; }
  });

  document.addEventListener('input', (ev) => {
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
      if (type === 'login') {
        await api('/api/login', { method: 'POST', body: { username: fd.username, password: fd.password } });
        S.loginErr = ''; S.me = await api('/api/me'); S.route = routeFromHash(); enterRoute();
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
      } else if (type === 'line-settings') {
        S.settings = await api('/api/settings/line', { method: 'PUT', body: fd });
        S.flash = { type: 'ok', text: 'บันทึกการตั้งค่า LINE Official Account เรียบร้อยแล้ว' };
        render();
      } else if (type === 'whatsapp-settings') {
        S.settings = await api('/api/settings/whatsapp', { method: 'PUT', body: fd });
        S.flash = { type: 'ok', text: 'บันทึกการตั้งค่า WhatsApp Business เรียบร้อยแล้ว' };
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

  /* ---------------- boot ---------------- */
  (async () => {
    S.route = routeFromHash();
    try { S.me = await api('/api/me'); } catch { S.me = null; }
    S.booted = true;
    enterRoute();
  })();
})();