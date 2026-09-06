/**
 * Telegram Bot — แจ้งเตือนทีม (admin/dent/fellow) ฟรีไม่จำกัด + รับตอบกลับ
 *
 * ตั้งค่าใน Script Properties:
 *   TELEGRAM_BOT_TOKEN      — token จาก @BotFather
 *   TELEGRAM_CHAT_ADMIN     — chat_id กลุ่ม admin  (เลขติดลบ)
 *   TELEGRAM_CHAT_RESIDENT  — chat_id กลุ่ม dent/resident
 *   TELEGRAM_CHAT_FELLOW    — chat_id กลุ่ม fellow
 *   (หรือใช้ TELEGRAM_CHAT_ID ตัวเดียวถ้าใช้กลุ่มเดียว)
 *
 * ขั้นตั้งค่า: telegramGetChatId() ดู id → ใส่ Properties → setTelegramWebhook() ครั้งเดียว
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

const TELEGRAM_CHAT_BY_AUDIENCE = {
  batch: 'TELEGRAM_CHAT_RESIDENT',
  red: 'TELEGRAM_CHAT_ADMIN',
  fellow: 'TELEGRAM_CHAT_FELLOW',
};

function telegramToken_() {
  return PropertiesService.getScriptProperties()
    .getProperty('TELEGRAM_BOT_TOKEN') || '';
}

function telegramChatId_(audience) {
  const props = PropertiesService.getScriptProperties();
  const key = TELEGRAM_CHAT_BY_AUDIENCE[audience];
  return (key && props.getProperty(key)) ||
    props.getProperty('TELEGRAM_CHAT_ID') || '';
}

/** chat id ของทุกกลุ่มที่ตั้งไว้ — ใช้ยืนยันว่า update มาจากกลุ่มเรา (กันปลอม) */
function telegramKnownChats_() {
  const props = PropertiesService.getScriptProperties();
  const ids = [];
  ['TELEGRAM_CHAT_ADMIN', 'TELEGRAM_CHAT_RESIDENT', 'TELEGRAM_CHAT_FELLOW',
    'TELEGRAM_CHAT_ID'].forEach(function (k) {
    const v = props.getProperty(k);
    if (v) ids.push(String(v).trim());
  });
  return ids;
}

/** ส่งข้อความเข้าปลายทาง Telegram หนึ่ง chat */
function telegramReply_(chatId, text) {
  const token = telegramToken_();
  if (!token || !chatId) {
    console.log('[Telegram ยังไม่ตั้งค่า] ' + text);
    return;
  }
  try {
    UrlFetchApp.fetch(TELEGRAM_API + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: String(chatId),
        text: text,
        disable_web_page_preview: true,
      }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error('ส่ง Telegram ไม่สำเร็จ: ' + err);
  }
}

/** ส่งแจ้งเตือนเข้ากลุ่มตาม audience (batch/red/fellow) */
function sendTelegram_(text, audience) {
  telegramReply_(telegramChatId_(audience), text);
}

/**
 * แจ้งเตือนทีม — Telegram (ฟรี) เสมอ + LINE ถ้าเปิด line_push (ค่าเริ่มต้นปิด)
 * ใช้แทน pushLineMessage_ ในทุกจุดแจ้งเตือนทีม
 */
function sendTeamNotify_(text, audience) {
  sendTelegram_(text, audience);
  pushLineMessage_(text, audience); // no-op ถ้า line_push=off
}

/* ------------------------------------------------------------------ */
/* รับข้อความจาก Telegram (webhook) — dent ตอบแพทย์ต้นทางได้จากในกลุ่ม   */
/* ------------------------------------------------------------------ */

function handleTelegramUpdate_(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat) return jsonResponse_({ ok: true });

  const chatId = String(msg.chat.id);
  const text = String(msg.text || '').trim();

  // รับเฉพาะกลุ่มที่ตั้งไว้ (Apps Script อ่าน header ไม่ได้ จึงยืนยันด้วย chat_id)
  if (telegramKnownChats_().indexOf(chatId) === -1) {
    console.log('Telegram: ข้าม chat ' + chatId + ' (ไม่อยู่ในกลุ่มที่ตั้งไว้)');
    return jsonResponse_({ ok: true });
  }
  if (!text) return jsonResponse_({ ok: true });

  // dent ตอบแพทย์ต้นทาง: "ตอบ HEM-xxxx: <ข้อความ>"
  const m = text.match(/^ตอบ\s+(HEM-\d{8}-\d{4})\s*[:：]\s*([\s\S]+)$/i);
  if (m) {
    handleTelegramDentReply_(chatId, m[1].toUpperCase(), String(m[2] || '').trim());
    return jsonResponse_({ ok: true });
  }

  // ดึงข้อมูลเอง (ฟรี): "สรุป/เคสค้าง" · "ข้อความใหม่"
  if (/^(สรุป|เคสค้าง|งานค้าง|ค้าง)\s*$/.test(text)) {
    telegramReply_(chatId, buildPendingReply_());
    return jsonResponse_({ ok: true });
  }
  if (/^(ข้อความใหม่|ข้อความ)\s*$/.test(text)) {
    telegramReply_(chatId, buildUnreadReply_());
    return jsonResponse_({ ok: true });
  }
  return jsonResponse_({ ok: true });
}

