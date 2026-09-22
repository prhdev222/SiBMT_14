# SiBMT Refer

ระบบเว็บสำหรับรับนัดและประสานการส่งต่อผู้ป่วยโลหิตวิทยา โรงพยาบาลศิริราช

## ขอบเขต

- หน้าสาธารณะสำหรับนัดพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด
- ช่องทาง refer เหตุผลอื่น
- Dashboard สำหรับจัดการนัด ตาราง Fellow และคิวว่าง
- เพิ่ม แก้ไข และปิดใช้งานชื่อ Fellow ได้
- กำหนดคิวต่อ Fellow ต่อวันได้ โดยค่าเริ่มต้น 2 คิว
- ผู้ส่งต่อดู เลื่อน หรือยกเลิกนัดได้
- Hemato Bot ตอบคำถามวันนัดและเกณฑ์ transplant candidate
- LINE OA สำหรับ Fellow ดูคิววันนี้ สัปดาห์นี้ และคิวใกล้สุด

## ข้อมูลและการ deploy

- ใช้ Turso/libSQL สำหรับข้อมูลการนัด ตารางออกตรวจ และรายชื่อ Fellow
- ไม่ใช้ Google Sheet หรือ Apps Script
- รองรับการย้ายไปฐานข้อมูล on-premise/S3-compatible ในอนาคต
- Deploy ด้วย Next.js และ Cloudflare Workers

## Environment หลัก

```env
GROUP1_DATABASE_URL=libsql://...
GROUP1_DATABASE_AUTH_TOKEN=...
AUTH_SECRET=...
DASHBOARD_USERS=...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
GROUP1_LINE_SHARED_CODE=...
```

ห้าม commit ค่า secret จริงขึ้น GitHub

## Development

```bash
npm install
npm run dev
```
