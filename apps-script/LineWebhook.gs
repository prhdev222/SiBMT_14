/**
 * ทุกอย่างที่เกิดขึ้นเมื่อมีคนพิมพ์หาบอท LINE
 *
 * แยกออกมาจาก Api.gs ตามที่ตั้งใจไว้ตั้งแต่ตอนเขียน doPost — doPost มีหน้าที่
 * แค่ดูว่า request มาจาก LINE หรือจาก dashboard แล้วส่งต่อ ไม่ต้องรู้ว่า
 * บอทตอบอะไรบ้าง
 *
 * ## ทำไมบอทถึงตอบได้โดยไม่ต้องรู้ว่าใครถาม
 *
 * การ push ข้อความหาใครสักคนต้องรู้ `userId` ของเขา ซึ่งระบบไม่มีทางรู้
 * (ดู ARCHITECTURE.md §7 ช่องว่างที่ 2) แต่การ **ตอบกลับ** ใช้ `replyToken`
 * ที่ LINE แนบมากับข้อความที่เขาพิมพ์เข้ามา ใช้ได้ครั้งเดียว หมดอายุใน 1 นาที
 *
 * แปลว่าแพทย์ต้นทางเช็คสถานะเคสเองได้ในแอปที่เขาใช้อยู่แล้ว
 * โดยระบบ **ไม่ต้องเก็บ LINE ID ของใครไว้เลย** — เป็นทางเลือกที่ตั้งใจ
 * เพื่อไม่ให้ขอบเขตข้อมูลส่วนบุคคลที่ระบบถือครองกว้างขึ้นโดยไม่จำเป็น
 *
 * ถ้าวันหนึ่งอยากให้ระบบยิงแจ้งเตือนหาแพทย์เองได้ จุดที่ต้องแก้คือเก็บ
 * `event.source.userId` ผูกกับ referral_id ตรงที่ค้นเคสเจอ — ไม่ต้องทำ LIFF
 * เพราะ userId มากับ webhook นี้อยู่แล้ว
 */

/**
 * รูปแบบรหัสอ้างอิงที่บอทรับรู้ — ตรงกับ generateReferralId_() ใน OnFormSubmit.gs
 *
 * จับจากข้อความทั้งก้อน ไม่ได้บังคับให้พิมพ์รหัสเดี่ยว ๆ เพราะคนส่วนใหญ่
 * ก๊อปมาทั้งบรรทัดจากอีเมล เช่น "รหัสอ้างอิง (Referral ID): HEM-20260822-0001"
 *
 * (?!\d) ท้ายรูปแบบสำคัญกว่าที่เห็น — ถ้าไม่มี การพิมพ์เกินหนึ่งตัวอย่าง
 * "HEM-20260822-00019" จะถูกตัดให้เหลือ "HEM-20260822-0001" แล้วบอทจะตอบ
 * สถานะของ "คนละเคส" ด้วยความมั่นใจ แพทย์ที่พิมพ์ผิดจะเข้าใจว่านั่นคือเคสตัวเอง
 * การตอบว่าไม่พบเสียหายน้อยกว่าการตอบผิดเคสมาก
 */
const LINE_REFERRAL_ID_PATTERN = /HEM-\d{8}-\d{4}(?!\d)/i;

/**
 * รูปแบบหลวม ๆ ที่ "ดูเหมือนจะพยายามพิมพ์รหัส" แต่ผิดรูป
 *
 * มีไว้เพื่อไม่ให้บอทเงียบใส่คนที่พิมพ์ผิด — เงียบแปลว่าไม่รู้ว่าบอทได้ยินหรือไม่
 * แล้วก็จะพิมพ์ซ้ำอีกหลายรอบ ตอบว่ารูปแบบไม่ถูกต้องพร้อมตัวอย่างจบเรื่องได้เร็วกว่า
 */
const LINE_REFERRAL_ID_LOOSE = /HEM[-\s]?[\d-]{4,}/i;

/**
 * คำแปลสถานะเป็นภาษาไทย
 *
 * ⚠️ ต้องตรงกับ STATUS_LABEL_TH ใน src/lib/referral-types.ts
 *    Apps Script กับเว็บคนละ runtime แชร์ไฟล์กันไม่ได้ จึงต้องคัดลอก
 *    ถ้าเพิ่มสถานะใหม่ในเว็บแล้วลืมตรงนี้ บอทจะตอบเป็นภาษาอังกฤษ
 *    ซึ่งอ่านออกอยู่ ไม่ถึงกับพัง
 */
