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

/**
 * คำนำหน้าที่แพทย์ต้นทางใช้ส่งข้อความถึงแอดมิน เช่น "admin ขอบคุณครับ"
 *
 * ⚠️ ต้องมีคำนำหน้าเสมอ ไม่ส่งต่อให้อัตโนมัติ
 *
 * เคยทำเป็นส่งต่อทุกข้อความหลังแอดมินตอบ แต่แบบนั้นแรงเกินไป — คนที่คุยจบแล้ว
 * แล้วพิมพ์คำถามใหม่ หรือพิมพ์อะไรผิดแชท จะเด้งเข้ากลุ่มแอดมินโดยไม่ตั้งใจ
 * ซึ่งคือภาระที่แอดมินขอไม่ให้มีตั้งแต่ต้น
 *
 * การต้องพิมพ์คำนำหน้าเป็นการบอกเจตนาชัดเจนว่า "อันนี้คุยกับแอดมินนะ"
 */
const LINE_ADMIN_PREFIX = /^(admin|แอดมิน)[\s:：,-]+([\s\S]+)$/i;

/** พิมพ์คำนำหน้ามาแต่ไม่มีข้อความต่อท้าย */
const LINE_ADMIN_PREFIX_BARE = /^(admin|แอดมิน)[\s:：,-]*$/i;

/**
 * ข้อความที่ปุ่มบน rich menu ส่งมา
 *
 * จับแบบ "มีคำนี้อยู่ในข้อความ" ไม่ใช่เท่ากันเป๊ะ เพราะข้อความบนปุ่มถูกแก้ได้
 * จากหน้า LINE OA Manager โดยไม่มีใครมาบอกโค้ด — ให้ทนต่อการเติมอีโมจิ
 * หรือเว้นวรรคเพิ่มได้บ้าง
 */
/**
 * ⚠️ ถอดออกจาก rich menu แล้ว (มติ 30 ส.ค. 2569) แต่ยังรับข้อความนี้อยู่
 *
 * rich menu มีได้ 6 ช่อง และปุ่มนี้ซ้ำซ้อนที่สุด — กลุ่มที่ 2 เปลี่ยนชื่อเป็น
 * "หรือสอบถามอื่น ๆ" แล้ว และข้อความลอย ๆ ทุกข้อความก็ได้คำตอบเดียวกันนี้อยู่แล้ว
 * ช่องที่ว่างจึงเอาไปทำปุ่ม "คำตอบของฉัน" ซึ่งไม่มีทางอื่นให้เข้าถึง
 *
 * ยังต้องรับไว้เพราะคนพิมพ์เองมี และ chip ในหน้าอื่นยังส่งข้อความนี้
 */
const LINE_BUTTON_UNSURE = 'ไม่แน่ใจว่าเข้ากลุ่มไหน';
const LINE_BUTTON_CONTACT = 'ติดต่อเจ้าหน้าที่';
const LINE_BUTTON_MYCASES = 'เคสของฉัน';
const LINE_BUTTON_LINK = 'ผูกบัญชี';
/**
 * ปุ่มรวมของเรื่อง "คำตอบ" — rich menu มีได้ 6 ช่อง แต่ฟังก์ชันมีมากกว่านั้น
 *
 * ปุ่มนี้ไม่ทำอะไรเอง แค่เด้ง chip ให้เลือก จึงเพิ่มฟังก์ชันใหม่ได้เรื่อย ๆ
 * โดยไม่ต้องรื้อ rich menu ซึ่งต้องออกแบบรูปใหม่ทุกครั้งที่แก้
 */
const LINE_BUTTON_MYANSWERS = 'คำตอบของฉัน';
const LINE_BUTTON_UNLINK = 'เลิกผูก';

/**
 * ค้นเคสด้วยเบอร์โทรได้กี่ครั้งต่อชั่วโมง
 *
 * ต่ำกว่าการค้นด้วยรหัสอ้างอิงมาก เพราะเบอร์โทรเดาง่ายกว่ารหัสหลายเท่า
 * — รหัสมาจากอีเมลเท่านั้น ส่วนเบอร์หมออยู่บนใบ refer และทำเนียบโรงพยาบาล
 */
const LINE_PHONE_LOOKUP_LIMIT_PER_HOUR = 5;

/** สั่งส่งคำตอบซ้ำ เช่น "ส่งซ้ำ 2" */
const LINE_RESEND_PATTERN = /^ส่งซ้ำ\s*(\d{1,2})$/;

/** พิมพ์คำใดคำหนึ่งนี้เพื่อออกจากโฟลว์ที่ค้างอยู่ */
const LINE_CANCEL_WORDS = ['ยกเลิก', 'เลิก', 'cancel'];

/**
 * หัวข้อที่เลือกได้ในโฟลว์ติดต่อเจ้าหน้าที่
 *
 * มีแค่สามเรื่องโดยเจตนา — สองข้อแรกคือปัญหาของระบบที่กลุ่มที่ 2 รับไม่ได้จริง ๆ
 * ข้อสามเป็นทางออกสำหรับเรื่องที่คาดไม่ถึง ไม่ใช่ช่องรับคำถามทางคลินิก
 */
const LINE_CONTACT_TOPICS = {
  '1': 'ส่งข้อมูลเข้าระบบไม่ได้',
  '2': 'สอบถามสถานะ referral ที่เกินกรอบเวลาแล้ว',
  '3': 'อื่น ๆ',
};

/** โฟลว์ค้างไว้ได้นานแค่ไหน — ตอบสองสามคำถามไม่ควรเกินนี้ */
const LINE_FLOW_TTL_SECONDS = 1800;

/**
 * ปุ่มลัดของขั้นเลือกหัวข้อ
 *
 * label ย่อกว่าข้อความในเมนู เพราะ LINE จำกัดไว้ 20 ตัวอักษร
 * ส่วน text ที่ส่งจริงยังเป็น "1" "2" "3" เหมือนที่พิมพ์เอง ตัวจัดการจึงใช้ตัวเดิม
 */
