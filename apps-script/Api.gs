/**
 * ปลายทางรับ LINE webhook
 *
 * เดิมไฟล์นี้ทำสองหน้าที่ — รับคำสั่งแก้ตารางเวรจาก dashboard และรับ webhook
 * จาก LINE ส่วนตารางเวรถูกย้ายออกไปแล้ว เพราะวัดได้ว่า Apps Script Web App
 * ใช้เวลา 1–10 วินาทีต่อคำสั่ง (cold start) เทียบกับ Sheets API ตรง ๆ ที่ราว
 * 400 มิลลิวินาที ตอนนี้เว็บเขียนไฟล์ชีตตารางเวรของตัวเองโดยตรง
 * (ดู src/lib/schedule-store.ts)
 *
 * ผลพลอยได้ด้านความปลอดภัย: URL นี้ deploy แบบ "Anyone" เพราะ LINE ต้องเรียกได้
 * พอไม่มีคำสั่งเขียนเหลืออยู่เลย ต่อให้ URL หลุด ก็ทำอะไรกับข้อมูลไม่ได้
 *
 * ── การติดตั้ง ────────────────────────────────────────────────
 * 1. Deploy → New deployment → เลือก Web app
 *      Execute as:  Me
 *      Who has access:  Anyone   (LINE ต้องเรียกได้โดยไม่ล็อกอิน)
 * 2. คัดลอก Web app URL ไปใส่ที่
 *      LINE Developers Console → Messaging API → Webhook URL
 *
 * ห้ามประกาศ doPost ตัวที่สองในไฟล์อื่น — หนึ่งโปรเจกต์มีได้ตัวเดียว
 * และ Apps Script จะเลือกใช้ตัวใดตัวหนึ่งเงียบ ๆ โดยไม่ฟ้อง error
 */

/**
 * ตอบเมื่อมีคนเปิด URL นี้ในเบราว์เซอร์
 *
 * ไม่มีฟังก์ชันนี้ Apps Script จะขึ้นหน้าแดง "Script function not found: doGet"
 * ซึ่งดูเหมือน deploy พังทั้งที่ปกติดี — คนตั้งค่ามักเอา URL ไปเปิดดูก่อนเสมอ
 * จึงตอบข้อความยืนยันสั้น ๆ ให้รู้ว่ามาถูกที่แล้ว
 *
 * หน้านี้ใครก็เปิดได้ (deploy แบบ Anyone) จึงต้องไม่มีข้อมูลอะไรทั้งสิ้น
 * ไม่บอกว่าเป็นระบบอะไร ไม่แตะชีต ไม่อ่าน Script Properties
 */
function doGet() {
  return ContentService.createTextOutput(
    'OK — endpoint นี้รับเฉพาะคำสั่งแบบ POST\n' +
      'เห็นข้อความนี้แปลว่า deploy สำเร็จและ URL ถูกต้องแล้ว',
  ).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // LINE ส่ง webhook มาในรูป { destination: "...", events: [...] } และไม่มี token
    // ต่างจากคำสั่งของ dashboard ที่มี action กับ token เสมอ
    if (body.events && body.destination) {
      return handleLineWebhook_(body);
    }

    // ไม่มีคำสั่งอื่นให้เรียกแล้ว — ตารางเวรย้ายไปให้เว็บเขียนลงชีตของตัวเองตรง ๆ
    // (ดู src/lib/schedule-store.ts) endpoint นี้จึงเหลือหน้าที่รับ LINE webhook
    // อย่างเดียว ซึ่งแปลว่า URL ที่เปิดให้ "Anyone" นี้เขียนอะไรไม่ได้เลย
    return jsonResponse_({ ok: false, error: 'ไม่รองรับคำสั่งนี้แล้ว' });
  } catch (err) {
    console.error('doPost error: ' + err);
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/**
 * รับ webhook จาก LINE
 *
 * ── ใช้หา group ID สำหรับตั้ง Script Properties ────────────────────
 * Notify.gs ต้องรู้ group ID ของกลุ่มปลายทาง (LINE_TARGET_RESIDENT,
 * LINE_TARGET_ADMIN, LINE_TARGET_FELLOW) แต่ LINE ไม่มีหน้าจอไหนบอกค่านี้เลย
 * ทางเดียวที่ได้มาคือให้บอทเข้ากลุ่มแล้วอ่านจาก webhook ที่ LINE ยิงมา
 *
 * วิธีใช้
 *   1. ตั้ง Webhook URL ใน LINE Developers Console เป็น Web app URL นี้
 *      แล้วเปิด "Use webhook"
 *   2. เชิญบอทเข้ากลุ่ม แล้วพิมพ์อะไรก็ได้ในกลุ่มนั้นสักข้อความ
 *   3. กลับมาที่ Apps Script → Executions → เปิดรายการล่าสุด
 *      จะเห็นบรรทัด "LINE source: group ..." — คัดลอกไปใส่ Script Properties
 *   4. ทำครบทั้ง 3 กลุ่มแล้วปิด "Use webhook" ได้ ถ้ายังไม่ทำระบบตอบโต้
 *
 * ตอบ 200 เสมอ เพราะปุ่ม Verify ใน LINE Console จะไม่ผ่านถ้าไม่ตอบ
 * และ LINE จะหยุดส่ง webhook ให้ถ้าปลายทางล้มเหลวบ่อย ๆ
 *
 * เมื่อถึงเวลาทำระบบตอบโต้จริง ให้เขียนไฟล์ LineWebhook.gs แล้วย้ายเนื้อใน
 * มาไว้ที่นั่น โดยไม่ต้องแตะ doPost อีก
 */
function handleLineWebhook_(body) {
  (body.events || []).forEach(function (event) {
    const source = event.source || {};
    // groupId/roomId/userId มาไม่พร้อมกัน ขึ้นกับว่าเป็นแชทกลุ่ม ห้อง หรือตัวต่อตัว
    const id = source.groupId || source.roomId || source.userId || '(ไม่มี)';
    console.log(
      'LINE source: ' + (source.type || '?') + ' ' + id + ' | event: ' + event.type,
    );
  });

  return ContentService.createTextOutput('OK');
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
