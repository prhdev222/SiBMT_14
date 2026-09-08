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

// ปุ่มลัด "/" ใน Telegram (ต้องเป็นอังกฤษ) → คำสั่งไทยที่ answerGroupQuery_ เข้าใจ
// ตั้งเมนูปุ่มใน @BotFather → /setcommands (ดูคู่มือที่ผมส่งให้)
const TELEGRAM_SLASH_COMMANDS = {
  menu: 'เมนู',
  pending: 'เคสค้าง',
  unread: 'ข้อความใหม่',
  today: 'นัดวันนี้',
  tomorrow: 'นัดพรุ่งนี้',
  duty: 'เวร',
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

/**
 * ส่งข้อความเข้าปลายทาง Telegram หนึ่ง chat
 *
 * ทน rate-limit: ถ้าโดน 429 (ส่งถี่เกิน) Telegram บอก retry_after มา →
 * รอแล้วลองใหม่ (สูงสุด 3 รอบ) แทนที่จะเงียบหาย · log ทุก error ที่ไม่ใช่ 200
 * เพื่อให้เห็นว่าทำไม "บางครั้งไม่ตอบ"
 */
function telegramReply_(chatId, text, buttons) {
  const token = telegramToken_();
  if (!token || !chatId) {
    console.log('[Telegram ยังไม่ตั้งค่า] ' + text);
    return;
  }
  // buttons = [{text, url}] → ปุ่ม inline เรียงลงมาปุ่มละแถว (กดเปิดลิงก์ได้)
  const payload = {
    chat_id: String(chatId),
    text: text,
    disable_web_page_preview: true,
  };
  if (buttons && buttons.length) {
    payload.reply_markup = {
      inline_keyboard: buttons.map(function (b) {
        return [{ text: b.text, url: b.url }];
      }),
    };
  }
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/sendMessage', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      if (code === 200) return; // สำเร็จ
      const info = res.getContentText() || '';
      console.log('sendMessage ' + code + ': ' + info);
      // 429 = ส่งถี่เกิน → รอ retry_after แล้วลองใหม่
      if (code === 429) {
        var wait = 2;
        try { wait = (JSON.parse(info).parameters || {}).retry_after || 2; } catch (e) {}
        Utilities.sleep((wait + 1) * 1000);
        continue;
      }
      return; // error อื่น (400/403...) ลองใหม่ก็ไม่ช่วย
    } catch (err) {
      console.error('ส่ง Telegram ไม่สำเร็จ: ' + err);
      return;
    }
  }
  console.log('sendMessage ยอมแพ้หลังลอง 3 รอบ (rate-limit ยาว)');
}

