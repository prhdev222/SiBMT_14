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

    if (body.action === 'saveAdvice') {
      return jsonResponse_({ ok: true, data: saveAdvice_(body.payload || {}) });
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
const BOOKING_COLUMNS = [
  'referral_id', 'referral_type', 'status', 'consent_acknowledged_at',
  'appointment_date', 'fellow_assigned', 'referrer_org', 'referrer_name',
  'referrer_phone', 'referrer_email', 'disease_group', 'diagnosis',
  'patient_age', 'patient_sex', 'urgency', 'note',
];

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

    // ส่งใบยืนยันนัดถ้ามีอีเมล — หน้าจองเขียนไว้ว่า "ใช้ส่งใบยืนยันนัด"
    // ถ้าไม่ส่งก็เท่ากับสัญญาแล้วไม่ทำ
    const email = String(payload.referrerEmail || '').trim();
    if (email) {
      sendBookingConfirmationEmail_(email, {
        referralId: referralId,
        clinicDate: clinicDate,
        fellowName: fellowName,
      });
    }

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
 * บันทึกคำตอบของอาจารย์ลงเคส แล้วส่งกลับให้แพทย์ต้นทาง
 *
 * หาแถวด้วย referral_id ไม่ใช่เลขแถว — เลขแถวเลื่อนได้เมื่อมีคนแทรกหรือลบแถว
 * ในชีต แล้วคำตอบจะไปเขียนทับเคสของผู้ป่วยคนอื่น
 *
 * ปฏิเสธถ้าเคสถูกตอบไปแล้ว เพื่อไม่ให้สองคนตอบทับกันโดยไม่รู้ตัว
 */
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

    const now = new Date();
    setCell_(sheet, map, match._row, 'advice_record', advice);
    setCell_(sheet, map, match._row, 'status', status);
    if (TERMINAL_STATUSES.indexOf(status) !== -1) {
      setCell_(sheet, map, match._row, 'closed_at', now);
    }

    // ส่งคำตอบกลับทันที ไม่ต้องรอให้ใครคัดลอกไปส่งเอง
    const email = String(match['referrer_email'] || '').trim();
    let emailed = false;
    if (email) {
      emailed = sendAdviceEmail_(email, {
        referralId: referralId,
        advice: advice,
        question: String(match['clinical_question'] || '').trim(),
      });
    }

    return { referralId: referralId, status: status, emailed: emailed };
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
    'หากมีข้อสงสัยเพิ่มเติม กรุณาโทร ' + CONTACT_PHONE + '\n' +
    '(จันทร์-ศุกร์ 08:00-16:00 น.) พร้อมแจ้งเลขที่อ้างอิงข้างต้น\n\n' +
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

const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** "2026-08-11" → "วันอังคารที่ 11 สิงหาคม 2569" */
function formatThaiDate_(iso) {
  const parts = iso.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return 'วัน' + TH_DAYS[d.getDay()] + 'ที่ ' + parts[2] + ' ' +
    TH_MONTHS[parts[1] - 1] + ' ' + (parts[0] + 543);
}

/**
 * ใบยืนยันนัดสำหรับกลุ่มที่ 1
 *
 * ต่างจาก sendReferralIdEmail_ ที่ใช้กับฟอร์มกลุ่ม 2 และ 3 — ฉบับนั้นบอกว่า
 * "ทีมงานจะตอบกลับภายใน 48 ชั่วโมงทำการ" ซึ่งไม่จริงกับกลุ่มนี้อีกแล้ว
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
    '  วันนัด         ' + formatThaiDate_(booking.clinicDate) + '\n' +
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
    'หากต้องการเลื่อนหรือยกเลิกนัด กรุณาโทร ' + CONTACT_PHONE + '\n' +
    '(จันทร์-ศุกร์ 08:00-16:00 น.)\n\n' +
    'กรุณาอย่าส่งชื่อ-สกุล หรือเลข HN ของผู้ป่วยทางอีเมลนี้\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'ยืนยันนัด ' + booking.referralId + ' — ' +
        formatThaiDate_(booking.clinicDate),
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
