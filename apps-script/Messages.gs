/**
 * บทสนทนาต่อเนื่องต่อเคส (Case Conversation)
 *
 * แพทย์ต้นทาง ↔ resident/fellow คุยถาม-ตอบต่อหนึ่งเคส เก็บทุกข้อความในชีต
 * messages เป็น record — คุยได้ทั้งเว็บและ LINE (ดู LineWebhook.gs สำหรับ LINE)
 *
 * ประหยัดโควตา LINE: reply (ฟรี) เป็นหลัก, push เตือนอีกฝั่งแบบ "รวบครั้งเดียว"
 * ต่อรอบ (ดู notifyCounterparty_) — พิมพ์รัว ๆ ก่อนอีกฝั่งอ่าน จะไม่ push ซ้ำ
 */

const MESSAGE_COLUMNS = [
  'message_id', 'referral_id', 'sender_role', 'sender_name',
  'channel', 'text', 'created_at', 'file_name', 'file_url',
];

// คอลัมน์ที่เพิ่มในชีต referrals เพื่อรองรับ thread
const CASE_THREAD_COLUMNS = ['case_token', 'referrer_unread', 'dent_unread'];

/** token 32 ตัวต่อเคส — สร้างถ้ายังไม่มี (เคสเก่าที่ส่งก่อนมีฟีเจอร์นี้) */
function ensureCaseToken_(sheet, map, row) {
  const existing = String(readCell_(sheet, map, row._row, 'case_token') || '').trim();
  if (existing) return existing;
  const token = generateManageToken_();
  const map2 = ensureColumns_(sheet, CASE_THREAD_COLUMNS);
  setCell_(sheet, map2, row._row, 'case_token', token);
  return token;
}

