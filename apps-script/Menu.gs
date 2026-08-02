/**
 * เมนูและหน้าจอกรอกตารางออกตรวจ fellow
 *
 * ทำไมอยู่ในชีตแทนที่จะอยู่ใน dashboard:
 * หน้าเว็บ dashboard อ่านชีตด้วย service account ที่มีสิทธิ์ Viewer เท่านั้น
 * ถ้าจะให้กรอกจากเว็บได้ต้องยกระดับเป็น Editor ซึ่งแปลว่า credential ที่หลุด
 * จะแก้หรือลบข้อมูลผู้ป่วยได้ทั้งไฟล์ ไม่ใช่แค่อ่าน
 *
 * หน้าจอนี้ทำงานใต้บัญชี Google ของผู้ที่เปิดชีตอยู่ จึงได้ฟอร์มกรอกที่สะดวก
 * โดยไม่ต้องเพิ่มสิทธิ์ให้ระบบใด ๆ
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📅 ตารางออกตรวจ Fellow')
    .addItem('เปิดหน้าจอจัดตาราง', 'showScheduleSidebar')
    .addSeparator()
    .addItem('อัปเดต dropdown ชื่อ fellow', 'refreshFellowDropdown')
    .addToUi();
}

function showScheduleSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('จัดตารางออกตรวจ Fellow')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ------------------------------------------------------------------ */
/* ฟังก์ชันที่หน้าจอเรียกใช้                                            */
/* ------------------------------------------------------------------ */

/** รายชื่อ fellow ที่ยังใช้งานอยู่ */
function listFellows() {
  const sheet = getSheet_(SHEETS.fellows);
  return readRows_(sheet)
    .filter(function (r) {
      const name = String(r['fellow_name'] || '').trim();
      if (!name) return false;
      const active = String(r['active'] || '').trim().toLowerCase();
      // เว้นว่างถือว่ายังใช้งาน — ต้องพิมพ์ no ถึงจะปิด
      return active !== 'no' && active !== 'ไม่' && active !== 'false';
    })
    .map(function (r) { return String(r['fellow_name']).trim(); });
}

/** เพิ่มชื่อ fellow ใหม่ คืนรายชื่อล่าสุด */
function addFellow(name) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('กรุณากรอกชื่อ');

  const existing = listFellows();
  if (existing.indexOf(clean) !== -1) {
    throw new Error('มีชื่อ "' + clean + '" อยู่แล้ว');
  }

  const sheet = getSheet_(SHEETS.fellows);
  sheet.appendRow([clean, 'yes', '']);
  applyScheduleValidation_(SpreadsheetApp.getActiveSpreadsheet());
  return listFellows();
}

/** ปิดการใช้งานชื่อ fellow (ไม่ลบทิ้ง เพราะตารางเก่ายังอ้างถึงอยู่) */
function deactivateFellow(name) {
  const sheet = getSheet_(SHEETS.fellows);
  const map = headerMap_(sheet);
  const rows = readRows_(sheet);

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]['fellow_name'] || '').trim() === String(name).trim()) {
      setCell_(sheet, map, rows[i]._row, 'active', 'no');
      break;
    }
  }
  applyScheduleValidation_(SpreadsheetApp.getActiveSpreadsheet());
  return listFellows();
}

/**
 * เพิ่มวันออกตรวจ รองรับการทำซ้ำรายสัปดาห์
 *
 * การกรอกตารางทั้งปีการศึกษาทีละวันเป็นงานที่ทรมาน ฟังก์ชันนี้จึงรับ
 * "ทำซ้ำทุกสัปดาห์อีกกี่ครั้ง" เพื่อสร้างทั้งเทอมได้ในครั้งเดียว
 *
 * ข้ามวันที่มีอยู่แล้วของ fellow คนเดิม เพื่อให้กดซ้ำได้โดยไม่เกิดแถวซ้ำ
 */
