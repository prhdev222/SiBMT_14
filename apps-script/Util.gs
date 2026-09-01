/**
 * ฟังก์ชันช่วยเหลือทั่วไป — การเข้าถึงชีตแบบอิงชื่อคอลัมน์ และการนับเวลาทำการ
 *
 * หลักการ: เข้าถึงคอลัมน์ด้วย "ชื่อหัวตาราง" เสมอ ห้ามอิงเลขคอลัมน์
 * เพราะ Google Form จะแทรกคอลัมน์ใหม่เมื่อเพิ่มคำถาม ทำให้ลำดับเลื่อน
 */

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบชีตชื่อ "' + name + '" — ตรวจสอบ SHEETS ใน Config.gs');
  return sheet;
}

/** อ่านหัวตารางแถวแรก คืนเป็น map ชื่อคอลัมน์ → index (เริ่มที่ 0) */
function headerMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach(function (h, i) {
    const key = String(h).trim();
    if (key) map[key] = i;
  });
  return map;
}

/**
 * เพิ่มคอลัมน์ที่ยังไม่มีต่อท้ายชีต แล้วคืน headerMap ที่อัปเดตแล้ว
 * ใช้ตอนติดตั้งครั้งแรก เพราะคอลัมน์ที่ระบบสร้างเองไม่ได้มาจากฟอร์ม
 */
/**
 * ⚠️ ห้ามประกาศฟังก์ชันชื่อนี้ซ้ำในไฟล์อื่น
 *
 * Apps Script ใช้ scope เดียวกันทั้งโปรเจกต์ ชื่อซ้ำจะทับกันเงียบ ๆ ไม่มี error
 * เคยเกิดจริง — มีตัวซ้ำใน Setup.gs ที่ไม่คืนค่า ทำให้ onFormSubmit ได้ undefined
 * แล้วเคสที่ส่งเข้ามาไม่ได้ referral_id เลยทั้งที่แถวลงชีตครบ
 *
 * คืน header map เสมอ เพราะผู้เรียกใช้ต่อทันที
 */
function ensureColumns_(sheet, names) {
  let map = headerMap_(sheet);
  const missing = names.filter(function (n) { return !(n in map); });
  if (missing.length === 0) return map;

  const startCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  return headerMap_(sheet);
}

/** อ่านทุกแถวเป็น array ของ object โดยแนบเลขแถวจริงไว้ที่ _row */
function readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map(function (row, i) {
    const obj = { _row: i + 2 };
    headers.forEach(function (h, c) {
      const key = String(h).trim();
      if (key) obj[key] = row[c];
    });
    return obj;
  });
}

function setCell_(sheet, map, rowNumber, columnName, value) {
  if (!(columnName in map)) {
    throw new Error('ไม่พบคอลัมน์ "' + columnName + '" ในชีต ' + sheet.getName());
  }
  sheet.getRange(rowNumber, map[columnName] + 1).setValue(value);
}

/* ------------------------------------------------------------------ */
/* เวลาทำการ                                                           */
/* ------------------------------------------------------------------ */

/** อ่านรายการวันหยุดจากชีต คืนเป็น Set ของสตริง yyyy-MM-dd */
function loadHolidays_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.holidays);
  const set = {};
  if (!sheet || sheet.getLastRow() < 2) return set;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  values.forEach(function (r) {
    if (r[0] instanceof Date) {
      set[Utilities.formatDate(r[0], TIMEZONE, 'yyyy-MM-dd')] = true;
    } else if (r[0]) {
      set[String(r[0]).trim()] = true;
    }
  });
  return set;
}

function isWorkingDay_(date, holidays) {
  const day = date.getDay();
  if (BUSINESS.workingDays.indexOf(day) === -1) return false;
  const key = Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd');
  return !holidays[key];
}

function atHour_(date, hour) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * นับชั่วโมงทำการระหว่างสองเวลา (FR-013)
 *
 * นับเฉพาะ จันทร์–ศุกร์ 08:00–16:00 ไม่รวมวันหยุด
 * เคสที่ยื่นเย็นวันศุกร์จึงไม่ถูกนับเวลาข้ามเสาร์-อาทิตย์
 */
