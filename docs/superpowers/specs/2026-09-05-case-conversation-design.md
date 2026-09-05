# บทสนทนาต่อเนื่องต่อเคส (Case Conversation) — Design

**Goal:** ให้แพทย์ต้นทางกับ resident/fellow (dent) คุยถาม-ตอบต่อเนื่องต่อหนึ่งเคสได้
ทั้งบน **เว็บและ LINE ทั้งสองฝั่ง** โดยทุกข้อความถูกเก็บเป็น record ตรวจย้อนได้
อีเมลเป็นสำเนาสำรอง ไม่ใช่ช่องหลัก (คนไทยมักไม่อ่านอีเมล)

**สถาปัตยกรรมที่ต่อยอด:** token 32 ตัว (แบบ answer_token), `line_links`
(LINE userId ↔ เบอร์), `findLineUserByPhone_`, `sendOneLinePush_`,
`pushLineMessage_(audience)`, `writeContactFlow_/readContactFlow_` (LINE state),
service account อ่านชีตฝั่งเว็บ + Apps Script เขียนในฐานะเจ้าของ

---

## Data model

### ชีตใหม่ `messages`
| คอลัมน์ | ความหมาย |
|---|---|
| `message_id` | uuid |
| `referral_id` | เคสที่ข้อความนี้สังกัด |
| `sender_role` | `referrer` \| `resident` \| `system` |
| `sender_name` | ชื่อแสดง (dent = ชื่อ resident/fellow, referrer = ชื่อ รพ.ต้นทาง) |
| `channel` | `web` \| `line` \| `email` |
| `text` | เนื้อความ |
| `created_at` | เวลา |

### คอลัมน์เพิ่มใน `referrals`
- `case_token` — token 32 ตัว ต่อเคส (unique) ออกตอนสร้างเคส (OnFormSubmit)
  และออกแบบ lazy: เคสเก่าที่ยังไม่มี จะสร้างเมื่อครั้งแรกที่ต้องใช้
  (`ensureCaseToken_`)

## Surfaces

1. **`/case/[token]`** (เว็บ, ไม่ต้องล็อกอิน — token = สิทธิ์เข้าถึง เหมือน `/answer`)
   แพทย์ต้นทาง: เห็นสถานะ + thread + กล่องพิมพ์ตอบ
2. **Dashboard → กล่องรายละเอียดเคส**: dent เห็น thread เดียวกัน + กล่องพิมพ์ตอบ
3. **LINE OA (ตัวต่อตัว)**: แพทย์ต้นทางพิมพ์เข้ามา → บอทรู้เคสจาก
   `line_link → เบอร์ → เคสที่เปิดอยู่` (หลายเคส → บอทให้เลือกด้วย state machine)
4. **LINE กลุ่ม fellow/resident**: dent พิมพ์ `ตอบ HEM-xxxx: <ข้อความ>` → ลง thread

## หลักการประหยัด LINE: reply-first, push ให้น้อยและรวบ

LINE **reply (replyToken) ฟรีไม่จำกัด** แต่ **push มีโควตา** จึงออกแบบให้:

- ทุก event ขาเข้า (แพทย์ต้นทางพิมพ์ใน OA / dent พิมพ์ในกลุ่ม) → ตอบด้วย
  `replyLineMessage_` (ฟรี) เสมอ — ยืนยันบันทึกแล้ว + แสดง thread ล่าสุด
- อยากเช็กความคืบหน้า = พิมพ์ถาม บอท reply ให้ (pull ฟรี) ไม่ต้องรอ push
- push (`sendOneLinePush_`/`pushLineMessage_`) ใช้เฉพาะ "เตือนอีกฝั่งว่ามี
  ข้อความใหม่" และ **รวบเป็นครั้งเดียว**: push ก็ต่อเมื่ออีกฝั่ง "อ่านทันแล้ว"
  (ไม่มี pending) เท่านั้น — พิมพ์รัว ๆ ก่อนเขามาอ่าน จะไม่ push ซ้ำ
- อีเมล (ฟรี) แนบเนื้อความเต็ม + ลิงก์เสมอ เป็นสำเนาสำรอง

### coalescing flags (คอลัมน์ใน `referrals`)
- `referrer_unread` / `dent_unread` = `yes` เมื่อมีข้อความใหม่ที่อีกฝั่งยังไม่อ่าน
- push เตือน **เฉพาะตอนเปลี่ยนจากว่าง → yes** (ข้อความแรกหลังอ่านทัน)
- ล้างเป็นว่างเมื่อฝ่ายนั้น "อ่าน/ตอบ" (เปิด `/case`, พิมพ์ตอบ, หรือ pull ใน LINE)

