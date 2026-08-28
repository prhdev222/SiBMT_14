/**
 * ให้แพทย์ต้นทางยกเลิกและเลื่อนนัดของกลุ่มที่ 1 ได้เอง
 *
 * ## ทำไมไม่ให้โทรมาที่ OPD 700
 *
 * เจ้าหน้าที่ธุรการมองไม่เห็นว่า fellow แต่ละคนเหลือคิวกี่คนในวันไหน
 * ข้อมูลนั้นเกิดจากการเอาตารางออกตรวจ (ไฟล์ B) มาหักลบกับเคสที่จองไปแล้ว
 * (ไฟล์ A) ซึ่งไม่มีใครคำนวณในหัวได้ถูกต้อง การให้โทรมายกเลิกจึงแปลว่า
 * เจ้าหน้าที่ต้องเดา แล้วคิวที่คืนมาก็จะไม่ปรากฏในปฏิทินของแพทย์โรงพยาบาลอื่น
 *
 * พอให้แพทย์ทำเอง สถานะเปลี่ยนที่ชีตทันที และหน้าจองคิวเป็น force-dynamic
 * คนถัดไปที่เปิดปฏิทินจึงเห็นคิวที่ว่างคืนมาโดยไม่ต้องมีใครไปกดอะไรเพิ่ม
 *
 * ## การพิสูจน์ว่าเป็นเจ้าของนัด — รับสองทาง
 *
 * รหัสอ้างอิงเดาได้ (HEM-วันที่-ลำดับ ไล่จาก 0001) ถ้าใช้แค่รหัสในการยกเลิก
 * ใครก็ยกเลิกนัดของคนอื่นได้ด้วยการไล่เดา ต่างจากการเช็คสถานะที่เดาถูกแล้ว
 * ได้แค่ข้อมูลไร้ประโยชน์ — การยกเลิกทำลายของจริงและกู้คืนเองไม่ได้
 *
 *   1. `token` จากลิงก์ในอีเมลยืนยันนัด — สุ่ม 32 ตัวอักษร เดาไม่ได้
 *   2. `phone` เบอร์ที่กรอกไว้ตอนจอง — สำหรับคนที่หาอีเมลไม่เจอ
 *
 * ทางที่สองอ่อนกว่าโดยธรรมชาติ แต่ผู้เดาต้องรู้ทั้งรหัสอ้างอิงและเบอร์ของ
 * แพทย์คนนั้นพร้อมกัน และเว็บจำกัดจำนวนครั้งที่ยิงเข้ามาได้อยู่แล้ว
 */

/** ความยาว token ที่แนบไปกับลิงก์จัดการนัด */
const MANAGE_TOKEN_LENGTH = 32;

/**
 * ตัวอักษรที่ใช้สร้าง token — ไม่มี `+` `/` `=` และไม่มีตัวที่อ่านสับสน
 *
 * token นี้ต้องเดินทางผ่าน query string ในอีเมล ซึ่งโปรแกรมอ่านอีเมลบางตัว
 * ตัดหรือ escape อักขระพิเศษ ทำให้ลิงก์ที่กดแล้วใช้ไม่ได้โดยไม่มีใครรู้สาเหตุ
 */
const MANAGE_TOKEN_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateManageToken_() {
  let out = '';
  for (let i = 0; i < MANAGE_TOKEN_LENGTH; i++) {
    out += MANAGE_TOKEN_ALPHABET.charAt(
      Math.floor(Math.random() * MANAGE_TOKEN_ALPHABET.length)
    );
  }
  return out;
}

/** ลิงก์จัดการนัดที่แนบไปในอีเมล */
function buildManageUrl_(referralId, token) {
  return SITE_URL + '/booking?id=' + encodeURIComponent(referralId) +
    '&t=' + encodeURIComponent(token);
}

/* ------------------------------------------------------------------ */
/* การค้นและการพิสูจน์สิทธิ์                                            */
/* ------------------------------------------------------------------ */

/**
 * หาแถวของเคสจากรหัสอ้างอิง — คืน null ถ้าไม่พบ
 *
 * หาด้วย referral_id ไม่ใช่เลขแถว เพราะเลขแถวเลื่อนได้เมื่อมีคนแทรกหรือลบแถว
 * ในชีต แล้วการยกเลิกจะไปตกที่เคสของผู้ป่วยคนอื่น
 */
function findBookingRow_(referralId) {
  const sheet = getSheet_(SHEETS.referrals);
  const clean = String(referralId || '').trim().toUpperCase();
  if (!clean) return null;

  const match = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim().toUpperCase() === clean;
  })[0];

  return match || null;
}

