/**
 * ติดตั้งครั้งแรก — รันฟังก์ชันในไฟล์นี้จากเมนู Run ใน Apps Script Editor
 *
 * ลำดับการติดตั้ง:
 *   1. setupSheets()      สร้างชีตและคอลัมน์ที่จำเป็น
 *   2. ตั้ง Script Properties สำหรับ LINE (ดูคำอธิบายด้านล่าง)
 *   3. setupTriggers()    ตั้ง trigger ทั้งหมด
 *   4. runSelfTest()      ตรวจว่าทุกอย่างพร้อม
 */

/**
 * ตรวจว่าโค้ดทุกไฟล์ถูกวางครบและไม่มีอะไรหายไป
 *
 * ⚠️ ต่างจาก runSelfTest() ซึ่งตรวจ "ข้อมูลในชีต" — ตัวนี้ตรวจ "ตัวโค้ดเอง"
 *
 * Apps Script ใช้ global scope เดียวกันทั้งโปรเจกต์ ค่าที่ประกาศไว้ในไฟล์หนึ่ง
 * จึงเรียกได้จากทุกไฟล์ ผลข้างเคียงคือถ้าไฟล์ใดถูกวางไม่ครบ วางไฟล์เก่าทับ
 * หรือลบบางส่วนไปโดยไม่ตั้งใจ ทุกอย่างจะยังบันทึกได้และหน้าตาปกติ
 * แล้วไปพังตอนมีคนใช้งานจริง โดยฟ้องเป็นชื่อที่ไม่รู้จักซึ่งอ่านไม่ออกว่ามาจากไหน
 *
 * ฟังก์ชันนี้ไล่เช็คว่าชื่อที่โค้ดพึ่งพามีอยู่จริงทุกตัว และบอกว่าตัวที่ขาด
 * อยู่ในไฟล์ไหน จะได้วางเฉพาะไฟล์นั้นใหม่ ไม่ต้องเดา
 *
 * รันได้ทุกเมื่อ ไม่แก้ไขข้อมูลใด ๆ
 */
