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
 */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

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
