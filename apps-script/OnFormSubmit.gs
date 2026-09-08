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
    // กู้หัวคอลัมน์ก่อนอ่านอะไรทั้งสิ้น — Google Forms อาจเพิ่งเขียนทับหัว
    // กลับเป็นภาษาไทย (เช่นหลังแก้ฟอร์ม) ซึ่งทำให้อ่านคอลัมน์ตามชื่อไม่เจอ
    restoreFormHeadersQuiet_();

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
    // อ่านป้ายตัวเลือกจากคอลัมน์ referral_type หรือคอลัมน์คำถามฟอร์ม "ต้องการติดต่อ…"
    // (Google Forms ชอบเปลี่ยนหัวคอลัมน์กลับเป็นข้อความคำถามเมื่อแก้ฟอร์ม — 8 ก.ย. 2569
    // ทำให้ referral_type ว่างทั้งคอลัมน์และ dashboard ขึ้น 0 เคส)
    const typeLabel = formLabelFor_(sheet, map, row);
    // เทียบแบบ normalize — ทนอักขระล่องหน/ขีดต่างชนิดที่ติดมากับฟอร์ม
    // (ดูเหตุผลที่ normalizeFormLabel_ ใน Config.gs)
    const referralType = typeFromFormLabel_(typeLabel);

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

    // 4.1 มอบหมายเคสกลุ่ม 2/3 ให้ resident ที่อยู่เวรวันนี้อัตโนมัติ
    // (ตามชีต resident_schedule — แก้ทีหลังได้จาก dropdown บน dashboard)
    //
    // อยู่เวรพร้อมกันหลายคน (เช่น แยกวอร์ดชาย/หญิง): วนแจกตามลำดับแถว
    // ในตารางเวร (มติผู้ใช้ 4 ก.ย. 2569) — ดูว่าเคสกลุ่ม 2/3 ล่าสุดถูกมอบ
    // ให้ใครในทีมเวรชุดนี้ แล้วมอบเคสใหม่ให้คนถัดไป ครบแล้ววนกลับคนแรก
    // ไม่ต้องเก็บตัวนับที่ไหน อ่านจากประวัติในชีตเอง จึงไม่มีวันเพี้ยน
    if (referralType === TYPES.regimen || referralType === TYPES.admission) {
      const duty = onDutyResidents_(submittedAt);
      if (duty.length === 1) {
        setCell_(sheet, map, row, 'assigned_to', duty[0].name);
      } else if (duty.length > 1) {
        const names = duty.map(function (d) { return d.name; });
        let lastHolder = '';
        readRows_(sheet).forEach(function (r) {
          const holder = String(r['assigned_to'] || '').trim();
          if (r._row !== row && names.indexOf(holder) !== -1) {
            lastHolder = holder; // แถวล่างสุดที่เจอ = เคสล่าสุด
          }
        });
        const next = names.indexOf(lastHolder) === -1
          ? 0
          : (names.indexOf(lastHolder) + 1) % names.length;
        setCell_(sheet, map, row, 'assigned_to', names[next]);
      }
    }
    setCell_(sheet, map, row, 'elapsed_business_hours', 0);
    setCell_(sheet, map, row, 'alert_level', 'none');
    logStatusChange_(referralId, '', initialStatus, 'system', 'สร้างจากแบบฟอร์ม');

    // แจ้งกลุ่ม resident ทันทีสำหรับเคสกลุ่ม 2/3 ใหม่ (real-time, มีปุ่มอ่าน)
    if (referralType === TYPES.regimen || referralType === TYPES.admission) {
      notifyResidentNewCase_(
        referralId,
        GROUP_NUMBER[referralType] || '-',
        String(readCell_(sheet, map, row, 'assigned_to') || ''),
        (readCell_(sheet, map, row, 'patient_sex') || '-') + ' อายุ ' +
          (readCell_(sheet, map, row, 'patient_age') || '-') + ' ปี',
        String(readCell_(sheet, map, row, 'diagnosis') || '-'),
        String(readCell_(sheet, map, row, 'referrer_org') || '-'));
    }

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
    // token สำหรับหน้าคุยต่อเนื่อง /case/[token] — ออกตั้งแต่สร้างเคส
    // แพทย์ต้นทางจะได้คุยกับทีมได้ทันทีตั้งแต่วันแรก
    const caseToken = generateManageToken_();
    ensureColumns_(sheet, CASE_THREAD_COLUMNS);
    setCell_(sheet, headerMap_(sheet), row, 'case_token', caseToken);

    if (email) {
      sendReferralIdEmail_(email, referralId, referralType, verifyToken, caseToken);
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
function sendReferralIdEmail_(email, referralId, referralType, verifyToken, caseToken) {
  const groupNo = GROUP_NUMBER[referralType] || '-';

  const body =
    'ได้รับข้อมูลการส่งต่อผู้ป่วยเรียบร้อยแล้ว\n\n' +
    'รหัสอ้างอิง (Referral ID): ' + referralId + '\n' +
    'กลุ่มที่: ' + groupNo + '\n\n' +
    'กรุณาเก็บรหัสนี้ไว้ หากต้องการส่งข้อมูลเพิ่มเติมหรือสอบถามความคืบหน้า\n' +
    'ให้แจ้งรหัสนี้กับเจ้าหน้าที่\n\n' +
    buildCaseThreadBlock_(caseToken) +
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

/** บล็อกลิงก์หน้าคุยต่อเนื่อง — แพทย์ต้นทางกดเข้าไปถาม-ตอบกับทีมได้ทันที */
function buildCaseThreadBlock_(caseToken) {
  if (!caseToken) return '';
  // แนวใหม่ (8 ก.ย. 2569): ห้องเคสมีไว้ "แนบเอกสาร + ดูคำตอบ" ไม่ใช่ถาม-ตอบทั่วไป
  // ชี้ให้ชัดว่าแนบไฟล์ได้ทันทีหลังกรอกฟอร์ม โดยไม่ต้อง login
  return '--- 📎 แนบเอกสารประกอบเคส / ดูคำตอบ ---\n' +
    SITE_URL + '/case/' + caseToken + '\n' +
    'แนบผล lab, ใบ refer, รูปถ่าย (PDF/รูป/Word) ได้ทันทีที่ลิงก์นี้ — ไม่ต้อง login\n' +
    'คำตอบจากทีมจะแสดงที่ลิงก์เดียวกันนี้\n\n';
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

/**
 * หัวคอลัมน์คำถามฟอร์ม "ต้องการติดต่อเรื่องอะไร" — Google Forms ตั้งชื่อหัวคอลัมน์
 * ตามข้อความคำถาม และจะ "รีเซ็ต" กลับเป็นชื่อนี้ทุกครั้งที่แก้ฟอร์ม/เชื่อมชีตใหม่
 * จึงห้ามพึ่งชื่อ referral_type อย่างเดียว
 */
function formLabelHeader_(map) {
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    // normalize ก่อนเทียบ — หัวคอลัมน์จากฟอร์มมีอักขระล่องหน (zero-width) ปนได้
    if (/^ต้องการติดต่อ/.test(normalizeFormLabel_(keys[i]))) return keys[i];
  }
  return '';
}

/** พิมพ์ว่า Apps Script ผูกกับไฟล์ไหน/แท็บไหน/หัวคอลัมน์อะไร — ไว้เทียบกับ banner บนเว็บ */
function whichSheetAmIReading() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(SHEETS.referrals);
  const id = ss.getId();
  Logger.log('ไฟล์ที่ Apps Script อ่าน: …' + id.slice(-8) + '  (' + ss.getName() + ')');
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('แท็บ: "' + sheet.getName() + '" · แถวข้อมูล ' + (sheet.getLastRow() - 1));
  Logger.log('หัวคอลัมน์ทั้งหมด: ' + Object.keys(headerMap_(sheet)).join(' | '));
  Logger.log('เทียบ 8 ตัวท้ายของ ID กับ "ไฟล์ที่เว็บอ่าน" ใน banner แดงบน dashboard — ' +
    'ถ้าไม่ตรง = GOOGLE_SHEET_ID บน Cloudflare ชี้คนละไฟล์');
}

/** ป้ายตัวเลือกกลุ่มของแถวนี้ — จาก referral_type ก่อน ไม่มีค่อยไปคอลัมน์คำถามฟอร์ม */
function formLabelFor_(sheet, map, rowNumber) {
  let label = ('referral_type' in map)
    ? String(readCell_(sheet, map, rowNumber, 'referral_type') || '').trim()
    : '';
  if (label) return label;
  const h = formLabelHeader_(map);
  return h ? String(readCell_(sheet, map, rowNumber, h) || '').trim() : '';
}

/**
 * เติม referral_type ให้แถวที่ว่าง (หลังหัวคอลัมน์ถูกรีเซ็ต 8 ก.ย. 2569)
 *   previewBackfillReferralTypes()  → ดูก่อนว่าจะเติมอะไร (ไม่เขียน)
 *   applyBackfillReferralTypes()    → เขียนจริง
 * กลุ่ม 2/3 แปลงจากป้ายตัวเลือก · กลุ่ม 1 อนุมานจาก manage_token/fellow_assigned
 * แถวที่ตีความไม่ได้จะถูกข้ามและบอกใน log ให้แก้มือ
 */
function backfillReferralTypes_(dryRun) {
  const sheet = getSheet_(SHEETS.referrals);
  ensureColumns_(sheet, ['referral_type']);
  const map = headerMap_(sheet);
  const rows = readRows_(sheet);
  const labelKey = formLabelHeader_(map);
  Logger.log('คอลัมน์ป้ายฟอร์มที่ใช้: "' + (labelKey || '(ไม่พบ)') + '" · แถวทั้งหมด ' + rows.length);

  let filled = 0, skipped = 0, already = 0;
  rows.forEach(function (r) {
    if (String(r['referral_type'] || '').trim()) { already++; return; }
    const label = labelKey ? String(r[labelKey] || '').trim() : '';
    let code = typeFromFormLabel_(label);
    if (!code && (String(r['manage_token'] || '').trim() ||
                  String(r['fellow_assigned'] || '').trim())) {
      code = TYPES.transplant;
    }
    if (!code) {
      skipped++;
      Logger.log('⏭️ ' + r['referral_id'] + ' — ป้าย "' + label + '" ตีความไม่ได้ ข้าม (แก้มือในชีต)');
      return;
    }
    if (!dryRun) setCell_(sheet, map, r._row, 'referral_type', code);
    filled++;
    Logger.log((dryRun ? '👀 ' : '✅ ') + r['referral_id'] + ' — "' +
      (label || '(ไม่มีป้าย → อนุมานกลุ่ม 1)') + '" → ' + code);
  });
  Logger.log('สรุป: มีค่าอยู่แล้ว ' + already + ' · ' +
    (dryRun ? 'จะเติม ' : 'เติมแล้ว ') + filled + ' · ข้าม ' + skipped +
    (dryRun ? '   ← นี่คือ preview ยังไม่เขียน — รัน applyBackfillReferralTypes() เพื่อเขียนจริง' : ''));
}
function previewBackfillReferralTypes() { backfillReferralTypes_(true); }
function applyBackfillReferralTypes() { backfillReferralTypes_(false); }

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
