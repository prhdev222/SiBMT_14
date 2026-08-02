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
};

/**
 * ตารางออกตรวจ fellow ไม่ได้อยู่ในไฟล์นี้
 *
 * ย้ายไปอยู่ Google Sheet คนละไฟล์ และเว็บเขียนลงไฟล์นั้นโดยตรง
 * เพื่อให้ service account เป็น Editor เฉพาะไฟล์ตารางเวร
 * ส่วนไฟล์นี้ซึ่งมีข้อมูลผู้ป่วยยังเป็น Viewer เหมือนเดิม
 * ดู docs/DEPLOYMENT.md §ไฟล์ชีตตารางเวร fellow
 */

/** เวลาทำการที่ใช้นับ SLA (FR-013) */
const BUSINESS = {
  startHour: 8,
  endHour: 16,
  workingDays: [1, 2, 3, 4, 5], // 1 = จันทร์ … 5 = ศุกร์
};

/** เกณฑ์การแจ้งเตือน (ชั่วโมงทำการ) */
const ESCALATION = {
  yellowHours: 24,
  redHours: 48,
};

/** รอบแจ้งเตือนรวมวันละครั้ง — ไม่มีช่องทางข้ามรอบโดยเจตนา */
const BATCH_HOUR = 10;

/** จำนวนวันย้อนหลังที่ใช้ตรวจเคสซ้ำ (FR-014) */
const DUPLICATE_WINDOW_DAYS = 30;

/** เก็บเคสไว้กี่เดือนหลังปิด ก่อนถอดชื่อย้ายเข้าคลัง (PDPA-005) */
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
const TYPE_FROM_FORM_LABEL = {
  'กลุ่มที่ 1 — ขอนัดพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด': TYPES.transplant,
  'กลุ่มที่ 2 — ขอความเห็นสูตรยาเคมีบำบัด': TYPES.regimen,
  'กลุ่มที่ 3 — ขอส่งตัวมาให้ยาเคมีบำบัด/ยากดภูมิ': TYPES.admission,
  'กลุ่มที่ 4 — Refer ผู้ป่วยนอกด้วยเหตุผลอื่น': TYPES.general,
};

const GROUP_NUMBER = {
  [TYPES.transplant]: 1,
  [TYPES.regimen]: 2,
  [TYPES.admission]: 3,
  [TYPES.general]: 4,
};

/** สถานะที่ถือว่าจบแล้ว หยุดนับ SLA — ตรงกับ isTerminal() ในโค้ดเว็บ */
const TERMINAL_STATUSES = [
  'Advice Sent',
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
  'appointment_note',
  'fellow_assigned',
  'assigned_to',
  'possible_duplicate_of',
];

/** คอลัมน์ของ advice_library ตามลำดับ */
const ADVICE_LIBRARY_COLUMNS = [
  'year',
  'referral_type',
  'disease_group',
  'age_band',
  'patient_sex',
  'diagnosis',
  'stage',
  'treatment_summary',
  'clinical_question',
  'advice_record',
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
  'urgency',
];

/** คอลัมน์จากฟอร์มที่มีเฉพาะบางกลุ่ม — ไม่บังคับว่าต้องมีครบ */
const FORM_COLUMNS_OPTIONAL = [
  'referrer_email',
  'consent_raw',
  // กลุ่ม 1
  'diagnosis_g1', 'disease_group_g1', 'treatment_summary_g1',
  'diagnosis_date_ym', 'disease_status', 'transplant_type',
  'sibling_available', 'documents_ready', 'preferred_period', 'additional_note',
  // กลุ่ม 2
  'diagnosis_g2', 'disease_group_g2', 'stage_g2', 'treatment_summary_g2',
  'key_labs', 'clinical_question_g2', 'comorbidity_g2',
  // กลุ่ม 3
  'diagnosis_g3', 'disease_group_g3', 'stage_g3', 'comorbidity_g3',
  'treatment_summary_g3', 'performance_status', 'admission_reason',
  'clinical_question_g3',
  // กลุ่ม 4
  'referral_reason', 'diagnosis_g4', 'refer_letter_ready',
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
  diagnosis: ['diagnosis_g1', 'diagnosis_g2', 'diagnosis_g3', 'diagnosis_g4'],
  disease_group: ['disease_group_g1', 'disease_group_g2', 'disease_group_g3'],
  stage: ['stage_g2', 'stage_g3'],
  treatment_summary: [
    'treatment_summary_g1', 'treatment_summary_g2', 'treatment_summary_g3',
  ],
  comorbidity: ['comorbidity_g2', 'comorbidity_g3'],
  clinical_question: ['clinical_question_g2', 'clinical_question_g3'],
};

/** URL ของ dashboard ที่แนบไปกับข้อความ LINE */
const DASHBOARD_URL = 'https://sibmt-refer.pages.dev/dashboard';

/** เบอร์ติดต่อสำรอง แสดงในข้อความตอบกลับอัตโนมัติ */
const CONTACT_PHONE = '02-419-9903';