/**
 * เทียบสตริงแบบไม่ให้เวลาที่ใช้เทียบบอกใบ้ว่าถูกกี่ตัว
 *
 * ใช้กับ token เพราะการเทียบด้วย === จะหยุดทันทีที่เจอตัวแรกที่ต่าง
 * ผู้โจมตีวัดเวลาตอบกลับแล้วไล่เดาทีละตัวได้ ซึ่งเปลี่ยนงานจากเดา 57^32 ครั้ง
 * เหลือ 57×32 ครั้ง
 */
function timingSafeEquals_(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;

  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * ตรวจว่าผู้เรียกเป็นเจ้าของนัดจริงหรือไม่
 *
 * @param {Object} row แถวจาก findBookingRow_
 * @param {Object} payload ต้องมี token หรือ phone อย่างน้อยหนึ่งอย่าง
 * @returns {boolean}
 */
function isBookingOwner_(row, payload) {
  // เจ้าหน้าที่ที่ล็อกอินแล้วทำแทนได้ — ใช้เมื่อแพทย์ต้นทางหาอีเมลไม่เจอ
  // และจำรหัสอ้างอิงไม่ได้ ซึ่งเป็นกรณีที่หน้าสาธารณะช่วยไม่ได้เลย
  //
  // ⚠️ ค่านี้เชื่อถือได้เพราะเว็บใส่ให้ก็ต่อเมื่อ requireSession() ผ่านแล้ว
  // และคำสั่งทุกคำสั่งต้องมี BOOKING_API_TOKEN อยู่แล้ว คนนอกจึงส่งเข้ามาไม่ได้
  // (โมเดลความเชื่อถือเดียวกับ saveAdvice ที่ผู้ล็อกอินตอบเคสใดก็ได้)
  if (String(payload.staffUser || '').trim()) return true;

  const storedToken = String(row['manage_token'] || '').trim();
  const givenToken = String(payload.token || '').trim();

  if (storedToken && givenToken && timingSafeEquals_(storedToken, givenToken)) {
    return true;
  }

  // เทียบเบอร์แบบเอาเฉพาะตัวเลข — คนกรอก 081-234-5678 บ้าง 0812345678 บ้าง
  const storedPhone = normalizePhone_(row['referrer_phone']);
  const givenPhone = normalizePhone_(payload.phone);
  if (storedPhone && givenPhone && timingSafeEquals_(storedPhone, givenPhone)) {
    return true;
  }

  return false;
}

/**
 * ยกเลิกหรือเลื่อนได้ถึง "วันก่อนวันนัด" เท่านั้น
 *
 * ถึงวันนัดแล้วยกเลิกไม่ได้ เพราะคิวที่คืนมาไม่มีใครใช้ทันอยู่ดี
 * และผู้ป่วยอาจเดินทางมาถึงโรงพยาบาลแล้ว การปล่อยให้กดยกเลิกตอนนั้น
 * จะทำให้ชีตบอกว่าไม่มีนัด ทั้งที่มีคนนั่งรออยู่หน้าห้องตรวจ
 */
function canStillChange_(clinicDate, payload) {
  // เจ้าหน้าที่ข้ามกำหนดนี้ได้ — เส้นตายนี้มีไว้กันการใช้หน้าสาธารณะผิดจังหวะ
  // ไม่ใช่กฎทางคลินิก สายที่โทรมาเช้าวันนัดว่า "ผู้ป่วยมาไม่ได้แล้ว" คือกรณีที่
  // ต้องยกเลิกให้ได้มากที่สุด เพราะคิวนั้นยังพอมีคนใช้ต่อได้ในวันเดียวกัน
  if (payload && String(payload.staffUser || '').trim()) return true;

  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  return String(clinicDate || '') > today;
}

/** ข้อความเดียวกันทุกที่ที่ปฏิเสธเพราะเลยกำหนด */
function tooLateMessage_(clinicDate) {
  return 'เลยกำหนดแก้ไขแล้ว — ยกเลิกหรือเลื่อนนัดได้ถึงวันก่อนวันนัด (' +
    formatThaiDate_(clinicDate, true) + ') เท่านั้น\n' +
    'กรุณาโทรแจ้ง ' + CONTACT_PHONE + ' ในเวลาราชการ';
}

/* ------------------------------------------------------------------ */
/* คำสั่งที่เว็บเรียก                                                    */
/* ------------------------------------------------------------------ */

/**
 * ดึงรายละเอียดนัดมาแสดงบนหน้าจัดการนัด
 *
 * คืนเฉพาะสิ่งที่หน้านั้นต้องแสดง ไม่คืนทั้งแถว เพื่อไม่ให้ข้อมูลผู้ป่วย
 * หลุดออกไปเกินจำเป็นถ้าวันหลังมีคนเอาผลลัพธ์นี้ไปใช้ที่อื่น
 */
function lookupBooking_(payload) {
  const row = findBookingRow_(payload.referralId);

  // ตอบข้อความเดียวกันทั้งกรณีไม่พบเคสและกรณีพิสูจน์สิทธิ์ไม่ผ่าน
  // ถ้าแยกข้อความ ผู้เดาจะใช้มันไล่หาว่ารหัสไหนมีอยู่จริงในระบบ
  if (!row || !isBookingOwner_(row, payload)) {
    throw new Error(
      'ไม่พบนัดที่ตรงกับข้อมูลที่กรอก กรุณาตรวจรหัสอ้างอิงและเบอร์ติดต่อกลับอีกครั้ง'
    );
  }

  const clinicDate = toIsoDate_(row['appointment_date']);

  return {
    referralId: String(row['referral_id'] || '').trim(),
    status: String(row['status'] || '').trim(),
    clinicDate: clinicDate,
    fellowName: String(row['fellow_assigned'] || '').trim(),
    referrerOrg: String(row['referrer_org'] || '').trim(),
    diagnosis: String(row['diagnosis'] || '').trim(),
    canChange: canStillChange_(clinicDate, payload) &&
      String(row['status'] || '').trim() === 'Appointment Confirmed',
  };
}

/**
 * ยกเลิกนัด — คิวคืนกลับเข้าปฏิทินทันทีที่สถานะเปลี่ยน
 */
function cancelBooking_(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังมีผู้ใช้งานพร้อมกัน กรุณาลองใหม่อีกครั้ง');
  }

  let cancelled;
  try {
    const sheet = getSheet_(SHEETS.referrals);
    const map = headerMap_(sheet);
    const row = findBookingRow_(payload.referralId);

    if (!row || !isBookingOwner_(row, payload)) {
      throw new Error('ไม่พบนัดที่ตรงกับข้อมูลที่กรอก');
    }

    const status = String(row['status'] || '').trim();
    if (SLOT_RELEASING_STATUSES.indexOf(status) !== -1) {
      throw new Error('นัดนี้ถูกยกเลิกไปแล้ว');
    }
    if (status !== 'Appointment Confirmed') {
      throw new Error('นัดนี้อยู่ในสถานะ "' + status + '" จึงยกเลิกผ่านหน้านี้ไม่ได้');
    }

    const clinicDate = toIsoDate_(row['appointment_date']);
    if (!canStillChange_(clinicDate, payload)) throw new Error(tooLateMessage_(clinicDate));

    setCell_(sheet, map, row._row, 'status', 'Cancelled by Referrer');
    setCell_(sheet, map, row._row, 'closed_at', new Date());

    const actor = String(payload.staffUser || '').trim();
    logStatusChange_(
      row['referral_id'], status, 'Cancelled by Referrer',
      actor || 'referrer',
      actor
        ? 'เจ้าหน้าที่ยกเลิกให้ทางโทรศัพท์'
        : 'ยกเลิกเองผ่านหน้าจัดการนัด'
    );

    cancelled = {
      referralId: String(row['referral_id'] || '').trim(),
      clinicDate: clinicDate,
      fellowName: String(row['fellow_assigned'] || '').trim(),
      referrerOrg: String(row['referrer_org'] || '').trim(),
      referrerEmail: String(row['referrer_email'] || '').trim(),
    };
  } finally {
    lock.releaseLock();
  }

  // แจ้งออกนอกล็อกเหมือนตอนจอง — fellow ถูกแจ้งตอนมีคนจอง ก็ต้องรู้ตอนยกเลิก
  // ไม่งั้นจะเตรียมตัวรอผู้ป่วยที่ไม่มาแล้ว
  notifyFellowOfCancellation_(cancelled);
  if (cancelled.referrerEmail) {
    sendCancellationEmail_(cancelled.referrerEmail, cancelled);
  }

  return cancelled;
}

