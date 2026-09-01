/**
 * ค่าตั้งต้นทั้งหมดของระบบ — แก้ที่ไฟล์นี้ไฟล์เดียว
 *
 * ความลับ (LINE token, group id) ห้ามใส่ในไฟล์นี้
 * ให้ตั้งใน Project Settings → Script Properties แทน (ดู Setup.gs)
 */

const TIMEZONE = 'Asia/Bangkok';

/** ชื่อชีต — ต้องตรงกับที่สร้างไว้จริง */
const SHEETS = {
  referrals: 'referrals',          // ชุดที่ 1 — ชีตปลายทางของ Google Form
  adviceLibrary: 'advice_library', // ชุดที่ 2 — ถอดชื่อแล้ว เก็บถาวร
  statsMonthly: 'stats_monthly',   // ชุดที่ 3 — สถิติ เก็บถาวร
  statusLog: 'status_log',
  holidays: 'holidays',            // วันหยุด: คอลัมน์ A = วันที่
  config: 'config',                // ชื่อผู้รับผิดชอบและข้อความ แก้ได้โดยไม่ต้องแตะโค้ด
  indications: 'transplant_indications', // เกณฑ์ปลูกถ่าย แก้ได้เมื่อแนวทางเปลี่ยน
  regimens: 'chemo_regimens',      // คลังสูตรยา แก้/เพิ่ม/ลดได้เมื่อแนวทางเปลี่ยน
  attendings: 'attendings',        // รายชื่ออาจารย์ผู้ให้คำปรึกษา หมุนเวียนทุกปี
  lineLinks: 'line_links',         // แพทย์ต้นทางที่ผูกบัญชี LINE ไว้รับคำตอบ
  dashboardLogins: 'dashboard_logins', // ใครเข้า dashboard ด้วย LINE เมื่อไร
};

/**
 * คอลัมน์ของชีตบันทึกการเข้า dashboard
 *
 * ⚠️ ชีตนี้คือคำตอบของคำถาม "ใครเปิดดูข้อมูลผู้ป่วยเมื่อไร"
 * ซึ่งบัญชีรหัสผ่านที่ใช้ร่วมกันในวอร์ดตอบไม่ได้เลย ห้ามลบทิ้งเพื่อความสะอาด
 */
const DASHBOARD_LOGIN_COLUMNS = [
  'timestamp', 'line_user_id', 'display_name', 'group', 'result',
];

/**
 * ตารางออกตรวจ fellow ไม่ได้อยู่ในไฟล์นี้
 *
 * ย้ายไปอยู่ Google Sheet คนละไฟล์ และเว็บเขียนลงไฟล์นั้นโดยตรง
 * เพื่อให้ service account เป็น Editor เฉพาะไฟล์ตารางเวร
 * ส่วนไฟล์นี้ซึ่งมีข้อมูลผู้ป่วยยังเป็น Viewer เหมือนเดิม
 * ดู docs/DEPLOYMENT.md §ไฟล์ชีตตารางเวร fellow
 */

/**
 * ไฟล์แนบในคำตอบ เช่น protocol chemotherapy
 *
 * อัปโหลดขึ้น Drive แล้วส่ง "ลิงก์" ไปกับอีเมล ไม่ได้แนบไฟล์จริง
 * เพื่อให้ส่งไฟล์ใหญ่ได้และอีเมลไม่บวมจนตีกลับ (Gmail จำกัดไฟล์แนบ 25 MB)
 *
 * ⚠️ ไฟล์ตั้งเป็น "ผู้ที่มีลิงก์ → ผู้อ่าน" เพราะแพทย์ต้นทางไม่มีบัญชีของหน่วยงาน
 * ความปลอดภัยจึงอยู่ที่ลิงก์เดาไม่ได้ (Drive id 33 ตัวอักษร) แบบเดียวกับ manage_token
 * ด้วยเหตุนี้หน้าเว็บจึงเตือนชัดว่าห้ามแนบเอกสารที่มีชื่อหรือ HN ผู้ป่วย
 */