/** ส่งแจ้งเตือนเข้ากลุ่มตาม audience (batch/red/fellow) — buttons ไม่ใส่ก็ได้ */
function sendTelegram_(text, audience, buttons) {
  telegramReply_(telegramChatId_(audience), text, buttons);
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
  // กัน Telegram ส่ง update เดิมซ้ำ (retry) — บอทตอบช้าเล็กน้อย Telegram จึง
  // คิดว่าไม่สำเร็จแล้วส่งซ้ำเรื่อย ๆ → จำ update_id ไว้ 1 ชม. เจอซ้ำก็ตอบ ok
  // ทันทีโดยไม่ทำงาน/ไม่ตอบซ้ำ (แก้อาการบอทพ่นข้อความวนไม่หยุด)
  const uid = update && update.update_id;
  if (uid != null) {
    const cache = CacheService.getScriptCache();
    const key = 'tg_seen_' + uid;
    if (cache.get(key)) return jsonResponse_({ ok: true });
    cache.put(key, '1', 3600);
  }

  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat) return jsonResponse_({ ok: true });

  const chatId = String(msg.chat.id);
  const text = String(msg.text || '').trim();

  // /login → เข้า dashboard (ตรวจสิทธิ์เองด้วย getChatMember จึงข้าม gate ด้านล่างได้
  // ใช้ได้ทั้งในกลุ่มและใน DM ส่วนตัวกับบอท)
  if (/^\/?(login|เข้าระบบ|เข้าหลังบ้าน)\s*$/i.test(text)) {
    handleTelegramLoginCommand_(msg, chatId);
    return jsonResponse_({ ok: true });
  }

  // /app → ปุ่ม web_app เปิด dashboard ในแอป Telegram (แบบ B)
  if (/^\/?(app|เปิดระบบ|เปิด dashboard|dashboard)\s*$/i.test(text)) {
    sendTelegramWebAppButton_(chatId);
    return jsonResponse_({ ok: true });
  }

  // รับเฉพาะกลุ่มที่ตั้งไว้ (Apps Script อ่าน header ไม่ได้ จึงยืนยันด้วย chat_id)
  // ถ้า id ยังไม่ตรง → บอกเลขที่ถูกในกลุ่มเลย เพื่อให้ตั้งค่าได้ง่าย (ไม่ต้องอ่าน log)
  if (telegramKnownChats_().indexOf(chatId) === -1) {
    console.log('Telegram: chat ' + chatId + ' ยังไม่อยู่ในกลุ่มที่ตั้งไว้');
    telegramReply_(chatId,
      'ℹ️ ตั้งค่ากลุ่มนี้\n' +
      'chat_id = ' + chatId + '\n\n' +
      'เอาเลขนี้ไปใส่ Script Property ให้ตรงกลุ่ม:\n' +
      'TELEGRAM_CHAT_ADMIN / _RESIDENT / _FELLOW\n' +
      'แล้ว Save (ไม่ต้อง deploy) → บอทจะตอบคำสั่งได้');
    return jsonResponse_({ ok: true });
  }
  if (!text) return jsonResponse_({ ok: true });

  // dent ตอบแพทย์ต้นทาง: "ตอบ HEM-xxxx: <ข้อความ>"
  const m = text.match(/^ตอบ\s+(HEM-\d{8}-\d{4})\s*[:：]\s*([\s\S]+)$/i);
  if (m) {
    handleTelegramDentReply_(chatId, m[1].toUpperCase(), String(m[2] || '').trim());
    return jsonResponse_({ ok: true });
  }

  // รหัสผูกกลุ่ม LINE — เฉพาะกลุ่มแอดมิน (ดู handleGroupBind_ ใน LineWebhook.gs)
  if (/^(รหัสผูกกลุ่ม|เปลี่ยนรหัสผูกกลุ่ม|\/linecode)$/i.test(text)) {
    if (chatId !== String(telegramChatId_('red'))) {
      telegramReply_(chatId, 'ดูรหัสผูกกลุ่มได้เฉพาะในกลุ่มแอดมิน');
      return jsonResponse_({ ok: true });
    }
    const rotate = /^เปลี่ยน/.test(text);
    const code = rotate ? rotateLineGroupCode_() : lineGroupCode_();
    telegramReply_(chatId,
      (rotate ? '🔄 ออกรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้\n\n' : '') +
      '🔑 รหัสผูกกลุ่ม LINE:  ' + code + '\n\n' +
      'วิธีใช้: เชิญบอท LINE OA เข้ากลุ่ม แล้วพิมพ์ในกลุ่มนั้น\n' +
      '   ผูกกลุ่ม ' + code + '\n\n' +
      'กลุ่มที่ผูกอยู่ตอนนี้: ' + boundLineGroups_().length + ' กลุ่ม\n' +
      'ยกเลิก: พิมพ์ "ยกเลิกผูกกลุ่ม" ในกลุ่มนั้น หรือเอาบอทออกจากกลุ่ม\n' +
      'รหัสหลุด → พิมพ์ "เปลี่ยนรหัสผูกกลุ่ม" ที่นี่\n' +
      'ดู/แก้รหัสได้ที่หน้าเว็บ ตั้งค่าระบบ (แท็บ config ในชีต key line_group_code)');
    return jsonResponse_({ ok: true });
  }

  // แอดมินตอบตั๋วติดต่อจากแพทย์ต้นทาง: "#ABCD ข้อความ" — เฉพาะกลุ่มแอดมิน
  // ส่งแบบฟรี (reply ตอนเขาทัก LINE + อีเมลถ้ามี) ไม่ใช้ push (8 ก.ย. 2569)
  const tk = text.match(/^#([A-Za-z2-9]{4})\s+([\s\S]+)$/);
  if (tk) {
    if (chatId === String(telegramChatId_('red'))) {
      telegramReply_(chatId, deliverAdminReplyFree_(tk[1].toUpperCase(), tk[2].trim()));
    } else {
      telegramReply_(chatId, 'คำสั่งตอบตั๋ว (#รหัส) ใช้ได้เฉพาะในกลุ่มแอดมิน');
    }
    return jsonResponse_({ ok: true });
  }

  // เปลี่ยนผู้รับผิดชอบ: "มอบ HEM-xxxx: <ชื่อ>" → แจ้งกลุ่มแอดมิน/อาจารย์ด้วย
  const rm = text.match(/^มอบ\s+(HEM-\d{8}-\d{4})\s*[:：]\s*([\s\S]+)$/i);
  if (rm) {
    handleTelegramReassign_(msg, chatId, rm[1].toUpperCase(), String(rm[2] || '').trim());
    return jsonResponse_({ ok: true });
  }

  // ปุ่มลัด /command (เมนูพิมพ์ "/" ใน Telegram) → แปลงเป็นคำสั่งไทยแล้วใช้ตัวตอบกลาง
  // Telegram ส่งมาเป็น "/pending" หรือ "/pending@BotName" — ตัด @ชื่อบอทออก
  let query = text;
  if (query.charAt(0) === '/') {
    const cmd = query.slice(1).split(/[@\s]/)[0].toLowerCase();
    if (TELEGRAM_SLASH_COMMANDS[cmd]) query = TELEGRAM_SLASH_COMMANDS[cmd];
  }

  // คำสั่งถาม-ตอบ (ฟรี) — ใช้ตัวตอบกลางร่วมกับ LINE: เมนู, เคสค้าง, ข้อความใหม่,
  // นัดวันนี้/พรุ่งนี้, นัด 15/9, เวร, นัด fellow, พิมพ์ชื่อ fellow ดูนัดตัวเอง
  try {
    const reply = answerGroupQuery_(query, {
      inFellowGroup: chatId === String(telegramChatId_('fellow')),
    });
    if (reply) telegramReply_(chatId, reply);
  } catch (err) {
    telegramReply_(chatId, '⚠️ บอทขัดข้อง ตอบไม่ได้: ' + err);
  }
  return jsonResponse_({ ok: true });
}

