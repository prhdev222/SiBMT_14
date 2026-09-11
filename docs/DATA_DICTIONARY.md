# Data Dictionary — SiBMT-refer

พจนานุกรมข้อมูลสำหรับแอดมิน: ทุกแท็บใน Google Sheet, ทุกคอลัมน์, ค่าตั้งค่า, และค่าคงที่ที่ระบบใช้
ปรับปรุง **11 กันยายน 2569** · ตรวจกับหัวคอลัมน์จริงในชีต ณ วันที่เขียน

> ใช้คู่กับ [ADMIN_GUIDE.md](ADMIN_GUIDE.md) (วิธีใช้งาน) และ [HANDOVER.md](HANDOVER.md) (สถาปัตยกรรม/เหตุผลการออกแบบ)

**กฎที่ใช้ทั้งเอกสาร**
- **ห้ามแก้แถวหัวคอลัมน์ (แถว 1)** ของทุกแท็บ — ระบบอ่านคอลัมน์ตามชื่อ ไม่ใช่ตามลำดับ
- "ใครเขียน" = **ฟอร์ม** (Google Form) · **ระบบ** (Apps Script/เว็บ) · **คน** (แอดมินกรอกเอง)
- ค่าวันที่ในชีตเก็บเป็นวันที่ของ Google Sheets (โซนเวลา Asia/Bangkok) ยกเว้นที่ระบุว่าเป็นข้อความ `yyyy-MM-dd`
- ⚠️ = คอลัมน์/ค่าที่แก้ผิดแล้วระบบพังเงียบ

---

## 1. ไฟล์และแท็บ

ระบบใช้ **2 ไฟล์ Google Sheet** (แยกโดยเจตนา — ตารางเวร fellow ไม่ปนกับข้อมูลผู้ป่วย)

| ไฟล์ | env / Property | แท็บ |
|---|---|---|
| ไฟล์หลัก (ผูกกับ Apps Script) | `GOOGLE_SHEET_ID` | referrals · messages · config · holidays · attendings · residents · resident_schedule · documents · line_links · dashboard_logins · status_log · chemo_regimens · transplant_indications · advice_library · stats_monthly |
| ไฟล์ตารางเวร fellow | `GOOGLE_SCHEDULE_SHEET_ID` / `SCHEDULE_SHEET_ID` | fellow_schedule |

| แท็บ | ใครเขียน | หน้าที่ | เก็บนานแค่ไหน |
|---|---|---|---|
| `referrals` | ฟอร์ม + ระบบ | **แท็บหลัก** 1 แถว = 1 เคส | 12 เดือน แล้วถอดชื่อย้ายไป advice_library |
| `messages` | ระบบ | ข้อความ/ไฟล์ในห้องเคส (แพทย์ต้นทาง ↔ ทีม) | ตามเคส |
| `config` | คน (+ปุ่มบนเว็บ) | ค่าตั้งค่าที่แก้ได้โดยไม่แตะโค้ด | ถาวร |
| `holidays` | คน | วันหยุด — ใช้คำนวณชั่วโมงทำการ (SLA) | ถาวร |
| `attendings` | คน (หน้าตั้งค่า) | รายชื่ออาจารย์ที่รับรองคำตอบ | ถาวร |
| `residents` | HSOS sync + คน | รายชื่อ resident ที่รับเคสกลุ่ม 2/3 | ถาวร |
| `resident_schedule` | HSOS sync + หน้าเวร | เวร Chief ประจำวอร์ด = เวรตอบคำปรึกษา | ถาวร |
| `documents` | คน (หน้าตั้งค่า) | คลังเอกสาร/ลิงก์ให้แพทย์ต้นทาง | ถาวร |
| `line_links` | ระบบ | แพทย์ต้นทางที่ผูก LINE กับเบอร์โทร | ถาวร |
| `dashboard_logins` | ระบบ | บันทึกการเข้า dashboard ด้วย LINE (ผ่าน/ไม่ผ่าน) | ถาวร |
| `status_log` | ระบบ | ประวัติเปลี่ยนสถานะทุกครั้ง | ถาวร |
| `chemo_regimens` | คน | คลังสูตรยาเคมีบำบัด (ตัวช่วยแทรกสูตร) | ถาวร |
| `transplant_indications` | คน (มีค่าตั้งต้น) | เกณฑ์ปลูกถ่าย — dropdown ตอนจองคิวกลุ่ม 1 | ถาวร |
| `advice_library` | ระบบ (รายเดือน) | คลังคำตอบที่ถอดชื่อแล้ว | ถาวร |
| `stats_monthly` | ระบบ (รายเดือน) | สถิติรายเดือน | ถาวร |
| `fellow_schedule` (อีกไฟล์) | คน | วันออกตรวจ + โควตาคิวของ fellow | ถาวร |

