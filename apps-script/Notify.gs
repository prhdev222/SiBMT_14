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
const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

/**
 * ตอบกลับข้อความที่เพิ่งเข้ามา
 *
 * ต่างจาก push ตรงที่ใช้ replyToken แทน ID ปลายทาง จึงตอบได้โดยยังไม่รู้ว่า
 * ปลายทางคือใคร — เป็นเหตุผลที่ใช้ตัวนี้หา group ID ตอนตั้งค่าได้
 * และ reply ไม่นับโควตาข้อความของ LINE ด้วย
 *
 * replyToken ใช้ได้ครั้งเดียวและหมดอายุใน 1 นาที
 */
function replyLineMessage_(replyToken, text) {
  const token = PropertiesService.getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  if (!token || !replyToken) {
    console.log('[ตอบ LINE ไม่ได้ ยังไม่มี token] ' + text);
    return;
  }

  const response = UrlFetchApp.fetch(LINE_REPLY_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text.substring(0, 4900) }],
    }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    console.error('ตอบ LINE ไม่สำเร็จ (' + response.getResponseCode() + '): ' +
      response.getContentText());
  }
}

const LINE_TARGET_BY_AUDIENCE = {
  batch: 'LINE_TARGET_RESIDENT',
  red: 'LINE_TARGET_ADMIN',
  fellow: 'LINE_TARGET_FELLOW',
};

/**
 * ปลายทางสำรอง — ใช้เมื่อยังไม่ได้ตั้งปลายทางเฉพาะของกลุ่มนั้น
 *
 * มีไว้เพื่อให้เริ่มใช้งานได้ด้วยการตั้งค่าเพียงตัวเดียว
 * แอดมินแอด LINE OA เป็นเพื่อน พิมพ์ #id ในแชทตัวต่อตัว แล้วเอา userId
 * มาใส่ตัวนี้ ก็ได้รับครบทุกการแจ้งเตือนโดยไม่ต้องสร้างกลุ่มสักกลุ่ม
 *
 * ที่ต้องมีเพราะการเงียบสนิทเป็นค่าเริ่มต้นที่อันตราย — ระบบจะดูเหมือนทำงานปกติ
 * ทุกอย่าง ยกเว้นไม่มีใครรู้ว่ามีเคสค้าง ซึ่งเป็นสิ่งเดียวที่การแจ้งเตือนมีไว้ทำ
 */
const LINE_TARGET_FALLBACK = 'LINE_TARGET_ADMIN';

/**
 * ส่งข้อความเข้า LINE
 *
 * ปลายทางเป็น groupId หรือ userId ก็ได้ — LINE ไม่แยก ใช้ช่อง `to` เดียวกัน
 * จึงไม่จำเป็นต้องสร้างกลุ่มถ้ายังไม่พร้อม
 *
 * @param {string} text ข้อความ
 * @param {string} audience 'batch' = resident, 'red' = แอดมินกลาง, 'fellow' = fellow
 */
function pushLineMessage_(text, audience) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  const targetKey = LINE_TARGET_BY_AUDIENCE[audience] || LINE_TARGET_FALLBACK;
  let target = props.getProperty(targetKey);
  let message = text;

  if (!target && targetKey !== LINE_TARGET_FALLBACK) {
    target = props.getProperty(LINE_TARGET_FALLBACK);
    if (target) {
      // บอกให้รู้ว่าทำไมข้อความนี้ถึงมาถึงตัวเอง ไม่งั้นแอดมินจะงงว่าเกี่ยวอะไรด้วย
      // และจะไม่มีทางรู้เลยว่ายังตั้งค่าไม่ครบ
      message =
        '(ส่งถึงคุณเพราะยังไม่ได้ตั้ง ' + targetKey + ')\n' +
        '──────────\n' + text;
    }
  }

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
      messages: [{ type: 'text', text: message.substring(0, 4900) }],
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
 * แจ้ง fellow เมื่อมีผู้ป่วยจองคิวมาพบในวันที่ตนออกตรวจ (กลุ่มที่ 1)
 *
 * อาจารย์กำหนดให้ส่ง เพศ อายุ และโรค ได้ — ไม่มีชื่อและ HN จึงไม่ระบุตัวผู้ป่วย
 * นี่เป็นข้อยกเว้นเดียวของ PDPA-003 ข้อความ LINE อื่นห้ามมีข้อมูลผู้ป่วย
 *
 * ⚠️ ข้อจำกัดที่ยังแก้ไม่ได้: pushLineMessage_ ส่งไปที่ LINE_TARGET_FELLOW
 * ซึ่งเป็น group ID — fellow ทุกคนในกลุ่มเห็นข้อความนี้ ไม่ใช่เฉพาะคนที่ถูกจอง
 * ข้อความจึงต้องขึ้นชื่อ fellow ให้ชัดว่าเป็นคิวของใคร
 * การส่งถึงตัวบุคคลต้องรู้ userId ซึ่งต้องมี LINE Login + LIFF ก่อน
 *
 * @param {{referralId: string, clinicDate: string, fellowName: string,
 *          referrerOrg: string, patientSex: string, patientAge: string,
 *          diagnosis: string}} booking ผลจาก bookTransplantSlot_
 */
function notifyFellowOfBooking_(booking) {
  // การแจ้งเตือนล้มเหลวต้องไม่ทำให้การจองที่เขียนลงชีตแล้วกลายเป็นล้มเหลวตามไปด้วย
  // แพทย์ต้นทางได้เลขนัดไปแล้ว ถ้าโยน error ต่อ หน้าเว็บจะบอกว่าจองไม่สำเร็จทั้งที่สำเร็จ
  try {
    const message =
      '🧬 มีผู้ป่วยจองคิวมาพบ\n' +
      '────────────────\n' +
      'แพทย์ผู้ตรวจ: ' + (booking.fellowName || '-') + '\n' +
      'วันนัด: ' + formatThaiDate_(booking.clinicDate) + ' เวลา 08:00 น.\n' +
      'เลขที่อ้างอิง: ' + (booking.referralId || '-') + '\n' +
      'ส่งมาจาก: ' + (booking.referrerOrg || '-') + '\n' +
      'ผู้ป่วย: ' + (booking.patientSex || '-') +
        ' อายุ ' + (booking.patientAge || '-') + ' ปี\n' +
      'การวินิจฉัย: ' + (booking.diagnosis || '-') + '\n\n' +
      'รายละเอียดเพิ่มเติม: ' + DASHBOARD_URL;

    pushLineMessage_(message, 'fellow');
  } catch (err) {
    console.error(
      'แจ้ง fellow ไม่สำเร็จ (' + (booking && booking.referralId) + '): ' + err
    );
  }
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

// formatThaiDate_ ย้ายไปอยู่ที่ Util.gs แล้ว ดูคำเตือนเรื่องชื่อซ้ำที่นั่น