function checkCodeFiles() {
  const EXPECT = {
    'Config.gs': [
      'TIMEZONE', 'SHEETS', 'ATTACHMENT', 'BUSINESS', 'ESCALATION',
      'BATCH_HOUR', 'FELLOW_URGENT_DAYS', 'DUPLICATE_WINDOW_DAYS',
      'RETENTION_MONTHS', 'TYPES', 'TYPE_FROM_FORM_LABEL', 'GROUP_NUMBER',
      'SLOT_RELEASING_STATUSES', 'TERMINAL_STATUSES', 'IDENTIFYING_COLUMNS',
      'ADVICE_LIBRARY_COLUMNS', 'DASHBOARD_LOGIN_COLUMNS',
      'FORM_COLUMNS_REQUIRED', 'FORM_COLUMNS_OPTIONAL',
      'MERGED_COLUMNS', 'SITE_URL', 'DASHBOARD_URL', 'LINE_OA_ID', 'CONTACT_PHONE',
    ],
    'Util.gs': [
      'formatThaiDate_', 'businessHoursBetween_', 'isWorkingDay_', 'headerMap_',
      'readRows_', 'setCell_', 'ensureColumns_', 'getSheet_', 'toDate_',
      'readConfigValue_', 'parseEmailList_',
    ],
    'Setup.gs': [
      'setupSheets', 'setupTriggers', 'runSelfTest', 'checkCodeFiles',
      'addColumnNotes', 'setupAttachmentFolder', 'restoreFormHeaders',
      'showHeaderRow', 'FORM_COLUMN_ORDER', 'ATTENDING_COLUMNS',
      'REGIMEN_COLUMNS', 'INDICATION_COLUMNS', 'LINE_LINK_COLUMNS',
    ],
    'Api.gs': [
      'API_VERSION', 'doPost', 'doGet', 'saveAdvice_', 'bookTransplantSlot_',
      'contactAdmin_', 'checkDashboardMember_', 'lineGroupMemberProfile_',
      'dashboardLineGroups_', 'logDashboardLogin_',
      'ADVICE_CONTACT_COLUMNS', 'attachmentFolder_',
      'uploadAdviceAttachment_', 'sendAdviceEmail_', 'sendAdviceCopyEmail_',
      'buildAdviceContactBlock_', 'buildVisitBlock_', 'buildAttachmentBlock_',
    ],
    'Notify.gs': [
      'pushLineMessage_', 'replyLineMessage_', 'sendOneLinePush_',
      'sendOneLineMessage_', 'parseLineTargets_', 'linkButtonMessage_',
      'withQuickReply_', 'cancelQuickReply_', 'sendDailyBatch',
      'sendFellowDailyBatch', 'notifyFellowOfBooking_', 'notifyReferrerOnLine_',
      'sendLinkCodeEmail_', 'buildLineLinkInvite_', 'testLineTargets',
    ],
    'LineWebhook.gs': [
      'handleLineWebhook_', 'handleLineEvent_', 'handleAdminReply_',
      'startContactFlow_', 'advanceContactFlow_', 'startMyCasesFlow_',
      'startLinkFlow_', 'handleLinkPhone_', 'handleLinkCode_', 'handleUnlink_',
      'findLineLink_', 'findLineUserByPhone_', 'saveLineLink_',
      'buildMyAnswersMenu_', 'issueLineTicket_', 'relayToAdmin_',
      'LINE_ADMIN_PREFIX', 'LINE_BUTTON_MYANSWERS', 'LINE_CONTACT_TOPICS',
    ],
    'OnFormSubmit.gs': ['onFormSubmit', 'SYSTEM_COLUMNS'],
    'GroupQuery.gs': [
      'handleGroupQuery_', 'isStaffGroup_', 'parseQueryDate_',
      'buildAppointmentReply_', 'buildPendingReply_',
      'buildMenuMessage_', 'GROUP_QUERY_ACTIONS',
    ],
    'Retention.gs': [
      'anonymizeExpired', 'isExpired_', 'previewRetention',
      'buildAnonymizedRow_', 'trashAttachments_',
      'sweepOldAttachments', 'verifyLibraryHasNoIdentifiers',
    ],
    'Sla.gs': ['recalculateSla', 'sendRedAlert'],
    'Stats.gs': ['buildMonthlyStats', 'STATS_COLUMNS'],
    'ManageBooking.gs': [
      'lookupBooking_', 'cancelBooking_', 'rescheduleBooking_',
      'generateManageToken_',
    ],
  };

  const stale = [];
  let checked = 0;

  Object.keys(EXPECT).forEach(function (file) {
    const missing = EXPECT[file].filter(function (name) {
      checked++;
      try {
        return eval('typeof ' + name) === 'undefined';
      } catch (err) {
        return true;
      }
    });
    if (missing.length > 0) stale.push({ file: file, missing: missing });
  });

  // ชื่อแท็บใน SHEETS ต้องมีค่าครบ ไม่ใช่แค่ตัวแปร SHEETS มีอยู่
  // — เคสที่เจอจริงคือ Config.gs เก่าทำให้ SHEETS.lineLinks เป็น undefined
  // แล้ว insertSheet(undefined) สร้างแท็บชื่อ "Sheet1" ให้แทนโดยไม่ error
  const blankSheetKeys = typeof SHEETS === 'undefined' ? ['(ไม่มี SHEETS)'] :
    ['referrals', 'adviceLibrary', 'statsMonthly', 'statusLog', 'holidays',
     'config', 'indications', 'regimens', 'attendings', 'lineLinks']
      .filter(function (k) { return !SHEETS[k]; });

  console.log('ตรวจชื่อที่โค้ดพึ่งพา ' + checked + ' รายการ');
  console.log('');

  if (stale.length === 0 && blankSheetKeys.length === 0) {
    console.log('✅ โค้ดครบทุกไฟล์ ไม่มีอะไรขาด');
    console.log('');
    // ⚠️ อ่านค่าจากโค้ดในหน้าจอ ไม่ใช่จากตัวที่ deploy อยู่จริง
    // สองอย่างนี้ต่างกันได้เสมอ และเป็นสาเหตุที่พบบ่อยที่สุดของอาการ
    // "แก้โค้ดแล้วแต่ไม่มีอะไรเปลี่ยน" — จึงต้องบอกวิธียืนยันไว้ตรงนี้
    console.log('โค้ดในหน้าจอเป็นเวอร์ชัน: ' + API_VERSION);
    console.log('⚠️ ยังไม่ได้แปลว่า deploy แล้ว — ต้องกด New version ก่อน');
    console.log('   ยืนยันโดยเปิด URL ของ Web App แล้วดูบรรทัด version:');
    return;
  }

  if (blankSheetKeys.length > 0) {
    console.log('❌ SHEETS ขาดชื่อแท็บ: ' + blankSheetKeys.join(', '));
    console.log('   → วาง Config.gs ฉบับล่าสุดใหม่');
    console.log('');
  }

  stale.forEach(function (s) {
    console.log('❌ ' + s.file + ' — ขาด ' + s.missing.length + ' รายการ');
    console.log('   ' + s.missing.join(', '));
    console.log('   → วางไฟล์นี้ใหม่ทั้งไฟล์');
    console.log('');
  });

  console.log('⚠️ วาง Config.gs ก่อนไฟล์อื่นเสมอ');
  console.log('   ทุกไฟล์อ้างชื่อแท็บและค่าคงที่จากไฟล์นั้น');
}

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

  // คลังสูตรยาไม่ seed จากโค้ด — ให้วาง docs/chemo_regimens.tsv ลงไปครั้งเดียว
  // ดูเหตุผลที่หัวข้อ REGIMEN_COLUMNS ด้านล่าง
  createIfMissing_(ss, SHEETS.regimens, REGIMEN_COLUMNS);

  createIfMissing_(ss, SHEETS.attendings, ATTENDING_COLUMNS);

  createIfMissing_(ss, SHEETS.lineLinks, LINE_LINK_COLUMNS);

  console.log('สร้างชีตและคอลัมน์เรียบร้อย');
  console.log('ต้องกรอกเพิ่ม:');
  console.log('  • ' + SHEETS.holidays + ' — วันหยุดนักขัตฤกษ์');
  console.log('  • ' + SHEETS.config + ' — ชื่อผู้รับผิดชอบ');
  console.log('  • ' + SHEETS.regimens + ' — วาง docs/chemo_regimens.tsv (204 สูตร)');
  console.log('  • ' + SHEETS.attendings + ' — พิมพ์ชื่ออาจารย์ผู้ให้คำปรึกษา');
  console.log('  • ' + SHEETS.lineLinks + ' — ระบบเขียนเอง ไม่ต้องกรอก (ดูได้ว่าใครผูก LINE ไว้)');
}