/**
 * เปลี่ยนผู้รับผิดชอบเคสจาก Telegram ("มอบ HEM-xxx: ชื่อ")
 * แจ้งกลุ่มแอดมิน/อาจารย์ให้รับรู้ด้วย (คำขอผู้ใช้ 7 ก.ย. 2569)
 */
function handleTelegramReassign_(msg, chatId, referralId, name) {
  if (!name) return;
  const sheet = getSheet_(SHEETS.referrals);
  const row = readRows_(sheet).filter(function (r) {
    return String(r['referral_id'] || '').trim() === referralId;
  })[0];
  if (!row) { telegramReply_(chatId, 'ไม่พบเคส ' + referralId + ' ในระบบ'); return; }

  const map = ensureColumns_(sheet, ['assigned_to']);
  setCell_(sheet, map, row._row, 'assigned_to', name);

  const from = msg.from || {};
  const by = ((from.first_name || '') + ' ' + (from.last_name || '')).trim() ||
    from.username || '';

  telegramReply_(chatId, '✅ มอบ ' + referralId + ' ให้ ' + name + ' แล้ว');
  // แจ้งกลุ่มแอดมิน/อาจารย์
  sendTelegram_(
    '👤 เปลี่ยนผู้รับผิดชอบเคส\n' + referralId + ' → ' + name +
    (by ? '\n(โดย ' + by + ')' : ''),
    'red');
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
/* เข้า dashboard จากในกลุ่ม (พิมพ์ /login) — ยืนยันจากสมาชิกกลุ่ม        */
/* ------------------------------------------------------------------ */

/**
 * เช็คว่า userId เป็นสมาชิกกลุ่มทีมไหน → คืน role (admin/resident/fellow)
 * หรือ '' ถ้าไม่ได้อยู่กลุ่มไหนเลย · ใช้ getChatMember (ต้องมี bot token)
 */
function telegramMemberRole_(userId) {
  const token = telegramToken_();
  if (!token || !userId) return '';
  const props = PropertiesService.getScriptProperties();
  const groups = [
    { id: props.getProperty('TELEGRAM_CHAT_ADMIN') ||
        props.getProperty('TELEGRAM_CHAT_ID'), role: 'admin' },
    { id: props.getProperty('TELEGRAM_CHAT_RESIDENT'), role: 'resident' },
    { id: props.getProperty('TELEGRAM_CHAT_FELLOW'), role: 'fellow' },
  ];
  for (var i = 0; i < groups.length; i++) {
    if (!groups[i].id) continue;
    try {
      const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/getChatMember?chat_id=' +
        encodeURIComponent(groups[i].id) + '&user_id=' + encodeURIComponent(userId),
        { muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText() || '{}');
      if (data.ok && data.result) {
        const st = data.result.status;
        if (st === 'creator' || st === 'administrator' ||
            st === 'member' || st === 'restricted') {
          return groups[i].role;
        }
      }
    } catch (err) { /* ลองกลุ่มถัดไป */ }
  }
  return '';
}

/**
 * /login ในกลุ่ม → สร้างลิงก์เข้า dashboard ครั้งเดียว (อายุ 5 นาที)
 * ส่งเข้า DM ส่วนตัวเพื่อกันคนอื่นในกลุ่มกดแทน
 */
function handleTelegramLoginCommand_(msg, chatId) {
  const from = msg.from || {};
  const userId = from.id;
  if (!userId) return;

  const role = telegramMemberRole_(userId);
  if (!role) {
    telegramReply_(chatId, 'ไม่พบสิทธิ์ — บัญชี Telegram นี้ไม่ได้อยู่ในกลุ่มทีม');
    return;
  }
  const name = ((from.first_name || '') + ' ' + (from.last_name || '')).trim() ||
    from.username || ('Telegram ' + userId);

  const token = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('tglogin_' + token,
    JSON.stringify({ name: name, role: role }), 300);
  const url = SITE_URL + '/login/telegram?t=' + token;

  // ส่งลิงก์เข้า DM (chat_id = userId) — ได้เฉพาะถ้าผู้ใช้เคยกด Start กับบอท
  const dm = UrlFetchApp.fetch(TELEGRAM_API + telegramToken_() + '/sendMessage', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: String(userId),
      text: '🔑 ลิงก์เข้า dashboard (ใช้ได้ครั้งเดียว · หมดใน 5 นาที)\n' + url +
        '\n\n⚠️ อย่าส่งต่อลิงก์นี้ให้ใคร',
      disable_web_page_preview: true,
    }),
    muteHttpExceptions: true,
  });
  const ok = (JSON.parse(dm.getContentText() || '{}')).ok;
  if (ok) {
    if (String(chatId) !== String(userId)) {
      telegramReply_(chatId, '✅ ส่งลิงก์เข้า dashboard ให้ทาง DM แล้ว (แชทส่วนตัวกับบอท)');
    }
  } else {
    telegramReply_(chatId,
      '⚠️ ส่งลิงก์ทาง DM ไม่ได้ — แตะชื่อบอท → กด Start คุยกับบอทก่อน แล้วพิมพ์ /login อีกครั้ง');
  }
}