const ATTACHMENT = {
  folderName: 'SiBMT ไฟล์แนบคำตอบ',
  maxBytes: 10 * 1024 * 1024,
  /** ต้องตรงกับ ALLOWED_ATTACHMENT_TYPES ใน src/app/dashboard/review/actions.ts */
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

/** เวลาทำการที่ใช้นับ SLA (FR-013) */
const BUSINESS = {
  startHour: 8,
  endHour: 16,
  workingDays: [1, 2, 3, 4, 5], // 1 = จันทร์ … 5 = ศุกร์
};

/**
 * เกณฑ์การแจ้งเตือน (ชั่วโมงทำการ — วันละ 8 ชม. ตาม BUSINESS ด้านบน)
 *
 * ⚠️ ต้องตรงกับ ESCALATION_THRESHOLDS ใน src/lib/referral-types.ts
 *
 * เดิม 24/48 = 3/6 วันทำงาน ซึ่งยาวกว่าที่สื่อสารกับแพทย์ต้นทางไว้มาก
 * มติ 29 ส.ค. 2569 ให้กรอบตอบกลับเป็น 3 วันทำการนับจากวันที่ส่ง
 * ความล่าช้าจากรอบแจ้งเตือน 10:00 น. ถูกกลืนอยู่ในตัวเลขนี้แล้ว
 * — ส่งหลัง 10:00 ได้รับแจ้งเช้าวันรุ่งขึ้น ยังเหลือราวสองวันทำการ
 */
const ESCALATION = {
  yellowHours: 16, // 2 วันทำการ — เตือนล่วงหน้าหนึ่งวันเต็ม
  redHours: 24,    // 3 วันทำการ
};

/** รอบแจ้งเตือนรวมวันละครั้ง — ไม่มีช่องทางข้ามรอบโดยเจตนา */
const BATCH_HOUR = 10;

/**
 * นัดที่เหลืออีกกี่วันถือว่า "ใกล้" จนต้องแจ้ง fellow ทันที ไม่รอรอบ 10:00 น.
 *
 * การจองส่วนใหญ่เป็นวันข้างหน้าหลายสัปดาห์ รอรอบถัดไปจึงไม่เสียหาย
 * แต่ระบบเปิดให้จองวันนี้หรือพรุ่งนี้ได้ถ้ายังมีคิวว่าง — เคสแบบนั้นถ้ารอรอบ
 * fellow อาจรู้ตัวหลังผู้ป่วยมาถึงแล้ว ซึ่งทำลายเหตุผลเดียวของการแจ้งเตือนนี้
 * คือให้มีเวลาโทรถามข้อมูลจากแพทย์ต้นทางก่อนวันตรวจ
 */
const FELLOW_URGENT_DAYS = 2;

/** จำนวนวันย้อนหลังที่ใช้ตรวจเคสซ้ำ (FR-014) */
const DUPLICATE_WINDOW_DAYS = 30;

/**
 * เก็บเคสไว้กี่เดือนหลังจบ ก่อนถอดชื่อย้ายเข้าคลัง (PDPA-005)
 *
 * ⚠️ ตัวเลขเดียวสำหรับทุกกลุ่ม — สิ่งที่ต่างกันคือ "วันไหนคือวันที่เคสจบ"
 * ไม่ใช่ระยะเวลา (ดู isExpired_() ใน Retention.gs)
 *
 * เคยตั้งกลุ่มที่ 1 ไว้ 30 วันหลังวันนัด เพราะเคสจบจริงตั้งแต่วันที่ผู้ป่วยมาตรวจ
 * แต่มติอาจารย์ 30 ส.ค. 2569 ให้ใช้ตัวเลขเดียวกันทั้งระบบ — เรื่องนี้ต้องอธิบาย
 * ซ้ำหลายรอบ (ประกาศความเป็นส่วนตัว คำถามจาก DPO ปฐมนิเทศ resident ทุกปี)
 * กฎที่จำง่ายและพูดจบในประโยคเดียวมีค่ามากกว่าการเก็บสั้นลงอีกสิบเอ็ดเดือน
 */
const RETENTION_MONTHS = 12;

/**
 * ค่าที่ฟอร์มบันทึกในคอลัมน์ referral_type
 * ต้องตรงกับ src/lib/referral-types.ts
 */
const TYPES = {
  transplant: 'TRANSPLANT_APPOINTMENT',
  regimen: 'REGIMEN_CONSULT',
  admission: 'CHEMO_ADMISSION',
  general: 'GENERAL_OPD',
};

/** แปลงข้อความตัวเลือกในฟอร์ม → ค่าที่เก็บในชีต */
// เหลือแค่สองกลุ่มที่ยังใช้ฟอร์ม — กลุ่ม 1 จองคิวเองผ่านเว็บ
// กลุ่ม 4 ไปใช้ระบบนัดหมายของโรงพยาบาล
const TYPE_FROM_FORM_LABEL = {
  'กลุ่มที่ 2 — ขอความเห็นสูตรยาเคมีบำบัด': TYPES.regimen,
  'กลุ่มที่ 3 — ขอส่งตัวมาให้ยาเคมีบำบัด/ยากดภูมิ': TYPES.admission,
};

const GROUP_NUMBER = {
  [TYPES.transplant]: 1,
  [TYPES.regimen]: 2,
  [TYPES.admission]: 3,
  [TYPES.general]: 4,
};

/**
 * สถานะที่ทำให้คิวของ fellow ว่างกลับคืนมา
 *
 * ⚠️ แยกจาก TERMINAL_STATUSES โดยเจตนา อย่ารวมกัน — 'Appointment Confirmed'
 * เป็นสถานะจบเหมือนกัน แต่ยัง **กินคิวอยู่** เพราะผู้ป่วยจะมาตามนัดจริง
 * ถ้าเอา TERMINAL_STATUSES มาใช้นับคิว คิวที่จองแล้วจะกลายเป็นว่างทั้งหมด
 * แล้วระบบจะรับจองเกินโควตาโดยไม่มีอะไรเตือน
 *
 * ⚠️ ต้องตรงกับ SLOT_RELEASING_STATUSES ใน src/lib/referral-types.ts
 *    คนละ runtime แชร์ไฟล์กันไม่ได้ ถ้าแก้ที่นี่ต้องไปแก้ที่นั่นด้วย
 */
const SLOT_RELEASING_STATUSES = [
  'Rejected / Redirected',
  'Cancelled by Referrer',
];

/** สถานะที่ถือว่าจบแล้ว หยุดนับ SLA — ตรงกับ isTerminal() ในโค้ดเว็บ */
const TERMINAL_STATUSES = [
  'Advice Sent',
  'Cancelled by Referrer',
  'Readiness Visit Scheduled',
  'Appointment Confirmed',
  'Auto Replied',
  'Rejected / Redirected',
  'Closed',
];

/**
 * คอลัมน์ที่ต้องลบทิ้งตอนถอดชื่อ (PDPA-005)
 * เหลือไว้เฉพาะที่ไม่โยงกลับหาผู้ป่วยได้
 */
const IDENTIFYING_COLUMNS = [
  'referral_id',
  'referrer_org',
  'referrer_name',
  'referrer_phone',
  'referrer_email',
  'submitted_at',
  'consent_acknowledged_at',
  'closed_at',
  'document_links',
  // ลิงก์ไฟล์แนบเปิดได้ด้วยตัวมันเอง ถ้าหลุดเข้าคลังถาวรก็เท่ากับข้อมูลไม่ถูกถอด
  'advice_file_name',
  'advice_file_url',
  'appointment_note',
  'fellow_assigned',
  'assigned_to',
  'possible_duplicate_of',
];

/**
 * คอลัมน์ของ advice_library ตามลำดับ
 *
 * คลังนี้เก็บถาวร ไม่ถูกลบตามรอบ retention จึงเป็นชุดข้อมูลชุดเดียวที่ใช้
 * ย้อนดูได้ว่าเคสลักษณะเดียวกันเคยตอบไว้อย่างไร (ดู docs/SRS.md ชุดที่ 2)
 *
 * ⚠️ เพิ่มคอลัมน์ที่นี่ได้เฉพาะสิ่งที่ไม่ระบุตัวผู้ป่วย
 * ตัวที่ระบุตัวได้อยู่ใน IDENTIFYING_COLUMNS และ verifyLibraryHasNoIdentifiers()
 * จะจับได้ถ้าหลุดเข้ามา
 *
 * ⚠️ เพิ่มทีหลังไม่ย้อนหลัง — เคสที่ถอดชื่อไปแล้วจะไม่มีค่าในคอลัมน์ใหม่ตลอดไป
 * สิ่งที่คิดว่าจะได้ใช้วิเคราะห์ในอนาคตจึงต้องใส่ตั้งแต่วันนี้ ไม่ใช่วันที่จะใช้
 */
const ADVICE_LIBRARY_COLUMNS = [
  'year',
  'referral_type',
  'disease_group',
  'age_band',
  'patient_sex',
  'diagnosis',
  'stage',
  // โรคร่วมกับสิทธิการรักษาคือสองเหตุผลหลักที่ทำให้เลือกสูตรหนึ่งแทนอีกสูตร
  // — สูตรที่ถูกต้องทางวิชาการกับสูตรที่ผู้ป่วยเบิกได้จริงไม่ใช่อันเดียวกัน
  // ถ้าไม่เก็บไว้ คลังจะบอกได้แค่ "ตอบว่าอะไร" ไม่มีทางบอก "เพราะอะไร"
  'comorbidity',
  'insurance_scheme',
  'treatment_summary',
  'clinical_question',
  'advice_record',
  // สูตรยาที่เลือกจากคลัง เก็บเป็นรหัสย่อคั่นจุลภาค — นับสถิติได้โดยไม่ต้องแกะ
  // ข้อความอิสระ ซึ่งสะกดต่างกันได้สิบแบบสำหรับสูตรเดียวกัน
  'advice_regimens',
  // ประเภทคำถาม — เป็นตัวแปรต้นที่ตั้งใจจะใช้แยกกลุ่มในอนาคต
  // จึงต้องอยู่ในคลังถาวรตั้งแต่วันแรก ไม่ใช่ตอนที่จะเริ่มวิเคราะห์
  'advice_question_type',
  /*
   * เดือนที่เคสเข้ามา เช่น "2026-07" — ซ้ำกับ year โดยตั้งใจ
   *
   * year ยังอยู่เพื่อไม่ให้แถวที่ถอดชื่อไปก่อนหน้านี้อ่านไม่ออก และการมีทั้งคู่
   * ทำให้ทำ pivot รายปีกับรายเดือนได้โดยไม่ต้องแยกข้อความในสูตร
   *
   * ⚠️ ต่อท้ายเสมอ ห้ามแทรกกลางรายการ
   * ถ้าคลังมีข้อมูลอยู่แล้ว ensureLibraryHeader_() จะหยุดและให้คนเติมคอลัมน์เอง
   * — เติมช่องขวาสุดหนึ่งช่องทำได้ในสิบวินาที แต่ถ้าแทรกกลางต้องเลื่อนค่าทั้งตาราง
   */
  'year_month',
];

/**
 * คอลัมน์ที่มาจากฟอร์ม — ต้องเปลี่ยนหัวตารางในชีตให้ตรงกับชื่อเหล่านี้ด้วยมือ
 *
 * Google Form เขียนหัวคอลัมน์เป็น "ข้อความคำถาม" ภาษาไทย ไม่ใช่ชื่อ field
 * จึงต้องเปลี่ยนชื่อครั้งเดียวหลังเชื่อมฟอร์มกับชีต (ดู docs/SETUP_GUIDE.md ขั้นที่ 4)
 *
 * ⚠️ ถ้าแก้คำถามในฟอร์มภายหลัง Google อาจเขียนหัวคอลัมน์ทับ
 *    ให้รัน runSelfTest() ทุกครั้งหลังแก้ฟอร์ม เพื่อตรวจว่าหัวคอลัมน์ยังถูกต้อง
 */
const FORM_COLUMNS_REQUIRED = [
  'referral_type',
  'referrer_org',
  'referrer_name',
  'referrer_phone',
  'patient_age',
  'patient_sex',
  // ฟอร์มเลิกถามความเร่งด่วนแล้ว (ทุกเคสตอบใน 48 ชม.เท่ากัน) แต่คอลัมน์ต้องอยู่ต่อ
  //
  // ⚠️ ห้ามลบคอลัมน์นี้ในชีตเด็ดขาด — restoreFormHeaders() คืนชื่อ**ตามตำแหน่ง**
  // ลบแล้วคอลัมน์ที่อยู่ขวามือจะเลื่อนซ้ายทั้งหมด FORM_COLUMN_ORDER จะเพี้ยนทั้งแถว
  // และข้อมูลเก่าของเคสที่เคยระบุความเร่งด่วนไว้จะหายไปด้วย
  // จึงยังตรวจว่ามีอยู่ ทั้งที่เคสใหม่จะเว้นว่างเสมอ
  'urgency',
  // อีเมลเป็นช่องทางเดียวที่แพทย์ต้นทางได้รับรหัสอ้างอิง และรหัสนั้นคือสิ่งที่
  // ใช้เช็คสถานะกับบอท LINE ได้ ถ้าไม่กรอกอีเมลก็ไม่รู้รหัส และไม่ได้รับคำตอบ
  // เดิมเป็นช่อง "ถ้ามี" ซึ่งเว้นว่างได้ แล้วเคสนั้นก็เงียบหายไปจนต้องโทรตาม
  'referrer_email',
  // สูตรที่ถูกต้องทางวิชาการกับสูตรที่ผู้ป่วยเบิกได้จริงไม่ใช่อันเดียวกัน
  // ผู้ตอบต้องเห็นก่อนเลือกสูตร ไม่ใช่มารู้ตอนแพทย์ต้นทางโทรมาบอกว่าเบิกไม่ได้
  'insurance_scheme',
];

/** คอลัมน์จากฟอร์มที่มีเฉพาะบางกลุ่ม — ไม่บังคับว่าต้องมีครบ */
const FORM_COLUMNS_OPTIONAL = [
  'consent_raw',
  // กลุ่ม 2
  'diagnosis_g2', 'disease_group_g2', 'stage_g2', 'treatment_summary_g2',
  'key_labs', 'clinical_question_g2', 'comorbidity_g2',
  // กลุ่ม 3
  'diagnosis_g3', 'disease_group_g3', 'stage_g3', 'comorbidity_g3',
  'treatment_summary_g3', 'performance_status', 'admission_reason',
  'clinical_question_g3',
];

/**
 * คำถามที่ถามซ้ำในหลาย section — Google Form สร้างคอลัมน์แยกให้กลุ่มละ 1 คอลัมน์
 *
 * ระบบจะรวมค่าลงคอลัมน์กลางให้อัตโนมัติตอน onFormSubmit
 * เพราะหนึ่งเคสตอบได้กลุ่มเดียว จึงมีคอลัมน์เดียวที่มีค่าเสมอ
 *
 * ใช้วิธีให้ Apps Script เขียนค่า ไม่ใช้สูตรในชีต เพราะสูตรที่ลากไว้
 * จะไม่ติดไปกับแถวใหม่ที่ Google Form สร้างขึ้น ทำให้ข้อมูลหายเงียบ ๆ
 */
const MERGED_COLUMNS = {
  // กลุ่ม 1 และ 4 ไม่ใช้ฟอร์มแล้ว (มติอาจารย์ 2 ส.ค. 2569) คอลัมน์ _g1 และ _g4
  // จึงถูกลบออกจากชีต — กลุ่ม 1 เขียนลงคอลัมน์กลางโดยตรงตอนจองคิว
  diagnosis: ['diagnosis_g2', 'diagnosis_g3'],
  disease_group: ['disease_group_g2', 'disease_group_g3'],
  stage: ['stage_g2', 'stage_g3'],
  treatment_summary: ['treatment_summary_g2', 'treatment_summary_g3'],
  comorbidity: ['comorbidity_g2', 'comorbidity_g3'],
  clinical_question: ['clinical_question_g2', 'clinical_question_g3'],
};

/**
 * ที่อยู่ของเว็บ — แก้ที่เดียวพอ
 *
 * เป็น Cloudflare **Worker** ไม่ใช่ Pages โดเมนจึงเป็น workers.dev
 * ถ้าวันหลังผูกโดเมนของภาควิชา ให้แก้บรรทัดเดียวนี้แล้ว deploy เวอร์ชันใหม่
 * (อย่าลืมแก้ API_VERSION ใน Api.gs ด้วย ไม่งั้นแยกไม่ออกว่า deploy ติดหรือยัง)
 */
const SITE_URL = 'https://sibmt-refer.uradev222.workers.dev';

/** URL ของ dashboard ที่แนบไปกับข้อความ LINE และอีเมลทุกฉบับ */
const DASHBOARD_URL = SITE_URL + '/dashboard';

/** basic ID ของ LINE OA — ต้องตรงกับ LINE_OA ใน src/lib/config.ts */
const LINE_OA_ID = '@900eojoi';

/** เบอร์ติดต่อสำรอง แสดงในข้อความตอบกลับอัตโนมัติ */
const CONTACT_PHONE = '02-419-7642 ถึง 44 ต่อ 104-105';