/**
 * รายชื่ออาจารย์ผู้ให้คำปรึกษา — resident เลือกจากรายการนี้ตอนตอบ
 *
 * ไม่ seed จากโค้ด เพราะเป็นรายชื่อคนจริงที่หมุนเวียนทุกปี
 * ถ้าแท็บว่าง ระบบจะให้พิมพ์ชื่อเองแทนการล็อกไม่ให้ตอบ —
 * แท็บที่ยังไม่ได้กรอกไม่ควรทำให้ทั้งระบบตอบคำปรึกษาไม่ได้
 */
const ATTENDING_COLUMNS = ['name', 'active', 'note'];

/**
 * แพทย์ต้นทางที่ผูกบัญชี LINE ไว้ เพื่อรับลิงก์คำตอบโดยไม่ต้องเปิดอีเมล
 *
 * ⚠️ เป็นข้อมูลส่วนบุคคลของ "บุคลากรทางการแพทย์" ไม่ใช่ของผู้ป่วย
 * ความอ่อนไหวต่ำกว่ามาก แต่ยังต้องอยู่ในนโยบายการเก็บและมีวิธีให้เลิกผูกได้เอง
 *
 * เก็บเป็นแท็บ ไม่ใช่ Script Properties โดยเจตนา — แอดมินต้องเห็นว่าใครผูกไว้บ้าง
 * และต้องปิดให้ได้เมื่อแพทย์ทำมือถือหาย ถ้าซ่อนไว้จะไม่มีใครแตะได้เลย
 */
