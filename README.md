# SiBMT Refer

ระบบรับนัดและประสานการส่งต่อผู้ป่วยโลหิตวิทยา โรงพยาบาลศิริราช

## ขอบเขตระบบ

- นัดพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด
- Refer ผู้ป่วยนอกด้วยเหตุผลอื่น
- Dashboard จัดการนัด ตาราง Fellow และคิวว่าง
- เพิ่ม แก้ไข และปิดใช้งานชื่อ Fellow
- ตั้งจำนวนคิวต่อ Fellow ต่อวัน ค่าเริ่มต้น 2 คิว
- ผู้ส่งต่อดู เลื่อน และยกเลิกนัดได้
- Hemato Bot ตอบคำถามวันนัดและ transplant candidate
- LINE OA ให้ Fellow ดูคิวของตนเอง
- ใช้ Turso/libSQL ไม่ใช้ Google Sheet หรือ Apps Script

ปัจจุบันระบบยังไม่ส่งอีเมลอัตโนมัติ หลังจองให้พิมพ์หรือ Save as PDF ใบนัดจากหน้าจอ

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Turso/libSQL สำหรับข้อมูล Group 1
- Cloudflare Worker สำหรับ production ปัจจุบัน
- LINE Messaging API สำหรับ webhook และคำถามคิวนัด

## Environment

ตั้งค่าใน `.env.local` สำหรับ local หรือ Cloudflare Worker Secrets สำหรับ production

```env
AUTH_SECRET=ตั้งเป็นค่าสุ่มยาว ๆ
DASHBOARD_USERS=admin:รหัสผ่าน

GROUP1_DATABASE_URL=libsql://...
GROUP1_DATABASE_AUTH_TOKEN=...

LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
GROUP1_LINE_SHARED_CODE=รหัสลงทะเบียน Fellow
```

ห้าม commit `.env.local`, token, password หรือไฟล์ที่มี secret ขึ้น GitHub

## รัน Local

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

สร้างตาราง Group 1 ในฐานข้อมูล:

```bash
node --env-file=.env.local scripts/setup-group1-db.mjs
```

ข้อมูลจำลองสำหรับทดสอบ:

```bash
npm run seed:group1-demo
```

## Deploy Cloudflare Worker

ตั้ง secret ด้วย CLI ตัวอย่าง:

```bash
npx wrangler secret put AUTH_SECRET --name sibmt-14
npx wrangler secret put DASHBOARD_USERS --name sibmt-14
npx wrangler secret put GROUP1_DATABASE_URL --name sibmt-14
npx wrangler secret put GROUP1_DATABASE_AUTH_TOKEN --name sibmt-14
npx wrangler secret put LINE_CHANNEL_SECRET --name sibmt-14
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN --name sibmt-14
npx wrangler secret put GROUP1_LINE_SHARED_CODE --name sibmt-14
```

Deploy:

```bash
npm run cf:deploy
```

LINE Webhook:

```text
https://<worker-domain>/api/line/webhook
```

เปิด Use webhook ใน LINE Developers และปิด Auto-reply/Greeting หากไม่ต้องการข้อความซ้ำ

## ย้ายไป On-premise

### 1. เตรียม Server

แนะนำ Linux Server ที่มี:

- Node.js เวอร์ชันเดียวกับที่ใช้ build ระบบ
- Git และ npm
- HTTPS certificate และ domain ภายใน/ภายนอก
- Reverse proxy เช่น Caddy หรือ Nginx
- Firewall เปิดเฉพาะ 443 และ port ที่จำเป็น

ติดตั้งและ build:

```bash
git clone <repository-url>
cd SiBMT_14
npm ci
npm run build
```

รัน production ด้วย process manager เช่น systemd หรือ PM2:

```bash
npm run start
```

ให้ Reverse proxy ส่ง `https://your-domain/` ไปยัง Next.js ที่ `127.0.0.1:3000`

### 2. ฐานข้อมูล On-premise

ทางเลือกที่ย้ายง่ายที่สุดคือใช้ self-hosted libSQL ที่ยังมี HTTP API แบบเดียวกับ Turso แล้วตั้ง:

```env
GROUP1_DATABASE_URL=libsql://หรือhttps://ฐานข้อมูล-on-premise
GROUP1_DATABASE_AUTH_TOKEN=...
```

จากนั้นสร้าง schema:

```bash
node --env-file=.env.local scripts/setup-group1-db.mjs
```

ถ้าเลือก SQLite ไฟล์เดียวบนเครื่อง ต้องเปลี่ยน adapter ใน `src/lib/group1-booking-db.ts` จาก Turso HTTP pipeline เป็น SQLite driver และทำ backup ไฟล์ฐานข้อมูลตามรอบเวลา ระบบส่วนอื่นไม่ควรต้องเปลี่ยน

### 3. LINE บน On-premise

LINE ต้องเข้าถึง webhook จากอินเทอร์เน็ตได้ จึงห้ามใช้ URL `localhost` หรือ private IP โดยตรง

ตั้ง Webhook เป็น:

```text
https://your-public-domain/api/line/webhook
```

