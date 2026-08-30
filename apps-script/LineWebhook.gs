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

/**
 * จำนวนข้อความที่คนหนึ่งส่งถึงแอดมินได้ต่อชั่วโมง
 *
 * ต่ำกว่าการค้นสถานะมาก เพราะปลายทางคือกลุ่ม LINE ของแอดมิน ไม่ใช่การอ่านชีต
 * — คนที่พิมพ์รัวโดยไม่ตั้งใจไม่ควรทำให้กลุ่มทีมท่วม
 */
const LINE_CONTACT_LIMIT_PER_HOUR = 5;

/** สั้นกว่านี้ถือว่าเป็นคำทักทายหรือพิมพ์พลาด ไม่ส่งต่อให้แอดมิน */
const LINE_CONTACT_MIN_CHARS = 10;

/**
 * รหัสตั๋วที่แอดมินใช้อ้างถึงคนถาม เช่น #R7K2
 *
 * ตัดอักษรที่อ่านสับสนออก (I O 0 1) เพราะแอดมินต้องพิมพ์ตามที่เห็นในกลุ่ม
 * ถ้าพิมพ์ผิดหนึ่งตัว ข้อความจะไปถึงคนอื่นหรือไม่ไปเลย
 */
const LINE_TICKET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LINE_TICKET_LENGTH = 4;
const LINE_TICKET_PATTERN = /^#([A-Z2-9]{4})\s+([\s\S]+)$/;

/**
 * ตั๋วหมดอายุกี่วัน
 *
 * ยาวพอให้ตอบวันทำการถัดไปได้ แต่ไม่เก็บ LINE user id ของแพทย์ต้นทาง
 * ไว้ตลอดกาลโดยไม่มีใครลบ — เก็บใน Script Properties ซึ่งไม่มี TTL ในตัว
 * จึงต้องกวาดเอง (ทำตอนออกตั๋วใหม่ ไม่ต้องตั้ง trigger เพิ่ม)
 */
const LINE_TICKET_TTL_DAYS = 7;

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

  // แอดมินตอบกลับจากในกลุ่มของตัวเอง — ต้องมาก่อนการกรองเฉพาะแชทตัวต่อตัว
  if (LINE_TICKET_PATTERN.test(text)) {
    handleAdminReply_(event, text, id);
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
      return;
    }

    // ไม่ใช่รหัสอ้างอิง — เป็นคำถามหรือข้อความทั่วไป ส่งต่อให้แอดมิน
    //
    // เดิมตรงนี้ return เงียบ ๆ แพทย์ต้นทางที่พิมพ์คำถามเข้ามาจึงไม่ได้อะไรกลับเลย
    // ซึ่งอ่านได้อย่างเดียวว่าไม่มีใครอยู่ แย่กว่าการตอบว่าไม่เข้าใจเสียอีก
    forwardToAdmin_(event, text, id);
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
      'และตอบกลับภายใน 3 วันทำการ\n\n';
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

/**
 * ส่งข้อความที่บอทตอบเองไม่ได้ ต่อให้กลุ่มแอดมิน แล้วตอบรับแพทย์ต้นทาง
 *
 * ⚠️ ไม่บันทึกลงชีต เหมือนหน้า /contact — นี่คือการแจ้งให้คนรู้ ไม่ใช่การเปิดเคส
 * คำถามทางคลินิกต้องเข้ากลุ่มที่ 2 ซึ่งมีเลขที่อ้างอิงและกรอบเวลาจริง
 *
 * ⚠️ แอดมินตอบกลับได้ก็ต่อเมื่อเปิด Chat ใน LINE Official Account Manager
 * ถ้าปิดอยู่ ข้อความจะถึงกลุ่มแอดมินแต่ตอบกลับในแชทนั้นไม่ได้
 * ตัวบอทเองตอบแทนไม่ได้ เพราะ replyToken ใช้ได้ครั้งเดียวและหมดอายุใน 1 นาที
 */
