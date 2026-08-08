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

  createIfMissing_(ss, SHEETS.config, ['key', 'value', 'description']);
  seedConfigKeys_(ss);

  console.log('สร้างชีตและคอลัมน์เรียบร้อย');
  console.log('ต้องกรอกเพิ่ม:');
  console.log('  • ' + SHEETS.holidays + ' — วันหยุดนักขัตฤกษ์');
  console.log('  • ' + SHEETS.config + ' — ชื่อผู้รับผิดชอบ');
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

/* ------------------------------------------------------------------ */
/* ทำความสะอาดคอลัมน์ที่เลิกใช้                                          */
/* ------------------------------------------------------------------ */

/**
 * คอลัมน์จากฟอร์มที่ไม่มีอะไรเขียนลงไปอีกแล้ว
 *
 * กลุ่มที่ 1 เลิกใช้ฟอร์ม เปลี่ยนเป็นจองคิวผ่านหน้าเว็บโดยตรง
 * กลุ่มที่ 4 ไม่รับข้อมูลเข้าระบบนี้เลย ให้ผู้ป่วยนัดเองที่ระบบของโรงพยาบาล
 * (มติอาจารย์ 2 ส.ค. 2569)
 *
 * ไม่รวมคอลัมน์ของกลุ่ม 2 และ 3 ซึ่งยังใช้ฟอร์มอยู่
 */
const OBSOLETE_FORM_COLUMNS = [
  // กลุ่มที่ 1
  'diagnosis_g1', 'disease_group_g1', 'diagnosis_date_ym', 'disease_status',
  'treatment_summary_g1', 'transplant_type', 'sibling_available',
  'documents_ready', 'preferred_period', 'additional_note',
  // กลุ่มที่ 4
  'referral_reason', 'diagnosis_g4', 'refer_letter_ready',
];

/**
 * ซ่อนคอลัมน์ที่เลิกใช้ ให้ชีตอ่านง่ายขึ้น
 *
 * ⚠️ ซ่อน ไม่ใช่ลบ — และนั่นเป็นข้อจำกัดของ Google ไม่ใช่ทางเลือกของเรา
 * ชีตที่เคยเชื่อมกับ Google Form จะล็อกคอลัมน์คำตอบไว้ ลบไม่ได้แม้ลบฟอร์มทิ้งแล้ว
 * ("Cannot delete column with form data")
 *
 * กลายเป็นผลดี — การซ่อนย้อนกลับได้ทันทีด้วย showAllColumns()
 * ต่างจากการลบที่กู้คืนด้วยโค้ดไม่ได้ และเป้าหมายจริงคือให้อ่านง่าย ไม่ใช่ให้หายไป
 *
 * รันซ้ำได้ ไม่มีผลข้างเคียง
 */
function cleanupUnusedColumns() {
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);

  const hidden = [];
  OBSOLETE_FORM_COLUMNS.forEach(function (name) {
    if (!(name in map)) return;
    sheet.hideColumns(map[name] + 1);
    hidden.push(name);
  });

  if (hidden.length === 0) {
    console.log('ไม่พบคอลัมน์ที่เลิกใช้ — ชีตสะอาดอยู่แล้ว');
    return;
  }

  console.log('ซ่อนคอลัมน์ที่เลิกใช้แล้ว ' + hidden.length + ' คอลัมน์:\n  ' +
    hidden.join(', '));
  console.log('ข้อมูลยังอยู่ครบ ไม่ได้ลบ — เรียกกลับมาดูได้ด้วย showAllColumns()');
}

/** ยกเลิกการซ่อนทั้งหมด — ใช้เมื่ออยากเห็นทุกคอลัมน์อีกครั้ง */
function showAllColumns() {
  const sheet = getSheet_(SHEETS.referrals);
  sheet.showColumns(1, sheet.getMaxColumns());
  console.log('แสดงทุกคอลัมน์ในชีต ' + SHEETS.referrals + ' แล้ว');
}

/**
 * ตรวจว่าการจองคิวพร้อมทำงานหรือยัง
 *
 * จุดที่พลาดบ่อยที่สุดคือสิทธิ์ในไฟล์ตารางเวร — Apps Script รันด้วยบัญชี Google
 * ของคนที่เป็นเจ้าของสคริปต์ ไม่ใช่ service account ของเว็บ
 * การแชร์ไฟล์ตารางเวรให้ service account อย่างเดียวจึงไม่พอ
 * บัญชีที่รันสคริปต์ต้องเปิดไฟล์นั้นได้ด้วย
 */
function diagnoseBooking() {
  const props = PropertiesService.getScriptProperties();

  console.log('บัญชีที่รันสคริปต์นี้: ' + Session.getEffectiveUser().getEmail());
  console.log('— ต้องเป็นบัญชีที่เปิดไฟล์ตารางเวรได้ ไม่ใช่ service account —');
  console.log('');

  const token = props.getProperty('BOOKING_API_TOKEN');
  console.log('BOOKING_API_TOKEN: ' + (token ? 'ตั้งแล้ว (' + token.length + ' ตัวอักษร)' : '❌ ยังไม่ได้ตั้ง'));

  const scheduleId = props.getProperty('SCHEDULE_SHEET_ID');
  if (!scheduleId) {
    console.log('SCHEDULE_SHEET_ID: ❌ ยังไม่ได้ตั้ง');
    return;
  }
  console.log('SCHEDULE_SHEET_ID: ตั้งแล้ว (ลงท้าย ...' + scheduleId.slice(-6) + ')');

  try {
    const file = SpreadsheetApp.openById(scheduleId);
    console.log('✓ เปิดไฟล์ตารางเวรได้: "' + file.getName() + '"');

    const tab = file.getSheetByName('fellow_schedule');
    if (!tab) {
      console.log('❌ ไม่พบแท็บ fellow_schedule ในไฟล์นี้ — อาจใส่ ID ผิดไฟล์');
      return;
    }
    console.log('✓ พบแท็บ fellow_schedule — มีข้อมูล ' + Math.max(0, tab.getLastRow() - 1) + ' แถว');
    console.log('');
    console.log('พร้อมจองคิวแล้ว');
  } catch (err) {
    console.log('❌ เปิดไฟล์ตารางเวรไม่ได้: ' + err.message);
    console.log('');
    console.log('วิธีแก้ — เปิดไฟล์ตารางเวรใน Google Sheets แล้วกด Share');
    console.log('แชร์ให้บัญชีนี้: ' + Session.getEffectiveUser().getEmail());
    console.log('สิทธิ์ Viewer พอ (สคริปต์แค่อ่านโควตา ไม่ได้เขียน)');
  }
}