/**
 * ยืนยัน Telegram Web App (แบบ B: แตะปุ่ม → dashboard เปิดในแอป Telegram)
 *
 * รับ initData ที่ Telegram แนบมา (เซ็นด้วย bot token ปลอมไม่ได้) → ตรวจลายเซ็น
 * ตามอัลกอริทึม Web App → ดึง user → เช็คว่าอยู่ในกลุ่มทีม → คืนชื่อ/role
 *   secret = HMAC(key="WebAppData", msg=token) · hash = HMAC(key=secret, msg=dcs)
 */
function verifyTelegramWebApp_(payload) {
  const initData = String((payload && payload.initData) || '');
  const token = telegramToken_();
  if (!initData || !token) return { allowed: false };

  const pairs = initData.split('&').map(function (kv) {
    const i = kv.indexOf('=');
    return { k: kv.slice(0, i), v: decodeURIComponent(kv.slice(i + 1)) };
  });
  var hash = '';
  var authDate = 0;
  var userJson = '';
  const check = [];
  pairs.forEach(function (p) {
    if (p.k === 'hash') { hash = p.v; return; }
    if (p.k === 'auth_date') authDate = parseInt(p.v, 10) || 0;
    if (p.k === 'user') userJson = p.v;
    check.push(p.k + '=' + p.v);
  });
  if (!hash) return { allowed: false };
  check.sort();

  const secret = Utilities.computeHmacSha256Signature(token, 'WebAppData');
  const calc = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(check.join('\n')).getBytes(), secret);
  const calcHex = calc.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
  if (calcHex !== String(hash).toLowerCase()) return { allowed: false };

  // initData เปิดค้างได้ — จำกัดอายุ 1 วันกันนำ initData เก่ามาใช้ซ้ำนาน ๆ
  if (!authDate || (Date.now() / 1000 - authDate) > 86400) return { allowed: false };

  var user;
  try { user = JSON.parse(userJson); } catch (e) { return { allowed: false }; }
  if (!user || !user.id) return { allowed: false };

  const role = telegramMemberRole_(user.id);
  if (!role) return { allowed: false };
  const name = ((user.first_name || '') + ' ' + (user.last_name || '')).trim() ||
    user.username || ('Telegram ' + user.id);
  return { allowed: true, displayName: name, role: role };
}

