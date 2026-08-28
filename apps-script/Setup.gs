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

  createIfMissing_(ss, SHEETS.indications, INDICATION_COLUMNS);
  seedIndications_(ss);

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
 * เกณฑ์การส่งต่อเพื่อปลูกถ่าย — เติมค่าตั้งต้นจาก docs/I:CBMT.pdf
 *
 * ใส่ไว้ในชีตแทนการฝังในโค้ด เพราะเกณฑ์เปลี่ยนตามแนวทางการรักษา
 * ซึ่งเป็นเรื่องทางคลินิก ไม่ใช่เรื่องของโปรแกรม (SRS NFR-005)
 * อาจารย์แก้เองได้โดยไม่ต้องรอ deploy
 *
 * ไม่เขียนทับของเดิม — รันซ้ำได้ปลอดภัย
 */
const INDICATION_COLUMNS = [
  'id', 'type', 'disease', 'disease_status', 'age', 'active',
];

function seedIndications_(ss) {
  const sheet = ss.getSheetByName(SHEETS.indications);
  const existing = {};
  readRows_(sheet).forEach(function (r) {
    if (r['id']) existing[String(r['id']).trim()] = true;
  });

  const defaults = [
    ['AUTO_MM', 'AUTOLOGOUS', 'Multiple myeloma',
     'ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป ให้ CMT อย่างน้อย 2 รอบ (after 2 cycle of induction)',
     'ต่ำกว่า 70 ปี (อายุ 65–70 ปี ประเมินแล้ว fit และไม่มีโรคประจำตัว)', 'yes'],
    ['AUTO_LYMPHOMA_RR', 'AUTOLOGOUS', 'Relapse/refractory lymphoma (chemosensitive)',
     'ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป ให้ CMT อย่างน้อย 2 รอบ (after 2 cycle of salvage)',
     'ต่ำกว่า 65 ปี', 'yes'],
    ['AUTO_PCNSL', 'AUTOLOGOUS', 'PCNSL (chemosensitive)',
     'ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป (after interim)', 'ต่ำกว่า 65 ปี', 'yes'],
    ['AUTO_PTCL', 'AUTOLOGOUS', 'PTCL (chemosensitive)',
     'ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป (after interim)', '', 'yes'],

    ['ALLO_AML', 'ALLOGENEIC', 'AML (intermediate and adverse risk)', 'CR', 'ต่ำกว่า 65 ปี', 'yes'],
    ['ALLO_ALL_PH_NEG', 'ALLOGENEIC', 'ALL Ph negative (high risk)', 'CR', 'ต่ำกว่า 65 ปี', 'yes'],
    ['ALLO_ALL_PH_POS', 'ALLOGENEIC', 'ALL Ph positive', 'CR', 'ต่ำกว่า 65 ปี', 'yes'],
    ['ALLO_RR_AML_ALL', 'ALLOGENEIC', 'Relapse/refractory AML and ALL', 'CR', 'ต่ำกว่า 65 ปี', 'yes'],
    ['ALLO_MDS', 'ALLOGENEIC', 'MDS (high and very high risk)', '', 'ต่ำกว่า 65 ปี', 'yes'],
    ['ALLO_PMF', 'ALLOGENEIC', 'PMF (int-2, high risk)', '', 'ต่ำกว่า 65 ปี', 'yes'],
    ['ALLO_CML', 'ALLOGENEIC', 'CML triple refractory หรือ T315I mutation', '', 'ต่ำกว่า 65 ปี', 'yes'],
    ['ALLO_SAA', 'ALLOGENEIC', 'Severe aplastic anemia', '',
     'MUD อายุน้อยกว่า 18 ปี, MSD อายุน้อยกว่า 50 ปี', 'yes'],
  ];

  const toAdd = defaults.filter(function (row) { return !existing[row[0]]; });
  if (toAdd.length === 0) return;

  sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, INDICATION_COLUMNS.length)
    .setValues(toAdd);
  console.log('เติมเกณฑ์ปลูกถ่าย ' + toAdd.length + ' รายการ');
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
    // อ่านครั้งเดียวแล้วใช้ร่วมกันทั้งฟังก์ชัน — ชีตนี้โตขึ้นเรื่อย ๆ
    const rows = readRows_(referrals);

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

    // อีเมลว่าง = แพทย์ต้นทางไม่ได้รับรหัสอ้างอิง และเช็คสถานะกับบอทไม่ได้
    //
    // ⚠️ การย้าย referrer_email ไปอยู่ใน FORM_COLUMNS_REQUIRED ตรวจได้แค่ว่า
    // "มีหัวคอลัมน์" ซึ่งมีอยู่แล้วไม่ว่าคำถามในฟอร์มจะติ๊ก Required หรือไม่
    // การติ๊ก Required อยู่ในฟอร์มของ Google โค้ดมองไม่เห็น ตรวจได้ทางเดียว
    // คือดูว่ามีแถวไหนที่อีเมลว่างจริงหรือเปล่า
    if ('referrer_email' in map) {
      const blankEmail = rows.filter(function (r) {
        return r['referral_id'] && !String(r['referrer_email'] || '').trim();
      });
      if (blankEmail.length > 0) {
        problems.push(
          'มี ' + blankEmail.length + ' เคสที่ไม่มีอีเมลผู้ส่ง (' +
          blankEmail.slice(0, 5).map(function (r) { return r['referral_id']; }).join(', ') +
          (blankEmail.length > 5 ? ', …' : '') +
          ') — แพทย์ต้นทางไม่ได้รับรหัสอ้างอิงและเช็คสถานะเองไม่ได้ ' +
          'ตรวจว่าคำถาม "อีเมล" ในฟอร์มติ๊ก Required แล้วหรือยัง'
        );
      }
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
    rows.forEach(function (r) {
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

  // trigger ครบไหม
  //
  // ⚠️ ข้อนี้เพิ่มมาเพราะเคยพลาดจริง — trigger onFormSubmit หายไปหลังแก้ฟอร์ม
  // เคสที่ส่งเข้ามาจึงไม่ได้ referral_id ไม่ได้สถานะ และไม่มีอีเมลตอบกลับ
  // โดยไม่มีอะไรฟ้องเลย ชีตดูเหมือนปกติเพราะแถวลงครบ
  //
  // trigger ผูกกับบัญชี Google ของคนที่สร้าง ไม่ได้ผูกกับไฟล์
  // เปลี่ยนคนดูแลเมื่อไหร่ คนใหม่ต้องรัน setupTriggers() เองอีกครั้ง
  const EXPECTED_TRIGGERS = [
    'onFormSubmit', 'recalculateSla', 'sendRedAlert',
    'sendDailyBatch', 'anonymizeExpired', 'buildMonthlyStats',
  ];
  const installed = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction();
  });
  const missingTriggers = EXPECTED_TRIGGERS.filter(function (name) {
    return installed.indexOf(name) === -1;
  });
  if (missingTriggers.length > 0) {
    problems.push(
      '⚠️ ไม่พบ trigger: ' + missingTriggers.join(', ') +
      ' — เคสที่ส่งเข้ามาจะไม่ถูกประมวลผลเลย ให้รัน setupTriggers()'
    );
  }

  // มีแถวที่ trigger ไม่ได้ประมวลผลค้างอยู่ไหม
  //
  // ตรวจผลลัพธ์จริง ไม่ใช่แค่ว่ามี trigger อยู่ — trigger ที่มีอยู่แต่ error
  // ทุกครั้งจะให้อาการเดียวกันคือแถวมาแต่ไม่มี referral_id
  if (referrals) {
    const orphans = readRows_(referrals).filter(function (r) {
      return String(r['submitted_at'] || r['Timestamp'] || '').trim() &&
             !String(r['referral_id'] || '').trim();
    });
    if (orphans.length > 0) {
      problems.push(
        '⚠️ มี ' + orphans.length + ' แถวที่ยังไม่มี referral_id — ' +
        'trigger ไม่ได้ประมวลผล ให้รัน setupTriggers() แล้วรัน onFormSubmit() ' +
        'เพื่อซ่อมแถวล่าสุด (แถวเก่ากว่านั้นต้องกรอกเอง)'
      );
    }
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

/* ------------------------------------------------------------------ */
/* คืนชื่อหัวคอลัมน์ที่ Google Form เขียนทับ                              */
/* ------------------------------------------------------------------ */

/**
 * ชื่อคอลัมน์จากฟอร์ม เรียงตามตำแหน่งจริงในชีต (คอลัมน์ A เป็นต้นไป)
 *
 * ⚠️ ลำดับสำคัญ ห้ามสลับ — การคืนชื่อทำตามตำแหน่ง ไม่ใช่ตามชื่อ
 * เพราะข้อความคำถามซ้ำกันหลายที่ ("การวินิจฉัย" มี 3 ที่ สำหรับกลุ่ม 1/2/3)
 * ถ้าจับคู่ด้วยชื่อจะแยกไม่ออกว่าอันไหนของกลุ่มไหน
 */
const FORM_COLUMN_ORDER = [
  'submitted_at', 'consent_raw', 'referrer_org', 'referrer_name',
  'referrer_phone', 'referrer_email', 'patient_age', 'patient_sex',
  'urgency', 'referral_type',
  // กลุ่มที่ 1 — เลิกใช้ฟอร์มแล้ว แต่คอลัมน์ยังอยู่ (ซ่อนไว้)
  'diagnosis_g1', 'disease_group_g1', 'diagnosis_date_ym', 'disease_status',
  'treatment_summary_g1', 'transplant_type', 'sibling_available',
  'documents_ready', 'preferred_period', 'additional_note',
  // กลุ่มที่ 2
  'diagnosis_g2', 'disease_group_g2', 'stage_g2', 'treatment_summary_g2',
  'key_labs', 'clinical_question_g2', 'comorbidity_g2',
  // กลุ่มที่ 3
  'diagnosis_g3', 'disease_group_g3', 'stage_g3', 'comorbidity_g3',
  'treatment_summary_g3', 'performance_status', 'admission_reason',
  'clinical_question_g3',
  // กลุ่มที่ 4 — เลิกใช้ฟอร์มแล้ว แต่คอลัมน์ยังอยู่ (ซ่อนไว้)
  'referral_reason', 'diagnosis_g4', 'refer_letter_ready',
];

/**
 * พิมพ์แถวหัวตารางออกมาทั้งแถว พร้อมเลขคอลัมน์ — อ่านอย่างเดียว ไม่เขียนอะไรเลย
 *
 * มีไว้ใช้ตอน restoreFormHeaders() ปฏิเสธที่จะทำงาน เพราะมันบอกได้แค่ว่า
 * คอลัมน์ที่คาดไว้ผิดไปหนึ่งช่อง แต่ไม่ได้บอกว่าทั้งแถวหน้าตาเป็นอย่างไร
 *
 * เคยเจอมาแล้ว: หัวคอลัมน์ referral_id กลายเป็นรหัสเคสจริง (HEM-...) เพราะบั๊ก
 * รุ่นก่อนหลุดไปประมวลผลแถวที่ 1 เหมือนเป็นเคส แล้วเขียนค่าทับชื่อคอลัมน์
 * กรณีแบบนั้นต้องเห็นทั้งแถวก่อนถึงจะรู้ว่าโดนไปกี่ช่อง
 */
function showHeaderRow() {
  const sheet = getSheet_(SHEETS.referrals);
  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0];

  console.log('ชีต "' + SHEETS.referrals + '" มี ' + width + ' คอลัมน์');
  console.log('โค้ดคาดว่าคอลัมน์จากฟอร์มมี ' + FORM_COLUMN_ORDER.length +
    ' คอลัมน์ แล้ว referral_id อยู่คอลัมน์ที่ ' + (FORM_COLUMN_ORDER.length + 1));
  console.log('');

  const lines = headers.map(function (h, i) {
    const text = String(h).trim();
    const expected = i < FORM_COLUMN_ORDER.length ? FORM_COLUMN_ORDER[i] : '';
    let mark = '  ';
    if (!text) mark = '∅ ';
    else if (expected && text !== expected) mark = '✗ ';
    else if (expected) mark = '✓ ';
    return mark + (i + 1) + '. ' + (text || '(ว่าง)') +
      (expected && text !== expected ? '   [ควรเป็น ' + expected + ']' : '');
  });

  console.log(lines.join('\n'));
  console.log('');
  console.log('✓ ตรง   ✗ ไม่ตรงกับที่คาด   ∅ ว่าง   (ไม่มีเครื่องหมาย = คอลัมน์ระบบ ไม่ได้มาจากฟอร์ม)');
}

/**
 * ตรวจว่ามีคอลัมน์ referral_id ซ้ำกันหรือไม่ และข้อมูลอยู่คอลัมน์ไหนบ้าง
 *
 * อ่านอย่างเดียว ไม่เขียนอะไรทั้งสิ้น
 *
 * เกิดจากลูกโซ่นี้: บั๊กรุ่นก่อนหลุดไปประมวลผลแถวที่ 1 เหมือนเป็นเคสจริง
 * แล้วเขียนรหัสเคสทับ "ชื่อคอลัมน์" referral_id ในแถวหัวตาราง
 * พอชื่อหาย ensureColumns_ ก็ทำตามหน้าที่คือสร้างคอลัมน์ referral_id ใหม่
 * ต่อท้ายชีตให้ เคสที่เข้ามาหลังจากนั้นจึงไปลงคอลัมน์ใหม่ ส่วนเคสเก่ายังอยู่
 * คอลัมน์เดิมที่ตอนนี้ระบบมองไม่เห็นแล้ว
 *
 * ต้องรู้ว่าเคสไหนอยู่คอลัมน์ไหนก่อน ถึงจะรวมกลับได้โดยไม่ทำข้อมูลหาย
 */
function diagnoseReferralIdColumns() {
  const sheet = getSheet_(SHEETS.referrals);
  const width = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  const ID_PATTERN = /^HEM-\d{8}-\d{4}$/;

  const named = [];
  const polluted = [];
  headers.forEach(function (h, i) {
    if (h === 'referral_id') named.push(i);
    else if (ID_PATTERN.test(h)) polluted.push(i);
  });

  console.log('คอลัมน์ทั้งหมด ' + width + ' | แถวข้อมูล ' + Math.max(0, lastRow - 1));
  console.log('คอลัมน์ที่ชื่อ referral_id: ' +
    (named.length ? named.map(function (i) { return i + 1; }).join(', ') : 'ไม่มีเลย'));
  console.log('คอลัมน์ที่หัวตารางเป็นรหัสเคส (โดนเขียนทับ): ' +
    (polluted.length
      ? polluted.map(function (i) { return (i + 1) + ' → "' + headers[i] + '"'; }).join(', ')
      : 'ไม่มี'));
  console.log('');

  const check = named.concat(polluted).sort(function (a, b) { return a - b; });
  if (check.length === 0 || lastRow < 2) {
    console.log('ไม่มีข้อมูลให้เทียบ');
    return;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  check.forEach(function (col) {
    const filled = [];
    values.forEach(function (row, i) {
      const v = String(row[col] || '').trim();
      if (v) filled.push({ row: i + 2, value: v });
    });

    console.log('── คอลัมน์ ' + (col + 1) + ' (หัวตาราง: "' + headers[col] + '")');
    console.log('   มีค่า ' + filled.length + ' แถว จาก ' + (lastRow - 1));
    filled.slice(0, 10).forEach(function (f) {
      console.log('     แถว ' + f.row + ': ' + f.value);
    });
    if (filled.length > 10) console.log('     ... และอีก ' + (filled.length - 10) + ' แถว');
    console.log('');
  });

  if (check.length === 2) {
    let both = 0, onlyA = 0, onlyB = 0, neither = 0, conflict = 0;
    values.forEach(function (row) {
      const a = String(row[check[0]] || '').trim();
      const b = String(row[check[1]] || '').trim();
      if (a && b) { both++; if (a !== b) conflict++; }
      else if (a) onlyA++;
      else if (b) onlyB++;
      else neither++;
    });
    console.log('สรุปการทับซ้อน');
    console.log('  มีค่าทั้งสองคอลัมน์: ' + both + ' แถว (ค่าไม่ตรงกัน ' + conflict + ' แถว)');
    console.log('  มีเฉพาะคอลัมน์ ' + (check[0] + 1) + ': ' + onlyA + ' แถว');
    console.log('  มีเฉพาะคอลัมน์ ' + (check[1] + 1) + ': ' + onlyB + ' แถว');
    console.log('  ว่างทั้งคู่ (ไม่มีรหัสเลย): ' + neither + ' แถว');
  }
}

/**
 * คืนชื่อหัวคอลัมน์เป็นชื่อ field หลัง Google Form เขียนทับด้วยข้อความคำถาม
 *
 * ทุกครั้งที่แก้ฟอร์ม Google จะเขียนหัวคอลัมน์ในชีตใหม่เป็นข้อความคำถาม
 * ภาษาไทย เช่น "โรงพยาบาลต้นทาง" แทน referrer_org ซึ่งทำให้ทั้ง onFormSubmit
 * และ dashboard หาคอลัมน์ไม่เจอ เคสใหม่จะไม่ถูกประมวลผลและหายจากหน้าจอ
 * โดยไม่มีอะไรฟ้อง — จึงต้องรันฟังก์ชันนี้ทุกครั้งหลังแก้ฟอร์ม
 *
 * เขียนตามตำแหน่ง ไม่ใช่ตามชื่อ และตรวจว่าคอลัมน์ระบบยังอยู่ตำแหน่งเดิมก่อน
 * ถ้าโครงสร้างไม่ตรงกับที่คาดจะหยุดทันที ดีกว่าเขียนชื่อผิดคอลัมน์
 */
function restoreFormHeaders() {
  const sheet = getSheet_(SHEETS.referrals);
  const width = sheet.getLastColumn();
  const current = sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  const n = FORM_COLUMN_ORDER.length;

  if (width < n + 1) {
    throw new Error('ชีตมีแค่ ' + width + ' คอลัมน์ ซึ่งน้อยกว่าที่คาด — หยุดไว้ก่อน');
  }

  // ยามกันเขียนผิดที่ — คอลัมน์ถัดจากช่วงฟอร์มต้องเป็น referral_id เสมอ
  if (current[n] !== 'referral_id') {
    throw new Error(
      'คอลัมน์ที่ ' + (n + 1) + ' ควรเป็น "referral_id" แต่พบ "' + current[n] + '"\n' +
      'โครงสร้างชีตไม่ตรงกับที่คาด หยุดเพื่อไม่ให้เขียนชื่อผิดคอลัมน์'
    );
  }

  const changed = [];
  for (let i = 0; i < n; i++) {
    if (current[i] !== FORM_COLUMN_ORDER[i]) {
      changed.push('  ' + (current[i] || '(ว่าง)') + '  →  ' + FORM_COLUMN_ORDER[i]);
    }
  }

  if (changed.length === 0) {
    console.log('หัวคอลัมน์ถูกต้องอยู่แล้ว ไม่มีอะไรต้องแก้');
    return;
  }

  sheet.getRange(1, 1, 1, n).setValues([FORM_COLUMN_ORDER]);

  console.log('คืนชื่อหัวคอลัมน์แล้ว ' + changed.length + ' คอลัมน์:');
  console.log(changed.join('\n'));
  console.log('');
  console.log('รัน runSelfTest() ต่อเพื่อยืนยัน');
}

/* ------------------------------------------------------------------ */
/* จัดชีตให้อาจารย์อ่านและตอบได้                                          */
/* ------------------------------------------------------------------ */

/**
 * คอลัมน์ที่อาจารย์ต้องเห็นเวลาอ่านเคสและตอบ เรียงตามลำดับความสำคัญในการอ่าน
 * นอกรายการนี้ซ่อนทั้งหมด
 */
const REVIEW_VISIBLE_COLUMNS = {
  'referral_id': 'เลขที่อ้างอิงของเคส',
  'submitted_at': 'วันเวลาที่แพทย์ต้นทางส่งเข้ามา',
  'status': 'สถานะ — เลือกจากรายการ เปลี่ยนเป็น "Advice Sent" เมื่อตอบเสร็จ',
  'alert_level': 'none = ปกติ / yellow = ค้างเกิน 24 ชม.ทำการ / red = เกิน 48 ชม.',
  'referral_type': 'กลุ่มที่ 2 = ขอความเห็นสูตรยา, กลุ่มที่ 3 = ขอส่งตัวมารับยา',
  'urgency': 'ความเร่งด่วนที่แพทย์ต้นทางระบุ',
  'referrer_org': 'โรงพยาบาลต้นทาง',
  'referrer_name': 'ชื่อแพทย์ผู้ส่ง',
  'referrer_phone': 'เบอร์ติดต่อกลับ',
  'patient_age': 'อายุผู้ป่วย (ปี)',
  'patient_sex': 'เพศ',
  'diagnosis': 'การวินิจฉัย',
  'disease_group': 'กลุ่มโรค',
  'stage': 'Stage / risk group',
  'treatment_summary': 'การรักษาที่ได้รับมาแล้ว',
  'comorbidity': 'โรคประจำตัว / ข้อจำกัดในการให้ยา',
  'clinical_question': 'สิ่งที่แพทย์ต้นทางต้องการปรึกษา',
  'advice_record': '⬅️ พิมพ์คำตอบของอาจารย์ตรงนี้',
  'assigned_to': 'แพทย์ประจำบ้านที่ดูแลเคสนี้',
  'incomplete_reason': 'เหตุผลที่ข้อมูลไม่ครบ (ถ้ามี)',
};

const ALL_STATUSES = [
  'Submitted', 'Pending Review', 'Incomplete', 'Slot Reserved',
  'Awaiting Attending', 'Advice Sent', 'Readiness Visit Scheduled',
  'Appointment Confirmed', 'Auto Replied', 'Rejected / Redirected', 'Closed',
];

/**
 * จัดหน้าตาชีต referrals ให้อ่านและตอบได้โดยไม่ต้องเปิด dashboard
 *
 * ชีตดิบมี 60 กว่าคอลัมน์ ชื่อเป็นภาษาอังกฤษ และมีข้อมูลซ้ำสองชุด
 * (คอลัมน์ _g2 _g3 จากฟอร์ม กับคอลัมน์กลางที่ระบบรวมให้) คนที่ไม่ได้สร้างระบบ
 * เปิดมาแล้วไม่รู้ว่าต้องดูตรงไหนและตอบตรงไหน
 *
 * ทำ 4 อย่าง — ซ่อนคอลัมน์ที่ไม่ต้องใช้, ใส่คำอธิบายภาษาไทยเป็น note บนหัวคอลัมน์
 * (เอาเมาส์ชี้แล้วเห็น), ทำ status เป็น dropdown กันพิมพ์ผิด, และตรึงแถวหัวไว้
 *
 * ไม่แตะข้อมูลสักเซลล์ ปรับแค่การแสดงผล รันซ้ำได้ปลอดภัย
 */
function prepareSheetForReview() {
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const lastCol = sheet.getLastColumn();

  let hidden = 0, shown = 0;
  for (let i = 0; i < lastCol; i++) {
    const name = Object.keys(map).find(function (k) { return map[k] === i; });
    if (name && name in REVIEW_VISIBLE_COLUMNS) {
      sheet.showColumns(i + 1);
      sheet.getRange(1, i + 1).setNote(REVIEW_VISIBLE_COLUMNS[name]);
      shown++;
    } else {
      sheet.hideColumns(i + 1);
      hidden++;
    }
  }

  // status เป็น dropdown — พิมพ์เองผิดตัวเดียวแล้วเคสหายจาก dashboard ทันที
  if ('status' in map) {
    const rows = Math.max(sheet.getMaxRows() - 1, 1);
    sheet.getRange(2, map['status'] + 1, rows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(ALL_STATUSES, true)
        .setAllowInvalid(false)
        .setHelpText('เลือกจากรายการ — พิมพ์เองระบบจะอ่านไม่ออก')
        .build()
    );
  }

  sheet.setFrozenRows(1);
  if ('referral_id' in map && map['referral_id'] === 0) sheet.setFrozenColumns(1);

  console.log('จัดชีตให้อ่านง่ายแล้ว');
  console.log('  แสดง ' + shown + ' คอลัมน์ / ซ่อน ' + hidden + ' คอลัมน์');
  console.log('  หัวคอลัมน์มีคำอธิบายภาษาไทย เอาเมาส์ชี้เพื่อดู');
  console.log('  ช่อง status เป็น dropdown แล้ว');
  console.log('');
  console.log('อยากเห็นทุกคอลัมน์อีกครั้ง ให้รัน showAllColumns()');
}
