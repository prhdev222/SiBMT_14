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
 * ป้ายบอกเวอร์ชันของโค้ดที่ deploy อยู่จริง
 *
 * มีไว้เพราะการกด Deploy โดยไม่เลือก "New version" เป็นความผิดพลาดที่เงียบสนิท
 * — URL ยังตอบปกติทุกอย่าง แต่รันโค้ดเก่า และอาการที่เห็นคือคำสั่งใหม่หายไปเฉย ๆ
 * ที่เคยให้เปิด URL ดูข้อความ OK นั้นแยกเวอร์ชันไม่ออก เพราะ doGet มีมาก่อนแล้ว
 *
 * ⚠️ แก้ค่านี้ทุกครั้งที่แก้ไฟล์นี้ ไม่งั้นมันโกหก
 */
const API_VERSION = '2026-08-29 adviceAttachment';

/**
 * ตอบเมื่อมีคนเปิด URL นี้ในเบราว์เซอร์
 *
 * ไม่มีฟังก์ชันนี้ Apps Script จะขึ้นหน้าแดง "Script function not found: doGet"
 * ซึ่งดูเหมือน deploy พังทั้งที่ปกติดี — คนตั้งค่ามักเอา URL ไปเปิดดูก่อนเสมอ
 * จึงตอบข้อความยืนยันสั้น ๆ ให้รู้ว่ามาถูกที่แล้ว
 *
 * หน้านี้ใครก็เปิดได้ (deploy แบบ Anyone) จึงต้องไม่มีข้อมูลอะไรทั้งสิ้น
 * ไม่บอกว่าเป็นระบบอะไร ไม่แตะชีต ไม่อ่าน Script Properties
 * เลขเวอร์ชันเป็นแค่วันที่ ไม่ได้บอกว่ามีคำสั่งอะไรบ้าง
 */