const TOPIC_QUICK_REPLY = [
  { label: '1. ส่งข้อมูลไม่ได้', text: '1' },
  { label: '2. สถานะเกินกำหนด', text: '2' },
  { label: '3. อื่น ๆ', text: '3' },
  { label: '✕ ยกเลิก', text: 'ยกเลิก' },
];

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

  // เจ้าหน้าที่ถามงานของตัวเองจากในกลุ่ม — ตอบเฉพาะคำสั่งที่ตรงเป๊ะ
  // และเฉพาะกลุ่มที่อยู่ใน LINE_TARGET_* (ดู GroupQuery.gs)
  if (handleGroupQuery_(event, text, id)) return;

  // ค้นสถานะเฉพาะแชทตัวต่อตัว
  //
  // ในกลุ่ม resident มีรหัสอ้างอิงลอยอยู่เต็มไปหมดจากรอบแจ้งเตือน 10:00 น.
  // ถ้าบอทตอบทุกครั้งที่มีคนอ้างถึงรหัส กลุ่มจะเต็มไปด้วยข้อความบอท
  // ซึ่งขัดกับ Time-Protected UI/UX ที่ทั้งระบบยึดถืออยู่
  // และคนในกลุ่มเปิด dashboard ดูได้อยู่แล้ว ต่างจากแพทย์ต้นทาง
  //
  // ⚠️ บรรทัดนี้คือสิ่งที่กันไม่ให้คำสั่งด้านล่างทั้งหมดทำงานในกลุ่ม
  // คำสั่งของเจ้าหน้าที่จึงต้องอยู่เหนือบรรทัดนี้เท่านั้น
  if (source.type !== 'user') return;

  if (LINE_CANCEL_WORDS.indexOf(text) !== -1) {
    clearContactFlow_(id);
    replyLineMessage_(event.replyToken, 'ยกเลิกแล้ว พิมพ์ใหม่ได้ทุกเมื่อ');
    return;
  }

  // ปุ่ม rich menu — ข้อความสำเร็จรูปที่ปุ่มส่งมา
  if (matchesButton_(text, LINE_BUTTON_UNSURE)) {
    clearContactFlow_(id);
    replyLineMessage_(event.replyToken, buildUnsureGroupReply_());
    return;
  }

  if (matchesButton_(text, LINE_BUTTON_CONTACT)) {
    startContactFlow_(event, id);
    return;
  }

  if (matchesButton_(text, LINE_BUTTON_MYANSWERS)) {
    clearContactFlow_(id);
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text: buildMyAnswersMenu_(id) },
      myAnswersQuickReply_(id))]);
    return;
  }

  if (matchesButton_(text, LINE_BUTTON_MYCASES)) {
    startMyCasesFlow_(event, id);
    return;
  }

  if (matchesButton_(text, LINE_BUTTON_UNLINK)) {
    handleUnlink_(event, id);
    return;
  }

  if (matchesButton_(text, LINE_BUTTON_LINK)) {
    // "ผูกบัญชี ใหม่" = ตั้งใจผูกเบอร์ใหม่ทับของเดิม ข้ามหน้าจอที่บอกว่าผูกแล้ว
    if (text.indexOf('ใหม่') !== -1) {
      writeContactFlow_(id, { step: 'linkPhone' });
      replyLineMessage_(event.replyToken, [withQuickReply_(
        { type: 'text', text: 'พิมพ์เบอร์โทรที่ต้องการผูกใหม่ครับ' },
        cancelQuickReply_())]);
      return;
    }
    startLinkFlow_(event, id);
    return;
  }

  // อยู่ระหว่างตอบคำถามของโฟลว์ติดต่อเจ้าหน้าที่ — ต้องมาก่อนการค้นรหัส
  // เพราะขั้นตอนหนึ่งของโฟลว์คือให้พิมพ์รหัสอ้างอิงพอดี
  const flow = readContactFlow_(id);
  if (flow) {
    advanceContactFlow_(event, flow, text, id);
    return;
  }

  const matched = text.match(LINE_REFERRAL_ID_PATTERN);
  if (!matched) {
    // พิมพ์รหัสมาแต่ผิดรูป — บอกรูปแบบให้ ไม่ปล่อยเงียบ
    if (LINE_REFERRAL_ID_LOOSE.test(text)) {
      replyLineMessage_(event.replyToken, buildBadFormatReply_());
      return;
    }

    // ตั้งใจส่งถึงแอดมิน — ต้องพิมพ์คำนำหน้าเท่านั้น ไม่ส่งต่อให้เอง
    const addressed = text.match(LINE_ADMIN_PREFIX);
    if (addressed) {
      relayToAdmin_(event, addressed[2].trim(), id);
      return;
    }
    if (LINE_ADMIN_PREFIX_BARE.test(text)) {
      replyLineMessage_(event.replyToken,
        'พิมพ์ข้อความต่อท้ายด้วยครับ\n\n' +
        '   admin ตามด้วยข้อความที่จะส่ง\n\n' +
        'เช่น  admin ขอบคุณครับ แล้วจะลองใหม่');
      return;
    }

    // คำถามลอย ๆ — ชี้ไปกลุ่มที่ 2 ไม่ส่งต่อให้แอดมิน
    //
    // เดิมตรงนี้ส่งเข้ากลุ่มแอดมินทุกข้อความ ซึ่งย้อนกลับไปหาปัญหาเดิมพอดี
    // คือแอดมินต้องคอยตอบคำถามจิปาถะ ทั้งที่กลุ่มที่ 2 รับคำถามแบบนี้อยู่แล้ว
    // และตอบได้ดีกว่าเพราะมีเลขที่อ้างอิง เข้าคิว และมีกรอบเวลา
    replyLineMessage_(event.replyToken, buildUnsureGroupReply_());
    return;
  }

  if (!lineLookupAllowed_(id)) {
    replyLineMessage_(
      event.replyToken,
      'ค้นสถานะบ่อยเกินไป กรุณารออีกสักครู่แล้วลองใหม่\n\n' +
      'ถ้าเร่งด่วน โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:30-16:30 น.)',
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
      'ถ้ายังไม่พบ โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:30-16:30 น.)'
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
    ' (จันทร์-ศุกร์ 08:30-16:30 น.)';

  return message;
}

/** พิมพ์รหัสมาแต่รูปแบบไม่ถูก — บอกรูปแบบที่ถูกต้อง ไม่ต้องแตะชีต */
function buildBadFormatReply_() {
  return (
    'รูปแบบรหัสอ้างอิงไม่ถูกต้อง\n\n' +
    'รูปแบบคือ HEM-ปีเดือนวัน-เลขลำดับ 4 หลัก\n' +
    'เช่น HEM-20260822-0001\n\n' +
    'กรุณาคัดลอกมาจากอีเมลที่ระบบส่งให้ทั้งบรรทัดได้เลย\n\n' +
    'ถ้ายังไม่ได้ โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:30-16:30 น.)'
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

/** ปุ่มบน rich menu ถูกแก้ข้อความได้ จึงจับแบบมีคำนี้อยู่ ไม่ใช่เท่ากันเป๊ะ */
function matchesButton_(text, keyword) {
  return text.indexOf(keyword) !== -1;
}

/**
 * คำตอบสำหรับคนที่ไม่แน่ใจว่าเข้ากลุ่มไหน และสำหรับคำถามลอย ๆ ทั่วไป
 *
 * ชี้ไปกลุ่มที่ 2 ไม่ส่งต่อให้แอดมิน — กลุ่มที่ 2 รับคำถามก่อนตัดสินใจส่งตัว
 * อยู่แล้ว และตอบได้ดีกว่าเพราะคำถามจะได้เลขที่อ้างอิง เข้าคิว
 * และมีแพทย์ประจำบ้านตอบตามกรอบเวลา ต่างจากการทักแอดมินซึ่งไม่มีอะไรรับประกัน
 */
function buildUnsureGroupReply_() {
  return [
    {
      type: 'text',
      text:
        'ถ้ายังไม่แน่ใจว่าเคสเข้ากลุ่มไหน หรืออยากถามก่อนตัดสินใจส่งตัว\n' +
        'ให้ส่งผ่าน "กลุ่มที่ 2" ได้เลยครับ\n\n' +
        'กลุ่มที่ 2 รับทั้งเรื่องสูตรยาเคมีบำบัด และคำถามอื่น เช่น\n' +
        '  • เคสนี้ควร refer หรือไม่\n' +
        '  • ขณะนี้มีการศึกษาวิจัย (clinical trial) ที่เหมาะกับผู้ป่วยหรือไม่\n\n' +
        'ส่งทางนั้นแล้วคำถามจะได้เลขที่อ้างอิง และมีแพทย์ตอบกลับภายใน 3 วันทำการ',
    },
    // ปุ่มลัดต้องอยู่กับข้อความสุดท้าย LINE ถึงจะแสดง — รูปแบบเดียวกับโฟลว์ติดต่อ
    //
    // มีทางออกให้คนที่อ่านแล้วรู้ว่ากลุ่มที่ 2 ไม่ใช่สิ่งที่ตัวเองต้องการ
    // ไม่งั้นเขาต้องย้อนไปกด rich menu เองซึ่งคนส่วนใหญ่ไม่ทำ แล้วก็เงียบไป
    withQuickReply_(
      linkButtonMessage_(
        'เขียนคำถามลงในช่อง "สิ่งที่ต้องการปรึกษา" ได้เลย',
        'ไปที่กลุ่มที่ 2',
        SITE_URL + '/refer/regimen-consult'
      ),
      [{ label: 'ขอติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' }]
    ),
  ];
}

/**
 * เมนูรวมของเรื่อง "คำตอบ" — ข้อความเปลี่ยนตามว่าผูกบัญชีไว้แล้วหรือยัง
 *
 * คนที่ผูกแล้วไม่ต้องเห็นคำชวนผูกอีก และคนที่ยังไม่ผูกควรเห็นว่าได้อะไร
 * ก่อนตัดสินใจ ไม่ใช่เห็นแค่ชื่อปุ่มลอย ๆ
 */
function buildMyAnswersMenu_(userId) {
  const linked = findLineLink_(userId);

  if (linked) {
    return (
      'ดูเคสและคำตอบของท่าน\n\n' +
      '✓ ผูกบัญชีไว้แล้ว (เบอร์ ' + maskPhone_(linked['referrer_phone']) + ')\n' +
      '  เมื่อมีคำตอบใหม่ ระบบจะส่งลิงก์มาที่แชทนี้ให้อัตโนมัติ\n\n' +
      '• เคสของฉัน — ดูรายการเคสทั้งหมด และสั่งส่งคำตอบซ้ำทางอีเมล\n' +
      '• เลิกผูก — กลับไปรับทางอีเมลอย่างเดียว'
    );
  }

  return (
    'ดูเคสและคำตอบของท่าน\n\n' +
    '• เคสของฉัน — พิมพ์เบอร์แล้วดูรายการเคส สั่งส่งคำตอบซ้ำทางอีเมลได้\n\n' +
    '• ผูกบัญชี — ผูกครั้งเดียว แล้วคำตอบครั้งต่อไปจะเด้งเข้า LINE\n' +
    '  พร้อมปุ่มเปิดอ่านทันที ไม่ต้องค้นอีเมลอีก'
  );
}

/** chip ของเมนูคำตอบ — ซ่อน "ผูกบัญชี" เมื่อผูกแล้ว และกลับกัน */
function myAnswersQuickReply_(userId) {
  const items = [{ label: 'เคสของฉัน', text: 'เคสของฉัน' }];
  if (findLineLink_(userId)) {
    items.push({ label: 'เลิกผูก', text: 'เลิกผูก' });
  } else {
    items.push({ label: 'ผูกบัญชี', text: 'ผูกบัญชี' });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* โฟลว์ "เคสของฉัน" — ค้นด้วยเบอร์โทร แล้วขอให้ส่งคำตอบซ้ำทางอีเมล        */
/* ------------------------------------------------------------------ */

/**
 * ⚠️ เบอร์โทรอย่างเดียวเปิดได้แค่ "รายการ" ไม่เปิดคำตอบ
 *
 * เบอร์แพทย์ต้นทางอยู่บนใบ refer และทำเนียบโรงพยาบาล ใครก็หาได้
 * ถ้าพิมพ์เบอร์แล้วอ่านคำตอบทางคลินิกได้เลย เท่ากับใครที่รู้เบอร์หมอคนหนึ่ง
 * ก็อ่านคำปรึกษาทุกเคสของเขาได้ — ต่างจากรหัส HEM-… ที่มาจากอีเมลเท่านั้น
 *
 * สิ่งที่ทำได้คือสั่งให้ "ส่งคำตอบซ้ำไปที่อีเมลเดิมของเคส" ซึ่งปลอดภัยเสมอ
 * เพราะปลายทางไม่ได้มาจากคนที่กด แต่มาจากที่ลงทะเบียนไว้ในแถวนั้น
 */
function startMyCasesFlow_(event, userId) {
  writeContactFlow_(userId, { step: 'myCasesPhone' });

  replyLineMessage_(event.replyToken, [withQuickReply_(
    { type: 'text', text:
      'พิมพ์เบอร์โทรที่ใช้ตอนส่งเคสเข้ามาครับ\n\n' +
      'ระบบจะแสดงรายการเคสของเบอร์นั้น และส่งคำตอบซ้ำไปที่อีเมลเดิมให้ได้\n\n' +
      '🔒 คำตอบจะไม่แสดงใน LINE และจะถูกส่งไปที่อีเมลที่ลงทะเบียนไว้เท่านั้น' },
    cancelQuickReply_())]);
}

/** ตัดให้เหลือเฉพาะตัวเลข เพื่อให้ 08x-xxx-xxxx กับ 08xxxxxxxx ตรงกัน */
function digitsOnly_(value) {
  return String(value || '').replace(/\D/g, '');
}

function handleMyCasesPhone_(event, text, userId) {
  const digits = digitsOnly_(text);
  if (digits.length < 9) {
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text: 'เบอร์โทรไม่ครบ กรุณาพิมพ์ใหม่ เช่น 081-234-5678' },
      cancelQuickReply_())]);
    return;
  }

  if (!lineCasesLookupAllowed_(userId)) {
    clearContactFlow_(userId);
    replyLineMessage_(event.replyToken,
      'ค้นบ่อยเกินไป กรุณารออีกสักครู่\n\n' +
      'ถ้าเร่งด่วน โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:30-16:30 น.)');
    return;
  }

  const rows = readRows_(getSheet_(SHEETS.referrals)).filter(function (r) {
    return r['referral_id'] && phoneKey_(r['referrer_phone']) === phoneKey_(digits);
  });

  if (rows.length === 0) {
    clearContactFlow_(userId);
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text:
        'ไม่พบเคสของเบอร์นี้\n\n' +
        'ตรวจว่าเป็นเบอร์เดียวกับที่กรอกตอนส่งเคสหรือไม่ ' +
        'ถ้ายังไม่พบ แจ้งเจ้าหน้าที่ได้จากปุ่มด้านล่าง' },
      [{ label: 'ขอติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' }])]);
    return;
  }

  // ใหม่สุดขึ้นก่อน — คนที่ตามหาคำตอบมักตามหาเคสล่าสุดของตัวเอง
  rows.sort(function (a, b) {
    const x = toDate_(a['submitted_at']), y = toDate_(b['submitted_at']);
    return (y ? y.getTime() : 0) - (x ? x.getTime() : 0);
  });

  const shown = rows.slice(0, 10);
  let message = 'พบ ' + rows.length + ' เคสของเบอร์นี้';
  if (rows.length > shown.length) message += ' (แสดง ' + shown.length + ' รายการล่าสุด)';
  message += '\n────────────────\n';

  const ids = [];
  const chips = [];

  shown.forEach(function (r, i) {
    const n = i + 1;
    const submitted = toDate_(r['submitted_at']);
    const hasAdvice = String(r['advice_record'] || '').trim();
    const hasEmail = String(r['referrer_email'] || '').trim();

    ids.push(String(r['referral_id']).trim());

    message +=
      n + '. ' + r['referral_id'] + '\n' +
      '   กลุ่มที่ ' + (GROUP_NUMBER[String(r['referral_type'])] || '-') +
        ' · ' + (submitted ? formatThaiDate_(submitted) : '-') + '\n' +
      '   สถานะ: ' +
        (LINE_STATUS_LABEL_TH[String(r['status'])] || r['status'] || '-') + '\n';

    if (hasAdvice && hasEmail) {
      message += '   ✉️ ส่งคำตอบซ้ำได้\n';
      chips.push({
        label: n + ') ' + (submitted ? formatThaiDate_(submitted) : '-'),
        text: 'ส่งซ้ำ ' + n,
      });
    } else if (hasAdvice) {
      message += '   ⚠️ ไม่มีอีเมลในเคสนี้ ส่งซ้ำไม่ได้\n';
    } else {
      message += '   ยังไม่มีคำตอบ\n';
    }
    message += '\n';
  });

  if (chips.length === 0) {
    clearContactFlow_(userId);
    message += 'ยังไม่มีเคสไหนที่ส่งคำตอบซ้ำได้';
    replyLineMessage_(event.replyToken, message);
    return;
  }

  writeContactFlow_(userId, { step: 'myCasesResend', ids: ids });
  message += 'กดเลือกเคสที่ต้องการให้ส่งคำตอบซ้ำทางอีเมล';

  chips.push({ label: '✕ ปิด', text: 'ยกเลิก' });
  replyLineMessage_(event.replyToken,
    [withQuickReply_({ type: 'text', text: message }, chips)]);
}

