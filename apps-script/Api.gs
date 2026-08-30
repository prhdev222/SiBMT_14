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
const API_VERSION = '2026-08-30 lineLogin';

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

    if (body.action === 'checkDashboardMember') {
      return jsonResponse_({ ok: true, data: checkDashboardMember_(body.payload || {}) });
    }

    if (body.action === 'contactAdmin') {
      return jsonResponse_({ ok: true, data: contactAdmin_(body.payload || {}) });
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
  'advice_attending', 'advice_approved_at',
  // สูตรยาที่เลือกจากคลัง คั่นด้วยจุลภาค — เก็บแยกจากเนื้อคำตอบเพื่อให้นับสถิติได้
  // โดยไม่ต้องแกะข้อความอิสระ ซึ่งสะกดสูตรเดียวกันได้หลายแบบ
  'advice_regimens',
  // ประเภทคำถามที่ผู้ตอบจัดให้ เก็บเป็น id ไม่ใช่ชื่อไทย — ชื่อที่แสดงเปลี่ยนได้
  // โดยไม่ทำให้ข้อมูลเก่าอ่านไม่ออก (ดู src/lib/question-types.ts)
  'advice_question_type',
  'appointment_date', 'appointment_note',
  // ลิงก์เปิดคำตอบบนเว็บ ใช้กลไกเดียวกับ manage_token ของกลุ่ม 1
  // เนื้อคำตอบจึงไม่ต้องอยู่ใน LINE ซึ่ง PDPA-003 ห้ามไว้
  'answer_token',
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

/**
 * อ่านรายละเอียดนัดตรวจ OPD จาก payload — คืน null เมื่อไม่ได้นัด
 *
 * ต้องครบทั้งสามค่าถึงจะถือว่านัดจริง กรอกมาไม่ครบให้ถือว่าไม่ได้นัด
 * ดีกว่าส่งอีเมลที่เขียนว่า "วันที่ ... เวลา ..." โดยมีช่องว่าง
 * ซึ่งแพทย์ต้นทางจะเอาไปเขียนบนใบ refer ไม่ได้
 */
function adviceVisit_(payload) {
  const date = String(payload.visitDate || '').trim();
  const time = String(payload.visitTime || '').trim();
  const doctor = String(payload.visitDoctor || '').trim();
  if (!date || !time || !doctor) return null;
  return { date: date, time: time, doctor: doctor };
}

/**
 * บล็อกนัดตรวจในอีเมล — จัดรูปแบบเดียวกับอีเมลยืนยันนัดของกลุ่ม 1
 *
 * มีบรรทัดที่ให้ "เขียนบนหัวกระดาษใบ refer" เพราะธุรการ OPD 700 คัดกรอง
 * จากหัวกระดาษ ไม่ได้เปิดอีเมลดู — ผู้ป่วยที่ถือใบเปล่ามาจะไม่มีใครรู้ว่านัดใคร
 */
function buildVisitBlock_(visit) {
  if (!visit) return '';

  const referLine = 'นัด ' + formatThaiDate_(visit.date, true) + ' เวลา ' +
    visit.time + ' น. พบ ' + visit.doctor + ' (OPD 700 อายุรศาสตร์โลหิตวิทยา)';

  return '--- นัดมาประเมินความพร้อมที่ OPD 700 ---\n\n' +
    '  วันที่    ' + formatThaiDate_(visit.date, true) + '\n' +
    '  เวลา      ' + visit.time + ' น.\n' +
    '  สถานที่   OPD 700 โรงพยาบาลศิริราช\n' +
    '  พบแพทย์   ' + visit.doctor + '\n\n' +
    '--- เขียนบนหัวกระดาษใบ refer ---\n\n' +
    '     "' + referLine + '"\n\n' +
    '   ธุรการ OPD 700 คัดกรองจากหัวกระดาษ ไม่ได้เปิดอีเมลดู\n' +
    '   ถ้าไม่เขียน ผู้ป่วยจะไม่มีใครทราบว่านัดกับแพทย์ท่านใด\n\n' +
    '   วันนัดนี้เป็นการมาประเมินความพร้อมก่อน ยังไม่ใช่วัน admit\n\n';
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
    setCell_(sheet, map2, match._row, 'advice_regimens',
      String(payload.regimens || '').trim());
    setCell_(sheet, map2, match._row, 'advice_question_type',
      String(payload.questionType || '').trim());
    if (attachment) {
      setCell_(sheet, map2, match._row, 'advice_file_name', attachment.name);
      setCell_(sheet, map2, match._row, 'advice_file_url', attachment.url);
    }
    // ชื่ออาจารย์และเวลาที่ resident รับรอง — เก็บแยกคอลัมน์เพื่อให้ค้นย้อนหลังได้
    // ว่าเคสไหนอาจารย์ท่านใดเป็นผู้ให้ความเห็น
    setCell_(sheet, map2, match._row, 'advice_attending',
      String(payload.attending || '').trim());
    setCell_(sheet, map2, match._row, 'advice_approved_at', now);

    // ลิงก์เปิดคำตอบ — ออกครั้งเดียวแล้วใช้ซ้ำได้ ไม่สร้างใหม่ทุกครั้ง
    // เพราะลิงก์เดิมที่ส่งไปแล้วต้องเปิดได้ตลอด ไม่ใช่ตายทันทีที่มีคนแก้แถว
    let answerToken = String(match['answer_token'] || '').trim();
    if (!answerToken) {
      answerToken = generateManageToken_();
      setCell_(sheet, map2, match._row, 'answer_token', answerToken);
    }

    // นัดประเมินความพร้อมที่ OPD 700 — เฉพาะกลุ่ม 3 ที่เลือกสถานะนัดตรวจ
    //
    // เขียนลง appointment_date เหมือนกลุ่ม 1 ได้อย่างปลอดภัย เพราะ countBookings()
    // ใน src/lib/fellow-schedule.ts นับเฉพาะ TRANSPLANT_APPOINTMENT
    // วันนัดของกลุ่มนี้จึงไม่ไปกินโควตาคิว fellow
    const visit = adviceVisit_(payload);
    if (visit) {
      setCell_(sheet, map2, match._row, 'appointment_date', visit.date);
      setCell_(sheet, map2, match._row, 'appointment_note',
        visit.time + ' น. พบ ' + visit.doctor + ' (OPD 700)');
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
        attending: String(payload.attending || '').trim(),
        visit: visit,
        answerUrl: SITE_URL + '/answer/' + answerToken,
      });
    }

    // เด้งเข้า LINE ให้คนที่ผูกบัญชีไว้ — ไม่ผูกก็ยังได้อีเมลตามปกติ
    notifyReferrerOnLine_(match, answerToken);

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
/**
 * ส่งคำตอบเดิมซ้ำไปที่อีเมลที่ลงทะเบียนไว้กับเคส
 *
 * ⚠️ ส่งไปที่ referrer_email ของแถวนั้นเท่านั้น ไม่รับอีเมลปลายทางจากผู้เรียก
 *
 * นี่คือสิ่งเดียวที่ทำให้การค้นด้วยเบอร์โทรอย่างเดียวปลอดภัย — ต่อให้คนอื่น
 * รู้เบอร์แล้วสั่งส่งซ้ำ คำตอบก็วิ่งไปหาเจ้าของอีเมลตัวจริง ไม่ใช่คนที่สั่ง
 * ผลที่แย่ที่สุดคือเจ้าตัวได้อีเมลซ้ำโดยไม่ได้ขอ ซึ่งเป็นความรำคาญ ไม่ใช่ข้อมูลรั่ว
 *
 * ประกอบร่างจากคอลัมน์ในชีต ไม่ได้เก็บสำเนาอีเมลฉบับเดิมไว้
 * บล็อกวันนัดจึงใช้ข้อความใน appointment_note ตามที่บันทึกไว้
 * แทนการถอดกลับเป็นวัน/เวลา/แพทย์ ซึ่งจะเดาผิดได้ถ้ารูปแบบเปลี่ยน
 */