const LINE_LINK_COLUMNS = [
  'line_user_id', 'referrer_phone', 'referrer_email', 'linked_at', 'active',
];

/**
 * คลังสูตรยาเคมีบำบัด — อ่านจากชีต แก้/เพิ่ม/ลดได้โดยไม่ต้อง deploy
 *
 * ตั้งใจไม่ seed จากโค้ด ต่างจาก seedIndications_()
 * เกณฑ์ปลูกถ่ายมี 12 แถวและต้องมีค่าสำรองในโค้ดเสมอ เพราะถ้า dropdown ว่าง
 * จะไม่มีใครจองคิวได้ ส่วนคลังสูตรยามี 204 แถวและเป็นแค่ปุ่มช่วยพิมพ์
 * ถ้าชีตว่าง resident ยังพิมพ์สูตรยาเองได้ตามปกติ
 *
 * การเก็บ 204 แถวไว้ทั้งในโค้ดและในชีตจะทำให้สองที่ไม่ตรงกันทันทีที่แก้ในชีต
 * จึงให้ชีตเป็นต้นฉบับเดียว แล้ววาง docs/chemo_regimens.tsv ตอนติดตั้ง
 */
const REGIMEN_COLUMNS = ['disease_group', 'abbr', 'components', 'active'];

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
    ['central_admin_name', '', 'แพทย์แอดมินกลาง — ผู้รับ Red Alert เมื่อเคสค้างครบ 3 วันทำการ'],
    ['central_admin_contact', '', 'เบอร์หรือ LINE ID ของแพทย์แอดมินกลาง'],
    ['central_admin_email', '',
     'อีเมลแอดมินกลาง — รับข้อความจากหน้า "ติดต่อแพทย์แอดมินกลาง" ' +
     'ใส่ได้หลายคนโดยคั่นด้วยจุลภาค เช่น a@x.com, b@y.com ' +
     '(เว้นว่างได้ถ้าใช้ LINE อย่างเดียว)'],
    ['central_admin_backup_name', '', 'ผู้สำรองของแอดมินกลาง — ต้องมีก่อนเปิดใช้จริง'],
    ['central_admin_backup_contact', '', 'ช่องทางติดต่อผู้สำรอง'],
    ['system_owner', 'สาขาวิชาโลหิตวิทยา', 'เจ้าของระบบในนามหน่วยงาน'],
    ['template_library_owner', '', 'ผู้ดูแลคลังสูตรยาเคมีบำบัด (ใช้ทั้งกลุ่ม 2 และ 3)'],
    ['fellow_schedule_owner', '', 'ผู้กรอกตารางออกตรวจ fellow'],
    ['opd_phone', '02-419-9903', 'เบอร์ธุรการ OPD 700'],
    ['chemo_ward_phone', '', 'เบอร์วอร์ดเคมีบำบัด — เติมอัตโนมัติในฟอร์มตอบคำปรึกษา'],

    // ลิงก์เอกสาร PDF — เก็บเป็น config เพื่อให้เปลี่ยนไฟล์ฉบับใหม่ได้เองโดยไม่ต้อง deploy
    // ⚠️ ไฟล์ต้องตั้งการแชร์เป็น "ผู้ที่มีลิงก์ → ผู้อ่าน" ไม่งั้นแพทย์ต้นทางเปิดไม่ได้
    // ปลอดภัยเพราะเป็นเอกสารวิชาการ ไม่มีข้อมูลผู้ป่วย
    ['regimen_library_url',
     'https://drive.google.com/file/d/17XtsZ5a-RGKux7_ajWWomRf0HB0soTUI/view',
     'ลิงก์ Pool_CMT_Regimens_Library.pdf — ปุ่มเปิด/พิมพ์ในหน้าตอบคำปรึกษา'],
    ['bmt_indication_url',
     'https://drive.google.com/file/d/18MC_J0H1K5-fqahUMZ_z4bRHIsLDv_Tq/view',
     'ลิงก์ IndicationBMT.pdf — ปุ่มเปิด/พิมพ์ในหน้าจองคิวปลูกถ่าย'],
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
  // ⚠️ กันกรณีวาง Setup.gs แล้วลืมวาง Config.gs
  //
  // ชื่อแท็บทั้งหมดอยู่ใน SHEETS ของ Config.gs ถ้าไฟล์นั้นเป็นฉบับเก่า
  // ชื่อที่เพิ่งเพิ่มจะเป็น undefined แล้ว insertSheet(undefined) ไม่ error
  // แต่สร้างแท็บชื่อ "Sheet1" ให้แทน พร้อมหัวคอลัมน์ที่ถูกต้องทุกช่อง
  // — กลายเป็นแท็บที่ถูกทุกอย่างยกเว้นชื่อ ซึ่งโค้ดหาไม่เจอตลอดไปโดยไม่มีอะไรฟ้อง
  if (!name) {
    throw new Error(
      'ชื่อชีตเป็นค่าว่าง — แปลว่า Config.gs ยังเป็นฉบับเก่า\n' +
      'ให้วาง Config.gs ฉบับล่าสุดก่อน แล้วรัน setupSheets() ใหม่'
    );
  }

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

  // รอบเดียวกับ resident แต่คนละข้อความ เพราะคนละปลายทางและคนละเนื้อหา
  // (ดู sendFellowDailyBatch ใน Notify.gs)
  ScriptApp.newTrigger('sendFellowDailyBatch').timeBased().atHour(BATCH_HOUR).everyDays(1)
    .inTimezone(TIMEZONE).create();

  // ถอดชื่อและสรุปสถิติ เดือนละครั้ง วันที่ 1 ตอนตี 2
  ScriptApp.newTrigger('anonymizeExpired').timeBased().onMonthDay(1).atHour(2)
    .inTimezone(TIMEZONE).create();
  ScriptApp.newTrigger('buildMonthlyStats').timeBased().onMonthDay(1).atHour(3)
    .inTimezone(TIMEZONE).create();

  // กวาดไฟล์แนบที่เก่าเกินกำหนด — กันไฟล์ของเคสที่ไม่มีวันปิดค้างตลอดกาล
  // ดูเหตุผลเต็มที่ sweepOldAttachments() ใน Retention.gs
  ScriptApp.newTrigger('sweepOldAttachments').timeBased().onMonthDay(1).atHour(4)
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
  console.log('');
  console.log('"ตั้งค่าแล้ว" ไม่ได้แปลว่าส่งถึง — บอทอาจถูกเตะออกจากกลุ่มไปแล้ว');
  console.log('ให้ Run testLineTargets() เพื่อยิงข้อความทดสอบไปทุกปลายทางจริง');
}

