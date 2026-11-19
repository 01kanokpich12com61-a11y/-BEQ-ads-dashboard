'use strict';
const fs = require('fs');
const path = require('path');

const srvPath = path.join(__dirname, '..', 'server.js');
let srv = fs.readFileSync(srvPath, 'utf8');

const targetOld = `      const platform = uploadPlatform || clean(r.platform, 30) || channel;
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
      recordPage(pageId, pageName, platform);`;

const replacement = `      // ตรวจสอบแพลตฟอร์ม Instagram จาก channel, platform หรือชื่อเพจ
      const rawRowPlat = clean(r.platform, 30);
      const rawRowPage = clean(r.pageName || r.page, 80);
      const isIg = Boolean(
        (rawRowPlat && /ig|instagram/i.test(rawRowPlat)) ||
        (channel && /ig|instagram/i.test(channel)) ||
        (uploadPlatform && /ig|instagram/i.test(uploadPlatform)) ||
        (rawRowPage && /ig|instagram|dr\\.nay_hairtransplant|beq_wellness/i.test(rawRowPage)) ||
        (uploadPageName && /ig|instagram|dr\\.nay_hairtransplant|beq_wellness/i.test(uploadPageName))
      );

      let platform = isIg ? 'Instagram' : (uploadPlatform || rawRowPlat || channel);
      let pageName = uploadPageName || rawRowPage || \`\${platform} เพจหลัก\`;

      // ค้นหา pageId และชื่อเพจจริงจาก pages.json ที่เชื่อมต่อกับ Meta (แยก Instagram และ Facebook ชัดเจน)
      let resolvedPageId = clean(r.pageId, 50);
      if (pageName) {
        const pNorm = pageName.toLowerCase().replace(/[\\s_.-]/g, '');
        let matchedPage = knownPages.find((p) => {
          if (!p.name) return false;
          const kNorm = p.name.toLowerCase().replace(/[\\s_.-]/g, '');
          const platMatch = isIg ? (p.platform === 'Instagram') : (p.platform !== 'Instagram');
          return platMatch && (kNorm === pNorm || kNorm.includes(pNorm) || pNorm.includes(kNorm));
        });

        // หากระบุว่าเป็น Instagram แต่ใส่ชื่อ Facebook Page มา (เช่น Dr. Nay Hair Transplant) ให้แมพไปหา Instagram Page คู่ของมัน
        if (isIg && !matchedPage) {
          const fbPage = knownPages.find((p) => p.platform === 'Facebook' && (p.name || '').toLowerCase().replace(/[\\s_.-]/g, '').includes(pNorm));
          if (fbPage) {
            matchedPage = knownPages.find((p) => p.platform === 'Instagram' && p.fbPageId === fbPage.id);
          }
        }

        if (matchedPage) {
          resolvedPageId = matchedPage.id;
          pageName = matchedPage.name;
          platform = matchedPage.platform || platform;
        }
      }
      const pageId = resolvedPageId || clean(r.pageId, 50) || \`P_\${pageName.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}\`;
      recordPage(pageId, pageName, platform);`;

if (!srv.includes(targetOld)) {
  console.error('targetOld not found in server.js');
  process.exit(1);
}

srv = srv.replace(targetOld, replacement);
fs.writeFileSync(srvPath, srv, 'utf8');
console.log('Successfully updated server.js with Instagram auto-routing!');
