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
| `AUTH_SECRET` | กุญแจเซ็น session cookie ของ dashboard |
| `DASHBOARD_USERS` | ชื่อผู้ใช้และ hash รหัสผ่านของผู้มีสิทธิ์เข้า dashboard |
| `SCHEDULE_API_URL` | (ไม่บังคับ) Web app URL ของ Apps Script สำหรับแก้ตารางเวรจาก dashboard |
| `SCHEDULE_API_TOKEN` | (ไม่บังคับ) token ของ Web app ข้างต้น |

> service account ต้องได้รับสิทธิ์ **Viewer** บน Google Sheet เท่านั้นเท่าที่จำเป็น และต้องแยก sheet ของ production ออกจาก test ตาม NFR-003

## Access Control สำหรับ /dashboard

ต้องตั้งค่าก่อนเปิดใช้งานจริง มิฉะนั้นข้อมูลผู้ป่วยจะเข้าถึงได้โดยสาธารณะ

**มติที่เลือกไว้: ใช้รหัสผ่านในแอปอย่างเดียว ไม่ใช้ Cloudflare Access**

เหตุผล — Cloudflare Access ต้องผูกกับอีเมลรายบุคคล ซึ่งแปลว่าต้องขออีเมล
ของ fellow ทุกคนและตามแก้ทุกปีที่เปลี่ยนรอบ ต้นทุนการดูแลไม่คุ้มกับสิ่งที่ได้เพิ่ม
เมื่อข้อมูลในระบบถูกถอดชื่อและ HN ออกไปแล้ว (ดู §ที่เก็บข้อมูล)

สิ่งที่ยอมแลกไปคือ log การเข้าถึงรายบุคคล และการบล็อกตั้งแต่ชั้นเครือข่าย
ถ้าวันหนึ่งระบบเริ่มเก็บข้อมูลที่ระบุตัวผู้ป่วยได้ ต้องกลับมาทบทวนข้อนี้ใหม่

### ชั้นที่ 1 — รหัสผ่านในแอป

รองรับผู้ใช้หลายคน แต่ละคนมีรหัสผ่านของตัวเอง ไม่ต้องมีอีเมล ไม่ต้องรอ OTP

ตั้งค่าสองตัว ที่ Cloudflare Dashboard → Settings → **Variables and Secrets**
(เลือกชนิดเป็น **Secret** ไม่ใช่ Variable — Secret จะอ่านค่ากลับจากหน้าจอไม่ได้)
ตอนพัฒนาในเครื่องใส่ที่ `.env.local` แทน

| ตัวแปร | ค่าที่ใส่ |
| --- | --- |
| `AUTH_SECRET` | พิมพ์อะไรยาว ๆ มั่ว ๆ ก็ได้ ไม่ต้องจำ ใช้เซ็น session cookie |
| `DASHBOARD_USERS` | `ชื่อ:รหัสผ่าน` คั่นแต่ละคนด้วย `;` |

```
AUTH_SECRET=jf83nfk20dmz91ksla02mfnz
DASHBOARD_USERS=admin:ยาวหน่อยนะรหัสนี้;fellow1:อีกรหัสหนึ่งที่ยาวพอ
```

- เพิ่มคน = ต่อท้ายด้วย `;` แล้วพิมพ์เพิ่ม
- ถอนสิทธิ์ = ลบเฉพาะช่วงของคนนั้นออก คนอื่นไม่กระทบ
  — คนที่ถูกลบจะถูกตัดออกจากระบบทันที ไม่ต้องรอ session หมดอายุ
- เปลี่ยนรหัส = แก้ทับตรงนั้น (คนนั้นต้องล็อกอินใหม่ คนอื่นไม่กระทบ)
- ห้ามมี `;` ในรหัสผ่าน (ใช้เป็นตัวคั่น) ส่วน `:` ใช้ได้ปกติ
- ชื่อผู้ใช้ไม่แยกตัวพิมพ์ใหญ่เล็ก

**ข้อควรระวังข้อเดียวของการพิมพ์รหัสตรง ๆ** — ห้ามใช้รหัสที่ซ้ำกับบริการอื่น
(อีเมล ธนาคาร ระบบโรงพยาบาล) เพราะถ้าค่าใน environment หลุด รหัสนั้นหลุดไปด้วย
ตั้งรหัสเฉพาะของระบบนี้ ยาว 12 ตัวอักษรขึ้นไป เป็นวลี 3-4 คำจำง่ายและเดายาก

**แบบเก็บเป็น hash (ไม่บังคับ)** — ถ้าไม่อยากให้รหัสตัวจริงอยู่ในไฟล์เลย
รัน `node scripts/make-user.mjs somchai` ใน Terminal แล้วเอาบรรทัดที่ได้ไปวางแทน
ผสมกับแบบพิมพ์ตรง ๆ ในค่าเดียวกันได้ ระบบดูออกเองว่าอันไหนเป็นแบบไหน

> การ hash ที่นี่ช่วยได้แค่กรณีเดียวคือรหัสซ้ำกับบริการอื่น — เพราะกุญแจของ
> Google ก็อยู่ใน environment เดียวกันนี้ ใครที่อ่าน environment ได้ก็เข้าถึง
> ชีตได้อยู่แล้วไม่ว่าจะ hash หรือไม่ ถ้าตั้งรหัสไม่ซ้ำกับที่อื่น พิมพ์ตรง ๆ ก็เพียงพอ