/**
 * ตรวจความพร้อมของระบบ รันได้ทุกเมื่อ ไม่แก้ไขข้อมูล
 */
/**
 * ติดคำอธิบายวิธีกรอกไว้ที่หัวคอลัมน์ของทุกแท็บที่คนต้องกรอกเอง
 *
 * ⚠️ ใช้ Note ไม่ใช่การพิมพ์เป็นแถวในชีต โดยเจตนา
 *
 * โค้ดอ่านทุกแถวที่มีค่าในคอลัมน์แรกเป็นข้อมูลจริง คำอธิบายที่พิมพ์เป็นแถว
 * จะกลายเป็นชื่ออาจารย์ใน dropdown หรือกลายเป็นสูตรยาหลอกทันที
 * ส่วน Note อยู่คนละชั้นกับค่าในเซลล์ readRows_() จึงมองไม่เห็น
 *
 * รันซ้ำได้ปลอดภัย — เขียนทับ Note เดิมเสมอ ไม่แตะค่าในเซลล์
 */
function addColumnNotes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const NOTES = {};

  NOTES[SHEETS.attendings] = {
    name:
      'ชื่ออาจารย์ผู้ให้คำปรึกษา — พิมพ์ในคอลัมน์นี้ตั้งแต่แถวที่ 2 ลงไป\n\n' +
      'พิมพ์ชื่อเต็มพร้อมคำนำหน้าตำแหน่ง เช่น "ศ.นพ. สมชาย ใจดี"\n' +
      'เพราะข้อความนี้จะไปปรากฏในอีเมลถึงแพทย์ต้นทางแบบตรงตัว\n' +
      'ว่า "อาจารย์ผู้ให้คำปรึกษา: ..."\n\n' +
      'ลำดับใน dropdown เรียงตามลำดับแถวในชีต ระบบไม่เรียงใหม่ให้\n' +
      'อยากให้ท่านใดขึ้นก่อน ให้ย้ายแถวเอง',
    active:
      'เว้นว่างไว้ = ใช้งานอยู่ ไม่ต้องพิมพ์ yes\n\n' +
      'พิมพ์ "no" เมื่ออาจารย์ท่านนั้นไม่อยู่แล้ว จะซ่อนจาก dropdown\n\n' +
      '⚠️ อย่าลบแถวทิ้ง — เคสเก่ายังอ้างชื่อนั้นในคอลัมน์ advice_attending\n' +
      'ลบแล้วจะตามไม่ได้ว่าเคสไหนอาจารย์ท่านใดเป็นผู้ให้ความเห็น',
    note: 'บันทึกภายใน เช่น สาขาที่เชี่ยวชาญ — ระบบไม่ได้ใช้ค่าในคอลัมน์นี้',
  };

  NOTES[SHEETS.regimens] = {
    disease_group:
      'หัวข้อกลุ่มโรค — ใช้จัดกลุ่มใน dropdown อันแรกของตัวช่วยแทรกสูตรยา\n\n' +
      'พิมพ์ให้ตรงกันทุกแถวของกลุ่มเดียวกัน สะกดต่างกันแม้อักษรเดียว\n' +
      'จะกลายเป็นสองกลุ่มแยกกันใน dropdown',
    abbr: 'ชื่อย่อสูตรยา เช่น R-CHOP — เป็นข้อความที่แทรกลงในคำตอบ',
    components:
      'ยาที่ประกอบกัน เช่น "Rituximab + Cyclophosphamide + ..."\n' +
      'จะถูกแทรกต่อท้ายชื่อย่อในวงเล็บ',
    active: 'เว้นว่าง = ใช้งานอยู่ / พิมพ์ "no" เพื่อซ่อนจาก dropdown',
  };

  NOTES[SHEETS.config] = {
    key: 'ชื่อค่าที่ระบบใช้ — ห้ามแก้ ห้ามลบแถว โค้ดค้นหาด้วยข้อความนี้ตรง ๆ',
    value:
      'ค่าที่กรอกเอง อ่านคำอธิบายในคอลัมน์ถัดไปก่อนกรอก\n\n' +
      'ค่าที่ใส่ได้หลายคนให้คั่นด้วยจุลภาค เช่น central_admin_email\n' +
      'ระบบตัดช่องว่างและตัวซ้ำให้เอง',
    description: 'คำอธิบายจากระบบ — แก้ได้ ระบบไม่ได้ใช้ค่าในคอลัมน์นี้',
  };

  NOTES[SHEETS.indications] = {
    id:
      'รหัสอ้างอิงภายใน ห้ามซ้ำกัน และห้ามแก้หลังมีเคสใช้ไปแล้ว\n' +
      'เพราะเคสเก่าเก็บรหัสนี้ไว้ในคอลัมน์ transplant_indication',
    type: 'AUTOLOGOUS หรือ ALLOGENEIC เท่านั้น — ใช้แบ่งหัวข้อใน dropdown',
    disease: 'ชื่อโรค/ข้อบ่งชี้ที่แพทย์ต้นทางจะเห็นในรายการให้เลือก',
    disease_status: 'เกณฑ์สถานะโรค เว้นว่างได้ถ้าไม่มีเกณฑ์เฉพาะ',
    age: 'เกณฑ์อายุ เว้นว่างได้',
    active: 'เว้นว่าง = ใช้งานอยู่ / พิมพ์ "no" เพื่อซ่อนจาก dropdown',
  };

  let added = 0;

  Object.keys(NOTES).forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      console.warn('ข้ามแท็บ ' + sheetName + ' — ยังไม่มี ให้รัน setupSheets() ก่อน');
      return;
    }

    const map = headerMap_(sheet);
    Object.keys(NOTES[sheetName]).forEach(function (column) {
      if (!(column in map)) {
        console.warn('ข้ามคอลัมน์ ' + sheetName + '.' + column + ' — ไม่พบหัวตาราง');
        return;
      }
      // headerMap_() คืนดัชนีเริ่มที่ 0 ส่วน getRange() นับคอลัมน์เริ่มที่ 1
      // ต้องบวกหนึ่งเหมือนที่ setCell_() ทำ ไม่งั้นคอลัมน์แรกจะกลายเป็น 0 แล้วโยน error
      sheet.getRange(1, map[column] + 1).setNote(NOTES[sheetName][column]);
      added++;
    });
  });

  console.log('ติดคำอธิบายที่หัวคอลัมน์แล้ว ' + added + ' ช่อง');
  console.log('เอาเมาส์ชี้ที่หัวคอลัมน์ (มุมขวาบนมีสามเหลี่ยมดำ) เพื่ออ่าน');
}

