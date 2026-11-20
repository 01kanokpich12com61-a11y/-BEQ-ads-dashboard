'use strict';
// lib/line.js - ส่งแจ้งเตือนผ่าน LINE Notify API หรือ LINE Messaging API Webhook
const store = require('./store');

function getLineConfig() {
  const settings = store.read('settings.json', {});
  return settings.line || {
    enabled: false,
    token: '', // LINE Notify Token หรือ Channel Access Token
    webhookUrl: '', // หรือ Webhook สำหรับกลุ่ม
    notifyOnStatusChange: true,
    notifyOnOverdue: true,
    notifyOnNewReply: true,
    notifyOnChase: true,
  };
}

function saveLineConfig(patch) {
  const settings = store.read('settings.json', {});
  settings.line = { ...(settings.line || {}), ...patch };
  store.write('settings.json', settings);
  return settings.line;
}

/**
 * ส่งข้อความแจ้งเตือนเข้า LINE
 * รองรับทั้ง LINE Notify API (ฟรีและสะดวกที่สุดสำหรับกลุ่มทีมงาน) และ Custom Webhook
 */
async function sendLineNotification(message) {
  const conf = getLineConfig();
  if (!conf.enabled || (!conf.token && !conf.webhookUrl)) {
    return { ok: false, error: 'LINE Notification is not configured or disabled' };
  }

  const text = String(message || '').trim();
  if (!text) return { ok: false, error: 'Empty message' };

  try {
    // 1. ถ้ามี LINE Notify Token
    if (conf.token) {
      const res = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${conf.token}`,
        },
        body: new URLSearchParams({ message: text }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.message || 'LINE Notify error' };
      }
      return { ok: true, type: 'notify' };
    }

    // 2. ถ้าเป็น Webhook URL (เช่น Make / Zapier / Discord / LINE Bot Push)
    if (conf.webhookUrl) {
      const res = await fetch(conf.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, text }),
        signal: AbortSignal.timeout(10000),
      });
      return { ok: res.ok };
    }
  } catch (err) {
    console.error('[LINE Notify Error]', err.message);
    return { ok: false, error: err.message };
  }

  return { ok: false, error: 'No endpoint matched' };
}

/**
 * รูปแบบข้อความแจ้งเตือนเหตุการณ์ต่างๆ
 */
function formatStatusChangeAlert(lead, oldStatus, newStatus, changedBy = 'ระบบ') {
  const repText = lead.repId || lead.rep || 'ยังไม่ระบุเซลส์';
  const pageText = lead.pageName || lead.channel || 'Facebook';
  return `\n🔔 [แจ้งเตือนสถานะลูกค้า]\n` +
    `👤 ลูกค้า: ${lead.name || 'ไม่ระบุชื่อ'}\n` +
    `📄 เพจ/ช่องทาง: ${pageText}\n` +
    `🔄 สถานะ: ${oldStatus || '—'} ➡️ ${newStatus}\n` +
    `💼 เซลส์ที่ดูแล: ${repText}\n` +
    `⏱️ ผู้ดำเนินการ: ${changedBy}\n` +
    `🔗 ดูข้อมูล: https://beq-ads-dashboard.onrender.com/#/followup`;
}

function formatOverdueAlert(lead, followup) {
  const repText = lead.rep || lead.repId || 'ยังไม่ระบุเซลส์';
  return `\n⏰ [แจ้งเตือน: นัดตามลูกค้าเกินกำหนด]\n` +
    `👤 ลูกค้า: ${lead.name || 'ไม่ระบุชื่อ'}\n` +
    `💼 เซลส์ที่ดูแล: ${repText}\n` +
    `📅 กำหนดตาม: ${followup.dueDate || 'วันนี้'}\n` +
    `📝 โน้ต: ${followup.note || 'ไม่มีบันทึกเพิ่มเติม'}\n` +
    `⚠️ กรุณาทักตามลูกค้าเพื่อรักษาโอกาสการขายครับ!`;
}

function formatNewReplyAlert(lead) {
  const repText = lead.rep || lead.repId || 'ยังไม่ระบุเซลส์';
  return `\n💬 [แจ้งเตือน: ลูกค้าตอบกลับรอคุย]\n` +
    `👤 ลูกค้า: ${lead.name || 'ไม่ระบุชื่อ'}\n` +
    `💼 เซลส์ที่ดูแล: ${repText}\n` +
    `🗨️ ข้อความล่าสุด: "${(lead.lastText || '').slice(0, 80)}"\n` +
    `⚡ ลูกค้ารอคำตอบอยู่ กรุณาเข้าตอบแชทครับ!`;
}

function formatChaseAlert(lead) {
  const repText = lead.rep || lead.repId || 'ยังไม่ระบุเซลส์';
  return `\n⏳ [แจ้งเตือน: ลูกค้าเงียบเกิน 24 ชม.]\n` +
    `👤 ลูกค้า: ${lead.name || 'ไม่ระบุชื่อ'}\n` +
    `💼 เซลส์ที่ดูแล: ${repText}\n` +
    `🕒 เงียบไปแล้ว: ${lead.hours || 24} ชั่วโมง\n` +
    `💡 แนะนำให้ทักติดตามหรือส่งข้อมูลเพิ่มเติมครับ`;
}

module.exports = {
  getLineConfig,
  saveLineConfig,
  sendLineNotification,
  formatStatusChangeAlert,
  formatOverdueAlert,
  formatNewReplyAlert,
  formatChaseAlert,
};