function handleMyCasesResend_(event, flow, text, userId) {
  const matched = text.match(LINE_RESEND_PATTERN);
  if (!matched) {
    replyLineMessage_(event.replyToken,
      'กดปุ่มเลือกเคสด้านล่าง หรือพิมพ์ "ส่งซ้ำ" ตามด้วยลำดับ เช่น ส่งซ้ำ 1');
    return;
  }

  const index = parseInt(matched[1], 10) - 1;
  const referralId = (flow.ids || [])[index];
  if (!referralId) {
    replyLineMessage_(event.replyToken, 'ไม่พบลำดับนั้นในรายการ กรุณาเลือกใหม่');
    return;
  }

  const found = readRows_(getSheet_(SHEETS.referrals)).filter(function (r) {
    return String(r['referral_id'] || '').trim() === referralId;
  })[0];

  const sent = found ? sendAdviceCopyEmail_(found) : false;
  clearContactFlow_(userId);

  // ไม่บอกอีเมลปลายทางกลับไป — คนที่พิมพ์เบอร์อาจไม่ใช่เจ้าของเคส
  // การยืนยันว่า "ส่งไปที่ a@b.com แล้ว" คือการเปิดเผยอีเมลให้คนนั้นฟรี ๆ
  replyLineMessage_(event.replyToken,
    sent
      ? 'ส่งสำเนาคำตอบของ ' + referralId + ' ไปที่อีเมลที่ลงทะเบียนไว้แล้ว ✓\n\n' +
        'กรุณาตรวจกล่องจดหมาย รวมถึงโฟลเดอร์จดหมายขยะ'
      : 'ส่งไม่สำเร็จ เคสนี้อาจยังไม่มีคำตอบหรือไม่มีอีเมลที่ลงทะเบียนไว้\n\n' +
        'โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:30-16:30 น.)');
}