/**
 * เลื่อนนัดไปวันใหม่
 *
 * ⚠️ ทำในล็อกเดียวทั้งการคืนคิวเก่าและจับจองคิวใหม่ ไม่ใช่ "ยกเลิกแล้วค่อยจองใหม่"
 * ถ้าแยกเป็นสองขั้น แล้วมีคนแย่งคิวใหม่ไปพอดีในระหว่างนั้น แพทย์จะเสียคิวเดิม
 * ไปโดยไม่ได้คิวใหม่ กลายเป็นไม่มีนัดเลยทั้งที่ตั้งใจแค่จะเลื่อน
 *
 * เนื่องจากเป็นการแก้แถวเดิม (ไม่ได้สร้างแถวใหม่) คิวเก่าจึงว่างเองอัตโนมัติ
 * ทันทีที่ appointment_date เปลี่ยน ไม่ต้องมีขั้นตอนคืนคิวแยกต่างหาก
 */
function rescheduleBooking_(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังมีผู้ใช้งานพร้อมกัน กรุณาลองใหม่อีกครั้ง');
  }

  let result;
  try {
    const sheet = getSheet_(SHEETS.referrals);
    const map = headerMap_(sheet);
    const row = findBookingRow_(payload.referralId);

    if (!row || !isBookingOwner_(row, payload)) {
      throw new Error('ไม่พบนัดที่ตรงกับข้อมูลที่กรอก');
    }

    const status = String(row['status'] || '').trim();
    if (status !== 'Appointment Confirmed') {
      throw new Error('นัดนี้อยู่ในสถานะ "' + status + '" จึงเลื่อนผ่านหน้านี้ไม่ได้');
    }

    const oldDate = toIsoDate_(row['appointment_date']);
    const oldFellow = String(row['fellow_assigned'] || '').trim();
    if (!canStillChange_(oldDate, payload)) throw new Error(tooLateMessage_(oldDate));

    const newDate = String(payload.clinicDate || '').trim();
    const newFellow = String(payload.fellowName || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      throw new Error('รูปแบบวันที่ใหม่ไม่ถูกต้อง');
    }
    if (!newFellow) throw new Error('ไม่ได้ระบุชื่อ fellow ของวันใหม่');
    if (!canStillChange_(newDate, payload)) {
      throw new Error('เลือกวันนัดใหม่เป็นวันนี้หรือวันที่ผ่านมาแล้วไม่ได้');
    }
    if (newDate === oldDate && newFellow === oldFellow) {
      throw new Error('วันและแพทย์ที่เลือกเหมือนเดิม ไม่มีอะไรต้องเปลี่ยน');
    }

    // remainingSlots_ นับแถวนี้รวมอยู่ในคิวเก่าด้วย แต่ไม่กระทบการตรวจคิวใหม่
    // เพราะคนละวัน/คนละ fellow — ยกเว้นกรณีเปลี่ยนเฉพาะ fellow ในวันเดิม
    // ซึ่งแถวนี้ก็ยังไม่ได้นับอยู่ในโควตาของ fellow คนใหม่เช่นกัน
    if (remainingSlots_(newDate, newFellow) <= 0) {
      throw new Error(
        'คิวของ ' + newFellow + ' วันที่ ' + newDate + ' เต็มแล้ว ' +
        'กรุณาเลือกวันอื่นหรือแพทย์ท่านอื่น'
      );
    }

    setCell_(sheet, map, row._row, 'appointment_date', newDate);
    setCell_(sheet, map, row._row, 'fellow_assigned', newFellow);

    const actor = String(payload.staffUser || '').trim();
    logStatusChange_(
      row['referral_id'], status, status, actor || 'referrer',
      (actor ? 'เจ้าหน้าที่เลื่อนให้ — ' : '') +
      'เลื่อนนัดจาก ' + oldDate + ' (' + oldFellow + ') เป็น ' +
      newDate + ' (' + newFellow + ')'
    );

    result = {
      referralId: String(row['referral_id'] || '').trim(),
      clinicDate: newDate,
      fellowName: newFellow,
      previousDate: oldDate,
      previousFellow: oldFellow,
      referrerOrg: String(row['referrer_org'] || '').trim(),
      referrerEmail: String(row['referrer_email'] || '').trim(),
      patientSex: String(row['patient_sex'] || '').trim(),
      patientAge: String(row['patient_age'] || '').trim(),
      diagnosis: String(row['diagnosis'] || '').trim(),
    };
  } finally {
    lock.releaseLock();
  }

  notifyFellowOfReschedule_(result);
  if (result.referrerEmail) {
    sendRescheduleEmail_(result.referrerEmail, result);
  }

  return result;
}

/**
 * แปลงค่าจากเซลล์วันที่ให้เป็น yyyy-MM-dd เสมอ
 *
 * เซลล์เดียวกันเป็นได้ทั้ง Date และสตริง ขึ้นกับว่าใครเขียนลงไป
 * Apps Script เขียนเป็นสตริง ส่วนคนที่พิมพ์ในชีตเองจะได้ Date
 */
function toIsoDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd');
  }
  return String(value || '').trim();
}