const LINE_STATUS_LABEL_TH = {
  'Submitted': 'ส่งข้อมูลแล้ว',
  'Pending Review': 'รอตรวจความครบถ้วน',
  'Incomplete': 'ข้อมูลไม่ครบ',
  'Slot Reserved': 'จองคิว fellow แล้ว',
  'Awaiting Attending': 'รออาจารย์อนุมัติ',
  'Advice Sent': 'ส่งคำแนะนำกลับแล้ว',
  'Readiness Visit Scheduled': 'นัดประเมินความพร้อมแล้ว',
  'Appointment Confirmed': 'ยืนยันวันนัดแล้ว',
  'Auto Replied': 'ระบบตอบกลับอัตโนมัติแล้ว',
  'Rejected / Redirected': 'ไม่เข้าเกณฑ์ / ส่งต่อช่องทางอื่น',
  'Closed': 'ปิดเคสแล้ว',
};

/**
 * คำที่พิมพ์ในแชทแล้วบอทจะตอบกลับด้วย ID ของห้องนั้น
 *
 * มีไว้ตอนตั้งค่าเท่านั้น — การส่งข้อความเข้ากลุ่มต้องรู้ groupId ล่วงหน้า
 * แต่ groupId ไม่มีให้ดูที่ไหนในแอป LINE เลย ต้องดักจาก webhook อย่างเดียว
 * เดิมต้องไปนั่งไล่อ่าน Executions ใน Apps Script ซึ่งหายากและพิมพ์ผิดง่าย
 * แบบนี้พิมพ์ในกลุ่มแล้วคัดลอกจากข้อความที่บอทตอบได้เลย
 *
 * ปลอดภัยพอ: ตอบเฉพาะ ID ของห้องที่คนถามอยู่แล้ว ไม่ได้บอกอะไรที่คนนอกไม่รู้
 * และไม่แตะชีตเลย
 */
const LINE_WHOAMI_KEYWORD = '#id';

/** จำนวนครั้งที่ค้นสถานะได้ต่อหนึ่งคู่สนทนา ต่อหนึ่งชั่วโมง */
const LINE_LOOKUP_LIMIT_PER_HOUR = 20;

function handleLineWebhook_(body) {
  (body.events || []).forEach(function (event) {
    try {
      handleLineEvent_(event);
    } catch (err) {
      // ข้อความเดียวพังต้องไม่ทำให้ทั้ง batch พัง และต้องไม่ตอบ non-200
      // กลับไปหา LINE เพราะ LINE จะหยุดส่ง webhook ถ้าปลายทางล้มบ่อย
      console.error('LINE event error: ' + err);
    }
  });

  return ContentService.createTextOutput('OK');
}

function handleLineEvent_(event) {
  const source = event.source || {};
  // groupId/roomId/userId มาไม่พร้อมกัน ขึ้นกับว่าเป็นแชทกลุ่ม ห้อง หรือตัวต่อตัว
  const id = source.groupId || source.roomId || source.userId || '(ไม่มี)';
  console.log(
    'LINE source: ' + (source.type || '?') + ' ' + id + ' | event: ' + event.type,
  );

  const text = event.message && event.message.type === 'text'
    ? String(event.message.text || '').trim()
    : '';
  if (!text) return;

  if (text === LINE_WHOAMI_KEYWORD) {
    replyLineMessage_(event.replyToken, buildWhoAmIReply_(source.type, id));
    return;
  }

  // ค้นสถานะเฉพาะแชทตัวต่อตัว
  //
  // ในกลุ่ม resident มีรหัสอ้างอิงลอยอยู่เต็มไปหมดจากรอบแจ้งเตือน 10:00 น.
  // ถ้าบอทตอบทุกครั้งที่มีคนอ้างถึงรหัส กลุ่มจะเต็มไปด้วยข้อความบอท
  // ซึ่งขัดกับ Time-Protected UI/UX ที่ทั้งระบบยึดถืออยู่
  // และคนในกลุ่มเปิด dashboard ดูได้อยู่แล้ว ต่างจากแพทย์ต้นทาง
  if (source.type !== 'user') return;

  const matched = text.match(LINE_REFERRAL_ID_PATTERN);
  if (!matched) {
    // พิมพ์รหัสมาแต่ผิดรูป — บอกรูปแบบให้ ไม่ปล่อยเงียบ
    if (LINE_REFERRAL_ID_LOOSE.test(text)) {
      replyLineMessage_(event.replyToken, buildBadFormatReply_());
    }
    return;
  }

  if (!lineLookupAllowed_(id)) {
    replyLineMessage_(
      event.replyToken,
      'ค้นสถานะบ่อยเกินไป กรุณารออีกสักครู่แล้วลองใหม่\n\n' +
      'ถ้าเร่งด่วน โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:00-16:00 น.)',
    );
    return;
  }

  const referralId = matched[0].toUpperCase();
  const found = lookupReferralForLine_(referralId);
  replyLineMessage_(event.replyToken, buildStatusReply_(referralId, found));
}