function doGet() {
  return ContentService.createTextOutput(
    'OK — endpoint นี้รับเฉพาะคำสั่งแบบ POST\n' +
      'เห็นข้อความนี้แปลว่า deploy สำเร็จและ URL ถูกต้องแล้ว\n' +
      'version: ' +
      API_VERSION,
  ).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // LINE ส่ง webhook มาในรูป { destination: "...", events: [...] } และไม่มี token
    // ต่างจากคำสั่งของ dashboard ที่มี action กับ token เสมอ
    //
    // ตัวจัดการอยู่ใน LineWebhook.gs — doPost รู้แค่ว่าต้องส่งต่อให้ใคร
    if (body.events && body.destination) {
      return handleLineWebhook_(body);
    }

    if (!isAuthorized_(body.token)) {
      return jsonResponse_({ ok: false, error: 'token ไม่ถูกต้อง' });
    }

    if (body.action === 'bookTransplantSlot') {
      return jsonResponse_({ ok: true, data: bookTransplantSlot_(body.payload || {}) });
    }

    if (body.action === 'saveAdvice') {
      return jsonResponse_({ ok: true, data: saveAdvice_(body.payload || {}) });
    }

    // จัดการนัดของกลุ่มที่ 1 โดยแพทย์ต้นทางเอง — ตัวจัดการอยู่ใน ManageBooking.gs
    if (body.action === 'lookupBooking') {
      return jsonResponse_({ ok: true, data: lookupBooking_(body.payload || {}) });
    }

    if (body.action === 'cancelBooking') {
      return jsonResponse_({ ok: true, data: cancelBooking_(body.payload || {}) });
    }

    if (body.action === 'rescheduleBooking') {
      return jsonResponse_({ ok: true, data: rescheduleBooking_(body.payload || {}) });
    }

    // ติดเวอร์ชันไปกับข้อความ error ด้วย เพราะสาเหตุที่พบเกือบทุกครั้งของคำสั่ง
    // ที่ "หายไป" คือ deploy ค้างเวอร์ชันเก่า — บอกไปเลยว่าโค้ดตัวไหนเป็นคนตอบ
    return jsonResponse_({
      ok: false,
      error: 'ไม่รู้จักคำสั่ง: ' + body.action + ' (โค้ดที่ deploy อยู่: ' + API_VERSION + ')',
    });
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
 * คอลัมน์ที่เก็บว่าใครเป็นคนตอบและติดต่อกลับได้ที่ไหน
 *
 * แยกเป็นคอลัมน์ ไม่ต่อท้ายในเนื้อคำตอบ เพื่อให้ค้นย้อนหลังได้ว่าใครตอบเคสไหน
 * และเพื่อให้ตอน anonymize รู้ว่าต้องลบช่องไหน (เป็นข้อมูลบุคลากร ไม่ใช่ผู้ป่วย
 * แต่ก็ไม่ควรติดไปกับคลังคำตอบที่เก็บถาวร)
 */
const ADVICE_CONTACT_COLUMNS = [
  'advice_record', 'status', 'closed_at',
  'advice_by', 'advice_ward_phone', 'advice_direct_phone',
  'advice_file_name', 'advice_file_url',
];

/**
 * จองคิว fellow ให้เคสกลุ่มที่ 1 — สร้างแถวใหม่ในชีต referrals พร้อมวันนัด
 *
 * ⚠️ ทำไมต้องผ่าน Apps Script ไม่ให้เว็บเขียนเอง
 * สองอย่าง — หนึ่ง ชีต referrals อยู่ในไฟล์ข้อมูลผู้ป่วยซึ่งเว็บมีสิทธิ์อ่านอย่างเดียว
 * สอง และสำคัญกว่า คือ LockService ที่นี่ทำให้ "ตรวจว่าคิวยังว่าง" กับ "เขียนแถว"
 * เกิดในจังหวะเดียวกัน สองคนกดจองคิวสุดท้ายพร้อมกันจึงไม่ได้ทั้งคู่
 * Sheets API เปล่า ๆ ทำแบบนี้ไม่ได้ จะเกิดการจองเกินโควตาเงียบ ๆ
 */
const BOOKING_COLUMNS = [
  'referral_id', 'referral_type', 'status', 'consent_acknowledged_at',
  'appointment_date', 'fellow_assigned', 'referrer_org', 'referrer_name',
  'referrer_phone', 'referrer_email', 'disease_group', 'diagnosis',
  'patient_age', 'patient_sex', 'urgency', 'note', 'manage_token',
  'transplant_indication',
];

function bookTransplantSlot_(payload) {
  const lock = LockService.getScriptLock();
  // รอได้ถึง 30 วินาที — คนกดจองยอมรอได้ ดีกว่าได้คิวที่เกินโควตา
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังมีผู้จองพร้อมกัน กรุณาลองใหม่อีกครั้ง');
  }

  let booking;
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

    // สร้างคอลัมน์ที่การจองต้องใช้ให้ครบก่อน
    // ชีตนี้เกิดจาก Google Form ซึ่งสร้างคอลัมน์เฉพาะที่มีคำถามในฟอร์ม
    // พอกลุ่มที่ 1 ไม่ใช้ฟอร์มแล้ว บางคอลัมน์จึงไม่มี และการเขียนจะหายเงียบ ๆ
    ensureColumns_(sheet, BOOKING_COLUMNS);

    const map = headerMap_(sheet);
    const now = new Date();
    const referralId = generateReferralId_(sheet, map, now);

    const values = {
      referral_id: referralId,
      referral_type: TYPES.transplant,
      status: 'Appointment Confirmed',
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
      // ข้อบ่งชี้ที่แพทย์ต้นทางเลือก — เก็บเป็น id ไม่ใช่ข้อความ
      // เพื่อให้แก้ถ้อยคำในตารางเกณฑ์ได้โดยไม่ทำให้เคสเก่าอ่านไม่ออก
      transplant_indication: String(payload.transplantIndication || '').trim(),
      // ใช้พิสูจน์ว่าเป็นเจ้าของนัดตอนกดยกเลิกหรือเลื่อน (ดู ManageBooking.gs)
      manage_token: generateManageToken_(),
    };

    // ชีตที่ Google Form สร้างตั้งชื่อคอลัมน์เวลาว่า Timestamp
    // ถ้ามีคอลัมน์นั้นอยู่ให้ใช้ของเดิม อย่าสร้าง submitted_at ซ้อนขึ้นมาอีกคอลัมน์
    values[('submitted_at' in map) ? 'submitted_at' : 'Timestamp'] = now;

    const width = sheet.getLastColumn();
    const row = new Array(width).fill('');
    const missing = [];
    Object.keys(values).forEach(function (column) {
      if (column in map) row[map[column]] = values[column];
      else if (values[column] !== '') missing.push(column);
    });

    // เงียบไว้แล้วข้อมูลหายเป็นสิ่งที่หาสาเหตุยากที่สุด — บันทึกไว้เสมอ
    if (missing.length > 0) {
      console.error(
        'ชีต referrals ไม่มีคอลัมน์เหล่านี้ ข้อมูลที่จองมาจึงไม่ถูกบันทึก: ' +
        missing.join(', ')
      );
    }

    sheet.appendRow(row);

    booking = {
      referralId: referralId,
      clinicDate: clinicDate,
      fellowName: fellowName,
      remainingAfter: remaining - 1,
      manageToken: values.manage_token,
      referrerEmail: values.referrer_email,
      referrerOrg: values.referrer_org,
      patientSex: values.patient_sex,
      patientAge: values.patient_age,
      diagnosis: values.diagnosis,
      indication: values.transplant_indication,
    };
  } finally {
    lock.releaseLock();
  }

  // ── ส่วนแจ้งเตือน อยู่นอกล็อกโดยตั้งใจ ────────────────────────────
  // ส่งอีเมลกับยิง LINE ใช้เวลาระดับวินาที ถ้าทำตอนยังถือล็อกอยู่
  // คนที่กดจองคิวถัดไปจะต้องรอไปด้วยทั้งที่ไม่เกี่ยวกัน
  // ถึงตรงนี้แถวถูกเขียนลงชีตเรียบร้อยแล้ว การจองสำเร็จแน่นอน

  // ส่งใบยืนยันนัดถ้ามีอีเมล — หน้าจองเขียนไว้ว่า "ใช้ส่งใบยืนยันนัด"
  // ถ้าไม่ส่งก็เท่ากับสัญญาแล้วไม่ทำ
  if (booking.referrerEmail) {
    sendBookingConfirmationEmail_(booking.referrerEmail, booking);
  }

  notifyFellowOfBooking_(booking);

  return {
    referralId: booking.referralId,
    clinicDate: booking.clinicDate,
    fellowName: booking.fellowName,
    remainingAfter: booking.remainingAfter,
    // ส่งกลับให้หน้ายืนยันทำลิงก์จัดการนัดได้ทันที ไม่ต้องรอเปิดอีเมล
    // ผู้รับคือคนที่เพิ่งกดจองเอง จึงไม่ใช่การเปิดเผยให้ใครเพิ่ม
    manageToken: booking.manageToken,
  };
}