ถ้าไม่ต้องการเปิด Server ตรง ๆ ให้ใช้ reverse proxy หรือ gateway ที่รับ HTTPS แล้วส่งต่อเข้า Server ภายใน

### 4. สิ่งที่ต้องย้ายจาก Cloudflare

- ค่า environment/secrets ทั้งหมด
- ฐานข้อมูลหรือ backup จาก Turso
- Domain/DNS และ TLS certificate
- LINE Webhook URL
- Process manager และ reverse proxy configuration

ไม่ต้องย้าย Cloudflare Rate Limit โดยตรง แต่ควรตั้ง rate limit ที่ reverse proxy หรือ firewall สำหรับ `/login`, `/booking` และ `/api/line/webhook`

## Data Dictionary: Turso/libSQL

### `group1_fellows`

รายชื่อ Fellow ที่เลือกใช้ในตารางนัด

| คอลัมน์ | ชนิด | ความหมาย |
| --- | --- | --- |
| `fellow_name` | TEXT, PK | ชื่อ Fellow |
| `active` | INTEGER | `1` ใช้งาน, `0` ปิดใช้งาน |

### `group1_schedule`

ตารางวันออกตรวจและจำนวนคิว

| คอลัมน์ | ชนิด | ความหมาย |
| --- | --- | --- |
| `schedule_id` | INTEGER, PK | เลขรายการ |
| `clinic_date` | TEXT | วันที่รูปแบบ `YYYY-MM-DD` |
| `fellow_name` | TEXT | ชื่อ Fellow |
| `max_slots` | INTEGER | จำนวนคิวสูงสุดต่อวัน เช่น `2` |
| `note` | TEXT | หมายเหตุของตาราง |
| `start_time` | TEXT | เวลาเริ่ม เช่น `09:00` |
| `end_time` | TEXT | เวลาสิ้นสุด เช่น `12:00` |

ข้อจำกัด: `clinic_date + fellow_name` ต้องไม่ซ้ำกัน

### `group1_bookings`

ข้อมูลนัดของผู้ส่งต่อ โดยไม่เก็บชื่อผู้ป่วยหรือ HN

| คอลัมน์ | ชนิด | ความหมาย |
| --- | --- | --- |
| `referral_id` | TEXT, PK | เลขอ้างอิงนัด |
| `referral_type` | TEXT | ประเภทนัด ปัจจุบัน `TRANSPLANT_APPOINTMENT` |
| `status` | TEXT | เช่น `Appointment Confirmed`, `Cancelled` |
| `submitted_at` | TEXT | เวลาสร้างรายการแบบ ISO 8601 |
| `consent_acknowledged_at` | TEXT | ค่าเวลา legacy ภายในระบบ ไม่ได้มี checkbox ในแบบฟอร์มปัจจุบัน |
| `clinic_date` | TEXT | วันที่นัด |
| `fellow_name` | TEXT | Fellow ที่นัดพบ |
| `slot_number` | INTEGER | ลำดับคิวของ Fellow ในวันนั้น |
| `referrer_org` | TEXT | โรงพยาบาลต้นทาง |
| `referrer_name` | TEXT | แพทย์ผู้ส่งต่อ |
| `referrer_phone` | TEXT | เบอร์ติดต่อ |
| `referrer_email` | TEXT | อีเมลผู้ส่งต่อ เก็บไว้ติดต่อกลับ ปัจจุบันยังไม่ส่งอัตโนมัติ |
| `disease_group` | TEXT | กลุ่มโรค |
| `diagnosis` | TEXT | การวินิจฉัยที่ผู้ส่งต่อกรอก |
| `patient_age` | TEXT | อายุผู้ป่วย |
| `patient_sex` | TEXT | เพศ |
| `note` | TEXT | หมายเหตุ |
| `manage_token` | TEXT, UNIQUE | token สำหรับเปิด/เลื่อน/ยกเลิกนัด |
| `transplant_indication` | TEXT | ข้อบ่งชี้การปลูกถ่าย |
| `cancelled_at` | TEXT | เวลายกเลิก ถ้ามี |

### `group1_fellow_line_accounts`

การผูก LINE User กับ Fellow

| คอลัมน์ | ชนิด | ความหมาย |
| --- | --- | --- |
| `line_user_id` | TEXT, PK | LINE User ID |
| `fellow_name` | TEXT | ชื่อ Fellow ที่ผูกไว้ |
| `linked_at` | TEXT | เวลาผูกบัญชี |
| `active` | INTEGER | `1` ใช้งาน, `0` ยกเลิกการผูก |

## Backup ขั้นต่ำ

ต้อง backup ฐานข้อมูลก่อนแก้ schema หรือย้าย Server และเก็บ backup แยกจากเครื่อง production การ restore ต้องทดสอบในฐานข้อมูลสำรองก่อนเสมอ

## สถานะปัจจุบัน

- Production: Cloudflare Worker `sibmt-14`
- Database: Turso/libSQL
- Public groups: นัดปลูกถ่ายฯ และ Refer ผู้ป่วยนอก
- ไม่มี Google Sheet และ Apps Script ใน runtime