---

## 2. แท็บ `referrals` — 80 คอลัมน์

### 2.1 ส่วนที่ Google Form เขียน (คอลัมน์ 1-39) ⚠️ ห้ามลบ/สลับ

| คอลัมน์ | ความหมาย | ค่า/รูปแบบ |
|---|---|---|
| `submitted_at` | เวลาส่งฟอร์ม (Timestamp ของ Google) | วันที่-เวลา |
| `consent_raw` | ข้อความรับทราบ PDPA ที่ผู้ส่งติ๊ก | ข้อความ |
| `referrer_org` | โรงพยาบาลต้นทาง | ข้อความ |
| `referrer_name` | ชื่อแพทย์ผู้ส่ง | ข้อความ |
| `referrer_phone` | เบอร์โทรกลับ — ใช้จับคู่กับ LINE (`line_links`) | ตัวเลข |
| `referrer_email` | อีเมล — ช่องทางหลักรับรหัสอ้างอิง/คำตอบ | อีเมล (บังคับในฟอร์ม) |
| `patient_age` | อายุผู้ป่วย (ปี) | ตัวเลข |
| `patient_sex` | เพศ | ชาย / หญิง |
| `urgency` | ความเร่งด่วน (ฟอร์มรุ่นเก่า — เคสใหม่ว่าง แต่ห้ามลบคอลัมน์) | Routine / Urgent |
| `referral_type` | **กลุ่มงาน** — ตอนส่งฟอร์มเป็นข้อความตัวเลือก ระบบแปลงเป็นรหัสทันที | ดู §7 |
| `diagnosis_g1` … `additional_note` (11-20) | คำถามกลุ่ม 1 รุ่นเก่า (กลุ่ม 1 จองผ่านเว็บแล้ว — ว่าง แต่ห้ามลบ) | — |
| `diagnosis_g2` | การวินิจฉัย (กลุ่ม 2) | ข้อความ |
| `disease_group_g2` | กลุ่มโรค (กลุ่ม 2) | เช่น Lymphoma, Leukemia |
| `stage_g2` | ระยะโรค (กลุ่ม 2) | ข้อความ |
| `treatment_summary_g2` | การรักษาที่ผ่านมา (กลุ่ม 2) | ข้อความ |
| `key_labs` | ผล lab สำคัญ (กลุ่ม 2) | ข้อความ |
| `clinical_question_g2` | คำถามที่ต้องการคำตอบ (กลุ่ม 2) | ข้อความ |
| `comorbidity_g2` | โรคร่วม (กลุ่ม 2) | ข้อความ |
| `diagnosis_g3` … `clinical_question_g3` (28-35) | ชุดเดียวกันสำหรับกลุ่ม 3 + `performance_status`, `admission_reason` | ข้อความ |
| `insurance_scheme` | สิทธิการรักษา — ต้องรู้ก่อนเลือกสูตรยา | ข้อความ |
| `referral_reason`, `diagnosis_g4`, `refer_letter_ready` | กลุ่ม 4 รุ่นเก่า (เลิกใช้ — ว่าง ห้ามลบ) | — |

### 2.2 ส่วนที่ระบบเขียน (คอลัมน์ 40-80)

