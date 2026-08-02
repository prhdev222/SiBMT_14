/**
 * ติดตั้งครั้งแรก — รันฟังก์ชันในไฟล์นี้จากเมนู Run ใน Apps Script Editor
 *
 * ลำดับการติดตั้ง:
 *   1. setupSheets()      สร้างชีตและคอลัมน์ที่จำเป็น
 *   2. ตั้ง Script Properties สำหรับ LINE (ดูคำอธิบายด้านล่าง)
 *   3. setupTriggers()    ตั้ง trigger ทั้งหมด
 *   4. runSelfTest()      ตรวจว่าทุกอย่างพร้อม
 */

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ชีต referrals ต้องมีอยู่แล้วจากการเชื่อม Google Form
  const referrals = ss.getSheetByName(SHEETS.referrals);
  if (!referrals) {
    throw new Error(
      'ไม่พบชีต "' + SHEETS.referrals + '"\n' +
      'ให้เชื่อม Google Form กับ Spreadsheet นี้ก่อน แล้วเปลี่ยนชื่อชีตคำตอบเป็น "' +
      SHEETS.referrals + '"'
    );
  }
  ensureColumns_(referrals, SYSTEM_COLUMNS);

  createIfMissing_(ss, SHEETS.adviceLibrary, ADVICE_LIBRARY_COLUMNS);
  createIfMissing_(ss, SHEETS.statsMonthly, STATS_COLUMNS);
  createIfMissing_(ss, SHEETS.statusLog, [
    'timestamp', 'referral_id', 'old_status', 'new_status', 'changed_by', 'note',
  ]);
  createIfMissing_(ss, SHEETS.holidays, ['holiday_date', 'description']);

  createIfMissing_(ss, SHEETS.fellows, ['fellow_name', 'active', 'note']);

  // start_time/end_time ต่อท้าย ไม่ได้แทรกกลาง เพื่อให้ชีตที่มีข้อมูลอยู่แล้ว
  // อัปเกรดได้โดยไม่ต้องเลื่อนคอลัมน์เดิม และได้หน้าตาเหมือนชีตที่สร้างใหม่
  createIfMissing_(ss, SHEETS.fellowSchedule, FELLOW_SCHEDULE_COLUMNS);
  ensureColumns_(ss.getSheetByName(SHEETS.fellowSchedule), FELLOW_SCHEDULE_COLUMNS);
  applyScheduleValidation_(ss);

  createIfMissing_(ss, SHEETS.config, ['key', 'value', 'description']);
  seedConfigKeys_(ss);

  console.log('สร้างชีตและคอลัมน์เรียบร้อย');
  console.log('ต้องกรอกเพิ่ม:');
  console.log('  • ' + SHEETS.holidays + ' — วันหยุดนักขัตฤกษ์');
  console.log('  • ' + SHEETS.fellowSchedule + ' — ตารางออกตรวจ fellow ทั้งปีการศึกษา');
  console.log('  • ' + SHEETS.config + ' — ชื่อผู้รับผิดชอบ');
}

/**
 * ตั้ง data validation ให้ชีต fellow_schedule กรอกง่ายและกันพิมพ์ผิด
 *
 * - clinic_date  → บังคับเป็นวันที่ กดแล้วมีปฏิทินให้เลือก
 * - fellow_name  → dropdown ดึงรายชื่อจากชีต fellows
 * - max_slots    → ตัวเลข 1–10
 *
 * ชื่อ fellow ต้องสะกดตรงกับคอลัมน์ fellow_assigned ในชีต referrals เป๊ะ ๆ
 * เพราะระบบจับคู่ด้วยชื่อ — dropdown จึงสำคัญกว่าความสะดวก มันกันเคสนับคิวผิด
 *
 * รันซ้ำได้ ปลอดภัย — ใช้เมื่อเพิ่มชื่อ fellow ใหม่แล้วอยากให้ dropdown อัปเดต
 */
