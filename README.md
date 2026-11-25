# BEQ Ads Dashboard

แดชบอร์ดโฆษณา Facebook/Instagram, Inbox แชท (Messenger / Instagram / LINE / WhatsApp), คุณภาพแชท (SLA) และยอดขายของคลินิก

- Node.js ≥ 22.5 (ใช้ `node:sqlite` ในตัว ไม่ต้องติดตั้งแพ็กเกจเพิ่ม; ถ้าเวอร์ชันต่ำกว่าจะใช้ไฟล์ JSON แทน)
- ข้อมูลเก็บใน SQLite (`data/app.db`) + ไฟล์ JSON สำรอง และซิงค์ขึ้น Supabase ถ้าตั้งค่าไว้

## รันในเครื่อง

```bash
cp .env.example .env     # แก้ค่าตามต้องการ
npm start                # http://127.0.0.1:3000
npm test                 # ชุดทดสอบ
```

ครั้งแรกจะสร้างผู้ใช้ `admin` ด้วย `ADMIN_PASSWORD` (หรือ `admin1234` ถ้าไม่ได้ตั้ง — เฉพาะในเครื่องเท่านั้น และระบบจะเตือนให้เปลี่ยน)

## Deploy บน Render

1. **Build command:** เว้นว่าง (ไม่มี dependency) · **Start command:** `npm start`
2. ตั้ง **Environment** อย่างน้อย:

   | ตัวแปร | ทำไมต้องมี |
   |---|---|
   | `ADMIN_PASSWORD` | รหัส admin ครั้งแรก (ถ้าไม่ตั้ง ระบบจะสุ่มรหัสและพิมพ์ใน Logs) |
   | `ADMIN_RESET_PASSWORD` | ใช้ตอนลืมรหัส admin เท่านั้น: ตั้งแล้วรีสตาร์ท → เข้าด้วยรหัสนี้ → ลบตัวแปรออก |
   | `SUPABASE_URL`, `SUPABASE_KEY` | **สำคัญมาก** — ดิสก์ของ Render ถูกล้างทุกครั้งที่ deploy/รีสตาร์ท ถ้าไม่มี Supabase แชท ลีด ผู้ใช้ และการตั้งค่าจะหาย |
   | `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | เชื่อม Meta โดยไม่ต้องเก็บ token ไว้ในไฟล์ |
   | `WEBHOOK_VERIFY_TOKEN` | ค่าเดียวกับที่ใส่ใน Meta Webhooks (ให้คงที่ข้ามการรีสตาร์ท) |
   | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | ถ้าใช้ LINE OA (webhook LINE จะปฏิเสธทุกคำขอถ้าไม่มี Channel Secret) |

   Render ถูกนับเป็น production อัตโนมัติ: เปิด Secure cookie และ Trust proxy ให้เอง และพิมพ์คำเตือนใน Logs ถ้ายังตั้งค่าไม่ครบ
3. Webhook URL ที่ต้องใส่:
   - Meta (Messenger/Instagram): `https://<โดเมน>/webhook`
   - WhatsApp Cloud API: `https://<โดเมน>/webhook/whatsapp` (ใช้ App Secret เดียวกันตรวจลายเซ็น)
   - LINE: `https://<โดเมน>/webhook/line`

### ตาราง Supabase

```sql
create table if not exists kv (
  name text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table kv enable row level security;  -- ไม่เปิดให้ anon อ่าน; เซิร์ฟเวอร์ใช้ service_role key
```

## ความปลอดภัย

- โฟลเดอร์ `data/` มี token, รหัสผ่าน (hash) และแชทลูกค้า — ถูก `.gitignore` ไว้ **ห้าม commit**
- ทุก webhook ต้องมีลายเซ็นถูกต้อง (Meta/WhatsApp: `X-Hub-Signature-256`, LINE: `X-Line-Signature`)
- ล็อกอินผิดเกิน 5 ครั้ง/IP หรือ 10 ครั้ง/ชื่อผู้ใช้ ใน 10 นาที จะถูกพักชั่วคราว
