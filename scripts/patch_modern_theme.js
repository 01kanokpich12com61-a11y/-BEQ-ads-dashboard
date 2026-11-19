'use strict';
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'extra.css');
let css = fs.readFileSync(cssPath, 'utf8');

const modernThemeCss = `

/* ==========================================================================
   ✨ ULTRA-MODERN TECH & SAAS UPGRADE (HIGH-TECH ENTERPRISE THEME)
   ========================================================================== */

:root {
  --font-base: 'Plus Jakarta Sans', 'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --bg-gradient: radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.03) 0px, transparent 50%),
                 radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.03) 0px, transparent 50%),
                 #f8fafc;
  --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.03), 0 0 0 1px rgba(226, 232, 240, 0.8);
  --card-hover-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.03), 0 0 0 1px rgba(148, 163, 184, 0.3);
  --brand-gradient: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  --tech-cyan: #06b6d4;
  --tech-emerald: #10b981;
}

body {
  font-family: var(--font-base) !important;
  background: var(--bg-gradient) !important;
  color: #0f172a !important;
  letter-spacing: -0.011em !important;
  -webkit-font-smoothing: antialiased;
}

/* Card & Surface Glass Elevation */
.card, .panel, .stat {
  background: #ffffff !important;
  border-radius: 16px !important;
  box-shadow: var(--card-shadow) !important;
  border: 1px solid rgba(226, 232, 240, 0.8) !important;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.card:hover {
  box-shadow: var(--card-hover-shadow) !important;
}

/* Stat & KPI Numbers: High-Tech Bold */
.stat .k-value, .kpi-value {
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  font-weight: 800 !important;
  letter-spacing: -0.03em !important;
  font-feature-settings: "tnum" on, "lnum" on !important;
}

.stat .k-label {
  font-size: 12px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  color: #64748b !important;
  font-weight: 600 !important;
}

/* Topbar & Navigation Modern Glass */
.topbar, .site-header, header {
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  background: rgba(255, 255, 255, 0.85) !important;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8) !important;
}

/* Buttons: Tech Glow & Micro-Lift */
.btn {
  font-family: var(--font-base) !important;
  font-weight: 600 !important;
  border-radius: 10px !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  letter-spacing: -0.01em !important;
}

.btn.primary {
  background: var(--brand-gradient) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25) !important;
  color: #ffffff !important;
}

.btn.primary:hover {
  transform: translateY(-1.5px) !important;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35) !important;
}

/* Segmented Buttons / Tabs */
.seg {
  background: #f1f5f9 !important;
  padding: 4px !important;
  border-radius: 12px !important;
  border: 1px solid #e2e8f0 !important;
}

.seg button {
  font-family: var(--font-base) !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  transition: all 0.2s ease !important;
  color: #64748b !important;
}

.seg button.active {
  background: #ffffff !important;
  color: #0f172a !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04) !important;
}

/* Status Badges / Pills: Neon Glow */
.q-badge, .pill {
  font-weight: 600 !important;
  border-radius: 8px !important;
  letter-spacing: -0.01em !important;
  transition: all 0.15s ease !important;
}

.q-badge.q-excellent, .q-badge.q-good {
  background: rgba(16, 185, 129, 0.12) !important;
  color: #059669 !important;
  border: 1px solid rgba(16, 185, 129, 0.25) !important;
}

.q-badge.q-poor {
  background: rgba(239, 68, 68, 0.12) !important;
  color: #dc2626 !important;
  border: 1px solid rgba(239, 68, 68, 0.25) !important;
}

.q-badge.q-average {
  background: rgba(245, 158, 11, 0.12) !important;
  color: #d97706 !important;
  border: 1px solid rgba(245, 158, 11, 0.25) !important;
}

/* Table High-Tech Polish */
table {
  border-collapse: separate !important;
  border-spacing: 0 !important;
}

th {
  background: #f8fafc !important;
  color: #64748b !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  font-size: 11px !important;
  letter-spacing: 0.06em !important;
  border-bottom: 1px solid #e2e8f0 !important;
  padding: 12px 16px !important;
}

td {
  padding: 13px 16px !important;
  border-bottom: 1px solid #f1f5f9 !important;
  transition: background 0.15s ease !important;
}

tr:hover td {
  background: rgba(248, 250, 252, 0.8) !important;
}

/* Kanban Cards: Smooth Lift & Sharp Glow */
.kanban .lead {
  border-radius: 12px !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(226, 232, 240, 0.7) !important;
  border: none !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.kanban .lead:hover {
  transform: translateY(-2px) scale(1.01) !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(37, 99, 235, 0.3) !important;
}

/* Live Pulse Animation for Status indicators */
.col-dot {
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-ring 2.5s infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

/* Futuristic Sleek Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
`;

if (!css.includes('ULTRA-MODERN TECH & SAAS UPGRADE')) {
  css += modernThemeCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('Successfully injected Modern Tech Theme into extra.css');
} else {
  console.log('Modern Tech Theme already exists in extra.css');
}