| คอลัมน์ | ความหมาย | ใครเขียน / เมื่อไร |
|---|---|---|
| `referral_id` ⚠️ | รหัสเคส `HEM-YYYYMMDD-NNNN` (NNNN นับใหม่ทุกวัน) | ระบบ ตอนรับฟอร์ม/จองคิว |
| `consent_acknowledged_at` | เวลารับทราบ PDPA (= submitted_at) | ระบบ |
| `status` ⚠️ | สถานะเคส — dropdown ห้ามค่านอกรายการ (ดู §6) | ระบบ + dashboard |
| `diagnosis`, `disease_group`, `stage`, `treatment_summary`, `comorbidity`, `clinical_question` | **คอลัมน์กลาง** — รวมค่าจาก `_g2`/`_g3` ให้เหลือชุดเดียว (กลุ่ม 1 เขียนตรงนี้เลย) | ระบบ ตอนรับฟอร์ม |
| `assigned_to` | ผู้รับผิดชอบเคสกลุ่ม 2/3 (ชื่อต้องตรงกับ `residents`) | ระบบ (auto ตามเวร) / dashboard / Telegram `มอบ` |
| `elapsed_business_hours` | ชั่วโมงทำการที่รอมาแล้ว (คำนวณทุกชั่วโมง) | ระบบ (`recalculateSla`) |
| `alert_level` | none / yellow / red ตาม SLA | ระบบ |
| `yellow_alert_sent_at`, `red_alert_sent_at` | เวลาที่เตือนไปแล้ว (กันเตือนซ้ำ) | ระบบ |
| `possible_duplicate_of` | รหัสเคสที่อาจซ้ำ (อายุ+เพศ+เบอร์/รพ.เดียวกันใน 30 วัน) | ระบบ |
| `advice_record` | คำตอบ/คำแนะนำฉบับเต็ม | dashboard (resident) |
| `advice_by` | ชื่อ resident ผู้ตอบ | dashboard |
| `advice_attending` | อาจารย์ผู้รับรอง (ทุกเคสต้องมี) | dashboard |
| `advice_approved_at` | เวลาที่อาจารย์รับรอง | dashboard |
| `advice_regimens` | สูตรยาที่แนะนำ (จากคลัง) | dashboard |
| `advice_question_type` | ประเภทคำถาม (สถิติ) | dashboard |
| `advice_ward_phone`, `advice_direct_phone` | เบอร์ที่ให้แพทย์ต้นทางโทรกลับ | dashboard (เติมจาก config) |
| `advice_file_name`, `advice_file_url` | ไฟล์แนบคำตอบ (Drive) | dashboard |
| `incomplete_reason` | เหตุที่ข้อมูลไม่ครบ / ธงเตือนของระบบ (เช่น "⚠️ แปลง referral_type ไม่สำเร็จ") | dashboard / ระบบ |
| `fellow_assigned` | fellow ที่รับนัด (กลุ่ม 1) | เว็บจองคิว |
| `appointment_date` | วันนัด (กลุ่ม 1) | เว็บจองคิว (`yyyy-MM-dd`) |
| `appointment_note` | เวลา/สถานที่นัด เช่น "08:00 น. พบ …" | เว็บจองคิว |
| `fellow_notified_at` | เวลาที่แจ้ง fellow แล้ว | ระบบ |
| `transplant_indication` | ข้อบ่งชี้ปลูกถ่าย (รหัสจาก `transplant_indications`) | เว็บจองคิว |
| `note` | หมายเหตุภายใน | dashboard |
| `closed_at` | เวลาปิดเคส | ระบบ |
| `manage_token` | token ลิงก์เลื่อน/ยกเลิกนัด (กลุ่ม 1) — 32 ตัว | ระบบ |
| `answer_token` | token ลิงก์ดูคำตอบ `/answer/<token>` | ระบบ |
| `case_token` | token ห้องเคส `/case/<token>` (แนบไฟล์/อ่านทั้งหมด ไม่ต้อง login) | ระบบ ตอนรับฟอร์ม |
| `email_verify_token`, `email_verified_at`, `email_mismatch` | ยืนยันอีเมลผู้ส่ง | ระบบ |
| `referrer_unread`, `dent_unread` | yes = มีข้อความที่อีกฝั่งยังไม่อ่าน (ใช้รวบการแจ้งเตือน) | ระบบ |