/** จำกัดการค้นด้วยเบอร์โทร — ต่ำกว่าการค้นด้วยรหัสเพราะเบอร์เดาง่ายกว่า */
function lineCasesLookupAllowed_(sourceId) {
  const cache = CacheService.getScriptCache();
  const key = 'line_cases_' + sourceId;
  const current = parseInt(cache.get(key) || '0', 10);
  if (current >= LINE_PHONE_LOOKUP_LIMIT_PER_HOUR) return false;
  cache.put(key, String(current + 1), 3600);
  return true;
}

/* ------------------------------------------------------------------ */
/* โฟลว์ "ขอติดต่อเจ้าหน้าที่"                                            */
/* ------------------------------------------------------------------ */

/**
 * ถามทีละคำถามจนได้ข้อมูลครบ แล้วค่อยส่งเข้ากลุ่มแอดมิน
 *
 * ⚠️ ตั้งใจให้ถามหลายขั้น ไม่ใช่รับข้อความเดียวจบ
 *
 * ข้อความลอย ๆ ที่ส่งเข้ากลุ่มแอดมินโดยไม่มีเบอร์โทรและไม่มีหัวข้อ
 * จบลงด้วยการที่แอดมินต้องไล่ถามกลับเองทีละอย่าง ซึ่งคือภาระที่ระบบนี้
 * ตั้งใจจะลด การถามให้ครบตั้งแต่ต้นทำให้แอดมินอ่านครั้งเดียวแล้วโทรได้เลย
 *
 * เก็บสถานะใน CacheService ไม่ใช่ Script Properties เพราะโฟลว์ที่ค้างครึ่งทาง
 * ควรหายไปเอง ต่างจากตั๋วตอบกลับที่ต้องอยู่ข้ามวัน
 */