/** ลิงก์ Mini App (จาก @BotFather /newapp) — ใช้เป็นปุ่ม url เปิดในกลุ่มได้ */
function telegramAppLink_() {
  return PropertiesService.getScriptProperties()
    .getProperty('TELEGRAM_APP_LINK') || '';
}

/**
 * ปุ่มเปิด dashboard (แบบ B)
 *
 * ⚠️ ปุ่ม web_app เปิดในกลุ่มไม่ได้ (Telegram อนุญาตเฉพาะ DM) — ในกลุ่มต้องใช้
 * ปุ่ม url ชี้ไปลิงก์ Mini App (t.me/<bot>/<app>) ที่สร้างไว้ที่ @BotFather /newapp
 * แตะแล้วเปิด Web App auto-login เหมือนกัน · ตั้งลิงก์ใน TELEGRAM_APP_LINK
 */
function sendTelegramWebAppButton_(chatId) {
  const token = telegramToken_();
  if (!token) return;
  const link = telegramAppLink_();
  if (!link) {
    telegramReply_(chatId,
      '⚠️ ยังไม่ได้ตั้ง Mini App — ผู้ดูแลสร้างที่ @BotFather (/newapp) แล้ววางลิงก์ ' +
      't.me/<bot>/<app> ใน Script Property TELEGRAM_APP_LINK');
    return;
  }
  UrlFetchApp.fetch(TELEGRAM_API + token + '/sendMessage', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: String(chatId),
      text: '📲 เปิด dashboard หลังบ้าน — แตะปุ่มด้านล่าง (เข้าได้เลย ไม่ต้อง login)',
      reply_markup: {
        inline_keyboard: [[{ text: '📲 เปิด dashboard', url: link }]],
      },
    }),
    muteHttpExceptions: true,
  });
}