function applyScheduleValidation_(ss) {
  const schedule = ss.getSheetByName(SHEETS.fellowSchedule);
  const fellows = ss.getSheetByName(SHEETS.fellows);
  if (!schedule || !fellows) return;

  const lastRow = Math.max(schedule.getMaxRows(), 500);
  if (schedule.getMaxRows() < lastRow) {
    schedule.insertRowsAfter(schedule.getMaxRows(), lastRow - schedule.getMaxRows());
  }

  // วันที่
  schedule.getRange(2, 1, lastRow - 1, 1)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireDate()
        .setHelpText('เลือกวันที่ออกตรวจจากปฏิทิน')
        .build()
    )
    .setNumberFormat('yyyy-mm-dd');

  // ชื่อ fellow — ดึงจากชีต fellows คอลัมน์ A
  schedule.getRange(2, 2, lastRow - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(fellows.getRange('A2:A200'), true)
      .setAllowInvalid(false)
      .setHelpText('เลือกชื่อจากรายการในชีต fellows — เพิ่มชื่อใหม่ที่ชีตนั้นก่อน')
      .build()
  );

  // จำนวนคิวต่อวัน
  schedule.getRange(2, 3, lastRow - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireNumberBetween(1, 10)
      .setHelpText('เว้นว่างได้ ระบบใช้ค่าเริ่มต้น ' + FELLOW_DEFAULT_SLOTS + ' คนต่อวัน')
      .build()
  );

  schedule.setFrozenRows(1);
}

/**
 * เรียกใช้เองหลังเพิ่มหรือลบชื่อใน ชีต fellows เพื่อให้ dropdown อัปเดต
 * (ปกติ requireValueInRange อัปเดตตามอยู่แล้ว ฟังก์ชันนี้ไว้ซ่อมกรณี validation หาย)
 */
function refreshFellowDropdown() {
  applyScheduleValidation_(SpreadsheetApp.getActiveSpreadsheet());
  console.log('อัปเดต dropdown ชื่อ fellow เรียบร้อย');
}

/**
 * ใส่ key ที่ระบบต้องใช้ลงชีต config พร้อมคำอธิบาย เว้นค่าให้ผู้ดูแลกรอกเอง
 * ไม่เขียนทับค่าที่มีอยู่แล้ว
 */
function seedConfigKeys_(ss) {
  const sheet = ss.getSheetByName(SHEETS.config);
  const existing = {};
  readRows_(sheet).forEach(function (r) {
    if (r['key']) existing[String(r['key']).trim()] = true;
  });

  const defaults = [
    ['central_admin_name', '', 'แพทย์แอดมินกลาง — ผู้รับ Red Alert เมื่อเคสค้างครบ 48 ชม.'],
    ['central_admin_contact', '', 'เบอร์หรือ LINE ID ของแพทย์แอดมินกลาง'],
    ['central_admin_backup_name', '', 'ผู้สำรองของแอดมินกลาง — ต้องมีก่อนเปิดใช้จริง'],
    ['central_admin_backup_contact', '', 'ช่องทางติดต่อผู้สำรอง'],
    ['system_owner', 'สาขาวิชาโลหิตวิทยา', 'เจ้าของระบบในนามหน่วยงาน'],
    ['template_library_owner', '', 'ผู้ดูแลคลังสูตรยาเคมีบำบัด (ใช้ทั้งกลุ่ม 2 และ 3)'],
    ['fellow_schedule_owner', '', 'ผู้กรอกตารางออกตรวจ fellow'],
    ['opd_phone', '02-419-9903', 'เบอร์ธุรการ OPD 700'],
  ];

  const toAdd = defaults.filter(function (row) { return !existing[row[0]]; });
  if (toAdd.length === 0) return;

  sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 3).setValues(toAdd);
}

/**
 * เติมคอลัมน์ที่ยังไม่มีต่อท้ายชีตที่มีข้อมูลอยู่แล้ว
 *
 * createIfMissing_ เขียนหัวตารางเฉพาะตอนชีตยังว่างเปล่า ชีตที่ใช้งานไปแล้ว
 * จึงไม่ได้คอลัมน์ใหม่ที่เพิ่มมาทีหลัง ฟังก์ชันนี้ปิดช่องว่างนั้น
 * ต่อท้ายอย่างเดียว ไม่แตะของเดิม รันซ้ำได้ปลอดภัย
 */
function ensureColumns_(sheet, headers) {
  if (!sheet || sheet.getLastRow() === 0) return;

  const lastCol = sheet.getLastColumn();
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  const missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length === 0) return;

  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  console.log('เพิ่มคอลัมน์ในชีต ' + sheet.getName() + ': ' + missing.join(', '));
}

function createIfMissing_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