/** ชีต messages — สร้างให้อัตโนมัติถ้ายังไม่มี (ไม่ต้องรัน setupSheets ก่อน) */
function ensureMessagesSheet_() {
  // ⚠️ ใช้ชื่อ 'messages' ตายตัว ไม่พึ่ง SHEETS.messages
  //
  // ถ้า Config.gs ที่ deploy เป็นฉบับเก่าที่ยังไม่มี messages ใน SHEETS
  // ค่าจะเป็น undefined แล้ว insertSheet(undefined) จะสร้างแท็บชื่อ "SheetN"
  // ใหม่ทุกครั้ง (หาแท็บเดิมไม่เจอเพราะชื่อ undefined) — บั๊กนี้ทำให้ทุกข้อความ
  // แตกไปคนละแท็บ และ loadMessages ฝั่งเว็บอ่านแท็บ 'messages' ที่ว่างเปล่า
  const name = SHEETS.messages || 'messages';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, MESSAGE_COLUMNS.length).setValues([MESSAGE_COLUMNS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** เขียนหนึ่งข้อความลงชีต messages (fileName/fileUrl เว้นว่างได้) */
function appendMessage_(referralId, role, name, channel, text, fileName, fileUrl) {
  const sheet = ensureMessagesSheet_();
  const map = ensureColumns_(sheet, MESSAGE_COLUMNS);
  const rowArr = new Array(sheet.getLastColumn()).fill('');
  rowArr[map['message_id']] = Utilities.getUuid();
  rowArr[map['referral_id']] = referralId;
  rowArr[map['sender_role']] = role;
  rowArr[map['sender_name']] = name || '';
  rowArr[map['channel']] = channel;
  rowArr[map['text']] = text;
  rowArr[map['created_at']] = new Date();
  rowArr[map['file_name']] = fileName || '';
  rowArr[map['file_url']] = fileUrl || '';
  sheet.appendRow(rowArr);
}

/** ล้างธง unread ของฝั่งที่เพิ่งเข้ามาอ่าน/ตอบ (side = 'referrer' | 'dent') */
function markCaughtUp_(sheet, map, row, side) {
  const col = side === 'referrer' ? 'referrer_unread' : 'dent_unread';
  const map2 = ensureColumns_(sheet, CASE_THREAD_COLUMNS);
  setCell_(sheet, map2, row._row, col, '');
}

/** กลุ่ม LINE ที่ dent ของเคสนี้อยู่ — กลุ่ม 1 = fellow, อื่น ๆ = resident */
function caseAudience_(referralType) {
  return String(referralType).trim() === TYPES.transplant ? 'fellow' : 'batch';
}

/**
 * แจ้งอีกฝั่งว่ามีข้อความใหม่ — push แบบรวบครั้งเดียวต่อรอบ
 *
 * ตั้งธง unread ของอีกฝั่ง แล้ว push เฉพาะตอนเพิ่งเปลี่ยนจากว่าง → yes
 * (ข้อความแรกหลังอีกฝั่งอ่านทัน) เพื่อไม่เปลืองโควตา push เวลาพิมพ์หลายที
 */
/**
 * อ่านสวิตช์ push จาก config sheet — ประหยัดโควตา LINE
 *   chat_push_dent     = on/off (ไม่ตั้ง = off) → push เตือน dent ต่อข้อความ
 *   chat_push_referrer = on/off (ไม่ตั้ง = on)  → push เตือนแพทย์ต้นทางต่อข้อความ
 * ปิดแล้วยังมี: ป้าย 💬 บน dashboard (ฟรี) + รอบ 10:00 (ฟรี) + อีเมล (ฟรี)
 */
function chatPushOn_(key, defaultOn) {
  const v = readConfigValue_(key).toLowerCase();
  if (v === 'on' || v === 'yes' || v === 'true' || v === 'เปิด') return true;
  if (v === 'off' || v === 'no' || v === 'false' || v === 'ปิด') return false;
  return defaultOn;
}

function notifyCounterparty_(sheet, map, row, senderRole, text, fileUrl, urgent, dentChannel) {
  const referralId = String(row['referral_id'] || '').trim();
  const caseToken = ensureCaseToken_(sheet, map, row);
  const map2 = ensureColumns_(sheet, CASE_THREAD_COLUMNS);
  // อ่านค่าปัจจุบันจากเซลล์จริง (row object อาจเก่ากว่าที่เพิ่ง set)
  const preview = String(text || '').slice(0, 300);
  const fileLine = fileUrl ? '\n📎 เปิดไฟล์แนบ: ' + fileUrl : '';

  if (senderRole === 'referrer') {
    // แจ้ง dent ที่กลุ่ม LINE
    const wasPending =
      String(readCell_(sheet, map2, row._row, 'dent_unread') || '')
        .toLowerCase() === 'yes';
    setCell_(sheet, map2, row._row, 'dent_unread', 'yes');
    const audience = caseAudience_(row['referral_type']);
    // Telegram แจ้งเตือน dent (ฟรี) — เข้าไปตอบใน LINE (reply ฟรี), Telegram
    // (ถ้าตั้ง webhook), หรือ dashboard · coalesce ต่อชุดข้อความที่ยังไม่อ่าน
    if (!wasPending) {
      sendTelegram_(
        '💬 ' + referralId + ' มีข้อความจากแพทย์ต้นทาง\n' +
        '“' + preview + '”' + fileLine + '\n' +
        '─────────\n' +
        'เข้าไปตอบได้ที่ (ฟรีทุกช่อง):\n' +
        '• พิมพ์  ตอบ ' + referralId + ': <ข้อความ>  ในกลุ่ม (LINE/Telegram)\n' +
        '• หรือ dashboard → ' + SITE_URL + '/dashboard',
        audience);
    }
    // ป้าย 💬 บน dashboard ขึ้นเสมอ (ฟรี) · LINE push เมื่อ "แพทย์กดด่วน" หรือเปิดสวิตช์
    if (!wasPending && linePushEnabled_() &&
        (urgent || chatPushOn_('chat_push_dent', false))) {
      pushDentNudgeWithQuote_(audience, referralId,
        '💬 ' + referralId + ' มีข้อความจากแพทย์ต้นทาง\n' +
        '“' + preview + '”' + fileLine + '\n' +
        '─────────\n' +
        '↩️ ตอบง่าย ๆ: แตะค้างข้อความนี้ → "ตอบกลับ" แล้วพิมพ์คำตอบได้เลย\n' +
        '(หรือพิมพ์  ตอบ ' + referralId + ': <ข้อความ>  · หรือเปิด ' +
        SITE_URL + '/dashboard)');
    }
  } else {
    // แจ้งแพทย์ต้นทาง: push ทุกข้อความทันที + อีเมลเสมอ (ฟรี)
    //
    // ไม่ coalesce ฝั่งนี้ (ต่างจากฝั่ง dent): แพทย์ต้นทางอยากได้คำตอบทันที
    // ไม่ควรรอ และคำตอบจาก dent มีไม่บ่อย จึงไม่เปลืองโควตามากนัก
    // (มติผู้ใช้ 5 ก.ย. 2569)
    setCell_(sheet, map2, row._row, 'referrer_unread', 'yes');

    // dent เลือกช่องแจ้งเองต่อข้อความ (chat=ไม่แจ้ง / email / line=LINE เท่านั้น)
    // ค่าว่าง (ข้อความ dent จาก LINE) = ค่าเดิม: อีเมล + push ตามสวิตช์ config
    const ch = String(dentChannel || '').toLowerCase();
    const wantEmail = ch === 'email' || ch === '';
    // LINE ถึงแพทย์ต้นทาง = push รายคน 1 ข้อความ (ถูก ไม่คิดรายหัวเหมือน push กลุ่ม)
    // จึงเปิดอิสระจากสวิตช์กลุ่ม line_push — คุมด้วย config line_push_referrer
    // (ค่าเริ่มต้น on) หรือเมื่อ dent เลือกช่อง 'line' โดยตรง · ต้องผูก LINE ไว้ถึงจะส่งได้
    const wantLine = ch === 'line' ||
      (ch === '' && chatPushOn_('line_push_referrer', true));

    const email = String(row['referrer_email'] || '').trim();
    if (email && wantEmail) {
      sendMessageEmailToReferrer_(email, referralId, caseToken,
        preview + (fileUrl ? '\n📎 ไฟล์แนบ: ' + fileUrl : ''),
        String(row['sender_name'] || 'ทีมโลหิตวิทยา'));
    }
    const userId = wantLine ? findLineUserByPhone_(row['referrer_phone']) : '';
    if (userId) {
      const token = PropertiesService.getScriptProperties()
        .getProperty('LINE_CHANNEL_ACCESS_TOKEN');
      if (token) {
        sendOneLinePush_(token, userId,
          '💬 เคส ' + referralId + ' มีข้อความตอบกลับจากทีมโลหิตวิทยา\n' +
          '“' + preview + '”' + fileLine + '\n' +
          'อ่าน/ตอบต่อ: ' + SITE_URL + '/case/' + caseToken);
      }
    }
  }
}

/** อีเมลแจ้งแพทย์ต้นทางว่ามีข้อความใหม่ (เนื้อความเต็ม + ลิงก์) */
function sendMessageEmailToReferrer_(email, referralId, caseToken, text, fromName) {
  const body =
    'มีข้อความใหม่ในเคส ' + referralId + '\n\n' +
    'จาก: ' + fromName + '\n' +
    'ข้อความ:\n' + text + '\n\n' +
    buildCaseActionsBlock_(caseToken) +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ (ใช้ลิงก์ด้านบนแทน)';
  try {
    MailApp.sendEmail({
      to: email,
      subject: 'ข้อความใหม่ในเคส ' + referralId,
      body: body,
    });
  } catch (err) {
    console.error('ส่งอีเมลข้อความใหม่ไม่สำเร็จ (' + referralId + '): ' + err);
  }
}

/**
 * บล็อกลิงก์ "ถามเพิ่ม / จบเคส" ต่อท้ายอีเมล — ให้แพทย์ต้นทางเลือกได้เลย
 * ลิงก์จบเคสพาไปหน้ายืนยันก่อน (ไม่ปิดทันทีจากการคลิก กันสแกนเนอร์อีเมลกดเอง)
 */
function buildCaseActionsBlock_(caseToken, includeClose) {
  if (!caseToken) return '';
  let s = 'เลือกได้:\n' +
    '  • มีคำถามเพิ่ม / อ่านทั้งหมด → ' + SITE_URL + '/case/' + caseToken + '\n';
  if (includeClose !== false) {
    s += '  • พอใจคำตอบแล้ว จบเคส → ' + SITE_URL + '/case/' + caseToken + '?done=1\n';
  }
  return s + '\n';
}

/* ------------------------------------------------------------------ */
/* doPost actions (เรียกจากเว็บ)                                       */
/* ------------------------------------------------------------------ */

/** แพทย์ต้นทางส่งข้อความ (+ ไฟล์แนบ ถ้ามี) จากหน้า /case/[token] */
function postReferrerMessage_(payload) {
  const caseToken = String(payload.caseToken || '').trim();
  const text = String(payload.text || '').trim();
  const hasFile = !!String(payload.fileBase64 || '');
  if (!caseToken) throw new Error('ลิงก์ไม่ถูกต้อง');
  if (!text && !hasFile) throw new Error('ยังไม่ได้พิมพ์ข้อความหรือแนบไฟล์');
  if (text.length > 5000) throw new Error('ข้อความยาวเกินไป');

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['case_token'] || '').trim() === caseToken;
  })[0];
  if (!row) throw new Error('ลิงก์ไม่ถูกต้อง หรือเคสนี้ถูกปิดไปแล้ว');

  // เคสที่ปิดเองแล้ว ต้องกด "เปิดเคสใหม่" ก่อนถึงจะถามเพิ่มได้ — ไม่แทรกเงียบ ๆ
  if (String(row['status'] || '').trim() === 'Closed') {
    throw new Error('เคสนี้ปิดแล้ว — กรุณากด "เปิดเคสใหม่เพื่อถามเพิ่ม" ก่อน');
  }

  const referralId = String(row['referral_id'] || '').trim();
  // อัปไฟล์ขึ้น Drive (ใช้ตัวเดียวกับไฟล์แนบคำตอบ — ตรวจชนิด/ขนาดให้แล้ว)
  const attachment = hasFile
    ? uploadAdviceAttachment_(payload, referralId) : null;

  const name = String(row['referrer_org'] || 'แพทย์ต้นทาง').trim();
  appendMessage_(referralId, 'referrer', name, 'web', text,
    attachment ? attachment.name : '', attachment ? attachment.url : '');
  markCaughtUp_(sheet, map, row, 'referrer');
  // ข้อความแจ้งเตือน: ถ้าไม่มีข้อความ ใช้ชื่อไฟล์เป็นตัวอย่าง
  const notice = text || ('📎 ' + (attachment ? attachment.name : 'ไฟล์แนบ'));
  const urgent = payload.urgent === true || String(payload.urgent) === 'true';
  notifyCounterparty_(sheet, map, row, 'referrer', notice,
    attachment ? attachment.url : '', urgent);
  return {
    ok: true,
    fileUrl: attachment ? attachment.url : '',
    fileName: attachment ? attachment.name : '',
  };
}

