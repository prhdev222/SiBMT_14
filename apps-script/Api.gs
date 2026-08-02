/**
 * ช่องทางให้ dashboard สั่งแก้ตารางออกตรวจ fellow
 *
 * ทำไมต้องผ่านทางนี้แทนที่จะให้เว็บเขียนชีตตรง ๆ:
 * service account ของเว็บมีสิทธิ์แค่ Viewer และต้องเป็นแบบนั้นต่อไป
 * เพราะสิทธิ์เขียนใน Google Sheets ให้ทั้งไฟล์ ไม่สามารถจำกัดเฉพาะบางแท็บได้
 * ถ้ายกระดับเป็น Editor เพื่อแก้ตารางเวร credential ที่หลุดจะแก้หรือลบ
 * ข้อมูลผู้ป่วยได้ด้วย
 *
 * ทางนี้ Apps Script เป็นผู้เขียนโดยใช้สิทธิ์ของเจ้าของชีตเอง และรับเฉพาะ
 * คำสั่งที่ระบุไว้ด้านล่าง — เว็บสั่งอะไรกับชีต referrals ไม่ได้เลย
 *
 * ── การติดตั้ง ────────────────────────────────────────────────
 * 1. Deploy → New deployment → เลือก Web app
 *      Execute as:  Me
 *      Who has access:  Anyone
 * 2. คัดลอก Web app URL
 * 3. Project Settings → Script Properties → เพิ่ม
 *      SCHEDULE_API_TOKEN = <สุ่มข้อความยาว ๆ มาหนึ่งชุด>
 * 4. ใส่ค่าทั้งสองลง .env.local ของเว็บ
 *      SCHEDULE_API_URL   = <Web app URL>
 *      SCHEDULE_API_TOKEN = <ค่าเดียวกับข้อ 3>
 *
 * "Anyone" ที่นี่หมายถึงใครก็ตามที่รู้ URL — token จึงเป็นตัวกั้นจริง
 * ข้อมูลที่ผ่านช่องทางนี้เป็นตารางเวรของบุคลากร ไม่มีข้อมูลผู้ป่วย
 *
 * ── ใช้ URL เดียวกันกับ LINE webhook ได้ ─────────────────────────
 * doPost ด้านล่างแยกทางให้แล้วตามรูปร่างของ payload
 * ถ้าจะทำ LINE webhook ให้เอา Web app URL เดียวกันนี้ไปใส่ที่
 * LINE Developers Console → Messaging API → Webhook URL
 * ไม่ต้อง deploy แยก และห้ามประกาศ doPost ตัวที่สองในไฟล์อื่น
 */

/**
 * ประตูเดียวของทั้งโปรเจกต์
 *
 * ⚠️ หนึ่งโปรเจกต์ Apps Script มี doPost ได้ตัวเดียวเท่านั้น
 * ถ้าวันหนึ่งเพิ่ม LINE webhook (ให้คนทักเข้ามาแล้วระบบตอบกลับ) แล้วไปประกาศ
 * doPost อีกตัวในไฟล์อื่น Apps Script จะใช้ตัวใดตัวหนึ่งเงียบ ๆ โดยไม่ฟ้อง error
 * อีกฟีเจอร์จะเสียไปแบบหาสาเหตุยากมาก
 *
 * จึงแยกทางกันที่นี่ตั้งแต่ต้น: ดูรูปร่างของ payload แล้วส่งต่อให้ถูกเจ้าของ
 * (ตอนนี้ Notify.gs ส่งข้อความออกทาง UrlFetchApp อย่างเดียว ยังไม่ต้องใช้ doPost)
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

    const result = handleAction_(body);
    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    console.error('Schedule API error: ' + err);
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

/**
 * เทียบ token แบบไม่ให้เวลาที่ใช้เทียบบอกใบ้ว่าถูกกี่ตัว
 * (timing-safe comparison)
 */
function isAuthorized_(token) {
  const expected = PropertiesService.getScriptProperties()
    .getProperty('SCHEDULE_API_TOKEN');

  if (!expected) {
    console.error('ยังไม่ได้ตั้ง SCHEDULE_API_TOKEN ใน Script Properties');
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

/** คำสั่งที่รับได้ — นอกเหนือจากนี้ปฏิเสธทั้งหมด */
function handleAction_(body) {
  switch (body.action) {
    case 'listSchedule':
      return { fellows: listFellows(), days: listClinicDays(body.yearMonth || '') };

    case 'addClinicDays':
      return addClinicDays(body.payload || {});

    case 'removeClinicDay':
      return { removed: removeClinicDayVerified_(body) };

    case 'addFellow':
      return { fellows: addFellow(body.name) };

    case 'deactivateFellow':
      return { fellows: deactivateFellow(body.name) };

    default:
      throw new Error('ไม่รู้จักคำสั่ง: ' + body.action);
  }
}

/**
 * ลบวันออกตรวจ โดยตรวจก่อนว่าแถวนั้นยังเป็นแถวที่หน้าจอเห็นตอนกด
 *
 * หน้าเว็บอ้างถึงแถวด้วยเลขแถว แต่ถ้ามีคนแทรกหรือลบแถวในชีตระหว่างนั้น
 * เลขแถวจะเลื่อน แล้วการลบตามเลขเปล่า ๆ จะไปลบเวรของคนอื่น
 * จึงเทียบวันที่กับชื่อให้ตรงก่อนเสมอ ไม่ตรงก็ปฏิเสธไปให้โหลดหน้าใหม่
 */
function removeClinicDayVerified_(body) {
  const rowNumber = Number(body.rowNumber);
  if (!rowNumber || rowNumber < 2) throw new Error('เลขแถวไม่ถูกต้อง');

  const sheet = getSheet_(SHEETS.fellowSchedule);
  if (rowNumber > sheet.getLastRow()) {
    throw new Error('ไม่พบแถวนี้แล้ว — กรุณาโหลดหน้าใหม่');
  }

  // headerMap_ คืน index แบบ 0-based แต่ getRange ใช้ 1-based
  const map = headerMap_(sheet);
  const dateCell = sheet.getRange(rowNumber, map['clinic_date'] + 1).getValue();
  const nameCell = sheet.getRange(rowNumber, map['fellow_name'] + 1).getValue();

  const iso = dateCell instanceof Date
    ? Utilities.formatDate(dateCell, TIMEZONE, 'yyyy-MM-dd')
    : String(dateCell || '').trim();

  if (iso !== String(body.clinicDate || '').trim() ||
      String(nameCell || '').trim() !== String(body.fellowName || '').trim()) {
    throw new Error('ข้อมูลในชีตเปลี่ยนไปแล้ว — กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง');
  }

  sheet.deleteRow(rowNumber);
  return true;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** สร้าง token สุ่มไว้ใช้ตั้งค่า — รันครั้งเดียวแล้วคัดลอกไปใช้ */
function generateApiToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  console.log('SCHEDULE_API_TOKEN = ' + token);
  console.log('คัดลอกไปใส่ทั้งใน Script Properties และ .env.local ของเว็บ');
  return token;
}
