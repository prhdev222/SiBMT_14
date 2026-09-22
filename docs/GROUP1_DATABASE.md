# ฐานข้อมูลการจองกลุ่ม 1

กลุ่ม 1 ใช้ตาราง `group1_bookings`, `group1_fellows` และ `group1_schedule` ในฐานข้อมูลแยกจาก Google Sheet และ Apps Script ที่เก็บเคสกลุ่ม 2–3

## ตั้งค่า Turso

```sh
turso db create sibmt-group1
turso db show sibmt-group1 --url
turso db tokens create sibmt-group1
```

ตั้งค่าใน `.env.local` หรือ Cloudflare Variables:

```env
GROUP1_DATABASE_URL=libsql://...
GROUP1_DATABASE_AUTH_TOKEN=...
```

สร้างตารางครั้งเดียว:

```sh
node scripts/setup-group1-db.mjs
```

เมื่อตั้ง `GROUP1_DATABASE_URL` แล้ว การจอง/ค้นหา/ยกเลิก/เลื่อนนัดกลุ่ม 1 ใช้ฐานข้อมูลนี้ทันที

## LINE OA สำหรับ Fellow

ระบบรองรับการถามคิวนัดผ่าน LINE OA โดยไม่ส่ง Push แจ้งเตือนเมื่อมี booking ใหม่

1. เพิ่มตารางจาก `sql/group1-bookings.sql` (มี `group1_fellow_line_accounts`)
2. ตั้งค่า `LINE_CHANNEL_SECRET` และ `LINE_CHANNEL_ACCESS_TOKEN` ใน Cloudflare Secrets
3. ตั้ง Webhook URL เป็น `/api/line/webhook` ใน LINE Developers
4. ตั้ง `GROUP1_LINE_FELLOW_CODES` รูปแบบ `ชื่อ Fellow::รหัส;ชื่ออีกคน::รหัส` หรือใช้ `GROUP1_LINE_SHARED_CODE` เป็นรหัสเดียวทุกคน (ปลอดภัยน้อยกว่า)
5. Fellow เพิ่ม OA แล้วพิมพ์ `ลงทะเบียน ชื่อ Fellow รหัสลงทะเบียน`

หลังผูกบัญชีแล้ว Fellow ถามได้ว่า `วันนี้`, `สัปดาห์นี้`, `นัดใกล้สุด` หรือ `คิววันที่ YYYY-MM-DD`
ระบบจะตอบเฉพาะนัดของ Fellow คนนั้น ไม่ส่งแจ้งเตือนออกไปเอง
ส่วนกลุ่ม 2–3 ยังอ่านและเขียนผ่านระบบเดิมเหมือนเดิม กลุ่ม 1 ไม่ต้องใช้ Google Sheet หรือ Apps Script

ภายหลังถ้าย้ายไปเซิร์ฟเวอร์เอง ให้ใช้ URL และ token ของเซิร์ฟเวอร์ที่รองรับ libSQL HTTP `/v2/pipeline` แทน โดยไม่ต้องแก้โค้ด
