'use strict';
// งานเบื้องหลัง (background jobs) สำหรับคำขอที่ใช้เวลานาน เช่น ดึงแชท/โพสต์ย้อนหลังจาก Meta
// เบราว์เซอร์ได้ jobId กลับไปทันที แล้วถามความคืบหน้าที่ GET /api/jobs/:id จนเสร็จ
// ไม่มีปัญหา request timeout ของเซิร์ฟเวอร์/พร็อกซี และปิดหน้าเว็บแล้วงานก็ยังทำต่อ
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');

const jobs = new Map(); // id -> job
const ctx = new AsyncLocalStorage();
const KEEP_MS = 60 * 60 * 1000; // เก็บผลลัพธ์ไว้ 1 ชั่วโมง

function publicView(j) {
  return {
    id: j.id, route: j.route, owner: j.owner, status: j.status,
    progress: j.progress, startedAt: j.startedAt, finishedAt: j.finishedAt,
    httpStatus: j.httpStatus, result: j.result,
  };
}

function prune() {
  const now = Date.now();
  for (const [id, j] of jobs) if (j.finishedAt && now - Date.parse(j.finishedAt) > KEEP_MS) jobs.delete(id);
}

// งานเดิมของ route เดียวกันที่ยังไม่เสร็จ (กันกดซ้ำแล้วดึงซ้อนกัน)
function running(route) {
  for (const j of jobs.values()) if (j.route === route && j.status === 'running') return j;
  return null;
}

// fn(): Promise<{ status, body }>
function start(route, owner, fn) {
  prune();
  const job = {
    id: crypto.randomBytes(8).toString('hex'), route, owner, status: 'running',
    progress: { phase: 'starting', done: 0, total: 0, note: '' },
    startedAt: new Date().toISOString(), finishedAt: null, httpStatus: null, result: null, cancel: false,
  };
  jobs.set(job.id, job);
  ctx.run(job, () => {
    Promise.resolve().then(fn).then((r) => {
      job.httpStatus = r.status;
      job.result = r.body;
      job.status = r.status >= 400 ? 'error' : 'done';
    }).catch((e) => {
      job.httpStatus = 500;
      job.result = { error: (e && e.message) || 'งานเบื้องหลังล้มเหลว' };
      job.status = 'error';
    }).finally(() => { job.finishedAt = new Date().toISOString(); });
  });
  return job;
}

// เรียกจากโค้ดที่ทำงานอยู่ในงาน (เช่น lib/meta.js) เพื่ออัปเดตความคืบหน้า; นอกงานจะไม่ทำอะไร
function report(p) {
  const j = ctx.getStore();
  if (j && p) j.progress = { ...j.progress, ...p };
}
function cancelled() {
  const j = ctx.getStore();
  return Boolean(j && j.cancel);
}

function get(id) { return jobs.get(id) || null; }
function cancel(id) { const j = jobs.get(id); if (j && j.status === 'running') j.cancel = true; return j; }

module.exports = { start, running, report, cancelled, get, cancel, publicView };
