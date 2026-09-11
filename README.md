# SiBMT Refer — Siriraj Smart Outpatient Referral System for Hematology

Web portal + staff dashboard สำหรับ workflow การส่งต่อผู้ป่วยนอก OPD โลหิตวิทยา ภาควิชาอายุรศาสตร์ สาขาโลหิตวิทยา โรงพยาบาลศิริราช

## เอกสาร

| เอกสาร | เนื้อหา |
| --- | --- |
| [docs/HANDOVER.md](docs/HANDOVER.md) | **👈 เริ่มที่นี่** — คู่มือส่งมอบ: ระบบมีอะไร อยู่ที่ไหน พังแล้วดูตรงไหน และทำไมถึงออกแบบแบบนี้ |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | **คู่มือใช้งานและดูแลระบบ** — วิธีใช้ทุกช่องทาง คำสั่งบอท งานประจำแอดมิน ซ่อมบำรุง ไล่อาการเมื่อพัง |
| [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) | **Data dictionary** — ทุกแท็บ ทุกคอลัมน์ config / Script Properties / env / สถานะ / ค่าคงที่ |
| [docs/SRS.md](docs/SRS.md) | Software Requirements Specification (v0.3) |
| [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | **คู่มือติดตั้งทีละขั้น** — เริ่มที่นี่เมื่อจะลงมือสร้างจริง |
| [docs/FORMS_AND_SHEETS.md](docs/FORMS_AND_SHEETS.md) | รายละเอียดคำถามในฟอร์มและโครงสร้างชีต (ใช้คู่กับคู่มือติดตั้ง) |
| [apps-script/README.md](apps-script/README.md) | โค้ดระบบหลังบ้าน (Apps Script) และขั้นตอนติดตั้ง |
| [docs/LINE_TEMPLATES.md](docs/LINE_TEMPLATES.md) | Rich Menu และข้อความ LINE ทุกฉบับ พร้อมคัดลอกไปใช้ |
| [docs/PROPOSAL_REVIEW.md](docs/PROPOSAL_REVIEW.md) | รีวิวโครงร่างโครงการ ช่องว่างที่พบ และมติจากอาจารย์ |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | ขั้นตอน deploy ขึ้น Cloudflare Pages และการตั้งค่า access control |
| [docs/DATA_HOSTING_OPTIONS.md](docs/DATA_HOSTING_OPTIONS.md) | เปรียบเทียบที่เก็บข้อมูล 3 ทาง และภาระความรับผิด |
| [docs/PATIENT_DATA_CONSULTATION.md](docs/PATIENT_DATA_CONSULTATION.md) | บันทึกขอความเห็นเรื่อง PDPA และการไม่เก็บข้อมูลระบุตัวตน |
| [docs/HEMATO_BOT.md](docs/HEMATO_BOT.md) | คู่มือ Hemato Bot — วิดเจ็ตแชทลอยบนหน้าเว็บ เมนูทั้งหมด โมเดลความปลอดภัย และเช็กลิสต์ก่อนเปิดใช้ |

## แนวคิดหลัก: 4-Group Triage

ระบบแยกงานตาม **ลักษณะงานที่แพทย์ต้นทางร้องขอ** ไม่ใช่ตามกลุ่มโรค เพราะเป็นตัวกำหนดว่าใครดูแลและตอบกลับอย่างไร

| กลุ่ม | ลักษณะงาน | ผู้รับผิดชอบ |
| --- | --- | --- |
| 1 | ขอนัดหมายพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด | แพทย์แอดมิน (จัดคิว fellow) |
| 2 | ขอความเห็นสูตรยาเคมีบำบัด | Resident R2/R3 + Attending อนุมัติ |
| 3 | ขอส่งตัวมาให้ยาเคมีบำบัด/ยากดภูมิ | Resident R2/R3 วอร์ดเคโม |
| 4 | Refer ผู้ป่วยนอกด้วยเหตุผลอื่น | **ไม่เข้าระบบนี้แล้ว** — ใช้ระบบนัดหมายของโรงพยาบาล (มติ 2 ส.ค. 2569) |

กลุ่มโรค (leukemia / lymphoma / myeloma / …) เป็นแกนรอง ใช้กับ checklist เอกสารและรายงาน

## สถานะการพัฒนา

**สร้างแล้ว:**

- **หน้าแรก** (`/`) — จุดเข้าใช้งานเดียว เลือก 1 ใน 4 กลุ่ม + ปุ่ม "ไม่แน่ใจว่าเข้ากลุ่มไหน", ทางเข้า LINE OA, privacy notice (FR-001, FR-012)
- **หน้ารายละเอียดกลุ่ม** (`/refer/[type]`) — checklist เอกสารแยกตามกลุ่ม ผู้รับผิดชอบ กรอบเวลาตอบกลับ (FR-003)
- **แบบฟอร์มรับทราบ PDPA** (`/consent`) — หนังสือให้ผู้ป่วยลงนาม พิมพ์ได้ (PDPA-002 ชั้นที่ 2)
- **Dashboard** (`/dashboard`) — queue แยกตามกลุ่มงาน, alert level (yellow/red), duplicate flag, filter และ export CSV (FR-008, FR-009)
- **การเชื่อมต่อ Google Sheet** — อ่านข้อมูลจริงผ่าน Sheets REST API เมื่อตั้งค่า env แล้ว
  ถ้ายังไม่ตั้งจะแสดงข้อมูลตัวอย่างพร้อมป้ายแจ้งเตือน
- **Apps Script** (`apps-script/`) — สร้าง referral ID, นับ SLA แบบชั่วโมงทำการ,
  ตรวจเคสซ้ำ, แจ้งเตือน LINE รอบ 10:00 น., ถอดชื่อเมื่อครบกำหนด, สรุปสถิติรายเดือน

**ติดตั้งและทดสอบบนบัญชีจริงแล้ว (31 ก.ค. 2569):**

- Google Form 7 sections — branching ครบทั้ง 4 กลุ่ม ทดสอบผ่าน
- Google Sheet — เปลี่ยนหัวคอลัมน์ครบ 38 คอลัมน์ ไม่มีคอลัมน์ระบุตัวตน
- Apps Script — `runSelfTest()` ผ่าน, ทดสอบส่งจริงแล้ว 1 เคส:
  สร้าง referral ID, แปลง `referral_type`, รวมคอลัมน์ซ้ำ 6 ชุด,
  นับชั่วโมงทำการถูกต้อง (ส่งนอกเวลาราชการ → 0 ชม.), ส่งอีเมลรหัสอ้างอิงสำเร็จ

**ยังไม่ได้ทำ:**

- ลิงก์ prefilled 4 กลุ่ม → ใส่ใน `FORM_URL` ของ `src/lib/config.ts`
- Service account ให้ dashboard อ่านชีตจริง (ตอนนี้ยังใช้ข้อมูลตัวอย่าง)
- กรอกวันหยุดในชีต `holidays` — ต้องทำก่อนเปิด trigger แจ้งเตือน
- LINE OA และ Rich Menu — ใช้ **Messaging API** เพราะ LINE Notify ปิดบริการแล้ว
- Cloudflare Access บน `/dashboard`
- ระบบจัดคิว fellow และ capacity view (กลุ่มที่ 1)
- **ลบข้อมูลทดสอบออกจากชีตก่อนเปิดใช้จริง**

## ค่าที่ต้องเติมก่อนใช้งานจริง

ดู `src/lib/config.ts` — ค่าที่ทำเครื่องหมาย `TODO` ต้องเติมของจริง:

- `ESCALATION_CONTACTS` — ชื่อคุณหมอแอดมินกลาง **และผู้สำรอง**, ผู้ดูแล Template Library
- `LINE_OA.addFriendUrl` — LINE OA ของระบบนี้
- `FORM_URL` — URL ของ Google Form แต่ละกลุ่ม

## Development

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 — deploy บน Cloudflare Pages