/**
 * ตั้ง trigger ทั้งหมด — ลบของเดิมก่อนเพื่อไม่ให้ซ้ำเมื่อรันหลายครั้ง
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ทุกครั้งที่ส่งฟอร์ม
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();

  // คำนวณ SLA รายชั่วโมง (ตัวฟังก์ชันข้ามการทำงานเองนอกเวลาทำการ)
  ScriptApp.newTrigger('recalculateSla').timeBased().everyHours(1).create();

  // Red Alert รายชั่วโมง
  ScriptApp.newTrigger('sendRedAlert').timeBased().everyHours(1).create();

  // รอบแจ้งเตือนรวม 10:00 น. ทุกวัน (ฟังก์ชันข้ามวันหยุดเอง)
  ScriptApp.newTrigger('sendDailyBatch').timeBased().atHour(BATCH_HOUR).everyDays(1)
    .inTimezone(TIMEZONE).create();

  // ถอดชื่อและสรุปสถิติ เดือนละครั้ง วันที่ 1 ตอนตี 2
  ScriptApp.newTrigger('anonymizeExpired').timeBased().onMonthDay(1).atHour(2)
    .inTimezone(TIMEZONE).create();
  ScriptApp.newTrigger('buildMonthlyStats').timeBased().onMonthDay(1).atHour(3)
    .inTimezone(TIMEZONE).create();

  console.log('ตั้ง trigger เรียบร้อย ' + ScriptApp.getProjectTriggers().length + ' รายการ');
}

/**
 * ตั้งค่า LINE — เรียกครั้งเดียวแล้ว **ลบค่าออกจากโค้ดทันที**
 *
 * วิธีที่ปลอดภัยกว่า: ไปที่ Project Settings → Script Properties แล้วเพิ่มเอง
 *   LINE_CHANNEL_ACCESS_TOKEN  = channel access token จาก LINE Developers Console
 *   LINE_TARGET_RESIDENT       = group ID ของกลุ่มแพทย์ประจำบ้าน
 *   LINE_TARGET_ADMIN          = user ID หรือ group ID ของแพทย์แอดมินกลาง
 *   LINE_TARGET_FELLOW         = group ID ของ fellow transplant
 *
 * ห้าม commit ค่าเหล่านี้ลง repo เด็ดขาด (SRS NFR-003)
 */
function showLineConfigStatus() {
  const props = PropertiesService.getScriptProperties();
  const keys = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_TARGET_RESIDENT',
    'LINE_TARGET_ADMIN',
    'LINE_TARGET_FELLOW',
  ];
  keys.forEach(function (k) {
    console.log(k + ': ' + (props.getProperty(k) ? 'ตั้งค่าแล้ว' : '— ยังไม่ได้ตั้งค่า —'));
  });
}

/**
 * ตรวจความพร้อมของระบบ รันได้ทุกเมื่อ ไม่แก้ไขข้อมูล
 */