/**
 * ส่งปุ่ม "เปิด dashboard" เข้าทุกกลุ่มแล้วปักหมุด — รันครั้งเดียวจาก editor
 *
 * ⚠️ บอทต้องเป็น admin ของกลุ่ม + มีสิทธิ์ "Pin messages" ถึงจะปักหมุดได้
 * ถ้าปักหมุดไม่ได้ log จะบอก แล้วปักหมุดเองก็ได้ (แตะค้างข้อความบอท → Pin)
 */
function pinDashboardButtons() {
  const token = telegramToken_();
  if (!token) { Logger.log('❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN'); return; }
  const link = telegramAppLink_();
  if (!link) {
    Logger.log('❌ ยังไม่ได้ตั้ง TELEGRAM_APP_LINK — สร้าง Mini App ที่ @BotFather (/newapp) ' +
      'แล้ววางลิงก์ t.me/<bot>/<app> ใน Script Property TELEGRAM_APP_LINK ก่อน');
    return;
  }
  const props = PropertiesService.getScriptProperties();
  ['TELEGRAM_CHAT_ADMIN', 'TELEGRAM_CHAT_RESIDENT', 'TELEGRAM_CHAT_FELLOW']
    .forEach(function (key) {
      const chatId = props.getProperty(key);
      if (!chatId) { Logger.log(key + ' — ยังไม่ตั้ง chat_id ข้าม'); return; }

      const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/sendMessage', {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: String(chatId),
          text:
            '📌 คู่มือกลุ่มนี้\n' +
            '─────────────\n' +
            '📲 เข้า dashboard หลังบ้าน — แตะปุ่มด้านล่าง (เข้าได้เลย ไม่ต้อง login)\n' +
            '   หรือพิมพ์  /login  รับลิงก์เข้าทางเบราว์เซอร์\n\n' +
            '💬 ถามบอทได้ (ฟรี) — พิมพ์  เมนู  เพื่อดูคำสั่งทั้งหมด\n' +
            '   เช่น  เคสค้าง · นัดวันนี้ · นัดพรุ่งนี้ · ข้อความใหม่ · เวร\n\n' +
            '↩️ ตอบแพทย์ต้นทาง\n' +
            '   พิมพ์  ตอบ HEM-xxxxxxxx-xxxx: ข้อความ\n\n' +
            '🔒 ห้ามพิมพ์ชื่อ–HN ผู้ป่วยในกลุ่ม — อ้างอิงด้วยเลขเคส HEM-... เท่านั้น',
          reply_markup: {
            inline_keyboard: [[{ text: '📲 เปิด dashboard', url: link }]],
          },
        }),
        muteHttpExceptions: true,
      });
      const data = JSON.parse(res.getContentText() || '{}');
      if (!data.ok) {
        Logger.log(key + ' — ส่งไม่สำเร็จ: ' + res.getContentText());
        return;
      }
      const pin = UrlFetchApp.fetch(TELEGRAM_API + token + '/pinChatMessage', {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: String(chatId),
          message_id: data.result.message_id,
          disable_notification: true,
        }),
        muteHttpExceptions: true,
      });
      const pinOk = (JSON.parse(pin.getContentText() || '{}')).ok;
      Logger.log(key + ' → ' + (pinOk
        ? '✅ ส่ง + ปักหมุดแล้ว'
        : '⚠️ ส่งแล้ว แต่ปักหมุดไม่ได้ (บอทต้องเป็น admin + สิทธิ์ Pin) — ปักหมุดเองได้: '
          + pin.getContentText()));
    });
}

/** ตั้งปุ่มเมนู (ข้างช่องพิมพ์) ในแชทส่วนตัวกับบอทให้เปิด dashboard — รันครั้งเดียว */
function setTelegramMenuButton() {
  const token = telegramToken_();
  if (!token) { Logger.log('❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN'); return; }
  const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/setChatMenuButton', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Dashboard',
        web_app: { url: SITE_URL + '/tg' },
      },
    }),
    muteHttpExceptions: true,
  });
  Logger.log('setChatMenuButton → ' + res.getContentText());
}