function forwardToAdmin_(event, text, sourceId) {
  if (text.length < LINE_CONTACT_MIN_CHARS) {
    replyLineMessage_(
      event.replyToken,
      'พิมพ์รหัสอ้างอิงเพื่อเช็คสถานะ เช่น HEM-20260822-0001\n\n' +
      'หรือพิมพ์คำถามมาได้เลย ระบบจะส่งต่อให้แพทย์แอดมินกลาง'
    );
    return;
  }

  if (!lineContactAllowed_(sourceId)) {
    replyLineMessage_(
      event.replyToken,
      'ส่งข้อความถี่เกินไป กรุณารอสักครู่\n\n' +
      'ถ้าเร่งด่วน โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:00-16:00 น.)'
    );
    return;
  }

  const who = lineDisplayName_(sourceId);
  const ticket = issueLineTicket_(sourceId);

  pushLineMessage_(
    '💬 มีคนทักเข้ามาทาง LINE OA\n\n' +
    'จาก: ' + who + '\n\n' +
    text.slice(0, 1200) + '\n\n' +
    '──────────\n' +
    'ตอบกลับ: พิมพ์ในกลุ่มนี้ได้เลย\n\n' +
    '   #' + ticket + ' ตามด้วยข้อความที่จะตอบ\n\n' +
    'บอทจะส่งข้อความนั้นถึงเขาให้ (ตั๋วใช้ได้ ' + LINE_TICKET_TTL_DAYS + ' วัน)\n' +
    '🔒 อย่าพิมพ์ข้อมูลผู้ป่วยในคำตอบ\n' +
    'ถ้าเป็นคำถามทางคลินิก แนะนำให้เขาส่งผ่านกลุ่มที่ 2 จะได้เข้าคิวและมีคนตอบตามกรอบเวลา',
    'red'
  );

  replyLineMessage_(
    event.replyToken,
    'ส่งข้อความถึงแพทย์แอดมินกลางแล้ว\n' +
    'จะติดต่อกลับในเวลาราชการ (จันทร์-ศุกร์ 08:00-16:00 น.)\n\n' +
    '🔒 กรุณาอย่าพิมพ์ชื่อ-สกุล เลข HN หรือเลขบัตรประชาชนของผู้ป่วยทาง LINE\n\n' +
    'ถ้าเป็นคำถามเรื่องสูตรยาหรืออยากปรึกษาก่อนส่งตัว ส่งผ่านกลุ่มที่ 2 จะเร็วกว่า\n' +
    SITE_URL + '/refer/regimen-consult'
  );
}

/**
 * ชื่อที่ผู้ใช้ตั้งไว้ใน LINE — ให้แอดมินหาแชทถูกคนใน OA Manager
 *
 * ไม่ใช่ข้อมูลผู้ป่วย เป็นชื่อบัญชี LINE ของแพทย์ต้นทางเอง
 * ถ้าเรียกไม่สำเร็จก็ไม่เป็นไร ใช้ id ที่ปิดกลางไว้แทน ดีกว่าไม่ส่งอะไรเลย
 */
function lineDisplayName_(userId) {
  const token = PropertiesService.getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) return maskLineId_(userId);

  try {
    const response = UrlFetchApp.fetch(
      'https://api.line.me/v2/bot/profile/' + encodeURIComponent(userId),
      {
        method: 'get',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      }
    );
    if (response.getResponseCode() !== 200) return maskLineId_(userId);
    const name = JSON.parse(response.getContentText()).displayName;
    return name ? name + ' (' + maskLineId_(userId) + ')' : maskLineId_(userId);
  } catch (err) {
    console.warn('อ่านชื่อ LINE ไม่สำเร็จ: ' + err);
    return maskLineId_(userId);
  }
}

/**
 * แอดมินพิมพ์ "#R7K2 ข้อความ" ในกลุ่ม → บอทส่งข้อความนั้นถึงแพทย์ต้นทาง
 *
 * มีไว้เพื่อให้แอดมินตอบจากกลุ่มที่ใช้อยู่แล้ว ไม่ต้องเปิดแอป
 * LINE Official Account Manager ซึ่งไม่มีใครติดตั้งไว้
 *
 * ⚠️ รับเฉพาะจากปลายทางที่อยู่ใน LINE_TARGET_ADMIN เท่านั้น
 * ถ้าไม่ตรวจ ใครก็ตามที่เดารหัสตั๋วถูกจะยิงข้อความในนามทีมถึงแพทย์ต้นทางได้
 * — ตั๋วสี่ตัวอักษรกันการเดาแบบสุ่มไม่ไหว มันมีไว้แค่ชี้ว่าตอบใคร ไม่ใช่กุญแจ
 */
function handleAdminReply_(event, text, sourceId) {
  if (!isAdminTarget_(sourceId)) {
    // ไม่ตอบอะไรกลับ — คนที่ไม่ใช่แอดมินไม่ควรรู้ด้วยซ้ำว่าคำสั่งนี้มีอยู่
    console.warn('ปฏิเสธคำสั่งตอบกลับจากปลายทางที่ไม่ใช่แอดมิน: ' +
      maskLineId_(sourceId));
    return;
  }

  const matched = text.match(LINE_TICKET_PATTERN);
  const ticket = matched[1].toUpperCase();
  const reply = matched[2].trim();

  const userId = readLineTicket_(ticket);
  if (!userId) {
    replyLineMessage_(
      event.replyToken,
      'ไม่พบตั๋ว #' + ticket + '\n\n' +
      'อาจพิมพ์รหัสผิด หรือตั๋วหมดอายุแล้ว (เก็บไว้ ' +
      LINE_TICKET_TTL_DAYS + ' วัน)\n' +
      'เลื่อนขึ้นไปดูรหัสในข้อความที่บอทส่งเข้ากลุ่ม'
    );
    return;
  }

  const token = PropertiesService.getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) {
    replyLineMessage_(event.replyToken, 'ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
    return;
  }

  sendOneLinePush_(
    token,
    userId,
    '💬 ตอบจากแพทย์แอดมินกลาง\n\n' + reply.slice(0, 1200) + '\n\n' +
    '──────────\n' +
    'พิมพ์ตอบกลับในแชทนี้ได้เลย ระบบจะส่งต่อให้'
  );

  replyLineMessage_(
    event.replyToken,
    '✅ ส่งถึงผู้ถาม (#' + ticket + ') แล้ว'
  );
}