/**
 * บันทึกคำตอบของอาจารย์ลงเคส แล้วส่งกลับให้แพทย์ต้นทาง
 *
 * หาแถวด้วย referral_id ไม่ใช่เลขแถว — เลขแถวเลื่อนได้เมื่อมีคนแทรกหรือลบแถว
 * ในชีต แล้วคำตอบจะไปเขียนทับเคสของผู้ป่วยคนอื่น
 *
 * ปฏิเสธถ้าเคสถูกตอบไปแล้ว เพื่อไม่ให้สองคนตอบทับกันโดยไม่รู้ตัว
 */
/**
 * โฟลเดอร์เก็บไฟล์แนบ — สร้างให้เองครั้งแรก แล้วจำ id ไว้ใน Script Properties
 *
 * ถ้าโฟลเดอร์ถูกลบทิ้ง จะสร้างใหม่แทนการโยน error
 * ไฟล์เก่าที่หายไปกับโฟลเดอร์ยังตามได้จากคอลัมน์ advice_file_url ในชีต
 */
function attachmentFolder_() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('ATTACHMENT_FOLDER_ID');

  if (saved) {
    try {
      const folder = DriveApp.getFolderById(saved);
      if (!folder.isTrashed()) return folder;
    } catch (err) {
      console.warn('โฟลเดอร์ไฟล์แนบเดิมเปิดไม่ได้ จะสร้างใหม่: ' + err);
    }
  }

  const folder = DriveApp.createFolder(ATTACHMENT.folderName);
  props.setProperty('ATTACHMENT_FOLDER_ID', folder.getId());
  console.log('สร้างโฟลเดอร์ไฟล์แนบใหม่: ' + folder.getId());
  return folder;
}