function startContactFlow_(event, userId) {
  writeContactFlow_(userId, { step: 'topic' });

  // ปุ่มอยู่ในข้อความที่สอง เพื่อให้คำถาม "พิมพ์เลข 1-3" ยังอยู่บนสุด
  // ถ้าเอาไปรวมกัน ข้อความจะเกิน 160 ตัวอักษรที่ buttons template รับได้
  replyLineMessage_(event.replyToken, [
    {
      type: 'text',
      text:
        'ต้องการติดต่อเจ้าหน้าที่เรื่องอะไรครับ — พิมพ์เลข 1-3\n\n' +
        '1. ' + LINE_CONTACT_TOPICS['1'] + '\n' +
        '2. ' + LINE_CONTACT_TOPICS['2'] + '\n' +
        '3. ' + LINE_CONTACT_TOPICS['3'] + '\n\n' +
        'กดปุ่มด้านล่าง หรือพิมพ์เลขก็ได้',
    },
    // ปุ่มลัดต้องอยู่กับข้อความสุดท้าย LINE ถึงจะแสดง
    withQuickReply_(
      linkButtonMessage_(
        'ถ้าเป็นคำถามทางคลินิก หรือไม่แน่ใจว่าเคสเข้ากลุ่มไหน ให้ส่งผ่านกลุ่มที่ 2 แทน',
        'ไปที่กลุ่มที่ 2',
        SITE_URL + '/refer/regimen-consult'
      ),
      TOPIC_QUICK_REPLY
    ),
  ]);
}

function advanceContactFlow_(event, flow, text, userId) {
  if (flow.step === 'linkPhone') {
    handleLinkPhone_(event, text, userId);
    return;
  }

  if (flow.step === 'linkCode') {
    handleLinkCode_(event, text, userId);
    return;
  }

  if (flow.step === 'myCasesPhone') {
    handleMyCasesPhone_(event, text, userId);
    return;
  }

  if (flow.step === 'myCasesResend') {
    handleMyCasesResend_(event, flow, text, userId);
    return;
  }

  if (flow.step === 'topic') {
    if (!LINE_CONTACT_TOPICS[text]) {
      replyLineMessage_(event.replyToken, [withQuickReply_(
        { type: 'text', text:
          'กรุณาเลือก 1, 2 หรือ 3\n\n' +
          '1. ' + LINE_CONTACT_TOPICS['1'] + '\n' +
          '2. ' + LINE_CONTACT_TOPICS['2'] + '\n' +
          '3. ' + LINE_CONTACT_TOPICS['3'] },
        TOPIC_QUICK_REPLY)]);
      return;
    }

    flow.topic = text;

    // เฉพาะเรื่องสถานะเคสที่ต้องรู้ว่าเคสไหน อีกสองเรื่องยังไม่มีเคสให้อ้างถึง
    if (text === '2') {
      flow.step = 'referralId';
      writeContactFlow_(userId, flow);
      replyLineMessage_(event.replyToken, [withQuickReply_(
        { type: 'text', text:
          'กรุณาพิมพ์รหัสอ้างอิงของเคส\n' +
          'เช่น HEM-20260822-0001\n\n' +
          'คัดลอกจากอีเมลที่ระบบส่งให้ได้เลย' },
        cancelQuickReply_())]);
      return;
    }

    flow.step = 'phone';
    writeContactFlow_(userId, flow);
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text: 'กรุณาพิมพ์เบอร์โทรที่ให้ติดต่อกลับ' },
      cancelQuickReply_())]);
    return;
  }

  if (flow.step === 'referralId') {
    const matched = text.match(LINE_REFERRAL_ID_PATTERN);
    if (!matched) {
      // มีปุ่ม "ข้าม" ด้วย เพราะคนหารหัสไม่เจอคือคนที่เปิดอีเมลไม่ได้อยู่แล้ว
      // การให้พิมพ์ขีดกลางเองเป็นด่านที่ไม่จำเป็นสำหรับคนที่ติดอยู่ตรงนั้นพอดี
      replyLineMessage_(event.replyToken, [withQuickReply_(
        { type: 'text', text:
          'รูปแบบรหัสไม่ถูกต้อง\n' +
          'ต้องเป็น HEM-ปีเดือนวัน-เลข 4 หลัก เช่น HEM-20260822-0001' },
        [{ label: 'หารหัสไม่เจอ ข้ามไป', text: '-' }].concat(cancelQuickReply_())
      )]);
      if (text !== '-') return;
    }
    flow.referralId = matched ? matched[0].toUpperCase() : '(ไม่ทราบรหัส)';
    flow.step = 'phone';
    writeContactFlow_(userId, flow);
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text: 'กรุณาพิมพ์เบอร์โทรที่ให้ติดต่อกลับ' },
      cancelQuickReply_())]);
    return;
  }

  if (flow.step === 'phone') {
    // นับเฉพาะตัวเลข เพราะคนพิมพ์ 08x-xxx-xxxx บ้าง 08x xxx xxxx บ้าง
    const digits = text.replace(/\D/g, '');
    if (digits.length < 9) {
      replyLineMessage_(event.replyToken, [withQuickReply_(
        { type: 'text', text:
          'เบอร์โทรไม่ครบ กรุณาพิมพ์ใหม่\n' +
          'เช่น 081-234-5678 หรือ 02-419-7642 ต่อ 104' },
        cancelQuickReply_())]);
      return;
    }
    flow.phone = text;
    flow.step = 'detail';
    writeContactFlow_(userId, flow);
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text:
        'พิมพ์รายละเอียดที่ต้องการแจ้งได้เลยครับ\n\n' +
        '🔒 กรุณาอย่าพิมพ์ชื่อ-สกุล เลข HN หรือเลขบัตรประชาชนของผู้ป่วย' },
      cancelQuickReply_())]);
    return;
  }

  if (flow.step === 'detail') {
    flow.detail = text;
    clearContactFlow_(userId);
    sendContactToAdmin_(event, flow, userId);
    return;
  }

  // สถานะที่โค้ดไม่รู้จัก — ล้างทิ้งดีกว่าปล่อยให้ผู้ใช้ติดอยู่ในโฟลว์ที่ไปต่อไม่ได้
  clearContactFlow_(userId);
  replyLineMessage_(event.replyToken, 'ขออภัย เกิดข้อผิดพลาด กรุณากดปุ่มติดต่อเจ้าหน้าที่ใหม่');
}

