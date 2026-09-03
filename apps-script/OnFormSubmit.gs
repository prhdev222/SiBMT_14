/**
 * ทำงานทุกครั้งที่มีการส่ง Google Form
 *
 * หน้าที่:
 *  1. สร้าง referral_id
 *  2. บันทึกเวลาที่ติ๊กช่องรับทราบ (หลักฐานหลักตาม PDPA-002)
 *  3. แปลงข้อความตัวเลือกกลุ่ม → ค่า referral_type
 *  4. ตั้งสถานะเริ่มต้น (กลุ่ม 4 ตอบกลับอัตโนมัติทันที)
 *  5. ตรวจเคสที่อาจซ้ำภายใน 30 วัน (FR-014)
 *
 * ตั้ง trigger แบบ "From spreadsheet → On form submit" ผ่าน setupTriggers()
 */

/**
 * คอลัมน์ที่ระบบสร้างเอง ไม่ได้มาจากฟอร์ม
 * รวมคอลัมน์กลางที่รวมค่าจากคำถามซ้ำหลายกลุ่ม (ดู MERGED_COLUMNS ใน Config.gs)
 */
const SYSTEM_COLUMNS = [
  'referral_id',
  'consent_acknowledged_at',
  'status',
  ...Object.keys(MERGED_COLUMNS),
  'assigned_to',
  'elapsed_business_hours',
  'alert_level',
  'yellow_alert_sent_at',
  'red_alert_sent_at',
  // ประทับเวลาที่แจ้ง fellow แล้ว — กันแจ้งซ้ำและกันตกหล่นเมื่อรอบใดรอบหนึ่งล้ม
  // ใช้แนวเดียวกับ yellow/red_alert_sent_at ที่มีอยู่แล้ว
  'fellow_notified_at',
  'possible_duplicate_of',
  'advice_record',
  'incomplete_reason',
  'appointment_date',
  'appointment_note',
  'fellow_assigned',
  'closed_at',
  // token ยืนยันอีเมล + เวลาที่ยืนยันแล้ว + ธงว่าอีเมลสองช่องไม่ตรงกัน (Task 5)
  // ดูคำอธิบายเต็มที่ EMAIL_VERIFY_COLUMNS ใน Config.gs
  ...EMAIL_VERIFY_COLUMNS,
];