/**
 * รับไฟล์เป็น base64 จากเว็บ แล้วอัปโหลดขึ้น Drive คืนชื่อกับลิงก์
 *
 * คืน null เมื่อไม่มีไฟล์แนบมาด้วย — ไม่ใช่ error เพราะแนบไฟล์เป็นตัวเลือก
 * แต่ถ้ามีไฟล์แล้วอัปโหลดไม่ผ่าน จะโยน error ให้การบันทึกทั้งก้อนล้มไปเลย
 * ดีกว่าบันทึกคำตอบสำเร็จแต่อีเมลไม่มีไฟล์ที่ resident ตั้งใจส่ง โดยไม่มีใครรู้
 */
function uploadAdviceAttachment_(payload, referralId) {
  const base64 = String(payload.fileBase64 || '');
  if (!base64) return null;

  const name = String(payload.fileName || 'attachment').trim();
  const mimeType = String(payload.fileMimeType || '').trim();

  if (ATTACHMENT.allowedMimeTypes.indexOf(mimeType) === -1) {
    throw new Error('ชนิดไฟล์นี้แนบไม่ได้: ' + (mimeType || 'ไม่ทราบชนิด'));
  }

  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > ATTACHMENT.maxBytes) {
    throw new Error(
      'ไฟล์ใหญ่เกิน ' + Math.round(ATTACHMENT.maxBytes / 1024 / 1024) + ' MB'
    );
  }

  // ใส่เลขที่อ้างอิงนำหน้า เพื่อให้เปิดโฟลเดอร์แล้วรู้ทันทีว่าไฟล์ไหนของเคสไหน
  const blob = Utilities.newBlob(bytes, mimeType, referralId + ' — ' + name);
  const file = attachmentFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return { name: name, url: file.getUrl(), id: file.getId() };
}

/** บล็อกไฟล์แนบในอีเมล — ไม่มีไฟล์ก็ไม่ขึ้นอะไรเลย */
function buildAttachmentBlock_(data) {
  if (!data.fileUrl) return '';
  return '--- ไฟล์แนบ ---\n' +
    data.fileName + '\n' +
    data.fileUrl + '\n' +
    '(ลิงก์นี้ไม่ปรากฏในการค้นหา เปิดได้เฉพาะผู้ที่มีลิงก์)\n\n';
}

function saveAdvice_(payload) {
  const referralId = String(payload.referralId || '').trim();
  const advice = String(payload.advice || '').trim();
  const status = String(payload.status || 'Advice Sent').trim();

  if (!referralId) throw new Error('ไม่ได้ระบุเลขที่อ้างอิงของเคส');
  if (!advice) throw new Error('ยังไม่ได้พิมพ์คำตอบ');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังบันทึกคำตอบอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
  }

  try {
    const sheet = getSheet_(SHEETS.referrals);
    const map = headerMap_(sheet);
    const rows = readRows_(sheet);

    const match = rows.filter(function (r) {
      return String(r['referral_id'] || '').trim() === referralId;
    })[0];

    if (!match) throw new Error('ไม่พบเคส ' + referralId + ' — กรุณาโหลดหน้าใหม่');

    const already = String(match['advice_record'] || '').trim();
    if (already && !payload.overwrite) {
      throw new Error(
        'เคสนี้มีคำตอบอยู่แล้ว — อาจมีคนตอบไปก่อนหน้า กรุณาโหลดหน้าใหม่เพื่อดูคำตอบล่าสุด'
      );
    }

    // อัปโหลดก่อนเขียนแถว — ถ้าไฟล์ขึ้นไม่ได้ ยังไม่มีอะไรถูกบันทึก
    // resident กดใหม่ได้สะอาด ๆ ไม่ติดกับดัก "เคสนี้มีคำตอบอยู่แล้ว"
    const attachment = uploadAdviceAttachment_(payload, referralId);

    // ช่องติดต่อกลับของผู้ตอบ — สร้างคอลัมน์ให้ก่อนถ้ายังไม่มี
    // ชีตนี้เกิดจาก Google Form คอลัมน์ที่โค้ดเพิ่มทีหลังจึงต้องสร้างเอง
    ensureColumns_(sheet, ADVICE_CONTACT_COLUMNS);
    const map2 = headerMap_(sheet);

    const now = new Date();
    setCell_(sheet, map2, match._row, 'advice_record', advice);
    setCell_(sheet, map2, match._row, 'status', status);
    setCell_(sheet, map2, match._row, 'advice_by',
      String(payload.answeredBy || '').trim());
    setCell_(sheet, map2, match._row, 'advice_ward_phone',
      String(payload.wardPhone || '').trim());
    setCell_(sheet, map2, match._row, 'advice_direct_phone',
      String(payload.directPhone || '').trim());
    if (attachment) {
      setCell_(sheet, map2, match._row, 'advice_file_name', attachment.name);
      setCell_(sheet, map2, match._row, 'advice_file_url', attachment.url);
    }
    if (TERMINAL_STATUSES.indexOf(status) !== -1) {
      setCell_(sheet, map2, match._row, 'closed_at', now);
    }

    // ส่งคำตอบกลับทันที ไม่ต้องรอให้ใครคัดลอกไปส่งเอง
    const email = String(match['referrer_email'] || '').trim();
    let emailed = false;
    if (email) {
      emailed = sendAdviceEmail_(email, {
        referralId: referralId,
        advice: advice,
        answeredBy: String(payload.answeredBy || '').trim(),
        wardPhone: String(payload.wardPhone || '').trim(),
        directPhone: String(payload.directPhone || '').trim(),
        question: String(match['clinical_question'] || '').trim(),
        fileName: attachment ? attachment.name : '',
        fileUrl: attachment ? attachment.url : '',
      });
    }

    return {
      referralId: referralId,
      status: status,
      emailed: emailed,
      fileUrl: attachment ? attachment.url : '',
    };
  } finally {
    lock.releaseLock();
  }
}

