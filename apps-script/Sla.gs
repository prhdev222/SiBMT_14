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
function sendRedAlert() {
  const holidays = loadHolidays_();
  const now = new Date();
  if (!isWithinBusinessHours_(now, holidays)) return;

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const rows = readRows_(sheet);

  const pending = rows.filter(function (r) {
    if (isTerminal_(r['status'])) return false;
    if (String(r['alert_level']) !== 'red') return false;
    return !r['red_alert_sent_at'];
  });

  if (pending.length === 0) return;

  pending.forEach(function (r) {
    const groupNo = GROUP_NUMBER[String(r['referral_type'])] || '-';
    const message =
      '🚨 RED ALERT — เคสค้างเกินกรอบเวลา\n' +
      'Referral ID: ' + r['referral_id'] + '\n' +
      'กลุ่มที่: ' + groupNo + '\n' +
      'ค้างมาแล้ว: ' + r['elapsed_business_hours'] + ' ชั่วโมงทำการ\n' +
      'กรุณาเข้าตรวจสอบโดยด่วน\n' +
      DASHBOARD_URL;

    pushLineMessage_(message, 'red');
    setCell_(sheet, map, r._row, 'red_alert_sent_at', now);
    logStatusChange_(r['referral_id'], r['status'], r['status'], 'system', 'ส่ง Red Alert');
  });
}

function isWithinBusinessHours_(date, holidays) {
  if (!isWorkingDay_(date, holidays)) return false;
  const h = date.getHours();
  return h >= BUSINESS.startHour && h < BUSINESS.endHour;
}
