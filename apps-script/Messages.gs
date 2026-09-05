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
  'channel', 'text', 'created_at',
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

/** เขียนหนึ่งข้อความลงชีต messages */
function appendMessage_(referralId, role, name, channel, text) {
  const sheet = getSheet_(SHEETS.messages);
  const map = ensureColumns_(sheet, MESSAGE_COLUMNS);
  const rowArr = new Array(sheet.getLastColumn()).fill('');
  rowArr[map['message_id']] = Utilities.getUuid();
  rowArr[map['referral_id']] = referralId;
  rowArr[map['sender_role']] = role;
  rowArr[map['sender_name']] = name || '';
  rowArr[map['channel']] = channel;
  rowArr[map['text']] = text;
  rowArr[map['created_at']] = new Date();
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
function notifyCounterparty_(sheet, map, row, senderRole, text) {
  const referralId = String(row['referral_id'] || '').trim();
  const caseToken = ensureCaseToken_(sheet, map, row);
  const map2 = ensureColumns_(sheet, CASE_THREAD_COLUMNS);
  // อ่านค่าปัจจุบันจากเซลล์จริง (row object อาจเก่ากว่าที่เพิ่ง set)
  const preview = String(text || '').slice(0, 300);

  if (senderRole === 'referrer') {
    // แจ้ง dent ที่กลุ่ม LINE
    const wasPending =
      String(readCell_(sheet, map2, row._row, 'dent_unread') || '')
        .toLowerCase() === 'yes';
    setCell_(sheet, map2, row._row, 'dent_unread', 'yes');
    if (!wasPending) {
      const audience = caseAudience_(row['referral_type']);
      pushLineMessage_(
        '💬 ' + referralId + ' มีข้อความจากแพทย์ต้นทาง\n' +
        '“' + preview + '”\n' +
        'ตอบในกลุ่มนี้ได้: พิมพ์  ตอบ ' + referralId + ': <ข้อความ>\n' +
        'หรือเปิด ' + SITE_URL + '/dashboard',
        audience
      );
    }
  } else {
    // แจ้งแพทย์ต้นทาง: อีเมลเสมอ (ฟรี) + push เตือนแบบรวบ
    const wasPending =
      String(readCell_(sheet, map2, row._row, 'referrer_unread') || '')
        .toLowerCase() === 'yes';
    setCell_(sheet, map2, row._row, 'referrer_unread', 'yes');

    const email = String(row['referrer_email'] || '').trim();
    if (email) {
      sendMessageEmailToReferrer_(email, referralId, caseToken, preview,
        String(row['sender_name'] || 'ทีมโลหิตวิทยา'));
    }
    if (!wasPending) {
      const userId = findLineUserByPhone_(row['referrer_phone']);
      if (userId) {
        const token = PropertiesService.getScriptProperties()
          .getProperty('LINE_CHANNEL_ACCESS_TOKEN');
        if (token) {
          sendOneLinePush_(token, userId,
            '💬 เคส ' + referralId + ' มีข้อความตอบกลับจากทีมโลหิตวิทยา\n' +
            '“' + preview + '”\n' +
            'อ่าน/ตอบต่อ: ' + SITE_URL + '/case/' + caseToken);
        }
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
    'อ่านทั้งหมดและตอบกลับได้ที่:\n' +
    SITE_URL + '/case/' + caseToken + '\n\n' +
    '--\n' +
    'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
    'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ (ตอบผ่านลิงก์ด้านบนแทน)';
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

/* ------------------------------------------------------------------ */
/* doPost actions (เรียกจากเว็บ)                                       */
/* ------------------------------------------------------------------ */

/** แพทย์ต้นทางส่งข้อความจากหน้า /case/[token] */
function postReferrerMessage_(payload) {
  const caseToken = String(payload.caseToken || '').trim();
  const text = String(payload.text || '').trim();
  if (!caseToken) throw new Error('ลิงก์ไม่ถูกต้อง');
  if (!text) throw new Error('ยังไม่ได้พิมพ์ข้อความ');
  if (text.length > 5000) throw new Error('ข้อความยาวเกินไป');

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['case_token'] || '').trim() === caseToken;
  })[0];
  if (!row) throw new Error('ลิงก์ไม่ถูกต้อง หรือเคสนี้ถูกปิดไปแล้ว');

  const name = String(row['referrer_org'] || 'แพทย์ต้นทาง').trim();
  appendMessage_(row['referral_id'], 'referrer', name, 'web', text);
  markCaughtUp_(sheet, map, row, 'referrer');
  notifyCounterparty_(sheet, map, row, 'referrer', text);
  return { ok: true };
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
  notifyCounterparty_(sheet, map, row, 'resident', text);
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