/** ส่งคำตอบของอาจารย์กลับให้แพทย์ต้นทาง — ส่งไม่สำเร็จต้องไม่ทำให้การบันทึกล้ม */
function sendAdviceEmail_(email, data) {
  const body =
    'ทีมโลหิตวิทยา ศิริราช ได้ตอบคำปรึกษาของท่านแล้ว\n\n' +
    'เลขที่อ้างอิง: ' + data.referralId + '\n\n' +
    (data.question ? '--- คำถามของท่าน ---\n' + data.question + '\n\n' : '') +
    '--- คำตอบ ---\n' + data.advice + '\n\n' +
    buildAttachmentBlock_(data) +
    buildAdviceContactBlock_(data) +
    'กรุณาอย่าส่งชื่อ-สกุล หรือเลข HN ของผู้ป่วยทางอีเมลนี้\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'คำตอบการปรึกษา ' + data.referralId,
      body: body,
    });
    return true;
  } catch (err) {
    console.error('ส่งคำตอบไม่สำเร็จ (' + data.referralId + '): ' + err);
    return false;
  }
}

// formatThaiDate_ ย้ายไปอยู่ที่ Util.gs แล้ว — เคยมีสองตัวในโปรเจกต์นี้
// ตัวนี้รับสตริง ISO ส่วนของ Notify.gs รับ Date ซึ่งทับกันเงียบ ๆ ใน global scope
// เดียวกัน ทำให้ฝั่งที่แพ้พังทุกครั้งที่ถูกเรียก

/**
 * ใบยืนยันนัดสำหรับกลุ่มที่ 1
 *
 * ต่างจาก sendReferralIdEmail_ ที่ใช้กับฟอร์มกลุ่ม 2 และ 3 — ฉบับนั้นบอกว่า
 * "ทีมงานจะตอบกลับภายใน 3 วันทำการ" ซึ่งไม่จริงกับกลุ่มนี้อีกแล้ว
 * เพราะได้วันนัดทันทีตั้งแต่ตอนจอง ไม่มีใครต้องตอบกลับ
 *
 * ส่งไม่สำเร็จต้องไม่ทำให้การจองล้ม — คิวถูกจองไปแล้วและใบยืนยันแสดงบนหน้าจอ
 * ตั้งแต่ตอนกดเสร็จ อีเมลเป็นสำเนาสำรองเท่านั้น
 */