**สิ่งที่ชั้นนี้ทำได้** — กันคนที่บังเอิญเจอลิงก์ กันบอทและ search engine
และบอกได้ว่าใครล็อกอินอยู่ (ชื่อผู้ใช้ขึ้นบนแถบดำด้านบนทุกหน้า)

**สิ่งที่ชั้นนี้ทำไม่ได้** — ถ้ารหัสผ่านหลุด ก็เข้าได้จากทุกที่ในโลก
ไม่มีการยืนยันตัวตนชั้นที่สอง และไม่มี log ว่าใครเปิดดูอะไรเมื่อไหร่

> สงสัยว่ารหัสหลุดหลายคนพร้อมกัน ให้เปลี่ยน `AUTH_SECRET` ด้วย
> — ทุก session ที่ค้างอยู่จะถูกตัดทันที ทุกคนต้องล็อกอินใหม่

### ชั้นที่ 2 — Rate Limiting ที่ Cloudflare (ต้องทำ ไม่ต้องใช้อีเมล)

**นี่คือช่องโหว่ที่เหลืออยู่เมื่อไม่ใช้ Cloudflare Access** — เมื่อรหัสผ่านเป็นด่านเดียว
ต้องมีอะไรสักอย่างหยุดคนที่ไล่เดารหัสรัวๆ ตัวแอปหน่วงเวลาไว้ 0.8 วินาทีต่อครั้งที่ผิด
แต่ผู้โจมตียิงพร้อมกันหลายเส้นได้ จึงยังไม่พอ

ตั้งที่ Cloudflare ใช้เวลาไม่ถึง 5 นาที **ไม่ต้องมีอีเมลของใครเลย**:

1. Cloudflare Dashboard → เลือกโดเมน → **Security** → **WAF** → **Rate limiting rules**
2. Create rule
   - **Field**: URI Path — **Operator**: equals — **Value**: `/login`
   - **When rate exceeds**: 10 requests per 1 minute (นับจาก IP เดียวกัน)
   - **Then**: Block — Duration 10 minutes
3. Deploy

10 ครั้งต่อนาทีเหลือเฟือสำหรับคนพิมพ์ผิด แต่ตัดการไล่เดาอัตโนมัติทิ้งทันที

### ถ้าวันหนึ่งจะกลับมาใช้ Cloudflare Access

ไม่ได้มาแทนชั้นที่ 1 แต่ซ้อนอยู่ข้างหน้า — คนที่ผ่าน Access มาแล้วยังต้องใส่รหัสผ่านอยู่ดี

1. Cloudflare Dashboard → Zero Trust → Access → Applications → Add an application
2. เลือก **Self-hosted**
3. ตั้ง path เป็น `sibmt-refer.pages.dev/dashboard*`
4. เพิ่ม Policy: Allow → Emails ending in `@<โดเมนองค์กร>` หรือระบุรายชื่ออีเมลเฉพาะบุคลากรที่เกี่ยวข้อง
5. ทบทวนรายชื่อผู้มีสิทธิ์ทุก 3 เดือนตาม PDPA-004

ข้อดีที่รหัสผ่านให้ไม่ได้: บล็อกตั้งแต่ชั้นเครือข่ายก่อนถึงแอป,
มี log การเข้าถึงรายบุคคล, ผูกกับบัญชีองค์กรจึงตัดสิทธิ์ได้พร้อมกับตอนพ้นหน้าที่

## Checklist ก่อน Deploy จริง

- [ ] checkbox รับทราบในฟอร์มเป็น required และบันทึก timestamp ลง `consent_acknowledged` ได้จริง
      (มติอาจารย์ให้ใช้แทนการรับรองจากฝ่ายสารสนเทศ จึงต้องรัดกุมเป็นพิเศษ)
- [ ] Google Sheet และ Drive ไม่ได้ตั้งเป็น "anyone with link" และให้สิทธิ์เป็นรายอีเมลเท่านั้น
- [ ] แยก 3 ชุดข้อมูลเป็นคนละชีตแล้ว
- [ ] เติมค่าจริงใน `src/lib/config.ts` — `ESCALATION_CONTACTS`, `LINE_OA`, `FORM_URL`
- [ ] มีชื่อผู้สำรองของแพทย์แอดมินกลางแล้ว
- [ ] ตั้ง `AUTH_SECRET` และ `DASHBOARD_USERS` แล้ว — เปิด `/dashboard` ต้องเด้งไปหน้า login
      และ**ต้องไม่เห็นแถบแดง "ยังไม่ได้ตั้งรหัสผ่าน"**
- [ ] ทดสอบว่ารหัสผ่านผิดเข้าไม่ได้ และปุ่มออกจากระบบใช้ได้จริง
- [ ] **ตั้ง rate limiting rule บน `/login` ที่ Cloudflare WAF แล้ว** —
      ข้อนี้สำคัญเป็นพิเศษเพราะไม่ได้ใช้ Cloudflare Access รหัสผ่านจึงเป็นด่านเดียว
- [ ] รหัสผ่านของทุกคนยาว 12 ตัวอักษรขึ้นไป และไม่ได้ส่งกันในกลุ่ม LINE ที่มีคนนอกอยู่
- [ ] ตรวจว่าไม่มี credential รั่วใน client bundle
- [ ] แยก Google Sheet ของ production ออกจาก test