> ⚠️ **หัวคอลัมน์ซ้ำ** (เช่น `referrer_email` โผล่ 2 ที่) = ต้นเหตุ "อีเมลไม่ส่ง / dashboard 0 เคส" (10 ก.ย. 2569) — ปุ่ม "ตรวจโครงสร้างชีต" จะฟ้อง และ `applyRepairDuplicateHeaders()` ซ่อมได้ ดู [ADMIN_GUIDE.md §7](ADMIN_GUIDE.md#7-ซ่อมบำรุง--repairgs)

---

## 3. แท็บสนับสนุน

### `messages` — ห้องเคส
| คอลัมน์ | ความหมาย |
|---|---|
| `message_id` | รหัสข้อความ (ไม่ซ้ำ) |
| `referral_id` | เคสที่สังกัด |
| `sender_role` | `referrer` (แพทย์ต้นทาง) / `resident` (ทีม) |
| `sender_name` | ชื่อผู้ส่ง (ทีมแสดงเป็น "ทีมโลหิตวิทยา") |
| `channel` | ช่องที่ส่งมา: `web` / `line` / `telegram` / `email` |
| `text` | ข้อความ |
| `created_at` | เวลา |
| `file_name`, `file_url` | ไฟล์แนบ (Drive โฟลเดอร์ `ATTACHMENT_FOLDER_ID`) |

### `config` — ค่าตั้งค่า (key / value / description)
| key | ใช้ที่ไหน | ค่า |
|---|---|---|
| `central_admin_name`, `central_admin_contact` | ข้อความเตือน SLA, หน้าเว็บ | ชื่อ / เบอร์-LINE |
| `central_admin_backup_name`, `central_admin_backup_contact` | ผู้สำรอง | |
| `central_admin_email` | รับข้อความจากหน้า "ติดต่อแพทย์แอดมินกลาง" | อีเมล คั่นด้วยจุลภาคได้ |
| `system_owner` | เจ้าของระบบ | ชื่อ |
| `template_library_owner`, `fellow_schedule_owner` | ผู้ดูแลคลังสูตร / ตารางเวร | ชื่อ |
| `opd_phone`, `chemo_ward_phone` | เบอร์ OPD 700 / วอร์ดเคมี — เติมอัตโนมัติในคำตอบ | เบอร์ |
| `regimen_library_url`, `bmt_indication_url` | ปุ่มเปิด PDF ในหน้าตอบ/จองคิว | URL |
| `line_push` | สวิตช์ push LINE ทีม (ปุ่มในหน้าตั้งค่า) | on / off (ค่าเริ่มต้น off) |
| `line_push_referrer` | push LINE ถึงแพทย์ต้นทาง | on / off (ค่าเริ่มต้น off) |
| `chat_push_dent` | (สำรอง) push แจ้ง dent เมื่อมีข้อความ | on / off |
| `line_group_code` | รหัสผูกกลุ่ม LINE (`ผูกกลุ่ม <รหัส>`) — แก้ได้จากหน้าตั้งค่า | A-Z0-9 4-12 ตัว |
| `telegram_invite_resident`, `telegram_invite_fellow`, `telegram_invite_admin` | ลิงก์เชิญ QR บนหน้า "กลุ่ม LINE/Telegram" (ว่าง = ใช้ลิงก์สำรองในโค้ด) | `https://t.me/+…` |

> ⚠️ ณ วันที่เขียน ชีตมีแถว `ltelegram_invite_fellow` / `ltelegram_invite_admin` (พิมพ์ `l` เกิน) และแถว `undefined` — ระบบมองไม่เห็นและใช้ลิงก์สำรองแทน แก้ชื่อ key ให้ถูกและลบแถวว่าง

### `holidays`
`holiday_date` (วันที่) · `description` — วันที่อยู่ในแท็บนี้ไม่นับเป็นชั่วโมงทำการ

### `attendings` / `residents`
`name` · `active` (ว่าง/yes = ใช้งาน, `no`/`false`/`ไม่` = ซ่อน — **อย่าลบแถว** เพราะเคสเก่ายังอ้างชื่อ) · attendings มี `note` เพิ่ม

### `resident_schedule` — เวร Chief ประจำวอร์ด
`from_date` · `to_date` (รวมวันสุดท้าย) · `resident_name` — 1 แถว = 1 คน 1 ช่วง เหลื่อมกันได้ = อยู่เวรพร้อมกัน · ระบบมอบเคสใหม่ให้เวร ณ วันที่ส่ง วนตามลำดับแถว · ปุ่ม "ดึงจาก HSOS" เขียนทับทั้งแท็บ

### `documents`
`title` · `groups` (เช่น `1` / `2,3` / `ทั้งหมด`) · `url` · `description` · `active`

### `line_links`
`line_user_id` · `referrer_phone` · `referrer_email` · `linked_at` · `active` — แพทย์ต้นทางที่พิมพ์เบอร์ผูกกับ LINE bot ไว้; ใช้หาเคสของเขาและส่งลิงก์ให้เฉพาะเจ้าของ

### `dashboard_logins`
`timestamp` · `line_user_id` · `display_name` · `group` (กลุ่มที่ใช้ยืนยันสิทธิ์) · `result` (ผ่าน/ปฏิเสธ)

### `status_log`
`timestamp` · `referral_id` · `old_status` · `new_status` · `changed_by` (system/admin/ชื่อ) · `note`

### `chemo_regimens`
`disease_group` · `abbr` (ชื่อย่อสูตร) · `components` (ตัวยา) · `active`

### `transplant_indications`
`id` (รหัสที่เก็บใน `transplant_indication`) · `type` (AUTO/ALLO) · `disease` · `disease_status` · `age` · `active`

### `advice_library` (ถอดชื่อแล้ว)
`year` · `referral_type` · `disease_group` · `age_band` · `patient_sex` · `diagnosis` · `stage` · `comorbidity` · `insurance_scheme` · `treatment_summary` · `clinical_question` · `advice_record` · `advice_regimens` · `advice_question_type` · `year_month` — **ไม่มี** รหัสเคส/ชื่อ/เบอร์/อีเมล/รพ./ไฟล์แนบ

### `stats_monthly`
`year_month` · `referral_type` · `disease_group` · `count` · `avg_turnaround_business_hours` · `incomplete_count` · `yellow_alert_count` · `red_alert_count`

### `fellow_schedule` (ไฟล์ตารางเวร)
`clinic_date` (`yyyy-MM-dd`) · `fellow_name` · `max_slots` (โควตาคิว) · `note` · `start_time` · `end_time` — ⚠️ รูปแบบวันที่ต้องเป็น ปี-เดือน-วัน ไม่งั้นการนับคิวเพี้ยน

---

## 4. Script Properties (Apps Script → Project Settings) — ความลับ ห้ามใส่ในชีต

| key | ความหมาย |
|---|---|
| `BOOKING_API_TOKEN` | token ที่เว็บใช้เรียก Apps Script (ต้องตรงกับ env เว็บ) |
| `WEB_APP_URL` | URL `/exec` ของ deployment ปัจจุบัน |
| `ATTACHMENT_FOLDER_ID` | โฟลเดอร์ Drive เก็บไฟล์แนบ |
| `SCHEDULE_SHEET_ID` | ไฟล์ตารางเวร fellow |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE OA (reply/ตรวจสมาชิกกลุ่ม) |
| `LINE_TARGET_ADMIN`, `LINE_TARGET_FELLOW`, (`LINE_TARGET_RESIDENT`) | groupId แบบเก่า — ยังใช้ได้ควบคู่กับการ `ผูกกลุ่ม` |
| `LINE_GROUPS` | กลุ่ม LINE ที่ผูกเองด้วยรหัส (ระบบเขียน ไม่ต้องแก้มือ) |
| `TELEGRAM_BOT_TOKEN` | บอท Telegram |
| `TELEGRAM_CHAT_ADMIN`, `TELEGRAM_CHAT_RESIDENT`, `TELEGRAM_CHAT_FELLOW` (`TELEGRAM_CHAT_ID` = สำรองของ admin) | chat_id 3 กลุ่ม (supergroup ขึ้นต้น `-100`) |
| `TELEGRAM_WEBHOOK_URL` | ปกติ = `<เว็บ>/api/telegram` (proxy ผ่าน Cloudflare) |
| `TELEGRAM_WEBHOOK_SECRET` | ต้องตรงกับ env เว็บ |
| `TELEGRAM_APP_LINK` | ลิงก์ Mini App `t.me/<bot>/<app>` (ปุ่ม "เปิด dashboard") |
| ตั๋ว/คำตอบค้าง `line_ticket_*`, `line_pending_reply_*` | ระบบเขียนเอง หมดอายุ 7 วัน |

## 5. Environment (Cloudflare Workers)

`GOOGLE_SERVICE_ACCOUNT_EMAIL` · `GOOGLE_PRIVATE_KEY` · `GOOGLE_SHEET_ID` ⚠️ (ไฟล์หลัก — ใส่ผิดไฟล์ = 0 เคสเงียบๆ) · `GOOGLE_SCHEDULE_SHEET_ID` · `BOOKING_API_URL` · `BOOKING_API_TOKEN` · `AUTH_SECRET` · `DASHBOARD_USERS` (`user:pass,user2:pass2`) · `LINE_LOGIN_CHANNEL_ID` · `LINE_LOGIN_CHANNEL_SECRET` · `TELEGRAM_WEBHOOK_SECRET`

---

## 6. สถานะเคส (`status`)

| สถานะ | ความหมาย | กลุ่ม | จบเคส? |
|---|---|---|---|
| `Submitted` | รับเรื่องแล้ว รอตอบ | 2/3 | |
| `Under Review` | resident กำลังดู | 2/3 | |
| `Awaiting Attending` | รออาจารย์รับรอง | 2/3 | |
| `Advice Sent` | ส่งคำตอบแล้ว (ต้องมีอาจารย์รับรอง) | 2/3 | ✔ |
| `Appointment Confirmed` | ยืนยันนัดแล้ว | 1 | ✔ |
| `Readiness Visit Scheduled` | นัดประเมินความพร้อม | 1 | ✔ |
| `Cancelled by Referrer` | แพทย์ต้นทางยกเลิก (คืนคิว) | 1 | ✔ |
| `Rejected / Redirected` | ไม่เข้าเกณฑ์/ส่งต่อทางอื่น (คืนคิว) | ทุกกลุ่ม | ✔ |
| `Auto Replied` | ตอบอัตโนมัติ (กลุ่ม 4 เดิม) | 4 | ✔ |
| `Closed` | ปิดเคส | ทุกกลุ่ม | ✔ |

สถานะที่ "จบเคส" จะไม่นับใน เคสค้าง / SLA / เตือน

## 7. รหัสกลุ่มงาน (`referral_type`)

| รหัส | กลุ่ม | ข้อความในฟอร์ม |
|---|---|---|
| `TRANSPLANT_APPOINTMENT` | 1 | (จองผ่านเว็บ ไม่ผ่านฟอร์ม) |
| `REGIMEN_CONSULT` | 2 | "กลุ่มที่ 2 — ขอความเห็นสูตรยาเคมีบำบัด …" |
| `CHEMO_ADMISSION` | 3 | "กลุ่มที่ 3 — ขอส่งตัวมาให้ยาเคมีบำบัด/ยากดภูมิ" |
| `GENERAL_OPD` | 4 | (เลิกใช้) |

ระบบยึด **"กลุ่มที่ N"** ที่นำหน้าตัวเลือก — แก้ข้อความหลังขีดได้ แต่ห้ามเปลี่ยนเลข

## 8. ค่าคงที่ที่ควรรู้

| ค่า | ที่ตั้ง | ความหมาย |
|---|---|---|
| SLA เหลือง 16 ชม.ทำการ / แดง 24 ชม.ทำการ | `Config.gs` `ESCALATION` | 2 / 3 วันทำการ (08:30-16:30 จ-ศ ไม่รวมวันหยุด) |
| รอบสรุป 10:00 | `BATCH_HOUR` | digest Telegram 3 กลุ่ม + เตือน SLA |
| เก็บเคส 12 เดือน | `RETENTION_MONTHS` | แล้วถอดชื่อย้ายไป advice_library |
| ตั๋วติดต่อแอดมิน 7 วัน | `LINE_TICKET_TTL_DAYS` | `#ABCD` ตอบได้ภายใน 7 วัน |
| ตรวจซ้ำ 30 วัน | `DUPLICATE_WINDOW_DAYS` | `possible_duplicate_of` |
| token 32 ตัว | `MANAGE_TOKEN_LENGTH` | ลิงก์ทุกชนิดที่ไม่ต้อง login |

## 9. Trigger อัตโนมัติ (Apps Script)

| ฟังก์ชัน | เมื่อไร |
|---|---|
| `onFormSubmit` | ทุกครั้งที่ส่งฟอร์ม |
| `recalculateSla` | ทุก 1 ชั่วโมง |
| `sendDailyBatch` | 10:00 ทุกวัน (digest resident/fellow/admin) |
| `sendRedAlert` | 10:00 ทุกวัน (เคสแดง) |
| `sendFellowDailyBatch` | 10:00 (รวมอยู่ใน sendDailyBatch แล้ว) |
| `anonymizeExpired` | วันที่ 1 ของเดือน 02:00 |
| `buildMonthlyStats` | วันที่ 1 ของเดือน 03:00 |
| `sweepOldAttachments` | วันที่ 1 ของเดือน 04:00 |