function sendBookingConfirmationEmail_(email, booking) {
  const referLine = 'ส่งพบ fellow transplant ชื่อ ' + booking.fellowName + ' ที่ OPD 700';

  const body =
    'ยืนยันการนัดหมายเรียบร้อยแล้ว\n\n' +
    '  เลขที่อ้างอิง  ' + booking.referralId + '\n' +
    '  วันนัด         ' + formatThaiDate_(booking.clinicDate, true) + '\n' +
    '  เวลา           08:00 น.\n' +
    '  สถานที่        OPD 700 โรงพยาบาลศิริราช\n' +
    '  พบแพทย์        ' + booking.fellowName + ' (fellow transplant)\n\n' +
    '--- สิ่งที่ขอความร่วมมือ (สำคัญมาก) ---\n\n' +
    '1. เขียนบนหัวกระดาษใบ refer ให้ชัดเจนว่า\n\n' +
    '     "' + referLine + '"\n\n' +
    '   ข้อความนี้ช่วยให้พยาบาลคัดกรองด่านหน้าส่งผู้ป่วยถึงตัวแพทย์ได้ทันที\n' +
    '   ถ้าไม่มี ผู้ป่วยจะต้องวนหาแผนกเอง\n\n' +
    '2. แจ้งผู้ป่วยให้ทำบัตรโรงพยาบาลศิริราชให้เรียบร้อยก่อนวันนัด\n' +
    '   https://si-eservice2.mahidol.ac.th/medrecord/index.php\n\n' +
    '3. นำเอกสารตาม checklist มาให้ครบในวันนัด\n\n' +
    '--- เลื่อนหรือยกเลิกนัด ---\n\n' +
    'กดลิงก์นี้เพื่อจัดการนัดด้วยตัวเอง ไม่ต้องโทรแจ้ง\n' +
    buildManageUrl_(booking.referralId, booking.manageToken) + '\n\n' +
    'คิวที่ยกเลิกจะว่างกลับเข้าระบบทันที ให้แพทย์ท่านอื่นจองต่อได้\n' +
    'ทำได้ถึงวันก่อนวันนัดเท่านั้น\n\n' +
    'หากลิงก์ใช้ไม่ได้ เปิด ' + SITE_URL + '/booking\n' +
    'แล้วกรอกเลขที่อ้างอิงกับเบอร์ติดต่อกลับที่ให้ไว้ตอนจอง\n\n' +
    'กรุณาอย่าส่งชื่อ-สกุล หรือเลข HN ของผู้ป่วยทางอีเมลนี้\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'ยืนยันนัด ' + booking.referralId + ' — ' +
        formatThaiDate_(booking.clinicDate, true),
      body: body,
    });
  } catch (err) {
    console.error('ส่งใบยืนยันนัดไม่สำเร็จ (' + booking.referralId + '): ' + err);
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
    if (SLOT_RELEASING_STATUSES.indexOf(String(r['status'] || '').trim()) !== -1) return;
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

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * อีเมลยืนยันการยกเลิกนัด
 *
 * ส่งเสมอเมื่อมีอีเมล เพราะการยกเลิกเป็นการกระทำที่ย้อนกลับไม่ได้
 * ถ้ามีคนกดยกเลิกโดยที่เจ้าของนัดไม่ได้ตั้งใจ อีเมลฉบับนี้คือสิ่งเดียว
 * ที่ทำให้รู้ตัวว่าเกิดอะไรขึ้นและเมื่อไร
 */
function sendCancellationEmail_(email, booking) {
  const body =
    'ยกเลิกนัดเรียบร้อยแล้ว\n\n' +
    '  เลขที่อ้างอิง  ' + booking.referralId + '\n' +
    '  วันที่เคยนัด   ' + formatThaiDate_(booking.clinicDate, true) + '\n' +
    '  แพทย์          ' + booking.fellowName + '\n\n' +
    'คิวนี้ว่างกลับเข้าระบบแล้ว แพทย์ท่านอื่นจองต่อได้ทันที\n\n' +
    'หากต้องการนัดใหม่ กรุณาจองผ่าน\n' +
    SITE_URL + '/refer/transplant\n\n' +
    'หากท่านไม่ได้เป็นผู้ยกเลิกนัดนี้ กรุณาโทรแจ้ง ' + CONTACT_PHONE + '\n' +
    '(จันทร์-ศุกร์ 08:00-16:00 น.) โดยด่วน\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'ยกเลิกนัด ' + booking.referralId,
      body: body,
    });
  } catch (err) {
    console.error('ส่งอีเมลยกเลิกนัดไม่สำเร็จ (' + booking.referralId + '): ' + err);
  }
}