/**
 * เตรียมโฟลเดอร์ไฟล์แนบ — ต้องรันครั้งเดียวหลังวาง Api.gs ที่มี DriveApp
 *
 * ⚠️ สำคัญกว่าการสร้างโฟลเดอร์คือ **การขออนุญาตเข้าถึง Drive**
 *
 * โค้ดเดิมไม่เคยแตะ Drive สคริปต์จึงยังไม่มีสิทธิ์นั้น พอ saveAdvice เรียก
 * DriveApp ครั้งแรกผ่าน Web App มันจะล้มด้วย error เรื่องสิทธิ์ทันที
 * และ Web App **ขึ้นหน้าต่างขออนุญาตไม่ได้** เพราะไม่มีคนนั่งอยู่หน้าจอ
 *
 * การกด Run ฟังก์ชันนี้จาก editor คือจังหวะเดียวที่ Google จะแสดงหน้าต่าง
 * ให้กด Allow ได้ — ข้ามขั้นนี้แล้วการแนบไฟล์จะพังทุกครั้งโดยไม่มีทางแก้จากฝั่งเว็บ
 */
function setupAttachmentFolder() {
  const folder = attachmentFolder_();

  console.log('โฟลเดอร์ไฟล์แนบพร้อมใช้งาน');
  console.log('  ชื่อ: ' + folder.getName());
  console.log('  id:   ' + folder.getId());
  console.log('  ลิงก์: ' + folder.getUrl());
  console.log('');
  console.log('เก็บ id ไว้ใน Script Properties → ATTACHMENT_FOLDER_ID แล้ว');
  console.log('ไฟล์ในโฟลเดอร์นี้จะถูกทิ้งลงถังขยะอัตโนมัติเมื่อเคสครบ ' +
    RETENTION_MONTHS + ' เดือน (ดู Retention.gs)');
}