function businessHoursBetween_(start, end, holidays) {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0;
  if (end <= start) return 0;

  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  // กันลูปไม่รู้จบกรณีข้อมูลวันที่ผิดปกติ — จำกัดที่ 2 ปี
  let guard = 0;
  while (cursor < end && guard < 800) {
    guard++;
    if (isWorkingDay_(cursor, holidays)) {
      const dayStart = atHour_(cursor, BUSINESS.startHour);
      const dayEnd = atHour_(cursor, BUSINESS.endHour);
      const from = Math.max(start.getTime(), dayStart.getTime());
      const to = Math.min(end.getTime(), dayEnd.getTime());
      if (to > from) total += (to - from) / 3600000;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.round(total * 10) / 10;
}

function isTerminal_(status) {
  return TERMINAL_STATUSES.indexOf(String(status).trim()) !== -1;
}

function alertLevelFor_(hours, status) {
  if (isTerminal_(status)) return 'none';
  if (hours >= ESCALATION.redHours) return 'red';
  if (hours >= ESCALATION.yellowHours) return 'yellow';
  return 'none';
}

function toDate_(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** แปลงอายุเป็นช่วงอายุ เช่น 45 → "40–49" (ใช้ตอนถอดชื่อ) */
function ageBand_(age) {
  const n = Number(age);
  if (!isFinite(n) || n < 0) return '';
  const lo = Math.floor(n / 10) * 10;
  return lo + '–' + (lo + 9);
}

const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                         'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/**
 * วันที่ภาษาไทยพร้อม พ.ศ.
 *
 * ⚠️ ห้ามประกาศฟังก์ชันชื่อนี้ซ้ำในไฟล์อื่น — Apps Script มี global scope เดียว
 * ทั้งโปรเจกต์ ตัวที่โหลดทีหลังจะทับตัวแรกเงียบ ๆ โดยไม่ฟ้อง error
 * เคยเกิดมาแล้วจริง: Api.gs มีตัวที่รับสตริง ISO ส่วน Notify.gs มีตัวที่รับ Date
 * ตัวที่ชนะจะทำให้อีกฝั่งพังทันที (`iso.split is not a function` หรือ
 * `date.getDate is not a function`) และพังในที่ที่ไม่มีใครเห็น
 *
 * รับได้ทั้ง Date และสตริง "yyyy-MM-dd" เพราะทั้งสองแบบมีใช้จริงในระบบ
 *
 * @param {Date|string} value
 * @param {boolean} [long] แบบเต็ม "วันอังคารที่ 11 สิงหาคม 2569" — ใช้กับใบนัด
 *                         ที่คนต้องจำวันให้ได้ ค่าปกติคือแบบสั้น "11 ส.ค. 2569"
 *                         ซึ่งใช้ในข้อความ LINE ที่ต้องประหยัดพื้นที่
 */
function formatThaiDate_(value, long) {
  let d;
  if (value instanceof Date) {
    d = value;
  } else {
    const parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return String(value || '-');
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (isNaN(d.getTime())) return String(value || '-');

  const month = long ? TH_MONTHS_FULL[d.getMonth()] : TH_MONTHS_SHORT[d.getMonth()];
  const body = d.getDate() + ' ' + month + ' ' + (d.getFullYear() + 543);

  return long ? 'วัน' + TH_DAYS_FULL[d.getDay()] + 'ที่ ' + body : body;
}

function logStatusChange_(referralId, oldStatus, newStatus, changedBy, note) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.statusLog);
  if (!sheet) return;
  sheet.appendRow([new Date(), referralId, oldStatus, newStatus, changedBy, note || '']);
}

/**
 * อ่านค่าหนึ่งค่าจากชีต config — คืนสตริงว่างเมื่อไม่มี key นั้นหรืออ่านไม่ได้
 *
 * ไม่โยน error เพราะผู้เรียกทุกรายมีทางเลือกสำรองอยู่แล้ว
 * ค่าที่ยังไม่ได้กรอกในชีตไม่ควรทำให้คำสั่งทั้งคำสั่งล้ม
 */
function readConfigValue_(key) {
  try {
    const sheet = getSheet_(SHEETS.config);
    const rows = readRows_(sheet);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i]['key'] || '').trim() === key) {
        return String(rows[i]['value'] || '').trim();
      }
    }
  } catch (err) {
    console.warn('อ่าน config "' + key + '" ไม่สำเร็จ: ' + err);
  }
  return '';
}

/**
 * แยกรายชื่ออีเมลที่คั่นด้วยจุลภาค — ใช้กับ config ที่มีผู้รับได้หลายคน
 *
 * ตัดช่องว่างและตัวซ้ำออก และทิ้งค่าที่ไม่มี @ เพราะ MailApp จะโยน error
 * ทั้งฉบับถ้ามีที่อยู่ผิดรูปแบบปนอยู่แม้แค่ตัวเดียว — แอดมินคนอื่นก็จะไม่ได้รับไปด้วย
 */
function parseEmailList_(raw) {
  const seen = {};
  return String(raw || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) {
      if (!s || s.indexOf('@') === -1 || seen[s]) return false;
      seen[s] = true;
      return true;
    });
}

/**
 * รูปแบบกลางของเบอร์โทรสำหรับ "เทียบ" ว่าเป็นเบอร์เดียวกันไหม
 *
 * ⚠️ Google Sheets ตัดเลข 0 นำหน้าทิ้งเมื่อเก็บเบอร์เป็นตัวเลข
 *
 * เบอร์จากเว็บจองคิวถูกชีตตีความเป็นตัวเลข "0812345678" จึงกลายเป็น
 * "812345678" (9 หลัก) ในขณะที่คนกรอกย่อมพิมพ์เลข 0 มาด้วย (10 หลัก)
 * การเทียบแบบตรงตัวจึงไม่มีวันตรง — ทางกรอกเบอร์แทนลิงก์ของกลุ่มที่ 1
 * พังเงียบ ๆ ทั้งหมดเพราะเรื่องนี้ (พบ 31 ส.ค. 2569 จากข้อมูลจริงในชีต)
 *
 * วิธีเทียบ: เอาเฉพาะตัวเลข ตัด 0 นำหน้าทิ้ง แล้วใช้ 9 ตัวท้าย
 * ครอบคลุมทั้ง 0812345678 / 812345678 / +66812345678 ให้เป็นค่าเดียวกัน
 *
 * ⚠️ ใช้เทียบเท่านั้น ห้ามเอาค่านี้ไปเก็บหรือแสดงผล — มันไม่ใช่เบอร์ที่โทรได้
 */
function phoneKey_(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
    .slice(-9);
}