/** เปิดเคสที่ปิดไปแล้วกลับมาถามเพิ่ม (จากหน้า /case) — ยืนยันด้วย case_token */
function reopenCaseByToken_(payload) {
  const caseToken = String(payload.caseToken || '').trim();
  if (!caseToken) throw new Error('ลิงก์ไม่ถูกต้อง');
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['case_token'] || '').trim() === caseToken;
  })[0];
  if (!row) throw new Error('ลิงก์ไม่ถูกต้อง');
  reopenReferralRow_(sheet, map, row);
  return { ok: true };
}

/** ตั้งเคสกลับเป็น "รอตรวจ" + ล้างเวลาปิด + บันทึก log (ใช้ทั้ง web และ LINE) */
function reopenReferralRow_(sheet, map, row) {
  const prev = String(row['status'] || '').trim();
  setCell_(sheet, map, row._row, 'status', 'Pending Review');
  setCell_(sheet, map, row._row, 'closed_at', '');
  logStatusChange_(row['referral_id'], prev, 'Pending Review', 'referrer',
    'แพทย์ต้นทางเปิดเคสใหม่เพื่อถามเพิ่ม');
}

/** dent ส่งข้อความจาก dashboard */
function postDentMessage_(payload) {
  const referralId = String(payload.referralId || '').trim();
  const text = String(payload.text || '').trim();
  const senderName = String(payload.senderName || '').trim();
  if (!referralId) throw new Error('ไม่ได้ระบุเลขที่อ้างอิงของเคส');
  if (!text) throw new Error('ยังไม่ได้พิมพ์ข้อความ');
  if (text.length > 5000) throw new Error('ข้อความยาวเกินไป');

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === referralId;
  })[0];
  if (!row) throw new Error('ไม่พบเคส ' + referralId + ' — กรุณาโหลดหน้าใหม่');

  appendMessage_(referralId, 'resident', senderName || 'ทีมโลหิตวิทยา', 'web', text);
  markCaughtUp_(sheet, map, row, 'dent');
  notifyCounterparty_(sheet, map, row, 'resident', text, '', false,
    payload.notifyChannel);
  return { ok: true };
}

