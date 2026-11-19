'use strict';
const fs = require('fs');
const path = require('path');

const srvPath = path.join(__dirname, '..', 'server.js');
let srv = fs.readFileSync(srvPath, 'utf8');

// 1. Add knownPages read at start of POST /api/upload/leads
const targetTop = "    const uploadPlatform = clean(b.platform, 30);\n    const uploadPageName = clean(b.pageName, 80);";
const replaceTop = `    const uploadPlatform = clean(b.platform, 30);
    const uploadPageName = clean(b.pageName, 80);
    const knownPages = store.read('pages.json', []);`;

if (!srv.includes(targetTop)) {
  console.error('targetTop not found');
  process.exit(1);
}
srv = srv.replace(targetTop, replaceTop);

// 2. Enhance pageId & lead matching
const targetBlock = `      const platform = uploadPlatform || clean(r.platform, 30) || channel;
      const pageName = uploadPageName || clean(r.pageName || r.page, 80) || \`\${platform} เพจหลัก\`;
      const pageId = clean(r.pageId, 50) || \`P_\${pageName.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}\`;
      recordPage(pageId, pageName, platform);

      const id = \`U-\${Date.now().toString(36)}-\${String(i).padStart(4, '0')}\`;
      const lead = {
        id, name, channel, adId, date,
        platform, pageName, pageId,
        repId: rep,
        status, quality: ops.QUALITY[status] || 'average', value, firstResponseMin: null, dropReason,
        phone, email,
      };
      existing.push(lead);
      added.push(lead);`;

const replaceBlock = `      const platform = uploadPlatform || clean(r.platform, 30) || channel;
      const pageName = uploadPageName || clean(r.pageName || r.page, 80) || \`\${platform} เพจหลัก\`;
      
      // ค้นหา pageId จริงจาก pages.json ที่เชื่อมต่อกับ Meta
      let resolvedPageId = clean(r.pageId, 50);
      if (!resolvedPageId && pageName) {
        const pNorm = pageName.toLowerCase().replace(/\\s+/g, '');
        const matchedPage = knownPages.find((p) => {
          if (!p.name) return false;
          const kNorm = p.name.toLowerCase().replace(/\\s+/g, '');
          return kNorm === pNorm || kNorm.includes(pNorm) || pNorm.includes(kNorm);
        });
        if (matchedPage) {
          resolvedPageId = matchedPage.id;
        }
      }
      const pageId = resolvedPageId || \`P_\${pageName.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}\`;
      recordPage(pageId, pageName, platform);

      // ตรวจสอบว่ามี lead เดิมจาก Meta ในเพจเดียวกันหรือไม่ (ตามชื่อลูกค้า หรือเบอร์โทร)
      const cleanName = name.trim().toLowerCase();
      const existingMatch = existing.find((ex) => {
        const samePage = ex.pageId === pageId || String(ex.pageId) === String(pageId);
        if (!samePage) return false;
        if (cleanName && ex.name && ex.name.trim().toLowerCase() === cleanName) return true;
        if (phone && ex.phone && ex.phone.replace(/\\D/g, '') === phone.replace(/\\D/g, '')) return true;
        return false;
      });

      if (existingMatch) {
        // อัปเดตข้อมูลให้กับ lead จาก Meta เดิมเพื่อให้ข้อมูลแชทและตัวชี้วัดเชื่อมต่อกันสมบูรณ์
        if (adId && adId !== 'Direct') existingMatch.adId = adId;
        if (rep) existingMatch.repId = rep;
        if (status) {
          existingMatch.status = status;
          existingMatch.quality = ops.QUALITY[status] || existingMatch.quality;
        }
        if (value > 0) existingMatch.value = value;
        if (dropReason) existingMatch.dropReason = dropReason;
        if (phone) existingMatch.phone = phone;
        if (email) existingMatch.email = email;
        existingMatch.pageName = pageName;
        added.push(existingMatch);
      } else {
        const id = \`U-\${Date.now().toString(36)}-\${String(i).padStart(4, '0')}\`;
        const lead = {
          id, name, channel, adId, date,
          platform, pageName, pageId,
          repId: rep,
          status, quality: ops.QUALITY[status] || 'average', value, firstResponseMin: null, dropReason,
          phone, email,
        };
        existing.push(lead);
        added.push(lead);
      }`;

if (!srv.includes(targetBlock)) {
  console.error('targetBlock not found');
  process.exit(1);
}
srv = srv.replace(targetBlock, replaceBlock);

fs.writeFileSync(srvPath, srv, 'utf8');
console.log('Successfully enhanced server.js for Meta-page matching on upload!');