/**
 * แลก token เข้าระบบ (เรียกจากเว็บ) → คืนชื่อ/role ถ้าใช้ได้ แล้วลบทิ้ง (ครั้งเดียว)
 */
function redeemTelegramLogin_(payload) {
  const token = String((payload && payload.token) || '').trim();
  if (!token) return { allowed: false };
  const cache = CacheService.getScriptCache();
  const raw = cache.get('tglogin_' + token);
  if (!raw) return { allowed: false };
  cache.remove('tglogin_' + token);
  try {
    const data = JSON.parse(raw);
    return { allowed: true, displayName: data.name, role: data.role };
  } catch (e) {
    return { allowed: false };
  }
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

/**
 * วินิจฉัย: ทำไม "นัดวันนี้/พรุ่งนี้" ขึ้น "ไม่มีนัด" ทั้งที่ชีตมีนัด
 * รันจาก editor แล้วอ่าน log — จะบอกว่าอ่านชีตได้กี่แถว, กลุ่ม 1 กี่แถว,
 * status/appointment_date ของแต่ละแถวเป็นอะไร และแปลงเป็นวันที่ได้ไหม
 */
function debugAppointments() {
  const sheet = getSheet_(SHEETS.referrals);
  Logger.log('ชีต "' + sheet.getName() + '" · แถวข้อมูล = ' + (sheet.getLastRow() - 1));
  const rows = readRows_(sheet);
  Logger.log('readRows_ อ่านได้ ' + rows.length + ' แถว · มีคอลัมน์ appointment_date? ' +
    Boolean(rows[0] && ('appointment_date' in rows[0])) +
    ' · มีคอลัมน์ referral_type? ' + Boolean(rows[0] && ('referral_type' in rows[0])));

  const tx = rows.filter(function (r) {
    return String(r['referral_type'] || '').trim() === TYPES.transplant;
  });
  Logger.log('กลุ่ม 1 (referral_type = "' + TYPES.transplant + '") = ' + tx.length + ' แถว');
  if (tx.length === 0 && rows.length > 0) {
    const seen = {};
    rows.forEach(function (r) { seen[String(r['referral_type'])] = true; });
    Logger.log('  ⚠️ ค่า referral_type ที่พบจริงในชีต: ' + Object.keys(seen).join(' | '));
  }

  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  tx.slice(0, 20).forEach(function (r) {
    const raw = r['appointment_date'];
    const d = toDate_(raw);
    const iso = d ? Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd') : '(แปลงวันที่ไม่ได้)';
    Logger.log('  ' + r['referral_id'] + ' | status="' + r['status'] + '" | ' +
      'appointment_date=' + JSON.stringify(raw) + ' ' +
      Object.prototype.toString.call(raw) + ' → ' + iso +
      (iso === today ? '   ← วันนี้' : ''));
  });
  Logger.log('วันนี้ (' + TIMEZONE + ') = ' + today);
  Logger.log('ตัวกรองนัด: referral_type=TRANSPLANT_APPOINTMENT + status="Appointment Confirmed" (ตรงเป๊ะ) + วันที่ตรงวัน');
}

/** ทดสอบส่งเข้าทุกกลุ่มที่ตั้งไว้ */
function testTelegram() {
  ['red', 'batch', 'fellow'].forEach(function (a) {
    sendTelegram_('🔔 ทดสอบ Telegram (' + a + ') จากระบบ SiBMT-refer สำเร็จ', a);
  });
  Logger.log('ส่งข้อความทดสอบไปทุกกลุ่มที่ตั้ง chat_id ไว้แล้ว');
}

/**
 * ผูก webhook ให้ Telegram ส่งข้อความเข้าระบบ — รันครั้งเดียวหลัง Deploy
 *
 * ⚠️ ต้องใช้ URL แบบ /exec (สาธารณะ ตัวเดียวกับที่ LINE ใช้) ไม่ใช่ /dev
 * getService().getUrl() ตอนรันจาก editor คืน /dev (ต้องล็อกอิน → Telegram 401)
 * จึงอ่าน URL /exec จาก Script Property 'WEB_APP_URL' ก่อนเสมอ
 *   วิธีหา: Deploy → Manage deployments → Web app → คัดลอก URL ลงท้าย /exec
 */
function setTelegramWebhook() {
  const token = telegramToken_();
  if (!token) { Logger.log('❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN'); return; }
  const props = PropertiesService.getScriptProperties();

  // แนะนำ: ชี้ webhook ไปที่ตัวคั่น Cloudflare (TELEGRAM_WEBHOOK_URL) เพื่อกัน
  // loop — Apps Script /exec ตอบผ่าน redirect ทำให้ Telegram retry ไม่หยุด
  //   TELEGRAM_WEBHOOK_URL = https://<โดเมนเว็บ>/api/telegram
  // ถ้าไม่ตั้ง จะ fallback ไป WEB_APP_URL (/exec) — ใช้ได้แต่เสี่ยง loop
  const url = props.getProperty('TELEGRAM_WEBHOOK_URL') ||
    props.getProperty('WEB_APP_URL') || ScriptApp.getService().getUrl();
  if (!url) {
    Logger.log('❌ ยังไม่มี URL — ตั้ง Script Property TELEGRAM_WEBHOOK_URL ก่อน');
    return;
  }
  const viaWorker = url.indexOf('/api/telegram') !== -1;
  if (!viaWorker && url.indexOf('/exec') === -1) {
    Logger.log('⚠️ URL ไม่ใช่ตัวคั่น (/api/telegram) และไม่ใช่ /exec: ' + url);
    Logger.log('→ ตั้ง TELEGRAM_WEBHOOK_URL = https://<โดเมนเว็บ>/api/telegram');
    return;
  }

  // secret_token → Telegram แนบ header ให้ตัวคั่นยืนยันว่าเป็น Telegram จริง
  // ต้องตรงกับ env TELEGRAM_WEBHOOK_SECRET บน Cloudflare (ถ้าตั้งไว้)
  const secret = props.getProperty('TELEGRAM_WEBHOOK_SECRET') || '';
  let api = TELEGRAM_API + token + '/setWebhook?url=' + encodeURIComponent(url) +
    '&drop_pending_updates=true';
  if (secret) api += '&secret_token=' + encodeURIComponent(secret);

  const res = UrlFetchApp.fetch(api, { muteHttpExceptions: true });
  Logger.log('setWebhook → ' + res.getContentText());
  Logger.log('URL ที่ผูก: ' + url + (viaWorker ? '  (ผ่านตัวคั่น ✅)' : '  (ตรงไป /exec ⚠️ เสี่ยง loop)'));
}

/** ตรวจสถานะ webhook — url ที่ตั้งไว้, error ล่าสุด, จำนวน update ค้าง */
function telegramWebhookInfo() {
  const token = telegramToken_();
  if (!token) { Logger.log('❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN'); return; }
  const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/getWebhookInfo',
    { muteHttpExceptions: true });
  Logger.log('getWebhookInfo → ' + res.getContentText());
  // URL ที่ webhook ใช้จริง = WEB_APP_URL (/exec) — ไม่ใช่ getService (/dev editor)
  Logger.log('WEB_APP_URL ที่ตั้งไว้ (ตัวจริงที่ webhook ใช้): ' +
    (PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') ||
      '(ยังไม่ตั้ง!)'));
  Logger.log('chat_id ที่ตั้งไว้: ' + JSON.stringify(telegramKnownChats_()));
}

function deleteTelegramWebhook() {
  const token = telegramToken_();
  if (!token) return;
  const res = UrlFetchApp.fetch(TELEGRAM_API + token + '/deleteWebhook',
    { muteHttpExceptions: true });
  Logger.log('deleteWebhook → ' + res.getContentText());
}