/**
 * แพทย์ต้นทางจบเคสเองจากหน้า /case (อ่านคำแนะนำแล้วดูแลต่อได้เอง)
 * ยืนยันสิทธิ์ด้วย case_token — ตั้งสถานะ Closed + ประทับ closed_at
 */
function closeCaseByToken_(payload) {
  const caseToken = String(payload.caseToken || '').trim();
  if (!caseToken) throw new Error('ลิงก์ไม่ถูกต้อง');

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['case_token'] || '').trim() === caseToken;
  })[0];
  if (!row) throw new Error('ลิงก์ไม่ถูกต้อง');

  const prev = String(row['status'] || '').trim();
  setCell_(sheet, map, row._row, 'status', 'Closed');
  if (!String(row['closed_at'] || '').trim()) {
    setCell_(sheet, map, row._row, 'closed_at', new Date());
  }
  logStatusChange_(row['referral_id'], prev, 'Closed', 'referrer',
    'แพทย์ต้นทางจบเคสเอง');
  return { ok: true };
}

/** ล้างธง unread เมื่อฝ่ายนั้นเปิดอ่าน thread (เรียกตอนโหลดหน้า) */
function markThreadRead_(payload) {
  const side = payload.side === 'referrer' ? 'referrer' : 'dent';
  const referralId = String(payload.referralId || '').trim();
  const caseToken = String(payload.caseToken || '').trim();

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    if (caseToken) return String(r['case_token'] || '').trim() === caseToken;
    return String(r['referral_id'] || '').trim() === referralId;
  })[0];
  if (!row) return { ok: true };
  markCaughtUp_(sheet, map, row, side);
  return { ok: true };
}