/**
 * ค้นเคสจากรหัสอ้างอิง คืน object เท่าที่บอกทาง LINE ได้ หรือ null ถ้าไม่พบ
 *
 * คืนเฉพาะ 3 ค่าที่ PDPA-003 อนุญาตให้อยู่ใน LINE ได้ ไม่คืนทั้งแถว
 * เพื่อไม่ให้ผู้เรียกใช้ในอนาคตเผลอเอาข้อมูลผู้ป่วยไปใส่ข้อความ
 */
function lookupReferralForLine_(referralId) {
  const sheet = getSheet_(SHEETS.referrals);
  const rows = readRows_(sheet);

  const match = rows.filter(function (r) {
    return String(r['referral_id'] || '').trim().toUpperCase() === referralId;
  })[0];
  if (!match) return null;

  return {
    status: String(match['status'] || '').trim(),
    referralType: String(match['referral_type'] || '').trim(),
    // ต้องเผื่อ 'Timestamp' ด้วย และต้องผ่าน toDate_() เหมือนที่ Sla.gs, Stats.gs,
    // Retention.gs และ OnFormSubmit.gs ทำ — ชีตนี้เกิดจาก Google Form ซึ่งตั้งชื่อ
    // คอลัมน์เวลาว่า 'Timestamp' และ restoreFormHeaders() จะเปลี่ยนเป็น
    // 'submitted_at' ก็ต่อเมื่อมีคนรัน ส่วนค่าในเซลล์ก็เป็นสตริงได้ถ้าถูกวางทับ
    // ทั้งสองกรณีทำให้บรรทัด "ส่งเมื่อ" หายไปเงียบ ๆ โดยไม่มีใครรู้
    submittedAt: toDate_(match['submitted_at'] || match['Timestamp']),
  };
}

/**
 * ข้อความตอบกลับ — มีแค่รหัส กลุ่ม สถานะ และวันที่ส่ง
 *
 * ⚠️ ห้ามใส่ข้อมูลผู้ป่วยหรือเนื้อคำแนะนำของอาจารย์ลงในนี้ (PDPA-003)
 *    คำแนะนำเป็นเนื้อหาทางคลินิก ส่งทางอีเมลอย่างเดียว ตรงนี้บอกได้แค่ว่าส่งแล้ว
 *
 * รหัสอ้างอิงเดาได้ (HEM-วันที่-ลำดับ ไล่จาก 0001) จึงตั้งใจให้คำตอบ
 * ไม่มีอะไรที่คนเดาถูกแล้วได้ประโยชน์ — รู้แค่ว่ามีเคสกลุ่มไหนสถานะอะไร
 * ไม่รู้ว่าเป็นผู้ป่วยคนไหน มาจากโรงพยาบาลใด หรือใครเป็นคนส่ง
 */