function runSelfTest() {
  const problems = [];

  // ชีตครบไหม
  Object.keys(SHEETS).forEach(function (key) {
    const name = SHEETS[key];
    if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)) {
      problems.push('ไม่พบชีต: ' + name);
    }
  });

  // คอลัมน์ระบบครบไหม
  const referrals = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.referrals);
  if (referrals) {
    const map = headerMap_(referrals);

    SYSTEM_COLUMNS.forEach(function (c) {
      if (!(c in map)) problems.push('ไม่พบคอลัมน์ระบบ: ' + c);
    });

    // คอลัมน์จากฟอร์ม — จับกรณี Google เขียนหัวคอลัมน์ทับด้วยข้อความคำถามภาษาไทย
    const missingFormCols = FORM_COLUMNS_REQUIRED.filter(function (c) {
      return !(c in map);
    });
    if (missingFormCols.length > 0) {
      problems.push(
        'ไม่พบคอลัมน์จากฟอร์ม: ' + missingFormCols.join(', ') +
        ' — หัวคอลัมน์อาจถูกเขียนทับด้วยข้อความคำถาม ให้เปลี่ยนชื่อกลับตาม docs/SETUP_GUIDE.md ขั้นที่ 4'
      );
    }

    // ต้องไม่มีคอลัมน์ที่ระบุตัวตนเด็ดขาด
    const forbidden = ['patient_name', 'hn', 'siriraj_hn', 'national_id',
                       'ชื่อผู้ป่วย', 'ชื่อ-สกุลผู้ป่วย', 'HN', 'เลขบัตรประชาชน'];
    forbidden.forEach(function (c) {
      if (c in map) problems.push('⚠️ พบคอลัมน์ที่ห้ามมี: ' + c);
    });

    // referral_type ของทุกแถวต้องแปลงเป็นค่าอังกฤษได้
    // ถ้าเจอข้อความไทยค้างอยู่ แปลว่าตัวเลือกในฟอร์มถูกแก้จนไม่ตรงกับ Config.gs
    // เคสเหล่านั้นจะไม่ขึ้นบน dashboard เลย
    const validTypes = Object.keys(GROUP_NUMBER);
    const badTypes = {};
    readRows_(referrals).forEach(function (r) {
      const t = String(r['referral_type'] || '').trim();
      if (t && validTypes.indexOf(t) === -1) badTypes[t] = (badTypes[t] || 0) + 1;
    });
    Object.keys(badTypes).forEach(function (t) {
      problems.push(
        '⚠️ พบ referral_type ที่แปลงค่าไม่ได้ ' + badTypes[t] + ' เคส: "' + t + '" — ' +
        'เคสเหล่านี้จะไม่แสดงบน dashboard ให้ตรวจว่าข้อความตัวเลือกในฟอร์ม ' +
        'ยังตรงกับ TYPE_FROM_FORM_LABEL ใน Config.gs หรือไม่'
      );
    });

    // เตือนถ้ายังมีหัวคอลัมน์ภาษาไทยหลงเหลือ (แปลว่ายังเปลี่ยนชื่อไม่ครบ)
    const thaiHeaders = Object.keys(map).filter(function (h) {
      return /[฀-๿]/.test(h);
    });
    if (thaiHeaders.length > 0) {
      problems.push(
        'ยังมีหัวคอลัมน์เป็นภาษาไทย ' + thaiHeaders.length + ' คอลัมน์: ' +
        thaiHeaders.slice(0, 5).join(', ') + (thaiHeaders.length > 5 ? ' …' : '') +
        ' — ต้องเปลี่ยนเป็นชื่อ field ภาษาอังกฤษ'
      );
    }
  }

  // วันหยุดกรอกครบไหม — ถ้าไม่กรอก ระบบจะนับวันหยุดเป็นวันทำการ
  const holidays = loadHolidays_();
  const holidayKeys = Object.keys(holidays);
  const thisYear = new Date().getFullYear();
  const thisYearCount = holidayKeys.filter(function (k) {
    return k.indexOf(String(thisYear)) === 0;
  }).length;

  if (holidayKeys.length === 0) {
    problems.push(
      '⚠️ ชีต "' + SHEETS.holidays + '" ยังว่าง — ระบบจะนับวันหยุดนักขัตฤกษ์เป็นวันทำการ ' +
      'ทำให้แจ้งเตือนเคสค้างเร็วเกินจริง กรุณากรอกวันหยุดของโรงพยาบาล'
    );
  } else if (thisYearCount < 10) {
    problems.push(
      '⚠️ วันหยุดของปี ' + thisYear + ' มีเพียง ' + thisYearCount + ' วัน ' +
      'ดูน้อยผิดปกติ (ปกติมีราว 16-20 วัน) กรุณาตรวจว่ากรอกครบหรือยัง'
    );
  }

  // การนับเวลาทำการทำงานถูกไหม — ศุกร์ 15:00 ถึง จันทร์ 09:00 ควรได้ 2 ชั่วโมง
  const friday = new Date(2026, 6, 31, 15, 0, 0);   // ศุกร์ 31 ก.ค. 2026
  const monday = new Date(2026, 7, 3, 9, 0, 0);     // จันทร์ 3 ส.ค. 2026
  const hours = businessHoursBetween_(friday, monday, holidays);
  if (Math.abs(hours - 2) > 0.01) {
    problems.push('การนับเวลาทำการผิดพลาด: คาดว่า 2 ชม. แต่ได้ ' + hours);
  }

  if (problems.length === 0) {
    console.log('✅ ระบบพร้อมใช้งาน');
    console.log('การนับเวลาทำการถูกต้อง (ศุกร์ 15:00 → จันทร์ 09:00 = 2 ชั่วโมงทำการ)');
  } else {
    console.log('❌ พบปัญหา ' + problems.length + ' รายการ:');
    problems.forEach(function (p) { console.log('  • ' + p); });
  }
  return problems;
}