/** ปลายทางนี้อยู่ใน LINE_TARGET_ADMIN หรือไม่ */
function isAdminTarget_(sourceId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty('LINE_TARGET_ADMIN');
  return parseLineTargets_(raw).indexOf(String(sourceId)) !== -1;
}

/**
 * ออกตั๋วใหม่ให้ผู้ถามหนึ่งคน แล้วกวาดตั๋วที่หมดอายุทิ้ง
 *
 * เก็บใน Script Properties ไม่ใช่ CacheService เพราะ cache อยู่ได้สูงสุด 6 ชั่วโมง
 * ซึ่งสั้นกว่า "ตอบวันทำการถัดไป" ที่เป็นพฤติกรรมจริงของแอดมิน
 *
 * ค่าเก็บเป็น "userId|เวลาที่ออก" เพื่อให้กวาดของเก่าได้โดยไม่ต้องมีตารางแยก
 * กวาดตอนออกตั๋วใหม่ ไม่ต้องตั้ง trigger เพิ่ม — ปริมาณอยู่ระดับหลักสิบต่อเดือน
 */
function issueLineTicket_(userId) {
  const props = PropertiesService.getScriptProperties();
  purgeExpiredLineTickets_(props);

  // คนเดิมที่ยังมีตั๋วไม่หมดอายุ ให้ใช้รหัสเดิม
  //
  // ถ้าออกใหม่ทุกครั้งที่พิมพ์ บทสนทนาเดียวจะมีหลายรหัสลอยอยู่ในกลุ่ม
  // แล้วแอดมินต้องเดาว่าอันไหนใหม่สุด — ตอบผิดตั๋วคือตอบถูกคนแต่หลุดบริบท
  const existing = findActiveTicket_(props, userId);
  if (existing) return existing;

  let ticket = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    let candidate = '';
    for (let i = 0; i < LINE_TICKET_LENGTH; i++) {
      candidate += LINE_TICKET_ALPHABET.charAt(
        Math.floor(Math.random() * LINE_TICKET_ALPHABET.length)
      );
    }
    if (!props.getProperty('line_ticket_' + candidate)) {
      ticket = candidate;
      break;
    }
  }

  // ชนกันสิบครั้งติดแทบเป็นไปไม่ได้ แต่ถ้าเกิดขึ้นจริง เขียนทับของเก่าดีกว่า
  // ไม่ออกตั๋วเลย เพราะแอดมินจะไม่มีทางตอบกลับคนนี้ได้
  if (!ticket) ticket = 'ZZZZ';

  props.setProperty('line_ticket_' + ticket, userId + '|' + Date.now());
  return ticket;
}

/** หาตั๋วที่ยังไม่หมดอายุของผู้ใช้คนนี้ — คืนสตริงว่างถ้าไม่มี */
function findActiveTicket_(props, userId) {
  const all = props.getProperties();
  const cutoff = Date.now() - LINE_TICKET_TTL_DAYS * 86400000;

  const keys = Object.keys(all);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].indexOf('line_ticket_') !== 0) continue;
    const parts = String(all[keys[i]]).split('|');
    if (parts[0] !== userId) continue;
    if (parseInt(parts[1] || '0', 10) < cutoff) continue;
    return keys[i].replace('line_ticket_', '');
  }
  return '';
}

/** คืน userId ของตั๋ว หรือสตริงว่างถ้าไม่มีหรือหมดอายุ */
function readLineTicket_(ticket) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty('line_ticket_' + ticket);
  if (!raw) return '';

  const parts = String(raw).split('|');
  const issuedAt = parseInt(parts[1] || '0', 10);
  if (Date.now() - issuedAt > LINE_TICKET_TTL_DAYS * 86400000) return '';

  return parts[0] || '';
}

function purgeExpiredLineTickets_(props) {
  const all = props.getProperties();
  const cutoff = Date.now() - LINE_TICKET_TTL_DAYS * 86400000;

  Object.keys(all).forEach(function (key) {
    if (key.indexOf('line_ticket_') !== 0) return;
    const issuedAt = parseInt(String(all[key]).split('|')[1] || '0', 10);
    if (issuedAt < cutoff) props.deleteProperty(key);
  });
}

/** จำกัดจำนวนข้อความที่ส่งถึงแอดมินได้ต่อชั่วโมง — กันกลุ่มทีมท่วม */
function lineContactAllowed_(sourceId) {
  const cache = CacheService.getScriptCache();
  const key = 'line_contact_' + sourceId;

  const current = parseInt(cache.get(key) || '0', 10);
  if (current >= LINE_CONTACT_LIMIT_PER_HOUR) return false;

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