function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  // รอได้ถึง 30 วินาที กันกรณีส่งฟอร์มพร้อมกันแล้ว referral_id ชนกัน
  lock.waitLock(30000);
  try {
    const sheet = getSheet_(SHEETS.referrals);
    const map = ensureColumns_(sheet, SYSTEM_COLUMNS);
    const row = e && e.range ? e.range.getRow() : sheet.getLastRow();

    // เรียกด้วยมือตอนชีตยังไม่มีข้อมูลจะได้ row = 1 ซึ่งคือแถวหัวตาราง
    // แล้วโค้ดจะไล่เขียนทับชื่อคอลัมน์ทั้งแถว ทำให้ทั้งระบบหาคอลัมน์ไม่เจอ
    // (ชีตที่เป็น Google Sheets Table บล็อกให้เอง แต่ชีตธรรมดาไม่บล็อก)
    if (row < 2) {
      throw new Error(
        'ไม่มีแถวข้อมูลให้ประมวลผล — ชีต ' + SHEETS.referrals + ' มีแต่หัวตาราง\n' +
        'ถ้าต้องการทดสอบ ให้ส่งฟอร์มเข้ามาก่อน แล้ว trigger จะทำงานเอง'
      );
    }

    const submittedAt = toDate_(sheet.getRange(row, 1).getValue()) || new Date();

    // 1. referral_id
    const referralId = generateReferralId_(sheet, map, submittedAt);
    setCell_(sheet, map, row, 'referral_id', referralId);

    // 2. หลักฐานการรับทราบ — ใช้ timestamp เดียวกับตอนส่งฟอร์ม
    setCell_(sheet, map, row, 'consent_acknowledged_at', submittedAt);

    // 3. referral_type — แปลงข้อความตัวเลือกในฟอร์มเป็นค่าที่ระบบใช้
    const typeLabel = String(readCell_(sheet, map, row, 'referral_type') || '').trim();
    const referralType = TYPE_FROM_FORM_LABEL[typeLabel];

    if (!referralType) {
      // ข้อความตัวเลือกในฟอร์มถูกแก้จนไม่ตรงกับ TYPE_FROM_FORM_LABEL แล้ว
      // ถ้าปล่อยผ่าน เคสนี้จะไม่ขึ้นบน dashboard เลยเพราะแปลงค่าไม่ได้
      // จึงต้องส่งเสียงดังทันที ไม่ใช่เก็บค่าดิบไว้เงียบ ๆ
      const msg =
        'แปลง referral_type ไม่สำเร็จ — ข้อความตัวเลือกในฟอร์มไม่ตรงกับที่ระบบรู้จัก\n' +
        'ได้รับ: "' + typeLabel + '"\n' +
        'ที่รู้จัก: ' + Object.keys(TYPE_FROM_FORM_LABEL).join(' | ') + '\n' +
        'แก้โดยปรับข้อความตัวเลือกในฟอร์มให้ตรงกับเดิม หรือแก้ TYPE_FROM_FORM_LABEL ใน Config.gs ' +
        'แล้วสร้างลิงก์ prefilled ใหม่ทั้ง 4 กลุ่ม';

      console.error(msg);
      setCell_(sheet, map, row, 'incomplete_reason', '⚠️ ' + msg.split('\n')[0]);
      notifyConfigProblem_(msg);
    }

    setCell_(sheet, map, row, 'referral_type', referralType || typeLabel);

    // 3.1 รวมคำถามที่ถามซ้ำหลายกลุ่มลงคอลัมน์กลาง
    mergeGroupColumns_(sheet, map, row);

    // 4. สถานะเริ่มต้น
    const initialStatus = referralType === TYPES.general ? 'Auto Replied' : 'Submitted';
    setCell_(sheet, map, row, 'status', initialStatus);
    setCell_(sheet, map, row, 'elapsed_business_hours', 0);
    setCell_(sheet, map, row, 'alert_level', 'none');
    logStatusChange_(referralId, '', initialStatus, 'system', 'สร้างจากแบบฟอร์ม');

    // 5. ตรวจเคสซ้ำ
    const duplicateOf = findPossibleDuplicate_(sheet, row, referralId, submittedAt);
    if (duplicateOf) {
      setCell_(sheet, map, row, 'possible_duplicate_of', duplicateOf);
    }

    const email = String(readCell_(sheet, map, row, 'referrer_email') || '').trim();

    // 6. ตรวจว่าอีเมลกับ "ยืนยันอีเมล (พิมพ์ซ้ำ)" (ถ้าฟอร์มมีคำถามนี้) ตรงกันไหม (Task 5)
    //
    // ไม่มีคอลัมน์ referrer_email_confirm เลย = ฟอร์มรุ่นนั้นยังไม่มีคำถามนี้
    // ให้ข้ามการตรวจไปเงียบ ๆ ไม่ใช่ถือว่าไม่ตรง — ไม่งั้นทุกเคสจากฟอร์มเก่าจะ
    // ติดธง mismatch ทั้งที่ไม่เคยถูกถามคำถามนี้เลย
    if ('referrer_email_confirm' in map) {
      const confirm = String(readCell_(sheet, map, row, 'referrer_email_confirm') || '')
        .trim().toLowerCase();
      if (confirm && email && confirm !== email.toLowerCase()) {
        setCell_(sheet, map, row, 'email_mismatch', 'yes');
      }
    }

    // 7. token ยืนยันอีเมล — สุ่ม 32 ตัวอักษร ท่าเดียวกับ answer_token/manage_token
    // (ดู generateManageToken_ ใน ManageBooking.gs) ผูกกับลิงก์ "ยืนยันอีเมลของ
    // ท่าน" ในอีเมลรหัสอ้างอิงด้านล่าง เทียบกันตอนกดลิงก์ที่ confirmEmail
    // action ใน Api.gs
    const verifyToken = generateManageToken_();
    setCell_(sheet, map, row, 'email_verify_token', verifyToken);

    // 8. ส่ง Referral ID กลับให้แพทย์ผู้ส่ง พร้อมลิงก์ยืนยันอีเมล
    //
    // ช่องอีเมลถูกตั้งเป็นบังคับในฟอร์มแล้ว แต่ยังเช็คตรงนี้อยู่ เพราะเคสเก่า
    // ที่ส่งมาก่อนเปลี่ยนฟอร์ม และการแก้ฟอร์มผิดพลาด ทำให้ค่าว่างได้อยู่ดี
    // เขียน log ไว้แทนการเงียบ — เดิมเคสที่ไม่มีอีเมลจะไม่ได้รับรหัสอ้างอิงเลย
    // แล้วไม่มีใครรู้จนกว่าแพทย์จะโทรมาถาม
    if (email) {
      sendReferralIdEmail_(email, referralId, referralType, verifyToken);
    } else {
      console.warn(
        'เคส ' + referralId + ' ไม่มีอีเมลผู้ส่ง — ไม่ได้ส่งรหัสอ้างอิงกลับ ' +
        'แพทย์ต้นทางจะไม่รู้รหัสและเช็คสถานะเองไม่ได้ ต้องติดต่อกลับทางโทรศัพท์'
      );
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * ส่งรหัสอ้างอิงกลับให้แพทย์ผู้ส่งทางอีเมล
 *
 * จำเป็นเพราะ Confirmation message ของ Google Form เป็นข้อความคงที่
 * ใส่ Referral ID ไม่ได้ (รหัสสร้างหลังฟอร์มถูกส่งไปแล้ว)
 * แพทย์จึงต้องมีช่องทางรู้รหัสของตัวเอง สำหรับใช้อ้างอิงตอนส่งข้อมูลเพิ่ม
 *
 * อีเมลนี้ **ไม่มีข้อมูลผู้ป่วยใด ๆ** มีเพียงรหัสและกลุ่มงาน
 *
 * @param {string} verifyToken token ยืนยันอีเมล (ดู EMAIL_VERIFY_COLUMNS ใน
 *   Config.gs) — ใส่ลิงก์ "ยืนยันอีเมลของท่าน" ก็ต่อเมื่อมีค่า เผื่อกรณีสร้าง
 *   token ไม่สำเร็จ จะได้ไม่ส่งอีเมลที่มีลิงก์พังออกไป
 */
function sendReferralIdEmail_(email, referralId, referralType, verifyToken) {
  const groupNo = GROUP_NUMBER[referralType] || '-';

  const body =
    'ได้รับข้อมูลการส่งต่อผู้ป่วยเรียบร้อยแล้ว\n\n' +
    'รหัสอ้างอิง (Referral ID): ' + referralId + '\n' +
    'กลุ่มที่: ' + groupNo + '\n\n' +
    'กรุณาเก็บรหัสนี้ไว้ หากต้องการส่งข้อมูลเพิ่มเติมหรือสอบถามความคืบหน้า\n' +
    'ให้แจ้งรหัสนี้กับเจ้าหน้าที่\n\n' +
    buildVerifyEmailBlock_(referralId, verifyToken) +
    'ทีมงานจะรับเรื่องในรอบประจำวันเวลา 10:00 น. ของวันทำการ\n' +
    'และตอบกลับภายใน 3 วันทำการ\n\n' +
    buildLineLinkInvite_() +
    'สอบถามเพิ่มเติม: ทัก LINE ' + LINE_OA_ID + ' แล้วกดปุ่ม "ติดต่อเจ้าหน้าที่"\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ';

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'รหัสอ้างอิงการส่งต่อผู้ป่วย ' + referralId,
      body: body,
    });
  } catch (err) {
    // ส่งอีเมลไม่สำเร็จต้องไม่ทำให้การรับเคสล้มเหลว
    console.error('ส่งอีเมลรหัสอ้างอิงไม่สำเร็จ (' + referralId + '): ' + err);
  }
}