/* ================================================================== */
/* LINE typing (Phase 2) — พิมพ์ตอบผ่าน LINE ทั้งสองฝั่ง               */
/* reply (ฟรี) เป็นหลัก · push เตือนอีกฝั่งแบบรวบ (ดู notifyCounterparty_)*/
/* ================================================================== */

// dent พิมพ์ในกลุ่ม:  ตอบ HEM-xxxx: <ข้อความ>
const LINE_DENT_REPLY_PATTERN =
  /^ตอบ\s+(HEM-\d{8}-\d{4})\s*[:：]\s*([\s\S]+)$/i;

// isStaffGroup_(sourceId) นิยามไว้แล้วใน GroupQuery.gs (ใช้ dashboardLineGroups_
// เป็นแหล่งข้อมูลเดียว) — ใช้ตัวนั้นร่วมกัน ไม่ประกาศซ้ำที่นี่เพื่อกันฟังก์ชันชนกัน

/** เคสที่ยังไม่จบของแพทย์ต้นทางเบอร์นี้ */
function openCasesForPhone_(phone) {
  const key = phoneKey_(phone);
  if (!key) return [];
  return readRows_(getSheet_(SHEETS.referrals)).filter(function (r) {
    return phoneKey_(r['referrer_phone']) === key && !isTerminal_(r['status']);
  });
}

/**
 * dent ตอบแพทย์ต้นทางจากในกลุ่ม — คืน true ถ้าจัดการแล้ว
 * จำกัดเฉพาะกลุ่มเจ้าหน้าที่ที่ตั้งค่าไว้ (กันคนนอกแอบส่งในนาม dent)
 */
function handleDentReply_(event, text, sourceId) {
  const m = text.match(LINE_DENT_REPLY_PATTERN);
  if (!m) return false;
  if (!isStaffGroup_(sourceId)) return false;

  const referralId = m[1].toUpperCase();
  const body = String(m[2] || '').trim();
  if (!body) return false;

  appendDentLineReply_(event, referralId, body);
  return true;
}

/**
 * แพทย์ต้นทางที่ผูก LINE พิมพ์ข้อความอิสระ = ส่งถึงทีมในเคสตัวเอง
 * คืน true ถ้าจัดการแล้ว (ผูกบัญชีอยู่) — false = ปล่อยให้ระบบตอบ "ไม่แน่ใจ" ต่อ
 */