function addClinicDays(payload) {
  const fellowName = String(payload.fellowName || '').trim();
  const startDate = String(payload.startDate || '').trim();
  const slots = Number(payload.maxSlots) || FELLOW_DEFAULT_SLOTS;
  const repeatWeeks = Math.max(1, Math.min(52, Number(payload.repeatWeeks) || 1));
  const note = String(payload.note || '').trim();
  const startTime = cleanTime_(payload.startTime);
  const endTime = cleanTime_(payload.endTime);

  if (!fellowName) throw new Error('กรุณาเลือกชื่อ fellow');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
  if (startTime && endTime && endTime <= startTime) {
    throw new Error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
  }

  const sheet = getSheet_(SHEETS.fellowSchedule);
  const existing = {};
  readRows_(sheet).forEach(function (r) {
    const d = r['clinic_date'];
    const key = (d instanceof Date
      ? Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd')
      : String(d || '').trim()) + '|' + String(r['fellow_name'] || '').trim();
    existing[key] = true;
  });

  const parts = startDate.split('-').map(Number);
  const toAdd = [];
  let skipped = 0;

  for (let w = 0; w < repeatWeeks; w++) {
    const d = new Date(parts[0], parts[1] - 1, parts[2] + w * 7);
    const iso = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');

    if (existing[iso + '|' + fellowName]) { skipped++; continue; }
    toAdd.push({
      clinic_date: d,
      fellow_name: fellowName,
      max_slots: slots,
      note: note,
      start_time: startTime,
      end_time: endTime,
    });
  }

  if (toAdd.length > 0) {
    // เขียนตามชื่อหัวตาราง ไม่ใช่ตำแหน่งคงที่
    // เพราะคอลัมน์ใหม่ถูกเติมต่อท้าย ชีตเก่ากับชีตใหม่จึงเรียงไม่เหมือนกันได้
    const map = headerMap_(sheet);
    const width = sheet.getLastColumn();
    const rows = toAdd.map(function (item) {
      const row = new Array(width).fill('');
      Object.keys(item).forEach(function (column) {
        if (column in map) row[map[column]] = item[column];
      });
      return row;
    });

    const firstRow = sheet.getLastRow() + 1;
    sheet.getRange(firstRow, 1, rows.length, width).setValues(rows);

    // กันไม่ให้ Sheets แปลง "09:00" เป็นชนิดเวลาแล้วส่งกลับมาคนละรูปแบบ
    ['start_time', 'end_time'].forEach(function (column) {
      if (column in map) {
        sheet.getRange(firstRow, map[column] + 1, rows.length, 1).setNumberFormat('@');
      }
    });
    if ('clinic_date' in map) {
      sheet.getRange(2, map['clinic_date'] + 1, sheet.getLastRow() - 1, 1)
        .setNumberFormat('yyyy-mm-dd');
    }
  }

  return { added: toAdd.length, skipped: skipped };
}

/** รับเฉพาะ HH:mm — ค่าอื่นถือว่าไม่ได้ระบุเวลา */
function cleanTime_(value) {
  const raw = String(value || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : '';
}

/** สรุปวันออกตรวจของเดือนที่เลือก ให้หน้าจอแสดงว่ากรอกอะไรไปแล้ว */
function listClinicDays(yearMonth) {
  const sheet = getSheet_(SHEETS.fellowSchedule);
  const out = [];

  readRows_(sheet).forEach(function (r) {
    const d = r['clinic_date'];
    const iso = d instanceof Date
      ? Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd')
      : String(d || '').trim();
    const name = String(r['fellow_name'] || '').trim();
    if (!iso || !name) return;
    if (yearMonth && iso.indexOf(yearMonth) !== 0) return;

    out.push({ date: iso, fellow: name, slots: Number(r['max_slots']) || FELLOW_DEFAULT_SLOTS, row: r._row });
  });

  out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return out;
}

/** ลบวันออกตรวจหนึ่งแถว */
function removeClinicDay(rowNumber) {
  const sheet = getSheet_(SHEETS.fellowSchedule);
  sheet.deleteRow(Number(rowNumber));
  return true;
}