/**
 * บล็อกลิงก์ "ยืนยันอีเมลของท่าน" แนบไปกับอีเมลรหัสอ้างอิง (Task 5)
 *
 * ไม่มี token ก็ไม่ขึ้นบล็อกนี้เลย — ดีกว่าส่งอีเมลที่มีลิงก์พัง กดแล้วขึ้น error
 * โดยไม่มีใครรู้ว่าทำไม
 */
function buildVerifyEmailBlock_(referralId, token) {
  if (!token) return '';
  return '--- ยืนยันอีเมลของท่าน ---\n' +
    buildVerifyEmailUrl_(referralId, token) + '\n' +
    '(ยืนยันว่าอีเมลนี้เป็นของท่านจริง ใช้เวลาไม่ถึงนาที)\n\n';
}

/** ลิงก์ยืนยันอีเมล — ใช้ SITE_URL เดียวกับลิงก์อื่นทั้งหมดในระบบ (ดู Config.gs) */
function buildVerifyEmailUrl_(referralId, token) {
  return SITE_URL + '/verify-email?id=' + encodeURIComponent(referralId) +
    '&t=' + encodeURIComponent(token);
}

function readCell_(sheet, map, row, columnName) {
  if (!(columnName in map)) return '';
  return sheet.getRange(row, map[columnName] + 1).getValue();
}