function sendAdviceCopyEmail_(row) {
  const email = String(row['referrer_email'] || '').trim();
  const advice = String(row['advice_record'] || '').trim();
  if (!email || !advice) return false;

  const referralId = String(row['referral_id'] || '').trim();
  const appointment = String(row['appointment_note'] || '').trim();
  const clinicDate = row['appointment_date'];

  const body =
    'สำเนาคำตอบการปรึกษา (ส่งซ้ำตามที่ร้องขอทาง LINE)\n\n' +
    'เลขที่อ้างอิง: ' + referralId + '\n\n' +
    (row['clinical_question']
      ? '--- คำถามของท่าน ---\n' + row['clinical_question'] + '\n\n' : '') +
    '--- คำตอบ ---\n' + advice + '\n\n' +
    (clinicDate
      ? '--- นัดที่ OPD 700 ---\n' +
        formatThaiDate_(toDate_(clinicDate), true) + '\n' +
        (appointment ? appointment + '\n' : '') + '\n'
      : '') +
    buildAttachmentBlock_({
      fileName: row['advice_file_name'],
      fileUrl: row['advice_file_url'],
    }) +
    buildAdviceContactBlock_({
      answeredBy: row['advice_by'],
      attending: row['advice_attending'],
      wardPhone: row['advice_ward_phone'],
      directPhone: row['advice_direct_phone'],
    }) +
    'กรุณาอย่าส่งชื่อ-สกุล หรือเลข HN ของผู้ป่วยทางอีเมลนี้\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'สำเนาคำตอบการปรึกษา ' + referralId,
      body: body,
    });
    return true;
  } catch (err) {
    console.error('ส่งสำเนาคำตอบไม่สำเร็จ (' + referralId + '): ' + err);
    return false;
  }
}