function handleTelegramDentReply_(chatId, referralId, body) {
  if (!body) return;
  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === referralId;
  })[0];
  if (!row) {
    telegramReply_(chatId, 'ไม่พบเคส ' + referralId + ' ในระบบ');
    return;
  }
  appendMessage_(referralId, 'resident', 'ทีมโลหิตวิทยา', 'telegram', body);
  markCaughtUp_(sheet, map, row, 'dent');
  // แจ้งแพทย์ต้นทาง: อีเมลเสมอ (ฟรี) + LINE เฉพาะตอนเปิดสวิตช์ line_push
  // แพทย์อ่าน/ตอบต่อทาง LINE reply หรือ /case — เหมือน dent ตอบผ่าน LINE
  notifyCounterparty_(sheet, map, row, 'resident', body);
  telegramReply_(chatId,
    '✅ บันทึกและส่งถึงแพทย์ต้นทางแล้ว (เคส ' + referralId + ')');
}

/* ------------------------------------------------------------------ */
/* ตัวช่วยตั้งค่า (รันจาก editor)                                       */
/* ------------------------------------------------------------------ */

/** ดู chat_id ของกลุ่มที่เพิ่มบอทไว้ — พิมพ์ข้อความในกลุ่มก่อน แล้วรันฟังก์ชันนี้ */
function telegramGetChatId() {
  const token = telegramToken_();
  if (!token) {
    Logger.log('❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN ใน Script Properties');
    return;
  }
  const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/getUpdates',
    { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());
  const seen = {};
  (data.result || []).forEach(function (u) {
    const src = u.message || u.edited_message || u.my_chat_member;
    const chat = src && src.chat;
    if (chat && !seen[chat.id]) {
      seen[chat.id] = true;
      Logger.log('กลุ่ม: "' + (chat.title || chat.type) +
        '"  →  chat_id: ' + chat.id);
    }
  });
  Logger.log('──────────');
  Logger.log('เอา chat_id (เลขติดลบ) ไปใส่ Script Properties:');
  Logger.log('  TELEGRAM_CHAT_ADMIN / TELEGRAM_CHAT_RESIDENT / TELEGRAM_CHAT_FELLOW');
  Logger.log('ถ้าไม่เห็นกลุ่ม → พิมพ์ข้อความอะไรก็ได้ในกลุ่มนั้นก่อน แล้วรันใหม่');
}

/** ทดสอบส่งเข้าทุกกลุ่มที่ตั้งไว้ */
function testTelegram() {
  ['red', 'batch', 'fellow'].forEach(function (a) {
    sendTelegram_('🔔 ทดสอบ Telegram (' + a + ') จากระบบ SiBMT-refer สำเร็จ', a);
  });
  Logger.log('ส่งข้อความทดสอบไปทุกกลุ่มที่ตั้ง chat_id ไว้แล้ว');
}

/** ผูก webhook ให้ Telegram ส่งข้อความเข้าระบบ — รันครั้งเดียวหลัง Deploy */
function setTelegramWebhook() {
  const token = telegramToken_();
  if (!token) { Logger.log('❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN'); return; }
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    Logger.log('❌ ยังไม่ได้ Deploy เป็น Web App — Deploy ก่อนแล้วรันใหม่');
    return;
  }
  const res = UrlFetchApp.fetch(
    TELEGRAM_API + token + '/setWebhook?url=' + encodeURIComponent(url),
    { muteHttpExceptions: true });
  Logger.log('setWebhook → ' + res.getContentText());
  Logger.log('URL ที่ผูก: ' + url);
}

function deleteTelegramWebhook() {
  const token = telegramToken_();
  if (!token) return;
  const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/deleteWebhook',
    { muteHttpExceptions: true });
  Logger.log('deleteWebhook → ' + res.getContentText());
}
