/**
 * คำนวณเวลาที่ใช้ไปและระดับการแจ้งเตือน (FR-013)
 *
 * ตั้ง trigger รายชั่วโมง — ฟังก์ชันจะข้ามการทำงานเองนอกเวลาทำการ
 * จึงไม่มีการแจ้งเตือนช่วงกลางคืนหรือวันหยุด
 */

function recalculateSla() {
  const holidays = loadHolidays_();
  const now = new Date();

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const rows = readRows_(sheet);
  if (rows.length === 0) return;

  const hoursCol = map['elapsed_business_hours'];
  const alertCol = map['alert_level'];
  if (hoursCol === undefined || alertCol === undefined) {
    throw new Error('ยังไม่มีคอลัมน์ elapsed_business_hours หรือ alert_level — รัน setupSheets() ก่อน');
  }

  // เขียนกลับทีเดียวเป็นช่วง เร็วกว่าเขียนทีละเซลล์มาก
  const hoursValues = [];
  const alertValues = [];

  rows.forEach(function (r) {
    const status = String(r['status'] || '');
    const submittedAt = toDate_(r['submitted_at'] || r['Timestamp']);

    if (!submittedAt) {
      hoursValues.push([r['elapsed_business_hours'] || 0]);
      alertValues.push([r['alert_level'] || 'none']);
      return;
    }

    // เคสที่จบแล้วให้หยุดนับที่เวลาปิด ไม่ใช่เวลาปัจจุบัน
    const endAt = isTerminal_(status) ? (toDate_(r['closed_at']) || submittedAt) : now;
    const hours = businessHoursBetween_(submittedAt, endAt, holidays);

    hoursValues.push([hours]);
    alertValues.push([alertLevelFor_(hours, status)]);
  });

  sheet.getRange(2, hoursCol + 1, hoursValues.length, 1).setValues(hoursValues);
  sheet.getRange(2, alertCol + 1, alertValues.length, 1).setValues(alertValues);
}

/**
 * ส่ง Red Alert ทันทีเมื่อเคสค้างครบ 3 วันทำการ
 *
 * ต่างจาก Yellow Alert ตรงที่ไม่รอรอบ 10:00 น. เพราะเป็นตาข่ายนิรภัยชั้นสุดท้าย
 * แต่ยังส่งเฉพาะในเวลาทำการ เพื่อไม่รบกวนนอกเวลา
 *
 * ส่งครั้งเดียวต่อเคส โดยบันทึกไว้ที่ red_alert_sent_at
 */
/**
 * ดูตัวอย่างข้อความเตือน admin โดยไม่ส่งเข้า LINE — กดจาก editor เพื่อพรีวิว
 * ผลออกใน Execution log (Ctrl+Enter แล้วดู log) ปลอดภัย ไม่รบกวนกลุ่มจริง
 */
function previewAdminAlert() {
  const text = buildAdminAlertMessage_(new Date(), false);
  Logger.log(text || '(ไม่มีเคสแดง/เหลือง — จะไม่ส่งข้อความ)');
  return text;
}

/** ชื่อผู้รับผิดชอบที่ต้องไปเตือน — assigned_to หรือ fellow_assigned (กลุ่ม 1) */
function responsibleName_(r) {
  const assigned = String(r['assigned_to'] || '').trim();
  if (assigned) return assigned;
  if (String(r['referral_type']).trim() === TYPES.transplant) {
    const fellow = String(r['fellow_assigned'] || '').trim();
    if (fellow) return fellow;
  }
  return 'ยังไม่มอบหมาย';
}

function sendRedAlert() {
  const holidays = loadHolidays_();
  const now = new Date();
  if (!isWithinBusinessHours_(now, holidays)) return;

  // markSent = true → ประทับ red_alert_sent_at จริง (โหมดส่งจริง)
  const message = buildAdminAlertMessage_(now, true);
  if (message) pushLineMessage_(message, 'red');
}

/**
 * ประกอบข้อความเตือน admin — คืน '' เมื่อไม่มีเคสแดง/เหลือง
 * markSent=false ใช้ตอนพรีวิว (ไม่แตะ red_alert_sent_at ไม่เขียน log)
 */
function buildAdminAlertMessage_(now, markSent) {
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const rows = readRows_(sheet);
  const hoursPerDay = BUSINESS.endHour - BUSINESS.startHour;

  // เคสเกินกำหนด (แดง) ที่ยังไม่เคยแจ้ง — แจ้งครั้งเดียวต่อเคส
  const overdue = rows.filter(function (r) {
    return !isTerminal_(r['status']) &&
      String(r['alert_level']) === 'red' && !r['red_alert_sent_at'];
  });

  // เคสใกล้ครบกำหนด (เหลือง = เหลือ < 1 วันทำการ) — แสดงทุกวันจนกว่าจะจบ/กลายเป็นแดง
  // ให้ admin เห็นล่วงหน้าก่อนเลยเดดไลน์ จะได้กระทุ้ง resident ทัน
  // (มติผู้ใช้ 5 ก.ย. 2569) ไม่ใช้ flag "แจ้งแล้ว" เพราะเป็นรายการเตือนรายวัน
  const nearDue = rows.filter(function (r) {
    return !isTerminal_(r['status']) && String(r['alert_level']) === 'yellow';
  });

  if (overdue.length === 0 && nearDue.length === 0) return '';

  let message = '📋 สรุปเคสที่ต้องเร่ง (สำหรับแอดมิน) ' + formatThaiDate_(now) + '\n';

  if (overdue.length > 0) {
    message += '\n🔴 เกินกำหนดแล้ว — ' + overdue.length + ' เคส\n';
    overdue.forEach(function (r) {
      const groupNo = GROUP_NUMBER[String(r['referral_type'])] || '-';
      const elapsed = parseFloat(r['elapsed_business_hours']) || 0;
      const days = Math.round((elapsed / hoursPerDay) * 10) / 10;
      message += '• ' + r['referral_id'] + ' · กลุ่ม ' + groupNo +
        ' · ค้าง ' + days + ' วันทำการ\n' +
        '   ผู้รับผิดชอบ: ' + responsibleName_(r) + '\n';
      if (markSent) {
        setCell_(sheet, map, r._row, 'red_alert_sent_at', now);
        logStatusChange_(r['referral_id'], r['status'], r['status'], 'system', 'ส่ง Red Alert');
      }
    });
  }

  if (nearDue.length > 0) {
    message += '\n🟠 ใกล้ครบกำหนด (เหลือ < 1 วันทำการ) — ' + nearDue.length + ' เคส\n';
    nearDue.forEach(function (r) {
      const groupNo = GROUP_NUMBER[String(r['referral_type'])] || '-';
      const elapsed = parseFloat(r['elapsed_business_hours']) || 0;
      const left = Math.round((ESCALATION.redHours - elapsed) * 10) / 10;
      message += '• ' + r['referral_id'] + ' · กลุ่ม ' + groupNo +
        ' · เหลือ ' + (left > 0 ? left : 0) + ' ชม.ทำการ\n' +
        '   ผู้รับผิดชอบ: ' + responsibleName_(r) + '\n';
    });
  }

  message += '\nกระทุ้ง resident ที่รับผิดชอบก่อนเลยกำหนด — เปิดดู:\n' + DASHBOARD_URL;
  return message;
}

function isWithinBusinessHours_(date, holidays) {
  if (!isWorkingDay_(date, holidays)) return false;
  const h = date.getHours();
  return h >= BUSINESS.startHour && h < BUSINESS.endHour;
}