/** ส่งเรื่องที่ถามครบแล้วเข้ากลุ่มแอดมิน พร้อมตั๋วให้ตอบกลับได้ */
function sendContactToAdmin_(event, flow, userId) {
  if (!lineContactAllowed_(userId)) {
    replyLineMessage_(event.replyToken,
      'ส่งเรื่องถี่เกินไป กรุณารอสักครู่\n\n' +
      'ถ้าเร่งด่วน โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:30-16:30 น.)');
    return;
  }

  const who = lineDisplayName_(userId);
  const ticket = issueLineTicket_(userId);

  pushLineMessage_(
    '📨 มีเรื่องแจ้งจากแพทย์ต้นทาง\n\n' +
    'เรื่อง: ' + (LINE_CONTACT_TOPICS[flow.topic] || 'ไม่ระบุ') + '\n' +
    (flow.referralId ? 'เคส: ' + flow.referralId + '\n' : '') +
    'โทรกลับ: ' + flow.phone + '\n' +
    'จาก: ' + who + '\n\n' +
    String(flow.detail || '').slice(0, 1200) + '\n\n' +
    '──────────\n' +
    'ตอบกลับ: พิมพ์ในกลุ่มนี้ได้เลย\n\n' +
    '   #' + ticket + ' ตามด้วยข้อความที่จะตอบ\n\n' +
    'บอทจะส่งข้อความนั้นถึงเขาให้ (ตั๋วใช้ได้ ' + LINE_TICKET_TTL_DAYS + ' วัน)\n' +
    '🔒 อย่าพิมพ์ข้อมูลผู้ป่วยในคำตอบ',
    'red'
  );

  replyLineMessage_(
    event.replyToken,
    'ส่งเรื่องถึงแพทย์แอดมินกลางแล้ว ✓\n\n' +
    'เรื่อง: ' + (LINE_CONTACT_TOPICS[flow.topic] || '-') + '\n' +
    (flow.referralId ? 'เคส: ' + flow.referralId + '\n' : '') +
    'โทรกลับ: ' + flow.phone + '\n\n' +
    'จะติดต่อกลับในเวลาราชการ (จันทร์-ศุกร์ 08:30-16:30 น.)\n\n' +
    'อยากส่งข้อความเพิ่ม พิมพ์ admin นำหน้า เช่น\n' +
    '   admin ลืมบอกว่า…'
  );
}

function readContactFlow_(userId) {
  const raw = CacheService.getScriptCache().get('line_flow_' + userId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeContactFlow_(userId, flow) {
  CacheService.getScriptCache()
    .put('line_flow_' + userId, JSON.stringify(flow), LINE_FLOW_TTL_SECONDS);
}

function clearContactFlow_(userId) {
  CacheService.getScriptCache().remove('line_flow_' + userId);
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
    'ถ้าจะตอบกลับ พิมพ์ admin นำหน้า เช่น\n' +
    '   admin ขอบคุณครับ\n' +
    '(ข้อความที่ไม่มี admin นำหน้า จะไม่ถูกส่งถึงแอดมิน)'
  );

  replyLineMessage_(
    event.replyToken,
    '✅ ส่งถึงผู้ถาม (#' + ticket + ') แล้ว'
  );
}

/**
 * ส่งข้อความที่ขึ้นต้นด้วย "admin" ของผู้ถาม เข้ากลุ่มแอดมิน
 *
 * ใช้ตั๋วเดิมของคนนั้นถ้ายังไม่หมดอายุ เพื่อให้แอดมินเห็นว่าต่อจากเรื่องไหน
 * ถ้าไม่มีตั๋ว แปลว่ายังไม่เคยแจ้งเรื่องอะไรไว้ — พาไปเริ่มที่ปุ่มติดต่อเจ้าหน้าที่
 * เพราะที่นั่นจะถามหัวข้อและเบอร์โทรให้ครบก่อน แอดมินจะได้ไม่ต้องไล่ถามเอง
 */
function relayToAdmin_(event, text, userId) {
  const ticket = findActiveTicket_(PropertiesService.getScriptProperties(), userId);
  if (!ticket) {
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text:
        'ยังไม่มีเรื่องที่คุยค้างไว้กับแอดมินครับ\n\n' +
        'กดปุ่มด้านล่างเพื่อแจ้งเรื่องใหม่ ระบบจะถามหัวข้อและเบอร์ติดต่อกลับให้ครบ' },
      [{ label: 'ขอติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' }]
    )]);
    return;
  }

  if (!lineContactAllowed_(userId)) {
    replyLineMessage_(event.replyToken,
      'ส่งข้อความถี่เกินไป กรุณารอสักครู่\n\n' +
      'ถ้าเร่งด่วน โทร ' + CONTACT_PHONE + ' (จันทร์-ศุกร์ 08:30-16:30 น.)');
    return;
  }

  pushLineMessage_(
    '💬 #' + ticket + ' ตอบกลับมา\n\n' +
    'จาก: ' + lineDisplayName_(userId) + '\n\n' +
    text.slice(0, 1200) + '\n\n' +
    '──────────\n' +
    'ตอบต่อ: #' + ticket + ' ตามด้วยข้อความ',
    'red'
  );

  // ไม่ตอบอะไรกลับให้ผู้ถาม — เขาเพิ่งพิมพ์เอง รู้อยู่แล้วว่าส่งไปแล้ว
  // ข้อความ "ได้รับแล้ว" ทุกครั้งจะทำให้แชทเต็มไปด้วยเสียงตอบรับของบอท
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

  /*
   * ⚠️ สองบรรทัดท้ายคือเครื่องมือวินิจฉัยที่ทำงานจากในแชทโดยตรง
   *
   * ปัญหาที่เจอจริง: LINE อาจชี้ไปที่ deployment เก่าคนละอันกับที่เราแก้
   * แล้วทุกอย่างที่ตรวจจากหน้าจอ (/exec, checkCodeFiles) จะดูปกติหมด
   * เพราะไปตรวจอันใหม่ — บรรทัด "เวอร์ชันที่ตอบ" พิมพ์จากโค้ดที่กำลังรัน
   * ตอบข้อความนี้จริง ๆ จึงโกหกไม่ได้
   *
   * ส่วน "สถานะกลุ่ม" รัน isStaffGroup_ กับ id จริงของห้องนี้ ตัดปัญหา
   * การคัดลอก id ไปเทียบเองซึ่งพลาดช่องว่างที่มองไม่เห็นได้ง่าย
   */
  let staffLine = '';
  if (sourceType === 'group' || sourceType === 'room') {
    let isStaff = false;
    try {
      isStaff = isStaffGroup_(id);
    } catch (err) {
      staffLine = '\n\n⚠️ ตรวจสถานะกลุ่มไม่ได้: ' + err;
    }
    if (!staffLine) {
      staffLine = isStaff
        ? '\n\n✅ ห้องนี้เป็นกลุ่มเจ้าหน้าที่ — คำสั่ง เมนู / เคสค้าง / นัดวันนี้ ใช้ได้'
        : '\n\n❌ ห้องนี้ไม่อยู่ในกลุ่มเจ้าหน้าที่ — บอทจะไม่ตอบคำสั่งใด ๆ ที่นี่';
    }
  }

  return (
    'ID ของที่นี่คือ\n' +
    id + '\n\n' +
    'ประเภท: ' + (sourceType || 'ไม่ทราบ') + '\n\n' +
    'นำไปวางที่ Apps Script → Project Settings → Script Properties\n' +
    'ชื่อ: ' + target +
    staffLine +
    '\n\nเวอร์ชันที่ตอบข้อความนี้: ' + API_VERSION
  );
}

