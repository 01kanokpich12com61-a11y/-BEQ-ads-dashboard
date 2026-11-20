'use strict';
const fs = require('fs');
const path = require('path');

const metaPath = path.join(__dirname, '..', 'lib', 'meta.js');
let metaJs = fs.readFileSync(metaPath, 'utf8');

const oldField = "fields: 'id,name,effective_status,status,updated_time,created_time,campaign{id,name},adset{id,name},creative{object_type,thumbnail_url,image_url,effective_object_story_id}'";
const newField = "fields: 'id,name,effective_status,status,updated_time,created_time,campaign{id,name},adset{id,name},creative{object_type,thumbnail_url,image_url,effective_object_story_id,asset_feed_spec,image_crops}'";

if (metaJs.includes(oldField)) {
  metaJs = metaJs.replace(oldField, newField);
  console.log('Replaced oldField');
}

const helperFunc = `
function optimizeThumbUrl(c) {
  if (!c) return null;
  // เลือกภาพความละเอียดสูงที่สุดจาก creative
  let url = c.image_url || c.thumbnail_url || null;
  if (!url && c.asset_feed_spec && c.asset_feed_spec.images && c.asset_feed_spec.images.length > 0) {
    url = c.asset_feed_spec.images[0].url || null;
  }
  if (!url) return null;
  // ลบ crop พารามิเตอร์ขนาดเล็ก _p64x64 และ stp crop ออก เพื่อให้ได้รูปขนาดความละเอียดสูงสุดจาก CDN
  return url
    .replace(/_p\\d+x\\d+/, '')
    .replace(/stp=c[\\d.]+x[\\d.]+f_dst-[^&]+_q\\d+_tt\\d+&?/, '')
    .replace(/stp=[^&]+&?/, '');
}
`;

if (!metaJs.includes('function optimizeThumbUrl')) {
  metaJs = helperFunc + metaJs;
  console.log('Added optimizeThumbUrl helper');
}

const oldThumb = 'thumb: (a.creative && (a.creative.thumbnail_url || a.creative.image_url)) || null,';
const newThumb = 'thumb: optimizeThumbUrl(a.creative),';

if (metaJs.includes(oldThumb)) {
  metaJs = metaJs.replace(oldThumb, newThumb);
  console.log('Replaced thumb assignment with optimizeThumbUrl');
}

fs.writeFileSync(metaPath, metaJs, 'utf8');
console.log('Successfully updated lib/meta.js!');

// Update cache ads with hi-res thumb
const cachePath = path.join(__dirname, '..', 'data', 'meta_cache_act_1319561535690627.json');
if (fs.existsSync(cachePath)) {
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  let updatedCount = 0;
  cache.ads.forEach(a => {
    if (a.thumb && typeof a.thumb === 'string') {
      const hiRes = a.thumb
        .replace(/_p\d+x\d+/, '')
        .replace(/stp=c[\d.]+x[\d.]+f_dst-[^&]+_q\d+_tt\d+&?/, '')
        .replace(/stp=[^&]+&?/, '');
      if (hiRes !== a.thumb) {
        a.thumb = hiRes;
        updatedCount++;
      }
    }
  });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`Updated ${updatedCount} ads in cache to hi-res thumbnails!`);
}