function handleReferrerLineMessage_(event, text, userId) {
  const link = findLineLink_(userId);
  if (!link) return false;

  const open = openCasesForPhone_(link['referrer_phone']);
  if (open.length === 0) {
    replyLineMessage_(event.replyToken,
      'ตอนนี้ไม่พบเคสที่กำลังดำเนินการของท่าน\n' +
      'ถ้าต้องการส่งเคสใหม่ กรุณากรอกแบบฟอร์มส่งต่อ หรือพิมพ์ "เคสของฉัน" เพื่อดูรายการ');
    return true;
  }

  // ถามสั้น ๆ เชิง "เช็คคำตอบ" = อ่านคำตอบล่าสุดของทีม (ฟรี) โดยไม่โพสต์ทับ thread
  if (/(คำตอบ|อัปเดต|มีอะไรใหม่|ล่าสุด|เช็ค|update)/i.test(text) &&
      text.length <= 30) {
    const sheet = getSheet_(SHEETS.referrals);
    const map = headerMap_(sheet);
    let msg = '';
    open.forEach(function (r) {
      const id = String(r['referral_id'] || '').trim();
      const latest = latestTeamMessageFor_(id);
      const token = ensureCaseToken_(sheet, map, r);
      msg += '📋 ' + id + '\n' +
        (latest ? '💬 ทีมตอบล่าสุด:\n“' + latest + '”\n' : 'ยังไม่มีคำตอบจากทีม\n') +
        SITE_URL + '/case/' + token + '\n\n';
    });
    replyLineMessage_(event.replyToken, msg + 'พิมพ์ข้อความเพื่อถามทีมเพิ่มได้เลยครับ');
    return true;
  }

  if (open.length === 1) {
    routeReferrerMessageToCase_(event, open[0], text);
    return true;
  }

  // หลายเคส → ให้เลือกก่อน แล้วค่อยส่งข้อความที่พิมพ์ไว้
  const ids = open.map(function (r) { return String(r['referral_id'] || ''); });
  writeContactFlow_(userId, {
    step: 'pickCaseForMessage', pendingText: text, caseIds: ids,
  });
  replyLineMessage_(event.replyToken, [withQuickReply_(
    { type: 'text',
      text: 'ท่านมีหลายเคสที่กำลังดำเนินการ — เลือกเคสที่จะส่งข้อความนี้:' },
    caseQuickReply_(ids))]);
  return true;
}

/** ปุ่มลัดเลือกเคส (รหัสอ้างอิง) + ปุ่มยกเลิก */
function caseQuickReply_(ids) {
  const items = ids.slice(0, 12).map(function (id) {
    return { label: id.replace('HEM-', ''), text: id };
  });
  items.push({ label: '✕ ยกเลิก', text: 'ยกเลิก' });
  return items;
}

/** เขียนข้อความของแพทย์ต้นทางลงเคส + แจ้ง dent + ตอบรับ (reply ฟรี) */
function routeReferrerMessageToCase_(event, row, text) {
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const referralId = String(row['referral_id'] || '').trim();
  const name = String(row['referrer_org'] || 'แพทย์ต้นทาง').trim();

  appendMessage_(referralId, 'referrer', name, 'line', text);
  markCaughtUp_(sheet, map, row, 'referrer');
  notifyCounterparty_(sheet, map, row, 'referrer', text);

  // ตอบกลับด้วย reply (ฟรี) พร้อมคำตอบล่าสุดของทีม — คุยกันใน LINE ได้โดยไม่ push
  const caseToken = ensureCaseToken_(sheet, map, row);
  const latest = latestTeamMessageFor_(referralId);
  let reply = '📨 ส่งข้อความถึงทีมแล้ว (เคส ' + referralId + ')';
  if (latest) {
    reply += '\n\n💬 ทีมตอบล่าสุด:\n“' + latest + '”';
  }
  reply += '\n\nพิมพ์ทักมาได้อีกเพื่อดูอัปเดต (ฟรี) หรือเปิดอ่าน/ตอบทั้งหมด:\n' +
    SITE_URL + '/case/' + caseToken;
  replyLineMessage_(event.replyToken, reply);
}

/** ข้อความล่าสุดจากทีม (resident) ของเคสนี้ — ใช้โชว์ใน reply ฟรีให้แพทย์ต้นทาง */
function latestTeamMessageFor_(referralId) {
  let sheet;
  try {
    sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(SHEETS.messages || 'messages');
  } catch (err) { return ''; }
  if (!sheet) return '';

  const rows = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === referralId &&
      String(r['sender_role'] || '').trim() === 'resident';
  });
  if (rows.length === 0) return '';

  const last = rows[rows.length - 1];
  let t = String(last['text'] || '').trim();
  if (String(last['file_url'] || '').trim()) {
    t += (t ? '\n' : '') + '📎 ' + (last['file_name'] || 'ไฟล์แนบ') +
      ': ' + last['file_url'];
  }
  return t.slice(0, 500);
}