function buildStatusReply_(referralId, found) {
  if (!found) {
    return (
      'ไม่พบเคสรหัส ' + referralId + '\n\n' +
      'กรุณาตรวจว่าพิมพ์ครบถ้วนตามที่ได้รับทางอีเมล\n' +
      'รูปแบบคือ HEM-ปีเดือนวัน-เลขลำดับ เช่น HEM-20260822-0001\n\n' +
      'ถ้ายังไม่พบ โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:00-16:00 น.)'
    );
  }

  const groupNo = GROUP_NUMBER[found.referralType] || '-';
  const statusTh = LINE_STATUS_LABEL_TH[found.status] || found.status || 'ไม่ทราบสถานะ';

  let message =
    'เคส ' + referralId + '\n' +
    'กลุ่มที่: ' + groupNo + '\n' +
    'สถานะ: ' + statusTh + '\n';

  // ใช้ formatThaiDate_() ของโปรเจกต์ ไม่ใช่ Utilities.formatDate ดิบ
  // เพราะตัวหลังให้ ค.ศ. ซึ่งทั้งระบบไม่ได้ใช้เลย
  // toDate_() คืน null ถ้าแปลงไม่ได้ จึงยังต้องเช็คก่อนใช้
  if (found.submittedAt) {
    message += 'ส่งเมื่อ: ' + formatThaiDate_(found.submittedAt) + ' ' +
      Utilities.formatDate(found.submittedAt, TIMEZONE, 'HH:mm') + ' น.\n';
  }

  message += '\n';

  if (found.status === 'Advice Sent') {
    message += 'ทีมงานส่งคำแนะนำกลับทางอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย\n' +
      '(รวมถึงโฟลเดอร์จดหมายขยะ)\n\n';
  } else if (isTerminal_(found.status)) {
    message += 'เคสนี้ดำเนินการเสร็จแล้ว รายละเอียดส่งทางอีเมลแล้ว\n\n';
  } else {
    message += 'ทีมงานรับเรื่องในรอบประจำวันเวลา 10:00 น. ของวันทำการ\n' +
      'และตอบกลับภายใน 48 ชั่วโมงทำการ\n\n';
  }

  message += 'สอบถามเพิ่มเติม โทร ' + CONTACT_PHONE +
    ' (จันทร์-ศุกร์ 08:00-16:00 น.)';

  return message;
}

/** พิมพ์รหัสมาแต่รูปแบบไม่ถูก — บอกรูปแบบที่ถูกต้อง ไม่ต้องแตะชีต */
function buildBadFormatReply_() {
  return (
    'รูปแบบรหัสอ้างอิงไม่ถูกต้อง\n\n' +
    'รูปแบบคือ HEM-ปีเดือนวัน-เลขลำดับ 4 หลัก\n' +
    'เช่น HEM-20260822-0001\n\n' +
    'กรุณาคัดลอกมาจากอีเมลที่ระบบส่งให้ทั้งบรรทัดได้เลย\n\n' +
    'ถ้ายังไม่ได้ โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:00-16:00 น.)'
  );
}

/**
 * จำกัดจำนวนครั้งที่ค้นได้ต่อคู่สนทนา
 *
 * รหัสอ้างอิงเดาได้ การไล่ยิงทีละพันรหัสจึงเป็นไปได้ในทางเทคนิค
 * ตัวนี้ทำให้ทำไม่คุ้ม โดยไม่รบกวนแพทย์ที่ถามตามปกติวันละไม่กี่ครั้ง
 *
 * ใช้ CacheService ไม่ใช่ชีต เพราะไม่อยากให้การเช็คสถานะเขียนอะไรลงชีตเลย
 * ข้อแลกเปลี่ยน: cache หายได้เอง ตัวนับจึงรีเซ็ตเร็วกว่ากำหนดในบางกรณี
 * ซึ่งรับได้ เพราะนี่เป็นตัวลดแรงจูงใจ ไม่ใช่ด่านความปลอดภัยชั้นเดียว
 */
function lineLookupAllowed_(sourceId) {
  const cache = CacheService.getScriptCache();
  const key = 'line_lookup_' + sourceId;

  const current = parseInt(cache.get(key) || '0', 10);
  if (current >= LINE_LOOKUP_LIMIT_PER_HOUR) return false;

  cache.put(key, String(current + 1), 3600);
  return true;
}

/** ข้อความบอก ID พร้อมบอกว่าต้องเอาไปวางที่ Script Property ตัวไหน */
function buildWhoAmIReply_(sourceType, id) {
  const target = {
    group: 'LINE_TARGET_RESIDENT หรือ LINE_TARGET_ADMIN หรือ LINE_TARGET_FELLOW\n' +
      '(เลือกตามว่ากลุ่มนี้คือกลุ่มไหน)',
    room: 'LINE_TARGET_* ตามหน้าที่ของห้องนี้',
    user: 'ไม่ต้องใช้ — นี่คือ ID ส่วนตัว ไม่ใช่ของกลุ่ม',
  }[sourceType] || 'LINE_TARGET_*';

  return (
    'ID ของที่นี่คือ\n' +
    id + '\n\n' +
    'ประเภท: ' + (sourceType || 'ไม่ทราบ') + '\n\n' +
    'นำไปวางที่ Apps Script → Project Settings → Script Properties\n' +
    'ชื่อ: ' + target
  );
}
