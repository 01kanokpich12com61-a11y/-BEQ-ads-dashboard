'use strict';
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const p1 = appJs.indexOf('function renderSlaBody() {');
const p2 = appJs.indexOf('function boardShell() {');
if (p1 === -1 || p2 === -1) {
  console.error('Cannot find renderSlaBody or boardShell', { p1, p2 });
  process.exit(1);
}

const newCode = `function renderSlaBody() {
    const box = $id('sla-body'); const s = S.sla; if (!box) return;
    if (s.err) { box.innerHTML = \`<div class="notice err" style="margin-bottom:14px">\${esc(s.err)}</div>\`; return; }
    if (!s.data) { box.innerHTML = '<div class="loading" style="padding:30px">Loading\u2026</div>'; return; }
    const d = s.data; const t = d.totals;
    const open = d.reps.find((r) => r.repId === s.open);
    const evFilter = (e) => {
      if (!s.kind) return true;
      if (s.kind === 'night') return e.replyWindow === 'night';
      if (s.kind === 'commute') return e.outcome === 'commute';
      if (s.kind === 'deduct') return e.outcome === 'deduct' || e.outcome === 'read_no_reply';
      return e.outcome === s.kind;
    };
    const evs = open ? open.events.filter(evFilter) : [];

    const kindPills = SLA_KINDS.map(([k, l]) =>
      \`<button class="pill \${s.kind === k ? 'active' : ''}" data-act="sla-kind" data-kind="\${k}">\${l}</button>\`
    ).join('');

    const repRows = d.reps.length
      ? d.reps.map((r) => {
          const pageTag = r.pageName
            ? \`<div class="ad-sub" style="font-size:11px;margin-top:2px;color:var(--accent)">\${esc(r.pageName)}</div>\`
            : '';
          return \`<tr class="click-row \${r.repId === s.open ? 'sel-row' : ''}" data-act="sla-rep" data-rep="\${esc(r.repId)}">
            <td><b>\${esc(r.rep)}</b>\${pageTag}</td>
            <td>\${num(r.turns)}</td><td>\${num(r.onTime)}</td><td>\${num(r.late)}</td>
            <td>\${r.deducted ? \`<span class="q-badge q-poor">\u2212\${num(r.deducted)}</span>\` : '<span class="q-badge q-excellent">0</span>'}</td>
            <td>\${num(r.commuteLate)}</td><td>\${num(r.nightReplies)}</td><td>\${r.avgMin === null ? '\u2014' : fmtDur(r.avgMin)}</td>
          </tr>\`;
        }).join('')
      : '<tr><td colspan="8"><div class="empty">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e01\u0e32\u0e23\u0e15\u0e2d\u0e1a\u0e41\u0e0a\u0e17\u0e43\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e17\u0e35\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01</div></td></tr>';

    const detailRows = evs.length
      ? evs.map((e) => \`<tr class="click-row" data-act="sla-open" data-id="\${esc(e.leadId)}" data-date="\${esc(e.leadDate)}">
          <td><div class="ad-name">\${esc(e.name)}</div><div class="ad-sub">\${esc(e.page || '\u2014')} \xb7 \${esc(e.channel)}</div></td>
          <td class="nowrap">\${esc(sepLabel(e.customerAt))}<div class="ad-sub">\${SLA_WIN[e.window]}</div></td>
          <td class="nowrap">\${e.replyAt
            ? \`\${esc(sepLabel(e.replyAt))}<div class="ad-sub">\${e.replyWindow === 'night' ? '\u0e15\u0e2d\u0e1a\u0e0a\u0e48\u0e27\u0e07 22:00\u201308:00' : SLA_WIN[e.replyWindow]}</div>\`
            : '<span class="q-badge q-poor">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e15\u0e2d\u0e1a</span>'}</td>
          <td class="nowrap">\${fmtDur(e.minutes)}</td>
          <td><span class="q-badge \${SLA_OUT[e.outcome][1]}">\${SLA_OUT[e.outcome][0]}</span></td>
        </tr>\`).join('')
      : '<tr><td colspan="5"><div class="empty">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e43\u0e19\u0e2b\u0e21\u0e27\u0e14\u0e19\u0e35\u0e49</div></td></tr>';

    const detailSection = open ? \`<div class="sla-detail" style="margin-top:16px">
        <h4>\${esc(open.rep)}\${open.pageName ? ' (' + esc(open.pageName) + ')' : ''} &middot; \${num(open.eventTotal)} \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</h4>
        <div class="pills" style="margin-bottom:10px">\${kindPills}</div>
        <div class="tscroll"><table style="min-width:860px"><thead><tr>
          <th class="nosort">\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32 / \u0e40\u0e1e\u0e08</th>
          <th class="nosort">\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32\u0e17\u0e31\u0e01</th>
          <th class="nosort">\u0e40\u0e0b\u0e25\u0e2a\u0e4c\u0e15\u0e2d\u0e1a</th>
          <th class="nosort">\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32</th>
          <th class="nosort">\u0e1c\u0e25</th>
        </tr></thead><tbody>
        \${detailRows}</tbody></table></div>
        \${open.eventTotal > open.events.length
          ? \`<div class="ad-sub" style="padding:8px;text-align:center">\u0e41\u0e2a\u0e14\u0e07 \${open.events.length} \u0e08\u0e32\u0e01 \${num(open.eventTotal)} \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14</div>\`
          : ''}
      </div>\` : '';

    box.innerHTML = \`<section class="card panel sla-panel">
      <h3>SLA \u0e15\u0e2d\u0e1a\u0e41\u0e0a\u0e17\u0e20\u0e32\u0e22\u0e43\u0e19 \${d.limitMin} \u0e19\u0e32\u0e17\u0e35</h3>
      <p class="sub">\u0e19\u0e31\u0e1a\u0e08\u0e32\u0e01\u0e40\u0e27\u0e25\u0e32\u0e17\u0e35\u0e48\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32\u0e17\u0e31\u0e01 &middot; 10:00\u201319:00 \u0e15\u0e2d\u0e1a\u0e0a\u0e49\u0e32\u0e2b\u0e31\u0e01 1 \u0e41\u0e15\u0e49\u0e21 &middot; \u0e40\u0e1b\u0e34\u0e14\u0e2d\u0e48\u0e32\u0e19\u0e41\u0e15\u0e48\u0e44\u0e21\u0e48\u0e15\u0e2d\u0e1a\u0e2b\u0e31\u0e01 0.5 \u0e41\u0e15\u0e49\u0e21 &middot; 08:00\u201310:00 \u0e41\u0e25\u0e30 19:00\u201322:00 \u0e44\u0e21\u0e48\u0e2b\u0e31\u0e01\u0e41\u0e15\u0e48\u0e40\u0e01\u0e47\u0e1a\u0e40\u0e1b\u0e47\u0e19\u0e2a\u0e16\u0e34\u0e15\u0e34\u0e15\u0e2d\u0e1a\u0e0a\u0e49\u0e32 &middot; 22:00\u201308:00 \u0e44\u0e21\u0e48\u0e2b\u0e31\u0e01 \u0e41\u0e25\u0e30\u0e40\u0e01\u0e47\u0e1a\u0e2a\u0e16\u0e34\u0e15\u0e34\u0e16\u0e49\u0e32\u0e40\u0e0b\u0e25\u0e2a\u0e4c\u0e15\u0e2d\u0e1a\u0e43\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e19\u0e35\u0e49</p>
      <div class="grid-4" style="margin-bottom:16px">
        <div class="stat"><div class="k-label">\u0e41\u0e15\u0e49\u0e21\u0e17\u0e35\u0e48\u0e16\u0e39\u0e01\u0e2b\u0e31\u0e01\u0e23\u0e27\u0e21</div><div class="k-value" style="color:\${t.deducted ? 'var(--coral)' : 'inherit'}">\${t.deducted ? '\u2212' + num(t.deducted) : '0'}</div></div>
        <div class="stat"><div class="k-label">\u0e15\u0e2d\u0e1a\u0e17\u0e31\u0e19 / \u0e15\u0e23\u0e27\u0e08\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</div><div class="k-value">\${num(t.onTime)} / \${num(t.turns)}</div></div>
        <div class="stat"><div class="k-label">\u0e0a\u0e49\u0e32\u0e0a\u0e48\u0e27\u0e07\u0e40\u0e14\u0e34\u0e19\u0e17\u0e32\u0e07 (\u0e2a\u0e16\u0e34\u0e15\u0e34)</div><div class="k-value">\${num(t.commuteLate)}</div></div>
        <div class="stat"><div class="k-label">\u0e15\u0e2d\u0e1a\u0e19\u0e2d\u0e01\u0e40\u0e27\u0e25\u0e32 22:00\u201308:00</div><div class="k-value">\${num(t.nightReplies)}</div></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div class="pills">\${kindPills}</div>
        <div class="ad-sub">\u0e41\u0e2a\u0e14\u0e07\u0e1c\u0e25\u0e15\u0e32\u0e21\u0e40\u0e0b\u0e25\u0e2a\u0e4c\u0e41\u0e25\u0e30\u0e40\u0e1e\u0e08\u0e17\u0e35\u0e48\u0e23\u0e31\u0e1a\u0e1c\u0e34\u0e14\u0e0a\u0e2d\u0e1a</div>
      </div>
      <div class="tscroll"><table style="min-width:900px"><thead><tr>
        <th class="nosort">\u0e40\u0e0b\u0e25\u0e2a\u0e4c / \u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19</th>
        <th>\u0e15\u0e23\u0e27\u0e08</th><th>\u0e17\u0e31\u0e19\u0e40\u0e27\u0e25\u0e32</th><th>\u0e0a\u0e49\u0e32</th>
        <th>\u0e41\u0e15\u0e49\u0e21\u0e17\u0e35\u0e48\u0e16\u0e39\u0e01\u0e2b\u0e31\u0e01</th><th>\u0e0a\u0e49\u0e32\u0e0a\u0e48\u0e27\u0e07\u0e40\u0e14\u0e34\u0e19\u0e17\u0e32\u0e07</th>
        <th>\u0e15\u0e2d\u0e1a\u0e19\u0e2d\u0e01\u0e40\u0e27\u0e25\u0e32</th><th>\u0e15\u0e2d\u0e1a\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22</th>
      </tr></thead><tbody>
      \${repRows}</tbody></table></div>
      <p class="rv-hint" style="margin:10px 0 0">\u0e04\u0e25\u0e34\u0e01\u0e41\u0e16\u0e27\u0e40\u0e0b\u0e25\u0e2a\u0e4c\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e14\u0e39\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 &middot; \u0e04\u0e25\u0e34\u0e01\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e1b\u0e34\u0e14\u0e41\u0e0a\u0e17\u0e19\u0e31\u0e49\u0e19\u0e17\u0e35\u0e48\u0e2b\u0e19\u0e49\u0e32 Inbox</p>
      \${detailSection}
    </section>\`;
  }
`;

appJs = appJs.slice(0, p1) + newCode + appJs.slice(p2);
fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Done! Patched renderSlaBody in public/app.js');