function sendAdviceEmail_(email, data) {
  const body =
    'ทีมโลหิตวิทยา ศิริราช ได้ตอบคำปรึกษาของท่านแล้ว\n\n' +
    'เลขที่อ้างอิง: ' + data.referralId + '\n\n' +
    (data.question ? '--- คำถามของท่าน ---\n' + data.question + '\n\n' : '') +
    '--- คำตอบ ---\n' + data.advice + '\n\n' +
    buildVisitBlock_(data.visit) +
    buildAttachmentBlock_(data) +
    buildAdviceContactBlock_(data) +
    (data.answerUrl
      ? '--- เปิดคำตอบนี้บนเว็บ ---\n' + data.answerUrl + '\n' +
        '(ลิงก์นี้เปิดได้เฉพาะผู้ที่มีลิงก์ ส่งต่อให้ทีมดูได้)\n\n'
      : '') +
    buildLineLinkInvite_() +
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

/**
 * ส่งข้อความจากแพทย์ต้นทางถึงแพทย์แอดมินกลาง
 *
 * ⚠️ ไม่เขียนอะไรลงชีต โดยเจตนา
 *
 * นี่ไม่ใช่เคส ไม่มีเลขที่อ้างอิงของตัวเอง และไม่ควรมี — ถ้าเก็บเป็นแถว
 * มันจะกลายเป็นคิวที่สองที่ไม่มี SLA และไม่มีใครถือ ซึ่งเป็นสิ่งที่ระบบนี้
 * ตั้งใจกำจัด ช่องทางนี้มีไว้แค่ "แจ้งให้คนรู้" แล้วให้คนไปจัดการต่อ
 * คำถามทางคลินิกต้องเข้ากลุ่มที่ 2 ซึ่งมีเลขที่อ้างอิงและกรอบเวลาจริง
 *
 * ⚠️ ห้ามมีข้อมูลผู้ป่วยในข้อความ — หน้าเว็บเตือนไว้แล้ว และปลายทางคือ LINE
 * ซึ่งตาม PDPA-003 ห้ามมีข้อมูลผู้ป่วยเด็ดขาด
 */
function contactAdmin_(payload) {
  const name = String(payload.name || '').trim();
  const org = String(payload.org || '').trim();
  const contact = String(payload.contact || '').trim();
  const referralId = String(payload.referralId || '').trim();
  const message = String(payload.message || '').trim();

  if (!name || !org || !contact || !message) {
    throw new Error('กรุณากรอกชื่อ โรงพยาบาล ช่องทางติดต่อกลับ และข้อความให้ครบ');
  }

  const body =
    '📨 แพทย์ต้นทางติดต่อแอดมินกลาง\n\n' +
    'จาก: ' + name + ' (' + org + ')\n' +
    'ติดต่อกลับ: ' + contact + '\n' +
    (referralId ? 'อ้างถึงเคส: ' + referralId + '\n' : '') +
    '\n' + message.slice(0, 1500);

  // LINE ก่อน เพราะแอดมินเห็นเร็วกว่าอีเมล แต่ทั้งคู่ล้มได้โดยไม่ทำให้ทั้งคำสั่งพัง
  // ถ้าโยน error หน้าเว็บจะบอกว่าส่งไม่สำเร็จทั้งที่อาจส่งไปแล้วทางหนึ่ง
  let delivered = false;
  try {
    pushLineMessage_(body, 'red');
    delivered = true;
  } catch (err) {
    console.error('ส่ง LINE ถึงแอดมินไม่สำเร็จ: ' + err);
  }

  // แอดมินกลางมีได้หลายคน — ใส่คั่นด้วยจุลภาคในชีต แบบเดียวกับ LINE_TARGET_ADMIN
  //
  // ส่งฉบับเดียวถึงทุกคนพร้อมกัน ไม่ใช่แยกฉบับ เพื่อให้ทุกคนเห็นว่าใครได้รับด้วย
  // — จะได้ตกลงกันเองได้ว่าใครรับเรื่องนี้ ไม่ใช่ต่างคนต่างคิดว่าอีกคนทำแล้ว
  const recipients = parseEmailList_(readConfigValue_('central_admin_email'));
  if (recipients.length > 0) {
    try {
      MailApp.sendEmail({
        to: recipients.join(','),
        subject: 'ติดต่อแอดมินกลาง — ' + org,
        body: body + '\n\n--\nส่งจากหน้า "ติดต่อแพทย์แอดมินกลาง" ' + SITE_URL,
        replyTo: contact.indexOf('@') !== -1 ? contact : undefined,
      });
      delivered = true;
    } catch (err) {
      console.error('ส่งอีเมลถึงแอดมินไม่สำเร็จ: ' + err);
    }
  }

  if (!delivered) {
    throw new Error(
      'ส่งข้อความไม่สำเร็จ ยังไม่ได้ตั้งค่าช่องทางแจ้งเตือนแอดมิน ' +
      'กรุณาโทรติดต่อเจ้าหน้าที่แทน'
    );
  }

  return { delivered: true };
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
  if (data.attending) {
    out += 'อาจารย์ผู้ให้คำปรึกษา: ' + data.attending + '\n';
  }

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

/* ------------------------------------------------------------------ */
/* เข้าสู่ระบบ dashboard ด้วย LINE                                       */
/* ------------------------------------------------------------------ */

/**
 * ตรวจว่า LINE คนนี้อยู่ในกลุ่มที่มีสิทธิ์เข้า dashboard หรือไม่
 *
 * ⚠️ นี่คือประตูของ dashboard ทั้งหมด ไม่ใช่แค่การอ่านชื่อ
 *
 * เว็บพิสูจน์มาแล้วว่า lineUserId นี้เป็นเจ้าของบัญชี LINE จริง (ผ่าน OAuth)
 * แต่คนทั้งโลกที่มี LINE ก็ผ่านขั้นนั้นได้ ฟังก์ชันนี้ต่างหากที่ตอบว่า
 * "แล้วคนนี้เป็นคนของหน่วยงานไหม" โดยถือว่าการอยู่ในกลุ่มงานคือคำตอบ
 *
 * ⚠️ ตรวจทุกครั้งที่ล็อกอิน ไม่ได้จำไว้
 * เอาใครออกจากกลุ่ม LINE แล้วครั้งถัดไปที่เขากดเข้าจะไม่ผ่าน
 * — session ที่ถืออยู่แล้วยังใช้ได้จนหมดอายุ (8 ชม. ดู src/lib/auth.ts)
 *
 * ⚠️ ตรวจไม่ได้ = ไม่ให้ผ่าน ไม่ใช่ปล่อยผ่าน
 * ถ้าเรียก LINE ไม่สำเร็จหรือยังไม่ได้ตั้งรายชื่อกลุ่ม จะตอบว่าไม่มีสิทธิ์
 * ระบบที่ปล่อยผ่านตอนตรวจไม่ได้ จะเปิดประตูทิ้งไว้ทุกครั้งที่ LINE ล่ม
 */
function checkDashboardMember_(payload) {
  const userId = String(payload.lineUserId || '').trim();
  const fallbackName = String(payload.displayName || '').trim();

  if (!userId) return { allowed: false, displayName: '' };

  const groups = dashboardLineGroups_();
  if (groups.length === 0) {
    console.warn(
      'ไม่พบ groupId ใน LINE_TARGET_ADMIN / LINE_TARGET_FELLOW / ' +
      'LINE_TARGET_RESIDENT — ปฏิเสธการเข้าระบบด้วย LINE ทุกราย'
    );
    return { allowed: false, displayName: fallbackName };
  }

  const token = PropertiesService.getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) {
    console.warn('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
    return { allowed: false, displayName: fallbackName };
  }

  for (let i = 0; i < groups.length; i++) {
    const profile = lineGroupMemberProfile_(token, groups[i], userId);
    if (profile) {
      logDashboardLogin_(userId, profile.displayName || fallbackName, groups[i]);
      return {
        allowed: true,
        displayName: profile.displayName || fallbackName || 'ผู้ใช้ LINE',
      };
    }
  }

  logDashboardLogin_(userId, fallbackName, 'ไม่อยู่ในกลุ่มใดเลย');
  return { allowed: false, displayName: fallbackName };
}

/**
 * อ่านโปรไฟล์ของสมาชิกในกลุ่ม — คืน null เมื่อไม่ได้เป็นสมาชิก
 *
 * ใช้ endpoint นี้แทน "รายชื่อสมาชิกทั้งกลุ่ม" เพราะตัวที่ดึงทั้งกลุ่มเปิดให้
 * เฉพาะบัญชีที่ผ่านการรับรองแล้ว ส่วนตัวนี้ทุกบัญชีเรียกได้ ขอแค่บอทอยู่ในกลุ่ม
 *
 * ⚠️ 404 แปลว่า "ไม่ได้เป็นสมาชิก" ซึ่งเป็นคำตอบปกติ ไม่ใช่ข้อผิดพลาด
 * สถานะอื่นที่ไม่ใช่ 200 ถือว่าตรวจไม่ได้ และต้องบันทึกไว้ให้เห็น
 * ไม่งั้นเวลามีคนเข้าไม่ได้จะไม่มีทางรู้ว่าเพราะไม่ได้อยู่ในกลุ่มหรือเพราะบอทหลุดออกจากกลุ่ม
 */
function lineGroupMemberProfile_(token, groupId, userId) {
  const url = 'https://api.line.me/v2/bot/group/' + encodeURIComponent(groupId) +
    '/member/' + encodeURIComponent(userId);

  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code === 200) {
    try {
      return JSON.parse(res.getContentText());
    } catch (err) {
      console.warn('อ่านโปรไฟล์สมาชิกไม่สำเร็จ: ' + err);
      return null;
    }
  }

  if (code !== 404) {
    console.warn(
      'ตรวจสมาชิกกลุ่ม ' + maskLineId_(groupId) + ' ไม่สำเร็จ (' + code + '): ' +
      res.getContentText().substring(0, 200)
    );
  }
  return null;
}

/**
 * รายชื่อกลุ่มที่มีสิทธิ์เข้า dashboard
 *
 * อ่านจาก LINE_TARGET_* ใน Script Properties ที่ตั้งไว้อยู่แล้ว ไม่ได้เก็บซ้ำ
 * ที่อื่น — groupId ชุดเดียวกันถ้าวางไว้สองที่ วันหนึ่งจะแก้ที่เดียวแล้วอีกที่
 * ค้างไว้ โดยที่ไม่มีอะไรบอกว่าสองที่ไม่ตรงกันแล้ว
 *
 * และ Script Properties เห็นได้เฉพาะคนที่เปิด Apps Script ได้ ต่างจากชีต config
 * ซึ่งใครที่แชร์ชีตด้วยก็เห็น — รายชื่อที่เป็นประตูของระบบควรอยู่ในที่ที่แคบกว่า
 *
 * ⚠️ ข้อแลกเปลี่ยนที่ต้องรู้: ค่าเหล่านี้มีหน้าที่เดิมคือ "ปลายทางแจ้งเตือน"
 * การเพิ่มกลุ่มเข้าไปเพื่อให้ได้รับแจ้งเตือน จะทำให้กลุ่มนั้นเข้า dashboard ได้ด้วย
 * testLineTargets() จึงพิมพ์จำนวนกลุ่มที่เข้า dashboard ได้ออกมาทุกครั้ง
 * เพื่อไม่ให้ผลข้างเคียงนี้เกิดขึ้นโดยไม่มีใครเห็น
 *
 * ⚠️ รับเฉพาะ id ที่ขึ้นต้นด้วย C ซึ่งคือกลุ่ม
 * ปลายทางแจ้งเตือนใส่ userId (ขึ้นต้นด้วย U) ได้ด้วย แต่ "อยู่ในกลุ่ม" คือเกณฑ์
 * ที่ตกลงกันไว้ — ถ้าปล่อยให้ userId ผ่านด้วย ก็เท่ากับมีรายชื่อบุคคลที่เข้าได้
 * ซ่อนอยู่ในค่าที่ตั้งไว้เพื่อการแจ้งเตือน ซึ่งไม่มีใครตั้งใจให้เป็นแบบนั้น
 */
function dashboardLineGroups_() {
  const props = PropertiesService.getScriptProperties();
  const seen = {};
  const groups = [];

  Object.keys(LINE_TARGET_BY_AUDIENCE).forEach(function (audience) {
    parseLineTargets_(props.getProperty(LINE_TARGET_BY_AUDIENCE[audience]))
      .forEach(function (id) {
        if (id.charAt(0) !== 'C' || seen[id]) return;
        seen[id] = true;
        groups.push(id);
      });
  });

  return groups;
}

/**
 * บันทึกทุกครั้งที่มีคนพยายามเข้า dashboard ด้วย LINE
 *
 * ⚠️ บันทึกทั้งที่ผ่านและไม่ผ่าน
 *
 * รายการที่ไม่ผ่านคือสิ่งที่บอกว่ามีคนนอกพยายามเข้า หรือมีคนของเราหลุดออกจาก
 * กลุ่มโดยไม่ตั้งใจ ถ้าเก็บแต่รายการที่สำเร็จจะไม่มีทางเห็นทั้งสองอย่าง
 *
 * เก็บ userId แบบเต็มเพราะเป็นข้อมูลบุคลากร ไม่ใช่ผู้ป่วย และจำเป็นต่อการ
 * ตรวจสอบย้อนหลังว่าใครเปิดดูข้อมูลผู้ป่วยเมื่อไร ซึ่งบัญชีรหัสผ่านที่ใช้
 * ร่วมกันในวอร์ดตอบไม่ได้เลย
 */
function logDashboardLogin_(userId, displayName, groupId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEETS.dashboardLogins);
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.dashboardLogins);
      sheet.getRange(1, 1, 1, DASHBOARD_LOGIN_COLUMNS.length)
        .setValues([DASHBOARD_LOGIN_COLUMNS]);
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date(),
      userId,
      displayName,
      groupId === 'ไม่อยู่ในกลุ่มใดเลย' ? '' : maskLineId_(groupId),
      groupId === 'ไม่อยู่ในกลุ่มใดเลย' ? 'ปฏิเสธ' : 'ผ่าน',
    ]);
  } catch (err) {
    // บันทึก log ไม่สำเร็จไม่ควรทำให้คนที่มีสิทธิ์เข้าระบบไม่ได้
    console.warn('บันทึก dashboard login ไม่สำเร็จ: ' + err);
  }
}
