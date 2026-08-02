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

  console.log('สร้างชีตและคอลัมน์เรียบร้อย');
  console.log('อย่าลืมกรอกวันหยุดนักขัตฤกษ์ลงในชีต "' + SHEETS.holidays + '"');
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