/* ------------------------------------------------------------------ */
/* ผูกบัญชี LINE เพื่อรับลิงก์คำตอบโดยไม่ต้องเปิดอีเมล                      */
/* ------------------------------------------------------------------ */

/**
 * ⚠️ หัวใจของความปลอดภัยอยู่ที่ "รหัสไปที่อีเมล ไม่ได้ไปที่ LINE"
 *
 * คนที่พิมพ์เบอร์ของคนอื่นจะไม่มีวันได้รหัส เพราะรหัสวิ่งไปที่อีเมล
 * ที่ลงทะเบียนไว้กับเคสของเบอร์นั้น การผูกสำเร็จจึงพิสูจน์ได้จริงว่า
 * คนที่กำลังคุยอยู่เข้าถึงอีเมลนั้นได้ — เท่ากับเป็นเจ้าของเคสเหล่านั้น
 *
 * เบอร์อย่างเดียวไม่พอ เพราะเบอร์แพทย์อยู่บนใบ refer และทำเนียบโรงพยาบาล
 */
function startLinkFlow_(event, userId) {
  const existing = findLineLink_(userId);
  if (existing) {
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text:
        'บัญชีนี้ผูกไว้แล้วครับ ✓\n\n' +
        'เบอร์ที่ผูก: ' + maskPhone_(existing['referrer_phone']) + '\n\n' +
        'เมื่อมีคำตอบใหม่ ระบบจะส่งลิงก์มาที่แชทนี้ให้อัตโนมัติ' },
      [{ label: 'ผูกเบอร์ใหม่', text: 'ผูกบัญชี ใหม่' },
       { label: 'เลิกผูก', text: 'เลิกผูก' }])]);
    return;
  }

  writeContactFlow_(userId, { step: 'linkPhone' });
  replyLineMessage_(event.replyToken, [withQuickReply_(
    { type: 'text', text:
      'ผูกบัญชีครั้งเดียว แล้วครั้งหน้าไม่ต้องเปิดอีเมลอีก\n\n' +
      'พิมพ์เบอร์โทรที่ใช้ตอนส่งเคสเข้ามาครับ\n' +
      'ระบบจะส่งรหัส 6 หลักไปที่อีเมลที่ลงทะเบียนไว้ แล้วนำรหัสนั้นมาพิมพ์ที่นี่' },
    cancelQuickReply_())]);
}

/** ปิดกลางเบอร์ก่อนแสดง — ยืนยันได้ว่าเบอร์ไหนโดยไม่เปิดเผยทั้งเบอร์ */
function maskPhone_(phone) {
  const d = digitsOnly_(phone);
  return d.length < 6 ? d : d.slice(0, 3) + 'xxx' + d.slice(-3);
}

function handleLinkPhone_(event, text, userId) {
  const digits = digitsOnly_(text);
  if (digits.length < 9) {
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text: 'เบอร์โทรไม่ครบ กรุณาพิมพ์ใหม่ เช่น 081-234-5678' },
      cancelQuickReply_())]);
    return;
  }

  if (!lineCasesLookupAllowed_(userId)) {
    clearContactFlow_(userId);
    replyLineMessage_(event.replyToken,
      'ลองบ่อยเกินไป กรุณารออีกสักครู่');
    return;
  }

  const email = findEmailByPhone_(digits);
  if (!email) {
    clearContactFlow_(userId);
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text:
        'ไม่พบเคสของเบอร์นี้ หรือเคสของเบอร์นี้ไม่มีอีเมลบันทึกไว้\n\n' +
        'ตรวจว่าเป็นเบอร์เดียวกับที่กรอกตอนส่งเคสหรือไม่' },
      [{ label: 'ขอติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' }])]);
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  CacheService.getScriptCache().put(
    'line_link_' + userId,
    JSON.stringify({ code: code, phone: digits, email: email }),
    600
  );
  writeContactFlow_(userId, { step: 'linkCode' });

  sendLinkCodeEmail_(email, code);

  // ไม่บอกว่าอีเมลอะไร — คนที่พิมพ์เบอร์อาจไม่ใช่เจ้าของ
  replyLineMessage_(event.replyToken, [withQuickReply_(
    { type: 'text', text:
      'ส่งรหัส 6 หลักไปที่อีเมลที่ลงทะเบียนไว้กับเบอร์นี้แล้ว\n\n' +
      'กรุณาพิมพ์รหัสที่ได้รับ (ใช้ได้ 10 นาที)\n' +
      'ตรวจโฟลเดอร์จดหมายขยะด้วยหากไม่พบ' },
    cancelQuickReply_())]);
}

