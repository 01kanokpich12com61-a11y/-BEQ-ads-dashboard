'use strict';
// คลังข้อมูลโฆษณาถาวร: ทุกครั้งที่ดึง Meta สำเร็จ บันทึกลงฐานข้อมูล (SQLite + Supabase)
// - ข้อมูลรายวันแยกเก็บเป็นเดือน (ads_daily_YYYY-MM.json) อัปเดตเฉพาะเดือนที่ดึงมาใหม่ ไม่ต้องอัปโหลดก้อนใหญ่ทุกครั้ง
// - ดึงช่วงเดิมซ้ำ → แทนที่ข้อมูลวันเหล่านั้นด้วยของใหม่ (ไม่ซ้ำซ้อน)
// - เลิกดึง / Meta ล่ม / เซิร์ฟเวอร์รีสตาร์ท → ยังเปิดดูข้อมูลที่บันทึกไว้ได้ทุกช่วงที่เคยดึง
const store = require('./store');

const META_FILE = 'ads_meta.json';
const monthFile = (ym) => `ads_daily_${ym}.json`;
const addDay = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function monthsBetween(from, to) {
  const out = [];
  let y = Number(from.slice(0, 4)); let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4)); const em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
    if (out.length > 600) break;
  }
  return out;
}

// รวมช่วงวันที่ที่มีข้อมูลแล้ว (ใช้บอกว่าช่วงที่ขอ "มีครบ" ไหม)
function mergeCoverage(list, add) {
  const all = [...(list || []), add].filter((x) => x && x.from && x.to).sort((a, b) => (a.from < b.from ? -1 : 1));
  const out = [];
  for (const c of all) {
    const last = out[out.length - 1];
    if (last && c.from <= addDay(last.to, 1)) { if (c.to > last.to) last.to = c.to; }
    else out.push({ from: c.from, to: c.to });
  }
  return out;
}

// บันทึกผลการดึงจาก Meta: data = ผลจาก meta.load, from/to = ช่วงที่ดึงรายวันมาจริง
function save(data, from, to, { daily = true } = {}) {
  if (!data || !Array.isArray(data.ads)) return;
  const prev = store.read(META_FILE, {}) || {};
  // ข้อมูลโฆษณา/แคมเปญ: รวมของเดิมกับของใหม่ (ของใหม่ทับ) เพื่อให้โฆษณาเก่าที่ปิดไปแล้วยังแสดงในช่วงย้อนหลังได้
  const byId = (arr) => new Map((arr || []).map((x) => [String(x.id), x]));
  const ads = byId(prev.ads); for (const a of data.ads) ads.set(String(a.id), a);
  const camps = byId(prev.campaigns); for (const c of data.campaigns || []) camps.set(String(c.id), c);
  const pages = byId(prev.pages); for (const p of data.pages || []) pages.set(String(p.id), p);
  const agencies = byId(prev.agencies); for (const g of data.agencies || []) agencies.set(String(g.id), g);

  let coverage = prev.coverage || [];
  if (daily && from && to) {
    const rowsByMonth = new Map();
    for (const r of data.daily || []) {
      if (!r || !r.date || r.date < from || r.date > to) continue;
      const ym = r.date.slice(0, 7);
      if (!rowsByMonth.has(ym)) rowsByMonth.set(ym, []);
      rowsByMonth.get(ym).push(r);
    }
    for (const ym of monthsBetween(from, to)) {
      const file = store.read(monthFile(ym), { rows: [] }) || { rows: [] };
      // ลบข้อมูลเดิมของวันที่ดึงมาใหม่ แล้วใส่ของใหม่แทน
      const kept = (file.rows || []).filter((r) => r.date < from || r.date > to);
      const fresh = rowsByMonth.get(ym) || [];
      store.write(monthFile(ym), { rows: kept.concat(fresh), updatedAt: new Date().toISOString() });
    }
    coverage = mergeCoverage(coverage, { from, to });
  }
  store.write(META_FILE, {
    ads: [...ads.values()], campaigns: [...camps.values()], pages: [...pages.values()], agencies: [...agencies.values()],
    coverage, updatedAt: new Date().toISOString(),
  });
}

function covers(coverage, from, to) {
  return (coverage || []).some((c) => c.from <= from && c.to >= to);
}

// โหลดข้อมูลที่บันทึกไว้สำหรับช่วง from..to (คืน null ถ้ายังไม่เคยบันทึก)
function load(from, to) {
  const meta = store.read(META_FILE, null);
  if (!meta || !Array.isArray(meta.ads)) return null;
  const daily = [];
  for (const ym of monthsBetween(from, to)) {
    const file = store.read(monthFile(ym), null);
    if (file && Array.isArray(file.rows)) for (const r of file.rows) if (r.date >= from && r.date <= to) daily.push(r);
  }
  return {
    pages: meta.pages || [], agencies: meta.agencies || [], reps: [], campaigns: meta.campaigns || [], ads: meta.ads,
    daily, leads: store.read('leads.json', []),
    storedAt: meta.updatedAt, complete: covers(meta.coverage, from, to), coverage: meta.coverage || [],
  };
}

function status() {
  const meta = store.read(META_FILE, null);
  return meta ? { updatedAt: meta.updatedAt, coverage: meta.coverage || [], ads: (meta.ads || []).length } : null;
}

module.exports = { save, load, status, covers, monthsBetween, mergeCoverage };