/** ผู้ใช้เลือกเคสที่จะส่งข้อความ (ตอนมีหลายเคส) */
function handlePickCaseForMessage_(event, flow, text, userId) {
  const ids = flow.caseIds || [];
  const raw = String(text || '').trim();
  const pick = raw.toUpperCase();

  let chosen = null;
  const asNum = parseInt(raw, 10);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= ids.length) {
    chosen = ids[asNum - 1];
  } else {
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i]).toUpperCase() === pick) { chosen = ids[i]; break; }
    }
    if (!chosen) {
      for (let j = 0; j < ids.length; j++) {
        if (String(ids[j]).toUpperCase().indexOf(pick) !== -1) {
          chosen = ids[j]; break;
        }
      }
    }
  }

  if (!chosen) {
    replyLineMessage_(event.replyToken,
      'ไม่พบเคสที่เลือก — พิมพ์รหัส HEM-... หรือเลขลำดับให้ตรง หรือพิมพ์ "ยกเลิก"');
    return;
  }

  const sheet = getSheet_(SHEETS.referrals);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === chosen;
  })[0];
  clearContactFlow_(userId);
  if (!row) {
    replyLineMessage_(event.replyToken, 'ไม่พบเคส ' + chosen + ' แล้ว');
    return;
  }
  routeReferrerMessageToCase_(event, row, flow.pendingText || '');
}

/* ================================================================== */
/* Quote-reply — dent แค่กด "ตอบกลับ" ข้อความแจ้งเตือนแล้วพิมพ์ ก็พอ     */
/* ไม่ต้องพิมพ์รหัสหรือคำสั่ง (fallback: ตอบ HEM-xxxx: ยังใช้ได้)         */
/* ================================================================== */

/**
 * push แจ้ง dent เข้ากลุ่ม แล้วจำ message id ไว้ผูกกับเคส
 * เพื่อให้การ "quote-reply" ข้อความนี้รู้ว่าเป็นเคสไหนโดยไม่ต้องพิมพ์รหัส
 */
function pushDentNudgeWithQuote_(audience, referralId, text) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  const targetKey = LINE_TARGET_BY_AUDIENCE[audience] || LINE_TARGET_FALLBACK;
  let target = props.getProperty(targetKey);
  let message = text;
  if (!target && targetKey !== LINE_TARGET_FALLBACK) {
    target = props.getProperty(LINE_TARGET_FALLBACK);
    if (target) {
      message = '(ส่งถึงคุณเพราะยังไม่ได้ตั้ง ' + targetKey + ')\n' +
        '──────────\n' + text;
    }
  }

  const targets = parseLineTargets_(target);
  if (!token || targets.length === 0) {
    console.log('[LINE ยังไม่ได้ตั้งค่า: ' + targetKey + '] ' + text);
    return;
  }

  targets.forEach(function (to) {
    const id = sendOneLinePush_(token, to, message);
    if (id) rememberQuoteTarget_(id, referralId);
  });
}

/** จำ (message id ที่บอทส่ง → referral_id) ไว้ 6 ชม. สำหรับ quote-reply */
function rememberQuoteTarget_(messageId, referralId) {
  try {
    CacheService.getScriptCache().put('quote_' + messageId, referralId, 21600);
  } catch (err) {
    console.warn('เก็บ quote map ไม่สำเร็จ: ' + err);
  }
}

function lookupQuoteTarget_(messageId) {
  if (!messageId) return '';
  try {
    return CacheService.getScriptCache().get('quote_' + messageId) || '';
  } catch (err) {
    return '';
  }
}

/**
 * dent กด "ตอบกลับ" (quote) ข้อความแจ้งเตือนของบอทในกลุ่ม แล้วพิมพ์คำตอบ
 * คืน true ถ้าจัดการแล้ว — ต้องเป็นกลุ่มเจ้าหน้าที่ และ quote ตรงกับเคสที่จำไว้
 */
function handleDentQuoteReply_(event, text, sourceId) {
  const quotedId = event.message && event.message.quotedMessageId;
  if (!quotedId) return false;
  if (!isStaffGroup_(sourceId)) return false;

  const referralId = lookupQuoteTarget_(quotedId);
  if (!referralId) return false;

  const body = String(text || '').trim();
  if (!body) return false;

  appendDentLineReply_(event, referralId, body);
  return true;
}

