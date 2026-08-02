/**
 * การแจ้งเตือนผ่าน LINE
 *
 * ⚠️ ใช้ LINE Messaging API ไม่ใช่ LINE Notify
 *    LINE Notify ปิดให้บริการไปแล้วเมื่อ 31 มีนาคม 2568
 *    เอกสารข้อเสนอโครงการฉบับเดิมอ้างถึง LINE Notify จึงต้องปรับตามนี้
 *
 * ข้อความทุกฉบับมีเฉพาะ referral ID กลุ่ม สถานะ และลิงก์เท่านั้น
 * ห้ามใส่ข้อมูลผู้ป่วยลงใน LINE (PDPA-003)
 * ข้อยกเว้นเดียวคือการแจ้ง fellow กลุ่มที่ 1 ซึ่งอาจารย์อนุมัติให้ส่ง
 * เพศ อายุ และโรค ได้ เพราะไม่มีชื่อและ HN แล้ว
 */

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';

/**
 * ส่งข้อความเข้ากลุ่ม LINE
 * @param {string} text ข้อความ
 * @param {string} audience 'batch' = กลุ่ม resident, 'red' = แอดมินกลาง, 'fellow' = fellow
 */
function pushLineMessage_(text, audience) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  const targetKey = {
    batch: 'LINE_TARGET_RESIDENT',
    red: 'LINE_TARGET_ADMIN',
    fellow: 'LINE_TARGET_FELLOW',
  }[audience] || 'LINE_TARGET_RESIDENT';

  const target = props.getProperty(targetKey);

  if (!token || !target) {
    // ยังไม่ได้ตั้งค่า — บันทึก log ไว้แทนการส่ง เพื่อให้ทดสอบระบบได้ก่อนมี LINE OA
    console.log('[LINE ยังไม่ได้ตั้งค่า: ' + targetKey + '] ' + text);
    return;
  }

  const response = UrlFetchApp.fetch(LINE_PUSH_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      to: target,
      messages: [{ type: 'text', text: text.substring(0, 4900) }],
    }),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    console.error('ส่ง LINE ไม่สำเร็จ (' + code + '): ' + response.getContentText());
  }
}

/**
 * รอบแจ้งเตือนรวมวันละครั้ง เวลา 10:00 น. ของวันทำการ
 *
 * รวมเคสค้างทั้งหมดส่งเป็นข้อความเดียว โดยปักหมุด Yellow Alert ไว้บนสุด
 * ไม่มีการแจ้งเตือนนอกรอบนี้ เพื่อปกป้องเวลาเรียนของแพทย์ประจำบ้าน
 * (ยกเว้น Red Alert ซึ่งเป็นตาข่ายนิรภัยชั้นสุดท้าย)
 */
function sendDailyBatch() {
  const holidays = loadHolidays_();
  const now = new Date();
  if (!isWorkingDay_(now, holidays)) return;

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const rows = readRows_(sheet);

  const open = rows.filter(function (r) {
    return !isTerminal_(r['status']) && r['referral_id'];
  });

  if (open.length === 0) {
    pushLineMessage_(
      '☀️ สรุปเคสประจำวันที่ ' + formatThaiDate_(now) + '\nไม่มีเคสค้างดำเนินการ',
      'batch'
    );
    return;
  }

  const yellow = open.filter(function (r) { return String(r['alert_level']) === 'yellow'; });
  const red = open.filter(function (r) { return String(r['alert_level']) === 'red'; });

  const countByGroup = {};
  open.forEach(function (r) {
    const g = GROUP_NUMBER[String(r['referral_type'])] || '-';
    countByGroup[g] = (countByGroup[g] || 0) + 1;
  });

  let message = '☀️ สรุปเคสรอดำเนินการ ' + formatThaiDate_(now) + '\n';
  message += '────────────────\n';
  [1, 2, 3].forEach(function (g) {
    if (countByGroup[g]) message += 'กลุ่มที่ ' + g + ': ' + countByGroup[g] + ' เคส\n';
  });
  message += 'รวม ' + open.length + ' เคส\n';

  // ปักหมุดเคสที่ต้องรีบไว้บนสุดของรายการ
  if (red.length > 0) {
    message += '\n🚨 เกินกำหนดแล้ว ' + red.length + ' เคส\n';
    red.slice(0, 10).forEach(function (r) {
      message += '• ' + r['referral_id'] + ' (' + r['elapsed_business_hours'] + ' ชม.)\n';
    });
  }
  if (yellow.length > 0) {
    message += '\n⚠️ ใกล้ครบกำหนด ' + yellow.length + ' เคส\n';
    yellow.slice(0, 10).forEach(function (r) {
      message += '• ' + r['referral_id'] + ' (' + r['elapsed_business_hours'] + ' ชม.)\n';
    });
  }

  message += '\nเปิดดูรายละเอียด:\n' + DASHBOARD_URL;

  pushLineMessage_(message, 'batch');

  // บันทึกว่าแจ้ง Yellow ไปแล้ว เพื่อใช้ดูย้อนหลังว่าเคสถูกเตือนกี่รอบ
  const nowTs = new Date();
  yellow.forEach(function (r) {
    if (!r['yellow_alert_sent_at']) {
      setCell_(sheet, map, r._row, 'yellow_alert_sent_at', nowTs);
    }
  });
}

/**
 * แจ้ง fellow เมื่อมีผู้ป่วยนัดพบในวันที่ตนออกตรวจ (กลุ่มที่ 1)
 *
 * อาจารย์กำหนดให้ส่ง เพศ อายุ และโรค ได้ — ไม่มีชื่อและ HN
 */
function notifyFellow_(referral) {
  const message =
    '🧬 มีผู้ป่วยนัดพบท่าน\n' +
    'Referral ID: ' + referral['referral_id'] + '\n' +
    'วันนัด: ' + (referral['appointment_note'] || '-') + '\n' +
    'ผู้ป่วย: ' + (referral['patient_sex'] || '-') + ' อายุ ' + (referral['patient_age'] || '-') + ' ปี\n' +
    'การวินิจฉัย: ' + (referral['diagnosis'] || '-') + '\n' +
    'รายละเอียดเพิ่มเติม: ' + DASHBOARD_URL;

  pushLineMessage_(message, 'fellow');
}

/**
 * แจ้งผู้ดูแลระบบเมื่อพบว่าการตั้งค่าฟอร์มกับโค้ดไม่ตรงกัน
 *
 * ปัญหาแบบนี้ทำให้เคสหายจาก dashboard โดยไม่มีใครรู้ จึงต้องแจ้งทันที
 * ไม่รอรอบ 10:00 น. เพราะเป็นความผิดพลาดของระบบ ไม่ใช่ภาระงานปกติ
 */
function notifyConfigProblem_(detail) {
  pushLineMessage_(
    '🛠️ ระบบตั้งค่าไม่ตรงกัน\n' +
      detail.split('\n').slice(0, 2).join('\n') +
      '\nดูรายละเอียดใน Apps Script → Executions',
    'red'
  );
}

function formatThaiDate_(date) {
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + (date.getFullYear() + 543);
}