/**
 * อีเมลยืนยันการเลื่อนนัด — ต้องมีทั้งวันเก่าและวันใหม่
 *
 * ถ้าบอกแต่วันใหม่ คนอ่านจะไม่รู้ว่านี่คือนัดเดิมที่เลื่อน หรือเป็นนัดใหม่อีกใบ
 * แล้วอาจพาผู้ป่วยมาทั้งสองวัน
 */
function sendRescheduleEmail_(email, booking) {
  const referLine = 'ส่งพบ fellow transplant ชื่อ ' + booking.fellowName + ' ที่ OPD 700';

  const body =
    'เลื่อนนัดเรียบร้อยแล้ว\n\n' +
    '  เลขที่อ้างอิง  ' + booking.referralId + '  (เลขเดิม ไม่ได้เปลี่ยน)\n' +
    '  วันนัดเดิม     ' + formatThaiDate_(booking.previousDate, true) +
      ' (' + booking.previousFellow + ')\n' +
    '  วันนัดใหม่     ' + formatThaiDate_(booking.clinicDate, true) + '\n' +
    '  เวลา           08:00 น.\n' +
    '  สถานที่        OPD 700 โรงพยาบาลศิริราช\n' +
    '  พบแพทย์        ' + booking.fellowName + ' (fellow transplant)\n\n' +
    '⚠️ วันนัดเดิมถูกยกเลิกแล้ว กรุณาแจ้งผู้ป่วยให้ชัดเจนว่ามาวันใหม่เท่านั้น\n\n' +
    '--- เขียนบนหัวกระดาษใบ refer ---\n\n' +
    '     "' + referLine + '"\n\n' +
    '   หากเขียนชื่อแพทย์ท่านเดิมไว้แล้ว กรุณาแก้ให้ตรงกับชื่อข้างบน\n\n' +
    'เลื่อนหรือยกเลิกอีกครั้งได้ที่ลิงก์เดิมในอีเมลยืนยันนัดฉบับแรก\n' +
    'หรือเปิด ' + SITE_URL + '/booking แล้วกรอกเลขที่อ้างอิงกับเบอร์ติดต่อกลับ\n\n' +
    'กรุณาอย่าส่งชื่อ-สกุล หรือเลข HN ของผู้ป่วยทางอีเมลนี้\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'เลื่อนนัด ' + booking.referralId + ' — ' +
        formatThaiDate_(booking.clinicDate, true),
      body: body,
    });
  } catch (err) {
    console.error('ส่งอีเมลเลื่อนนัดไม่สำเร็จ (' + booking.referralId + '): ' + err);
  }
}

/**
 * บล็อก "ติดต่อกลับ" ท้ายอีเมลคำตอบ
 *
 * ⚠️ เบอร์วอร์ดมาก่อนเบอร์ส่วนตัวเสมอ และเบอร์ส่วนตัวมีก็ต่อเมื่อผู้ตอบยอมให้
 *
 * resident อยู่ที่วอร์ดเป็นส่วนใหญ่ แต่ติดเรียนได้ตลอด สายที่โทรเข้าวอร์ดจึงมี
 * พยาบาลรับเรื่องไว้ให้เสมอ ต่างจากเบอร์ส่วนตัวที่ถ้าไม่รับก็จบ
 * — เบอร์ที่ "มีคนรับแน่นอน" มีค่ากว่าเบอร์ที่ "ตรงถึงตัวแต่อาจไม่รับ"
 */
function buildAdviceContactBlock_(data) {
  let out = '--- ติดต่อกลับหากยังไม่เข้าใจ ---\n\n';

  if (data.answeredBy) out += 'ผู้ตอบ: ' + data.answeredBy + '\n';

  if (data.wardPhone) {
    out += 'วอร์ดเคมีบำบัด: ' + data.wardPhone + '\n' +
      '  (หากแพทย์ผู้ตอบติดภารกิจ พยาบาลจะรับเรื่องไว้แล้วให้ติดต่อกลับ)\n';
  }
  if (data.directPhone) {
    out += 'ติดต่อแพทย์ผู้ตอบโดยตรง: ' + data.directPhone + '\n';
  }

  out += '\nหรือโทรธุรการ ' + CONTACT_PHONE +
    ' (จันทร์-ศุกร์ 08:00-16:00 น.)\n' +
    'พร้อมแจ้งเลขที่อ้างอิงข้างต้น\n\n';

  return out;
}