/** เขียนคำตอบ dent จาก LINE ลงเคส + แจ้งแพทย์ต้นทาง + ตอบรับในกลุ่ม (reply ฟรี) */
function appendDentLineReply_(event, referralId, body) {
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === referralId;
  })[0];
  if (!row) {
    replyLineMessage_(event.replyToken, 'ไม่พบเคส ' + referralId + ' ในระบบ');
    return;
  }
  appendMessage_(referralId, 'resident', 'ทีมโลหิตวิทยา', 'line', body);
  markCaughtUp_(sheet, map, row, 'dent');
  notifyCounterparty_(sheet, map, row, 'resident', body);
  replyLineMessage_(event.replyToken,
    '✅ บันทึกและส่งถึงแพทย์ต้นทางแล้ว (เคส ' + referralId + ')');
}

/* ================================================================== */
/* ปุ่มลัด LINE ของแพทย์ต้นทาง: จบเคส / ถามเพิ่ม (จากการ์ดคำตอบ)         */
/* ================================================================== */

/**
 * แพทย์ต้นทางแตะปุ่ม "จบเคส HEM-xxxx" หรือ "ถามเพิ่ม HEM-xxxx" ใน LINE
 * คืน true ถ้าจัดการแล้ว — ยืนยันสิทธิ์ด้วย line_link (เบอร์ต้องตรงกับเคส)
 */
function handleReferrerCommand_(event, text, userId) {
  const mClose = text.match(/^จบเคส\s+(HEM-\d{8}-\d{4})/i);
  const mMore = text.match(/^ถามเพิ่ม\s+(HEM-\d{8}-\d{4})/i);
  if (!mClose && !mMore) return false;

  const link = findLineLink_(userId);
  if (!link) return false;

  const referralId = (mClose ? mClose[1] : mMore[1]).toUpperCase();
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === referralId;
  })[0];
  if (!row) {
    replyLineMessage_(event.replyToken, 'ไม่พบเคส ' + referralId);
    return true;
  }
  if (phoneKey_(row['referrer_phone']) !== phoneKey_(link['referrer_phone'])) {
    replyLineMessage_(event.replyToken, 'เคสนี้ไม่ตรงกับบัญชีของท่าน');
    return true;
  }

  if (mClose) {
    const prev = String(row['status'] || '').trim();
    setCell_(sheet, map, row._row, 'status', 'Closed');
    if (!String(row['closed_at'] || '').trim()) {
      setCell_(sheet, map, row._row, 'closed_at', new Date());
    }
    logStatusChange_(referralId, prev, 'Closed', 'referrer',
      'แพทย์ต้นทางจบเคสเอง (LINE)');
    replyLineMessage_(event.replyToken,
      '✓ จบเคส ' + referralId + ' แล้ว ขอบคุณครับ\n' +
      'ถ้ามีคำถามเพิ่มภายหลัง พิมพ์เข้ามาได้ทุกเมื่อ');
    return true;
  }

  // ถามเพิ่ม → ถ้าเคยปิดไปแล้ว เปิดใหม่ก่อน (ถือว่ากดถามเพิ่ม = ตั้งใจเปิด)
  // แล้วรอพิมพ์คำถามส่งเข้าเคสนั้น
  if (String(row['status'] || '').trim() === 'Closed') {
    reopenReferralRow_(sheet, map, row);
  }
  writeContactFlow_(userId, { step: 'messageToCase', caseId: referralId });
  replyLineMessage_(event.replyToken,
    'พิมพ์คำถามเพิ่มสำหรับเคส ' + referralId + ' ได้เลยครับ');
  return true;
}

/** พิมพ์คำถามต่อหลังกด "ถามเพิ่ม" — ส่งเข้าเคสที่เลือกไว้ */
function handleMessageToCase_(event, flow, text, userId) {
  const caseId = String(flow.caseId || '').trim();
  const sheet = getSheet_(SHEETS.referrals);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === caseId;
  })[0];
  clearContactFlow_(userId);
  if (!row) {
    replyLineMessage_(event.replyToken, 'ไม่พบเคส ' + caseId + ' แล้ว');
    return;
  }
  routeReferrerMessageToCase_(event, row, text);
}
