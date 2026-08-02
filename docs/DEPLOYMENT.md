# Deployment — Cloudflare Pages

เอกสารนี้อธิบายการ deploy web portal ขึ้น Cloudflare Pages ตามที่ตัดสินใจไว้ใน [SRS.md §7.2](SRS.md)

## ทำไมเลือก Cloudflare Pages

| เหตุผล | รายละเอียด |
| --- | --- |
| Access control ฟรีในตัว | Cloudflare Access (Zero Trust) กั้นหน้า `/dashboard` ด้วยบัญชีองค์กรได้โดยไม่ต้องเขียนระบบ login เอง — ตรงกับ PDPA-004 |
| สอดคล้องกับ infra เดิม | ทีมมีโปรเจกต์อื่นบน Cloudflare Pages อยู่แล้ว ใช้ความรู้เดิมได้ |
| ค่าใช้จ่าย | Free tier เพียงพอสำหรับปริมาณ traffic ระดับนี้ |

**ข้อแลกเปลี่ยน:** ต้องเรียก Google Sheets API แบบ REST + JWT เอง แทนการใช้ `googleapis` SDK เต็ม เพราะ SDK หนักเกินสำหรับ edge runtime

## ขั้นตอน Deploy

### 1. ติดตั้ง adapter

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
```

### 2. เพิ่ม script ใน package.json

```json
{
  "scripts": {
    "preview:cf": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy:cf": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
  }
}
```

### 3. สร้าง wrangler.jsonc

```jsonc
{
  "name": "sibmt-refer",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-07-29",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

### 4. เชื่อม Git repository

ที่ Cloudflare Dashboard → Workers & Pages → Create → เลือก repo นี้ แล้วตั้ง build command เป็น `npm run deploy:cf`

## ที่เก็บข้อมูล (Data Store)

มติอาจารย์ 29 ก.ค. 2569 ให้แยกข้อมูลเป็น 3 ชุดตาม [SRS.md](SRS.md) §PDPA-005
ที่เก็บจึงต่างกันตามความต้องการของแต่ละชุด

| ชุด | ระยะ pilot | เมื่อขยาย |
| --- | --- | --- |
| 1. เคสเต็ม (เก็บ 2–3 ปี) | Google Sheet | **Cloudflare D1** เมื่อข้อมูลเกิน ~3,000 แถว |
| 2. คลังคำตอบ (ถาวร) | Google Sheet | คงไว้ที่ Google Sheet |
| 3. สถิติสรุป (ถาวร) | Google Sheet | คงไว้ที่ Google Sheet |

**ทำไมชุดที่ 2 และ 3 ไม่ต้องย้ายเข้า database:** ไม่มีข้อมูลส่วนบุคคล ความเสี่ยงต่ำ
และแพทย์ควรแก้ไขเพิ่มสูตรยาได้เองโดยไม่ต้องพึ่งโปรแกรมเมอร์ — Google Sheet เหมาะกว่า

> **ข้อควรเข้าใจ:** Cloudflare D1 **เป็นผู้ให้บริการภายนอกเช่นเดียวกับ Google**
> ข้อมูลยังคงอยู่บนเซิร์ฟเวอร์ของบริษัทต่างประเทศ การย้ายจาก Google Sheet ไป D1
> **ไม่ได้แก้ปัญหาเรื่องข้อมูลออกนอกโรงพยาบาล** และไม่ควรถูกเสนอในฐานะที่แก้ประเด็นนั้น
> หากต้องการให้ข้อมูลไม่ออกนอกโรงพยาบาลจริง มีทางเดียวคือเซิร์ฟเวอร์ของหน่วยงานเอง
> — ดูการเปรียบเทียบใน [DATA_HOSTING_OPTIONS.md](DATA_HOSTING_OPTIONS.md)

**ประโยชน์ที่ D1 ให้จริง (จำกัดอยู่ 2 ข้อ):**

- อยู่ในแพลตฟอร์มเดียวกับที่ deploy อยู่แล้ว ไม่ต้องเพิ่มบริการหรือ credential ใหม่ (มี binding ให้ในตัว)
- เข้าถึงได้เฉพาะผ่านแอปที่มี Cloudflare Access กั้น — ปิดความเสี่ยง "แชร์ลิงก์หลุด" ซึ่งเป็นความเสี่ยงอันดับหนึ่งของ Google Sheet
- ลบข้อมูลตามกำหนดเวลาได้ด้วยคำสั่งเดียวและตรวจสอบได้ ต่างจาก Sheet ที่ต้องเขียน script เองและพลาดง่าย
- ยังเร็วแม้ข้อมูลสะสมมาก

ทางเลือกเทียบเท่าคือ **Turso** ซึ่งทีมมีประสบการณ์อยู่แล้ว ทั้งคู่เป็น SQLite ย้ายข้ามกันได้ภายหลัง

### ตัวอย่างการตั้งค่า D1 (เมื่อถึงเวลา)

```bash
npx wrangler d1 create sibmt-refer
```

เพิ่ม binding ใน `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "sibmt-refer",
      "database_id": "<id ที่ได้จากคำสั่งด้านบน>"
    }
  ]
}
```

ลบข้อมูลเคสที่เกินกำหนด (ตั้งเป็น cron trigger รายเดือน):

```sql
DELETE FROM referrals WHERE closed_at < date('now', '-3 years');
```

### ข้อควรทำตั้งแต่ระยะ pilot

แม้จะเริ่มด้วย Google Sheet ให้ออกแบบโครงสร้างข้อมูลให้ย้ายง่ายตั้งแต่ต้น:

- หนึ่งแถวต่อหนึ่งเคส ไม่มี merge cell
- ชื่อคอลัมน์ตรงกับชื่อ field ในโค้ด (ดู `src/lib/referral-types.ts`)
- ไม่ใช้สูตรข้ามชีต — ให้คำนวณในโค้ดหรือในชีตสถิติแยกต่างหาก
- แยก 3 ชุดข้อมูลเป็นคนละชีตตั้งแต่แรก

## Environment Variables (Secrets)

ตั้งค่าใน Cloudflare Dashboard → Settings → Variables and Secrets **เท่านั้น** ห้าม commit ลง repo (NFR-003)

| ชื่อ | ใช้ทำอะไร |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | อีเมล service account ที่มีสิทธิ์อ่าน Google Sheet |
| `GOOGLE_PRIVATE_KEY` | private key ของ service account (ใช้เซ็น JWT) |
| `GOOGLE_SHEET_ID` | ID ของ Google Sheet ที่เก็บข้อมูล referral |
| `LINE_CHANNEL_ACCESS_TOKEN` | token สำหรับส่งข้อความผ่าน LINE Messaging API |

> service account ต้องได้รับสิทธิ์ **Viewer** บน Google Sheet เท่านั้นเท่าที่จำเป็น และต้องแยก sheet ของ production ออกจาก test ตาม NFR-003

## Access Control สำหรับ /dashboard

ต้องตั้งค่าก่อนเปิดใช้งานจริง มิฉะนั้นข้อมูลผู้ป่วยจะเข้าถึงได้โดยสาธารณะ

1. Cloudflare Dashboard → Zero Trust → Access → Applications → Add an application
2. เลือก **Self-hosted**
3. ตั้ง path เป็น `sibmt-refer.pages.dev/dashboard*`
4. เพิ่ม Policy: Allow → Emails ending in `@<โดเมนองค์กร>` หรือระบุรายชื่ออีเมลเฉพาะบุคลากรที่เกี่ยวข้อง
5. ทบทวนรายชื่อผู้มีสิทธิ์ทุก 3 เดือนตาม PDPA-004

## Checklist ก่อน Deploy จริง

- [ ] checkbox รับทราบในฟอร์มเป็น required และบันทึก timestamp ลง `consent_acknowledged` ได้จริง
      (มติอาจารย์ให้ใช้แทนการรับรองจากฝ่ายสารสนเทศ จึงต้องรัดกุมเป็นพิเศษ)
- [ ] Google Sheet และ Drive ไม่ได้ตั้งเป็น "anyone with link" และให้สิทธิ์เป็นรายอีเมลเท่านั้น
- [ ] แยก 3 ชุดข้อมูลเป็นคนละชีตแล้ว
- [ ] เติมค่าจริงใน `src/lib/config.ts` — `ESCALATION_CONTACTS`, `LINE_OA`, `FORM_URL`
- [ ] มีชื่อผู้สำรองของแพทย์แอดมินกลางแล้ว
- [ ] ตั้งค่า Cloudflare Access บน `/dashboard` แล้วทดสอบว่าเข้าจากบัญชีนอกองค์กรไม่ได้
- [ ] ตรวจว่าไม่มี credential รั่วใน client bundle
- [ ] แยก Google Sheet ของ production ออกจาก test