function runSelfTest() {
  const problems = [];

  // ชีตครบไหม
  Object.keys(SHEETS).forEach(function (key) {
    const name = SHEETS[key];
    if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)) {
      problems.push(
        'ไม่พบชีต: ' + name +
        ' — ถ้ามีแท็บชื่อ "Sheet1" ที่หัวคอลัมน์ตรงกับแท็บนี้ ให้เปลี่ยนชื่อเป็น "' +
        name + '" (เกิดจากวาง Setup.gs โดยยังไม่ได้วาง Config.gs)'
      );
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

    // สิทธิ์ Drive — ถ้ายังไม่ได้ให้ การแนบไฟล์จะพังเงียบ ๆ ตอนใช้งานจริง
    // ตรวจที่นี่เพราะเป็นอย่างเดียวที่ Web App แก้เองไม่ได้ ต้องมีคนกด Allow
    try {
      const folderId = PropertiesService.getScriptProperties()
        .getProperty('ATTACHMENT_FOLDER_ID');
      if (!folderId) {
        problems.push(
          'ยังไม่ได้เตรียมโฟลเดอร์ไฟล์แนบ — ให้ Run ฟังก์ชัน setupAttachmentFolder() ' +
          'หนึ่งครั้งจาก editor เพื่อกด Allow ให้สิทธิ์ Drive ' +
          '(ถ้าข้ามขั้นนี้ การแนบไฟล์ในคำตอบจะล้มทุกครั้ง)'
        );
      } else {
        DriveApp.getFolderById(folderId); // โยน error ถ้าโฟลเดอร์หายหรือสิทธิ์หลุด
      }
    } catch (err) {
      problems.push('โฟลเดอร์ไฟล์แนบมีปัญหา: ' + err +
        ' — ให้ Run setupAttachmentFolder() ใหม่');
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
    'sendDailyBatch', 'sendFellowDailyBatch', 'anonymizeExpired', 'buildMonthlyStats',
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
  // ถามทุกกลุ่ม แต่อยู่ท้ายสุดของคำถามที่ยังใช้งาน เพราะเพิ่มทีหลัง
  //
  // Google แทรกคอลัมน์ของคำถามใหม่ "ถัดจากคำถามสุดท้ายที่ยังมีอยู่ในฟอร์ม"
  // ไม่ใช่ตามหน้าที่คำถามปรากฏ — คำถามนี้อยู่หน้า 2 แต่คอลัมน์มาอยู่ที่ 36
  // คอลัมน์กลุ่ม 4 ที่เป็นซากจากคำถามที่ลบไปแล้วจึงถูกดันไปทางขวาหนึ่งช่อง
  //
  // ⚠️ เพิ่มคำถามใหม่ครั้งหน้าจะเลื่อนอีก — ต้อง showHeaderRow() ก่อนเสมอ
  'insurance_scheme',
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
  'alert_level': 'none = ปกติ / yellow = ค้างเกิน 2 วันทำการ / red = เกิน 3 วันทำการ',
  'referral_type': 'กลุ่มที่ 2 = ขอความเห็นสูตรยา, กลุ่มที่ 3 = ขอส่งตัวมารับยา',
  // ไม่แสดง urgency แล้ว — ฟอร์มเลิกถาม เคสใหม่จึงว่างเสมอ
  // คอลัมน์ยังอยู่ในชีตเพื่อรักษาตำแหน่งและข้อมูลเก่า แต่ไม่ต้องให้อาจารย์เห็น
  'referrer_org': 'โรงพยาบาลต้นทาง',
  'referrer_name': 'ชื่อแพทย์ผู้ส่ง',
  'referrer_phone': 'เบอร์ติดต่อกลับ',
  'patient_age': 'อายุผู้ป่วย (ปี)',
  'patient_sex': 'เพศ',
  'insurance_scheme': 'สิทธิการรักษา — สูตรที่เบิกได้จริงอาจไม่ใช่สูตรที่ดีที่สุด',
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
