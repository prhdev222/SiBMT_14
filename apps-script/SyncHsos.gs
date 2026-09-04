/**
 * ดึงตารางเวร Chief ประจำวอร์ดจากระบบ HSOS (hemato-elective) มาลงชีตอัตโนมัติ
 *
 * แหล่งข้อมูลจริงของเวร resident คือ HSOS — แอดมินกรอกที่นั่นที่เดียว
 * ระบบนี้ sync มาเก็บใน resident_schedule ทุกเช้า (trigger 05:00 ก่อนรอบ
 * แจ้งเตือน 10:00) เหตุที่ sync ลงชีตแทนการ query สดทุกครั้ง:
 *
 * 1. HSOS ล่มเมื่อไร ระบบ refer ยังใช้ตารางล่าสุดต่อได้ แค่เก่าลงหนึ่งวัน
 * 2. แก้ฉุกเฉินในชีตทับได้ทันที (sync รอบถัดไปจะเขียนตาม HSOS อีกครั้ง —
 *    การแก้ถาวรจึงต้องไปแก้ที่ HSOS)
 * 3. โค้ดที่อ่านตารางเวร (Notify.gs, OnFormSubmit.gs) ไม่ต้องรู้จัก HSOS เลย
 *
 * ใช้ API สาธารณะโหมด viewer ของ HSOS (public_view=1 — ปลายทางเดียวกับที่
 * หน้าเว็บเปิดดูโดยไม่ล็อกอิน) จึงไม่ต้องเก็บ token ใด ๆ และอ่านได้อย่างเดียว
 */

const HSOS_API = 'https://hsos-worker.uradev222.workers.dev/api';

/**
 * เมนู "SiBMT" บนแถบเมนูของ Google Sheet — ให้แอดมินกด sync ได้เอง
 * โดยไม่ต้องเปิด Apps Script editor (โผล่อัตโนมัติทุกครั้งที่เปิดชีต)
 *
 * ⚠️ หนึ่งโปรเจกต์มี onOpen ได้ตัวเดียว — ถ้าวันหลังอยากเพิ่มเมนูอื่น
 * ให้มาเพิ่ม addItem ในฟังก์ชันนี้ อย่าประกาศ onOpen ใหม่ที่ไฟล์อื่น
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SiBMT')
    .addItem('🔄 Sync เวรจาก HSOS ตอนนี้', 'syncFromMenu_')
    .addToUi();
}

/** ห่อ sync ให้รายงานผลเป็น popup — คนกดจากเมนูไม่เห็น Execution log */
function syncFromMenu_() {
  try {
    syncResidentScheduleFromHSOS();
    SpreadsheetApp.getUi().alert(
      'Sync เวรจาก HSOS เรียบร้อยแล้ว ✓\n\n' +
      'ดูผลได้ที่แท็บ resident_schedule และ residents'
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Sync ไม่สำเร็จ: ' + error + '\n\nตารางเดิมยังอยู่ครบ ลองใหม่อีกครั้งได้'
    );
  }
}

/**
 * sync ทั้งสองชีต — รันมือครั้งแรกเพื่อเติมตารางทันทีก็ได้
 *
 * resident_schedule: เขียนทับทั้งชีต (mirror ของ HSOS)
 * residents: เติมชื่อที่ยังไม่มีเท่านั้น ไม่ลบไม่แก้ของเดิม — เผื่อมีชื่อที่
 * แอดมินเพิ่มมือไว้นอกเหนือจากรายชื่อใน HSOS
 */