/**
 * รวมค่าจากคอลัมน์ที่ Google Form แตกไว้รายกลุ่ม ลงคอลัมน์กลาง
 *
 * เช่น diagnosis_g1 / diagnosis_g2 / diagnosis_g3 / diagnosis_g4 → diagnosis
 * หนึ่งเคสตอบได้กลุ่มเดียว จึงมีคอลัมน์ต้นทางเดียวที่มีค่า ที่เหลือว่าง
 */
function mergeGroupColumns_(sheet, map, row) {
  Object.keys(MERGED_COLUMNS).forEach(function (target) {
    if (!(target in map)) return;

    const sources = MERGED_COLUMNS[target];
    let value = '';
    for (let i = 0; i < sources.length; i++) {
      const raw = String(readCell_(sheet, map, row, sources[i]) || '').trim();
      if (raw) { value = raw; break; }
    }
    setCell_(sheet, map, row, target, value);
  });
}

/**
 * รูปแบบ HEM-YYYYMMDD-NNNN โดย NNNN เริ่มใหม่ทุกวัน
 * นับจากรหัสที่มีอยู่จริงในชีต ไม่ใช้ตัวนับแยก เพื่อให้ทนต่อการรีเซ็ต property
 */
function generateReferralId_(sheet, map, submittedAt) {
  const datePart = Utilities.formatDate(submittedAt, TIMEZONE, 'yyyyMMdd');
  const prefix = 'HEM-' + datePart + '-';

  let maxSeq = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2 && 'referral_id' in map) {
    const ids = sheet.getRange(2, map['referral_id'] + 1, lastRow - 1, 1).getValues();
    ids.forEach(function (r) {
      const id = String(r[0] || '');
      if (id.indexOf(prefix) === 0) {
        const seq = parseInt(id.substring(prefix.length), 10);
        if (isFinite(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
  }

  const next = String(maxSeq + 1);
  return prefix + '0000'.substring(next.length) + next;
}

/**
 * ตรวจเคสที่อาจซ้ำ (FR-014)
 *
 * ระบบไม่เก็บชื่อและ HN จึงเทียบด้วยสัญญาณที่ไม่ระบุตัวตน:
 *  - สัญญาณหลัก: เบอร์แพทย์ผู้ส่งเดียวกัน + อายุเท่ากัน + เพศเดียวกัน
 *  - สัญญาณรอง: โรงพยาบาลเดียวกัน + อายุ + เพศ + กลุ่มโรคเดียวกัน
 *
 * คืนค่าเป็น referral_id ที่สงสัย หรือ '' ถ้าไม่พบ
 * ผลลัพธ์ใช้เพื่อ "ให้เจ้าหน้าที่ตรวจสอบ" เท่านั้น ห้ามรวมเคสอัตโนมัติ
 */
function findPossibleDuplicate_(sheet, currentRow, currentId, submittedAt) {
  const rows = readRows_(sheet);
  const current = rows.filter(function (r) { return r._row === currentRow; })[0];
  if (!current) return '';

  const cutoff = new Date(submittedAt.getTime() - DUPLICATE_WINDOW_DAYS * 86400000);
  const age = String(current['patient_age'] || '').trim();
  const sex = String(current['patient_sex'] || '').trim();
  const phone = phoneKey_(current['referrer_phone']);
  const org = String(current['referrer_org'] || '').trim();
  const group = String(current['disease_group'] || '').trim();

  if (!age || !sex) return '';

  for (let i = rows.length - 1; i >= 0; i--) {
    const other = rows[i];
    if (other._row === currentRow) continue;
    if (String(other['referral_id'] || '') === currentId) continue;

    const otherAt = toDate_(other['submitted_at'] || other['Timestamp']);
    if (!otherAt || otherAt < cutoff) continue;

    const sameAge = String(other['patient_age'] || '').trim() === age;
    const sameSex = String(other['patient_sex'] || '').trim() === sex;
    if (!sameAge || !sameSex) continue;

    const samePhone = phone && phoneKey_(other['referrer_phone']) === phone;
    const sameOrgGroup =
      org &&
      String(other['referrer_org'] || '').trim() === org &&
      group &&
      String(other['disease_group'] || '').trim() === group;

    if (samePhone || sameOrgGroup) {
      return String(other['referral_id'] || '');
    }
  }
  return '';
}

function normalizePhone_(value) {
  return String(value || '').replace(/\D/g, '');
}
