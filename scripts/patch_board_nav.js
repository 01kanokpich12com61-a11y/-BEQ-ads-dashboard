'use strict';
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Find renderBoardBody
const p1 = appJs.indexOf('function renderBoardBody() {');
const p2 = appJs.indexOf('/* ---------------- follow-up / review / audit ---------------- */');
if (p1 === -1 || p2 === -1) {
  console.error('Points not found', { p1, p2 });
  process.exit(1);
}

const newBody = `function scrollBoard(dir) {
    const el = document.querySelector('.kanban');
    if (el) el.scrollBy({ left: dir * 320, behavior: 'smooth' });
  }

  function scrollToCol(status) {
    const target = document.querySelector(\`.kanban .col[data-col-status="\${status}"]\`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function renderBoardBody() {
    const box = document.getElementById('board-body'); const s = S.board; if (!box) return;
    if (s.err) { box.innerHTML = \`<div class="notice err">\${esc(s.err)}</div>\`; return; }
    if (!s.data) return;
    const d = s.data;

    // Quick jump pills & scroll controls
    const quickPills = d.columns.map((c) => \`<button type="button" class="board-status-pill" data-act="board-jump" data-status="\${c.status}">
      <i class="col-dot" style="background:\${STATUS_COLOR[c.status] || '#888'}"></i>
      <span>\${STATUS_TH[c.status] || c.status}</span>
      <b class="pill-count">\${num(c.total)}</b>
    </button>\`).join('');

    box.innerHTML = \`<div class="board-top-nav">
        <div class="board-nav-left">
          <button type="button" class="board-scroll-btn" data-act="board-scroll-left" title="เลื่อนไปทางซ้าย">◀</button>
          <div class="board-pills-wrap">
            \${quickPills}
          </div>
          <button type="button" class="board-scroll-btn" data-act="board-scroll-right" title="เลื่อนไปทางขวา">▶</button>
        </div>
        <div class="meta-line" style="margin:0">
          <span><b>\${num(d.total)}</b> แชท · 💡 ลากการ์ดสีขาวไปวางที่กล่องสถานะที่ต้องการได้เลย</span>
        </div>
      </div>
      <div class="kanban">\${d.columns.map((c) => \`<section class="col" data-col-status="\${c.status}">
        <h4><span><i class="col-dot" style="background:\${STATUS_COLOR[c.status]}"></i>\${STATUS_TH[c.status]}</span><span>\${num(c.total)}</span></h4>
        \${c.cards.map(leadCard).join('') || '<div class="empty" style="padding:20px">ไม่มีแชท</div>'}
        \${c.total > c.cards.length ? \`<div class="ad-sub" style="text-align:center;padding:8px 0">แสดง \${c.cards.length} จาก \${num(c.total)}</div>\` : ''}</section>\`).join('')}</div>\`;
    initBoardDragDrop(box);
  }

  `;

appJs = appJs.slice(0, p1) + newBody + appJs.slice(p2);

// Add event handlers
const clickP = appJs.indexOf("else if (act === 'lrange') {");
if (clickP === -1) {
  console.error('clickP not found');
  process.exit(1);
}

const newClicks = `else if (act === 'board-jump') {
        scrollToCol(el.dataset.status);
      }
      else if (act === 'board-scroll-left') {
        scrollBoard(-1);
      }
      else if (act === 'board-scroll-right') {
        scrollBoard(1);
      }
      else if (act === 'lrange') {`;

appJs = appJs.slice(0, clickP) + newClicks + appJs.slice(clickP + "else if (act === 'lrange') {".length);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Successfully updated app.js!');