function syncResidentScheduleFromHSOS() {
  const shifts = fetchHsosChiefShifts_();

  if (shifts.length === 0) {
    // อย่าลบตารางเดิมทิ้งเมื่อดึงไม่ได้ — ตารางเก่ายังดีกว่าตารางว่าง
    console.error('ดึงเวรจาก HSOS ไม่ได้หรือว่างเปล่า — คงตารางเดิมไว้');
    return;
  }

  // mirror ลง resident_schedule
  const sheet = getSheet_(SHEETS.residentSchedule);
  const map = ensureColumns_(sheet, RESIDENT_SCHEDULE_COLUMNS);
  const width = sheet.getLastColumn();

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, width).clearContent();
  }

  const rows = shifts.map(function (s) {
    const row = new Array(width).fill('');
    // headerMap_/ensureColumns_ คืน index แบบเริ่มจาก 0 (ดู Util.gs)
    // ห้ามลบหนึ่งซ้ำ — เคยพลาดแล้วข้อมูลเลื่อนซ้ายทั้งตาราง (4 ก.ย. 2569)
    row[map['from_date']] = s.from;
    row[map['to_date']] = s.to;
    row[map['resident_name']] = s.name;
    return row;
  });
  sheet.getRange(2, 1, rows.length, width).setValues(rows);

  // เติมชื่อใหม่ลง residents (ไม่ลบของเดิม)
  const added = mergeHsosResidents_();

  console.log('sync สำเร็จ: เวร ' + rows.length + ' ช่วง, เพิ่มชื่อใหม่ ' +
    added + ' คน');
}

/**
 * ช่วงเวร Chief จาก HSOS — ดึงเดือนก่อน/นี้/หน้า เพราะช่วงเวรคร่อมเดือนได้
 * (เช่น 23 ส.ค.–19 ก.ย.) แล้วกรองซ้ำด้วย id
 */
function fetchHsosChiefShifts_() {
  const months = [-1, 0, 1].map(function (offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM');
  });

  const seen = {};
  const shifts = [];

  months.forEach(function (month) {
    let data;
    try {
      const res = UrlFetchApp.fetch(
        HSOS_API + '?action=chiefs&month=' + month + '&public_view=1',
        { muteHttpExceptions: true }
      );
      data = JSON.parse(res.getContentText());
    } catch (error) {
      console.error('เรียก HSOS เดือน ' + month + ' ไม่สำเร็จ: ' + error);
      return;
    }
    if (!data || !data.success || !Array.isArray(data.data)) return;

    data.data.forEach(function (entry) {
      const name = String(entry.chief_name || '').trim();
      const from = String(entry.date_from || '').trim();
      const to = String(entry.date_to || '').trim();
      if (!name || !from || !to || seen[entry.id]) return;
      seen[entry.id] = true;
      shifts.push({ from: from, to: to, name: name });
    });
  });

  shifts.sort(function (a, b) { return a.from.localeCompare(b.from); });
  return shifts;
}

/** เติมชื่อจาก HSOS ที่ยังไม่มีในชีต residents — คืนจำนวนที่เพิ่ม */
function mergeHsosResidents_() {
  let data;
  try {
    const res = UrlFetchApp.fetch(
      HSOS_API + '?action=chief_residents&public_view=1',
      { muteHttpExceptions: true }
    );
    data = JSON.parse(res.getContentText());
  } catch (error) {
    console.error('ดึงรายชื่อ resident จาก HSOS ไม่สำเร็จ: ' + error);
    return 0;
  }
  if (!data || !data.success || !Array.isArray(data.data)) return 0;

  const sheet = getSheet_(SHEETS.residents);
  const map = ensureColumns_(sheet, RESIDENT_COLUMNS);
  const existing = {};
  readRows_(sheet).forEach(function (r) {
    const name = String(r['name'] || '').trim();
    if (name) existing[name] = true;
  });

  let added = 0;
  data.data.forEach(function (person) {
    const name = String(person.name || '').trim();
    if (!name || existing[name]) return;
    if (Number(person.active) !== 1) return;
    const row = new Array(sheet.getLastColumn()).fill('');
    row[map['name']] = name; // index เริ่มจาก 0 เช่นกัน
    sheet.appendRow(row);
    existing[name] = true;
    added++;
  });
  return added;
}
