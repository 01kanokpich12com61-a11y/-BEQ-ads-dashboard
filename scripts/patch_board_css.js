'use strict';
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'extra.css');
let css = fs.readFileSync(cssPath, 'utf8');

const navCss = `

/* ---------- Board Top Navigation & Status Scroll ---------- */
.board-top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #ffffff;
  padding: 10px 14px;
  border-radius: var(--r-card);
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  border: 1px solid var(--line-soft);
}

.board-nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  overflow: hidden;
}

.board-scroll-btn {
  background: #f1ede4;
  border: 1px solid var(--line);
  color: var(--ink);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
  transition: all .15s ease;
  flex-shrink: 0;
}

.board-scroll-btn:hover {
  background: var(--brand-mid);
  color: #fff;
  border-color: var(--brand-mid);
}

.board-pills-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 2px 0;
}
.board-pills-wrap::-webkit-scrollbar {
  display: none;
}

.board-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 20px;
  background: #f8f6f0;
  border: 1px solid #e2ddd3;
  font-size: 12.5px;
  color: var(--ink-2);
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s ease;
}

.board-status-pill:hover {
  background: #fff;
  border-color: var(--brand-mid);
  color: var(--brand-dark);
  transform: translateY(-1px);
}

.board-status-pill .pill-count {
  background: rgba(0,0,0,0.06);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}

/* Kanban Horizontal Scroll Smooth */
.kanban {
  scroll-behavior: smooth;
}
`;

if (!css.includes('.board-top-nav')) {
  css += navCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('Appended Board Nav CSS to extra.css');
} else {
  console.log('CSS already exists');
}
