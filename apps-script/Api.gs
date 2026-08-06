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

    if (!isAuthorized_(body.token)) {
      return jsonResponse_({ ok: false, error: 'token ไม่ถูกต้อง' });
    }

    if (body.action === 'bookTransplantSlot') {
      return jsonResponse_({ ok: true, data: bookTransplantSlot_(body.payload || {}) });
    }

    return jsonResponse_({ ok: false, error: 'ไม่รู้จักคำสั่ง: ' + body.action });
  } catch (err) {
    console.error('doPost error: ' + err);
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/**
 * เทียบ token แบบไม่ให้เวลาที่ใช้เทียบบอกใบ้ว่าถูกกี่ตัว (timing-safe)
 */
function isAuthorized_(token) {
  const expected = PropertiesService.getScriptProperties()
    .getProperty('BOOKING_API_TOKEN');

  if (!expected) {
    console.error('ยังไม่ได้ตั้ง BOOKING_API_TOKEN ใน Script Properties');
    return false;
  }
  const given = String(token || '');
  if (given.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * จองคิว fellow ให้เคสกลุ่มที่ 1 — สร้างแถวใหม่ในชีต referrals พร้อมวันนัด
 *
 * ⚠️ ทำไมต้องผ่าน Apps Script ไม่ให้เว็บเขียนเอง
 * สองอย่าง — หนึ่ง ชีต referrals อยู่ในไฟล์ข้อมูลผู้ป่วยซึ่งเว็บมีสิทธิ์อ่านอย่างเดียว
 * สอง และสำคัญกว่า คือ LockService ที่นี่ทำให้ "ตรวจว่าคิวยังว่าง" กับ "เขียนแถว"
 * เกิดในจังหวะเดียวกัน สองคนกดจองคิวสุดท้ายพร้อมกันจึงไม่ได้ทั้งคู่
 * Sheets API เปล่า ๆ ทำแบบนี้ไม่ได้ จะเกิดการจองเกินโควตาเงียบ ๆ
 */
function bookTransplantSlot_(payload) {
  const lock = LockService.getScriptLock();
  // รอได้ถึง 30 วินาที — คนกดจองยอมรอได้ ดีกว่าได้คิวที่เกินโควตา
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังมีผู้จองพร้อมกัน กรุณาลองใหม่อีกครั้ง');
  }

  try {
    const clinicDate = String(payload.clinicDate || '').trim();
    const fellowName = String(payload.fellowName || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(clinicDate)) {
      throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
    }
    if (!fellowName) throw new Error('ไม่ได้ระบุชื่อ fellow');

    const remaining = remainingSlots_(clinicDate, fellowName);
    if (remaining <= 0) {
      throw new Error(
        'คิวของ ' + fellowName + ' วันที่ ' + clinicDate + ' เต็มแล้ว ' +
        'กรุณาเลือกวันอื่นหรือแพทย์ท่านอื่น'
      );
    }

    const sheet = getSheet_(SHEETS.referrals);
    const map = headerMap_(sheet);
    const now = new Date();
    const referralId = generateReferralId_(sheet, map, now);

    const values = {
      referral_id: referralId,
      referral_type: TYPES.transplant,
      status: 'Appointment Confirmed',
      submitted_at: now,
      consent_acknowledged_at: now,
      appointment_date: clinicDate,
      fellow_assigned: fellowName,
      referrer_org: String(payload.referrerOrg || '').trim(),
      referrer_name: String(payload.referrerName || '').trim(),
      referrer_phone: String(payload.referrerPhone || '').trim(),
      referrer_email: String(payload.referrerEmail || '').trim(),
      disease_group: String(payload.diseaseGroup || '').trim(),
      diagnosis: String(payload.diagnosis || '').trim(),
      patient_age: String(payload.patientAge || '').trim(),
      patient_sex: String(payload.patientSex || '').trim(),
      urgency: 'Routine',
      note: String(payload.note || '').trim(),
    };

    const width = sheet.getLastColumn();
    const row = new Array(width).fill('');
    Object.keys(values).forEach(function (column) {
      if (column in map) row[map[column]] = values[column];
    });

    sheet.appendRow(row);

    return {
      referralId: referralId,
      clinicDate: clinicDate,
      fellowName: fellowName,
      remainingAfter: remaining - 1,
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * คิวที่เหลือของ fellow ท่านนั้นในวันนั้น
 *
 * โควตามาจากไฟล์ตารางเวรซึ่งอยู่คนละไฟล์ จึงต้องเปิดด้วย ID
 * ส่วนจำนวนที่นัดไปแล้วนับจากชีต referrals ในไฟล์นี้
 */
function remainingSlots_(clinicDate, fellowName) {
  const scheduleId = PropertiesService.getScriptProperties()
    .getProperty('SCHEDULE_SHEET_ID');
  if (!scheduleId) {
    throw new Error('ยังไม่ได้ตั้ง SCHEDULE_SHEET_ID ใน Script Properties');
  }

  const scheduleSheet = SpreadsheetApp.openById(scheduleId)
    .getSheetByName('fellow_schedule');
  if (!scheduleSheet) throw new Error('ไม่พบแท็บ fellow_schedule ในไฟล์ตารางเวร');

  let quota = 0;
  readRows_(scheduleSheet).forEach(function (r) {
    const d = r['clinic_date'];
    const iso = d instanceof Date
      ? Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd')
      : String(d || '').trim();
    if (iso === clinicDate && String(r['fellow_name'] || '').trim() === fellowName) {
      quota += Number(r['max_slots']) || FELLOW_DEFAULT_SLOTS;
    }
  });

  if (quota === 0) return 0; // ไม่มีคลินิกวันนั้น

  let booked = 0;
  readRows_(getSheet_(SHEETS.referrals)).forEach(function (r) {
    if (String(r['status'] || '').trim() === 'Rejected / Redirected') return;
    const d = r['appointment_date'];
    const iso = d instanceof Date
      ? Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd')
      : String(d || '').trim();
    if (iso === clinicDate && String(r['fellow_assigned'] || '').trim() === fellowName) {
      booked++;
    }
  });

  return quota - booked;
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