function handleLinkCode_(event, text, userId) {
  const raw = CacheService.getScriptCache().get('line_link_' + userId);
  if (!raw) {
    clearContactFlow_(userId);
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text: 'รหัสหมดอายุแล้ว (ใช้ได้ 10 นาที) กรุณาเริ่มใหม่' },
      [{ label: 'ผูกบัญชีใหม่', text: 'ผูกบัญชี' }])]);
    return;
  }

  const pending = JSON.parse(raw);
  if (digitsOnly_(text) !== pending.code) {
    replyLineMessage_(event.replyToken, [withQuickReply_(
      { type: 'text', text: 'รหัสไม่ถูกต้อง กรุณาพิมพ์ใหม่' },
      cancelQuickReply_())]);
    return;
  }

  saveLineLink_(userId, pending.phone, pending.email);
  CacheService.getScriptCache().remove('line_link_' + userId);
  clearContactFlow_(userId);

  replyLineMessage_(event.replyToken,
    'ผูกบัญชีเรียบร้อยแล้ว ✓\n\n' +
    'ตั้งแต่นี้ไป เมื่อทีมตอบคำปรึกษาเคสของเบอร์ ' + maskPhone_(pending.phone) +
    '\nระบบจะส่งลิงก์เปิดคำตอบมาที่แชทนี้ให้ทันที ไม่ต้องเปิดอีเมลอีก\n\n' +
    'อีเมลยังส่งตามปกติเหมือนเดิม\n' +
    'ต้องการเลิกผูกเมื่อไร พิมพ์ "เลิกผูก" ได้เลย');
}

function handleUnlink_(event, userId) {
  clearContactFlow_(userId);
  const removed = removeLineLink_(userId);
  replyLineMessage_(event.replyToken,
    removed
      ? 'เลิกผูกบัญชีแล้ว ✓\n\nคำตอบจะส่งทางอีเมลอย่างเดียวเหมือนเดิม'
      : 'บัญชีนี้ยังไม่ได้ผูกไว้ครับ');
}

/* ---------- อ่าน/เขียนแท็บ line_links ---------- */

/** แถวที่ผูกไว้ของ LINE id นี้ — คืน null ถ้าไม่มีหรือถูกปิดไว้ */
function findLineLink_(userId) {
  try {
    const rows = readRows_(getSheet_(SHEETS.lineLinks));
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i]['line_user_id'] || '').trim() !== userId) continue;
      const active = String(rows[i]['active'] || '').toLowerCase();
      if (active === 'no' || active === 'false') continue;
      return rows[i];
    }
  } catch (err) {
    console.warn('อ่าน line_links ไม่สำเร็จ: ' + err);
  }
  return null;
}

/** LINE id ของแพทย์ต้นทางที่ผูกเบอร์นี้ไว้ — ใช้ตอนมีคำตอบใหม่ */
function findLineUserByPhone_(phone) {
  const digits = digitsOnly_(phone);
  if (digits.length < 9) return '';
  try {
    const rows = readRows_(getSheet_(SHEETS.lineLinks));
    for (let i = 0; i < rows.length; i++) {
      if (phoneKey_(rows[i]['referrer_phone']) !== phoneKey_(digits)) continue;
      const active = String(rows[i]['active'] || '').toLowerCase();
      if (active === 'no' || active === 'false') continue;
      return String(rows[i]['line_user_id'] || '').trim();
    }
  } catch (err) {
    console.warn('อ่าน line_links ไม่สำเร็จ: ' + err);
  }
  return '';
}

/**
 * บันทึกการผูก — ทับของเดิมของ LINE id นั้นถ้ามี
 *
 * ทับแทนการเพิ่มแถวใหม่ เพราะคนเปลี่ยนเบอร์หรือเปลี่ยนเครื่องแล้วผูกซ้ำ
 * ไม่ควรมีสองแถวที่ขัดกันเอง แล้วโค้ดต้องเดาว่าอันไหนจริง
 */
function saveLineLink_(userId, phone, email) {
  const sheet = getSheet_(SHEETS.lineLinks);
  const map = ensureColumns_(sheet, LINE_LINK_COLUMNS);
  const rows = readRows_(sheet);

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]['line_user_id'] || '').trim() === userId) {
      setCell_(sheet, map, rows[i]._row, 'referrer_phone', phone);
      setCell_(sheet, map, rows[i]._row, 'referrer_email', email);
      setCell_(sheet, map, rows[i]._row, 'linked_at', new Date());
      setCell_(sheet, map, rows[i]._row, 'active', 'yes');
      return;
    }
  }

  sheet.appendRow([userId, phone, email, new Date(), 'yes']);
}

/** ปิดการผูก — ไม่ลบแถว เพื่อให้ยังตรวจสอบย้อนหลังได้ว่าเคยผูกเมื่อไร */
function removeLineLink_(userId) {
  const sheet = getSheet_(SHEETS.lineLinks);
  const map = ensureColumns_(sheet, LINE_LINK_COLUMNS);
  const rows = readRows_(sheet);

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]['line_user_id'] || '').trim() !== userId) continue;
    if (String(rows[i]['active'] || '').toLowerCase() === 'no') continue;
    setCell_(sheet, map, rows[i]._row, 'active', 'no');
    return true;
  }
  return false;
}

/** อีเมลที่ลงทะเบียนไว้กับเบอร์นี้ — เอาจากเคสล่าสุดที่มีอีเมล */
function findEmailByPhone_(digits) {
  const rows = readRows_(getSheet_(SHEETS.referrals)).filter(function (r) {
    return phoneKey_(r['referrer_phone']) === phoneKey_(digits) &&
      String(r['referrer_email'] || '').trim();
  });
  if (rows.length === 0) return '';

  rows.sort(function (a, b) {
    const x = toDate_(a['submitted_at']), y = toDate_(b['submitted_at']);
    return (y ? y.getTime() : 0) - (x ? x.getTime() : 0);
  });
  return String(rows[0]['referrer_email']).trim();
}