## Core (ใช้ร่วมทุก surface, ใน Apps Script)

- `appendMessage_(row, role, name, channel, text)` — เขียนแถวใน `messages`
- `markCaughtUp_(row, side)` — ล้าง unread flag ของฝั่งนั้น (side=referrer|dent)
- `notifyCounterparty_(row, role, text, hasReplyToken)` — แจ้งอีกฝั่งแบบรวบ:
  - ตั้ง unread flag ของอีกฝั่ง; push **เฉพาะถ้าเพิ่งเปลี่ยนเป็น yes**
  - dent ส่ง → แพทย์ต้นทาง: push `sendOneLinePush_(userId)` (ถ้ามี line_link
    และยังไม่ pending) + อีเมล (เนื้อความเต็ม + ลิงก์ `/case/[token]`) เสมอ
  - แพทย์ต้นทางส่ง → dent: push `pushLineMessage_(text, audience)` เฉพาะถ้ายังไม่
    pending · audience = `fellow` ถ้ากลุ่ม 1, ไม่งั้น `batch`
  - ฝ่ายที่เพิ่งพิมพ์เข้ามาทาง LINE จะได้ **reply (ฟรี)** ยืนยัน ไม่นับ push

## doPost actions (Api.gs)

- `postReferrerMessage` `{ caseToken, text }` → resolve เคสจาก case_token,
  role=referrer, channel=web → append + notify dent
- `postDentMessage` `{ referralId, text, senderName, staffUser }` →
  role=resident, channel=web → append + notify referrer
  (staffUser = เว็บตรวจ session แล้ว เชื่อได้ แบบเดียวกับ BookingCredentials)

## อ่าน thread (ฝั่งเว็บ ผ่าน service account)

- `loadReferralByCaseToken(token)` → เคส (สำหรับ `/case`)
- `loadMessages(referralId)` → ข้อความเรียงตามเวลา (ทั้ง `/case` และ dashboard panel)

## LINE typing (LineWebhook.gs)

- ข้อความตัวต่อตัวจากแพทย์ต้นทางที่ผูก LINE แล้ว และไม่ตรง keyword เดิม:
  - 0 เคสเปิด → ตอบว่าไม่พบเคสเปิด
  - 1 เคสเปิด → append (role=referrer, channel=line) + notify dent + ตอบรับ
  - หลายเคส → ถามว่าเคสไหน (quick reply/รายการ) ผ่าน `writeContactFlow_`
    step=`pickCaseForMessage`; ข้อความถัดไปลงเคสที่เลือก
- ในกลุ่ม fellow/resident: `ตอบ HEM-xxxx: <ข้อความ>` → append
  (role=resident, channel=line, sender_name=ชื่อผู้พิมพ์ถ้ารู้) + notify referrer

## Identity & auth

- `/case/[token]`: case_token คือสิทธิ์ (เดาไม่ได้ 32 ตัว) — ไม่โชว์ HN/ชื่อผู้ป่วย
  เกินกว่าที่เคยมี
- Dashboard: `requireSession()`
- LINE OA: `line_link` (สร้างตอน LINE Login เดิม) = การผูกตัวตน ไม่มีขั้นเพิ่ม
- LINE กลุ่ม: จำกัดเฉพาะกลุ่มที่ตั้งไว้ (เหมือน group command เดิม)

## PDPA & retention

- ข้อความอยู่ระหว่างแพทย์สองฝ่ายเรื่องเคสเดียว (auth แล้ว) — มีรายละเอียดคลินิกได้
- `messages` อยู่ใต้ retention เดียวกับเคส: เมื่อ `anonymizeExpired()` ล้างเคสหมดอายุ
  ให้ลบข้อความของเคสนั้นด้วย (เพิ่มใน Retention.gs)

## เฟสการ build

1. **ข้อมูล + เว็บ + แจ้งเตือน**: messages sheet, case_token, appendMessage_/
   notifyCounterparty_, postReferrerMessage/postDentMessage, `/case/[token]`,
   dashboard thread panel, ลิงก์ `/case` ในอีเมลยืนยันตอนส่งเคส
2. **LINE typing**: referrer OA free-text (+ state picker), dent group command,
   retention cleanup

## Out of scope (รอบนี้)

- แนบไฟล์ใน thread (เฟสถัดไป — ตอนนี้แนบลิงก์ในข้อความได้)
- read receipts / typing indicator
- แก้/ลบข้อความที่ส่งไปแล้ว
